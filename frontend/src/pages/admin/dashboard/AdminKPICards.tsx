import {
    Users,
    Briefcase,
    FileText,
    Calendar,
    UserCheck,
    Target,
    TrendingUp,
    TrendingDown,
} from 'lucide-react'
import {motion, Variants} from 'framer-motion'
import { Card } from "../../../../components/ui/card.tsx";

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
            trend: '+12%',
            trendUp: true,
            icon: Users,
            gradient: 'from-blue-500 to-cyan-500',
            bgGradient: 'from-blue-500/10 to-cyan-500/10'
        },
        {
            title: 'RH Actifs',
            value: stats.users.rh,
            subtitle: `${stats.users.admins} admins`,
            trend: '+5%',
            trendUp: true,
            icon: UserCheck,
            gradient: 'from-green-500 to-emerald-500',
            bgGradient: 'from-green-500/10 to-emerald-500/10'
        },
        {
            title: 'Offres',
            value: stats.offers.active,
            subtitle: `${stats.offers.this_month} ce mois`,
            trend: '+8%',
            trendUp: true,
            icon: Briefcase,
            gradient: 'from-purple-500 to-pink-500',
            bgGradient: 'from-purple-500/10 to-pink-500/10'
        },
        {
            title: 'Candidatures',
            value: stats.applications.total,
            subtitle: `${stats.applications.pending} en attente`,
            trend: '+23%',
            trendUp: true,
            icon: FileText,
            gradient: 'from-orange-500 to-red-500',
            bgGradient: 'from-orange-500/10 to-red-500/10'
        },
        {
            title: 'Entretiens',
            value: stats.interviews.total,
            subtitle: `${stats.interviews.upcoming} à venir`,
            trend: '-3%',
            trendUp: false,
            icon: Calendar,
            gradient: 'from-teal-500 to-cyan-500',
            bgGradient: 'from-teal-500/10 to-cyan-500/10'
        },
        {
            title: 'Conversion',
            value: `${stats.conversion_rate}%`,
            subtitle: 'Candidatures → Entretiens',
            trend: '+15%',
            trendUp: true,
            icon: Target,
            gradient: 'from-indigo-500 to-purple-500',
            bgGradient: 'from-indigo-500/10 to-purple-500/10'
        }
    ]

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    }


    const cardVariants: Variants = {
        hidden: {
            opacity: 0,
            y: 20
        },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                type: 'spring',
                stiffness: 100,
                damping: 15
            }
        }
    }

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5"
        >
            {kpis.map((kpi, index) => {
                const Icon = kpi.icon
                const TrendIcon = kpi.trendUp ? TrendingUp : TrendingDown

                return (
                    <motion.div
                        key={index}
                        variants={cardVariants}
                        whileHover={{ y: -4, transition: { duration: 0.2 } }}
                    >
                        <Card className="relative group overflow-hidden bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800 hover:border-slate-700 transition-all duration-300 shadow-xl">
                            {/* Gradient Background */}
                            <div className={`absolute inset-0 bg-gradient-to-br ${kpi.bgGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                            {/* Content */}
                            <div className="relative p-5">
                                {/* Icon Section */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${kpi.gradient} p-[1px] shadow-lg`}>
                                        <div className="w-full h-full rounded-xl bg-slate-950 flex items-center justify-center">
                                            <Icon className="w-6 h-6 text-white" />
                                        </div>
                                    </div>

                                    {/* Trend Badge */}
                                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
                                        ${kpi.trendUp ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                        <TrendIcon className="w-3 h-3" />
                                        <span>{kpi.trend}</span>
                                    </div>
                                </div>

                                {/* Value Section */}
                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-slate-400 tracking-wide">
                                        {kpi.title}
                                    </p>
                                    <motion.p
                                        className="text-3xl font-bold text-white tracking-tight"
                                        initial={{ scale: 0.9, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ delay: index * 0.05, type: "spring" }}
                                    >
                                        {kpi.value}
                                    </motion.p>
                                    <p className="text-xs text-slate-500">
                                        {kpi.subtitle}
                                    </p>
                                </div>

                                {/* Progress Bar Animation */}
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent
                                    transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
                            </div>
                        </Card>
                    </motion.div>
                )
            })}
        </motion.div>
    )
}