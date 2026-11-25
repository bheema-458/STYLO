
from django.contrib.auth import get_user_model
from django.db import transaction

from accounts.models import Address

User = get_user_model()


@transaction.atomic
def create_user_address(user, validated_data):
    # Lock the user to prevent concurrent default-address updates.
    locked_user = User.objects.select_for_update().get(pk=user.pk)

    has_address = Address.objects.filter(user=locked_user).exists()
    is_default = validated_data.get("is_default", False)

    # First address must always be the default address.
    if is_default or not has_address:
        Address.objects.filter(
            user=locked_user,
            is_default=True,
        ).update(is_default=False)

        validated_data["is_default"] = True

    return Address.objects.create(
        user=locked_user,
        **validated_data,
    )


@transaction.atomic
def update_user_address(address, validated_data):
    locked_user = User.objects.select_for_update().get(
        pk=address.user_id
    )

    locked_address = Address.objects.select_for_update().get(
        pk=address.pk,
        user=locked_user,
    )

    is_default = validated_data.get(
        "is_default",
        locked_address.is_default,
    )

    if is_default:
        # Remove default status from other addresses.
        Address.objects.filter(
            user=locked_user,
            is_default=True,
        ).exclude(pk=locked_address.pk).update(is_default=False)

    elif locked_address.is_default:
        # Do not leave the user without a default address.
        is_default = True

    for field, value in validated_data.items():
        setattr(locked_address, field, value)

    locked_address.is_default = is_default
    locked_address.save()

    return locked_address


@transaction.atomic
def delete_user_address(address):
    locked_user = User.objects.select_for_update().get(
        pk=address.user_id
    )

    locked_address = Address.objects.select_for_update().get(
        pk=address.pk,
        user=locked_user,
    )

    was_default = locked_address.is_default
    locked_address.delete()

    if was_default:
        next_address = (
            Address.objects.filter(user=locked_user)
            .order_by("-created_at", "-id")
            .first()
        )

        if next_address:
            next_address.is_default = True
            next_address.save(update_fields=["is_default"])

    return True
