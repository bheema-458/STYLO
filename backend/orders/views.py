
import uuid
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from io import BytesIO
from xml.sax.saxutils import escape

import razorpay
import traceback

from django.conf import settings
from django.db import transaction, IntegrityError
from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, BasePermission
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination

from cart.models import Cart, CartItem
from products.models import ProductVariant

from .models import (
    Order,
    OrderItem,
    PaymentAttempt,
    ReturnRequest,
    OrderStatusHistory,
    Refund,
)

from .serializers import (
    OrderSerializer,
    ReturnRequestSerializer,
    OrderStatusHistorySerializer,
    RefundSerializer,
)


# ==========================================================
# 1. ADMIN PERMISSION
# ==========================================================

class IsActiveAdmin(BasePermission):

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.is_active
            and request.user.is_staff
        )


# ==========================================================
# 2. PAGINATION
# ==========================================================

class OrderPagination(PageNumberPagination):

    page_size = 5
    page_size_query_param = "page_size"
    max_page_size = 50


# ==========================================================
# 3. ORDER HISTORY
# ==========================================================

def create_order_history(order, description, changed_by=None):

    OrderStatusHistory.objects.create(
        order=order,
        status=order.status,
        description=description,
        changed_by=changed_by,
    )


# ==========================================================
# 4. RAZORPAY CLIENT
# ==========================================================

def get_razorpay_client():

    key_id = getattr(settings, "RAZORPAY_KEY_ID", None)
    key_secret = getattr(settings, "RAZORPAY_KEY_SECRET", None)

    if not key_id or not key_secret:
        raise ValueError("Razorpay API keys are not configured.")

    return razorpay.Client(
        auth=(key_id, key_secret)
    )


# ==========================================================
# 5. COMMON HELPERS
# ==========================================================

def calculate_shipping(subtotal):

    if subtotal >= Decimal("2000.00"):
        return Decimal("0.00")

    return Decimal("99.00")


def to_paise(amount):

    return int(
        (
            Decimal(str(amount)) * Decimal("100")
        ).quantize(
            Decimal("1"),
            rounding=ROUND_HALF_UP,
        )
    )


def validate_order_variant(variant, quantity):

    product = variant.product
    category = product.category

    if (
        product.is_deleted
        or not product.is_active
        or not product.is_published
        or product.publication_status != "published"
    ):
        raise ValidationError(
            f"{product.name} is currently unavailable."
        )

    if category.is_deleted or not category.is_active:
        raise ValidationError(
            f"Category for {product.name} is unavailable."
        )

    if not variant.is_active:
        raise ValidationError(
            f"Selected variant of {product.name} is unavailable."
        )

    if (
        not variant.color.is_active
        or variant.color.is_deleted
    ):
        raise ValidationError(
            f"Selected color of {product.name} is unavailable."
        )

    if (
        not variant.size.is_active
        or variant.size.is_deleted
    ):
        raise ValidationError(
            f"Selected size of {product.name} is unavailable."
        )

    if quantity < 1:
        raise ValidationError(
            "Quantity must be at least 1."
        )

    if variant.stock < quantity:
        raise ValidationError(
            f"Only {variant.stock} items are available."
        )

    price = variant.current_price

    if price is None or price <= Decimal("0.00"):
        raise ValidationError(
            f"Invalid price for {product.name}."
        )

    return price


# ==========================================================
# 6. CREATE RAZORPAY PAYMENT ATTEMPT
# ==========================================================

def create_razorpay_payment(order):

    client = get_razorpay_client()

    attempt = PaymentAttempt.objects.create(
        order=order,
        amount=order.total_amount,
        currency="INR",
        status="created",
    )

    try:

        razorpay_order = client.order.create(
            data={
                "amount": to_paise(order.total_amount),
                "currency": "INR",
                "receipt": order.order_number,
                "notes": {
                    "stylo_order_id": str(order.id),
                    "order_number": order.order_number,
                },
            }
        )

        attempt.razorpay_order_id = razorpay_order["id"]

        attempt.save(
            update_fields=[
                "razorpay_order_id",
                "updated_at",
            ]
        )

        return attempt

    except Exception as exc:

        attempt.status = "failed"
        attempt.failure_reason = str(exc)[:500]

        attempt.save(
            update_fields=[
                "status",
                "failure_reason",
                "updated_at",
            ]
        )

        raise


# ==========================================================
# 7. CUSTOMER CHECKOUT
# ==========================================================

class CreateOrderView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request):

        required_fields = [
            "full_name",
            "phone_number",
            "address",
            "city",
            "state",
            "pincode",
        ]

        shipping_data = {}

        for field in required_fields:

            value = request.data.get(field)

            if not isinstance(value, str) or not value.strip():

                return Response(
                    {"error": f"{field} is required."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            shipping_data[field] = value.strip()

        payment_method = request.data.get(
            "payment_method",
            "cod",
        )

        if payment_method not in ["cod", "razorpay"]:

            return Response(
                {"error": "Invalid payment method."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:

            with transaction.atomic():

                cart = (
                    Cart.objects
                    .select_for_update()
                    .filter(user=request.user)
                    .first()
                )

                if not cart:
                    return Response(
                        {"error": "Your cart is empty."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                cart_items = list(
                    CartItem.objects
                    .select_for_update()
                    .filter(cart=cart)
                    .select_related("variant")
                    .order_by("variant_id")
                )

                if not cart_items:
                    return Response(
                        {"error": "Your cart is empty."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                subtotal = Decimal("0.00")
                order_items_data = []

                for cart_item in cart_items:

                    variant = (
                        ProductVariant.objects
                        .select_for_update()
                        .select_related(
                            "product",
                            "product__category",
                            "color",
                            "size",
                        )
                        .get(pk=cart_item.variant_id)
                    )

                    quantity = cart_item.quantity

                    price = validate_order_variant(
                        variant,
                        quantity,
                    )

                    item_total = price * quantity
                    subtotal += item_total

                    order_items_data.append({
                        "variant": variant,
                        "product": variant.product,
                        "quantity": quantity,
                        "price": price,
                        "total_price": item_total,
                    })

                shipping_charge = calculate_shipping(subtotal)
                tax_amount = Decimal("0.00")

                total_amount = (
                    subtotal + shipping_charge + tax_amount
                )

                order = Order.objects.create(

                    user=request.user,

                    order_number=(
                        f"STYLO-{uuid.uuid4().hex[:12].upper()}"
                    ),

                    full_name=shipping_data["full_name"],
                    phone_number=shipping_data["phone_number"],
                    address=shipping_data["address"],
                    city=shipping_data["city"],
                    state=shipping_data["state"],
                    pincode=shipping_data["pincode"],

                    subtotal=subtotal,
                    shipping_charge=shipping_charge,
                    tax_amount=tax_amount,
                    total_amount=total_amount,

                    payment_method=payment_method,
                    payment_status="pending",

                    status=(
                        "confirmed"
                        if payment_method == "cod"
                        else "pending"
                    ),
                )

                for item in order_items_data:

                    variant = item["variant"]
                    product = item["product"]

                    OrderItem.objects.create(
                        order=order,
                        product=product,
                        variant=variant,
                        product_name=product.name,
                        size=variant.size.name,
                        color=variant.color.name,
                        quantity=item["quantity"],
                        price=item["price"],
                        total_price=item["total_price"],
                    )

                    # COD: stock is deducted immediately.
                    # Razorpay: stock is deducted after verified payment.

                    if payment_method == "cod":

                        variant.stock -= item["quantity"]

                        variant.save(
                            update_fields=[
                                "stock",
                                "updated_at",
                            ]
                        )

                create_order_history(
                    order,
                    "Order placed successfully.",
                    request.user,
                )

                if payment_method == "cod":

                    create_order_history(
                        order,
                        "COD order confirmed.",
                        request.user,
                    )

                    CartItem.objects.filter(
                        cart=cart
                    ).delete()

                    return Response(
                        {
                            "message": "COD order placed successfully.",
                            "payment_method": "cod",
                            "order": OrderSerializer(order).data,
                        },
                        status=status.HTTP_201_CREATED,
                    )

            # Razorpay API call happens outside the DB transaction.

            try:

                attempt = create_razorpay_payment(order)

                return Response(
                    {
                        "message": "Order created. Complete your payment.",
                        "payment_method": "razorpay",
                        "order": OrderSerializer(order).data,
                        "payment": {
                            "key_id": settings.RAZORPAY_KEY_ID,
                            "razorpay_order_id": attempt.razorpay_order_id,
                            "amount": to_paise(order.total_amount),
                            "currency": "INR",
                            "payment_attempt_id": attempt.id,
                        },
                    },
                    status=status.HTTP_201_CREATED,
                )

            except Exception:

                order.payment_status = "failed"

                order.save(
                    update_fields=[
                        "payment_status",
                        "updated_at",
                    ]
                )

                return Response(
                    {
                        "error": (
                            "Could not start Razorpay payment. "
                            "You can retry payment using this order."
                        ),
                        "order_id": order.id,
                    },
                    status=status.HTTP_502_BAD_GATEWAY,
                )

        except ProductVariant.DoesNotExist:

            return Response(
                {"error": "A product variant no longer exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        except ValidationError as exc:

            return Response(
                {"error": exc.detail},
                status=status.HTTP_400_BAD_REQUEST,
            )


# ==========================================================
# 8. VERIFY RAZORPAY PAYMENT
# ==========================================================

class VerifyRazorpayPaymentView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request):

        order_id = request.data.get("order_id")
        razorpay_order_id = request.data.get("razorpay_order_id")
        razorpay_payment_id = request.data.get("razorpay_payment_id")
        razorpay_signature = request.data.get("razorpay_signature")

        if not all([
            order_id,
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
        ]):

            return Response(
                {"error": "Payment verification details are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        order = get_object_or_404(
            Order,
            pk=order_id,
            user=request.user,
            payment_method="razorpay",
        )

        try:

            # Find the exact attempt belonging to this order.
            attempt = get_object_or_404(
                PaymentAttempt,
                order=order,
                razorpay_order_id=razorpay_order_id,
            )

            # Verify Razorpay signature.
            client = get_razorpay_client()

            client.utility.verify_payment_signature({
                "razorpay_order_id": razorpay_order_id,
                "razorpay_payment_id": razorpay_payment_id,
                "razorpay_signature": razorpay_signature,
            })

            # Fetch payment directly from Razorpay.
            payment_details = client.payment.fetch(
                razorpay_payment_id
            )

            if payment_details.get("order_id") != razorpay_order_id:
                return Response(
                    {"error": "Payment does not match this order."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if int(payment_details.get("amount", 0)) != to_paise(order.total_amount):
                return Response(
                    {"error": "Payment amount does not match."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if payment_details.get("currency") != "INR":
                return Response(
                    {"error": "Invalid payment currency."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if payment_details.get("status") != "captured":
                return Response(
                    {"error": "Payment is not captured yet."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            with transaction.atomic():

                order = (
                    Order.objects
                    .select_for_update()
                    .get(
                        pk=order.pk,
                        user=request.user,
                    )
                )

                attempt = (
                    PaymentAttempt.objects
                    .select_for_update()
                    .get(
                        pk=attempt.pk,
                        order=order,
                    )
                )

                # Prevent duplicate verification and duplicate stock deduction.
                if order.payment_status == "paid":

                    return Response(
                        {
                            "message": "Payment already verified.",
                            "payment_status": "paid",
                            "order": OrderSerializer(order).data,
                        },
                        status=status.HTTP_200_OK,
                    )

                if order.status == "cancelled":

                    return Response(
                        {
                            "error": (
                                "This order was cancelled. "
                                "Contact support regarding the captured payment."
                            )
                        },
                        status=status.HTTP_409_CONFLICT,
                    )

                # Prevent a payment ID from being reused for another attempt.
                duplicate_payment = PaymentAttempt.objects.filter(
                    razorpay_payment_id=razorpay_payment_id,
                ).exclude(pk=attempt.pk).exists()

                if duplicate_payment:
                    return Response(
                        {"error": "This payment has already been used."},
                        status=status.HTTP_409_CONFLICT,
                    )

                order_items = list(
                    order.items
                    .select_related("variant")
                    .order_by("variant_id")
                )

                locked_variants = {}
                stock_available = True

                # Lock all variants before changing stock.
                for item in order_items:

                    variant = (
                        ProductVariant.objects
                        .select_for_update()
                        .get(pk=item.variant_id)
                    )

                    locked_variants[item.variant_id] = variant

                    if variant.stock < item.quantity:
                        stock_available = False

                # Save captured payment information.
                attempt.razorpay_payment_id = razorpay_payment_id
                attempt.razorpay_signature = razorpay_signature
                attempt.status = "captured"
                attempt.failure_reason = ""

                attempt.save(
                    update_fields=[
                        "razorpay_payment_id",
                        "razorpay_signature",
                        "status",
                        "failure_reason",
                        "updated_at",
                    ]
                )

                previous_status = order.status

                order.payment_status = "paid"

                if order.status == "pending":
                    order.status = "confirmed"

                order.save(
                    update_fields=[
                        "payment_status",
                        "status",
                        "updated_at",
                    ]
                )

                if previous_status != order.status:

                    create_order_history(
                        order,
                        "Payment successful. Order confirmed.",
                        request.user,
                    )

                # Deduct stock only when all variants have enough stock.
                if stock_available:

                    for item in order_items:

                        variant = locked_variants[item.variant_id]

                        variant.stock -= item.quantity

                        variant.save(
                            update_fields=[
                                "stock",
                                "updated_at",
                            ]
                        )

                # Clear cart only after payment is confirmed.
                CartItem.objects.filter(
                    cart__user=request.user
                ).delete()

                if not stock_available:

                    create_order_history(
                        order,
                        (
                            "Payment received successfully. "
                            "Stock requires manual attention."
                        ),
                        request.user,
                    )

                    return Response(
                        {
                            "message": (
                                "Payment received, but stock needs "
                                "manual attention. Contact support."
                            ),
                            "payment_status": "paid",
                            "stock_issue": True,
                            "order": OrderSerializer(order).data,
                        },
                        status=status.HTTP_200_OK,
                    )

                return Response(
                    {
                        "message": "Payment verified successfully.",
                        "payment_status": "paid",
                        "stock_issue": False,
                        "order": OrderSerializer(order).data,
                    },
                    status=status.HTTP_200_OK,
                )

        except Exception:

            return Response(
                {
                    "error": (
                        "Payment verification could not be completed. "
                        "Check your order status before retrying."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )


# ==========================================================
# 9. RAZORPAY PAYMENT FAILURE / DISMISS
# ==========================================================

class RazorpayPaymentFailureView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request):

        order_id = request.data.get("order_id")
        razorpay_order_id = request.data.get("razorpay_order_id")

        reason = str(
            request.data.get(
                "reason",
                "Payment was not completed.",
            )
        )[:500]

        order = get_object_or_404(
            Order,
            pk=order_id,
            user=request.user,
            payment_method="razorpay",
        )

        if order.payment_status == "paid":

            return Response(
                {
                    "message": "This order is already paid.",
                    "payment_status": "paid",
                },
                status=status.HTTP_200_OK,
            )

        attempts = PaymentAttempt.objects.filter(
            order=order
        )

        if razorpay_order_id:

            attempt = get_object_or_404(
                attempts,
                razorpay_order_id=razorpay_order_id,
            )

        else:

            attempt = attempts.order_by("-created_at").first()

            if not attempt:
                return Response(
                    {"error": "No payment attempt found."},
                    status=status.HTTP_404_NOT_FOUND,
                )

        # Do not mark failed only because the popup was dismissed.
        # Save the reason for troubleshooting.
        attempt.failure_reason = reason

        attempt.save(
            update_fields=[
                "failure_reason",
                "updated_at",
            ]
        )

        return Response(
            {
                "message": "Payment attempt information recorded.",
                "order_id": order.id,
                "payment_status": order.payment_status,
            },
            status=status.HTTP_200_OK,
        )


# ==========================================================
# 10. RETRY RAZORPAY PAYMENT
# ==========================================================

class RetryRazorpayPaymentView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):

        try:

            with transaction.atomic():

                order = get_object_or_404(
                    Order.objects.select_for_update(),
                    pk=pk,
                    user=request.user,
                    payment_method="razorpay",
                )

                if order.payment_status == "paid":

                    return Response(
                        {"error": "This order is already paid."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if order.status != "pending":

                    return Response(
                        {
                            "error": (
                                "Payment cannot be retried for this order."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                # Do not retry an order already refunded.
                if order.payment_status in [
                    "refunded",
                    "partially_refunded",
                ]:

                    return Response(
                        {"error": "Refunded orders cannot be retried."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            # Create a fresh Razorpay order for this retry.
            attempt = create_razorpay_payment(order)

            order.payment_status = "pending"

            order.save(
                update_fields=[
                    "payment_status",
                    "updated_at",
                ]
            )

            return Response(
                {
                    "message": "New payment attempt created.",
                    "payment": {
                        "key_id": settings.RAZORPAY_KEY_ID,
                        "razorpay_order_id": attempt.razorpay_order_id,
                        "amount": to_paise(order.total_amount),
                        "currency": "INR",
                        "payment_attempt_id": attempt.id,
                    },
                },
                status=status.HTTP_201_CREATED,
            )

        except Exception:

            return Response(
                {"error": "Could not start payment retry."},
                status=status.HTTP_502_BAD_GATEWAY,
            )


# ==========================================================
# 11. CUSTOMER - MY ORDERS
# ==========================================================

class MyOrdersView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):

        orders = (
            Order.objects
            .filter(user=request.user)
            .prefetch_related(
                "items",
                "payment_attempts",
                "return_requests",
                "status_history",
                "refunds",
            )
            .order_by("-created_at")
        )

        search_query = request.query_params.get(
            "q",
            "",
        ).strip()

        if search_query:

            orders = orders.filter(
                order_number__icontains=search_query
            )

        paginator = OrderPagination()

        page = paginator.paginate_queryset(
            orders,
            request,
            view=self,
        )

        serializer = OrderSerializer(
            page,
            many=True,
        )

        return paginator.get_paginated_response(
            serializer.data
        )


# ==========================================================
# 12. CUSTOMER - ORDER DETAILS
# ==========================================================

class OrderDetailView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):

        order = get_object_or_404(
            Order.objects.prefetch_related(
                "items",
                "payment_attempts",
                "return_requests",
                "status_history",
                "refunds",
            ),
            pk=pk,
            user=request.user,
        )

        return Response(
            OrderSerializer(order).data,
            status=status.HTTP_200_OK,
        )


# ==========================================================
# 13. RESTORE STOCK
# ==========================================================

def restore_order_stock(order):

    order_items = (
        order.items
        .select_related("variant")
        .order_by("variant_id")
    )

    for item in order_items:

        variant = (
            ProductVariant.objects
            .select_for_update()
            .get(pk=item.variant_id)
        )

        variant.stock += item.quantity

        variant.save(
            update_fields=[
                "stock",
                "updated_at",
            ]
        )


# ==========================================================
# 14. CUSTOMER - CANCEL ORDER
# ==========================================================

class CancelOrderView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):

        reason = str(
            request.data.get("reason", "")
        ).strip()

        with transaction.atomic():

            order = get_object_or_404(
                Order.objects.select_for_update(),
                pk=pk,
                user=request.user,
            )

            if order.status not in ["pending", "confirmed"]:

                return Response(
                    {
                        "error": (
                            "This order can no longer be cancelled."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if (
                order.payment_method == "razorpay"
                and order.payment_status == "paid"
            ):

                return Response(
                    {
                        "error": (
                            "Paid Razorpay orders require refund handling. "
                            "Please contact support."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # COD stock was deducted during checkout.
            if order.payment_method == "cod":

                restore_order_stock(order)

            order.status = "cancelled"
            order.cancellation_reason = reason or None
            order.cancelled_at = timezone.now()

            order.save(
                update_fields=[
                    "status",
                    "cancellation_reason",
                    "cancelled_at",
                    "updated_at",
                ]
            )

            create_order_history(
                order,
                "Order cancelled by customer.",
                request.user,
            )

            return Response(
                {
                    "message": "Order cancelled successfully.",
                    "order_number": order.order_number,
                    "status": order.status,
                },
                status=status.HTTP_200_OK,
            )


# ==========================================================
# 15. CUSTOMER - RETURN REQUEST
# ==========================================================

class CreateReturnRequestView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):

        with transaction.atomic():

            order = get_object_or_404(
                Order.objects.select_for_update(),
                pk=pk,
                user=request.user,
            )

            if order.status != "delivered":

                return Response(
                    {
                        "error": (
                            "Only delivered orders can be returned."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if ReturnRequest.objects.filter(order=order).exists():

                return Response(
                    {
                        "error": (
                            "A return request already exists for this order."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            serializer = ReturnRequestSerializer(
                data=request.data
            )

            serializer.is_valid(raise_exception=True)

            try:

                with transaction.atomic():

                    return_request = serializer.save(
                        order=order,
                        user=request.user,
                    )

            except IntegrityError:

                return Response(
                    {"error": "Return request already exists."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            return Response(
                {
                    "message": "Return request submitted successfully.",
                    "return_request": ReturnRequestSerializer(
                        return_request
                    ).data,
                },
                status=status.HTTP_201_CREATED,
            )


# ==========================================================
# 16. ADMIN - VIEW ALL ORDERS
# ==========================================================

class AdminOrderListView(APIView):

    permission_classes = [IsActiveAdmin]

    def get(self, request):

        orders = (
            Order.objects
            .select_related("user")
            .prefetch_related(
                "items",
                "payment_attempts",
                "return_requests",
                "status_history",
                "refunds",
            )
            .order_by("-created_at")
        )

        search_query = request.query_params.get(
            "q",
            "",
        ).strip()

        if search_query:

            orders = orders.filter(
                Q(order_number__icontains=search_query)
                | Q(user__email__icontains=search_query)
                | Q(full_name__icontains=search_query)
            )

        paginator = OrderPagination()

        page = paginator.paginate_queryset(
            orders,
            request,
            view=self,
        )

        serializer = OrderSerializer(
            page,
            many=True,
        )

        return paginator.get_paginated_response(
            serializer.data
        )


# ==========================================================
# 17. ADMIN - UPDATE ORDER STATUS
# ==========================================================

class AdminUpdateOrderStatusView(APIView):

    permission_classes = [IsActiveAdmin]

    ALLOWED_TRANSITIONS = {

        "pending": [
            "confirmed",
            "cancelled",
        ],

        "confirmed": [
            "processing",
            "shipped",
            "cancelled",
        ],

        "processing": [
            "shipped",
            "cancelled",
        ],

        "shipped": [
            "out_for_delivery",
        ],

        "out_for_delivery": [
            "delivered",
        ],

        "delivered": [],

        "cancelled": [],
    }

    def patch(self, request, pk):

        new_status = request.data.get("status")

        valid_statuses = [
            choice[0]
            for choice in Order.STATUS_CHOICES
        ]

        if new_status not in valid_statuses:

            return Response(
                {"error": "Invalid order status."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():

            order = get_object_or_404(
                Order.objects.select_for_update(),
                pk=pk,
            )

            current_status = order.status

            allowed = self.ALLOWED_TRANSITIONS.get(
                current_status,
                [],
            )

            if new_status not in allowed:

                return Response(
                    {
                        "error": (
                            f"Cannot change order from "
                            f"{current_status} to {new_status}."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if new_status == "cancelled":

                if (
                    order.payment_method == "razorpay"
                    and order.payment_status == "paid"
                ):

                    return Response(
                        {
                            "error": (
                                "Paid Razorpay orders require refund "
                                "before cancellation."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if order.payment_method == "cod":

                    restore_order_stock(order)

                order.cancellation_reason = (
                    str(request.data.get("reason", "")).strip()
                    or None
                )

                order.cancelled_at = timezone.now()

            if (
                new_status == "delivered"
                and order.payment_method == "cod"
            ):

                order.payment_status = "paid"

            order.status = new_status

            order.save(
                update_fields=[
                    "status",
                    "payment_status",
                    "cancellation_reason",
                    "cancelled_at",
                    "updated_at",
                ]
            )

            create_order_history(
                order,
                (
                    f"Order status changed from "
                    f"{current_status} to {new_status}."
                ),
                request.user,
            )

            return Response(
                {
                    "message": "Order status updated successfully.",
                    "order_number": order.order_number,
                    "old_status": current_status,
                    "status": order.status,
                    "payment_status": order.payment_status,
                },
                status=status.HTTP_200_OK,
            )


# ==========================================================
# 18. CUSTOMER - DOWNLOAD PDF INVOICE
# ==========================================================

class OrderInvoiceView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):

        order = get_object_or_404(
            Order.objects.prefetch_related("items"),
            pk=pk,
            user=request.user,
        )

        if order.payment_status != "paid":

            return Response(
                {
                    "error": (
                        "Invoice is available only after payment."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        buffer = BytesIO()

        pdf = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=40,
            leftMargin=40,
            topMargin=40,
            bottomMargin=40,
        )

        styles = getSampleStyleSheet()
        elements = []

        elements.append(
            Paragraph(
                '<font color="#064E3B"><b>STYLO</b></font>',
                styles["Title"],
            )
        )

        elements.append(
            Paragraph(
                "ORDER INVOICE",
                styles["Heading2"],
            )
        )

        elements.append(Spacer(1, 20))

        elements.append(
            Paragraph(
                (
                    f"<b>Order Number:</b> "
                    f"{escape(str(order.order_number))}"
                ),
                styles["Normal"],
            )
        )

        elements.append(
            Paragraph(
                (
                    f"<b>Order Date:</b> "
                    f"{order.created_at.strftime('%d-%m-%Y')}"
                ),
                styles["Normal"],
            )
        )

        elements.append(Spacer(1, 15))

        elements.append(
            Paragraph(
                "<b>Shipping Address</b>",
                styles["Heading3"],
            )
        )

        address_lines = [
            escape(str(order.full_name)),
            escape(str(order.phone_number)),
            escape(str(order.address)),
            (
                f"{escape(str(order.city))}, "
                f"{escape(str(order.state))} - "
                f"{escape(str(order.pincode))}"
            ),
        ]

        elements.append(
            Paragraph(
                "<br/>".join(address_lines),
                styles["Normal"],
            )
        )

        elements.append(Spacer(1, 20))

        data = [
            ["Product", "Size", "Color", "Qty", "Price", "Total"]
        ]

        for item in order.items.all():

            data.append([
                escape(str(item.product_name)),
                escape(str(item.size or "-")),
                escape(str(item.color or "-")),
                str(item.quantity),
                f"Rs. {item.price}",
                f"Rs. {item.total_price}",
            ])

        table = Table(
            data,
            repeatRows=1,
            colWidths=[150, 45, 55, 35, 75, 75],
        )

        table.setStyle(TableStyle([

            (
                "BACKGROUND",
                (0, 0),
                (-1, 0),
                colors.HexColor("#064E3B"),
            ),

            (
                "TEXTCOLOR",
                (0, 0),
                (-1, 0),
                colors.white,
            ),

            (
                "GRID",
                (0, 0),
                (-1, -1),
                0.5,
                colors.grey,
            ),

            (
                "ALIGN",
                (3, 1),
                (-1, -1),
                "CENTER",
            ),

            (
                "PADDING",
                (0, 0),
                (-1, -1),
                8,
            ),

            (
                "VALIGN",
                (0, 0),
                (-1, -1),
                "MIDDLE",
            ),
        ]))

        elements.append(table)
        elements.append(Spacer(1, 20))

        summary = [
            ["Subtotal", f"Rs. {order.subtotal}"],
            ["Shipping", f"Rs. {order.shipping_charge}"],
            ["Tax", f"Rs. {order.tax_amount}"],
            ["Grand Total", f"Rs. {order.total_amount}"],
            ["Payment Method", order.get_payment_method_display()],
            ["Payment Status", order.get_payment_status_display()],
        ]

        summary_table = Table(
            summary,
            colWidths=[350, 150],
        )

        summary_table.setStyle(TableStyle([

            (
                "GRID",
                (0, 0),
                (-1, -1),
                0.5,
                colors.grey,
            ),

            (
                "PADDING",
                (0, 0),
                (-1, -1),
                8,
            ),

            (
                "FONTNAME",
                (0, 3),
                (-1, 3),
                "Helvetica-Bold",
            ),

            (
                "BACKGROUND",
                (0, 3),
                (-1, 3),
                colors.HexColor("#E8F1EC"),
            ),

            (
                "TEXTCOLOR",
                (0, 3),
                (-1, 3),
                colors.HexColor("#064E3B"),
            ),
        ]))

        elements.append(summary_table)
        elements.append(Spacer(1, 25))

        elements.append(
            Paragraph(
                "Thank you for shopping with STYLO!",
                styles["Normal"],
            )
        )

        pdf.build(elements)

        buffer.seek(0)

        response = HttpResponse(
            buffer.getvalue(),
            content_type="application/pdf",
        )

        response["Content-Disposition"] = (
            f'attachment; filename="STYLO_Invoice_{order.order_number}.pdf"'
        )

        return response


# ==========================================================
# 19. CUSTOMER - ORDER TRACKING
# ==========================================================

class OrderTrackingView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):

        order = get_object_or_404(
            Order,
            pk=pk,
            user=request.user,
        )

        history = (
            OrderStatusHistory.objects
            .filter(order=order)
            .select_related("changed_by")
            .order_by("created_at")
        )

        serializer = OrderStatusHistorySerializer(
            history,
            many=True,
        )

        return Response(
            {
                "order_id": order.id,
                "order_number": order.order_number,
                "current_status": order.status,
                "tracking_history": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


# ==========================================================
# 20. ADMIN - VIEW ALL RETURN REQUESTS
# ==========================================================

class AdminReturnListView(APIView):

    permission_classes = [IsActiveAdmin]

    def get(self, request):

        return_requests = (
            ReturnRequest.objects
            .select_related(
                "order",
                "user",
                "reviewed_by",
            )
            .order_by("-requested_at")
        )

        return_status = request.query_params.get("status")

        valid_statuses = [
            choice[0]
            for choice in ReturnRequest.STATUS_CHOICES
        ]

        if return_status:

            if return_status not in valid_statuses:

                return Response(
                    {"error": "Invalid return status."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            return_requests = return_requests.filter(
                status=return_status
            )

        paginator = OrderPagination()

        page = paginator.paginate_queryset(
            return_requests,
            request,
            view=self,
        )

        serializer = ReturnRequestSerializer(
            page,
            many=True,
        )

        return paginator.get_paginated_response(
            serializer.data
        )


# ==========================================================
# 21. ADMIN - APPROVE / REJECT RETURN REQUEST
# ==========================================================

class AdminUpdateReturnView(APIView):

    permission_classes = [IsActiveAdmin]

    def patch(self, request, pk):

        new_status = request.data.get("status")

        admin_note = str(
            request.data.get("admin_note", "")
        ).strip()

        if new_status not in ["approved", "rejected"]:

            return Response(
                {
                    "error": (
                        "Status must be either approved or rejected."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_status == "rejected" and not admin_note:

            return Response(
                {
                    "error": (
                        "Admin note is required when rejecting a return."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():

            return_request = get_object_or_404(
                ReturnRequest.objects.select_for_update(),
                pk=pk,
            )

            if return_request.status != "requested":

                return Response(
                    {
                        "error": (
                            "This return request has already been reviewed."
                        ),
                        "current_status": return_request.status,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            return_request.status = new_status
            return_request.admin_note = admin_note
            return_request.reviewed_by = request.user
            return_request.reviewed_at = timezone.now()

            return_request.save(
                update_fields=[
                    "status",
                    "admin_note",
                    "reviewed_by",
                    "reviewed_at",
                    "updated_at",
                ]
            )

            serializer = ReturnRequestSerializer(
                return_request
            )

            return Response(
                {
                    "message": (
                        "Return request approved successfully."
                        if new_status == "approved"
                        else "Return request rejected successfully."
                    ),
                    "return_request": serializer.data,
                },
                status=status.HTTP_200_OK,
            )


# ==========================================================
# 22. ADMIN - CREATE RAZORPAY REFUND
# ==========================================================

class AdminCreateRefundView(APIView):

    permission_classes = [IsActiveAdmin]

    def post(self, request, pk):

        amount_value = request.data.get("amount")
        reason = str(
            request.data.get("reason", "")
        ).strip()

        if amount_value is None:

            return Response(
                {"error": "Refund amount is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:

            amount = Decimal(
                str(amount_value)
            ).quantize(
                Decimal("0.01"),
                rounding=ROUND_HALF_UP,
            )

        except (InvalidOperation, ValueError):

            return Response(
                {"error": "Enter a valid refund amount."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not amount.is_finite() or amount <= Decimal("0.00"):

            return Response(
                {
                    "error": (
                        "Refund amount must be greater than zero."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:

            with transaction.atomic():

                order = (
                    Order.objects
                    .select_for_update()
                    .get(pk=pk)
                )

                if order.payment_method != "razorpay":

                    return Response(
                        {
                            "error": (
                                "Razorpay refund is only available "
                                "for online payments."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if order.payment_status not in [
                    "paid",
                    "partially_refunded",
                ]:

                    return Response(
                        {
                            "error": (
                                "This order is not eligible for a refund."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                payment_attempt = (
                    PaymentAttempt.objects
                    .select_for_update()
                    .filter(
                        order=order,
                        status="captured",
                    )
                    .exclude(razorpay_payment_id__isnull=True)
                    .exclude(razorpay_payment_id="")
                    .order_by("-created_at")
                    .first()
                )

                if not payment_attempt:

                    return Response(
                        {
                            "error": (
                                "No captured Razorpay payment was found."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                existing_refunds = Refund.objects.filter(
                    order=order,
                    status__in=["pending", "processed"],
                )

                already_reserved = sum(
                    (
                        item.amount
                        for item in existing_refunds
                    ),
                    Decimal("0.00"),
                )

                remaining_amount = (
                    order.total_amount - already_reserved
                )

                if amount > remaining_amount:

                    return Response(
                        {
                            "error": (
                                "Refund amount exceeds the remaining "
                                "refundable amount."
                            ),
                            "remaining_amount": str(
                                max(
                                    remaining_amount,
                                    Decimal("0.00"),
                                )
                            ),
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                refund = Refund.objects.create(
                    order=order,
                    payment_attempt=payment_attempt,
                    initiated_by=request.user,
                    amount=amount,
                    reason=reason,
                    status="pending",
                )

                payment_id = payment_attempt.razorpay_payment_id

        except Order.DoesNotExist:

            return Response(
                {"error": "Order not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:

            client = get_razorpay_client()

            razorpay_response = client.payment.refund(
                payment_id,
                {
                    "amount": to_paise(amount),
                    "speed": "normal",
                    "receipt": f"stylo_refund_{refund.id}",
                    "notes": {
                        "order_number": str(order.order_number),
                        "reason": reason[:200],
                    },
                },
            )

            razorpay_status = razorpay_response.get(
                "status",
                "pending",
            )

            if razorpay_status not in [
                "pending",
                "processed",
                "failed",
            ]:

                razorpay_status = "pending"

            refund.razorpay_refund_id = razorpay_response.get("id")
            refund.status = razorpay_status
            refund.failure_reason = ""

            refund.save(
                update_fields=[
                    "razorpay_refund_id",
                    "status",
                    "failure_reason",
                    "updated_at",
                ]
            )

            if refund.status == "processed":

                processed_total = sum(
                    (
                        item.amount
                        for item in Refund.objects.filter(
                            order=order,
                            status="processed",
                        )
                    ),
                    Decimal("0.00"),
                )

                order.payment_status = (
                    "refunded"
                    if processed_total >= order.total_amount
                    else "partially_refunded"
                )

                order.save(
                    update_fields=[
                        "payment_status",
                        "updated_at",
                    ]
                )

            return Response(
                {
                    "message": "Refund request submitted to Razorpay.",
                    "refund": RefundSerializer(refund).data,
                },
                status=status.HTTP_200_OK,
            )

        except Exception as error:

            # Do not automatically retry an uncertain refund request.
            # It may already have reached Razorpay.
            refund.failure_reason = (
                "Razorpay response could not be confirmed. "
                "Check Razorpay Dashboard before taking further action. "
                f"Details: {str(error)[:300]}"
            )

            refund.save(
                update_fields=[
                    "failure_reason",
                    "updated_at",
                ]
            )

            return Response(
                {
                    "error": "Refund status could not be confirmed.",
                    "message": (
                        "The refund is kept pending. "
                        "Check Razorpay Dashboard before retrying."
                    ),
                    "refund": RefundSerializer(refund).data,
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )
