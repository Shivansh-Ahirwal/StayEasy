"""Bookings admin."""

from django.contrib import admin

from apps.bookings.models import Booking


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'user',
        'room',
        'check_in',
        'check_out',
        'status',
        'total_price',
        'created_at',
    )
    list_filter = ('status', 'check_in')
    search_fields = ('user__email',)
