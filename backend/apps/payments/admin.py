"""Payments admin."""

from django.contrib import admin

from apps.payments.models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'booking',
        'amount',
        'status',
        'razorpay_order_id',
        'created_at',
    )
    list_filter = ('status',)
