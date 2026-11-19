
from django.shortcuts import get_object_or_404
from django.db import transaction, IntegrityError

from rest_framework import status, generics, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError

from products.models import Product

from .models import (
    Wishlist,
    WishlistItem,
    PriceAlert,
    StockAlert,
    Notification,
)

from .serializers import (
    WishlistSerializer,
    WishlistItemSerializer,
    PriceAlertSerializer,
    StockAlertSerializer,
    NotificationSerializer,
)


# ==========================================================
# WISHLIST HELPER
# ==========================================================

def get_user_wishlist(user):

    wishlist, created = Wishlist.objects.get_or_create(
        user=user
    )

    return wishlist


# ==========================================================
# 1. VIEW CUSTOMER WISHLIST
# ==========================================================

class WishlistView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):

        wishlist = get_user_wishlist(request.user)

        wishlist = (
            Wishlist.objects
            .prefetch_related(
                "items__product__category",
                "items__product__images",
                "items__product__variants__color",
                "items__product__variants__size",
            )
            .get(pk=wishlist.pk)
        )

        serializer = WishlistSerializer(wishlist)

        return Response(
            serializer.data,
            status=status.HTTP_200_OK
        )


# ==========================================================
# 2. ADD PRODUCT TO WISHLIST
# ==========================================================

class WishlistItemListCreateView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request):

        product_id = request.data.get("product_id")

        if product_id is None:

            raise ValidationError({
                "product_id": "Product ID is required."
            })

        try:

            product_id = int(product_id)

            if product_id <= 0:
                raise ValueError

        except (TypeError, ValueError):

            raise ValidationError({
                "product_id": "Enter a valid product ID."
            })

        # Only active and published products can be wishlisted
        product = get_object_or_404(
            Product.objects.select_related("category"),
            pk=product_id,
            is_active=True,
            is_deleted=False,
            is_published=True,
            publication_status="published",
            category__is_active=True,
            category__is_deleted=False,
        )

        wishlist = get_user_wishlist(request.user)

        try:

            with transaction.atomic():

                item, created = WishlistItem.objects.get_or_create(
                    wishlist=wishlist,
                    product=product
                )

        except IntegrityError:

            # Handles simultaneous duplicate requests
            item = WishlistItem.objects.get(
                wishlist=wishlist,
                product=product
            )

            created = False

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


# ==========================================================
# 3. REMOVE PRODUCT FROM WISHLIST
# ==========================================================

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
            {
                "message": "Product removed from wishlist successfully."
            },
            status=status.HTTP_200_OK
        )


# ==========================================================
# 4. PRICE ALERT LIST AND CREATE
# ==========================================================

class PriceAlertListCreateView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):

        alerts = (
            PriceAlert.objects
            .filter(
                user=request.user,
                is_active=True
            )
            .select_related(
                "variant",
                "variant__product",
                "variant__color",
                "variant__size",
            )
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

        serializer = PriceAlertSerializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

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
            {
                "message": "Price alert created successfully.",
                "alert": serializer.data
            },
            status=status.HTTP_201_CREATED
        )


# ==========================================================
# 5. DEACTIVATE PRICE ALERT
# ==========================================================

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
            update_fields=[
                "is_active",
                "updated_at"
            ]
        )

        return Response(
            {
                "message": "Price alert deactivated successfully."
            },
            status=status.HTTP_200_OK
        )


# ==========================================================
# 6. STOCK ALERT LIST AND CREATE
# ==========================================================

class StockAlertListCreateView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):

        alerts = (
            StockAlert.objects
            .filter(
                user=request.user,
                is_active=True
            )
            .select_related(
                "variant",
                "variant__product",
                "variant__color",
                "variant__size",
            )
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

        serializer = StockAlertSerializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

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
            {
                "message": "Stock alert created successfully.",
                "alert": serializer.data
            },
            status=status.HTTP_201_CREATED
        )


# ==========================================================
# 7. DEACTIVATE STOCK ALERT
# ==========================================================

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

        alert.save(
            update_fields=["is_active"]
        )

        return Response(
            {
                "message": "Stock alert deactivated successfully."
            },
            status=status.HTTP_200_OK
        )


# ==========================================================
# 8. NOTIFICATION LIST API
# ==========================================================

class NotificationListView(generics.ListAPIView):

    serializer_class = NotificationSerializer

    permission_classes = [
        permissions.IsAuthenticated
    ]

    def get_queryset(self):

        return Notification.objects.filter(
            user=self.request.user
        ).order_by("-created_at")


# ==========================================================
# 9. UNREAD NOTIFICATION COUNT
# ==========================================================

class UnreadNotificationCountView(APIView):

    permission_classes = [
        permissions.IsAuthenticated
    ]

    def get(self, request):

        count = Notification.objects.filter(
            user=request.user,
            is_read=False
        ).count()

        return Response(
            {
                "unread_count": count
            },
            status=status.HTTP_200_OK
        )


# ==========================================================
# 10. MARK NOTIFICATION AS READ
# ==========================================================

class MarkNotificationReadView(APIView):

    permission_classes = [
        permissions.IsAuthenticated
    ]

    def patch(self, request, pk):

        notification = get_object_or_404(
            Notification,
            pk=pk,
            user=request.user
        )

        notification.is_read = True

        notification.save(
            update_fields=["is_read"]
        )

        return Response(
            {
                "message": "Notification marked as read."
            },
            status=status.HTTP_200_OK
        )
