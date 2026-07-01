import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
    LayoutDashboard, Users, Briefcase, FileText,
    LogOut, ChevronRight, Menu, X, UserCheck, Building2
} from 'lucide-react'
import { cn } from "../../../lib/utils"
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { useAuth } from "../../context/AuthContext.tsx"
import { getUser } from '../../lib/auth'

const menuItems = [
    { title: 'Dashboard',       icon: LayoutDashboard, path: '/admin',              roles: ['ADMIN', 'SUPERADMIN'] },
    { title: 'Utilisateurs',    icon: Users,           path: '/admin/users',        roles: ['ADMIN'] },
    { title: 'Companies',       icon: Building2,       path: '/admin/companies',    roles: ['SUPERADMIN'] },
    { title: "Offres d'Emploi", icon: Briefcase,       path: '/admin/offers',       roles: ['ADMIN'] },
    { title: 'Candidatures',    icon: FileText,        path: '/admin/applications', roles: ['ADMIN'] },
    { title: 'Employés',        icon: UserCheck,       path: '/admin/employees',    roles: ['ADMIN'] },
]

export function AdminSidebar() {
    const [isMobileOpen, setIsMobileOpen] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const { userRole, logout } = useAuth()
    const location = useLocation()
    const navigate = useNavigate()
    const user = getUser()

    const username = typeof user?.username === 'string' ? user.username : 'Admin'
    const companyName = typeof user?.company_name === 'string' ? user.company_name : ''
    const initials = username.slice(0, 2).toUpperCase()
    const isSuperAdmin = user?.role === 'SUPERADMIN'

    const filteredItems = menuItems.filter(item => item.roles.includes(userRole ?? ''))

    useEffect(() => {
        const check = () => {
            setIsMobile(window.innerWidth < 768)
            if (window.innerWidth >= 768) setIsMobileOpen(false)
        }
        check()
        window.addEventListener('resize', check)
        return () => window.removeEventListener('resize', check)
    }, [])

    const SidebarContent = () => (
        <div
            className="flex flex-col h-full"
            style={{ background: '#13151f', borderRight: '0.5px solid rgba(255,255,255,0.06)' }}
        >
            {/* Logo */}
            <div
                className="flex items-center gap-3 px-4 py-4"
                style={{ borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}
            >
                {/* Image avec bordure dégradée */}
                <div
                    className="w-9 h-9 rounded-full flex-shrink-0 p-0.5"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899)' }}
                >
                    <img
                        src="/1.jpeg"
                        alt="Logo RecrutIA"
                        className="w-full h-full object-cover rounded-full"
                        style={{ display: 'block' }}
                    />
                </div>

                <div>
                    <span
                        className="text-base font-medium"
                        style={{
                            background: 'linear-gradient(135deg, #818cf8, #a78bfa, #f472b6)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}
                    >
                        RecrutIA
                    </span>
                    <p className="text-xs" style={{ color: '#475569' }}>
                        Intelligent Recruitment
                    </p>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
                <p
                    className="text-xs px-2 mb-2 mt-1"
                    style={{ color: '#475569', letterSpacing: '0.08em' }}
                >
                    NAVIGATION
                </p>
                {filteredItems.map((item) => {
                    const Icon = item.icon
                    const isActive = location.pathname === item.path
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => isMobile && setIsMobileOpen(false)}
                            className={cn(
                                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150"
                            )}
                            style={isActive ? {
                                background: 'rgba(99,102,241,0.15)',
                                border: '0.5px solid rgba(99,102,241,0.25)',
                                color: '#a5b4fc',
                            } : {
                                color: '#64748b',
                            }}
                            onMouseEnter={e => {
                                if (!isActive) (e.currentTarget as HTMLAnchorElement).style.color = '#cbd5e1'
                            }}
                            onMouseLeave={e => {
                                if (!isActive) (e.currentTarget as HTMLAnchorElement).style.color = '#64748b'
                            }}
                        >
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            <span>{item.title}</span>
                            {isActive && (
                                <ChevronRight className="w-3 h-3 ml-auto" style={{ color: '#6366f1' }} />
                            )}
                        </Link>
                    )
                })}
            </nav>

            {/* Footer */}
            <div
                className="p-3"
                style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)' }}
            >
                {/* User info */}
                <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
                    <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium text-white flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                    >
                        {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate" style={{ color: '#cbd5e1' }}>
                            {username}
                        </div>
                        <div className="text-xs truncate" style={{ color: '#475569' }}>
                            {isSuperAdmin ? 'Super Admin' : companyName || 'Admin Entreprise'}
                        </div>
                    </div>
                </div>

                {/* Logout */}
                <button
                    onClick={() => { logout(); navigate('/login', { replace: true }) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150"
                    style={{ color: '#475569' }}
                    onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.color = '#f87171'
                        ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(248,113,113,0.08)'
                    }}
                    onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.color = '#475569'
                        ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                    }}
                >
                    <LogOut className="w-4 h-4" />
                    <span>Déconnexion</span>
                </button>
            </div>
        </div>
    )

    return (
        <>
            {/* Mobile toggle */}
            {isMobile && (
                <button
                    onClick={() => setIsMobileOpen(!isMobileOpen)}
                    className="fixed left-4 top-4 z-50 p-2 rounded-lg md:hidden"
                    style={{ background: '#6366f1' }}
                >
                    {isMobileOpen
                        ? <X className="w-4 h-4 text-white" />
                        : <Menu className="w-4 h-4 text-white" />
                    }
                </button>
            )}

            {/* Mobile overlay */}
            <AnimatePresence>
                {isMobile && isMobileOpen && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setIsMobileOpen(false)}
                        className="fixed inset-0 z-40 md:hidden"
                        style={{ background: 'rgba(0,0,0,0.6)' }}
                    />
                )}
            </AnimatePresence>

            {/* Sidebar */}
            <AnimatePresence>
                {(!isMobile || isMobileOpen) && (
                    <motion.aside
                        initial={isMobile ? { x: -240 } : false}
                        animate={{ x: 0 }}
                        exit={{ x: -240 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className={cn("h-full z-50", isMobile ? "fixed w-60" : "w-56 flex-shrink-0")}
                    >
                        <SidebarContent />
                    </motion.aside>
                )}
            </AnimatePresence>
        </>
    )
}