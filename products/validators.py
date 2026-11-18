
from PIL import Image, UnidentifiedImageError
from django.core.exceptions import ValidationError


# ==========================================
# IMAGE VALIDATION SETTINGS
# ==========================================

MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB

ALLOWED_IMAGE_FORMATS = ["JPEG", "PNG", "WEBP"]

MIN_IMAGE_WIDTH = 300
MIN_IMAGE_HEIGHT = 300

MAX_IMAGE_WIDTH = 6000
MAX_IMAGE_HEIGHT = 6000


# ==========================================
# PRODUCT IMAGE VALIDATOR
# ==========================================

def validate_product_image(image):

    # 1. File size validation

    if image.size > MAX_IMAGE_SIZE:
        raise ValidationError(
            "Image size must not exceed 5 MB."
        )

    try:

        # Always read from the beginning of the file
        image.seek(0)

        # 2. Open and inspect actual image

        with Image.open(image) as img:

            # 3. Actual image format validation

            if img.format not in ALLOWED_IMAGE_FORMATS:
                raise ValidationError(
                    "Only JPG, PNG and WEBP images are allowed."
                )

            # 4. Image dimension validation

            width, height = img.size

            if (
                width < MIN_IMAGE_WIDTH
                or height < MIN_IMAGE_HEIGHT
            ):
                raise ValidationError(
                    "Image dimensions must be at least 300 x 300 pixels."
                )

            if (
                width > MAX_IMAGE_WIDTH
                or height > MAX_IMAGE_HEIGHT
            ):
                raise ValidationError(
                    "Image dimensions must not exceed 6000 x 6000 pixels."
                )

            # 5. Verify image integrity

            img.verify()

    except ValidationError:
        raise

    except (
        UnidentifiedImageError,
        Image.DecompressionBombError,
        OSError,
        ValueError,
    ):
        raise ValidationError(
            "Please upload a valid image file."
        )

    finally:

        # Reset file pointer

        image.seek(0)
