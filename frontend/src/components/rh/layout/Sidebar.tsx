import { NavLink, useLocation } from 'react-router-dom'
import {
    LayoutDashboard, Users, BrainCircuit,
    BarChart3, TrendingUp, RefreshCw, Calendar,
    ChevronLeft, ChevronRight, LogOut, UserCheck, User, ClipboardList  // Ajouter UserCheck
} from 'lucide-react'
import {useAuth} from "../../../context/AuthContext.tsx";
import {useState} from "react";

const NAV_ITEMS = [
    {
        group: 'Principal',
        items: [
            { to: '/rh',              icon: LayoutDashboard, label: 'Vue générale',   exact: true },
            { to: '/rh/offers', icon: ClipboardList, label: 'Offres' },            { to: '/rh/applications', icon: Users,           label: 'Candidatures'                },
            { to: '/rh/interviews',   icon: BrainCircuit,    label: 'Entretiens IA'               },
        ]
    },
    {
        group: 'Recrutement',  // Nouvelle section avec un seul bouton
        items: [
            { to: '/rh/recruitment', icon: User, label: 'Recrutement' },
            { to: '/rh/employees', icon: UserCheck, label: 'Employés' },

        ]
    },
    {
        group: 'Analyse',
        items: [
            { to: '/rh/analytics',    icon: BarChart3,       label: 'Analytics IA'    },
            { to: '/rh/forecasting',  icon: TrendingUp,      label: 'Prévisions RH'   },
            { to: '/rh/turnover',     icon: RefreshCw,       label: 'Turnover'        },
        ]
    },
    {
        group: 'Outils',
        items: [
            { to: '/rh/planning',     icon: Calendar,        label: 'Planning'        },
        ]
    },
]

export function Sidebar() {
    const [collapsed, setCollapsed] = useState(false)
    const location = useLocation()
    const { logout } = useAuth()

    const isActive = (to: string, exact?: boolean) => {
        if (exact) return location.pathname === to
        return location.pathname.startsWith(to)
    }

    return (
        <aside className={`
            relative flex flex-col h-screen sticky top-0
            bg-slate-900 border-r border-slate-800
            transition-all duration-300 shrink-0
            ${collapsed ? 'w-[70px]' : 'w-[240px]'}
        `}>

            {/* Logo */}
            <div className={`
                flex items-center gap-3 px-4 py-5
                border-b border-slate-800
                ${collapsed ? 'justify-center' : ''}
            `}>
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br
                                from-purple-500 to-blue-600
                                flex items-center justify-center shrink-0">
                    <BrainCircuit className="w-5 h-5 text-white" />
                </div>
                {!collapsed && (
                    <div>
                        <p className="text-white font-bold text-sm leading-none">
                            RecrutIA
                        </p>
                        <p className="text-slate-400 text-xs mt-0.5">
                            Dashboard RH
                        </p>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
                {NAV_ITEMS.map(group => (
                    <div key={group.group}>
                        {!collapsed && (
                            <p className="text-slate-500 text-xs font-semibold
                                          uppercase tracking-wider px-3 mb-2">
                                {group.group}
                            </p>
                        )}
                        <ul className="space-y-1">
                            {group.items.map(item => {
                                const active = isActive(item.to, item.exact)
                                const Icon = item.icon
                                return (
                                    <li key={item.to}>
                                        <NavLink
                                            to={item.to}
                                            className={`
                                                flex items-center gap-3 px-3 py-2.5
                                                rounded-xl text-sm font-medium
                                                transition-all duration-150 group
                                                ${active
                                                ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30'
                                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                            }
                                                ${collapsed ? 'justify-center' : ''}
                                            `}
                                            title={collapsed ? item.label : undefined}
                                        >
                                            <Icon className={`w-5 h-5 shrink-0 ${
                                                active ? 'text-white' : 'text-slate-400 group-hover:text-white'
                                            }`} />
                                            {!collapsed && (
                                                <span>{item.label}</span>
                                            )}
                                            {active && !collapsed && (
                                                <div className="ml-auto w-1.5 h-1.5
                                                                rounded-full bg-white/60" />
                                            )}
                                        </NavLink>
                                    </li>
                                )
                            })}
                        </ul>
                    </div>
                ))}
            </nav>

            {/* Profil + Logout */}
            <div className="border-t border-slate-800 p-3 space-y-1">
                <button
                    onClick={logout}
                    className={`
                        w-full flex items-center gap-3 px-3 py-2.5
                        rounded-xl text-sm text-slate-400
                        hover:bg-red-500/10 hover:text-red-400
                        transition-all duration-150
                        ${collapsed ? 'justify-center' : ''}
                    `}
                    title={collapsed ? 'Déconnexion' : undefined}
                >
                    <LogOut className="w-4 h-4 shrink-0" />
                    {!collapsed && <span>Déconnexion</span>}
                </button>
            </div>

            {/* Toggle collapse */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="absolute -right-3 top-8 w-6 h-6 rounded-full
                           bg-slate-800 border border-slate-700
                           flex items-center justify-center
                           text-slate-400 hover:text-white
                           transition-colors z-10"
            >
                {collapsed
                    ? <ChevronRight className="w-3 h-3" />
                    : <ChevronLeft className="w-3 h-3" />
                }
            </button>
        </aside>
    )
}