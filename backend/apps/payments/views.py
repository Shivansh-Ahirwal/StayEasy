"""Payment API (Razorpay)."""

from django.conf import settings
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.bookings.models import Booking
from apps.bookings.serializers import BookingSerializer
from apps.payments.serializers import (
    RazorpayCreateOrderSerializer,
    RazorpayVerifySerializer,
)
from apps.payments.services import (
    RazorpayConfigError,
    complete_payment_for_booking,
    create_order_for_booking,
    total_price_to_paise,
)


class RazorpayCreateOrderView(APIView):
    """
    POST /api/payments/razorpay/create-order/

    Body: { \"booking_id\": <int> }

    Returns key_id, order_id, amount (paise), currency for Checkout.js.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        ser = RazorpayCreateOrderSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        booking_id = ser.validated_data['booking_id']

        try:
            booking = Booking.objects.select_related(
                'room',
                'room__hotel',
            ).get(pk=booking_id, user=request.user)
        except Booking.DoesNotExist:
            return Response(
                {'detail': 'Booking not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            _payment, order = create_order_for_booking(booking)
        except RazorpayConfigError as exc:
            return Response(
                {'detail': str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except ValueError as exc:
            return Response(
                {'detail': str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as exc:
            return Response(
                {'detail': f'Payment provider error: {exc}'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        key_id = (settings.RAZORPAY_KEY_ID or '').strip()
        # Use amount from Razorpay’s order object so Checkout matches exactly.
        raw_amt = order.get('amount')
        amount_paise = int(raw_amt) if raw_amt is not None else total_price_to_paise(
            booking.total_price,
        )

        return Response(
            {
                'key_id': key_id,
                'order_id': order['id'],
                'amount': amount_paise,
                'currency': order.get('currency', 'INR'),
                'booking_id': booking.pk,
                'hotel_name': booking.room.hotel.name,
            },
            status=status.HTTP_201_CREATED,
        )


class RazorpayVerifyView(APIView):
    """
    POST /api/payments/razorpay/verify/

    Body: booking_id, razorpay_order_id, razorpay_payment_id,
          razorpay_signature (from Checkout handler).
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        ser = RazorpayVerifySerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        try:
            booking = Booking.objects.select_related('room', 'room__hotel').get(
                pk=data['booking_id'],
                user=request.user,
            )
        except Booking.DoesNotExist:
            return Response(
                {'detail': 'Booking not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            complete_payment_for_booking(
                booking,
                data['razorpay_order_id'],
                data['razorpay_payment_id'],
                data['razorpay_signature'],
            )
        except ValueError as exc:
            return Response(
                {'detail': str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        out = BookingSerializer(booking, context={'request': request}).data
        return Response(out, status=status.HTTP_200_OK)
