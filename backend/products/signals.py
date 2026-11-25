
from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver

from .models import ProductVariant, ProductPriceHistory


# ==========================================
# 1. STORE OLD PRICE AND STOCK
# ==========================================

@receiver(pre_save, sender=ProductVariant)
def store_old_variant_values(sender, instance, **kwargs):

    if instance.pk:

        old_variant = ProductVariant.objects.filter(
            pk=instance.pk
        ).first()

        if old_variant:
            instance._old_price = old_variant.current_price
            instance._old_stock = old_variant.stock

        else:
            instance._old_price = None
            instance._old_stock = None

    else:
        instance._old_price = None
        instance._old_stock = None


# ==========================================
# 2. RECORD PRICE HISTORY
# ==========================================

@receiver(post_save, sender=ProductVariant)
def record_price_history(sender, instance, created, **kwargs):

    old_price = getattr(instance, "_old_price", None)
    new_price = instance.current_price

    if created or old_price != new_price:

        ProductPriceHistory.objects.create(
            variant=instance,
            price=new_price
        )


# ==========================================
# 3. TRIGGER PRICE ALERT
# ==========================================

@receiver(post_save, sender=ProductVariant)
def trigger_price_alert(sender, instance, created, **kwargs):

    if created:
        return

    old_price = getattr(instance, "_old_price", None)
    new_price = instance.current_price

    if old_price is not None and new_price < old_price:

        from wishlist.notification_services import (
            process_price_alerts
        )

        process_price_alerts(instance)


# ==========================================
# 4. TRIGGER STOCK ALERT
# ==========================================

@receiver(post_save, sender=ProductVariant)
def trigger_stock_alert(sender, instance, created, **kwargs):

    if created:
        return

    old_stock = getattr(instance, "_old_stock", None)
    new_stock = instance.stock

    if old_stock == 0 and new_stock > 0:

        from wishlist.notification_services import (
            process_stock_alerts
        )

        process_stock_alerts(instance)
