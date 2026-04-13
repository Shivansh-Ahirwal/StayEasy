"""Hotel and room API."""

from django.db.models import Min, Q
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.core.permissions import IsManager
from apps.hotels.models import Hotel, Room
from apps.hotels.pagination import HotelSearchPagination
from apps.hotels.serializers import (
    HotelListSerializer,
    HotelSerializer,
    RoomSerializer,
)
from apps.users.models import User


class HotelViewSet(viewsets.ModelViewSet):
    """
    list: GET /api/hotels/
    retrieve: GET /api/hotels/:id/
    create: POST /api/hotels/ (manager)
    """

    queryset = Hotel.objects.select_related(
        'city',
        'city__country',
    ).prefetch_related('rooms')

    pagination_class = HotelSearchPagination

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [permissions.IsAuthenticated(), IsManager()]
        return [permissions.AllowAny()]

    def get_serializer_class(self):
        if self.action == 'list':
            return HotelListSerializer
        return HotelSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        qs = qs.annotate(min_room_price=Min('rooms__price'))
        q = self.request.query_params.get('q')
        loc = self.request.query_params.get('location')
        if q:
            qs = qs.filter(
                Q(name__icontains=q)
                | Q(address_line__icontains=q)
                | Q(city__name__icontains=q)
                | Q(city__country__name__icontains=q),
            )
        if loc:
            qs = qs.filter(
                Q(city__name__icontains=loc)
                | Q(city__country__name__icontains=loc),
            )
        return qs.order_by('name', 'pk')

    def perform_create(self, serializer):
        serializer.save(manager=self.request.user)

    def perform_update(self, serializer):
        hotel = serializer.instance
        user = self.request.user
        if user.role == User.Role.ADMIN:
            serializer.save()
            return
        if hotel.manager_id != user.id:
            raise PermissionDenied('You do not manage this hotel.')
        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        if user.role == User.Role.ADMIN:
            instance.delete()
            return
        if instance.manager_id != user.id:
            raise PermissionDenied('You do not manage this hotel.')
        instance.delete()

    @action(
        detail=True,
        methods=['get'],
        permission_classes=[permissions.AllowAny],
    )
    def rooms(self, request, pk=None):
        """GET /api/hotels/:id/rooms/"""
        hotel = self.get_object()
        ser = RoomSerializer(hotel.rooms.all(), many=True)
        return Response(ser.data)


class RoomViewSet(viewsets.ModelViewSet):
    """
    list: GET /api/rooms/?hotel_id=
    create: POST /api/rooms/ (manager)
    """

    serializer_class = RoomSerializer

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [permissions.IsAuthenticated(), IsManager()]
        return [permissions.AllowAny()]

    def get_queryset(self):
        qs = Room.objects.select_related('hotel')
        hotel_id = self.request.query_params.get('hotel_id')
        if hotel_id:
            qs = qs.filter(hotel_id=hotel_id)
        return qs

    def perform_create(self, serializer):
        hotel = serializer.validated_data['hotel']
        user = self.request.user
        if user.role == User.Role.ADMIN:
            serializer.save()
            return
        if hotel.manager_id != user.id:
            raise PermissionDenied('You do not manage this hotel.')
        serializer.save()

    def perform_update(self, serializer):
        hotel = serializer.validated_data.get('hotel', serializer.instance.hotel)
        user = self.request.user
        if user.role == User.Role.ADMIN:
            serializer.save()
            return
        if hotel.manager_id != user.id:
            raise PermissionDenied('You do not manage this hotel.')
        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        if user.role == User.Role.ADMIN:
            instance.delete()
            return
        if instance.hotel.manager_id != user.id:
            raise PermissionDenied('You do not manage this hotel.')
        instance.delete()
