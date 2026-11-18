
from django.urls import path

from .views import (
    CategoryListCreateView,
    CategoryDetailView,
    ColorListCreateView,
    ColorDetailView,
    SizeListCreateView,
    SizeDetailView,
    ProductListCreateView,
    ProductDetailView,
    ProductImageListCreateView,
    ProductImageDetailView,
    ProductVariantListCreateView,
    ProductVariantDetailView,
    CustomerProductListView,
    CustomerProductDetailView,
    ProductPriceHistoryListView,
    CustomerCategoryListView,
)


urlpatterns = [

    # ==========================================
    # CATEGORY APIs
    # ==========================================

    path(
        "categories/",
        CategoryListCreateView.as_view(),
        name="category-list-create"
    ),

    path(
        "categories/<int:pk>/",
        CategoryDetailView.as_view(),
        name="category-detail"
    ),

    # ==========================================
    # COLOR APIs
    # ==========================================

    path(
        "colors/",
        ColorListCreateView.as_view(),
        name="color-list-create"
    ),

    path(
        "colors/<int:pk>/",
        ColorDetailView.as_view(),
        name="color-detail"
    ),

    # ==========================================
    # SIZE APIs
    # ==========================================

    path(
        "sizes/",
        SizeListCreateView.as_view(),
        name="size-list-create"
    ),

    path(
        "sizes/<int:pk>/",
        SizeDetailView.as_view(),
        name="size-detail"
    ),
  
    # ==========================================
    # ADMIN PRODUCT APIs
    # ==========================================

    path(
        "products/",
        ProductListCreateView.as_view(),
        name="product-list-create"
    ),

    path(
        "products/<int:pk>/",
        ProductDetailView.as_view(),
        name="product-detail"
    ),

    # ==========================================
    # PRODUCT IMAGE APIs
    # ==========================================

    path(
        "product-images/",
        ProductImageListCreateView.as_view(),
        name="product-image-list-create"
    ),

    path(
        "product-images/<int:pk>/",
        ProductImageDetailView.as_view(),
        name="product-image-detail"
    ),

    # ==========================================
    # PRODUCT VARIANT APIs
    # ==========================================

    path(
        "product-variants/",
        ProductVariantListCreateView.as_view(),
        name="product-variant-list-create"
    ),

    path(
        "product-variants/<int:pk>/",
        ProductVariantDetailView.as_view(),
        name="product-variant-detail"
    ),

    # ==========================================
    # PRODUCT PRICE HISTORY API
    # ==========================================

    path(
        "product-price-history/",
        ProductPriceHistoryListView.as_view(),
        name="product-price-history"
    ),

    # ==========================================
    # CUSTOMER PRODUCT APIs
    # ==========================================
    # ==========================================
# CUSTOMER CATEGORY API
# ==========================================

path(
    "customer/categories/",
    CustomerCategoryListView.as_view(),
    name="customer-category-list"
),
    path(
        "customer/products/",
        CustomerProductListView.as_view(),
        name="customer-product-list"
    ),

    path(
        "customer/products/<int:pk>/",
        CustomerProductDetailView.as_view(),
        name="customer-product-detail"
    ),

]
