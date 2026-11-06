
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    email = models.EmailField(unique=True)

    phone_number = models.CharField(
        max_length=15,
        blank=True
    )
    profile_image = models.ImageField(
    upload_to="profile_images/",
    blank=True,
    null=True
)

    is_blocked = models.BooleanField(default=False)
    is_email_verified = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.username


class Address(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="addresses"
    )

    full_name = models.CharField(max_length=100)
    phone_number = models.CharField(max_length=15)
    address_line = models.CharField(max_length=255)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    pincode = models.CharField(max_length=10)

    is_default = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.full_name} - {self.city}"


class EmailOTP(models.Model):

    PURPOSE_CHOICES = [
        ("email_verification", "Email Verification"),
        ("password_reset", "Password Reset"),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="email_otps"
    )

    otp = models.CharField(max_length=128)

    purpose = models.CharField(
        max_length=30,
        choices=PURPOSE_CHOICES,
        default="email_verification",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    is_verified = models.BooleanField(default=False)

    attempts = models.PositiveSmallIntegerField(default=0)

    def __str__(self):
        return f"OTP for {self.user.email} - {self.purpose}"
