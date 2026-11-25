
from django.db import transaction
from django.db.models import Prefetch, Q
from django.shortcuts import get_object_or_404

from rest_framework import (
    generics,
    permissions,
    filters,
    status,
)
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.pagination import PageNumberPagination

from .models import (
    Category,
    Color,
    Size,
    Product,
    ProductVariant,
    ProductImage,
    ProductPriceHistory,
)

from .serializers import (
    CategorySerializer,
    ColorSerializer,
    SizeSerializer,
    ProductSerializer,
    ProductVariantSerializer,
    ProductImageSerializer,
    ProductPriceHistorySerializer,
)


# ==================================================
# ADMIN PERMISSION
# ==================================================

class IsActiveAdmin(permissions.BasePermission):

    def has_permission(self, request, view):

        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_active
            and request.user.is_staff
        )


# ==================================================
# COMMON QUERY PARAMETER VALIDATION
# ==================================================

def get_integer_param(request, param_name):

    value = request.query_params.get(param_name)

    if value is None or value == "":
        return None

    try:
        return int(value)

    except (ValueError, TypeError):
        raise ValidationError({
            param_name: "Enter a valid integer."
        })


def get_boolean_param(request, param_name):

    value = request.query_params.get(param_name)

    if value is None or value == "":
        return None

    value = value.lower()

    if value == "true":
        return True

    if value == "false":
        return False

    raise ValidationError({
        param_name: "Enter true or false."
    })


# ==================================================
# CUSTOMER PRODUCT QUERYSET
# Only published and active products are visible
# ==================================================

def get_customer_product_queryset():

    active_variants = ProductVariant.objects.filter(
        is_active=True,
        color__is_active=True,
        color__is_deleted=False,
        size__is_active=True,
        size__is_deleted=False,
    ).select_related(
        "color",
        "size",
    )

    visible_images = ProductImage.objects.filter(
        Q(variant__isnull=True)
        |
        Q(
            variant__is_active=True,
            variant__color__is_active=True,
            variant__color__is_deleted=False,
            variant__size__is_active=True,
            variant__size__is_deleted=False,
        )
    )

    return Product.objects.filter(
        publication_status="published",
        is_published=True,
        is_active=True,
        is_deleted=False,
        category__is_active=True,
        category__is_deleted=False,
    ).select_related(
        "category"
    ).prefetch_related(
        Prefetch(
            "images",
            queryset=visible_images,
        ),
        Prefetch(
            "variants",
            queryset=active_variants,
        ),
    )


# ==================================================
# PAGINATION
# ==================================================

class ProductPagination(PageNumberPagination):

    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 50


# ==================================================
# 1. CATEGORY LIST AND CREATE
# ==================================================

class CategoryListCreateView(generics.ListCreateAPIView):

    serializer_class = CategorySerializer
    permission_classes = [IsActiveAdmin]
    pagination_class = ProductPagination

    filter_backends = [
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    search_fields = [
        "name",
        "description",
    ]

    ordering_fields = [
        "name",
        "display_order",
        "created_at",
    ]

    ordering = ["-created_at"]

    def get_queryset(self):

        return Category.objects.filter(
            is_deleted=False
        ).select_related(
            "parent"
        )


# ==================================================
# 2. CATEGORY RETRIEVE, UPDATE AND SOFT DELETE
# ==================================================

class CategoryDetailView(
    generics.RetrieveUpdateDestroyAPIView
):

    serializer_class = CategorySerializer
    permission_classes = [IsActiveAdmin]

    queryset = Category.objects.filter(
        is_deleted=False
    ).select_related(
        "parent"
    )

    def perform_destroy(self, instance):

        has_active_children = Category.objects.filter(
            parent=instance,
            is_deleted=False,
        ).exists()

        if has_active_children:
            raise ValidationError(
                "Cannot delete a category that has active subcategories."
            )

        instance.soft_delete()


# ==================================================
# 3. COLOR LIST AND CREATE
# ==================================================

class ColorListCreateView(generics.ListCreateAPIView):

    serializer_class = ColorSerializer
    permission_classes = [IsActiveAdmin]
    pagination_class = ProductPagination

    filter_backends = [
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    search_fields = ["name"]

    ordering_fields = [
        "name",
        "created_at",
    ]

    ordering = ["name"]

    def get_queryset(self):

        return Color.objects.filter(
            is_deleted=False
        )


# ==================================================
# 4. COLOR RETRIEVE, UPDATE AND SOFT DELETE
# ==================================================

class ColorDetailView(
    generics.RetrieveUpdateDestroyAPIView
):

    serializer_class = ColorSerializer
    permission_classes = [IsActiveAdmin]

    queryset = Color.objects.filter(
        is_deleted=False
    )

    def perform_destroy(self, instance):

        instance.soft_delete()


# ==================================================
# 5. SIZE LIST AND CREATE
# ==================================================

class SizeListCreateView(generics.ListCreateAPIView):

    serializer_class = SizeSerializer
    permission_classes = [IsActiveAdmin]
    pagination_class = ProductPagination

    filter_backends = [
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    search_fields = ["name"]

    ordering_fields = [
        "name",
        "display_order",
        "created_at",
    ]

    ordering = [
        "display_order",
        "name",
    ]

    def get_queryset(self):

        return Size.objects.filter(
            is_deleted=False
        )


# ==================================================
# 6. SIZE RETRIEVE, UPDATE AND SOFT DELETE
# ==================================================

class SizeDetailView(
    generics.RetrieveUpdateDestroyAPIView
):

    serializer_class = SizeSerializer
    permission_classes = [IsActiveAdmin]

    queryset = Size.objects.filter(
        is_deleted=False
    )

    def perform_destroy(self, instance):

        instance.soft_delete()


# ==================================================
# 7. PRODUCT LIST AND CREATE (ADMIN)
# ==================================================

class ProductListCreateView(generics.ListCreateAPIView):

    serializer_class = ProductSerializer
    permission_classes = [IsActiveAdmin]
    pagination_class = ProductPagination

    filter_backends = [
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    search_fields = [
        "name",
        "description",
        "brand",
        "material",
        "category__name",
    ]

    ordering_fields = [
        "name",
        "created_at",
        "updated_at",
    ]

    ordering = ["-created_at"]

    def get_queryset(self):

        queryset = Product.objects.filter(
            is_deleted=False
        ).select_related(
            "category"
        ).prefetch_related(
            "images",
            "variants__color",
            "variants__size",
        )

        # Filter by category
        category_id = get_integer_param(
            self.request,
            "category",
        )

        if category_id is not None:
            queryset = queryset.filter(
                category_id=category_id
            )

        # Filter by publication status
        publication_status = self.request.query_params.get(
            "publication_status"
        )

        if publication_status:

            valid_statuses = [
                "draft",
                "published",
                "unpublished",
            ]

            if publication_status not in valid_statuses:
                raise ValidationError({
                    "publication_status": (
                        "Invalid publication status."
                    )
                })

            queryset = queryset.filter(
                publication_status=publication_status
            )

        # Filter by published boolean
        published = get_boolean_param(
            self.request,
            "is_published",
        )

        if published is not None:
            queryset = queryset.filter(
                is_published=published
            )

        # Filter by active status
        active = get_boolean_param(
            self.request,
            "is_active",
        )

        if active is not None:
            queryset = queryset.filter(
                is_active=active
            )

        return queryset


# ==================================================
# 8. PRODUCT RETRIEVE, UPDATE AND SOFT DELETE
# ==================================================

class ProductDetailView(
    generics.RetrieveUpdateDestroyAPIView
):

    serializer_class = ProductSerializer
    permission_classes = [IsActiveAdmin]

    queryset = Product.objects.filter(
        is_deleted=False
    ).select_related(
        "category"
    ).prefetch_related(
        "images",
        "variants__color",
        "variants__size",
    )

    def perform_destroy(self, instance):

        instance.soft_delete()


# ==================================================
# 9. PRODUCT IMAGE LIST AND MULTIPLE IMAGE UPLOAD
# ==================================================

class ProductImageListCreateView(APIView):

    permission_classes = [IsActiveAdmin]

    parser_classes = [
        MultiPartParser,
        FormParser,
    ]

    def get(self, request):

        queryset = ProductImage.objects.select_related(
            "product",
            "variant__color",
            "variant__size",
        ).filter(
            product__is_deleted=False
        )

        product_id = get_integer_param(
            request,
            "product",
        )

        if product_id is not None:
            queryset = queryset.filter(
                product_id=product_id
            )

        serializer = ProductImageSerializer(
            queryset,
            many=True,
            context={"request": request},
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

    def post(self, request):

        product_id = request.data.get("product_id")
        images = request.FILES.getlist("images")
        variant_id = request.data.get("variant_id")
        alt_text = request.data.get("alt_text", "")

        is_primary = (
            str(
                request.data.get("is_primary", "false")
            ).lower() == "true"
        )

        display_order = request.data.get(
            "display_order",
            0,
        )

        # Validate product ID
        if not product_id:
            raise ValidationError({
                "product_id": "Product ID is required."
            })

        # Validate images
        if not images:
            raise ValidationError({
                "images": "Please upload at least one image."
            })

        # Validate display order
        try:
            display_order = int(display_order)

            if display_order < 0:
                raise ValueError

        except (ValueError, TypeError):
            raise ValidationError({
                "display_order": (
                    "Enter a valid non-negative integer."
                )
            })

        # Get product
        product = get_object_or_404(
            Product,
            pk=product_id,
            is_deleted=False,
        )

        if not product.is_active:
            raise ValidationError({
                "product": (
                    "Cannot upload images to an inactive product."
                )
            })

        # Validate variant if supplied
        if variant_id:

            get_object_or_404(
                ProductVariant,
                pk=variant_id,
                product=product,
                is_active=True,
            )

        created_images = []

        with transaction.atomic():

            for index, image in enumerate(images):

                image_data = {
                    "product": product.pk,
                    "variant": variant_id or None,
                    "image": image,
                    "alt_text": alt_text,
                    "is_primary": (
                        is_primary and index == 0
                    ),
                    "display_order": display_order + index,
                }

                serializer = ProductImageSerializer(
                    data=image_data,
                    context={"request": request},
                )

                serializer.is_valid(
                    raise_exception=True
                )

                serializer.save()

                created_images.append(
                    serializer.data
                )

        return Response(
            {
                "message": (
                    "Product images uploaded successfully."
                ),
                "count": len(created_images),
                "images": created_images,
            },
            status=status.HTTP_201_CREATED,
        )


# ==================================================
# 10. PRODUCT IMAGE RETRIEVE AND DELETE
# ==================================================

class ProductImageDetailView(
    generics.RetrieveDestroyAPIView
):

    serializer_class = ProductImageSerializer
    permission_classes = [IsActiveAdmin]

    queryset = ProductImage.objects.filter(
        product__is_deleted=False
    ).select_related(
        "product",
        "variant__color",
        "variant__size",
    )

    def perform_destroy(self, instance):

        product_id = instance.product_id
        was_primary = instance.is_primary
        image_file = instance.image

        with transaction.atomic():

            instance.delete()

            # If the primary image is deleted,
            # promote the next available image.
            if was_primary:

                next_image = ProductImage.objects.filter(
                    product_id=product_id
                ).order_by(
                    "display_order",
                    "created_at",
                ).first()

                if next_image:

                    ProductImage.objects.filter(
                        pk=next_image.pk
                    ).update(
                        is_primary=True
                    )

            # Delete the physical file only after
            # the database transaction succeeds.
            if image_file:

                transaction.on_commit(
                    lambda: image_file.delete(save=False)
                )


# ==================================================
# 11. PRODUCT VARIANT LIST AND CREATE
# ==================================================

class ProductVariantListCreateView(
    generics.ListCreateAPIView
):

    serializer_class = ProductVariantSerializer
    permission_classes = [IsActiveAdmin]
    pagination_class = ProductPagination

    filter_backends = [
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    search_fields = [
        "sku",
        "product__name",
        "color__name",
        "size__name",
    ]

    ordering_fields = [
        "regular_price",
        "sale_price",
        "stock",
        "created_at",
    ]

    ordering = ["-created_at"]

    def get_queryset(self):

        queryset = ProductVariant.objects.filter(
            product__is_deleted=False
        ).select_related(
            "product",
            "color",
            "size",
        )

        # Filter by product
        product_id = get_integer_param(
            self.request,
            "product",
        )

        if product_id is not None:
            queryset = queryset.filter(
                product_id=product_id
            )

        # Filter by color
        color_id = get_integer_param(
            self.request,
            "color",
        )

        if color_id is not None:
            queryset = queryset.filter(
                color_id=color_id
            )

        # Filter by size
        size_id = get_integer_param(
            self.request,
            "size",
        )

        if size_id is not None:
            queryset = queryset.filter(
                size_id=size_id
            )

        # Filter by active status
        active = get_boolean_param(
            self.request,
            "is_active",
        )

        if active is not None:
            queryset = queryset.filter(
                is_active=active
            )

        return queryset


# ==================================================
# 12. PRODUCT VARIANT RETRIEVE, UPDATE AND DEACTIVATE
# ==================================================

class ProductVariantDetailView(
    generics.RetrieveUpdateDestroyAPIView
):

    serializer_class = ProductVariantSerializer
    permission_classes = [IsActiveAdmin]

    queryset = ProductVariant.objects.filter(
        product__is_deleted=False
    ).select_related(
        "product",
        "color",
        "size",
    )

    def perform_destroy(self, instance):

        instance.is_active = False

        instance.save(
            update_fields=[
                "is_active",
                "updated_at",
            ]
        )


# ==================================================
# 13. CUSTOMER PRODUCT LIST
# ==================================================

class CustomerProductListView(generics.ListAPIView):

    serializer_class = ProductSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = ProductPagination

    filter_backends = [
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    search_fields = [
        "name",
        "description",
        "brand",
        "category__name",
    ]

    ordering_fields = [
        "name",
        "created_at",
    ]

    ordering = ["-created_at"]

    def get_queryset(self):

        queryset = get_customer_product_queryset()

        category_id = get_integer_param(
            self.request,
            "category",
        )

        if category_id is not None:
            queryset = queryset.filter(
                category_id=category_id
            )

        return queryset


# ==================================================
# 14. CUSTOMER PRODUCT DETAIL
# ==================================================

class CustomerProductDetailView(
    generics.RetrieveAPIView
):

    serializer_class = ProductSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):

        return get_customer_product_queryset()


# ==================================================
# 15. PRODUCT PRICE HISTORY
# ==================================================

class ProductPriceHistoryListView(
    generics.ListAPIView
):

    serializer_class = ProductPriceHistorySerializer
    permission_classes = [IsActiveAdmin]
    pagination_class = ProductPagination

    def get_queryset(self):

        queryset = ProductPriceHistory.objects.select_related(
            "variant",
            "variant__product",
            "variant__color",
            "variant__size",
        ).all()

        variant_id = get_integer_param(
            self.request,
            "variant",
        )

        if variant_id is not None:
            queryset = queryset.filter(
                variant_id=variant_id
            )

        return queryset

## ==================================================
# PUBLIC CUSTOMER CATEGORY LIST
# Only active and non-deleted categories are visible
# ==================================================

class CustomerCategoryListView(generics.ListAPIView):

    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):

        return Category.objects.filter(
            Q(parent__isnull=True) |
            Q(
                parent__is_active=True,
                parent__is_deleted=False
            ),
            is_active=True,
            is_deleted=False,
        ).select_related(
            "parent"
        ).order_by(
            "display_order",
            "name",
        )