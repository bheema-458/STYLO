
from django.urls import path

from .views import (
    WishlistView,
    WishlistItemListCreateView,
    WishlistItemDetailView,
    PriceAlertListCreateView,
    PriceAlertDetailView,
    StockAlertListCreateView,
    StockAlertDetailView,
)

urlpatterns = [
    # Wishlist
    path(
        "wishlist/",
        WishlistView.as_view(),
        name="wishlist-detail"
    ),

    path(
        "wishlist/items/",
        WishlistItemListCreateView.as_view(),
        name="wishlist-item-list-create"
    ),

    path(
        "wishlist/items/<int:pk>/",
        WishlistItemDetailView.as_view(),
        name="wishlist-item-detail"
    ),

    # Price Alerts
    path(
        "price-alerts/",
        PriceAlertListCreateView.as_view(),
        name="price-alert-list-create"
    ),

    path(
        "price-alerts/<int:pk>/",
        PriceAlertDetailView.as_view(),
        name="price-alert-detail"
    ),

    # Stock Alerts
    path(
        "stock-alerts/",
        StockAlertListCreateView.as_view(),
        name="stock-alert-list-create"
    ),

    path(
        "stock-alerts/<int:pk>/",
        StockAlertDetailView.as_view(),
        name="stock-alert-detail"
    ),
]
