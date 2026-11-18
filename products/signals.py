
from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver

from .models import ProductVariant, ProductPriceHistory


@receiver(pre_save, sender=ProductVariant)
def store_old_price(sender, instance, **kwargs):
    if instance.pk:
        old_variant = ProductVariant.objects.filter(pk=instance.pk).first()

        if old_variant:
            instance._old_price = old_variant.current_price
        else:
            instance._old_price = None
    else:
        instance._old_price = None


@receiver(post_save, sender=ProductVariant)
def record_price_history(sender, instance, created, **kwargs):
    old_price = getattr(instance, "_old_price", None)
    new_price = instance.current_price

    if created or old_price != new_price:
        ProductPriceHistory.objects.create(
            variant=instance,
            price=new_price
        )
