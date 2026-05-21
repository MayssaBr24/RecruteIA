import { Badge } from '../../../../components/ui/badge'
import {
    TrendingUp,
    TrendingDown,
    Minus,
    BrainCircuit,
    Users,
    Briefcase,
    CheckCircle2,
    Bell,
    AlertTriangle, Info, Zap
} from 'lucide-react'
import {OfferTimeline, STAGE_CFG, WeekStats, RHNotification} from "../../../types/types.ts";


// Stat Card Component
export function StatCard({
                             label, value, trend, icon: Icon, color,
                         }: {
    label:  string
    value:  string | number
    trend?: number
    icon:   React.ElementType
    color:  string
}) {
    return (
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500">{label}</span>
                <div className={`w-7 h-7 rounded-lg ${color} flex items-center justify-center`}>
                    <Icon className="w-3.5 h-3.5 text-white" />
                </div>
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
            {trend !== undefined && (
                <div className="flex items-center gap-1 mt-1">
                    {trend > 0  && <TrendingUp   className="w-3 h-3 text-emerald-400" />}
                    {trend < 0  && <TrendingDown className="w-3 h-3 text-red-400" />}
                    {trend === 0 && <Minus        className="w-3 h-3 text-slate-500" />}
                    <span className={`text-xs font-medium ${
                        trend > 0 ? 'text-emerald-400' : trend < 0 ? 'text-red-400' : 'text-slate-500'
                    }`}>
                        {trend === 0 ? 'Stable' : `${trend > 0 ? '+' : ''}${trend}% vs sem. préc.`}
                    </span>
                </div>
            )}
        </div>
    )
}

// Offer Timeline Card Component
export function OfferTimelineCard({ offer }: { offer: OfferTimeline }) {
    const stage = STAGE_CFG[offer.stage] ?? STAGE_CFG['published']
    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4
                        hover:border-slate-600 transition-all">
            <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-semibold truncate">{offer.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {offer.contract && (
                            <span className="text-xs text-slate-500">{offer.contract}</span>
                        )}
                        <Badge className={`text-xs px-2 py-0 ${stage.color} text-white border-0`}>
                            {stage.label}
                        </Badge>
                    </div>
                </div>
                {offer.days_left !== null && (
                    <span className={`text-xs shrink-0 px-2 py-1 rounded-full font-medium ${
                        offer.is_expired
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : offer.days_left <= 3
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-slate-700/50 text-slate-400'
                    }`}>
                        {offer.is_expired ? 'Expirée' : `J-${offer.days_left}`}
                    </span>
                )}
            </div>

            <div className="w-full bg-slate-700 rounded-full h-1.5 mb-3">
                <div className={`h-1.5 rounded-full transition-all ${stage.color}`}
                     style={{ width: `${offer.progress}%` }} />
            </div>

            <div className="grid grid-cols-4 gap-1 text-center">
                {[
                    { label: 'Candidats',  value: offer.stats.total       },
                    { label: 'Présélec.',  value: offer.stats.screened    },
                    { label: 'Entretiens', value: offer.stats.interviewed },
                    { label: 'Recrutés',   value: offer.stats.hired       },
                ].map(s => (
                    <div key={s.label}
                         className="bg-slate-900/40 rounded-lg py-2">
                        <p className="text-white font-bold text-sm">{s.value}</p>
                        <p className="text-slate-500 text-xs">{s.label}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}

// Week Stats Component
export function WeekStatsGrid({ weekStats }: { weekStats: WeekStats }) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard label="Candidatures"    value={weekStats.new_applications}  trend={weekStats.trend_pct} icon={Users}        color="bg-purple-600" />
            <StatCard label="Entretiens IA"   value={weekStats.interviews_done}   icon={BrainCircuit}                              color="bg-blue-600"   />
            <StatCard label="Score IA moyen"  value={`${weekStats.avg_score}/100`} icon={TrendingUp}                              color="bg-indigo-600" />
            <StatCard label="Offres actives"  value={weekStats.active_offers}     icon={Briefcase}                                 color="bg-slate-600"  />
            <StatCard label="Taux conversion" value={`${weekStats.conversion_rate}%`} icon={CheckCircle2}                          color="bg-emerald-600"/>
        </div>
    )
}

// Notifications Component
export function NotificationsList({ notifications }: { notifications: RHNotification[] }) {
    const NOTIF_CFG: Record<string, { bg: string; text: string; border: string }> = {
        warning: { bg: 'bg-amber-500/10',  text: 'text-amber-300',  border: 'border-amber-500/20'  },
        info:    { bg: 'bg-blue-500/10',   text: 'text-blue-300',   border: 'border-blue-500/20'   },
        success: { bg: 'bg-emerald-500/10',text: 'text-emerald-300',border: 'border-emerald-500/20'},
        urgent:  { bg: 'bg-red-500/10',    text: 'text-red-300',    border: 'border-red-500/20'    },
    }


    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-400" />
                <h3 className="text-white font-semibold text-sm">Alertes</h3>
                <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs">
                    {notifications.length}
                </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {notifications.map((notif, i) => {
                    const cfg = NOTIF_CFG[notif.level] ?? NOTIF_CFG['info']
                    const Icon = notif.level === 'warning' ? AlertTriangle :
                        notif.level === 'info' ? Info :
                            notif.level === 'success' ? CheckCircle2 : Zap
                    return (
                        <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${cfg.bg} ${cfg.border}`}>
                            <div className={`mt-0.5 shrink-0 ${cfg.text}`}>
                                <Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <p className={`text-sm font-semibold ${cfg.text}`}>{notif.title}</p>
                                <p className="text-slate-400 text-xs mt-0.5">{notif.message}</p>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}