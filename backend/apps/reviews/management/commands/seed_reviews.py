"""Seed random reviews for every hotel, then recompute Hotel.rating from averages."""

from __future__ import annotations

import random
from decimal import Decimal, ROUND_HALF_UP

from django.core.management.base import BaseCommand
from django.db import IntegrityError

from apps.hotels.models import Hotel
from apps.reviews.models import Review
from apps.users.models import User

COMMENTS = [
    "Great location and very friendly staff. The room was spotless.",
    "Excellent value for money. Would definitely book again.",
    "Breakfast was amazing and the view from my room was stunning.",
    "Very clean property with a smooth check-in process.",
    "Perfect for a business trip — fast WiFi and comfortable beds.",
    "Good amenities and a central location. Easy to get around.",
    "Loved the cozy vibe. Housekeeping was absolutely top-notch.",
    "A hidden gem — quiet, clean, and surprisingly affordable.",
    "Staff went out of their way to make us feel welcome.",
    "Decent stay overall. Nothing fancy but good for the price.",
    "The room was smaller than expected but very well maintained.",
    "Fantastic experience from check-in to check-out. Highly recommend.",
    "AC was a bit noisy but everything else was great.",
    "Loved the rooftop view. Will definitely come back.",
    "Clean rooms and prompt room service. Very satisfied.",
    "Location is unbeatable. Everything is within walking distance.",
    "Nice property but parking could be better organised.",
    "One of the best budget stays I've had. Impressively clean.",
    "The pool area was lovely and the staff were super attentive.",
    "Hot water was inconsistent but the rest of the stay was great.",
]

FIRST_NAMES = [
    "Priya", "Rahul", "Anjali", "Vikram", "Sneha", "Arjun",
    "Kavya", "Rohan", "Neha", "Amit", "Divya", "Suresh",
    "Pooja", "Kiran", "Aditya", "Meera", "Sanjay", "Riya",
    "Nikhil", "Shweta",
]
LAST_NAMES = [
    "Sharma", "Mehta", "Patel", "Singh", "Rao", "Iyer",
    "Nair", "Gupta", "Joshi", "Kumar", "Verma", "Reddy",
    "Das", "Chatterjee", "Bose", "Mishra", "Pillai", "Shah",
    "Chopra", "Malhotra",
]


def _make_seed_users(count: int, rng: random.Random) -> list[User]:
    """Create deterministic reviewer accounts that don't clash with real users."""
    users = []
    for i in range(count):
        first = FIRST_NAMES[i % len(FIRST_NAMES)]
        last = LAST_NAMES[i % len(LAST_NAMES)]
        email = f"reviewer{i+1}@stayeazy.seed"
        user, _ = User.objects.get_or_create(
            email=email,
            defaults={
                "username": email,
                "first_name": first,
                "last_name": last,
            },
        )
        users.append(user)
    return users


class Command(BaseCommand):
    help = (
        "Seed random Review rows for all hotels, then recompute Hotel.rating "
        "from the real averages."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--reviews-per-hotel",
            type=int,
            default=8,
            metavar="N",
            help="How many reviews to create per hotel (default: 8).",
        )
        parser.add_argument(
            "--seed",
            type=int,
            default=42,
            metavar="SEED",
            help="Random seed for reproducibility (default: 42).",
        )
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Delete all existing seeded reviews before re-seeding.",
        )

    def handle(self, *args, **options):
        rng = random.Random(options["seed"])
        n = options["reviews_per_hotel"]

        if options["clear"]:
            deleted, _ = Review.objects.filter(
                user__email__endswith="@stayeazy.seed"
            ).delete()
            self.stdout.write(f"  Cleared {deleted} existing seeded reviews.")

        hotels = list(Hotel.objects.only("id", "rating"))
        if not hotels:
            self.stdout.write(self.style.WARNING("No hotels found — nothing to seed."))
            return

        # Ensure we have enough reviewer accounts
        reviewers = _make_seed_users(n, rng)
        self.stdout.write(f"  Using {len(reviewers)} reviewer accounts.")

        reviews_to_create = []
        for hotel in hotels:
            picked = rng.sample(reviewers, min(n, len(reviewers)))
            for i, user in enumerate(picked):
                rating = rng.choices(
                    [1, 2, 3, 4, 5],
                    weights=[3, 7, 15, 45, 30],
                )[0]
                comment = COMMENTS[rng.randrange(len(COMMENTS))]
                reviews_to_create.append(
                    Review(hotel=hotel, user=user, rating=rating, comment=comment)
                )

        # Bulk insert, skip duplicates (idempotent on re-run without --clear)
        Review.objects.bulk_create(reviews_to_create, ignore_conflicts=True)
        self.stdout.write(f"  Inserted up to {len(reviews_to_create)} reviews.")

        # Recompute Hotel.rating from real averages
        self._recompute_ratings(hotels)

        self.stdout.write(self.style.SUCCESS(
            f"✓  Seeded reviews for {len(hotels)} hotels and recomputed ratings."
        ))

    def _recompute_ratings(self, hotels: list[Hotel]) -> None:
        from django.db.models import Avg

        avg_map = {
            row["hotel_id"]: row["avg"]
            for row in Review.objects.values("hotel_id").annotate(avg=Avg("rating"))
            if row["avg"] is not None
        }
        for hotel in hotels:
            avg = avg_map.get(hotel.id)
            if avg is not None:
                hotel.rating = Decimal(str(avg)).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
        Hotel.objects.bulk_update(hotels, ["rating"])
        self.stdout.write(f"  Recomputed ratings for {len(avg_map)} hotels.")
