
import logging

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from .models import PriceAlert, StockAlert


logger = logging.getLogger(__name__)


# ----------------------------------
# Price Drop Notifications
# ----------------------------------

def check_price_alerts():

    alerts = PriceAlert.objects.filter(
        is_active=True,
        notified_at__isnull=True
    ).select_related(
        "user",
        "variant",
        "variant__product",
        "variant__color"
    )

    notifications_sent = 0

    for alert in alerts:

        variant = alert.variant
        current_price = variant.current_price

        if current_price <= alert.target_price:

            if not alert.user.email:
                continue

            subject = "STYLO - Product Price Drop Alert"

            message = (
                f"Hello {alert.user.username},\n\n"
                f"Good news! The price of {variant.product.name} "
                f"has dropped.\n\n"
                f"Size: {variant.size}\n"
                f"Color: {variant.color.name}\n"
                f"Your target price: Rs. {alert.target_price}\n"
                f"Current price: Rs. {current_price}\n\n"
                "Visit STYLO and grab your favourite product!\n\n"
                "Thank you,\n"
                "STYLO Team"
            )

            try:
                sent = send_mail(
                    subject,
                    message,
                    settings.DEFAULT_FROM_EMAIL,
                    [alert.user.email],
                    fail_silently=False
                )

                if sent:
                    alert.notified_at = timezone.now()
                    alert.is_active = False

                    alert.save(
                        update_fields=[
                            "notified_at",
                            "is_active",
                            "updated_at"
                        ]
                    )

                    notifications_sent += 1

            except Exception:
                logger.exception(
                    "Price alert email failed. Alert ID: %s",
                    alert.id
                )

    return notifications_sent


# ----------------------------------
# Stock Availability Notifications
# ----------------------------------

def check_stock_alerts():

    alerts = StockAlert.objects.filter(
        is_active=True,
        notified_at__isnull=True
    ).select_related(
        "user",
        "variant",
        "variant__product",
        "variant__color"
    )

    notifications_sent = 0

    for alert in alerts:

        variant = alert.variant

        if variant.stock > 0:

            if not alert.user.email:
                continue

            subject = "STYLO - Product Back in Stock!"

            message = (
                f"Hello {alert.user.username},\n\n"
                f"Good news! {variant.product.name} "
                "is now available in stock.\n\n"
                f"Size: {variant.size}\n"
                f"Color: {variant.color.name}\n"
                f"Available stock: {variant.stock}\n"
                f"Current price: Rs. {variant.current_price}\n\n"
                "Visit STYLO and shop your favourite product!\n\n"
                "Thank you,\n"
                "STYLO Team"
            )

            try:
                sent = send_mail(
                    subject,
                    message,
                    settings.DEFAULT_FROM_EMAIL,
                    [alert.user.email],
                    fail_silently=False
                )

                if sent:
                    alert.notified_at = timezone.now()
                    alert.is_active = False

                    alert.save(
                        update_fields=[
                            "notified_at",
                            "is_active"
                        ]
                    )

                    notifications_sent += 1

            except Exception:
                logger.exception(
                    "Stock alert email failed. Alert ID: %s",
                    alert.id
                )

    return notifications_sent


# ----------------------------------
# Check All Notifications
# ----------------------------------

def check_all_alerts():

    price_count = check_price_alerts()
    stock_count = check_stock_alerts()

    return {
        "price_notifications_sent": price_count,
        "stock_notifications_sent": stock_count,
        "total_notifications_sent": price_count + stock_count,
    }
