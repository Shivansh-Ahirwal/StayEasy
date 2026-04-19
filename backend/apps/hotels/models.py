"""Hotels and room inventory."""

from django.conf import settings
from django.db import models


class Amenity(models.Model):
    """A single property amenity (e.g. WiFi, Pool)."""

    name = models.CharField(max_length=100, unique=True)
    icon = models.CharField(
        max_length=10,
        blank=True,
        help_text='Emoji icon displayed on the UI.',
    )
    category = models.CharField(
        max_length=50,
        blank=True,
        help_text='Grouping label, e.g. "Connectivity", "Food".',
    )

    class Meta:
        ordering = ['category', 'name']
        verbose_name_plural = 'amenities'

    def __str__(self) -> str:
        return f'{self.icon} {self.name}'.strip()


class Hotel(models.Model):
    """Property managed by a single manager."""

    manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='managed_hotels',
    )
    name = models.CharField(max_length=255)
    oyo_id = models.PositiveIntegerField(
        null=True,
        blank=True,
        unique=True,
        db_index=True,
        help_text='Original OYO property id when imported from CSV.',
    )
    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
    )
    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
    )
    city = models.ForeignKey(
        'locations.City',
        on_delete=models.PROTECT,
        related_name='hotels',
    )
    address_line = models.CharField(
        max_length=255,
        blank=True,
        help_text='Street, area, or landmark (optional).',
    )
    description = models.TextField(blank=True)
    amenities = models.ManyToManyField(
        Amenity,
        blank=True,
        related_name='hotels',
    )
    rating = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=0,
        help_text='Average rating cache; updated from reviews.',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['city']),
        ]

    def __str__(self) -> str:
        return self.name


class Room(models.Model):
    """Room type / inventory bucket for a hotel."""

    hotel = models.ForeignKey(
        Hotel,
        on_delete=models.CASCADE,
        related_name='rooms',
    )
    type = models.CharField(max_length=100)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    total_rooms = models.PositiveIntegerField(
        default=1,
        help_text='How many bookable units of this type exist.',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['hotel', 'type']
        indexes = [
            models.Index(fields=['hotel']),
        ]

    def __str__(self) -> str:
        return f'{self.hotel.name} — {self.type}'


class HotelImage(models.Model):
    """Photo URL for a property (manager-managed)."""

    hotel = models.ForeignKey(
        Hotel,
        on_delete=models.CASCADE,
        related_name='images',
    )
    url = models.URLField(max_length=500)
    caption = models.CharField(max_length=200, blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['hotel', 'sort_order', 'id']

    def __str__(self) -> str:
        return f'Image {self.pk} ({self.hotel.name})'


class RoomImage(models.Model):
    """Photo URL for a room type (manager-managed)."""

    room = models.ForeignKey(
        Room,
        on_delete=models.CASCADE,
        related_name='images',
    )
    url = models.URLField(max_length=500)
    caption = models.CharField(max_length=200, blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['room', 'sort_order', 'id']

    def __str__(self) -> str:
        return f'Room image {self.pk} ({self.room})'
