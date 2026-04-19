"""Review API views."""

from rest_framework import permissions
from rest_framework.generics import ListAPIView
from rest_framework.exceptions import NotFound

from apps.hotels.models import Hotel
from apps.reviews.models import Review
from apps.reviews.serializers import ReviewSerializer


class HotelReviewListView(ListAPIView):
    """GET /api/hotels/:hotel_pk/reviews/"""

    serializer_class = ReviewSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        hotel_pk = self.kwargs["hotel_pk"]
        if not Hotel.objects.filter(pk=hotel_pk).exists():
            raise NotFound("Hotel not found.")
        return (
            Review.objects.filter(hotel_id=hotel_pk)
            .select_related("user")
            .order_by("-created_at")
        )
