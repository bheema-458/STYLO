
from rest_framework import serializers

from .models import (
    Wishlist,
    WishlistItem,
    PriceAlert,
    StockAlert,
)

from products.serializers import ProductVariantSerializer


# ----------------------------------
# 1. WISHLIST ITEM SERIALIZER
# ----------------------------------

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

    def get_product_details(self, obj):

        product = obj.product

        image = product.images.filter(
            is_primary=True
        ).first()

        # Get active variants
        variants = product.variants.filter(
            is_active=True,
            color__is_active=True,
            color__is_deleted=False,
            size__is_active=True,
            size__is_deleted=False,
        ).select_related(
            "color",
            "size",
        )

        # Get available prices
        prices = [
            variant.current_price
            for variant in variants
            if variant.current_price is not None
        ]

        # Serialize variants
        variant_data = ProductVariantSerializer(
            variants,
            many=True
        ).data

        return {
            "id": product.id,
            "name": product.name,
            "slug": product.slug,
            "category": product.category.name,

            "image": (
                image.image.url
                if image and image.image
                else None
            ),

            "price_from": min(prices) if prices else None,

            "is_available": bool(prices),

            # NEW: Variant information
            "variants": variant_data,
        }


# ----------------------------------
# 2. WISHLIST SERIALIZER
# ----------------------------------

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

    def get_total_items(self, obj):

        return obj.items.count()


# ----------------------------------
# 3. PRICE ALERT SERIALIZER
# ----------------------------------

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

        product = value.product

        if (
            not value.is_active
            or not product.is_active
            or not product.is_published
            or product.is_deleted
            or not value.color.is_active
            or value.color.is_deleted
            or not value.size.is_active
            or value.size.is_deleted
        ):

            raise serializers.ValidationError(
                "This product variant is unavailable."
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

            if target_price >= variant.current_price:

                raise serializers.ValidationError({
                    "target_price": (
                        "Target price must be lower than "
                        "the current price."
                    )
                })

        return attrs


# ----------------------------------
# 4. STOCK ALERT SERIALIZER
# ----------------------------------

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

        product = value.product

        if (
            not value.is_active
            or not product.is_active
            or not product.is_published
            or product.is_deleted
            or not value.color.is_active
            or value.color.is_deleted
            or not value.size.is_active
            or value.size.is_deleted
        ):

            raise serializers.ValidationError(
                "This product variant is unavailable."
            )

        if value.stock != 0:

            raise serializers.ValidationError(
                "Stock alert can only be created when stock is zero."
            )

        return value
