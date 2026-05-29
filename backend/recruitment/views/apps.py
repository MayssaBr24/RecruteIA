class RecruitmentConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'recruitment'

    def ready(self):
        import recruitment.signals  # ← importer les signals