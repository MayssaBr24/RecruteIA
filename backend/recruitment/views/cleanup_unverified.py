from django.core.management.base import BaseCommand
from django.utils import timezone
from recruitment.models import EmailVerification

class Command(BaseCommand):
    help = 'Supprime les candidatures non confirmées expirées'

    def handle(self, *args, **kwargs):
        expired = EmailVerification.objects.filter(
            is_verified=False,
            expires_at__lt=timezone.now()
        ).select_related('application')

        count = expired.count()
        for v in expired:
            if v.application:
                v.application.delete()
            v.delete()

        self.stdout.write(f'{count} candidatures expirées supprimées.')