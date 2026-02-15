import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { PublicDashboard } from './pages/PublicDashboard'
import { JobDetailsPage } from './pages/JobDetailsPage'
import { LoginPage } from './pages/LoginPage'
import RHSpace from './pages/RHSpace'
import AdminSpace from './pages/AdminSpace.tsx'
import AdminUsersPage from "./components/admin/AdminUsersPage.tsx";
import { ApplicationFormPage } from './pages/ApplicationFormPage'
import {CandidateDetailsPage} from "./pages/CandidateDetailsPage.tsx";

export default function App() {
    return (
        <Router>
            <AuthProvider>


                <Routes>
                    {/* Public Routes */}
                    <Route path="/" element={<PublicDashboard />} />
                    <Route path="/jobs/:id" element={<JobDetailsPage />} />
                    <Route path="/login" element={<LoginPage />} />

                    {/* Protected Routes */}
                    <Route
                        path="/rh"
                        element={
                            <ProtectedRoute requiredRole="RH">
                                <RHSpace />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/admin"
                        element={
                            <ProtectedRoute requiredRole="ADMIN">
                                <AdminSpace />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/admin/users"
                        element={
                            <ProtectedRoute requiredRole="ADMIN">
                                <AdminUsersPage />
                            </ProtectedRoute>
                        }
                    />


                    <Route path="/apply/:id" element={<ApplicationFormPage />} />
                    <Route path="/rh/applications/:id" element={<CandidateDetailsPage />} />


                    {/* Fallback */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </AuthProvider>
        </Router>
    )
}