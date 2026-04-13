# Generated manually for manager check-in / check-out

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('bookings', '0003_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='booking',
            name='checked_in_at',
            field=models.DateTimeField(
                blank=True,
                help_text='When the guest was marked checked in (on-site).',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='booking',
            name='checked_out_at',
            field=models.DateTimeField(
                blank=True,
                help_text='When the guest was marked checked out.',
                null=True,
            ),
        ),
    ]
