
from rest_framework import serializers

from .models import Cart, CartItem
from products.models import ProductVariant


# ==========================================
# 1. CART ITEM SERIALIZER
# ==========================================

class CartItemSerializer(serializers.ModelSerializer):

    variant_details = serializers.SerializerMethodField()

    subtotal = serializers.ReadOnlyField()

    class Meta:

        model = CartItem

        fields = [
            "id",
            "variant",
            "variant_details",
            "quantity",
            "subtotal",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "subtotal",
            "created_at",
            "updated_at",
        ]

    # ======================================
    # VARIANT DETAILS
    # ======================================

    def get_variant_details(self, obj):

        variant = obj.variant
        product = variant.product

        image = product.images.filter(
            is_primary=True
        ).first()

        return {
            "product_id": product.id,
            "product_name": product.name,
            "product_slug": product.slug,

            "size_id": variant.size.id,
            "size_name": variant.size.name,

            "color_id": variant.color.id,
            "color_name": variant.color.name,
            "color_hex": variant.color.hex_code,

            "sku": variant.sku,

            "regular_price": variant.regular_price,
            "sale_price": variant.sale_price,
            "current_price": variant.current_price,

            "stock": variant.stock,
            "is_in_stock": variant.is_in_stock,

            "image": (
                image.image.url
                if image and image.image
                else None
            ),
        }

    # ======================================
    # VARIANT VALIDATION
    # ======================================

    def validate_variant(self, value):

        product = value.product

        if not value.is_active:
            raise serializers.ValidationError(
                "This product variant is unavailable."
            )

        if (
            product.is_deleted
            or not product.is_active
            or not product.is_published
        ):
            raise serializers.ValidationError(
                "This product is currently unavailable."
            )

        if (
            not value.color.is_active
            or value.color.is_deleted
        ):
            raise serializers.ValidationError(
                "This color is currently unavailable."
            )

        if (
            not value.size.is_active
            or value.size.is_deleted
        ):
            raise serializers.ValidationError(
                "This size is currently unavailable."
            )

        if value.stock <= 0:
            raise serializers.ValidationError(
                "This product is currently out of stock."
            )

        if value.current_price is None:
            raise serializers.ValidationError(
                "Price is unavailable for this product."
            )

        return value

    # ======================================
    # QUANTITY VALIDATION
    # ======================================

    def validate_quantity(self, value):

        if value < 1:
            raise serializers.ValidationError(
                "Quantity must be at least 1."
            )

        variant_id = self.initial_data.get("variant")

        if variant_id:

            try:
                variant = ProductVariant.objects.get(
                    pk=variant_id
                )

            except (
                ProductVariant.DoesNotExist,
                ValueError,
                TypeError,
            ):
                raise serializers.ValidationError(
                    "Invalid product variant."
                )

            if value > variant.stock:
                raise serializers.ValidationError(
                    f"Only {variant.stock} items are available."
                )

        return value


# ==========================================
# 2. CART SERIALIZER
# ==========================================

class CartSerializer(serializers.ModelSerializer):

    items = CartItemSerializer(
        many=True,
        read_only=True
    )

    total_items = serializers.SerializerMethodField()

    total_price = serializers.SerializerMethodField()

    class Meta:

        model = Cart

        fields = [
            "id",
            "items",
            "total_items",
            "total_price",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "items",
            "total_items",
            "total_price",
            "created_at",
            "updated_at",
        ]

    # ======================================
    # TOTAL QUANTITY
    # ======================================

    def get_total_items(self, obj):

        return sum(
            item.quantity
            for item in obj.items.all()
        )

    # ======================================
    # TOTAL CART PRICE
    # ======================================

    def get_total_price(self, obj):

        return sum(
            (
                item.subtotal
                for item in obj.items.all()
            ),
            start=0
        )
