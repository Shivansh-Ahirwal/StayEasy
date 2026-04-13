"""Versionless API routes under /api/."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.bookings.views import BookingViewSet
from apps.hotels.manager_views import (
    ManagerBookingCheckInView,
    ManagerBookingCheckOutView,
    ManagerHotelBookingListView,
    ManagerHotelDetailView,
    ManagerHotelImageCreateView,
    ManagerHotelImageDestroyView,
    ManagerHotelListView,
    ManagerRoomDetailView,
    ManagerRoomImageCreateView,
    ManagerRoomImageDestroyView,
)
from apps.hotels.views import HotelViewSet, RoomViewSet
from apps.locations.views import CityViewSet, CountryViewSet
from apps.payments.views import RazorpayCreateOrderView, RazorpayVerifyView
from apps.users.views import MeView, RegisterView

router = DefaultRouter()
router.register('countries', CountryViewSet, basename='country')
router.register('cities', CityViewSet, basename='city')
router.register('hotels', HotelViewSet, basename='hotel')
router.register('rooms', RoomViewSet, basename='room')
router.register('bookings', BookingViewSet, basename='booking')

urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='auth-register'),
    path('auth/login/', TokenObtainPairView.as_view(), name='auth-login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='auth-refresh'),
    path('auth/me/', MeView.as_view(), name='auth-me'),
    path(
        'payments/razorpay/create-order/',
        RazorpayCreateOrderView.as_view(),
        name='razorpay-create-order',
    ),
    path(
        'payments/razorpay/verify/',
        RazorpayVerifyView.as_view(),
        name='razorpay-verify',
    ),
    path('manager/hotels/<int:hotel_pk>/bookings/', ManagerHotelBookingListView.as_view()),
    path(
        'manager/hotels/<int:hotel_pk>/images/<int:image_pk>/',
        ManagerHotelImageDestroyView.as_view(),
    ),
    path('manager/hotels/<int:hotel_pk>/images/', ManagerHotelImageCreateView.as_view()),
    path('manager/hotels/<int:pk>/', ManagerHotelDetailView.as_view()),
    path('manager/hotels/', ManagerHotelListView.as_view()),
    path(
        'manager/rooms/<int:room_pk>/images/<int:image_pk>/',
        ManagerRoomImageDestroyView.as_view(),
    ),
    path('manager/rooms/<int:room_pk>/images/', ManagerRoomImageCreateView.as_view()),
    path('manager/rooms/<int:pk>/', ManagerRoomDetailView.as_view()),
    path('manager/bookings/<int:pk>/check-in/', ManagerBookingCheckInView.as_view()),
    path('manager/bookings/<int:pk>/check-out/', ManagerBookingCheckOutView.as_view()),
    path('', include(router.urls)),
]
