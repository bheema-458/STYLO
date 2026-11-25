
from django.urls import path

from .views import (
    # Category
    CategoryListCreateView,
    CategoryDetailView,
    CustomerCategoryListView,

    # Color
    ColorListCreateView,
    ColorDetailView,

    # Size
    SizeListCreateView,
    SizeDetailView,

    # Product
    ProductListCreateView,
    ProductDetailView,
    CustomerProductListView,
    CustomerProductDetailView,

    # Product Images
    ProductImageListCreateView,
    ProductImageDetailView,

    # Product Variants
    ProductVariantListCreateView,
    ProductVariantDetailView,

    # Price History
    ProductPriceHistoryListView,
)


urlpatterns = [

    # ==================================================
    # 1. ADMIN CATEGORY APIs
    # ==================================================

    path(
        "categories/",
        CategoryListCreateView.as_view(),
        name="category-list-create",
    ),

    path(
        "categories/<int:pk>/",
        CategoryDetailView.as_view(),
        name="category-detail",
    ),

    # ==================================================
    # 2. CUSTOMER CATEGORY API
    # ==================================================

    path(
        "customer/categories/",
        CustomerCategoryListView.as_view(),
        name="customer-category-list",
    ),

    # ==================================================
    # 3. ADMIN COLOR APIs
    # ==================================================

    path(
        "colors/",
        ColorListCreateView.as_view(),
        name="color-list-create",
    ),

    path(
        "colors/<int:pk>/",
        ColorDetailView.as_view(),
        name="color-detail",
    ),

    # ==================================================
    # 4. ADMIN SIZE APIs
    # ==================================================

    path(
        "sizes/",
        SizeListCreateView.as_view(),
        name="size-list-create",
    ),

    path(
        "sizes/<int:pk>/",
        SizeDetailView.as_view(),
        name="size-detail",
    ),

    # ==================================================
    # 5. ADMIN PRODUCT APIs
    # ==================================================

    path(
        "products/",
        ProductListCreateView.as_view(),
        name="product-list-create",
    ),

    path(
        "products/<int:pk>/",
        ProductDetailView.as_view(),
        name="product-detail",
    ),

    # ==================================================
    # 6. CUSTOMER PRODUCT APIs
    # ==================================================

    path(
        "customer/products/",
        CustomerProductListView.as_view(),
        name="customer-product-list",
    ),

    path(
        "customer/products/<int:pk>/",
        CustomerProductDetailView.as_view(),
        name="customer-product-detail",
    ),

    # ==================================================
    # 7. ADMIN PRODUCT IMAGE APIs
    # ==================================================

    path(
        "product-images/",
        ProductImageListCreateView.as_view(),
        name="product-image-list-create",
    ),

    path(
        "product-images/<int:pk>/",
        ProductImageDetailView.as_view(),
        name="product-image-detail",
    ),

    # ==================================================
    # 8. ADMIN PRODUCT VARIANT APIs
    # ==================================================

    path(
        "product-variants/",
        ProductVariantListCreateView.as_view(),
        name="product-variant-list-create",
    ),

    path(
        "product-variants/<int:pk>/",
        ProductVariantDetailView.as_view(),
        name="product-variant-detail",
    ),

    # ==================================================
    # 9. ADMIN PRODUCT PRICE HISTORY
    # ==================================================

    path(
        "product-price-history/",
        ProductPriceHistoryListView.as_view(),
        name="product-price-history",
    ),

]
