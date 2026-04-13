"""Hotels admin."""

from django.contrib import admin

from apps.hotels.models import Hotel, HotelImage, Room, RoomImage


class RoomInline(admin.TabularInline):
    model = Room
    extra = 0


class HotelImageInline(admin.TabularInline):
    model = HotelImage
    extra = 0


class RoomImageInline(admin.TabularInline):
    model = RoomImage
    extra = 0


@admin.register(Hotel)
class HotelAdmin(admin.ModelAdmin):
    list_display = (
        'name',
        'oyo_id',
        'city',
        'address_line',
        'manager',
        'rating',
        'created_at',
    )
    list_filter = ('city__country', 'city')
    search_fields = (
        'name',
        'oyo_id',
        'address_line',
        'city__name',
        'city__country__name',
    )
    autocomplete_fields = ('city', 'manager')
    inlines = [RoomInline, HotelImageInline]


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ('type', 'hotel', 'price', 'total_rooms')
    list_filter = ('hotel',)
    inlines = [RoomImageInline]
