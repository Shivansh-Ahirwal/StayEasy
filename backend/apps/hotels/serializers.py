"""Hotel and room serializers."""

from rest_framework import serializers

from apps.hotels.models import Amenity, Hotel, Room
from apps.locations.models import City
from apps.locations.serializers import CityListSerializer


class AmenitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Amenity
        fields = ('id', 'name', 'icon', 'category')


class RoomSerializer(serializers.ModelSerializer):
    """Room type JSON."""

    class Meta:
        model = Room
        fields = (
            'id',
            'hotel',
            'type',
            'price',
            'total_rooms',
            'created_at',
        )
        read_only_fields = ('created_at',)


class HotelSerializer(serializers.ModelSerializer):
    """Hotel with nested rooms (read) and city (read/write id)."""

    rooms = RoomSerializer(many=True, read_only=True)
    city = CityListSerializer(read_only=True)
    city_id = serializers.PrimaryKeyRelatedField(
        queryset=City.objects.select_related('country').all(),
        source='city',
        write_only=True,
    )
    location = serializers.SerializerMethodField()
    review_count = serializers.IntegerField(read_only=True, default=0)
    amenities = AmenitySerializer(many=True, read_only=True)

    class Meta:
        model = Hotel
        fields = (
            'id',
            'manager',
            'name',
            'oyo_id',
            'latitude',
            'longitude',
            'city',
            'city_id',
            'address_line',
            'location',
            'description',
            'rating',
            'review_count',
            'created_at',
            'rooms',
            'amenities',
        )
        read_only_fields = (
            'manager',
            'rating',
            'review_count',
            'created_at',
            'rooms',
            'location',
            'oyo_id',
            'latitude',
            'longitude',
            'amenities',
        )

    def get_location(self, obj):
        """Single-line address for maps and legacy clients."""
        parts = []
        if obj.address_line:
            parts.append(obj.address_line.strip())
        parts.append(obj.city.name)
        parts.append(obj.city.country.name)
        return ', '.join(parts)


class HotelListSerializer(serializers.ModelSerializer):
    """List hotels without room payload."""

    city = CityListSerializer(read_only=True)
    location = serializers.SerializerMethodField()
    min_room_price = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        read_only=True,
        allow_null=True,
    )
    review_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Hotel
        fields = (
            'id',
            'name',
            'oyo_id',
            'latitude',
            'longitude',
            'city',
            'address_line',
            'location',
            'description',
            'rating',
            'review_count',
            'min_room_price',
            'created_at',
        )
        read_only_fields = fields

    def get_location(self, obj):
        parts = []
        if obj.address_line:
            parts.append(obj.address_line.strip())
        parts.append(obj.city.name)
        parts.append(obj.city.country.name)
        return ', '.join(parts)
