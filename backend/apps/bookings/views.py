"""Booking API."""

from rest_framework import mixins, permissions, response, viewsets

from apps.bookings.models import Booking
from apps.bookings.serializers import BookingCreateSerializer, BookingSerializer
from apps.users.models import User


class BookingViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """
    create: POST /api/bookings/
    list: GET /api/bookings/ (own bookings)
    retrieve: GET /api/bookings/:id/
    """

    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Booking.objects.select_related('room', 'room__hotel', 'user')
        user = self.request.user
        if user.role == User.Role.ADMIN:
            return qs
        return qs.filter(user=user)

    def get_serializer_class(self):
        if self.action == 'create':
            return BookingCreateSerializer
        return BookingSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        data = BookingSerializer(
            serializer.instance,
            context=self.get_serializer_context(),
        ).data
        return response.Response(data, status=201, headers=headers)
