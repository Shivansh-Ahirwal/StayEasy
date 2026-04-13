# Generated manually for manager photo URLs

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hotels', '0005_hotel_oyo_geo_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='HotelImage',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name='ID',
                    ),
                ),
                ('url', models.URLField(max_length=500)),
                ('caption', models.CharField(blank=True, max_length=200)),
                ('sort_order', models.PositiveSmallIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                (
                    'hotel',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='images',
                        to='hotels.hotel',
                    ),
                ),
            ],
            options={
                'ordering': ['hotel', 'sort_order', 'id'],
            },
        ),
        migrations.CreateModel(
            name='RoomImage',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name='ID',
                    ),
                ),
                ('url', models.URLField(max_length=500)),
                ('caption', models.CharField(blank=True, max_length=200)),
                ('sort_order', models.PositiveSmallIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                (
                    'room',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='images',
                        to='hotels.room',
                    ),
                ),
            ],
            options={
                'ordering': ['room', 'sort_order', 'id'],
            },
        ),
    ]
