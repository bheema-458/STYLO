
from rest_framework import serializers

from .models import (
    Wishlist,
    WishlistItem,
    PriceAlert,
    StockAlert,
    Notification,
)

from products.models import ProductImage
from products.serializers import ProductVariantSerializer


# ==========================================================
# 1. COMMON PRODUCT AVAILABILITY VALIDATION
# ==========================================================

def is_product_available(product):

    if not product or not product.category:
        return False

    category = product.category

    return (
        product.is_active
        and not product.is_deleted
        and product.is_published
        and product.publication_status == "published"
        and category.is_active
        and not category.is_deleted
    )


def is_variant_available(variant):

    if not variant:
        return False

    return (
        variant.is_active
        and is_product_available(variant.product)
        and variant.color.is_active
        and not variant.color.is_deleted
        and variant.size.is_active
        and not variant.size.is_deleted
    )


# ==========================================================
# 2. WISHLIST ITEM SERIALIZER
# ==========================================================

class WishlistItemSerializer(serializers.ModelSerializer):

    product_details = serializers.SerializerMethodField()

    class Meta:

        model = WishlistItem

        fields = [
            "id",
            "product",
            "product_details",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "product_details",
            "created_at",
        ]

    # ------------------------------------------------------
    # PRODUCT IMAGE DETAILS
    # ------------------------------------------------------

    def get_product_images(self, product):

        images = (
            ProductImage.objects
            .filter(product=product)
            .select_related("variant")
            .order_by(
                "-is_primary",
                "display_order",
                "-created_at"
            )
        )

        request = self.context.get("request")

        image_data = []

        for image in images:

            if not image.image:
                continue

            try:

                image_url = image.image.url

                if request:
                    image_url = request.build_absolute_uri(
                        image_url
                    )

                image_data.append({
                    "id": image.id,
                    "url": image_url,
                    "is_primary": image.is_primary,
                    "display_order": image.display_order,
                    "variant_id": image.variant_id,
                })

            except (ValueError, AttributeError):
                continue

        return image_data

    # ------------------------------------------------------
    # PRODUCT DETAILS
    # ------------------------------------------------------

    def get_product_details(self, obj):

        product = obj.product

        product_available = is_product_available(
            product
        )

        # Get all product images
        images_data = self.get_product_images(
            product
        )

        # Find primary image
        primary_image = next(
            (
                image["url"]
                for image in images_data
                if image["is_primary"]
            ),
            images_data[0]["url"] if images_data else None
        )

        variant_data = []
        prices = []

        # --------------------------------------------------
        # AVAILABLE PRODUCT VARIANTS
        # --------------------------------------------------

        if product_available:

            variants = list(
                product.variants
                .filter(
                    is_active=True,
                    color__is_active=True,
                    color__is_deleted=False,
                    size__is_active=True,
                    size__is_deleted=False,
                )
                .select_related(
                    "product",
                    "product__category",
                    "color",
                    "size",
                )
                .order_by(
                    "size__display_order",
                    "color__name",
                    "id"
                )
            )

            # Serialize all active variants.
            # Out-of-stock variants are retained so the frontend
            # can show their availability correctly.

            variant_data = ProductVariantSerializer(
                variants,
                many=True,
                context=self.context
            ).data

            # Calculate minimum price from in-stock variants
            prices = [
                variant.current_price
                for variant in variants
                if (
                    variant.stock > 0
                    and variant.current_price is not None
                    and variant.current_price > 0
                )
            ]

        # --------------------------------------------------
        # FINAL PRODUCT DETAILS
        # --------------------------------------------------

        return {
            "id": product.id,
            "name": product.name,
            "slug": product.slug,

            "category": (
                product.category.name
                if product.category
                else None
            ),

            # Main image
            "image": primary_image,

            # Complete image gallery
            "images": images_data,

            # Minimum available price
            "price_from": (
                min(prices)
                if prices
                else None
            ),

            # Product availability
            "is_available": (
                product_available
                and bool(prices)
            ),

            # Product size and color combinations
            "variants": variant_data,
        }


# ==========================================================
# 3. WISHLIST SERIALIZER
# ==========================================================

class WishlistSerializer(serializers.ModelSerializer):

    items = WishlistItemSerializer(
        many=True,
        read_only=True
    )

    total_items = serializers.SerializerMethodField()

    class Meta:

        model = Wishlist

        fields = [
            "id",
            "items",
            "total_items",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "items",
            "total_items",
            "created_at",
            "updated_at",
        ]

    def get_total_items(self, obj):

        return obj.items.count()


# ==========================================================
# 4. PRICE ALERT SERIALIZER
# ==========================================================

class PriceAlertSerializer(serializers.ModelSerializer):

    product_details = serializers.SerializerMethodField()

    class Meta:

        model = PriceAlert

        fields = [
            "id",
            "variant",
            "product_details",
            "target_price",
            "is_active",
            "notified_at",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "is_active",
            "notified_at",
            "created_at",
        ]

    def get_product_details(self, obj):

        variant = obj.variant
        product = variant.product

        return {
            "product_name": product.name,
            "size": variant.size.name,
            "color": variant.color.name,
            "current_price": variant.current_price,
            "target_price": obj.target_price,
        }

    def validate_variant(self, value):

        if not is_variant_available(value):

            raise serializers.ValidationError(
                "This product variant is unavailable."
            )

        if (
            value.current_price is None
            or value.current_price <= 0
        ):

            raise serializers.ValidationError(
                "Current product price is unavailable."
            )

        return value

    def validate(self, attrs):

        variant = attrs.get(
            "variant",
            self.instance.variant if self.instance else None
        )

        target_price = attrs.get(
            "target_price",
            self.instance.target_price if self.instance else None
        )

        if variant and target_price is not None:

            current_price = variant.current_price

            if (
                current_price is None
                or current_price <= 0
            ):

                raise serializers.ValidationError({
                    "variant": (
                        "Current product price is unavailable."
                    )
                })

            if target_price >= current_price:

                raise serializers.ValidationError({
                    "target_price": (
                        "Target price must be lower than "
                        "the current product price."
                    )
                })

        return attrs


# ==========================================================
# 5. STOCK ALERT SERIALIZER
# ==========================================================

class StockAlertSerializer(serializers.ModelSerializer):

    product_details = serializers.SerializerMethodField()

    class Meta:

        model = StockAlert

        fields = [
            "id",
            "variant",
            "product_details",
            "is_active",
            "notified_at",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "is_active",
            "notified_at",
            "created_at",
        ]

    def get_product_details(self, obj):

        variant = obj.variant
        product = variant.product

        return {
            "product_name": product.name,
            "size": variant.size.name,
            "color": variant.color.name,
            "stock": variant.stock,
            "sku": variant.sku,
        }

    def validate_variant(self, value):

        if not is_variant_available(value):

            raise serializers.ValidationError(
                "This product variant is unavailable."
            )

        if value.stock != 0:

            raise serializers.ValidationError(
                "Stock alert can only be created when stock is zero."
            )

        return value


# ==========================================================
# 6. NOTIFICATION SERIALIZER
# ==========================================================

class NotificationSerializer(serializers.ModelSerializer):

    class Meta:

        model = Notification

        fields = [
            "id",
            "title",
            "message",
            "notification_type",
            "is_read",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "title",
            "message",
            "notification_type",
            "created_at",
        ]
