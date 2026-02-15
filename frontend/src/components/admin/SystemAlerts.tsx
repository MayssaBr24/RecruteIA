// app/components/admin/SystemAlerts.tsx
'use client'

import { useState } from 'react'
import { Card } from '../../../components/ui/card'
import {
    AlertTriangle,
    Database,
    Brain,
    CheckCircle2,
    AlertCircle
} from 'lucide-react'

interface SystemAlert {
    id: string
    type: 'ia' | 'database' | 'system'
    severity: 'high' | 'medium' | 'low'
    message: string
    timestamp: string
    resolved: boolean
}

export function SystemAlerts() {
    const [alerts] = useState<SystemAlert[]>([
        {
            id: '1',
            type: 'ia',
            severity: 'medium',
            message: 'Temps de réponse IA supérieur à la normale',
            timestamp: new Date().toISOString(),
            resolved: false
        },
        {
            id: '2',
            type: 'database',
            severity: 'low',
            message: 'Requêtes lentes détectées',
            // eslint-disable-next-line react-hooks/purity
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            resolved: false
        },
        {
            id: '3',
            type: 'system',
            severity: 'high',
            message: 'Espace disque faible',
            // eslint-disable-next-line react-hooks/purity
            timestamp: new Date(Date.now() - 7200000).toISOString(),
            resolved: true
        }
    ])

    const getIcon = (type: string) => {
        switch (type) {
            case 'ia':
                return <Brain className="w-4 h-4" />
            case 'database':
                return <Database className="w-4 h-4" />
            default:
                return <AlertCircle className="w-4 h-4" />
        }
    }

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'high':
                return 'text-red-600 dark:text-red-400'
            case 'medium':
                return 'text-yellow-600 dark:text-yellow-400'
            case 'low':
                return 'text-blue-600 dark:text-blue-400'
            default:
                return 'text-gray-600'
        }
    }

    const getSeverityBg = (severity: string) => {
        switch (severity) {
            case 'high':
                return 'bg-red-100 dark:bg-red-900/30'
            case 'medium':
                return 'bg-yellow-100 dark:bg-yellow-900/30'
            case 'low':
                return 'bg-blue-100 dark:bg-blue-900/30'
            default:
                return 'bg-gray-100 dark:bg-gray-800'
        }
    }

    return (
        <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200/50 dark:border-gray-800/50 h-full">
            <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                        <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            Alertes Système
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {alerts.filter(a => !a.resolved).length} alertes actives
                        </p>
                    </div>
                </div>

                <div className="space-y-3">
                    {alerts.filter(a => !a.resolved).length === 0 ? (
                        <div className="text-center py-8">
                            <div className="inline-flex p-3 bg-green-100 dark:bg-green-900/30 rounded-full mb-3">
                                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                            </div>
                            <p className="text-gray-900 dark:text-gray-100 font-medium">Aucune alerte</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                Tous les systèmes sont opérationnels
                            </p>
                        </div>
                    ) : (
                        alerts
                            .filter(a => !a.resolved)
                            .map((alert) => (
                                <div
                                    key={alert.id}
                                    className="flex items-start gap-3 p-3 rounded-lg bg-gray-50/50 dark:bg-gray-800/50"
                                >
                                    <div className={`p-2 rounded-lg ${getSeverityBg(alert.severity)}`}>
                                        {getIcon(alert.type)}
                                    </div>

                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="font-medium text-gray-900 dark:text-gray-100">
                                                {alert.type === 'ia' && 'Service IA'}
                                                {alert.type === 'database' && 'Base de données'}
                                                {alert.type === 'system' && 'Système'}
                                            </p>
                                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${getSeverityBg(alert.severity)} ${getSeverityColor(alert.severity)}`}>
                        {alert.severity === 'high' && 'Critique'}
                                                {alert.severity === 'medium' && 'Moyenne'}
                                                {alert.severity === 'low' && 'Basse'}
                      </span>
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            {alert.message}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-2">
                                            {new Date(alert.timestamp).toLocaleTimeString('fr-FR')}
                                        </p>
                                    </div>
                                </div>
                            ))
                    )}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                    <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600 dark:text-gray-400">
              Dernière vérification: {new Date().toLocaleTimeString('fr-FR')}
            </span>
                        <button
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
                            onClick={() => console.log('Voir historique')}
                        >
                            Voir historique
                        </button>
                    </div>
                </div>
            </div>
        </Card>
    )
}