
from django.urls import path

from .views import (
    CartView,
    CartItemListCreateView,
    CartItemDetailView,
)


urlpatterns = [
    # Get user's cart
    path(
        "cart/",
        CartView.as_view(),
        name="cart-detail"
    ),

    # Add item to cart
    path(
        "cart/items/",
        CartItemListCreateView.as_view(),
        name="cart-item-list-create"
    ),

    # Update or remove cart item
    path(
        "cart/items/<int:pk>/",
        CartItemDetailView.as_view(),
        name="cart-item-detail"
    ),
]
