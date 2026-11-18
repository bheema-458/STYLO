
import secrets
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password, check_password
from django.db import transaction
from django.utils import timezone

from accounts.models import EmailOTP


User = get_user_model()


# OTP Configuration
OTP_LENGTH = 6
OTP_EXPIRY_MINUTES = 5
OTP_MAX_ATTEMPTS = 5
OTP_RESEND_COOLDOWN_SECONDS = 60

# OTP purposes
EMAIL_VERIFICATION = "email_verification"
PASSWORD_RESET = "password_reset"

VALID_OTP_PURPOSES = [
    EMAIL_VERIFICATION,
    PASSWORD_RESET,
]


def validate_otp_purpose(purpose):
    if purpose not in VALID_OTP_PURPOSES:
        raise ValueError("Invalid OTP purpose.")


def generate_otp():
    """Generate a cryptographically secure six-digit OTP."""
    return f"{secrets.randbelow(10 ** OTP_LENGTH):0{OTP_LENGTH}d}"


@transaction.atomic
def create_otp(user, purpose):
    """Create and store a new hashed OTP."""

    validate_otp_purpose(purpose)

    # Lock the user to prevent concurrent OTP creation.
    User.objects.select_for_update().get(pk=user.pk)

    # Remove previous active OTPs for this purpose.
    EmailOTP.objects.filter(
        user=user,
        purpose=purpose,
        is_verified=False,
    ).delete()

    raw_otp = generate_otp()

    otp_record = EmailOTP.objects.create(
        user=user,
        otp=make_password(raw_otp),
        purpose=purpose,
        expires_at=timezone.now() + timedelta(
            minutes=OTP_EXPIRY_MINUTES
        ),
    )

    return raw_otp, otp_record


def get_latest_otp(user, purpose):
    """Return the latest unverified OTP."""

    validate_otp_purpose(purpose)

    return EmailOTP.objects.filter(
        user=user,
        purpose=purpose,
        is_verified=False,
    ).order_by("-created_at", "-id").first()


def can_resend_otp(user, purpose):
    """Check the OTP resend cooldown."""

    latest_otp = get_latest_otp(user, purpose)

    if latest_otp is None:
        return True

    elapsed_seconds = (
        timezone.now() - latest_otp.created_at
    ).total_seconds()

    return elapsed_seconds >= OTP_RESEND_COOLDOWN_SECONDS


@transaction.atomic
def verify_otp(user, raw_otp, purpose):
    """Verify OTP with expiry and attempt protection."""

    validate_otp_purpose(purpose)

    # Lock user first to maintain consistent lock ordering.
    User.objects.select_for_update().get(pk=user.pk)

    otp_record = (
        EmailOTP.objects.select_for_update()
        .filter(
            user=user,
            purpose=purpose,
            is_verified=False,
        )
        .order_by("-created_at", "-id")
        .first()
    )

    if otp_record is None:
        return (
            False,
            "No active OTP found. Please request a new OTP.",
            None,
        )

    if timezone.now() >= otp_record.expires_at:
        otp_record.delete()
        return False, "OTP expired. Please request a new OTP.", None

    if otp_record.attempts >= OTP_MAX_ATTEMPTS:
        otp_record.delete()
        return False, "Too many attempts. Please request a new OTP.", None

    # Validate OTP format.
    if (
        not isinstance(raw_otp, str)
        or len(raw_otp) != OTP_LENGTH
        or not raw_otp.isdigit()
    ):
        otp_record.attempts += 1
        otp_record.save(update_fields=["attempts"])

        return False, "Invalid OTP. Please try again.", None

    otp_record.attempts += 1

    if not check_password(raw_otp, otp_record.otp):
        otp_record.save(update_fields=["attempts"])
        return False, "Invalid OTP. Please try again.", None

    otp_record.is_verified = True
    otp_record.save(
        update_fields=["attempts", "is_verified"]
    )

    return True, "OTP verified successfully.", otp_record


@transaction.atomic
def consume_otp(user, purpose):
    """Delete OTP records after successful completion."""

    validate_otp_purpose(purpose)

    EmailOTP.objects.filter(
        user=user,
        purpose=purpose,
    ).delete()


def delete_expired_otps():
    """Delete expired OTP records."""

    deleted_count, _ = EmailOTP.objects.filter(
        expires_at__lte=timezone.now()
    ).delete()

    return deleted_count
