"""Seed India + common cities for demos (idempotent)."""

from django.db import migrations


def seed(apps, schema_editor):
    Country = apps.get_model('locations', 'Country')
    City = apps.get_model('locations', 'City')
    india, _ = Country.objects.get_or_create(
        iso_code='IN',
        defaults={'name': 'India'},
    )
    for name in (
        'Mumbai',
        'Delhi',
        'Bangalore',
        'Hyderabad',
        'Chennai',
        'Kolkata',
        'Pune',
        'Goa',
        'Bhopal',
        'Jaipur',
        'Ahmedabad',
    ):
        City.objects.get_or_create(country=india, name=name)


def unseed(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('locations', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
