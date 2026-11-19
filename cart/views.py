
from django.db import transaction
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError

from .models import Cart, CartItem
from .serializers import CartSerializer, CartItemSerializer

from products.models import ProductVariant
from wishlist.models import WishlistItem


# ==========================================================
# 1. GET OR CREATE CUSTOMER CART
# ==========================================================

def get_user_cart(user):
    cart, created = Cart.objects.get_or_create(
        user=user
    )
    return cart


# ==========================================================
# 2. COMMON VARIANT VALIDATION
# ==========================================================

def validate_cart_variant(variant, quantity=1):

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
            "This product is currently unavailable."
        )

    # Category validation
    if (
        category.is_deleted
        or not category.is_active
    ):
        raise ValidationError(
            "This product category is unavailable."
        )

    # Variant validation
    if not variant.is_active:
        raise ValidationError(
            "This product variant is unavailable."
        )

    # Color validation
    if (
        not variant.color.is_active
        or variant.color.is_deleted
    ):
        raise ValidationError(
            "This product color is unavailable."
        )

    # Size validation
    if (
        not variant.size.is_active
        or variant.size.is_deleted
    ):
        raise ValidationError(
            "This product size is unavailable."
        )

    # Quantity validation
    if quantity < 1:
        raise ValidationError(
            "Quantity must be at least 1."
        )

    # Stock validation
    if variant.stock < quantity:
        raise ValidationError(
            f"Only {variant.stock} items are available."
        )

    # Price validation
    if (
        variant.current_price is None
        or variant.current_price <= 0
    ):
        raise ValidationError(
            "Product price is unavailable."
        )

    return variant


# ==========================================================
# 3. CUSTOMER CART DETAILS
# ==========================================================

class CartView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):

        cart = get_user_cart(request.user)

        serializer = CartSerializer(cart)

        return Response(
            serializer.data,
            status=status.HTTP_200_OK
        )


# ==========================================================
# 4. ADD ITEM TO CART
# ==========================================================

class CartItemListCreateView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request):

        serializer = CartItemSerializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        variant_id = serializer.validated_data[
            "variant"
        ].pk

        quantity = serializer.validated_data.get(
            "quantity", 1
        )

        try:

            with transaction.atomic():

                # Get and lock customer cart
                cart = get_user_cart(request.user)

                cart = Cart.objects.select_for_update().get(
                    pk=cart.pk,
                    user=request.user
                )

                # Lock and fetch latest variant data
                variant = (
                    ProductVariant.objects
                    .select_for_update()
                    .select_related(
                        "product",
                        "product__category",
                        "color",
                        "size"
                    )
                    .get(pk=variant_id)
                )

                validate_cart_variant(
                    variant,
                    quantity
                )

                # Check existing cart item
                cart_item = (
                    CartItem.objects
                    .select_for_update()
                    .filter(
                        cart=cart,
                        variant=variant
                    )
                    .first()
                )

                if cart_item:

                    # Increase existing quantity
                    new_quantity = (
                        cart_item.quantity + quantity
                    )

                    validate_cart_variant(
                        variant,
                        new_quantity
                    )

                    cart_item.quantity = new_quantity

                    cart_item.save(
                        update_fields=[
                            "quantity",
                            "updated_at"
                        ]
                    )

                else:

                    # Create new cart item
                    cart_item = CartItem.objects.create(
                        cart=cart,
                        variant=variant,
                        quantity=quantity
                    )

                # Remove product from wishlist
                # This happens in the same transaction.
                WishlistItem.objects.filter(
                    wishlist__user=request.user,
                    product_id=variant.product_id
                ).delete()

                response_serializer = CartItemSerializer(
                    cart_item
                )

                return Response(
                    {
                        "message": "Product added to cart successfully.",
                        "item": response_serializer.data
                    },
                    status=status.HTTP_201_CREATED
                )

        except ProductVariant.DoesNotExist:

            return Response(
                {
                    "error": "Product variant does not exist."
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
# 5. CART ITEM UPDATE AND DELETE
# ==========================================================

class CartItemDetailView(APIView):

    permission_classes = [IsAuthenticated]

    def get_object(self, request, pk):

        return get_object_or_404(
            CartItem.objects.select_related(
                "cart",
                "variant"
            ),
            pk=pk,
            cart__user=request.user
        )

    # ------------------------------------------------------
    # UPDATE QUANTITY
    # ------------------------------------------------------

    def patch(self, request, pk):

        quantity = request.data.get("quantity")

        if isinstance(quantity, bool):

            return Response(
                {
                    "error": "Enter a valid quantity."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        try:

            quantity = int(quantity)

        except (TypeError, ValueError):

            return Response(
                {
                    "error": "Enter a valid integer quantity."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if quantity < 1:

            return Response(
                {
                    "error": "Quantity must be at least 1."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        try:

            with transaction.atomic():

                cart_item = get_object_or_404(
                    CartItem.objects.select_for_update(),
                    pk=pk,
                    cart__user=request.user
                )

                variant = (
                    ProductVariant.objects
                    .select_for_update()
                    .select_related(
                        "product",
                        "product__category",
                        "color",
                        "size"
                    )
                    .get(pk=cart_item.variant_id)
                )

                validate_cart_variant(
                    variant,
                    quantity
                )

                cart_item.quantity = quantity

                cart_item.save(
                    update_fields=[
                        "quantity",
                        "updated_at"
                    ]
                )

                response_serializer = CartItemSerializer(
                    cart_item
                )

                return Response(
                    {
                        "message": "Cart quantity updated successfully.",
                        "item": response_serializer.data
                    },
                    status=status.HTTP_200_OK
                )

        except ProductVariant.DoesNotExist:

            return Response(
                {
                    "error": "Product variant no longer exists."
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

    # ------------------------------------------------------
    # REMOVE CART ITEM
    # ------------------------------------------------------

    def delete(self, request, pk):

        cart_item = self.get_object(
            request,
            pk
        )

        cart_item.delete()

        return Response(
            {
                "message": "Cart item removed successfully."
            },
            status=status.HTTP_200_OK
        )
