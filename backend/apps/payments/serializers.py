"""Payment API serializers."""

from rest_framework import serializers


class RazorpayCreateOrderSerializer(serializers.Serializer):
    """Start checkout for a pending booking."""

    booking_id = serializers.IntegerField(min_value=1)


class RazorpayVerifySerializer(serializers.Serializer):
    """Complete checkout after Razorpay handler."""

    booking_id = serializers.IntegerField(min_value=1)
    razorpay_order_id = serializers.CharField(max_length=255)
    razorpay_payment_id = serializers.CharField(max_length=255)
    razorpay_signature = serializers.CharField(max_length=255)
