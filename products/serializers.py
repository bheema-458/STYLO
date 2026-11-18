
import re
from decimal import Decimal, ROUND_HALF_UP

from rest_framework import serializers

from .models import (
    Category,
    Color,
    Size,
    Product,
    ProductVariant,
    ProductImage,
    ProductPriceHistory,
)


# ==========================================
# 1. CATEGORY SERIALIZER
# ==========================================

class CategorySerializer(serializers.ModelSerializer):

    parent_name = serializers.CharField(
        source="parent.name",
        read_only=True
    )

    class Meta:
        model = Category

        fields = [
            "id",
            "name",
            "slug",
            "description",
            "image",
            "parent",
            "parent_name",
            "display_order",
            "is_active",
            "is_deleted",
            "deleted_at",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "slug",
            "is_deleted",
            "deleted_at",
            "created_at",
            "updated_at",
        ]

    def validate_name(self, value):

        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Category name cannot be empty."
            )

        queryset = Category.objects.filter(
            name__iexact=value,
            is_deleted=False
        )

        if self.instance:
            queryset = queryset.exclude(
                pk=self.instance.pk
            )

        if queryset.exists():
            raise serializers.ValidationError(
                "This category name already exists."
            )

        return value

    def validate_parent(self, value):

        if value is None:
            return value

        if value.is_deleted:
            raise serializers.ValidationError(
                "Deleted category cannot be selected as parent."
            )

        if not value.is_active:
            raise serializers.ValidationError(
                "Inactive category cannot be selected as parent."
            )

        if self.instance:

            current = value

            while current:

                if current.pk == self.instance.pk:
                    raise serializers.ValidationError(
                        "Circular category relationship is not allowed."
                    )

                current = current.parent

        return value


# ==========================================
# 2. COLOR SERIALIZER
# ==========================================

class ColorSerializer(serializers.ModelSerializer):

    class Meta:
        model = Color

        fields = [
            "id",
            "name",
            "hex_code",
            "is_active",
            "is_deleted",
            "deleted_at",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "is_deleted",
            "deleted_at",
            "created_at",
            "updated_at",
        ]

    def validate_name(self, value):

        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Color name cannot be empty."
            )

        queryset = Color.objects.filter(
            name__iexact=value,
            is_deleted=False
        )

        if self.instance:
            queryset = queryset.exclude(
                pk=self.instance.pk
            )

        if queryset.exists():
            raise serializers.ValidationError(
                "This color already exists."
            )

        return value

    def validate_hex_code(self, value):

        value = value.strip().upper()

        if not re.fullmatch(r"#[0-9A-F]{6}", value):
            raise serializers.ValidationError(
                "Enter a valid HEX color code, e.g. #C98F9D."
            )

        return value


# ==========================================
# 3. SIZE SERIALIZER
# ==========================================

class SizeSerializer(serializers.ModelSerializer):

    class Meta:
        model = Size

        fields = [
            "id",
            "name",
            "display_order",
            "is_active",
            "is_deleted",
            "deleted_at",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "is_deleted",
            "deleted_at",
            "created_at",
            "updated_at",
        ]

    def validate_name(self, value):

        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Size name cannot be empty."
            )

        queryset = Size.objects.filter(
            name__iexact=value,
            is_deleted=False
        )

        if self.instance:
            queryset = queryset.exclude(
                pk=self.instance.pk
            )

        if queryset.exists():
            raise serializers.ValidationError(
                "This size already exists."
            )

        return value


# ==========================================
# 4. PRODUCT IMAGE SERIALIZER
# ==========================================


class ProductImageSerializer(serializers.ModelSerializer):

    product_name = serializers.CharField(
        source="product.name",
        read_only=True
    )

    variant_name = serializers.SerializerMethodField()

    image_url = serializers.SerializerMethodField()

    class Meta:
        model = ProductImage

        fields = [
            "id",
            "product",
            "product_name",
            "variant",
            "variant_name",
            "image",
            "image_url",
            "alt_text",
            "is_primary",
            "display_order",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "product_name",
            "variant_name",
            "image_url",
            "created_at",
        ]

    def get_variant_name(self, obj):

        if not obj.variant:
            return None

        return (
            f"{obj.variant.color.name} - "
            f"{obj.variant.size.name}"
        )

    def get_image_url(self, obj):

        if obj.image:

            request = self.context.get("request")

            if request:
                return request.build_absolute_uri(
                    obj.image.url
                )

            return obj.image.url

        return None

    def validate(self, attrs):

        product = attrs.get(
            "product",
            self.instance.product if self.instance else None
        )

        variant = attrs.get(
            "variant",
            self.instance.variant if self.instance else None
        )

        if product:

            if product.is_deleted:
                raise serializers.ValidationError({
                    "product": "Deleted product cannot be selected."
                })

            if not product.is_active:
                raise serializers.ValidationError({
                    "product": "Inactive product cannot be selected."
                })

        if variant:

            if not variant.is_active:
                raise serializers.ValidationError({
                    "variant": "Inactive variant cannot be selected."
                })

            if variant.product.is_deleted:
                raise serializers.ValidationError({
                    "variant": "Variant belongs to a deleted product."
                })

            if not variant.product.is_active:
                raise serializers.ValidationError({
                    "variant": "Variant belongs to an inactive product."
                })

            if product is None or variant.product_id != product.pk:
                raise serializers.ValidationError({
                    "variant": (
                        "This variant does not belong to "
                        "the selected product."
                    )
                })

        return attrs


# ==========================================
# 5. PRODUCT VARIANT SERIALIZER
# ==========================================

class ProductVariantSerializer(serializers.ModelSerializer):

    color_name = serializers.CharField(
        source="color.name",
        read_only=True
    )

    color_hex = serializers.CharField(
        source="color.hex_code",
        read_only=True
    )

    size_name = serializers.CharField(
        source="size.name",
        read_only=True
    )

    size_display_order = serializers.IntegerField(
        source="size.display_order",
        read_only=True
    )

    current_price = serializers.ReadOnlyField()

    is_in_stock = serializers.ReadOnlyField()

    discount_percentage = serializers.SerializerMethodField()

    class Meta:
        model = ProductVariant

        fields = [
            "id",
            "product",
            "color",
            "color_name",
            "color_hex",
            "size",
            "size_name",
            "size_display_order",
            "sku",
            "regular_price",
            "sale_price",
            "current_price",
            "discount_percentage",
            "stock",
            "is_in_stock",
            "is_active",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "current_price",
            "discount_percentage",
            "is_in_stock",
            "created_at",
            "updated_at",
        ]

    # DISCOUNT CALCULATION

    def get_discount_percentage(self, obj):

        regular_price = obj.regular_price
        sale_price = obj.sale_price

        if regular_price is None or regular_price <= 0:
            return 0

        if sale_price is None:
            return 0

        if sale_price >= regular_price:
            return 0

        discount = (
            (regular_price - sale_price)
            / regular_price
        ) * Decimal("100")

        return int(
            discount.quantize(
                Decimal("1"),
                rounding=ROUND_HALF_UP
            )
        )

    # PRODUCT VALIDATION

    def validate_product(self, value):

        if value.is_deleted:
            raise serializers.ValidationError(
                "Deleted product cannot be selected."
            )

        if not value.is_active:
            raise serializers.ValidationError(
                "Inactive product cannot be selected."
            )

        return value

    # COLOR VALIDATION

    def validate_color(self, value):

        if value.is_deleted:
            raise serializers.ValidationError(
                "Deleted color cannot be selected."
            )

        if not value.is_active:
            raise serializers.ValidationError(
                "Inactive color cannot be selected."
            )

        return value

    # SIZE VALIDATION

    def validate_size(self, value):

        if value.is_deleted:
            raise serializers.ValidationError(
                "Deleted size cannot be selected."
            )

        if not value.is_active:
            raise serializers.ValidationError(
                "Inactive size cannot be selected."
            )

        return value

    # SKU VALIDATION

    def validate_sku(self, value):

        value = value.strip().upper()

        if not value:
            raise serializers.ValidationError(
                "SKU cannot be empty."
            )

        queryset = ProductVariant.objects.filter(
            sku__iexact=value
        )

        if self.instance:
            queryset = queryset.exclude(
                pk=self.instance.pk
            )

        if queryset.exists():
            raise serializers.ValidationError(
                "This SKU already exists."
            )

        return value

    # MAIN VALIDATION

    def validate(self, attrs):

        regular_price = attrs.get(
            "regular_price",
            self.instance.regular_price if self.instance else None
        )

        sale_price = attrs.get(
            "sale_price",
            self.instance.sale_price if self.instance else None
        )

        product = attrs.get(
            "product",
            self.instance.product if self.instance else None
        )

        color = attrs.get(
            "color",
            self.instance.color if self.instance else None
        )

        size = attrs.get(
            "size",
            self.instance.size if self.instance else None
        )

        # PRICE VALIDATION

        if regular_price is not None and regular_price <= 0:
            raise serializers.ValidationError({
                "regular_price": (
                    "Regular price must be greater than zero."
                )
            })

        if sale_price is not None:

            if sale_price <= 0:
                raise serializers.ValidationError({
                    "sale_price": (
                        "Sale price must be greater than zero."
                    )
                })

            if regular_price is not None and sale_price >= regular_price:
                raise serializers.ValidationError({
                    "sale_price": (
                        "Sale price must be lower than regular price."
                    )
                })

        # PRODUCT VALIDATION

        if product and product.is_deleted:
            raise serializers.ValidationError({
                "product": "Deleted product cannot be selected."
            })

        if product and not product.is_active:
            raise serializers.ValidationError({
                "product": "Inactive product cannot be selected."
            })

        # COLOR VALIDATION

        if color and color.is_deleted:
            raise serializers.ValidationError({
                "color": "Deleted color cannot be selected."
            })

        if color and not color.is_active:
            raise serializers.ValidationError({
                "color": "Inactive color cannot be selected."
            })

        # SIZE VALIDATION

        if size and size.is_deleted:
            raise serializers.ValidationError({
                "size": "Deleted size cannot be selected."
            })

        if size and not size.is_active:
            raise serializers.ValidationError({
                "size": "Inactive size cannot be selected."
            })

        # PREVENT DUPLICATE PRODUCT VARIANTS

        if product and color and size:

            queryset = ProductVariant.objects.filter(
                product=product,
                color=color,
                size=size
            )

            if self.instance:
                queryset = queryset.exclude(
                    pk=self.instance.pk
                )

            if queryset.exists():
                raise serializers.ValidationError({
                    "size": (
                        "This product already has a variant "
                        "with the selected color and size."
                    )
                })

        return attrs


# ==========================================
# 6. PRODUCT SERIALIZER
# ==========================================

class ProductSerializer(serializers.ModelSerializer):

    category_name = serializers.CharField(
        source="category.name",
        read_only=True
    )

    images = ProductImageSerializer(
        many=True,
        read_only=True
    )

    variants = ProductVariantSerializer(
        many=True,
        read_only=True
    )

    class Meta:
        model = Product

        fields = [
            "id",
            "name",
            "slug",
            "description",
            "category",
            "category_name",
            "brand",
            "material",
            "care_instructions",
            "highlights",
            "images",
            "variants",
            "publication_status",
            "is_published",
            "published_at",
            "is_active",
            "is_deleted",
            "deleted_at",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "slug",
            "images",
            "variants",
           "is_published",
            "published_at",
            "is_deleted",
            "deleted_at",
            "created_at",
            "updated_at",
        ]

    # PRODUCT NAME VALIDATION

    def validate_name(self, value):

        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Product name cannot be empty."
            )

        return value

    # CATEGORY VALIDATION

    def validate_category(self, value):

        if value.is_deleted:
            raise serializers.ValidationError(
                "Deleted category cannot be selected."
            )

        if not value.is_active:
            raise serializers.ValidationError(
                "Inactive category cannot be selected."
            )

        return value

    # HIGHLIGHTS VALIDATION

    def validate_highlights(self, value):

        if not isinstance(value, list):
            raise serializers.ValidationError(
                "Highlights must be a list."
            )

        cleaned_highlights = []

        for item in value:

            if not isinstance(item, str):
                raise serializers.ValidationError(
                    "Each highlight must be a text value."
                )

            item = item.strip()

            if item:
                cleaned_highlights.append(item)

        return cleaned_highlights


# ==========================================
# 7. PRODUCT PRICE HISTORY SERIALIZER
# ==========================================

class ProductPriceHistorySerializer(serializers.ModelSerializer):

    class Meta:
        model = ProductPriceHistory

        fields = [
            "id",
            "variant",
            "price",
            "recorded_at",
        ]

        read_only_fields = [
            "id",
            "variant",
            "price",
            "recorded_at",
        ]
