"""Booking serializers."""

from rest_framework import serializers

from apps.bookings.models import Booking
from apps.bookings.services import BookingError, create_booking_pending
from apps.hotels.serializers import RoomSerializer


class BookingSerializer(serializers.ModelSerializer):
    """Read booking; nested room summary."""

    room_detail = RoomSerializer(source='room', read_only=True)

    class Meta:
        model = Booking
        fields = (
            'id',
            'user',
            'room',
            'room_detail',
            'check_in',
            'check_out',
            'status',
            'total_price',
            'checked_in_at',
            'checked_out_at',
            'created_at',
        )
        read_only_fields = (
            'id',
            'user',
            'status',
            'total_price',
            'created_at',
            'room_detail',
            'checked_in_at',
            'checked_out_at',
        )


class BookingCreateSerializer(serializers.ModelSerializer):
    """Create booking (pending until Razorpay payment succeeds)."""

    class Meta:
        model = Booking
        fields = ('room', 'check_in', 'check_out')

    def create(self, validated_data):
        request = self.context['request']
        room = validated_data['room']
        check_in = validated_data['check_in']
        check_out = validated_data['check_out']
        try:
            return create_booking_pending(
                request.user,
                room,
                check_in,
                check_out,
            )
        except BookingError as exc:
            raise serializers.ValidationError({'detail': str(exc)}) from exc
