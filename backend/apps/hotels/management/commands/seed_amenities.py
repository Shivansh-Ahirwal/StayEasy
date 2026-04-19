"""Seed Amenity records and assign them randomly to all hotels."""

import random

from django.core.management.base import BaseCommand

from apps.hotels.models import Amenity, Hotel

AMENITIES = [
    # Connectivity
    ('Free WiFi',        '📶', 'Connectivity'),
    ('High-speed WiFi',  '🚀', 'Connectivity'),
    # Food & Beverage
    ('Restaurant',       '🍽️', 'Food & Beverage'),
    ('Room service',     '☕', 'Food & Beverage'),
    ('Breakfast included', '🥞', 'Food & Beverage'),
    ('Mini bar',         '🍾', 'Food & Beverage'),
    # Recreation
    ('Swimming pool',    '🏊', 'Recreation'),
    ('Gym / Fitness centre', '💪', 'Recreation'),
    ('Spa',              '💆', 'Recreation'),
    ('Game room',        '🎮', 'Recreation'),
    # Transport
    ('Free parking',     '🅿️', 'Transport'),
    ('Airport shuttle',  '🚐', 'Transport'),
    ('EV charging',      '🔌', 'Transport'),
    # Room features
    ('Air conditioning', '❄️', 'Room'),
    ('Flat-screen TV',   '📺', 'Room'),
    ('Hot water',        '🚿', 'Room'),
    ('Toiletries',       '🧴', 'Room'),
    ('Safe / locker',    '🔒', 'Room'),
    # Services
    ('24hr front desk',  '🛎️', 'Services'),
    ('Elevator',         '🛗', 'Services'),
    ('Laundry service',  '🧺', 'Services'),
    ('CCTV / Security',  '📷', 'Services'),
    ('Business centre',  '💼', 'Services'),
    ('Kids play area',   '🧒', 'Services'),
    ('Pet friendly',     '🐾', 'Services'),
]

# Every hotel gets these regardless
ALWAYS_INCLUDE = {'Free WiFi', 'Hot water', 'Air conditioning'}

# Minimum and maximum amenities per hotel
MIN_AMENITIES = 6
MAX_AMENITIES = 14


class Command(BaseCommand):
    help = 'Seed amenity records and assign them randomly to all hotels.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear all existing amenity assignments before seeding.',
        )

    def handle(self, *args, **options):
        # 1. Create / get all amenity records
        amenity_objs = {}
        for name, icon, category in AMENITIES:
            obj, created = Amenity.objects.get_or_create(
                name=name,
                defaults={'icon': icon, 'category': category},
            )
            if not created:
                obj.icon = icon
                obj.category = category
                obj.save(update_fields=['icon', 'category'])
            amenity_objs[name] = obj

        self.stdout.write(f'  {len(amenity_objs)} amenities ready.')

        if options['clear']:
            Hotel.amenities.through.objects.all().delete()
            self.stdout.write('  Cleared existing assignments.')

        # 2. Assign amenities to each hotel
        always = [amenity_objs[n] for n in ALWAYS_INCLUDE if n in amenity_objs]
        optional = [v for k, v in amenity_objs.items() if k not in ALWAYS_INCLUDE]

        hotels = Hotel.objects.prefetch_related('amenities').all()
        total = hotels.count()

        for hotel in hotels:
            if hotel.amenities.exists() and not options['clear']:
                continue
            count = random.randint(MIN_AMENITIES, MAX_AMENITIES)
            extra = random.sample(optional, min(count - len(always), len(optional)))
            hotel.amenities.set(always + extra)

        self.stdout.write(
            self.style.SUCCESS(
                f'Done. Amenities assigned to {total} hotels.'
            )
        )
