from django.db import migrations
from django.contrib.auth.hashers import make_password

def create_initial_data(apps, schema_editor):
    User = apps.get_model('recruitment', 'User')
    Group = apps.get_model('auth', 'Group')

    admin_group, _ = Group.objects.get_or_create(name='ADMIN')
    rh_group, _ = Group.objects.get_or_create(name='RH')

    if not User.objects.filter(username='admin').exists():
        admin = User.objects.create(
            username='admin',
            email='admin@test.com',
            password=make_password('admin123456'),
            role='ADMIN',
            is_superuser=True,
            is_staff=True
        )
        admin.groups.add(admin_group)

    if not User.objects.filter(username='rh_test').exists():
        rh = User.objects.create(
            username='rh_test',
            email='rh@test.com',
            password=make_password('test123456'),
            role='RH',
            is_staff=True
        )
        rh.groups.add(rh_group)

def remove_initial_data(apps, schema_editor):
    User = apps.get_model('recruitment', 'User')
    User.objects.filter(username__in=['admin', 'rh_test']).delete()

class Migration(migrations.Migration):
    dependencies = [
        ('recruitment', '0002_user'), # Vérifie que c'est le bon nom ici
    ]

    operations = [
        migrations.RunPython(create_initial_data, remove_initial_data),
    ]