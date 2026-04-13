"""Booking serializers for hotel managers."""

from rest_framework import serializers

from apps.bookings.models import Booking


class ManagerBookingSerializer(serializers.ModelSerializer):
    """Booking row for property manager."""

    guest_email = serializers.EmailField(source='user.email', read_only=True)
    guest_name = serializers.SerializerMethodField()
    room_type = serializers.CharField(source='room.type', read_only=True)
    hotel_name = serializers.CharField(source='room.hotel.name', read_only=True)

    class Meta:
        model = Booking
        fields = (
            'id',
            'user',
            'guest_email',
            'guest_name',
            'room',
            'room_type',
            'hotel_name',
            'check_in',
            'check_out',
            'status',
            'total_price',
            'checked_in_at',
            'checked_out_at',
            'created_at',
        )
        read_only_fields = fields

    def get_guest_name(self, obj):
        u = obj.user
        parts = [u.first_name or '', u.last_name or '']
        name = ' '.join(p for p in parts if p).strip()
        return name or u.email
