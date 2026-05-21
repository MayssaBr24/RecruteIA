import {
    Users,
    Briefcase,
    FileText,
    Calendar,
    UserCheck,
    Target,
} from 'lucide-react'
import { motion } from 'framer-motion'
import {Card} from "../../../../components/ui/card.tsx";

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
            title: 'Utilisateurs',
            value: stats.users.total,
            subtitle: `${stats.users.active} actifs`,
            icon: Users,
        },
        {
            title: 'RH Actifs',
            value: stats.users.rh,
            subtitle: `${stats.users.admins} admins`,
            icon: UserCheck,
        },
        {
            title: 'Offres',
            value: stats.offers.active,
            subtitle: `${stats.offers.this_month} ce mois`,
            icon: Briefcase,
        },
        {
            title: 'Candidatures',
            value: stats.applications.total,
            subtitle: `${stats.applications.pending} en attente`,
            icon: FileText,
        },
        {
            title: 'Entretiens',
            value: stats.interviews.total,
            subtitle: `${stats.interviews.upcoming} à venir`,
            icon: Calendar,
        },
        {
            title: 'Conversion',
            value: `${stats.conversion_rate}%`,
            subtitle: 'Candidatures → Entretiens',
            icon: Target,
        }
    ]

    const cardVariants = {
        hidden: { opacity: 0, scale: 0.95 },
        visible: { opacity: 1, scale: 1 }
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {kpis.map((kpi, index) => {
                const Icon = kpi.icon

                return (
                    <motion.div
                        key={index}
                        variants={cardVariants}
                        initial="hidden"
                        animate="visible"
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ scale: 1.02 }}
                    >
                        <Card className="relative overflow-hidden bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all duration-300 p-6">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                                        {kpi.title}
                                    </p>
                                    <motion.p
                                        className="text-3xl font-bold text-slate-100 mb-2"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.2 + index * 0.05 }}
                                    >
                                        {kpi.value}
                                    </motion.p>
                                    <p className="text-xs text-slate-500">
                                        {kpi.subtitle}
                                    </p>
                                </div>
                                <motion.div
                                    className="w-12 h-12 rounded-lg bg-indigo-500/15 flex items-center justify-center"
                                    whileHover={{ rotate: 12 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <Icon className="w-6 h-6 text-indigo-400" />
                                </motion.div>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500/0 via-indigo-500/50 to-indigo-500/0" />
                        </Card>
                    </motion.div>
                )
            })}
        </div>
    )
}