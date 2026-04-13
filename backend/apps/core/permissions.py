"""DRF permission helpers."""

from rest_framework.permissions import BasePermission

from apps.users.models import User


class IsManager(BasePermission):
    """Hotel create/update for managers and admins."""

    def has_permission(self, request, view):
        u = request.user
        return bool(
            u
            and u.is_authenticated
            and getattr(u, 'role', None)
            in (User.Role.MANAGER, User.Role.ADMIN)
        )


class IsAdmin(BasePermission):
    """Full control (future admin tools)."""

    def has_permission(self, request, view):
        u = request.user
        return bool(
            u and u.is_authenticated and getattr(u, 'role', None) == User.Role.ADMIN
        )
