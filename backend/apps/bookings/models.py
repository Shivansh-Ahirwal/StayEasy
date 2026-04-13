"""Guest reservations."""

from django.conf import settings
from django.db import models

from apps.hotels.models import Room


class Booking(models.Model):
    """Stay reservation for a room type with date range."""

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        CONFIRMED = 'confirmed', 'Confirmed'
        CANCELLED = 'cancelled', 'Cancelled'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='bookings',
    )
    room = models.ForeignKey(
        Room,
        on_delete=models.CASCADE,
        related_name='bookings',
    )
    check_in = models.DateField()
    check_out = models.DateField()
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    total_price = models.DecimalField(max_digits=12, decimal_places=2)
    checked_in_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When the guest was marked checked in (on-site).',
    )
    checked_out_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When the guest was marked checked out.',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['room']),
            models.Index(fields=['status', 'check_in', 'check_out']),
        ]

    def __str__(self) -> str:
        return f'Booking {self.pk} ({self.status})'
