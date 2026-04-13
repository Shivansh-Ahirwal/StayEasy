"""Booking creation and availability rules."""

from datetime import date
from decimal import Decimal

from django.db import transaction

from apps.bookings.models import Booking
from apps.hotels.models import Room


class BookingError(ValueError):
    """Domain error for invalid booking requests."""


def stay_nights(check_in: date, check_out: date) -> int:
    """Number of nights (checkout day is exclusive)."""
    return (check_out - check_in).days


def _overlapping_count(
    room: Room,
    check_in: date,
    check_out: date,
    exclude_booking_id: int | None = None,
) -> int:
    """How many active bookings overlap the given range."""
    active_status = (
        Booking.Status.PENDING,
        Booking.Status.CONFIRMED,
    )
    qs = Booking.objects.filter(
        room=room,
        status__in=active_status,
    ).filter(
        check_in__lt=check_out,
        check_out__gt=check_in,
    )
    if exclude_booking_id is not None:
        qs = qs.exclude(pk=exclude_booking_id)
    return qs.count()


def assert_room_available(
    room: Room,
    check_in: date,
    check_out: date,
    exclude_booking_id: int | None = None,
) -> None:
    """Raise BookingError if inventory cannot satisfy the stay."""
    if check_in >= check_out:
        raise BookingError('check_in must be before check_out.')
    nights = stay_nights(check_in, check_out)
    if nights <= 0:
        raise BookingError('Stay must be at least one night.')
    if (
        _overlapping_count(room, check_in, check_out, exclude_booking_id)
        >= room.total_rooms
    ):
        raise BookingError('No availability for these dates.')


def compute_total_price(
    room: Room,
    check_in: date,
    check_out: date,
) -> Decimal:
    """Nightly rate × number of nights."""
    nights = stay_nights(check_in, check_out)
    return Decimal(room.price) * nights


@transaction.atomic
def create_booking_pending(
    user,
    room: Room,
    check_in: date,
    check_out: date,
) -> Booking:
    """
    Create a pending reservation; confirm after Razorpay payment verifies.

    Uses SELECT FOR UPDATE on the room row to reduce double-book races.
    """
    locked = Room.objects.select_for_update().get(pk=room.pk)
    assert_room_available(locked, check_in, check_out)
    total = compute_total_price(locked, check_in, check_out)
    return Booking.objects.create(
        user=user,
        room=locked,
        check_in=check_in,
        check_out=check_out,
        status=Booking.Status.PENDING,
        total_price=total,
    )
