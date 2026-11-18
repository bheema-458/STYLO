
import uuid

from django.db import transaction
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, BasePermission

from cart.models import Cart, CartItem
from products.models import ProductVariant

from .models import Order, OrderItem
from .serializers import OrderSerializer


# Admin permission
class IsActiveAdmin(BasePermission):

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.is_active
            and request.user.is_staff
        )


# 1. Customer Checkout / Create Order
class CreateOrderView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request):

        required_fields = [
            'full_name',
            'phone_number',
            'address',
            'city',
            'state',
            'pincode',
        ]

        for field in required_fields:
            if not request.data.get(field):
                return Response(
                    {'error': f'{field} is required.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        try:
            with transaction.atomic():

                cart = Cart.objects.filter(
                    user=request.user
                ).first()

                if not cart:
                    return Response(
                        {'error': 'Cart is empty.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                cart_items = list(
                    CartItem.objects.filter(
                        cart=cart
                    ).select_related(
                        'variant__product',
                        'variant__color'
                    )
                )

                if not cart_items:
                    return Response(
                        {'error': 'Your cart is empty.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                subtotal = 0
                order_items_data = []

                # Validate stock and prices
                for cart_item in cart_items:

                    variant = ProductVariant.objects.select_for_update().get(
                        pk=cart_item.variant_id
                    )

                    if not variant.is_active:
                        return Response(
                            {'error': 'A product variant is unavailable.'},
                            status=status.HTTP_400_BAD_REQUEST
                        )

                    if variant.stock < cart_item.quantity:
                        return Response(
                            {
                                'error': (
                                    f'Insufficient stock for '
                                    f'{variant.product.name}.'
                                )
                            },
                            status=status.HTTP_400_BAD_REQUEST
                        )

                    price = variant.current_price
                    item_total = price * cart_item.quantity

                    subtotal += item_total

                    order_items_data.append({
                        'variant': variant,
                        'quantity': cart_item.quantity,
                        'price': price,
                        'total_price': item_total,
                    })

                # Shipping charge
                shipping_charge = 0
                total_amount = subtotal + shipping_charge

                # Create Order
                order = Order.objects.create(
                    user=request.user,
                    order_number=f"STYLO-{uuid.uuid4().hex[:12].upper()}",
                    full_name=request.data['full_name'],
                    phone_number=request.data['phone_number'],
                    address=request.data['address'],
                    city=request.data['city'],
                    state=request.data['state'],
                    pincode=request.data['pincode'],
                    subtotal=subtotal,
                    shipping_charge=shipping_charge,
                    total_amount=total_amount,
                )

                # Create Order Items and reduce stock
                for item in order_items_data:

                    variant = item['variant']

                    OrderItem.objects.create(
                        order=order,
                        product=variant.product,
                        variant=variant,
                        product_name=variant.product.name,
                        size=variant.size,
                        color=str(variant.color),
                        quantity=item['quantity'],
                        price=item['price'],
                        total_price=item['total_price'],
                    )

                    variant.stock -= item['quantity']
                    variant.save(update_fields=['stock'])

                # Clear cart after successful order
                CartItem.objects.filter(cart=cart).delete()

                serializer = OrderSerializer(order)

                return Response(
                    {
                        'message': 'Order placed successfully.',
                        'order': serializer.data,
                    },
                    status=status.HTTP_201_CREATED
                )

        except ProductVariant.DoesNotExist:
            return Response(
                {'error': 'Product variant no longer exists.'},
                status=status.HTTP_400_BAD_REQUEST
            )


# 2. Customer - My Orders
class MyOrdersView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):

        orders = Order.objects.filter(
            user=request.user
        ).prefetch_related('items')

        serializer = OrderSerializer(orders, many=True)

        return Response(serializer.data)


# 3. Customer - Order Details
class OrderDetailView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):

        order = get_object_or_404(
            Order.objects.prefetch_related('items'),
            pk=pk,
            user=request.user
        )

        serializer = OrderSerializer(order)

        return Response(serializer.data)


# 4. Customer - Cancel Order
class CancelOrderView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):

        with transaction.atomic():

            order = get_object_or_404(
                Order.objects.select_for_update(),
                pk=pk,
                user=request.user
            )

            if order.status != 'pending':
                return Response(
                    {
                        'error': 'Only pending orders can be cancelled.'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            order_items = list(
                order.items.select_related('variant')
            )

            for item in order_items:

                variant = ProductVariant.objects.select_for_update().get(
                    pk=item.variant_id
                )

                variant.stock += item.quantity
                variant.save(update_fields=['stock'])

            order.status = 'cancelled'
            order.save(update_fields=['status', 'updated_at'])

            return Response({
                'message': 'Order cancelled successfully.',
                'order_number': order.order_number,
                'status': order.status,
            })


# 5. Admin - View All Orders
class AdminOrderListView(APIView):

    permission_classes = [IsActiveAdmin]

    def get(self, request):

        orders = Order.objects.all().select_related(
            'user'
        ).prefetch_related('items')

        serializer = OrderSerializer(orders, many=True)

        return Response(serializer.data)


# 6. Admin - Update Order Status
class AdminUpdateOrderStatusView(APIView):

    permission_classes = [IsActiveAdmin]

    def patch(self, request, pk):

        order = get_object_or_404(Order, pk=pk)

        new_status = request.data.get('status')

        valid_statuses = [
            choice[0] for choice in Order.STATUS_CHOICES
        ]

        if new_status not in valid_statuses:
            return Response(
                {'error': 'Invalid order status.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if order.status in ['cancelled', 'delivered']:
            return Response(
                {'error': 'This order status cannot be changed.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        order.status = new_status
        order.save(update_fields=['status', 'updated_at'])

        return Response({
            'message': 'Order status updated successfully.',
            'order_number': order.order_number,
            'status': order.status,
        })
