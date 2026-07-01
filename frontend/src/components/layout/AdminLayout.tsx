import { AdminSidebar } from "../../pages/admin/AdminSidebar.tsx";
import { AnimatePresence } from "framer-motion";
import { Outlet, useLocation } from "react-router-dom";

const breadcrumbMap: Record<string, string> = {
    '/admin': 'Dashboard',
    '/admin/users': 'Utilisateurs',
    '/admin/offers': "Offres d'emploi",
    '/admin/applications': 'Candidatures',
    '/admin/employees': 'Employés',
    '/admin/companies': 'Companies',
}

export function AdminLayout() {
    const location = useLocation()
    const currentLabel = breadcrumbMap[location.pathname] ?? 'Dashboard'

    return (
        <div className="flex h-screen overflow-hidden" style={{ background: '#0f1117' }}>
            <AdminSidebar />

            <div className="flex flex-col flex-1 overflow-hidden">
                {/* Topbar */}
                <div
                    className="flex items-center justify-between px-5 flex-shrink-0"
                    style={{
                        height: 48,
                        background: '#13151f',
                        borderBottom: '0.5px solid rgba(255,255,255,0.06)',
                    }}
                >
                    <div className="flex items-center gap-2 text-xs" style={{ color: '#475569' }}>
                        <span style={{ color: '#94a3b8' }}>Admin</span>
                        <span>›</span>
                        <span style={{ color: '#94a3b8' }}>{currentLabel}</span>
                    </div>
                    <div
                        className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full"
                        style={{
                            background: 'rgba(99,102,241,0.15)',
                            color: '#a5b4fc',
                            border: '0.5px solid rgba(99,102,241,0.25)',
                        }}
                    >
                        <span>IA Active</span>
                    </div>
                </div>

                {/* Main content */}
                <main className="flex-1 overflow-y-auto p-6">
                    <AnimatePresence mode="wait">
                        <Outlet />
                    </AnimatePresence>
                </main>
            </div>
        </div>
    )
}