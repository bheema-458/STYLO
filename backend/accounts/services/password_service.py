
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import transaction

from .otp_service import (
    PASSWORD_RESET,
    create_otp,
    verify_otp,
    consume_otp,
)
from .email_service import send_otp_email


User = get_user_model()


@transaction.atomic
def send_password_reset_otp(user):
    """Generate and send a password reset OTP."""

    locked_user = User.objects.select_for_update().get(pk=user.pk)

    if not locked_user.is_active:
        raise ValueError("This account is not active.")

    if not locked_user.is_email_verified:
        raise ValueError("Email address is not verified.")

    if locked_user.is_blocked:
        raise ValueError("This account is blocked.")

    otp, otp_record = create_otp(
        user=locked_user,
        purpose=PASSWORD_RESET,
    )

    try:
        send_otp_email(
            user=locked_user,
            otp=otp,
            purpose=PASSWORD_RESET,
        )
    except Exception:
        otp_record.delete()
        raise

    return True


@transaction.atomic
def reset_user_password(user, otp, new_password):
    """Verify reset OTP and update the user's password."""

    locked_user = User.objects.select_for_update().get(pk=user.pk)

    # Check account status
    if (
        not locked_user.is_active
        or not locked_user.is_email_verified
        or locked_user.is_blocked
    ):
        return False, "Invalid or expired OTP."

    # Validate the new password
    try:
        validate_password(new_password, user=locked_user)

    except ValidationError as error:
        return False, " ".join(error.messages)

    # Verify password reset OTP
    is_valid, message, _ = verify_otp(
        user=locked_user,
        raw_otp=otp,
        purpose=PASSWORD_RESET,
    )

    if not is_valid:
        return False, message

    # Update password securely
    locked_user.set_password(new_password)

    locked_user.save(
        update_fields=["password", "updated_at"]
    )

    # Remove password reset OTP records
    consume_otp(
        user=locked_user,
        purpose=PASSWORD_RESET,
    )

    return True, (
        "Password reset successfully. "
        "Please log in with your new password."
    )


@transaction.atomic
def change_user_password(user, new_password):
    """Change password for an authenticated user."""

    locked_user = User.objects.select_for_update().get(pk=user.pk)

    # Check account status
    if not locked_user.is_active or locked_user.is_blocked:
        return False, "Account is not active."

    # Validate the new password
    try:
        validate_password(new_password, user=locked_user)

    except ValidationError as error:
        return False, " ".join(error.messages)

    # Update password securely
    locked_user.set_password(new_password)

    locked_user.save(
        update_fields=["password", "updated_at"]
    )

    # Invalidate outstanding password reset OTPs
    consume_otp(
        user=locked_user,
        purpose=PASSWORD_RESET,
    )

    return True, "Password changed successfully."
