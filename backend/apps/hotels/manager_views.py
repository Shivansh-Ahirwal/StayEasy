"""REST APIs for hotel managers (own properties only)."""

from django.db.models import Count
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.bookings.manager_serializers import ManagerBookingSerializer
from apps.bookings.models import Booking
from apps.core.permissions import IsManager
from apps.hotels.manager_serializers import (
    HotelImageSerializer,
    HotelImageWriteSerializer,
    ManagerHotelDetailSerializer,
    ManagerHotelSummarySerializer,
    ManagerRoomPatchSerializer,
    ManagerRoomSerializer,
    RoomImageSerializer,
    RoomImageWriteSerializer,
)
from apps.hotels.models import Hotel, HotelImage, Room, RoomImage
from apps.users.models import User


def manager_hotel_queryset(user):
    """Hotels this user may manage in the dashboard."""
    qs = Hotel.objects.select_related('city', 'city__country').prefetch_related(
        'rooms__images',
        'images',
    )
    if user.role == User.Role.ADMIN:
        return qs
    return qs.filter(manager=user)


def get_managed_hotel(user, hotel_pk: int) -> Hotel:
    return get_object_or_404(manager_hotel_queryset(user), pk=hotel_pk)


def get_managed_room(user, room_pk: int) -> Room:
    qs = Room.objects.select_related('hotel')
    if user.role == User.Role.ADMIN:
        return get_object_or_404(qs, pk=room_pk)
    return get_object_or_404(qs, pk=room_pk, hotel__manager=user)


def get_managed_booking(user, booking_pk: int) -> Booking:
    qs = Booking.objects.select_related('room', 'room__hotel', 'user')
    if user.role != User.Role.ADMIN:
        qs = qs.filter(room__hotel__manager=user)
    return get_object_or_404(qs, pk=booking_pk)


class ManagerHotelListView(generics.ListAPIView):
    """GET /api/manager/hotels/ — properties you manage."""

    permission_classes = [permissions.IsAuthenticated, IsManager]
    serializer_class = ManagerHotelSummarySerializer
    pagination_class = None

    def get_queryset(self):
        return (
            manager_hotel_queryset(self.request.user)
            .annotate(room_count=Count('rooms'))
            .order_by('name')
        )


class ManagerHotelDetailView(generics.RetrieveAPIView):
    """GET /api/manager/hotels/<id>/ — rooms + images."""

    permission_classes = [permissions.IsAuthenticated, IsManager]
    serializer_class = ManagerHotelDetailSerializer
    lookup_field = 'pk'

    def get_queryset(self):
        return manager_hotel_queryset(self.request.user)


class ManagerHotelBookingListView(generics.ListAPIView):
    """GET /api/manager/hotels/<hotel_pk>/bookings/"""

    permission_classes = [permissions.IsAuthenticated, IsManager]
    serializer_class = ManagerBookingSerializer
    pagination_class = None

    def get_queryset(self):
        get_managed_hotel(self.request.user, self.kwargs['hotel_pk'])
        hotel_pk = self.kwargs['hotel_pk']
        qs = (
            Booking.objects.filter(room__hotel_id=hotel_pk)
            .select_related('user', 'room', 'room__hotel')
            .order_by('-check_in', '-created_at')
        )
        st = self.request.query_params.get('status')
        if st:
            qs = qs.filter(status=st)
        return qs


class ManagerRoomDetailView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /api/manager/rooms/<pk>/ — view or update type, price, inventory."""

    permission_classes = [permissions.IsAuthenticated, IsManager]
    http_method_names = ['get', 'patch']

    def get_queryset(self):
        user = self.request.user
        qs = Room.objects.select_related('hotel').prefetch_related('images')
        if user.role == User.Role.ADMIN:
            return qs
        return qs.filter(hotel__manager=user)

    def get_serializer_class(self):
        if self.request.method == 'PATCH':
            return ManagerRoomPatchSerializer
        return ManagerRoomSerializer


class ManagerHotelImageCreateView(generics.GenericAPIView):
    """POST /api/manager/hotels/<hotel_pk>/images/"""

    permission_classes = [permissions.IsAuthenticated, IsManager]

    def post(self, request, hotel_pk):
        hotel = get_managed_hotel(request.user, hotel_pk)
        ser = HotelImageWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        img = HotelImage.objects.create(hotel=hotel, **ser.validated_data)
        return Response(HotelImageSerializer(img).data, status=status.HTTP_201_CREATED)


class ManagerHotelImageDestroyView(generics.DestroyAPIView):
    """DELETE /api/manager/hotels/<hotel_pk>/images/<image_pk>/"""

    permission_classes = [permissions.IsAuthenticated, IsManager]
    lookup_url_kwarg = 'image_pk'

    def get_queryset(self):
        hotel_pk = self.kwargs['hotel_pk']
        get_managed_hotel(self.request.user, hotel_pk)
        return HotelImage.objects.filter(hotel_id=hotel_pk)


class ManagerRoomImageCreateView(generics.GenericAPIView):
    """POST /api/manager/rooms/<room_pk>/images/"""

    permission_classes = [permissions.IsAuthenticated, IsManager]

    def post(self, request, room_pk):
        room = get_managed_room(request.user, room_pk)
        ser = RoomImageWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        img = RoomImage.objects.create(room=room, **ser.validated_data)
        return Response(RoomImageSerializer(img).data, status=status.HTTP_201_CREATED)


class ManagerRoomImageDestroyView(generics.DestroyAPIView):
    """DELETE /api/manager/rooms/<room_pk>/images/<image_pk>/"""

    permission_classes = [permissions.IsAuthenticated, IsManager]
    lookup_url_kwarg = 'image_pk'

    def get_queryset(self):
        room_pk = self.kwargs['room_pk']
        get_managed_room(self.request.user, room_pk)
        return RoomImage.objects.filter(room_id=room_pk)


class ManagerBookingCheckInView(APIView):
    """POST /api/manager/bookings/<pk>/check-in/"""

    permission_classes = [permissions.IsAuthenticated, IsManager]

    def post(self, request, pk):
        booking = get_managed_booking(request.user, pk)
        if booking.status != Booking.Status.CONFIRMED:
            return Response(
                {'detail': 'Only confirmed bookings can be checked in.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if booking.checked_in_at:
            return Response(
                {'detail': 'Guest is already checked in.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        booking.checked_in_at = timezone.now()
        booking.save(update_fields=['checked_in_at'])
        return Response(
            ManagerBookingSerializer(booking).data,
            status=status.HTTP_200_OK,
        )


class ManagerBookingCheckOutView(APIView):
    """POST /api/manager/bookings/<pk>/check-out/"""

    permission_classes = [permissions.IsAuthenticated, IsManager]

    def post(self, request, pk):
        booking = get_managed_booking(request.user, pk)
        if booking.status != Booking.Status.CONFIRMED:
            return Response(
                {'detail': 'Only confirmed bookings can be checked out.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not booking.checked_in_at:
            return Response(
                {'detail': 'Check in the guest before check-out.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if booking.checked_out_at:
            return Response(
                {'detail': 'Guest is already checked out.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        booking.checked_out_at = timezone.now()
        booking.save(update_fields=['checked_out_at'])
        return Response(
            ManagerBookingSerializer(booking).data,
            status=status.HTTP_200_OK,
        )
