import {
    Users,
    Briefcase,
    FileText,
    Calendar,
    TrendingUp,
    UserCheck,
    Target,
} from 'lucide-react'
import { Card } from "../../../../components/ui/card"
import { motion } from 'framer-motion'

interface KPICardsProps {
    stats: {
        users: { total: number; rh: number; admins: number; active: number }
        offers: { total: number; active: number; this_month: number }
        applications: { total: number; pending: number; this_month: number }
        interviews: { total: number; upcoming: number }
        conversion_rate: number
    }
}

export function AdminKPICards({ stats }: KPICardsProps) {
    const kpis = [
        {
            title: 'Utilisateurs Totaux',
            value: stats.users.total,
            subtitle: `${stats.users.active} actifs`,
            icon: Users,
            gradient: 'from-purple-900/30 to-pink-900/30',
            border: 'border-purple-500/30',
            iconBg: 'bg-purple-500/20',
            iconColor: 'text-purple-400',
            valueColor: 'text-purple-100',
            labelColor: 'text-purple-300',
            glowColor: 'bg-purple-500/20'
        },
        {
            title: 'RH Actifs',
            value: stats.users.rh,
            subtitle: `${stats.users.admins} admins`,
            icon: UserCheck,
            gradient: 'from-pink-900/30 to-rose-900/30',
            border: 'border-pink-500/30',
            iconBg: 'bg-pink-500/20',
            iconColor: 'text-pink-400',
            valueColor: 'text-pink-100',
            labelColor: 'text-pink-300',
            glowColor: 'bg-pink-500/20'
        },
        {
            title: 'Offres Actives',
            value: stats.offers.active,
            subtitle: `${stats.offers.this_month} ce mois`,
            icon: Briefcase,
            gradient: 'from-amber-900/30 to-orange-900/30',
            border: 'border-amber-500/30',
            iconBg: 'bg-amber-500/20',
            iconColor: 'text-amber-400',
            valueColor: 'text-amber-100',
            labelColor: 'text-amber-300',
            glowColor: 'bg-amber-500/20'
        },
        {
            title: 'Candidatures',
            value: stats.applications.total,
            subtitle: `${stats.applications.pending} en attente`,
            icon: FileText,
            gradient: 'from-rose-900/30 to-red-900/30',
            border: 'border-rose-500/30',
            iconBg: 'bg-rose-500/20',
            iconColor: 'text-rose-400',
            valueColor: 'text-rose-100',
            labelColor: 'text-rose-300',
            glowColor: 'bg-rose-500/20'
        },
        {
            title: 'Entretiens',
            value: stats.interviews.total,
            subtitle: `${stats.interviews.upcoming} à venir`,
            icon: Calendar,
            gradient: 'from-yellow-900/30 to-amber-900/30',
            border: 'border-yellow-500/30',
            iconBg: 'bg-yellow-500/20',
            iconColor: 'text-yellow-400',
            valueColor: 'text-yellow-100',
            labelColor: 'text-yellow-300',
            glowColor: 'bg-yellow-500/20'
        },
        {
            title: 'Taux Conversion',
            value: `${stats.conversion_rate}%`,
            subtitle: 'Candidatures → Entretiens',
            icon: Target,
            gradient: 'from-emerald-900/30 to-green-900/30',
            border: 'border-emerald-500/30',
            iconBg: 'bg-emerald-500/20',
            iconColor: 'text-emerald-400',
            valueColor: 'text-emerald-100',
            labelColor: 'text-emerald-300',
            glowColor: 'bg-emerald-500/20'
        }
    ]

    const cardVariants = {
        hidden: { opacity: 0, scale: 0.9 },
        visible: { opacity: 1, scale: 1 }
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {kpis.map((kpi, index) => {
                const Icon = kpi.icon

                return (
                    <motion.div
                        key={index}
                        variants={cardVariants}
                        initial="hidden"
                        animate="visible"
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                    >
                        <Card
                            className={`relative overflow-hidden bg-gradient-to-br ${kpi.gradient} ${kpi.border} shadow-xl hover:shadow-2xl transition-all duration-300`}
                        >
                            <div className={`absolute top-0 right-0 w-32 h-32 ${kpi.glowColor} rounded-full blur-3xl animate-pulse`} />
                            <div className="relative p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <motion.div
                                        className={`w-12 h-12 rounded-xl ${kpi.iconBg} flex items-center justify-center backdrop-blur-sm`}
                                        whileHover={{ rotate: 360 }}
                                        transition={{ duration: 0.5 }}
                                    >
                                        <Icon className={`w-6 h-6 ${kpi.iconColor}`} />
                                    </motion.div>
                                    <motion.div
                                        animate={{ y: [0, -5, 0] }}
                                        transition={{ duration: 2, repeat: Infinity, delay: index * 0.1 }}
                                    >
                                        <TrendingUp className={`w-5 h-5 ${kpi.iconColor} opacity-50`} />
                                    </motion.div>
                                </div>
                                <div>
                                    <p className={`text-sm font-medium ${kpi.labelColor} mb-1`}>
                                        {kpi.title}
                                    </p>
                                    <motion.p
                                        className={`text-3xl font-bold ${kpi.valueColor} mb-1`}
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ delay: 0.2 + index * 0.05, type: "spring" }}
                                    >
                                        {kpi.value}
                                    </motion.p>
                                    <p className={`text-xs ${kpi.labelColor} opacity-75`}>
                                        {kpi.subtitle}
                                    </p>
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                )
            })}
        </div>
    )
}