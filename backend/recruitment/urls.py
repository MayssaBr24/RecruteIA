from django.urls import path
from .views import (
    JobOfferListCreateView,
    JobOfferDetailView,
    ApplicationCreateView,
    RHJobOfferListView,
    ApplicationListView,
    UserRegistrationView,
    AdminUserListView,
    AdminUserDetailView,
    AdminUserToggleActiveView,
    AdminStatsView,
    # Interview Management
    InterviewListCreateView,
    InterviewDetailView,
    InterviewCancelView,
    InterviewConfirmView,
    # === AJOUTE CES IMPORTS ICI ===
    RHAvailabilityListCreateView,
    RHAvailabilityDetailView,
    RHSettingsView,
    AvailableSlotsView,
RHExceptionCreateView,
RHExceptionDestroyView,
ApplicationDetailView

)

urlpatterns = [
    # Routes publiques
    path('jobs/', JobOfferListCreateView.as_view(), name='job-list-create'),
    path('jobs/<int:pk>/', JobOfferDetailView.as_view(), name='job-detail'),
    path('applications/', ApplicationCreateView.as_view(), name='application-create'),

    # Routes protégées RH
    path('rh/jobs/', RHJobOfferListView.as_view(), name='rh-job-list'),
    path('rh/applications/', ApplicationListView.as_view(), name='rh-application-list'),

    # Routes Admin
    path('admin/users/register/', UserRegistrationView.as_view(), name='user-register'),
    path('admin/users/', AdminUserListView.as_view(), name='admin-users-list'),
    path('admin/users/<int:pk>/', AdminUserDetailView.as_view(), name='admin-user-detail'),
    path('admin/users/<int:pk>/toggle-active/', AdminUserToggleActiveView.as_view(), name='admin-user-toggle-active'),

    # Routes Admin - Statistiques
    path('admin/stats/', AdminStatsView.as_view(), name='admin-stats'),

    # Availability Management (Vérifie que ces vues existent bien dans ton fichier views.py)
    path('rh/availabilities/', RHAvailabilityListCreateView.as_view(), name='rh-availability-list'),
    path('rh/availabilities/<int:pk>/', RHAvailabilityDetailView.as_view(), name='rh-availability-detail'),

    # ============ INTERVIEWS ============
    path('rh/interviews/', InterviewListCreateView.as_view(), name='rh-interview-list'),
    path('rh/interviews/<int:pk>/', InterviewDetailView.as_view(), name='rh-interview-detail'),
    path('rh/interviews/<int:pk>/cancel/', InterviewCancelView.as_view(), name='rh-interview-cancel'),
    path('rh/interviews/<int:pk>/confirm/', InterviewConfirmView.as_view(), name='rh-interview-confirm'),

    # ============ SETTINGS & SLOTS ============
    path('rh/settings/', RHSettingsView.as_view(), name='rh-settings'),
    path('rh/available-slots/', AvailableSlotsView.as_view(), name='rh-available-slots'),
path('rh/exceptions/', RHExceptionCreateView.as_view(), name='rh-exceptions'),

    # ROUTE MANQUANTE : pour supprimer (le <int:pk> est crucial)
    path('rh/exceptions/<int:pk>/', RHExceptionDestroyView.as_view(), name='rh-exception-detail'),
    path('applications/<int:pk>/', ApplicationDetailView.as_view(), name='application-detail'),

]
