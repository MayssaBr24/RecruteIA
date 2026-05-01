from celery.schedules import crontab

CELERYBEAT_SCHEDULE = {
    'process-expired-offers': {
        'task': 'recruitment.tasks.process_expired_offers',
        'schedule': crontab(hour=0, minute=0),  # Minuit chaque jour
    },
}
