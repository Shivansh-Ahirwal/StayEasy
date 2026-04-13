"""Razorpay order creation (REST) and payment verification."""

import hashlib
import hmac
from decimal import ROUND_HALF_UP, Decimal

import requests
from django.conf import settings
from django.db import transaction
from requests.auth import HTTPBasicAuth

from apps.bookings.models import Booking
from apps.bookings.services import BookingError, assert_room_available
from apps.payments.models import Payment

RAZORPAY_ORDERS_URL = 'https://api.razorpay.com/v1/orders'
RAZORPAY_TIMEOUT_S = 45


class RazorpayConfigError(RuntimeError):
    """Missing or invalid Razorpay configuration."""


def get_razorpay_credentials():
    """
    Return (key_id, key_secret) or None if not configured.

    Test mode: Dashboard → API Keys (Test).
    """
    key_id = (settings.RAZORPAY_KEY_ID or '').strip()
    secret = (settings.RAZORPAY_KEY_SECRET or '').strip()
    if not key_id or not secret:
        return None
    return key_id, secret


def total_price_to_paise(total: Decimal) -> int:
    """INR → paise (integer) for Razorpay Orders API."""
    return int((total * Decimal(100)).quantize(Decimal('1'), rounding=ROUND_HALF_UP))


def _razorpay_error_message(resp: requests.Response, data: dict) -> str:
    err = data.get('error')
    if isinstance(err, dict):
        return err.get('description') or err.get('code') or str(err)
    if isinstance(err, str):
        return err
    return resp.text or f'HTTP {resp.status_code}'


def create_order_for_booking(booking: Booking) -> tuple[Payment, dict]:
    """
    Create a Razorpay order via REST API and a Payment row in CREATED status.

    Returns (payment, order_dict from Razorpay).
    """
    creds = get_razorpay_credentials()
    if creds is None:
        raise RazorpayConfigError(
            'Razorpay is not configured. Set RAZORPAY_KEY_ID and '
            'RAZORPAY_KEY_SECRET (use test keys from razorpay.com dashboard).',
        )
    key_id, secret = creds

    if booking.status != Booking.Status.PENDING:
        raise ValueError('Only pending bookings can be paid for.')

    amount_paise = total_price_to_paise(booking.total_price)
    if amount_paise < 100:
        raise ValueError('Amount must be at least ₹1 (100 paise).')

    receipt = f'yoyo_b{booking.pk}'[:40]

    payload = {
        'amount': amount_paise,
        'currency': 'INR',
        'receipt': receipt,
        'payment_capture': 1,
        'notes': {'booking_id': str(booking.pk)},
    }

    try:
        resp = requests.post(
            RAZORPAY_ORDERS_URL,
            auth=HTTPBasicAuth(key_id, secret),
            json=payload,
            timeout=RAZORPAY_TIMEOUT_S,
        )
    except requests.RequestException as exc:
        raise RazorpayConfigError(
            f'Could not reach Razorpay: {exc}',
        ) from exc

    try:
        data = resp.json()
    except ValueError as exc:
        raise ValueError('Invalid JSON from Razorpay.') from exc

    if resp.status_code >= 400:
        raise ValueError(_razorpay_error_message(resp, data))

    order = data
    if not order.get('id'):
        raise ValueError('Razorpay order response missing id.')

    with transaction.atomic():
        Payment.objects.filter(
            booking=booking,
            status=Payment.Status.CREATED,
        ).delete()

        payment = Payment.objects.create(
            booking=booking,
            razorpay_order_id=order['id'],
            amount=booking.total_price,
            status=Payment.Status.CREATED,
        )

    return payment, order


def verify_signature(order_id: str, payment_id: str, signature: str) -> bool:
    """Verify Razorpay payment signature (server-side)."""
    secret = (settings.RAZORPAY_KEY_SECRET or '').strip()
    if not secret:
        return False
    payload = f'{order_id}|{payment_id}'.encode()
    expected = hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


@transaction.atomic
def complete_payment_for_booking(
    booking: Booking,
    order_id: str,
    payment_id: str,
    signature: str,
) -> Payment:
    """
    Verify Razorpay response, mark payment paid and booking confirmed.

    Re-checks room availability under lock before confirming.
    """
    if booking.status == Booking.Status.CONFIRMED:
        payment = Payment.objects.filter(
            booking=booking,
            razorpay_payment_id=payment_id,
            status=Payment.Status.PAID,
        ).first()
        if payment:
            return payment
        raise ValueError('Booking already confirmed with a different payment.')

    if not verify_signature(order_id, payment_id, signature):
        raise ValueError('Invalid payment signature.')

    payment = (
        Payment.objects.select_for_update()
        .filter(
            booking=booking,
            razorpay_order_id=order_id,
        )
        .order_by('-pk')
        .first()
    )
    if payment is None:
        raise ValueError('No payment order found for this booking.')

    if payment.status == Payment.Status.PAID:
        if payment.razorpay_payment_id == payment_id:
            return payment
        raise ValueError('This order was already paid.')

    room = booking.room
    locked = type(room).objects.select_for_update().get(pk=room.pk)
    try:
        assert_room_available(
            locked,
            booking.check_in,
            booking.check_out,
            exclude_booking_id=booking.pk,
        )
    except BookingError as exc:
        raise ValueError(str(exc)) from exc

    payment.razorpay_payment_id = payment_id
    payment.status = Payment.Status.PAID
    payment.save(update_fields=['razorpay_payment_id', 'status'])

    booking.status = Booking.Status.CONFIRMED
    booking.save(update_fields=['status'])

    return payment
