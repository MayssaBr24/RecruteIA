# recruitment/views/__init__.py

# Job views
from .job_views import (
    JobOfferListCreateView,
    JobOfferDetailView,
    RHJobOfferListView,
    JobOfferWeightsUpdateView,
)

# Application views
from .application_views import (
    ApplicationCreateView,
    ApplicationListView,
    ApplicationDetailView,
ApplicationAIReportView
)


from .interview_views import (
    InterviewCancelView,
    InterviewConfirmView,
    InterviewListCreateView,
    InterviewDetailView,
    _index_application_documents,
    AIInterviewStartView,
    AIInterviewAnswerView,
    _detect_contradiction_for_view,
    AIInterviewFinalizeView,
    AIInterviewWarningView,
    AIInterviewAudioView,
    AIInterviewVideoUploadView,
    AIInterviewVideoView,
    AIInterviewStatusView,
    RHInterviewListView,
    RHInterviewAnnotationView,
    RHJobOfferComparisonView,
    launchAInterview,
    delete_candidate_rag_data,
    get_candidate_rag_stats,
)
from .interview_report import (
AIInterviewReportView
)

from .admin_views import (
    # Dashboard
    AdminDashboardStatsView,
    AdminDashboardChartsView,
    AdminRecentActivityView,

    # Users
    AdminUserListView,
    AdminUserDetailView,
    AdminUserToggleActiveView,
    AdminUserCreateView,

    # Offers
    AdminOffersListView,
    AdminOfferArchiveView,

    # Applications
    AdminApplicationsListView,

    # System
    AdminSystemSettingsView,
    AdminAuditLogsView,

    # Support
    AdminSupportTicketsView,
    AdminSupportTicketDetailView,
)

# Availability views
from .availability_views import (
    RHAvailabilityListCreateView,
    RHAvailabilityDetailView,
    RHExceptionCreateView,
    RHExceptionDestroyView,
    RHCalendarDataView,
    RHSettingsView,
    AvailableSlotsView,
RHNoteListCreateView,
RHNoteDetailView,
RHNotificationsView,
RHWeekStatsView,
RHOfferTimelineView,



)

# Analytics views
from .analytics_views import (
    AIAnalyticsView,
IncrementViewsView,
MarkHiredView,
TurnoverView,
ForecastingView,
CVMatchView,
CVMatchPreviewView,
RHGlobalAnalyticsView,
)


from .endpoints_OAuth import (
    linkedin_login,
    linkedin_callback,
    github_login,
    github_callback,
)
from .final_interview_views import (
    QualifiedCandidatesView,
    SendInterviewInvitationView,
    InvitationListView,
)

from .Employee_View import (
EmployeeListView,
EmployeeDocumentView,
EmployeeUpdateView,
AddManualEmployeeView,



)
