// components/rh/dashboard/KPICards.tsx
import { Card } from '../../../../components/ui/card'
import { Briefcase, Users, FileText, Calendar, TrendingUp, Clock, CalendarDays } from 'lucide-react'

interface KPICardsProps {
    activeJobs: number
    pendingApplications: number
    responseRate: number
    upcomingInterviews: number
}

export function KPICards({
                             activeJobs,
                             pendingApplications,
                             responseRate,
                             upcomingInterviews
                         }: KPICardsProps) {
    const kpis = [
        {
            title: 'Offres Actives',
            value: activeJobs,
            icon: Briefcase,
            subIcon: TrendingUp,
            gradient: 'from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30',
            iconBg: 'bg-blue-500/20',
            iconColor: 'text-blue-600 dark:text-blue-400',
            valueColor: 'text-blue-900 dark:text-blue-100',
            labelColor: 'text-blue-700 dark:text-blue-300',
            border: 'border-blue-200 dark:border-blue-800/30',
            glowColor: 'bg-blue-500/10'
        },
        {
            title: 'En Attente',
            value: pendingApplications,
            icon: Users,
            subIcon: Clock,
            gradient: 'from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/30',
            iconBg: 'bg-purple-500/20',
            iconColor: 'text-purple-600 dark:text-purple-400',
            valueColor: 'text-purple-900 dark:text-purple-100',
            labelColor: 'text-purple-700 dark:text-purple-300',
            border: 'border-purple-200 dark:border-purple-800/30',
            glowColor: 'bg-purple-500/10'
        },
        {
            title: 'Taux de Réponse',
            value: `${responseRate}%`,
            icon: FileText,
            subIcon: TrendingUp,
            gradient: 'from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/30',
            iconBg: 'bg-green-500/20',
            iconColor: 'text-green-600 dark:text-green-400',
            valueColor: 'text-green-900 dark:text-green-100',
            labelColor: 'text-green-700 dark:text-green-300',
            border: 'border-green-200 dark:border-green-800/30',
            glowColor: 'bg-green-500/10'
        },
        {
            title: 'Entretiens Planifiés',
            value: upcomingInterviews,
            icon: Calendar,
            subIcon: CalendarDays,
            gradient: 'from-orange-50 to-orange-100 dark:from-orange-950/50 dark:to-orange-900/30',
            iconBg: 'bg-orange-500/20',
            iconColor: 'text-orange-600 dark:text-orange-400',
            valueColor: 'text-orange-900 dark:text-orange-100',
            labelColor: 'text-orange-700 dark:text-orange-300',
            border: 'border-orange-200 dark:border-orange-800/30',
            glowColor: 'bg-orange-500/10'
        }
    ]

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {kpis.map((kpi, index) => {
                const Icon = kpi.icon
                const SubIcon = kpi.subIcon

                return (
                    <Card
                        key={index}
                        className={`relative overflow-hidden bg-gradient-to-br ${kpi.gradient} ${kpi.border}`}
                    >
                        <div className={`absolute top-0 right-0 w-32 h-32 ${kpi.glowColor} rounded-full blur-3xl`} />
                        <div className="relative p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className={`w-12 h-12 rounded-xl ${kpi.iconBg} flex items-center justify-center`}>
                                    <Icon className={`w-6 h-6 ${kpi.iconColor}`} />
                                </div>
                                <SubIcon className={`w-5 h-5 ${kpi.iconColor} opacity-50`} />
                            </div>
                            <div>
                                <p className={`text-sm font-medium ${kpi.labelColor} mb-1`}>
                                    {kpi.title}
                                </p>
                                <p className={`text-3xl font-bold ${kpi.valueColor}`}>
                                    {kpi.value}
                                </p>
                            </div>
                        </div>
                    </Card>
                )
            })}
        </div>
    )
}