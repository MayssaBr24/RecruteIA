# signals.py
from django.contrib.auth.signals import user_logged_in, user_logged_out
from django.dispatch import receiver
from .models import ActivityLog

@receiver(user_logged_in)
def log_login(sender, request, user, **kwargs):
    ActivityLog.objects.create(
        user=user,
        activity_type='login',
        description=f'{user.username} s\'est connecté',
        ip_address=request.META.get('REMOTE_ADDR', '')
    )

@receiver(user_logged_out)
def log_logout(sender, request, user, **kwargs):
    if user:
        ActivityLog.objects.create(
            user=user,
            activity_type='logout',
            description=f'{user.username} s\'est déconnecté',
            ip_address=request.META.get('REMOTE_ADDR', '')
        )