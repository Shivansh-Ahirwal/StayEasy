"""Locations admin."""

from django.contrib import admin

from apps.locations.models import City, Country


@admin.register(Country)
class CountryAdmin(admin.ModelAdmin):
    list_display = ('name', 'iso_code')
    search_fields = ('name', 'iso_code')


@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ('name', 'country')
    list_filter = ('country',)
    search_fields = ('name', 'country__name')
    autocomplete_fields = ('country',)
