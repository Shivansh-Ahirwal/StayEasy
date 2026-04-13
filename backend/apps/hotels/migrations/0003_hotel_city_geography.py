# Geography: City + Country; migrate legacy `location` string.

import django.db.models.deletion
from django.db import migrations, models


def forwards_copy_location_to_city(apps, schema_editor):
    Hotel = apps.get_model('hotels', 'Hotel')
    Country = apps.get_model('locations', 'Country')
    City = apps.get_model('locations', 'City')
    india, _ = Country.objects.get_or_create(
        iso_code='IN',
        defaults={'name': 'India'},
    )
    for h in Hotel.objects.all():
        raw = (getattr(h, 'location', None) or '').strip() or 'Unknown'
        city_name = raw[:128]
        city, _ = City.objects.get_or_create(
            country=india,
            name=city_name,
        )
        h.city_id = city.pk
        h.save(update_fields=['city_id'])


def backwards_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('locations', '0001_initial'),
        ('hotels', '0002_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='hotel',
            name='address_line',
            field=models.CharField(blank=True, help_text='Street, area, or landmark (optional).', max_length=255),
        ),
        migrations.AddField(
            model_name='hotel',
            name='city',
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='hotels',
                to='locations.city',
            ),
        ),
        migrations.RunPython(forwards_copy_location_to_city, backwards_noop),
        migrations.RemoveIndex(
            model_name='hotel',
            name='hotels_hote_locatio_af27cd_idx',
        ),
        migrations.RemoveField(
            model_name='hotel',
            name='location',
        ),
        migrations.AlterField(
            model_name='hotel',
            name='city',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name='hotels',
                to='locations.city',
            ),
        ),
        migrations.AddIndex(
            model_name='hotel',
            index=models.Index(fields=['city'], name='hotels_hote_city_id_2c8b1f_idx'),
        ),
    ]
