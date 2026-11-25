
from io import BytesIO
import os

from PIL import (
    Image,
    ImageOps,
    UnidentifiedImageError,
)

from django.core.files.base import ContentFile


# ==========================================
# IMAGE PROCESSING SETTINGS
# ==========================================

MAX_IMAGE_DIMENSION = 2000

SUPPORTED_FORMATS = {
    "JPEG",
    "PNG",
    "WEBP",
}


# ==========================================
# RESIZE PRODUCT IMAGE
# ==========================================

def resize_product_image(image_file):
    """
    Resize uploaded product images without
    changing their aspect ratio.

    Supported formats:
    JPEG, PNG, WEBP

    Maximum dimensions:
    2000 x 2000 pixels
    """

    try:

        image_file.seek(0)

        with Image.open(image_file) as img:

            # Validate image format
            original_format = img.format

            if original_format not in SUPPORTED_FORMATS:
                raise ValueError(
                    "Only JPEG, PNG and WEBP images are supported."
                )

            # Correct image orientation using EXIF data
            img = ImageOps.exif_transpose(img)

            # Resize without changing aspect ratio
            img.thumbnail(
                (MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION),
                Image.Resampling.LANCZOS
            )

            # Convert image mode based on format
            if original_format == "JPEG":

                if img.mode not in ("RGB", "L"):
                    img = img.convert("RGB")

            elif original_format in ("PNG", "WEBP"):

                if img.mode not in ("RGB", "RGBA"):
                    img = img.convert("RGBA")

            # Save processed image in memory
            output = BytesIO()

            img.save(
                output,
                format=original_format,
                optimize=True
            )

            output.seek(0)

            # Preserve original filename
            filename = os.path.basename(image_file.name)

            return ContentFile(
                output.read(),
                name=filename
            )

    except (
        UnidentifiedImageError,
        Image.DecompressionBombError,
        OSError,
        ValueError,
    ) as error:

        raise ValueError(
            f"Unable to process product image: {error}"
        ) from error

    finally:

        image_file.seek(0)
