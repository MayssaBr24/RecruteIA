// app/admin/page.tsx
'use client'

import { AdminHeader } from '../components/layout/AdminHeader.tsx'
import { AdminSidebar } from '../components/layout/AdminSidebar.tsx'
import { StatsCards } from '../components/admin/StatsCards.tsx'
import { WorkflowLogs } from '../components/admin/WorkflowLogs.tsx'
import { SystemAlerts } from '../components/admin/SystemAlerts.tsx'

export default function AdminSpace() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-blue-50/30 dark:from-gray-950 dark:via-gray-950 dark:to-blue-950/20">
            <AdminHeader />

            <div className="flex">
                <AdminSidebar />

                <main className="flex-1 p-6 lg:p-8 ml-64">
                    {/* En-tête du Dashboard */}
                    <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
                        <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                            Tableau de Bord Administrateur
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-2">
                            Vue d'ensemble de la santé du système et des activités récentes
                        </p>
                    </div>

                    {/* Bloc A: Statistiques KPIs */}
                    <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                        <StatsCards />
                    </div>

                    {/* Grille pour Monitoring & Logs */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                        {/* Bloc C: Logs des Workflows (2/3 de la largeur) */}
                        <div className="lg:col-span-2 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
                            <WorkflowLogs />
                        </div>

                        {/* Bloc C: Alertes Système (1/3 de la largeur) */}
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
                            <SystemAlerts />
                        </div>
                    </div>

                    {/* Carte d'information système */}
                    <div className="mt-8 p-4 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-gray-800/50 animate-in fade-in duration-500 delay-400">
                        <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span>Système connecté</span>
                            <span className="text-gray-300 dark:text-gray-700">|</span>
                            <span>Dernière mise à jour: {new Date().toLocaleTimeString('fr-FR')}</span>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}