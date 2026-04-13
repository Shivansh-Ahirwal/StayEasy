"""Hotel reviews."""

from django.conf import settings
from django.db import models

from apps.hotels.models import Hotel


class Review(models.Model):
    """User review for a hotel."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reviews',
    )
    hotel = models.ForeignKey(
        Hotel,
        on_delete=models.CASCADE,
        related_name='reviews',
    )
    rating = models.PositiveSmallIntegerField()
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'hotel'],
                name='unique_review_per_user_hotel',
            ),
        ]
        indexes = [
            models.Index(fields=['hotel']),
        ]
