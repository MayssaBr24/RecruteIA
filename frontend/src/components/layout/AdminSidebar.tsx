// app/components/layout/AdminSidebar.tsx
'use client'

import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom' // <--- CORRECTION 1
import { Card } from '../../../components/ui/card'
import {
    LayoutDashboard,
    Users,
    Activity,
    Settings,
    ChevronRight
} from 'lucide-react'

export function AdminSidebar() {
    const location = useLocation()
    const [currentPath, setCurrentPath] = useState(location.pathname)

    // indispensable pour React Router : mettre à jour l'état quand l'URL change
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCurrentPath(location.pathname)
    }, [location.pathname])

    const menuItems = [
        {
            href: '/admin',
            icon: LayoutDashboard,
            label: 'Dashboard',
            color: 'text-blue-600 dark:text-blue-400'
        },
        {
            href: '/admin/users',
            icon: Users,
            label: 'Gestion Utilisateurs',
            color: 'text-purple-600 dark:text-purple-400'
        },
        {
            href: '/admin/monitoring',
            icon: Activity,
            label: 'Monitoring & Logs',
            color: 'text-green-600 dark:text-green-400'
        },
        {
            href: '/admin/settings',
            icon: Settings,
            label: 'Paramètres',
            color: 'text-gray-600 dark:text-gray-400'
        }
    ]

    return (
        <aside className="fixed left-0 top-16 w-64 h-[calc(100vh-4rem)] bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-r border-gray-200/50 dark:border-gray-800/50 shadow-sm">
            <div className="p-4">
                <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 dark:from-blue-500/20 dark:to-purple-500/20 border-0 p-4 mb-6">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Connecté en tant que</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">Administrateur</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">admin@example.com</p>
                </Card>

                <nav className="space-y-1">
                    {menuItems.map((item) => {
                        // Utilisation de currentPath au lieu de pathname
                        const isActive = currentPath === item.href
                        const Icon = item.icon

                        return (
                            <Link
                                key={item.href}
                                to={item.href} // <--- CORRECTION 2 : to au lieu de href
                                className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                                    isActive
                                        ? 'bg-gradient-to-r from-blue-500/10 to-purple-500/10 dark:from-blue-500/20 dark:to-purple-500/20 text-gray-900 dark:text-gray-100'
                                        : 'hover:bg-gray-100/50 dark:hover:bg-gray-800/50 text-gray-600 dark:text-gray-400'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-1.5 rounded-md ${
                                        isActive ? 'bg-white dark:bg-gray-900 shadow-sm' : ''
                                    }`}>
                                        <Icon className={`w-5 h-5 ${isActive ? item.color : ''}`} />
                                    </div>
                                    <span className="text-sm font-medium">{item.label}</span>
                                </div>
                                {isActive && (
                                    <ChevronRight className="w-4 h-4 text-gray-500" />
                                )}
                            </Link>
                        )
                    })}
                </nav>

                <div className="absolute bottom-4 left-4 right-4">
                    <Card className="bg-gray-50/50 dark:bg-gray-800/50 border-gray-200/50 dark:border-gray-700/50 p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Version 2.0.0</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Dernière mise à jour: {new Date().toLocaleDateString('fr-FR')}</p>
                    </Card>
                </div>
            </div>
        </aside>
    )
}