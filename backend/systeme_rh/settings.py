import os
from pathlib import Path
from datetime import timedelta
from decouple import config
import pymysql
from pathlib import Path
from dotenv import load_dotenv
import os
import chromadb

chromadb.config.Settings(anonymized_telemetry=False)
BASE_DIR = Path(__file__).resolve().parent.parent

# ✅ Chemin absolu explicite

# OU version portable (recommandée)
load_dotenv(BASE_DIR / '.env', override=True)

pymysql.install_as_MySQLdb()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config('SECRET_KEY')
DEBUG = config('DEBUG', default=False, cast=bool)
ALLOWED_HOSTS = ['localhost', '127.0.0.1']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django_extensions',
    'django_celery_beat',

    # Third party
    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt',

    # Local apps
    'recruitment',
    'social_django',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'systeme_rh.urls'

AUTHENTICATION_BACKENDS = [
    'social_core.backends.linkedin.LinkedinOAuth2',
    'social_core.backends.github.GithubOAuth2',
    'django.contrib.auth.backends.ModelBackend',
]

# LinkedIn
SOCIAL_AUTH_LINKEDIN_OAUTH2_KEY = '779gyqojie0efx'
SOCIAL_AUTH_LINKEDIN_OAUTH2_SECRET = 'WPL_AP1.ve95eO5OyOxs4X70.E5xYfQ=='
SOCIAL_AUTH_LINKEDIN_OAUTH2_SCOPE = ['openid', 'profile', 'email']

# GitHub
SOCIAL_AUTH_GITHUB_KEY = 'Ov23libQOs0zYRaqLlrE'
SOCIAL_AUTH_GITHUB_SECRET = '9dc94fa25c5e343d33ed8234d402eaea6fe712d8'
SOCIAL_AUTH_GITHUB_SCOPE = ['read:user', 'user:email']

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'systeme_rh.wsgi.application'

# Database - MySQL
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': config('DB_NAME'),
        'USER': config('DB_USER'),
        'PASSWORD': config('DB_PASSWORD'),
        'HOST': config('DB_HOST'),
        'PORT': config('DB_PORT'),
        'OPTIONS': {
            'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
            'charset': 'utf8mb4',
        }
    }
}

# Custom User Model
AUTH_USER_MODEL = 'recruitment.User'

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Internationalization
LANGUAGE_CODE = 'fr-fr'
TIME_ZONE = 'Africa/Tunis'
USE_I18N = True
USE_TZ = True

# Static files
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# CORS Settings
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
CORS_ALLOW_CREDENTIALS = True

SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_HTTPONLY = True

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.AllowAny',
    ),

}
# JWT Settings
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=config('JWT_ACCESS_TOKEN_LIFETIME', default=60, cast=int)),
    'REFRESH_TOKEN_LIFETIME': timedelta(minutes=config('JWT_REFRESH_TOKEN_LIFETIME', default=1440, cast=int)),
    'ROTATE_REFRESH_TOKENS': False,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'AUTH_HEADER_TYPES': ('Bearer',),
}
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")

FRONTEND_URL = config('FRONTEND_URL', 'http://localhost:3000')

# Celery Configuration - REDIS
CELERY_BROKER_URL = config('CELERY_BROKER_URL', 'redis://localhost:6381/0')
CELERY_RESULT_BACKEND = config('CELERY_RESULT_BACKEND', 'redis://localhost:6381/1')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'Africa/Tunis'
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
CELERY_BROKER_TRANSPORT_OPTIONS = {'visibility_timeout': 3600}
CELERY_TASK_SOFT_TIME_LIMIT = 60 # evite tache bloque worker
CELERY_TASK_TIME_LIMIT = 120 # evite tache bloque worker
# Celery Beat schedule
from celery.schedules import crontab
CELERY_BEAT_SCHEDULE = {
    'process-expired-offers-daily': {
        'task': 'recruitment.tasks.process_expired_offers',
        'schedule': crontab(hour=0, minute=0),
    },
}

# settings.py
ANONYMIZED_TELEMETRY = False
# settings.py

EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'sandbox.smtp.mailtrap.io'
EMAIL_PORT = 2525
EMAIL_USE_TLS = True  # STARTTLS
EMAIL_HOST_USER = 'b146b7b9f61451'  # ton username Mailtrap
EMAIL_HOST_PASSWORD = '331dd1e4a32c0b'    # ton mot de passe Mailtrap
DEFAULT_FROM_EMAIL = 'noreply@recrutement-ia.com'

RECAPTCHA_SECRET_KEY='6LdZUNosAAAAAPHlq4hfPIPEtKmZLB8Tmj3ejoJJ'
RECAPTCHA_SITE_KEY='6LdZUNosAAAAAINqS8fCQMLL41UCt2JwWrvrd7qK'
EMAIL_VERIFICATION_EXPIRY_HOURS = 24