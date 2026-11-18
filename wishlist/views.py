
from django.shortcuts import get_object_or_404
from django.db import transaction

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.exceptions import ValidationError

from products.models import Product

from .models import (
    Wishlist,
    WishlistItem,
    PriceAlert,
    StockAlert,
)

from .serializers import (
    WishlistSerializer,
    WishlistItemSerializer,
    PriceAlertSerializer,
    StockAlertSerializer,
)


# ----------------------------------
# Wishlist Helper
# ----------------------------------

def get_user_wishlist(user):
    wishlist, created = Wishlist.objects.get_or_create(user=user)
    return wishlist


# ----------------------------------
# Wishlist View
# ----------------------------------

class WishlistView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        wishlist = get_user_wishlist(request.user)

        wishlist = Wishlist.objects.prefetch_related(
            "items__product__category",
            "items__product__images",
            "items__product__variants__color",
        ).get(pk=wishlist.pk)

        serializer = WishlistSerializer(wishlist)

        return Response(
            serializer.data,
            status=status.HTTP_200_OK
        )


# ----------------------------------
# Add Product to Wishlist
# ----------------------------------

class WishlistItemListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        product_id = request.data.get("product_id")

        if not product_id:
            raise ValidationError({
                "product_id": "Product ID is required."
            })

        product = get_object_or_404(
            Product.objects.select_related("category"),
            pk=product_id,
            is_active=True,
            is_published=True,
            is_deleted=False,
            category__is_active=True,
            category__is_deleted=False,
        )

        wishlist = get_user_wishlist(request.user)

        with transaction.atomic():
            item, created = WishlistItem.objects.get_or_create(
                wishlist=wishlist,
                product=product,
            )

        serializer = WishlistItemSerializer(item)

        return Response(
            {
                "message": (
                    "Product added to wishlist successfully."
                    if created
                    else "Product is already in your wishlist."
                ),
                "item": serializer.data,
            },
            status=(
                status.HTTP_201_CREATED
                if created
                else status.HTTP_200_OK
            )
        )


# ----------------------------------
# Remove Product from Wishlist
# ----------------------------------

class WishlistItemDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, request, pk):
        wishlist = get_user_wishlist(request.user)

        return get_object_or_404(
            WishlistItem,
            pk=pk,
            wishlist=wishlist
        )

    def delete(self, request, pk):
        item = self.get_object(request, pk)
        item.delete()

        return Response(
            {"message": "Product removed from wishlist successfully."},
            status=status.HTTP_200_OK
        )


# ----------------------------------
# Price Alert List and Create
# ----------------------------------

class PriceAlertListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        alerts = PriceAlert.objects.filter(
            user=request.user,
            is_active=True
        ).select_related(
            "variant",
            "variant__product",
            "variant__color"
        )

        serializer = PriceAlertSerializer(
            alerts,
            many=True
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK
        )

    def post(self, request):
        serializer = PriceAlertSerializer(data=request.data)

        serializer.is_valid(raise_exception=True)

        variant = serializer.validated_data["variant"]

        already_exists = PriceAlert.objects.filter(
            user=request.user,
            variant=variant,
            is_active=True
        ).exists()

        if already_exists:
            return Response(
                {
                    "message": (
                        "An active price alert already exists "
                        "for this variant."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer.save(user=request.user)

        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED
        )


# ----------------------------------
# Deactivate Price Alert
# ----------------------------------

class PriceAlertDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        alert = get_object_or_404(
            PriceAlert,
            pk=pk,
            user=request.user,
            is_active=True
        )

        alert.is_active = False
        alert.save(
            update_fields=["is_active", "updated_at"]
        )

        return Response(
            {
                "message": "Price alert deactivated successfully."
            },
            status=status.HTTP_200_OK
        )


# ----------------------------------
# Stock Alert List and Create
# ----------------------------------

class StockAlertListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        alerts = StockAlert.objects.filter(
            user=request.user,
            is_active=True
        ).select_related(
            "variant",
            "variant__product",
            "variant__color"
        )

        serializer = StockAlertSerializer(
            alerts,
            many=True
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK
        )

    def post(self, request):
        serializer = StockAlertSerializer(data=request.data)

        serializer.is_valid(raise_exception=True)

        variant = serializer.validated_data["variant"]

        already_exists = StockAlert.objects.filter(
            user=request.user,
            variant=variant,
            is_active=True
        ).exists()

        if already_exists:
            return Response(
                {
                    "message": (
                        "An active stock alert already exists "
                        "for this variant."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer.save(user=request.user)

        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED
        )


# ----------------------------------
# Deactivate Stock Alert
# ----------------------------------

class StockAlertDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        alert = get_object_or_404(
            StockAlert,
            pk=pk,
            user=request.user,
            is_active=True
        )

        alert.is_active = False
        alert.save(update_fields=["is_active"])

        return Response(
            {
                "message": "Stock alert deactivated successfully."
            },
            status=status.HTTP_200_OK
        )
