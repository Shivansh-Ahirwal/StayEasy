"""Load Country / City / Hotel (and a default Room) from oyo_hotels.csv."""

from __future__ import annotations

import csv
from decimal import Decimal, InvalidOperation
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.hotels.models import Hotel, Room
from apps.locations.models import City, Country
UserModel = get_user_model()

DEFAULT_COUNTRY_ISO = 'IN'
DEFAULT_COUNTRY_NAME = 'India'
IMPORT_USER_EMAIL = 'csv-import@yoyo.local'
DEFAULT_ROOM_PRICE = Decimal('1499.00')


def _dec(val: str | None, default: Decimal) -> Decimal:
    if val is None or not str(val).strip():
        return default
    try:
        return Decimal(str(val).strip())
    except (InvalidOperation, ValueError):
        return default


def _truncate(s: str, max_len: int) -> str:
    s = (s or '').strip()
    if len(s) <= max_len:
        return s
    return s[: max_len - 1] + '…'


class Command(BaseCommand):
    help = (
        'Import hotels from oyo_hotels.csv (creates India + cities as needed). '
        'Skips duplicate oyo_id rows and existing DB oyo_id.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            'csv_path',
            nargs='?',
            type=str,
            default=None,
            help='Path to oyo_hotels.csv (default: <project_root>/oyo_hotels.csv)',
        )

    def handle(self, *args, **options):
        raw_path = options['csv_path']
        if raw_path:
            path = Path(raw_path).expanduser().resolve()
        else:
            path = Path(settings.BASE_DIR).parent / 'oyo_hotels.csv'
        if not path.is_file():
            raise CommandError(f'CSV not found: {path}')

        country, _ = Country.objects.get_or_create(
            iso_code=DEFAULT_COUNTRY_ISO,
            defaults={'name': DEFAULT_COUNTRY_NAME},
        )

        from apps.users.models import User as UserRole

        manager, user_created = UserModel.objects.get_or_create(
            email=IMPORT_USER_EMAIL,
            defaults={
                'username': IMPORT_USER_EMAIL,
                'first_name': 'CSV',
                'last_name': 'Import',
                'role': UserRole.Role.MANAGER,
                'is_active': True,
            },
        )
        if user_created:
            manager.set_unusable_password()
            manager.save(update_fields=['password'])

        created_hotels = 0
        created_rooms = 0
        skipped_dup_csv = 0
        skipped_existing_db = 0

        seen_oyo: set[int] = set()

        with path.open(newline='', encoding='utf-8') as fh:
            reader = csv.DictReader(fh)
            required = {
                'scrape_city_name',
                'oyo_id',
                'name',
                'address',
                'rating',
                'price',
                'latitude',
                'longitude',
            }
            if not required.issubset(set(reader.fieldnames or [])):
                raise CommandError(
                    f'Unexpected CSV columns: {reader.fieldnames}',
                )

            with transaction.atomic():
                for row in reader:
                    try:
                        oyo_pk = int(row['oyo_id'].strip())
                    except (TypeError, ValueError):
                        skipped_dup_csv += 1
                        continue

                    if oyo_pk in seen_oyo:
                        skipped_dup_csv += 1
                        continue
                    seen_oyo.add(oyo_pk)

                    if Hotel.objects.filter(oyo_id=oyo_pk).exists():
                        skipped_existing_db += 1
                        continue

                    city_name = (
                        (row.get('city') or '').strip()
                        or row['scrape_city_name'].strip()
                    )
                    if not city_name:
                        skipped_dup_csv += 1
                        continue

                    city, _ = City.objects.get_or_create(
                        country=country,
                        name=_truncate(city_name, 128),
                    )

                    rating = _dec(row.get('rating'), Decimal('0'))
                    if rating > Decimal('9.99'):
                        rating = Decimal('9.99')
                    elif rating < 0:
                        rating = Decimal('0')

                    lat = row.get('latitude', '').strip()
                    lng = row.get('longitude', '').strip()
                    latitude = None
                    longitude = None
                    if lat and lng:
                        try:
                            latitude = Decimal(lat)
                            longitude = Decimal(lng)
                        except (InvalidOperation, ValueError):
                            pass

                    hotel = Hotel.objects.create(
                        manager=manager,
                        name=_truncate(row['name'], 255),
                        oyo_id=oyo_pk,
                        city=city,
                        address_line=_truncate(row.get('address') or '', 255),
                        description='',
                        rating=rating,
                        latitude=latitude,
                        longitude=longitude,
                    )
                    created_hotels += 1

                    room_price = _dec(row.get('price'), DEFAULT_ROOM_PRICE)
                    if room_price <= 0:
                        room_price = DEFAULT_ROOM_PRICE
                    Room.objects.create(
                        hotel=hotel,
                        type='Standard',
                        price=room_price,
                        total_rooms=5,
                    )
                    created_rooms += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'Done. Hotels created: {created_hotels}, rooms: {created_rooms}. '
                f'Skipped (duplicate oyo_id in CSV): {skipped_dup_csv}. '
                f'Skipped (already in DB): {skipped_existing_db}. '
                f'Manager: {IMPORT_USER_EMAIL}',
            ),
        )
