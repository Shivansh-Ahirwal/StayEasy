"""Serializers for hotel manager dashboard APIs."""

from rest_framework import serializers

from apps.hotels.models import Hotel, HotelImage, Room, RoomImage
from apps.locations.serializers import CityListSerializer


class HotelImageSerializer(serializers.ModelSerializer):
    """Hotel photo (URL)."""

    class Meta:
        model = HotelImage
        fields = (
            'id',
            'hotel',
            'url',
            'caption',
            'sort_order',
            'created_at',
        )
        read_only_fields = ('id', 'hotel', 'created_at')


class HotelImageWriteSerializer(serializers.ModelSerializer):
    """Create hotel image."""

    class Meta:
        model = HotelImage
        fields = ('url', 'caption', 'sort_order')


class RoomImageSerializer(serializers.ModelSerializer):
    """Room-type photo (URL)."""

    class Meta:
        model = RoomImage
        fields = (
            'id',
            'room',
            'url',
            'caption',
            'sort_order',
            'created_at',
        )
        read_only_fields = ('id', 'room', 'created_at')


class RoomImageWriteSerializer(serializers.ModelSerializer):
    """Create room image."""

    class Meta:
        model = RoomImage
        fields = ('url', 'caption', 'sort_order')


class ManagerRoomSerializer(serializers.ModelSerializer):
    """Room with nested images for manager UI."""

    images = RoomImageSerializer(many=True, read_only=True)

    class Meta:
        model = Room
        fields = (
            'id',
            'hotel',
            'type',
            'price',
            'total_rooms',
            'created_at',
            'images',
        )
        read_only_fields = ('id', 'hotel', 'created_at', 'images')


class ManagerRoomPatchSerializer(serializers.ModelSerializer):
    """Partial update: pricing and inventory."""

    class Meta:
        model = Room
        fields = ('type', 'price', 'total_rooms')


class ManagerHotelSummarySerializer(serializers.ModelSerializer):
    """Hotel picker row."""

    city_name = serializers.CharField(source='city.name', read_only=True)
    room_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Hotel
        fields = (
            'id',
            'name',
            'city_name',
            'address_line',
            'room_count',
        )
        read_only_fields = fields


class ManagerHotelDetailSerializer(serializers.ModelSerializer):
    """Full property for manager dashboard."""

    city = CityListSerializer(read_only=True)
    location = serializers.SerializerMethodField()
    rooms = ManagerRoomSerializer(many=True, read_only=True)
    images = HotelImageSerializer(many=True, read_only=True)

    class Meta:
        model = Hotel
        fields = (
            'id',
            'name',
            'city',
            'address_line',
            'location',
            'description',
            'latitude',
            'longitude',
            'rating',
            'created_at',
            'rooms',
            'images',
        )
        read_only_fields = fields

    def get_location(self, obj):
        parts = []
        if obj.address_line:
            parts.append(obj.address_line.strip())
        parts.append(obj.city.name)
        parts.append(obj.city.country.name)
        return ', '.join(parts)
