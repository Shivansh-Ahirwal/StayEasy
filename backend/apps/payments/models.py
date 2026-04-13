"""Payment records (Razorpay) — wired in Phase 2."""

from django.db import models

from apps.bookings.models import Booking


class Payment(models.Model):
    """One payment attempt per booking (extend for retries later)."""

    class Status(models.TextChoices):
        CREATED = 'created', 'Created'
        PAID = 'paid', 'Paid'
        FAILED = 'failed', 'Failed'

    booking = models.ForeignKey(
        Booking,
        on_delete=models.CASCADE,
        related_name='payments',
    )
    razorpay_order_id = models.CharField(max_length=255, blank=True)
    razorpay_payment_id = models.CharField(max_length=255, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.CREATED,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['booking']),
        ]
