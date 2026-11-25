
from django.conf import settings
from django.core.mail import send_mail

from .otp_service import (
    EMAIL_VERIFICATION,
    PASSWORD_RESET,
)


def send_otp_email(user, otp, purpose):
    """
    Send OTP email for email verification or password reset.
    """

    if not user.email:
        raise ValueError("User email address is required.")

    username = user.first_name or user.username

    if purpose == EMAIL_VERIFICATION:
        subject = "STYLO - Email Verification OTP"

        message = (
            f"Hello {username},\n\n"
            "Welcome to STYLO!\n\n"
            f"Your email verification OTP is: {otp}\n\n"
            "This OTP is valid for 5 minutes.\n"
            "Please do not share this OTP with anyone.\n\n"
            "Thank you,\n"
            "STYLO Team"
        )

    elif purpose == PASSWORD_RESET:
        subject = "STYLO - Password Reset OTP"

        message = (
            f"Hello {username},\n\n"
            "We received a request to reset your STYLO password.\n\n"
            f"Your password reset OTP is: {otp}\n\n"
            "This OTP is valid for 5 minutes.\n"
            "If you did not request this, please ignore this email.\n\n"
            "Thank you,\n"
            "STYLO Team"
        )

    else:
        raise ValueError("Invalid email OTP purpose.")

    sent_count = send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )

    if sent_count != 1:
        raise RuntimeError("OTP email could not be sent.")

    return True
