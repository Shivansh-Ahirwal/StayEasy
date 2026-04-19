"""Assign random prices to all hotel rooms, majority in the 1000–2000 range."""

from __future__ import annotations

import random
from decimal import Decimal

from django.core.management.base import BaseCommand

from apps.hotels.models import Room


def _random_price(rng: random.Random) -> Decimal:
    bucket = rng.random()
    if bucket < 0.60:
        price = rng.uniform(1000, 2000)
    elif bucket < 0.80:
        price = rng.uniform(2000, 4000)
    elif bucket < 0.92:
        price = rng.uniform(500, 1000)
    elif bucket < 0.98:
        price = rng.uniform(4000, 10000)
    else:
        price = rng.uniform(200, 500)
    return Decimal(str(round(price, -1)))  # round to nearest 10


class Command(BaseCommand):
    help = "Set random prices (₹200–₹10 000, majority ₹1 000–₹2 000) on all rooms."

    def add_arguments(self, parser):
        parser.add_argument(
            "--seed",
            type=int,
            default=42,
            metavar="SEED",
            help="Random seed for reproducibility (default: 42).",
        )

    def handle(self, *args, **options):
        rng = random.Random(options["seed"])
        rooms = list(Room.objects.only("id", "price"))
        if not rooms:
            self.stdout.write(self.style.WARNING("No rooms found — nothing updated."))
            return

        for room in rooms:
            room.price = _random_price(rng)

        Room.objects.bulk_update(rooms, ["price"])
        self.stdout.write(self.style.SUCCESS(
            f"✓  Updated prices for {len(rooms)} rooms."
        ))
