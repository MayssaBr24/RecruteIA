from django.db import migrations

def link_phone_to_user(apps, schema_editor):
    User = apps.get_model('recruitment', 'User')
    for i, user in enumerate(User.objects.all()):
        if not user.phone:
            # On génère un numéro temporaire unique basé sur l'ID ou l'index
            user.phone = f"0000000{user.id}" 
            user.save()

class Migration(migrations.Migration):
    dependencies = [
        ('recruitment', '0004_user_phone'), # Vérifiez le nom ici
    ]
    operations = [
        migrations.RunPython(link_phone_to_user),
    ]