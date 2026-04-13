"""Custom user with email login and role-based access."""

from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Application user; managers own hotels."""

    class Role(models.TextChoices):
        USER = 'user', 'User'
        MANAGER = 'manager', 'Manager'
        ADMIN = 'admin', 'Admin'

    email = models.EmailField('email address', unique=True, db_index=True)
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.USER,
    )

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    class Meta:
        ordering = ['-date_joined']

    def save(self, *args, **kwargs):
        if not self.username:
            self.username = self.email
        super().save(*args, **kwargs)
