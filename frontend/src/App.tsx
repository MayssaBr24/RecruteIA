import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { PublicDashboard } from './pages/PublicDashboard'
import { JobDetailsPage } from './pages/JobDetailsPage'
import { LoginPage } from './pages/LoginPage'
import { ApplicationFormPage } from './pages/ApplicationFormPage'
import CandidateDetailsPage from './pages/CandidateDetailsPage'
import AIInterviewPage from './pages/Interview/InterviewPage.tsx'

// Layouts
import { RHLayout } from './components/rh/layout/RHLayout'

// RH Pages
import { OverviewPage }      from './pages/rh/OverviewPage'
import { OffersPage }        from './pages/rh/OffersPage'
import { ApplicationsPage }  from './pages/rh/ApplicationsPage'
import { InterviewsPage }    from './pages/rh/InterviewsPage'
import { AnalyticsPage }     from './pages/rh/AnalyticsPage'
import { ForecastingPage }   from './pages/rh/ForecastingPage'
import { TurnoverPage }      from './pages/rh/TurnoverPage'
import { PlanningPage }      from './pages/rh/PlanningPage'
import { CreateJobPage }     from "./pages/rh/CreateJobPag.tsx"
import QualifiedCandidate    from "./pages/rh/QualifiedCandidate.tsx"

// Admin Pages
import AdminDashboard        from "./pages/admin/AdminDashboard.tsx"
import UsersManagement       from "./pages/admin/UsersManagement.tsx"
import OffersSupervision     from "./pages/admin/OffersSupervision.tsx"
import ApplicationsSupervision from "./pages/admin/ApplicationsSupervision.tsx"
import {AdminLayout} from "./components/layout/AdminLayout.tsx";
import {EmployeesPage} from "./pages/rh/EmployeesPage.tsx";
import InterviewReportPage from "./pages/rh/InterviewReportPage.tsx";

export default function App() {
    return (
        <Router>
            <AuthProvider>
                <Routes>
                    {/* Public */}
                    <Route path="/" element={<PublicDashboard />} />
                    <Route path="/jobs/:id" element={<JobDetailsPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/apply/:id" element={<ApplicationFormPage />} />
                    <Route path="/interview/:token" element={<AIInterviewPage />} />

                    {/* RH — layout avec sidebar */}
                    <Route
                        path="/rh"
                        element={
                            <ProtectedRoute requiredRole="RH">
                                <RHLayout />
                            </ProtectedRoute>
                        }
                    >
                        <Route index element={<OverviewPage />} />
                        <Route path="offers" element={<OffersPage />} />
                        <Route path="applications" element={<ApplicationsPage />} />
                        <Route path="interviews" element={<InterviewsPage />} />
                        <Route path="/rh/interviews/:token/report" element={<InterviewReportPage />} />
                        <Route path="analytics" element={<AnalyticsPage />} />
                        <Route path="forecasting" element={<ForecastingPage />} />
                        <Route path="turnover" element={<TurnoverPage />} />
                        <Route path="planning" element={<PlanningPage />} />
                        <Route path="offers/create" element={<CreateJobPage />} />
                        <Route path="recruitment" element={<QualifiedCandidate />} />
                        <Route path="applications/:id" element={<CandidateDetailsPage />} />
                        <Route path="employees" element={<EmployeesPage />} />
                        <Route path="offers/:id" element={<JobDetailsPage />} />
                    </Route>


                    {/* Admin — layout avec sidebar */}
                    <Route
                        path="/admin"
                        element={
                            <ProtectedRoute requiredRole="ADMIN">
                                <AdminLayout />
                            </ProtectedRoute>
                        }
                    >
                        <Route index element={<AdminDashboard />} />
                        <Route path="users" element={<UsersManagement />} />
                        <Route path="offers" element={<OffersSupervision />} />
                        <Route path="applications" element={<ApplicationsSupervision />} />
                        <Route path="employees" element={<EmployeesPage />} />

                    </Route>


                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </AuthProvider>
        </Router>
    )
}