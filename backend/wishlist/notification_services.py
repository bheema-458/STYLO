
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from .models import (
    Notification,
    PriceAlert,
    StockAlert,
)


# ==========================================
# COMMON EMAIL FUNCTION
# ==========================================

def send_alert_email(user, subject, message):

    if not user.email:
        return

    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=True,
    )


# ==========================================
# PRICE ALERT NOTIFICATION
# ==========================================

def process_price_alerts(variant):

    current_price = variant.current_price

    if current_price is None:
        return

    alerts = PriceAlert.objects.filter(
        variant=variant,
        is_active=True,
        notified_at__isnull=True,
        target_price__gte=current_price,
    ).select_related(
        "user",
        "variant__product",
        "variant__color",
        "variant__size",
    )

    for alert in alerts:

        product_name = variant.product.name

        title = "Price Drop Alert!"

        message = (
            f"Good news! {product_name} is now available "
            f"at ₹{current_price}. "
            f"Your target price was ₹{alert.target_price}."
        )

        Notification.objects.create(
            user=alert.user,
            title=title,
            message=message,
            notification_type="price_drop",
        )

        send_alert_email(
            user=alert.user,
            subject=title,
            message=message,
        )

        alert.is_active = False
        alert.notified_at = timezone.now()

        alert.save(
            update_fields=[
                "is_active",
                "notified_at",
                "updated_at",
            ]
        )


# ==========================================
# STOCK ALERT NOTIFICATION
# ==========================================

def process_stock_alerts(variant):

    if variant.stock <= 0:
        return

    alerts = StockAlert.objects.filter(
        variant=variant,
        is_active=True,
        notified_at__isnull=True,
    ).select_related(
        "user",
        "variant__product",
        "variant__color",
        "variant__size",
    )

    for alert in alerts:

        product_name = variant.product.name

        title = "Back in Stock!"

        message = (
            f"Good news! {product_name} is back in stock. "
            f"Size: {variant.size.name}, "
            f"Color: {variant.color.name}."
        )

        Notification.objects.create(
            user=alert.user,
            title=title,
            message=message,
            notification_type="stock_available",
        )

        send_alert_email(
            user=alert.user,
            subject=title,
            message=message,
        )

        alert.is_active = False
        alert.notified_at = timezone.now()

        alert.save(
            update_fields=[
                "is_active",
                "notified_at",
            ]
        )
