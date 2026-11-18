
from decimal import Decimal

from django.db import models, transaction
from django.db.models import Q, F
from django.core.validators import MinValueValidator, RegexValidator
from django.core.exceptions import ValidationError
from django.utils.text import slugify
from django.utils import timezone
from .validators import validate_product_image
from .image_processing import resize_product_image


# --------------------------------------------------
# COMMON HELPER
# --------------------------------------------------

def generate_unique_slug(instance, value):

    base_slug = slugify(value) or "item"
    slug = base_slug
    counter = 1

    model = instance.__class__

    while model.objects.filter(
        slug=slug
    ).exclude(pk=instance.pk).exists():

        slug = f"{base_slug}-{counter}"
        counter += 1

    return slug


# --------------------------------------------------
# 1. CATEGORY
# --------------------------------------------------

class Category(models.Model):

    name = models.CharField(max_length=100)

    slug = models.SlugField(
        max_length=120,
        unique=True,
        blank=True
    )

    description = models.TextField(blank=True)

    image = models.ImageField(
        upload_to="categories/",
        blank=True,
        null=True
    )

    parent = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="subcategories"
    )

    display_order = models.PositiveIntegerField(default=0)

    is_active = models.BooleanField(default=True)
    is_deleted = models.BooleanField(default=False)

    deleted_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["display_order", "-created_at"]

        indexes = [
            models.Index(fields=["is_active", "is_deleted"]),
        ]

    def clean(self):

        if self.parent_id:

            if self.pk and self.parent_id == self.pk:
                raise ValidationError({
                    "parent": "A category cannot be its own parent."
                })

            parent = self.parent

            while parent:

                if self.pk and parent.pk == self.pk:
                    raise ValidationError({
                        "parent": "Circular category hierarchy is not allowed."
                    })

                parent = parent.parent

            if self.parent.is_deleted:
                raise ValidationError({
                    "parent": "Cannot select a deleted parent category."
                })

    def save(self, *args, **kwargs):

        if not self.slug:
            self.slug = generate_unique_slug(self, self.name)

        super().save(*args, **kwargs)

    def soft_delete(self):

        self.is_deleted = True
        self.is_active = False
        self.deleted_at = timezone.now()

        self.save(update_fields=[
            "is_deleted",
            "is_active",
            "deleted_at",
            "updated_at"
        ])

    def __str__(self):
        return self.name


# --------------------------------------------------
# 2. COLOR
# --------------------------------------------------

class Color(models.Model):

    name = models.CharField(max_length=50)

    hex_code = models.CharField(
        max_length=7,
        validators=[
            RegexValidator(
                regex=r"^#[0-9A-Fa-f]{6}$",
                message="Enter a valid HEX color code."
            )
        ]
    )

    is_active = models.BooleanField(default=True)
    is_deleted = models.BooleanField(default=False)

    deleted_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

        indexes = [
            models.Index(fields=["is_active", "is_deleted"]),
        ]

    def soft_delete(self):

        self.is_deleted = True
        self.is_active = False
        self.deleted_at = timezone.now()

        self.save(update_fields=[
            "is_deleted",
            "is_active",
            "deleted_at",
            "updated_at"
        ])

    def __str__(self):
        return f"{self.name} ({self.hex_code})"


# --------------------------------------------------
# 3. SIZE
# --------------------------------------------------

class Size(models.Model):

    name = models.CharField(max_length=20)

    display_order = models.PositiveIntegerField(default=0)

    is_active = models.BooleanField(default=True)
    is_deleted = models.BooleanField(default=False)

    deleted_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["display_order", "name"]

        indexes = [
            models.Index(fields=["is_active", "is_deleted"]),
        ]

    def soft_delete(self):

        self.is_deleted = True
        self.is_active = False
        self.deleted_at = timezone.now()

        self.save(update_fields=[
            "is_deleted",
            "is_active",
            "deleted_at",
            "updated_at"
        ])

    def __str__(self):
        return self.name


# --------------------------------------------------
# 4. PRODUCT
# --------------------------------------------------

class Product(models.Model):

    class PublicationStatus(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"
        UNPUBLISHED = "unpublished", "Unpublished"

    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True, blank=True)

    description = models.TextField()

    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="products"
    )

    brand = models.CharField(max_length=100, blank=True)
    material = models.CharField(max_length=150, blank=True)
    care_instructions = models.TextField(blank=True)

    highlights = models.JSONField(default=list, blank=True)

    # Publication management
    publication_status = models.CharField(
        max_length=20,
        choices=PublicationStatus.choices,
        default=PublicationStatus.DRAFT,
        db_index=True
    )

    # Old field retained for API/frontend compatibility
    is_published = models.BooleanField(default=False)

    published_at = models.DateTimeField(
        null=True,
        blank=True
    )

    is_active = models.BooleanField(default=True)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

        indexes = [
            models.Index(
                fields=["publication_status", "is_active", "is_deleted"],
                name="product_visibility_idx"
            ),
            models.Index(
                fields=["category", "publication_status"],
                name="product_category_pub_idx"
            ),
        ]

    def clean(self):
        super().clean()

        if self.category_id and self.category.is_deleted:
            raise ValidationError({
                "category": "Cannot assign a deleted category."
            })

    def save(self, *args, **kwargs):

        # Generate unique slug
        if not self.slug:
            self.slug = generate_unique_slug(self, self.name)

        # Keep old Boolean field and new status synchronized
        if self.pk:
            old = Product.objects.filter(pk=self.pk).values(
                "is_published",
                "publication_status"
            ).first()

            if old:
                status_changed = (
                    self.publication_status != old["publication_status"]
                )
                boolean_changed = (
                    self.is_published != old["is_published"]
                )

                if status_changed:
                    self.is_published = (
                        self.publication_status
                        == self.PublicationStatus.PUBLISHED
                    )

                elif boolean_changed:
                    self.publication_status = (
                        self.PublicationStatus.PUBLISHED
                        if self.is_published
                        else self.PublicationStatus.UNPUBLISHED
                    )

        else:
            # Support old code that creates products using is_published=True
            if self.is_published:
                self.publication_status = self.PublicationStatus.PUBLISHED

        # Set publication timestamp when publishing
        if self.publication_status == self.PublicationStatus.PUBLISHED:
            if not self.published_at:
                self.published_at = timezone.now()

            self.is_published = True
        else:
            self.is_published = False

        super().save(*args, **kwargs)

    def soft_delete(self):
        self.is_deleted = True
        self.is_active = False
        self.is_published = False
        self.publication_status = self.PublicationStatus.UNPUBLISHED
        self.deleted_at = timezone.now()

        self.save(update_fields=[
            "is_deleted",
            "is_active",
            "is_published",
            "publication_status",
            "deleted_at",
            "updated_at"
        ])

    def __str__(self):
        return self.name

# --------------------------------------------------
# 5. PRODUCT VARIANT
# --------------------------------------------------

class ProductVariant(models.Model):

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="variants"
    )

    color = models.ForeignKey(
        Color,
        on_delete=models.PROTECT,
        related_name="product_variants"
    )

    size = models.ForeignKey(
        Size,
        on_delete=models.PROTECT,
        related_name="product_variants"
    )

    sku = models.CharField(
        max_length=100,
        unique=True
    )

    regular_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.01"))
        ]
    )

    sale_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[
            MinValueValidator(Decimal("0.01"))
        ]
    )

    stock = models.PositiveIntegerField(default=0)

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:

        ordering = [
            "product",
            "color",
            "size__display_order"
        ]

        constraints = [

            models.UniqueConstraint(
                fields=["product", "color", "size"],
                name="unique_product_color_size"
            ),

            models.CheckConstraint(
                condition=Q(regular_price__gt=0),
                name="regular_price_must_be_positive"
            ),

            models.CheckConstraint(
                condition=(
                    Q(sale_price__isnull=True) |
                    (
                        Q(sale_price__gt=0) &
                        Q(sale_price__lt=F("regular_price"))
                    )
                ),
                name="sale_price_less_than_regular_price"
            ),
        ]

        indexes = [
            models.Index(fields=["product", "is_active"]),
            models.Index(fields=["stock"]),
        ]

    def clean(self):

        errors = {}

        if (
            self.sale_price is not None
            and self.regular_price is not None
            and self.sale_price >= self.regular_price
        ):
            errors["sale_price"] = (
                "Sale price must be less than regular price."
            )

        if self.color_id and self.color.is_deleted:
            errors["color"] = "Cannot select a deleted color."

        if self.size_id and self.size.is_deleted:
            errors["size"] = "Cannot select a deleted size."

        if self.product_id and self.product.is_deleted:
            errors["product"] = "Cannot add variants to a deleted product."

        if errors:
            raise ValidationError(errors)

    @property
    def current_price(self):

        return (
            self.sale_price
            if self.sale_price is not None
            else self.regular_price
        )

    @property
    def is_in_stock(self):
        return self.stock > 0

    def __str__(self):

        return (
            f"{self.product.name} - "
            f"{self.color.name} - "
            f"{self.size.name}"
        )


# --------------------------------------------------
# 6. PRODUCT IMAGE
# --------------------------------------------------


class ProductImage(models.Model):

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="images"
    )

    variant = models.ForeignKey(
        ProductVariant,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="images"
    )

    image = models.ImageField(
        upload_to="products/",
        validators=[validate_product_image]
    )

    alt_text = models.CharField(max_length=200, blank=True)

    is_primary = models.BooleanField(default=False)

    display_order = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["display_order", "-created_at"]

        constraints = [
            models.UniqueConstraint(
                fields=["product"],
                condition=Q(is_primary=True),
                name="unique_primary_image_per_product"
            ),
        ]

        indexes = [
            models.Index(fields=["product", "display_order"]),
        ]

    def clean(self):
        super().clean()

        if (
            self.variant_id
            and self.product_id
            and self.variant.product_id != self.product_id
        ):
            raise ValidationError({
                "variant": (
                    "The selected variant must belong to this product."
                )
            })

    def save(self, *args, **kwargs):
        self.full_clean()

        # Check whether this is a new image or a changed image
        image_changed = self._state.adding

        if not self._state.adding and self.pk:
            old_image = (
                ProductImage.objects
                .filter(pk=self.pk)
                .values_list("image", flat=True)
                .first()
            )

            image_changed = (
                bool(self.image)
                and self.image.name != old_image
            )

        # Resize only newly uploaded or changed images
        if image_changed and self.image:
            processed_image = resize_product_image(self.image)

            self.image.save(
                self.image.name,
                processed_image,
                save=False
            )

        with transaction.atomic():

            if self.is_primary:
                ProductImage.objects.filter(
                    product_id=self.product_id,
                    is_primary=True
                ).exclude(
                    pk=self.pk
                ).update(is_primary=False)

            super().save(*args, **kwargs)

    def __str__(self):
        return f"Image for {self.product.name}"


# --------------------------------------------------
# 7. PRODUCT PRICE HISTORY
# --------------------------------------------------

class ProductPriceHistory(models.Model):

    variant = models.ForeignKey(
        ProductVariant,
        on_delete=models.CASCADE,
        related_name="price_history"
    )

    price = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-recorded_at"]

    def __str__(self):
        return f"{self.variant.sku} - Rs. {self.price}"
