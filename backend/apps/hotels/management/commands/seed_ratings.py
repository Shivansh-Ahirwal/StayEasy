"""Assign random decimal ratings (0.00 – 5.00) to every hotel."""

from __future__ import annotations

import random
from decimal import Decimal

from django.core.management.base import BaseCommand

from apps.hotels.models import Hotel


class Command(BaseCommand):
    help = 'Assign random ratings (0.00 – 5.00) to all hotels in bulk.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--min',
            type=float,
            default=0.0,
            metavar='MIN',
            help='Lower bound of the random range (default: 0.0).',
        )
        parser.add_argument(
            '--max',
            type=float,
            default=5.0,
            metavar='MAX',
            help='Upper bound of the random range (default: 5.0).',
        )
        parser.add_argument(
            '--seed',
            type=int,
            default=None,
            metavar='SEED',
            help='Optional random seed for reproducible results.',
        )

    def handle(self, *args, **options):
        lo = options['min']
        hi = options['max']

        if lo < 0 or hi > 5 or lo > hi:
            self.stderr.write(self.style.ERROR(
                f'Invalid range [{lo}, {hi}]. Must satisfy 0 ≤ min ≤ max ≤ 5.'
            ))
            return

        if options['seed'] is not None:
            random.seed(options['seed'])

        hotels = list(Hotel.objects.only('id', 'rating'))
        if not hotels:
            self.stdout.write(self.style.WARNING('No hotels found — nothing updated.'))
            return

        for hotel in hotels:
            hotel.rating = Decimal(str(round(random.uniform(lo, hi), 2)))

        Hotel.objects.bulk_update(hotels, ['rating'])

        self.stdout.write(
            self.style.SUCCESS(
                f'✓  Updated {len(hotels)} hotel ratings with random values in [{lo}, {hi}].'
            )
        )
