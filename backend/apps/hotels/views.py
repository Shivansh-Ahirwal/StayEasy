"""Hotel and room API."""

from django.db.models import Count, ExpressionWrapper, FloatField, Min, Q, Value
from django.db.models.functions import Cast
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.core.permissions import IsManager
from apps.hotels.models import Hotel, Room
from apps.locations.models import City
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
    ).prefetch_related('rooms', 'amenities')

    pagination_class = HotelSearchPagination

    def get_permissions(self):
        if self.action == 'create':
            return [permissions.IsAuthenticated()]
        if self.action in ('update', 'partial_update', 'destroy'):
            return [permissions.IsAuthenticated(), IsManager()]
        return [permissions.AllowAny()]

    def get_serializer_class(self):
        if self.action == 'list':
            return HotelListSerializer
        return HotelSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        qs = qs.annotate(min_room_price=Min('rooms__price'), review_count=Count('reviews'))
        q = self.request.query_params.get('q')
        loc = self.request.query_params.get('location')
        if q:
            city_match = City.objects.filter(
                name__iexact=q
            ).exists()
            if city_match:
                qs = qs.filter(
                    Q(city__name__iexact=q)
                    | Q(city__country__name__iexact=q),
                )
            else:
                qs = qs.filter(
                    Q(name__icontains=q)
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
        user = self.request.user
        if user.role == User.Role.USER:
            user.role = User.Role.MANAGER
            user.save(update_fields=['role'])
        serializer.save(manager=user)

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

    @action(
        detail=False,
        methods=['get'],
        permission_classes=[permissions.AllowAny],
        url_path='top_picks',
    )
    def top_picks(self, request):
        """GET /api/hotels/top_picks/?loc=Mumbai&limit=4

        Ranks hotels by: rating * review_count / (review_count + 5)
        This Bayesian score rewards hotels that are both highly rated
        AND have enough reviews to be trustworthy.
        Falls back to global top picks when no loc match is found.
        """
        loc = (request.query_params.get('loc') or '').strip()
        limit = min(int(request.query_params.get('limit', 4)), 20)

        score_expr = ExpressionWrapper(
            Cast('rating', FloatField())
            * Cast('review_count', FloatField())
            / (Cast('review_count', FloatField()) + Value(5.0)),
            output_field=FloatField(),
        )

        def _ranked_qs(qs):
            return (
                qs.annotate(
                    min_room_price=Min('rooms__price'),
                    review_count=Count('reviews'),
                )
                .annotate(score=score_expr)
                .order_by('-score')
            )

        if loc:
            city_qs = Hotel.objects.select_related('city', 'city__country').filter(
                Q(city__name__icontains=loc) | Q(city__country__name__icontains=loc)
            )
            results = list(_ranked_qs(city_qs)[:limit])
            # If fewer than requested, pad with global top picks
            if len(results) < limit:
                seen_ids = {h.id for h in results}
                global_qs = Hotel.objects.select_related('city', 'city__country').exclude(
                    id__in=seen_ids
                )
                results += list(_ranked_qs(global_qs)[: limit - len(results)])
        else:
            global_qs = Hotel.objects.select_related('city', 'city__country')
            results = list(_ranked_qs(global_qs)[:limit])

        ser = HotelListSerializer(results, many=True)
        return Response({
            'city': loc or None,
            'results': ser.data,
        })


class RoomViewSet(viewsets.ModelViewSet):
    """
    list: GET /api/rooms/?hotel_id=
    create: POST /api/rooms/ (manager)
    """

    serializer_class = RoomSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [permissions.IsAuthenticated()]
        if self.action in ('update', 'partial_update', 'destroy'):
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
