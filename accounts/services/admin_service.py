
from django.contrib.auth import get_user_model
from django.db import transaction

User = get_user_model()


@transaction.atomic
def update_user_block_status(admin_user, target_user_id, is_blocked):

    # Validate the block status.
    if not isinstance(is_blocked, bool):
        return False, "Invalid block status.", None

    # Lock the target user to prevent concurrent updates.
    target_user = (
        User.objects.select_for_update()
        .filter(id=target_user_id)
        .first()
    )

    # Check whether the target user exists.
    if target_user is None:
        return False, "User not found.", None

    # Prevent admins from blocking their own accounts.
    if target_user.id == admin_user.id:
        return False, "You cannot block your own account.", None

    # Protect staff and superuser accounts.
    if target_user.is_staff or target_user.is_superuser:
        return False, "Admin accounts cannot be blocked here.", None

    # Avoid unnecessary database updates.
    if target_user.is_blocked == is_blocked:
        message = (
            "User is already blocked."
            if is_blocked
            else "User is already active."
        )
        return True, message, target_user

    # Update the user's block status.
    target_user.is_blocked = is_blocked

    target_user.save(
        update_fields=["is_blocked", "updated_at"]
    )

    message = (
        "User blocked successfully."
        if is_blocked
        else "User unblocked successfully."
    )

    return True, message, target_user
