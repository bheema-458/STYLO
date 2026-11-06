
from rest_framework.permissions import BasePermission


class IsActiveCustomer(BasePermission):
    def has_permission(self, request, view):
        user = request.user

        return (
            user.is_authenticated
            and user.is_active
            and not user.is_blocked
            and (
                user.is_staff
                or user.is_superuser
                or user.is_email_verified
            )
        )
class IsAdminUser(BasePermission):
    def has_permission(self, request, view):
        user = request.user

        return (
            user.is_authenticated
            and user.is_active
            and not user.is_blocked
            and (
                user.is_staff
                or user.is_superuser
            )
        )