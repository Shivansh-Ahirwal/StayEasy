"""Serializers for countries and cities (read-only API)."""

from rest_framework import serializers

from apps.locations.models import City, Country


class CountrySerializer(serializers.ModelSerializer):
    """Country JSON."""

    class Meta:
        model = Country
        fields = ('id', 'name', 'iso_code')


class CitySerializer(serializers.ModelSerializer):
    """City with nested country."""

    country = CountrySerializer(read_only=True)

    class Meta:
        model = City
        fields = ('id', 'name', 'country')


class CityListSerializer(serializers.ModelSerializer):
    """Compact city for hotel payloads."""

    country_name = serializers.CharField(source='country.name', read_only=True)
    country_iso = serializers.CharField(source='country.iso_code', read_only=True)

    class Meta:
        model = City
        fields = ('id', 'name', 'country_name', 'country_iso')
