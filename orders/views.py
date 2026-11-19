
import uuid
from decimal import Decimal

from django.db import transaction
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, BasePermission
from rest_framework.exceptions import ValidationError

from cart.models import Cart, CartItem
from products.models import ProductVariant

from .models import Order, OrderItem
from .serializers import OrderSerializer


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
# 2. COMMON PRODUCT VALIDATION
# ==========================================================

def validate_order_variant(variant, quantity):

    product = variant.product
    category = product.category

    # Product validation
    if (
        product.is_deleted
        or not product.is_active
        or not product.is_published
        or product.publication_status != "published"
    ):
        raise ValidationError(
            f"{product.name} is currently unavailable."
        )

    # Category validation
    if (
        category.is_deleted
        or not category.is_active
    ):
        raise ValidationError(
            f"Category for {product.name} is unavailable."
        )

    # Variant validation
    if not variant.is_active:
        raise ValidationError(
            f"Selected variant of {product.name} is unavailable."
        )

    # Color validation
    if (
        not variant.color.is_active
        or variant.color.is_deleted
    ):
        raise ValidationError(
            f"Selected color of {product.name} is unavailable."
        )

    # Size validation
    if (
        not variant.size.is_active
        or variant.size.is_deleted
    ):
        raise ValidationError(
            f"Selected size of {product.name} is unavailable."
        )

    # Quantity validation
    if quantity < 1:
        raise ValidationError(
            "Quantity must be at least 1."
        )

    # Stock validation
    if variant.stock < quantity:
        raise ValidationError(
            f"Only {variant.stock} items are available "
            f"for {product.name}."
        )

    # Price validation
    price = variant.current_price

    if price is None or price <= Decimal("0.00"):
        raise ValidationError(
            f"Invalid price for {product.name}."
        )

    return price


# ==========================================================
# 3. CUSTOMER CHECKOUT / CREATE ORDER
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

        # Validate shipping details
        shipping_data = {}

        for field in required_fields:

            value = request.data.get(field)

            if not isinstance(value, str) or not value.strip():

                return Response(
                    {
                        "error": f"{field} is required."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            shipping_data[field] = value.strip()

        try:

            with transaction.atomic():

                # Lock customer's cart
                cart = (
                    Cart.objects
                    .select_for_update()
                    .filter(user=request.user)
                    .first()
                )

                if not cart:

                    return Response(
                        {"error": "Your cart is empty."},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Lock cart items
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
                        status=status.HTTP_400_BAD_REQUEST
                    )

                subtotal = Decimal("0.00")

                order_items_data = []

                # Validate every product and variant
                for cart_item in cart_items:

                    # Lock latest variant database row
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

                    # Authoritative backend price
                    price = validate_order_variant(
                        variant,
                        quantity
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

                # Calculate shipping
                shipping_charge = Decimal("0.00")

                total_amount = subtotal + shipping_charge

                # Create order
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
                    total_amount=total_amount,
                )

                # Create order items and reduce stock
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

                    variant.stock -= item["quantity"]

                    variant.save(
                        update_fields=[
                            "stock",
                            "updated_at"
                        ]
                    )

                # Clear cart only after successful order creation
                CartItem.objects.filter(
                    cart=cart
                ).delete()

                # Return created order
                serializer = OrderSerializer(order)

                return Response(
                    {
                        "message": "Order placed successfully.",
                        "order": serializer.data,
                    },
                    status=status.HTTP_201_CREATED
                )

        except ProductVariant.DoesNotExist:

            return Response(
                {
                    "error": "A product variant in your cart no longer exists."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        except ValidationError as exc:

            return Response(
                {
                    "error": exc.detail
                },
                status=status.HTTP_400_BAD_REQUEST
            )


# ==========================================================
# 4. CUSTOMER - MY ORDERS
# ==========================================================

class MyOrdersView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):

        orders = (
            Order.objects
            .filter(user=request.user)
            .prefetch_related("items")
            .order_by("-created_at")
        )

        serializer = OrderSerializer(
            orders,
            many=True
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK
        )


# ==========================================================
# 5. CUSTOMER - ORDER DETAILS
# ==========================================================

class OrderDetailView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):

        order = get_object_or_404(
            Order.objects.prefetch_related("items"),
            pk=pk,
            user=request.user
        )

        serializer = OrderSerializer(order)

        return Response(
            serializer.data,
            status=status.HTTP_200_OK
        )


# ==========================================================
# 6. RESTORE STOCK WHEN ORDER IS CANCELLED
# ==========================================================

def restore_order_stock(order):

    order_items = list(
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
                "updated_at"
            ]
        )


# ==========================================================
# 7. CUSTOMER - CANCEL ORDER
# ==========================================================

class CancelOrderView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):

        with transaction.atomic():

            order = get_object_or_404(
                Order.objects.select_for_update(),
                pk=pk,
                user=request.user
            )

            if order.status != "pending":

                return Response(
                    {
                        "error": (
                            "Only pending orders can be cancelled."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Restore stock
            restore_order_stock(order)

            order.status = "cancelled"

            order.save(
                update_fields=[
                    "status",
                    "updated_at"
                ]
            )

            return Response(
                {
                    "message": "Order cancelled successfully.",
                    "order_number": order.order_number,
                    "status": order.status,
                },
                status=status.HTTP_200_OK
            )


# ==========================================================
# 8. ADMIN - VIEW ALL ORDERS
# ==========================================================

class AdminOrderListView(APIView):

    permission_classes = [IsActiveAdmin]

    def get(self, request):

        orders = (
            Order.objects
            .select_related("user")
            .prefetch_related("items")
            .order_by("-created_at")
        )

        serializer = OrderSerializer(
            orders,
            many=True
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK
        )


# ==========================================================
# 9. ADMIN - UPDATE ORDER STATUS
# ==========================================================


# ==========================================================
# 9. ADMIN - UPDATE ORDER STATUS
# ==========================================================

class AdminUpdateOrderStatusView(APIView):

    permission_classes = [IsActiveAdmin]

    ALLOWED_TRANSITIONS = {
        "pending": ["confirmed", "cancelled"],
        "confirmed": ["processing", "cancelled"],
        "processing": ["shipped", "cancelled"],
        "shipped": ["delivered"],
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
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():

            order = get_object_or_404(
                Order.objects.select_for_update(),
                pk=pk
            )

            current_status = order.status

            # Check permitted status transition
            allowed = self.ALLOWED_TRANSITIONS.get(
                current_status, []
            )

            if new_status not in allowed:
                return Response(
                    {
                        "error": (
                            f"Cannot change order from "
                            f"{current_status} to {new_status}."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Restore stock only when cancelling
            if new_status == "cancelled":
                restore_order_stock(order)

            order.status = new_status

            order.save(
                update_fields=["status", "updated_at"]
            )

            return Response(
                {
                    "message": "Order status updated successfully.",
                    "order_number": order.order_number,
                    "old_status": current_status,
                    "status": order.status,
                },
                status=status.HTTP_200_OK
            )
