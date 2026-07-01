import {
    Loader2,
    AlertCircle,
    LayoutDashboard,
    ChevronRight,
    RefreshCw
} from 'lucide-react'
import { useAdminDashboard } from '../../hooks/useAdminDashboard'
import { Button } from '../../../components/ui/button'
import { AdminKPICards } from './dashboard/AdminKPICards'
import { AdminCharts } from './dashboard/AdminCharts'
import { RecentActivityTable } from './dashboard/RecentActivityTable'
import { motion, AnimatePresence } from 'framer-motion'
import { getUser } from '../../lib/auth'

export default function AdminDashboard() {
    const { stats, charts, activities, loading, error, refetch } = useAdminDashboard()

    const user = getUser()
    const isSuperAdmin = user?.role === 'SUPERADMIN'
    const username = typeof user?.username === 'string' ? user.username : 'Administrateur'
    const companyName = typeof user?.company_name === 'string' ? user.company_name : 'Votre entreprise'
    const hour = new Date().getHours()
    const greeting = hour < 12 ? 'Bon matin' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3"
                             style={{ color: '#6366f1' }} />
                    <p className="text-sm" style={{ color: '#64748b' }}>
                        Chargement du tableau de bord...
                    </p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <div
                    className="rounded-xl p-8 max-w-sm w-full text-center"
                    style={{
                        background: '#1a1d2e',
                        border: '0.5px solid rgba(248,113,113,0.2)'
                    }}
                >
                    <AlertCircle className="w-8 h-8 mx-auto mb-3" style={{ color: '#f87171' }} />
                    <p className="text-sm font-medium mb-1" style={{ color: '#e2e8f0' }}>
                        Une erreur est survenue
                    </p>
                    <p className="text-xs mb-5" style={{ color: '#64748b' }}>{error}</p>
                    <Button onClick={refetch} className="w-full gap-2"
                            style={{ background: '#6366f1', color: '#fff', border: 'none' }}>
                        <RefreshCw className="w-3.5 h-3.5" /> Réessayer
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
            >
                {/* Page Header */}
                <div
                    className="rounded-xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
                    style={{
                        background: '#1a1d2e',
                        border: '0.5px solid rgba(255,255,255,0.07)',
                    }}
                >
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div
                                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: 'rgba(99,102,241,0.15)', border: '0.5px solid rgba(99,102,241,0.25)' }}
                            >
                                <LayoutDashboard className="w-4 h-4" style={{ color: '#a5b4fc' }} />
                            </div>
                            <div>
                                <h1 className="text-lg font-medium" style={{ color: '#e2e8f0' }}>
                                    Tableau de bord
                                </h1>
                                <p className="text-xs" style={{ color: '#475569' }}>
                                    {greeting},{' '}
                                    <span style={{ color: '#a5b4fc' }}>{username}</span>
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs pl-12" style={{ color: '#475569' }}>
                            <span>{isSuperAdmin ? '🌐' : '🏢'}</span>
                            <span>{isSuperAdmin ? 'Super Admin' : 'Admin Entreprise'}</span>
                            <ChevronRight className="w-3 h-3" />
                            <span style={{ color: '#6366f1' }}>
                                {isSuperAdmin ? 'Vue globale' : companyName}
                            </span>
                        </div>
                    </div>

                    {/* Stats rapides */}
                    <div className="flex gap-3 pl-12 lg:pl-0">
                        <div
                            className="px-4 py-2.5 rounded-lg text-center"
                            style={{
                                background: 'rgba(99,102,241,0.08)',
                                border: '0.5px solid rgba(99,102,241,0.2)'
                            }}
                        >
                            <p className="text-xs mb-0.5" style={{ color: '#475569' }}>Taux d'activité</p>
                            <p className="text-xl font-medium" style={{ color: '#a5b4fc' }}>
                                {stats?.conversion_rate ?? 0}%
                            </p>
                        </div>
                        <div
                            className="px-4 py-2.5 rounded-lg text-center"
                            style={{
                                background: 'rgba(99,102,241,0.08)',
                                border: '0.5px solid rgba(99,102,241,0.2)'
                            }}
                        >
                            <p className="text-xs mb-0.5" style={{ color: '#475569' }}>Utilisateurs</p>
                            <p className="text-xl font-medium" style={{ color: '#a5b4fc' }}>
                                {stats?.users?.total ?? 0}
                            </p>
                        </div>
                        <button
                            onClick={refetch}
                            className="px-3 py-2.5 rounded-lg transition-all duration-150 flex items-center gap-1.5 text-xs"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.07)', color: '#475569' }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'
                                ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)'
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLButtonElement).style.color = '#475569'
                                ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'
                            }}
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Rafraîchir</span>
                        </button>
                    </div>
                </div>

                {/* Divider avec label */}
                <div className="flex items-center gap-3">
                    <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.05)' }} />
                    <span className="text-xs" style={{ color: '#334155', letterSpacing: '0.08em' }}>
                        VUE D'ENSEMBLE
                    </span>
                    <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.05)' }} />
                </div>

                {/* KPI Cards */}
                {stats && <AdminKPICards stats={stats} />}

                {/* Charts */}
                {charts && charts.applications_trend.length > 0 && (
                    <div
                        className="rounded-xl p-5"
                        style={{
                            background: '#1a1d2e',
                            border: '0.5px solid rgba(255,255,255,0.07)'
                        }}
                    >
                        <AdminCharts charts={charts} />
                    </div>
                )}

                {/* Activity */}
                {activities.length > 0 && (
                    <RecentActivityTable activities={activities} />
                )}
            </motion.div>
        </AnimatePresence>
    )
}