from django.urls import path
from .views import (
    JobOfferListCreateView, JobOfferDetailView, ApplicationCreateView,
    RHJobOfferListView, ApplicationListView,
     InterviewDetailView,
    InterviewCancelView, InterviewConfirmView, AvailableSlotsView,
    ApplicationDetailView, AIAnalyticsView, AIInterviewStartView,
    AIInterviewAnswerView, AIInterviewWarningView, AIInterviewStatusView,
    JobOfferWeightsUpdateView, AIInterviewFinalizeView, AIInterviewAudioView,
     CVMatchView, ForecastingView, TurnoverView,
    MarkHiredView, IncrementViewsView, RHInterviewListView, CVMatchPreviewView,
    RHAvailabilityListCreateView, RHAvailabilityDetailView,
    RHExceptionCreateView, RHExceptionDestroyView, RHCalendarDataView,
    RHSettingsView, RHNoteListCreateView, RHNoteDetailView,
    RHNotificationsView, RHWeekStatsView, RHOfferTimelineView,
    linkedin_login, linkedin_callback, github_login, github_callback,
    AIInterviewVideoUploadView,
    AIInterviewVideoView, QualifiedCandidatesView,
    SendInterviewInvitationView,
    InvitationListView, RHGlobalAnalyticsView,
    AdminDashboardStatsView,
    AdminDashboardChartsView,
    AdminRecentActivityView, EmployeeListView,
    EmployeeDocumentView,
    EmployeeUpdateView,
    AddManualEmployeeView,
    AdminUserListView,
    AdminUserDetailView,
    AdminUserToggleActiveView,
    AdminUserCreateView, AdminOffersListView, AdminOfferArchiveView,
    AdminApplicationsListView, AdminSystemSettingsView,
    AdminAuditLogsView, AdminSupportTicketsView, AdminSupportTicketDetailView,
    launchAInterview, ApplicationAIReportView,
    RHInterviewAnnotationView,
    RHJobOfferComparisonView,AIInterviewReportView
)

urlpatterns = [
    # ── Public ──────────────────────────────────────────────────────
    path('jobs/', JobOfferListCreateView.as_view(), name='job-list-create'),
    path('jobs/<int:pk>/', JobOfferDetailView.as_view(), name='job-detail'),
    path('applications/', ApplicationCreateView.as_view(), name='application-create'),
    path('applications/<int:pk>/', ApplicationDetailView.as_view(), name='application-detail'),

    # ── OAuth ────────────────────────────────────────────────────────
    path('auth/linkedin/', linkedin_login, name='linkedin-login'),
    path('auth/linkedin/callback/', linkedin_callback, name='linkedin-callback'),
    path('auth/github/', github_login, name='github-login'),
    path('auth/github/callback/', github_callback, name='github-callback'),

    # ── RH Jobs ─────────────────────────────────────────────────────
    path('rh/jobs/', RHJobOfferListView.as_view(), name='rh-job-list'),
    path('rh/jobs/<int:pk>/', JobOfferDetailView.as_view(), name='rh-job-detail'),
    path('rh/jobs/<int:pk>/update_weights/', JobOfferWeightsUpdateView.as_view(), name='job-update-weights'),

    # ── RH Applications ─────────────────────────────────────────────
    path('rh/applications/', ApplicationListView.as_view(), name='rh-application-list'),
    path('rh/applications/<int:app_id>/hire/', MarkHiredView.as_view(), name='mark-hired'),

    # ── RH Interviews ───────────────────────────────────────────────
    path('rh/interviews/', RHInterviewListView.as_view(), name='rh-interview-list'),
    path('rh/interviews/<int:pk>/cancel/', InterviewCancelView.as_view(), name='rh-interview-cancel'),
    path('rh/interviews/<int:pk>/confirm/', InterviewConfirmView.as_view(), name='rh-interview-confirm'),


    # ✅ Route générique EN DERNIER
    path('rh/interviews/<int:pk>/', InterviewDetailView.as_view(), name='rh-interview-detail'),
    path('rh/interviews/<uuid:token>/video/', AIInterviewVideoView.as_view(), name='rh-interview-video'),

    # ── Annotations & Comparaison (priorité 3) ──────────────────────
    path('rh/interviews/<str:token>/annotation/', RHInterviewAnnotationView.as_view(), name='rh-interview-annotation'),
    path('rh/job-offers/<int:job_offer_id>/comparison/', RHJobOfferComparisonView.as_view(), name='rh-job-comparison'),

    # ── RH Availability ─────────────────────────────────────────────

    path('rh/availabilities/', RHAvailabilityListCreateView.as_view(), name='rh-availability-list'),
    path('rh/availabilities/<int:pk>/', RHAvailabilityDetailView.as_view(), name='rh-availability-detail'),
    path('rh/available-slots/', AvailableSlotsView.as_view(), name='rh-available-slots'),
    path('rh/exceptions/', RHExceptionCreateView.as_view(), name='rh-exceptions'),
    path('rh/exceptions/<int:pk>/', RHExceptionDestroyView.as_view(), name='rh-exception-detail'),

    # ── RH Settings & Calendar ──────────────────────────────────────
    path('rh/settings/', RHSettingsView.as_view(), name='rh-settings'),
    path('rh/calendar/', RHCalendarDataView.as_view(), name='rh-calendar'),

    # ── RH Notes & Notifications ────────────────────────────────────
    path('rh/notes/', RHNoteListCreateView.as_view(), name='rh-notes'),
    path('rh/notes/<int:note_id>/', RHNoteDetailView.as_view(), name='rh-note-detail'),
    path('rh/notifications/', RHNotificationsView.as_view(), name='rh-notifications'),

    # ── RH Analytics ────────────────────────────────────────────────
    path('rh/ai-analytics/', AIAnalyticsView.as_view(), name='ai-analytics'),
    path('rh/week-stats/', RHWeekStatsView.as_view(), name='rh-week-stats'),
    path('rh/offer-timeline/', RHOfferTimelineView.as_view(), name='rh-offer-timeline'),
    path('rh/cv-match/<int:offer_id>/', CVMatchView.as_view(), name='cv-match'),
    path('rh/cv-match-preview/', CVMatchPreviewView.as_view(), name='cv-match-preview'),
    path('rh/forecasting/', ForecastingView.as_view(), name='forecasting'),
    path('rh/turnover/', TurnoverView.as_view(), name='turnover'),

    # ── AI Interview — ANCIENNES routes (gardées pour compatibilité) ─
    path('interview/<uuid:token>/start/',    AIInterviewStartView.as_view(),    name='interview-start'),
    path('interview/<uuid:token>/answer/',   AIInterviewAnswerView.as_view(),   name='interview-answer'),
    path('interview/<uuid:token>/warning/',  AIInterviewWarningView.as_view(),  name='interview-warning'),
    path('interview/<uuid:token>/status/',   AIInterviewStatusView.as_view(),   name='interview-status'),
    path('interview/<uuid:token>/finalize/', AIInterviewFinalizeView.as_view(), name='interview-finalize'),
    path('interview/<uuid:token>/audio/',    AIInterviewAudioView.as_view(),    name='interview-audio'),

    # ── AI Interview — NOUVELLES routes (utilisées par le frontend) ──
    # Le frontend appelle /ai-interview/<token>/...
    path('ai-interview/<uuid:token>/start/',    AIInterviewStartView.as_view(),    name='ai-interview-start'),
    path('ai-interview/<uuid:token>/answer/',   AIInterviewAnswerView.as_view(),   name='ai-interview-answer'),
    path('ai-interview/<uuid:token>/warning/',  AIInterviewWarningView.as_view(),  name='ai-interview-warning'),
    path('ai-interview/<uuid:token>/status/',   AIInterviewStatusView.as_view(),   name='ai-interview-status'),
    path('ai-interview/<uuid:token>/finalize/', AIInterviewFinalizeView.as_view(), name='ai-interview-finalize'),
    path('ai-interview/<uuid:token>/audio/',    AIInterviewAudioView.as_view(),    name='ai-interview-audio'),
    path('ai-interview/<uuid:token>/video/', AIInterviewVideoUploadView.as_view(), name='ai-interview-video-upload'),

    path('ai-interview/<uuid:token>/report/',   AIInterviewReportView.as_view(),   name='ai-interview-report'),

    # ── Misc ────────────────────────────────────────────────────────
    path('offers/<int:offer_id>/view/', IncrementViewsView.as_view(), name='increment-views'),
    path('rh/applications/<int:application_id>/launch-interview/', launchAInterview, name='launch-ai-interview'),


    # ── Candidats qualifiés & Invitations ───────────────────────────
    path('rh/qualified-candidates/', QualifiedCandidatesView.as_view(), name='qualified-candidates'),
    path('rh/send-invitation/',      SendInterviewInvitationView.as_view(), name='send-invitation'),
    path('rh/invitations/',          InvitationListView.as_view(), name='invitations-list'),
    path('rh/global-interview-analytics/', RHGlobalAnalyticsView.as_view(), name='global-analytics'),

    # ── Admin Dashboard ─────────────────────────────────────────────
    path('admin/dashboard/stats/',    AdminDashboardStatsView.as_view(),  name='admin-dashboard-stats'),
    path('admin/dashboard/charts/',   AdminDashboardChartsView.as_view(), name='admin-dashboard-charts'),
    path('admin/dashboard/activity/', AdminRecentActivityView.as_view(),  name='admin-recent-activity'),

    # ── Admin Users ─────────────────────────────────────────────────
    path('admin/users/',                    AdminUserListView.as_view(),         name='admin-users-list'),
    path('admin/users/create/',             AdminUserCreateView.as_view(),       name='admin-user-create'),
    path('admin/users/<int:pk>/',           AdminUserDetailView.as_view(),       name='admin-user-detail'),
    path('admin/users/<int:pk>/toggle-active/', AdminUserToggleActiveView.as_view(), name='admin-user-toggle'),

    # ── Admin Offers ────────────────────────────────────────────────
    path('admin/offers/',              AdminOffersListView.as_view(),  name='admin-offers-list'),
    path('admin/offers/<int:pk>/archive/', AdminOfferArchiveView.as_view(), name='admin-offer-archive'),

    # ── Admin Applications ──────────────────────────────────────────
    path('admin/applications/', AdminApplicationsListView.as_view(), name='admin-applications-list'),

    # ── Admin System ────────────────────────────────────────────────
    path('admin/settings/',    AdminSystemSettingsView.as_view(), name='admin-settings'),
    path('admin/audit-logs/',  AdminAuditLogsView.as_view(),      name='admin-audit-logs'),

    # ── Admin Support ───────────────────────────────────────────────
    path('admin/tickets/',          AdminSupportTicketsView.as_view(),       name='admin-tickets-list'),
    path('admin/tickets/<int:pk>/', AdminSupportTicketDetailView.as_view(),  name='admin-ticket-detail'),

    # ── AI Report ───────────────────────────────────────────────────
    path('rh/applications/<int:pk>/ai-report/', ApplicationAIReportView.as_view()),

    # ── Employees ───────────────────────────────────────────────────
    path('rh/employees/',                    EmployeeListView.as_view()),
    path('rh/employees/<int:pk>/',           EmployeeUpdateView.as_view()),
    path('rh/employees/<int:pk>/documents/', EmployeeDocumentView.as_view()),
    path('rh/employees/add-manual/',         AddManualEmployeeView.as_view()),





]