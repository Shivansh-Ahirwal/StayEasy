# Generated manually for apps.locations

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='Country',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=128)),
                ('iso_code', models.CharField(help_text='ISO 3166-1 alpha-2, e.g. IN, US.', max_length=2, unique=True)),
            ],
            options={
                'ordering': ['name'],
                'verbose_name_plural': 'countries',
            },
        ),
        migrations.CreateModel(
            name='City',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=128)),
                ('country', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='cities', to='locations.country')),
            ],
            options={
                'ordering': ['country', 'name'],
            },
        ),
        migrations.AddConstraint(
            model_name='city',
            constraint=models.UniqueConstraint(fields=('country', 'name'), name='locations_city_unique_per_country'),
        ),
        migrations.AddIndex(
            model_name='city',
            index=models.Index(fields=['name'], name='locations_ci_name_7267cc_idx'),
        ),
    ]
