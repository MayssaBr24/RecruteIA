# backend/systeme_rh/__init__.py
from .celery import app as celery

__all__ = ('celery',)