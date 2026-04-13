"""Geography: countries and cities for hotel addressing."""

from django.db import models


class Country(models.Model):
    """Country (ISO code optional but recommended)."""

    name = models.CharField(max_length=128)
    iso_code = models.CharField(
        max_length=2,
        unique=True,
        help_text='ISO 3166-1 alpha-2, e.g. IN, US.',
    )

    class Meta:
        ordering = ['name']
        verbose_name_plural = 'countries'

    def __str__(self) -> str:
        return self.name


class City(models.Model):
    """City within a country."""

    country = models.ForeignKey(
        Country,
        on_delete=models.CASCADE,
        related_name='cities',
    )
    name = models.CharField(max_length=128)

    class Meta:
        ordering = ['country', 'name']
        constraints = [
            models.UniqueConstraint(
                fields=['country', 'name'],
                name='locations_city_unique_per_country',
            ),
        ]
        indexes = [
            models.Index(fields=['name']),
        ]

    def __str__(self) -> str:
        return f'{self.name}, {self.country.name}'
