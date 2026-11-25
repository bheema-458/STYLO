
from django.contrib import admin

from .models import Cart, CartItem


class CartItemInline(admin.TabularInline):
    model = CartItem
    extra = 0
    readonly_fields = (
        "variant",
        "quantity",
        "created_at",
        "updated_at",
    )


@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "created_at",
        "updated_at",
    )

    search_fields = (
        "user__email",
        "user__username",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )

    inlines = [CartItemInline]


@admin.register(CartItem)
class CartItemAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "cart",
        "variant",
        "quantity",
        "created_at",
    )

    list_filter = (
        "created_at",
    )

    search_fields = (
        "cart__user__email",
        "variant__sku",
        "variant__product__name",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )
