"""Read-only geography API for pickers and filters."""

from rest_framework import permissions, viewsets

from apps.locations.models import City, Country
from apps.locations.serializers import CitySerializer, CountrySerializer


class CountryViewSet(viewsets.ReadOnlyModelViewSet):
    """GET /api/countries/"""

    queryset = Country.objects.all().order_by('name')
    serializer_class = CountrySerializer
    permission_classes = [permissions.AllowAny]


class CityViewSet(viewsets.ReadOnlyModelViewSet):
    """GET /api/cities/?country=<country_id>"""

    queryset = City.objects.select_related('country').order_by('country', 'name')
    serializer_class = CitySerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        country_id = self.request.query_params.get('country')
        if country_id:
            qs = qs.filter(country_id=country_id)
        q = self.request.query_params.get('q')
        if q:
            qs = qs.filter(name__icontains=q.strip())
        return qs
