
from django.db import transaction
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError

from .models import Cart, CartItem
from .serializers import CartSerializer, CartItemSerializer


def get_user_cart(user):
    cart, created = Cart.objects.get_or_create(user=user)
    return cart


class CartView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cart = get_user_cart(request.user)

        serializer = CartSerializer(cart)

        return Response(
            serializer.data,
            status=status.HTTP_200_OK
        )


class CartItemListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        cart = get_user_cart(request.user)

        serializer = CartItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        variant = serializer.validated_data["variant"]
        quantity = serializer.validated_data.get("quantity", 1)

        if quantity > variant.stock:
            raise ValidationError({
                "quantity": f"Only {variant.stock} items are available."
            })

        with transaction.atomic():
            cart_item = CartItem.objects.select_for_update().filter(
                cart=cart,
                variant=variant
            ).first()

            if cart_item:
                new_quantity = cart_item.quantity + quantity

                if new_quantity > variant.stock:
                    raise ValidationError({
                        "quantity": (
                            f"Only {variant.stock} items are available. "
                            f"You already have {cart_item.quantity} in your cart."
                        )
                    })

                cart_item.quantity = new_quantity
                cart_item.save(update_fields=["quantity", "updated_at"])

            else:
                cart_item = serializer.save(cart=cart)

        response_serializer = CartItemSerializer(cart_item)

        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED
        )


class CartItemDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, request, pk):
        cart = get_user_cart(request.user)

        return get_object_or_404(
            CartItem.objects.select_related(
                "variant",
                "variant__product"
            ),
            pk=pk,
            cart=cart
        )

    def patch(self, request, pk):
        cart_item = self.get_object(request, pk)

        quantity = request.data.get("quantity")

        if quantity is None:
            raise ValidationError({
                "quantity": "Quantity is required."
            })

        try:
            quantity = int(quantity)
        except (TypeError, ValueError):
            raise ValidationError({
                "quantity": "Enter a valid integer."
            })

        if quantity < 1:
            raise ValidationError({
                "quantity": "Quantity must be at least 1."
            })

        if quantity > cart_item.variant.stock:
            raise ValidationError({
                "quantity": (
                    f"Only {cart_item.variant.stock} items are available."
                )
            })

        cart_item.quantity = quantity
        cart_item.save(update_fields=["quantity", "updated_at"])

        serializer = CartItemSerializer(cart_item)

        return Response(
            serializer.data,
            status=status.HTTP_200_OK
        )

    def delete(self, request, pk):
        cart_item = self.get_object(request, pk)
        cart_item.delete()

        return Response(
            {"message": "Cart item removed successfully."},
            status=status.HTTP_200_OK
        )
