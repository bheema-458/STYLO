
from django.contrib import admin
from .models import (
    Category,
    Color,
    Product,
    ProductVariant,
    ProductImage,
    ProductPriceHistory,
)


# ==================================================
# CATEGORY ADMIN
# ==================================================

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):

    list_display = (
        "name",
        "parent",
        "display_order",
        "is_active",
        "is_deleted",
        "created_at",
    )

    search_fields = (
        "name",
        "description",
        "slug",
    )

    list_filter = (
        "is_active",
        "is_deleted",
        "created_at",
    )

    ordering = ("display_order", "-created_at")

    readonly_fields = (
        "created_at",
        "updated_at",
        "deleted_at",
    )

    actions = [
        "activate_categories",
        "deactivate_categories",
        "soft_delete_categories",
    ]

    @admin.action(description="Activate selected categories")
    def activate_categories(self, request, queryset):
        queryset.filter(is_deleted=False).update(
            is_active=True
        )

    @admin.action(description="Deactivate selected categories")
    def deactivate_categories(self, request, queryset):
        queryset.update(is_active=False)

    @admin.action(description="Soft delete selected categories")
    def soft_delete_categories(self, request, queryset):
        for category in queryset:
            category.soft_delete()

    def delete_model(self, request, obj):
        obj.soft_delete()

    def delete_queryset(self, request, queryset):
        for category in queryset:
            category.soft_delete()


# ==================================================
# COLOR ADMIN
# ==================================================

@admin.register(Color)
class ColorAdmin(admin.ModelAdmin):

    list_display = (
        "name",
        "hex_code",
        "is_active",
        "is_deleted",
        "created_at",
    )

    search_fields = (
        "name",
        "hex_code",
    )

    list_filter = (
        "is_active",
        "is_deleted",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )

    actions = [
        "activate_colors",
        "deactivate_colors",
        "soft_delete_colors",
    ]

    @admin.action(description="Activate selected colors")
    def activate_colors(self, request, queryset):
        queryset.filter(is_deleted=False).update(
            is_active=True
        )

    @admin.action(description="Deactivate selected colors")
    def deactivate_colors(self, request, queryset):
        queryset.update(is_active=False)

    @admin.action(description="Soft delete selected colors")
    def soft_delete_colors(self, request, queryset):
        queryset.update(
            is_active=False,
            is_deleted=True,
        )

    def delete_model(self, request, obj):
        obj.is_active = False
        obj.is_deleted = True
        obj.save(update_fields=["is_active", "is_deleted"])

    def delete_queryset(self, request, queryset):
        queryset.update(
            is_active=False,
            is_deleted=True,
        )


# ==================================================
# PRODUCT VARIANT INLINE
# ==================================================

class ProductVariantInline(admin.TabularInline):

    model = ProductVariant

    extra = 1

    fields = (
        "color",
        "size",
        "sku",
        "regular_price",
        "sale_price",
        "stock",
        "is_active",
    )


# ==================================================
# PRODUCT IMAGE INLINE
# ==================================================

class ProductImageInline(admin.TabularInline):

    model = ProductImage

    extra = 1

    fields = (
        "image",
        "variant",
        "alt_text",
        "is_primary",
        "display_order",
    )


# ==================================================
# PRODUCT ADMIN
# ==================================================

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):

    list_display = (
        "name",
        "category",
        "brand",
        "is_published",
        "is_active",
        "is_deleted",
        "created_at",
    )

    search_fields = (
        "name",
        "description",
        "brand",
        "slug",
    )

    list_filter = (
        "category",
        "is_published",
        "is_active",
        "is_deleted",
        "created_at",
    )

    ordering = ("-created_at",)

    readonly_fields = (
        "created_at",
        "updated_at",
        "deleted_at",
    )

    inlines = [
        ProductVariantInline,
        ProductImageInline,
    ]

    actions = [
        "publish_products",
        "unpublish_products",
        "soft_delete_products",
    ]

    @admin.action(description="Publish selected products")
    def publish_products(self, request, queryset):
        queryset.filter(
            is_deleted=False,
            is_active=True,
        ).update(is_published=True)

    @admin.action(description="Unpublish selected products")
    def unpublish_products(self, request, queryset):
        queryset.update(is_published=False)

    @admin.action(description="Soft delete selected products")
    def soft_delete_products(self, request, queryset):
        for product in queryset:
            product.soft_delete()

    def delete_model(self, request, obj):
        obj.soft_delete()

    def delete_queryset(self, request, queryset):
        for product in queryset:
            product.soft_delete()


# ==================================================
# PRODUCT VARIANT ADMIN
# ==================================================

@admin.register(ProductVariant)
class ProductVariantAdmin(admin.ModelAdmin):

    list_display = (
        "product",
        "color",
        "size",
        "sku",
        "regular_price",
        "sale_price",
        "stock",
        "is_active",
    )

    search_fields = (
        "product__name",
        "sku",
        "color__name",
    )

    list_filter = (
        "size",
        "color",
        "is_active",
    )


# ==================================================
# PRODUCT IMAGE ADMIN
# ==================================================

@admin.register(ProductImage)
class ProductImageAdmin(admin.ModelAdmin):

    list_display = (
        "product",
        "variant",
        "is_primary",
        "display_order",
        "created_at",
    )

    list_filter = (
        "is_primary",
        "created_at",
    )

    search_fields = (
        "product__name",
        "alt_text",
    )
# ==================================================
# PRODUCT PRICE HISTORY ADMIN
# ==================================================

@admin.register(ProductPriceHistory)
class ProductPriceHistoryAdmin(admin.ModelAdmin):

    list_display = (
        "variant",
        "price",
        "recorded_at",
    )

    search_fields = (
        "variant__sku",
        "variant__product__name",
    )

    list_filter = (
        "recorded_at",
    )

    ordering = ("-recorded_at",)

    readonly_fields = (
        "variant",
        "price",
        "recorded_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False