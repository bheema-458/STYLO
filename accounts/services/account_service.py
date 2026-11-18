
from django.contrib.auth import get_user_model
from django.db import transaction

from .otp_service import (
    EMAIL_VERIFICATION,
    create_otp,
    verify_otp,
    can_resend_otp,
    consume_otp,
)
from .email_service import send_otp_email


User = get_user_model()


@transaction.atomic
def send_email_verification(user):
    """Generate and send an email verification OTP."""

    locked_user = User.objects.select_for_update().get(pk=user.pk)

    if locked_user.is_email_verified:
        raise ValueError("Email is already verified.")

    otp, otp_record = create_otp(
        user=locked_user,
        purpose=EMAIL_VERIFICATION,
    )

    try:
        send_otp_email(
            user=locked_user,
            otp=otp,
            purpose=EMAIL_VERIFICATION,
        )
    except Exception:
        otp_record.delete()
        raise

    return True


@transaction.atomic
def verify_email_address(user, otp):
    """Verify customer's email address using OTP."""

    locked_user = User.objects.select_for_update().get(pk=user.pk)

    if locked_user.is_email_verified:
        return False, "Email is already verified."

    is_valid, message, _ = verify_otp(
        user=locked_user,
        raw_otp=otp,
        purpose=EMAIL_VERIFICATION,
    )

    if not is_valid:
        return False, message

    locked_user.is_email_verified = True
    locked_user.save(update_fields=["is_email_verified", "updated_at"])

    consume_otp(
        user=locked_user,
        purpose=EMAIL_VERIFICATION,
    )

    return True, "Email verified successfully. You can now log in."


@transaction.atomic
def resend_email_verification(user):
    """Resend verification OTP after checking cooldown."""

    locked_user = User.objects.select_for_update().get(pk=user.pk)

    if locked_user.is_email_verified:
        return False, "Email is already verified."

    if not can_resend_otp(
        user=locked_user,
        purpose=EMAIL_VERIFICATION,
    ):
        return False, "Please wait 60 seconds before requesting another OTP."

    send_email_verification(locked_user)

    return True, "Verification OTP sent successfully."
