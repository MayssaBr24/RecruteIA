// src/components/rh/dashboard/KPICards.tsx

import { Briefcase, Users, FileText, Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface KPICardsProps {
    activeJobs:          number
    pendingApplications: number
    responseRate:        number
    upcomingInterviews:  number
    trends?: {
        jobs?:         number  // % vs semaine précédente
        applications?: number
        response?:     number
        interviews?:   number
    }
    aiStats: {
        averageScore: number;
        validatedCount: number;
        toReviewCount: number;
        rejectedCount: number;
    };
}

interface KPI {
    title:    string
    value:    string | number
    trend?:   number
    icon:     React.ElementType
    accent:   string
    glow:     string
    iconBg:   string
    iconText: string
    spark:    number[]
}

// Sparkline SVG minimaliste
function Sparkline({ data, color }: { data: number[]; color: string }) {
    const max    = Math.max(...data)
    const min    = Math.min(...data)
    const range  = max - min || 1
    const w      = 80
    const h      = 28
    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * w
        const y = h - ((v - min) / range) * h
        return `${x},${y}`
    }).join(' ')

    return (
        <svg width={w} height={h} className="opacity-60">
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeLinecap="round"
            />
        </svg>
    )
}

function TrendBadge({ value }: { value?: number }) {
    if (value === undefined) return null
    if (value === 0) return (
        <span className="flex items-center gap-0.5 text-xs text-slate-500">
            <Minus className="w-3 h-3" /> Stable
        </span>
    )
    const positive = value > 0
    return (
        <span className={`flex items-center gap-0.5 text-xs font-medium ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
            {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {positive ? '+' : ''}{value}%
        </span>
    )
}

export function KPICards({
                             activeJobs,
                             pendingApplications,
                             responseRate,
                             upcomingInterviews,
                             trends = {},
                         }: KPICardsProps) {

    const kpis: KPI[] = [
        {
            title:    'Offres actives',
            value:    activeJobs,
            trend:    trends.jobs,
            icon:     Briefcase,
            accent:   'from-purple-500 to-purple-700',
            glow:     'shadow-purple-900/30',
            iconBg:   'bg-purple-600/20',
            iconText: 'text-purple-400',
            spark:    [2, 3, 3, 5, 4, activeJobs, activeJobs],
        },
        {
            title:    'En attente',
            value:    pendingApplications,
            trend:    trends.applications,
            icon:     Users,
            accent:   'from-blue-500 to-blue-700',
            glow:     'shadow-blue-900/30',
            iconBg:   'bg-blue-600/20',
            iconText: 'text-blue-400',
            spark:    [8, 12, 10, 14, 11, pendingApplications, pendingApplications],
        },
        {
            title:    'Taux de réponse',
            value:    `${responseRate}%`,
            trend:    trends.response,
            icon:     FileText,
            accent:   'from-emerald-500 to-emerald-700',
            glow:     'shadow-emerald-900/30',
            iconBg:   'bg-emerald-600/20',
            iconText: 'text-emerald-400',
            spark:    [60, 65, 70, 68, 72, responseRate, responseRate],
        },
        {
            title:    'Entretiens planifiés',
            value:    upcomingInterviews,
            trend:    trends.interviews,
            icon:     Calendar,
            accent:   'from-amber-500 to-amber-700',
            glow:     'shadow-amber-900/30',
            iconBg:   'bg-amber-600/20',
            iconText: 'text-amber-400',
            spark:    [1, 2, 2, 3, 2, upcomingInterviews, upcomingInterviews],
        },
    ]

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map((kpi, i) => {
                const Icon = kpi.icon
                // Couleur sparkline extraite de l'accent
                const sparkColor = ['#a855f7', '#3b82f6', '#10b981', '#f59e0b'][i]

                return (
                    <div key={i}
                         className={`relative overflow-hidden rounded-2xl
                                    bg-slate-800/50 border border-slate-700
                                    hover:border-slate-600 hover:shadow-xl ${kpi.glow}
                                    transition-all duration-300 p-5`}>

                        {/* Glow décoratif coin */}
                        <div className={`absolute -top-6 -right-6 w-24 h-24
                                        bg-gradient-to-br ${kpi.accent}
                                        opacity-10 rounded-full blur-2xl
                                        pointer-events-none`} />

                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <div className={`w-10 h-10 rounded-xl ${kpi.iconBg}
                                            flex items-center justify-center`}>
                                <Icon className={`w-5 h-5 ${kpi.iconText}`} />
                            </div>
                            <TrendBadge value={kpi.trend} />
                        </div>

                        {/* Valeur */}
                        <p className="text-3xl font-bold text-white tracking-tight mb-0.5">
                            {kpi.value}
                        </p>
                        <p className="text-xs text-slate-400 mb-4">{kpi.title}</p>

                        {/* Sparkline */}
                        <Sparkline data={kpi.spark} color={sparkColor} />
                    </div>
                )
            })}
        </div>
    )
}