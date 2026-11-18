
from rest_framework.permissions import BasePermission


class IsActiveUser(BasePermission):
    """
    Allow authenticated, active and non-blocked users.

    Customers must have verified email.
    Staff and superusers do not require email verification.
    """

    message = "Your account is inactive, blocked, or not verified."

    def has_permission(self, request, view):
        user = request.user

        if not user.is_authenticated:
            return False

        if not user.is_active or user.is_blocked:
            return False

        if user.is_staff or user.is_superuser:
            return True

        return user.is_email_verified


class IsAdminUser(BasePermission):
    """
    Allow only active, non-blocked staff members
    and superusers.
    """

    message = "Admin permission is required."

    def has_permission(self, request, view):
        user = request.user

        return (
            user.is_authenticated
            and user.is_active
            and not user.is_blocked
            and (user.is_staff or user.is_superuser)
        )
