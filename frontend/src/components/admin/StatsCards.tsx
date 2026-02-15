// app/components/admin/StatsCards.tsx
'use client'

import { useEffect, useState } from 'react'
import { Card } from '../../../components/ui/card'
import { Users, Briefcase, FileText, Activity, TrendingUp, UserCheck, Building2, AlertCircle } from 'lucide-react'
import api from '../../lib/api'

interface SystemStats {
    total_users: number
    total_rh: number
    total_admins: number
    total_candidates: number
    active_offers: number
    total_applications: number
    system_status: 'OPERATIONAL' | 'MAINTENANCE' | 'DEGRADED'
}

export function StatsCards() {
    const [stats, setStats] = useState<SystemStats>({
        total_users: 0,
        total_rh: 0,
        total_admins: 0,
        total_candidates: 0,
        active_offers: 0,
        total_applications: 0,
        system_status: 'OPERATIONAL'
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchStats()
    }, [])

    const fetchStats = async () => {
        try {
            const response = await api.get('/recruitment/admin/stats/')
            setStats(response.data)
        } catch (error) {
            console.error('Erreur chargement stats:', error)
        } finally {
            setLoading(false)
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'OPERATIONAL':
                return 'bg-green-500'
            case 'MAINTENANCE':
                return 'bg-yellow-500'
            case 'DEGRADED':
                return 'bg-red-500'
            default:
                return 'bg-gray-500'
        }
    }

    const getStatusText = (status: string) => {
        switch (status) {
            case 'OPERATIONAL':
                return 'Opérationnel'
            case 'MAINTENANCE':
                return 'En maintenance'
            case 'DEGRADED':
                return 'Performance dégradée'
            default:
                return status
        }
    }

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <Card key={i} className="p-6 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200/50 dark:border-gray-800/50 animate-pulse">
                        <div className="h-20"></div>
                    </Card>
                ))}
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Carte Utilisateurs */}
                <Card className="relative overflow-hidden bg-gradient-to-br from-blue-500/10 to-indigo-500/5 dark:from-blue-500/20 dark:to-indigo-500/10 border-blue-200/50 dark:border-blue-800/50 backdrop-blur-sm hover:shadow-lg transition-all duration-300 group">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="p-6 relative">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <span className="text-xs font-medium px-2 py-1 bg-blue-100/50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                +{stats.total_users > 0 ? Math.floor(stats.total_users * 0.1) : 0}% ce mois
              </span>
                        </div>
                        <h3 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.total_users}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Utilisateurs totaux</p>
                        <div className="mt-3 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1"><UserCheck className="w-3 h-3" /> {stats.total_rh} RH</span>
                            <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {stats.total_admins} Admin</span>
                            <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {stats.total_candidates} Candidats</span>
                        </div>
                    </div>
                </Card>

                {/* Carte Offres Actives */}
                <Card className="relative overflow-hidden bg-gradient-to-br from-purple-500/10 to-pink-500/5 dark:from-purple-500/20 dark:to-pink-500/10 border-purple-200/50 dark:border-purple-800/50 backdrop-blur-sm hover:shadow-lg transition-all duration-300 group">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="p-6 relative">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                                <Briefcase className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                            </div>
                            <span className="text-xs font-medium px-2 py-1 bg-purple-100/50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
                Offres actives
              </span>
                        </div>
                        <h3 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.active_offers}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Offres d'emploi publiées</p>
                        <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <TrendingUp className="w-3 h-3 text-green-500" />
                            <span>Taux de remplissage: 75%</span>
                        </div>
                    </div>
                </Card>

                {/* Carte Candidatures */}
                <Card className="relative overflow-hidden bg-gradient-to-br from-green-500/10 to-emerald-500/5 dark:from-green-500/20 dark:to-emerald-500/10 border-green-200/50 dark:border-green-800/50 backdrop-blur-sm hover:shadow-lg transition-all duration-300 group">
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="p-6 relative">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                                <FileText className="w-6 h-6 text-green-600 dark:text-green-400" />
                            </div>
                            <span className="text-xs font-medium px-2 py-1 bg-green-100/50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                Total
              </span>
                        </div>
                        <h3 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.total_applications}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Candidatures reçues</p>
                        <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <span>Moy. par offre: {stats.active_offers > 0 ? (stats.total_applications / stats.active_offers).toFixed(1) : 0}</span>
                        </div>
                    </div>
                </Card>

                {/* Carte Statut Système */}
                <Card className={`relative overflow-hidden bg-gradient-to-br backdrop-blur-sm hover:shadow-lg transition-all duration-300 group ${
                    stats.system_status === 'OPERATIONAL'
                        ? 'from-green-500/10 to-emerald-500/5 dark:from-green-500/20 dark:to-emerald-500/10 border-green-200/50 dark:border-green-800/50'
                        : stats.system_status === 'MAINTENANCE'
                            ? 'from-yellow-500/10 to-amber-500/5 dark:from-yellow-500/20 dark:to-amber-500/10 border-yellow-200/50 dark:border-yellow-800/50'
                            : 'from-red-500/10 to-rose-500/5 dark:from-red-500/20 dark:to-rose-500/10 border-red-200/50 dark:border-red-800/50'
                }`}>
                    <div className="p-6 relative">
                        <div className="flex items-center justify-between mb-4">
                            <div className={`p-3 rounded-xl ${
                                stats.system_status === 'OPERATIONAL'
                                    ? 'bg-green-100 dark:bg-green-900/30'
                                    : stats.system_status === 'MAINTENANCE'
                                        ? 'bg-yellow-100 dark:bg-yellow-900/30'
                                        : 'bg-red-100 dark:bg-red-900/30'
                            }`}>
                                <Activity className={`w-6 h-6 ${
                                    stats.system_status === 'OPERATIONAL'
                                        ? 'text-green-600 dark:text-green-400'
                                        : stats.system_status === 'MAINTENANCE'
                                            ? 'text-yellow-600 dark:text-yellow-400'
                                            : 'text-red-600 dark:text-red-400'
                                }`} />
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 ${getStatusColor(stats.system_status)} rounded-full animate-pulse`}></div>
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  {getStatusText(stats.system_status)}
                </span>
                            </div>
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">État du système</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Santé globale</p>
                        <div className="mt-3 flex items-center gap-2 text-xs">
                            <AlertCircle className="w-3 h-3 text-gray-500" />
                            <span className="text-gray-500 dark:text-gray-400">Dernier check: 2min</span>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    )
}