// app/components/admin/WorkflowLogs.tsx
'use client'

import { useState } from 'react'
import { Card } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import {
    Activity,
    Mail,
    Brain,
    CheckCircle2,
    Clock,
    RefreshCw
} from 'lucide-react'

interface WorkflowLog {
    id: string
    workflow_name: string
    status: 'success' | 'running' | 'failed'
    timestamp: string
    details: string
    icon: 'mail' | 'brain' | 'check'
}

export function WorkflowLogs() {

    const [logs] = useState<WorkflowLog[]>([
        {
            id: '1',
            workflow_name: 'Email de confirmation',
            status: 'success',
            timestamp: new Date().toISOString(),
            details: 'Email envoyé à jean.dupont@example.com',
            icon: 'mail'
        },
        {
            id: '2',
            workflow_name: 'Analyse IA CV',
            status: 'running',
            timestamp: new Date().toISOString(),
            details: 'Analyse en cours pour 3 candidatures',
            icon: 'brain'
        },
        {
            id: '3',
            workflow_name: 'Mise à jour statut',
            status: 'success',
            // eslint-disable-next-line react-hooks/purity
            timestamp: new Date(Date.now() - 900000).toISOString(),
            details: 'Candidature #1234 mise à jour',
            icon: 'check'
        },
        {
            id: '4',
            workflow_name: 'Synchronisation DB',
            status: 'failed',
            // eslint-disable-next-line react-hooks/purity
            timestamp: new Date(Date.now() - 1800000).toISOString(),
            details: 'Erreur de connexion à la base de données',
            icon: 'check'
        }
    ])

    const [refreshing, setRefreshing] = useState(false)

    const handleRefresh = () => {
        setRefreshing(true)
        // Simuler un rafraîchissement
        setTimeout(() => setRefreshing(false), 1000)
    }

    const getIcon = (type: string) => {
        switch (type) {
            case 'mail':
                return <Mail className="w-4 h-4" />
            case 'brain':
                return <Brain className="w-4 h-4" />
            case 'check':
                return <CheckCircle2 className="w-4 h-4" />
            default:
                return <Activity className="w-4 h-4" />
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'success':
                return 'text-green-600 dark:text-green-400'
            case 'running':
                return 'text-blue-600 dark:text-blue-400'
            case 'failed':
                return 'text-red-600 dark:text-red-400'
            default:
                return 'text-gray-600'
        }
    }

    const getStatusBg = (status: string) => {
        switch (status) {
            case 'success':
                return 'bg-green-100 dark:bg-green-900/30'
            case 'running':
                return 'bg-blue-100 dark:bg-blue-900/30'
            case 'failed':
                return 'bg-red-100 dark:bg-red-900/30'
            default:
                return 'bg-gray-100 dark:bg-gray-800'
        }
    }

    return (
        <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200/50 dark:border-gray-800/50 h-full">
            <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                Logs des Workflows n8n
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Dernières automatisations exécutées
                            </p>
                        </div>
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="gap-2"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        Rafraîchir
                    </Button>
                </div>

                <div className="space-y-3">
                    {logs.map((log) => (
                        <div
                            key={log.id}
                            className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors"
                        >
                            <div className={`p-2 rounded-lg ${getStatusBg(log.status)}`}>
                                {getIcon(log.icon)}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                    <p className="font-medium text-gray-900 dark:text-gray-100">
                                        {log.workflow_name}
                                    </p>
                                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusBg(log.status)} ${getStatusColor(log.status)}`}>
                    {log.status === 'success' && 'Succès'}
                                        {log.status === 'running' && 'En cours'}
                                        {log.status === 'failed' && 'Échec'}
                  </span>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {log.details}
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                    <Clock className="w-3 h-3 text-gray-500" />
                                    <span className="text-xs text-gray-500">
                    {new Date(log.timestamp).toLocaleTimeString('fr-FR')}
                  </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                    <Button variant="ghost" className="w-full text-sm text-gray-600 dark:text-gray-400">
                        Voir tous les logs
                    </Button>
                </div>
            </div>
        </Card>
    )
}