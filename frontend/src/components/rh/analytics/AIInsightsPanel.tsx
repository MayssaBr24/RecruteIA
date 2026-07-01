import { Badge } from '../../../../components/ui/badge'
import {
    BrainCircuit, TrendingUp, Award,
    AlertTriangle, XCircle, Clock,
} from 'lucide-react'

interface AIInsightsPanelProps {
    totalApplications: number
    averageScore: number
    toReviewCount: number  // ceux avec +40
    rejectedCount: number  // ceux avec -40
    topSkills: string[]
    missingSkillsTrends: string[]
    detailed?: boolean
}

// ── Anneau circulaire score moyen ──────────────────────────

function ScoreRing({ score }: { score: number }) {
    const radius = 52
    const stroke = 8
    const normalised = radius - stroke / 2
    const circ = 2 * Math.PI * normalised
    const filled = (score / 100) * circ
    const gap = circ - filled

    const color =
        score >= 80 ? '#10b981' :
            score >= 60 ? '#818cf8' :
                score >= 40 ? '#f59e0b' : '#ef4444'

    const label =
        score >= 80 ? 'Excellent' :
            score >= 60 ? 'Bon' :
                score >= 40 ? 'Moyen' : 'Faible'

    return (
        <div className="flex flex-col items-center gap-2">
            <div className="relative w-28 h-28 flex items-center justify-center">
                <svg
                    width="112" height="112"
                    viewBox="0 0 112 112"
                    className="-rotate-90"
                >
                    <circle
                        cx="56" cy="56" r={normalised}
                        fill="none"
                        stroke="#1e293b"
                        strokeWidth={stroke}
                    />
                    <circle
                        cx="56" cy="56" r={normalised}
                        fill="none"
                        stroke={color}
                        strokeWidth={stroke}
                        strokeLinecap="round"
                        strokeDasharray={`${filled} ${gap}`}
                        style={{ transition: 'stroke-dasharray 1s ease' }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-white">{score}</span>
                    <span className="text-xs text-slate-400">/100</span>
                </div>
            </div>
            <span className="text-xs font-medium" style={{ color }}>{label}</span>
        </div>
    )
}

// ── Barre de stat ──────────────────────────────────────────

function StatBar({
                     count, total, icon: Icon, label, color, textColor, bgColor, borderColor,
                 }: {
    count: number; total: number; icon: React.ElementType
    label: string; color: string; textColor: string; bgColor: string; borderColor: string
}) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0
    return (
        <div className={`p-4 rounded-xl border ${bgColor} ${borderColor}`}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${textColor}`} />
                    <span className={`text-sm font-medium ${textColor}`}>{label}</span>
                </div>
                <div className="text-right">
                    <span className={`text-xl font-bold ${textColor}`}>{count}</span>
                    <span className="text-xs text-slate-500 ml-1">{pct}%</span>
                </div>
            </div>
            <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                <div
                    className={`h-full ${color} rounded-full transition-all duration-700`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    )
}

// ── Chips de compétences ───────────────────────────────────

function SkillChip({ label, variant }: { label: string; variant: 'good' | 'missing' }) {
    return (
        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
            variant === 'good'
                ? 'bg-purple-600/10 text-purple-300 border-purple-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
        }`}>
            {label}
        </span>
    )
}

// ── Composant principal ────────────────────────────────────

export function AIInsightsPanel({
                                    totalApplications,
                                    averageScore,
                                    toReviewCount,
                                    rejectedCount,
                                    topSkills,
                                    missingSkillsTrends,
                                    detailed = false,
                                }: AIInsightsPanelProps) {

    // Calcul du taux de révision (ceux qui sont à +40)
    const reviewRate = totalApplications > 0
        ? Math.round((toReviewCount / totalApplications) * 100)
        : 0

    // Calcul du taux de rejet (ceux qui sont à -40)
    const rejectRate = totalApplications > 0
        ? Math.round((rejectedCount / totalApplications) * 100)
        : 0

    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-center gap-3 p-5 border-b border-slate-700">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20
                                flex items-center justify-center">
                    <BrainCircuit className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                    <h3 className="text-white font-bold text-base">Insights IA</h3>
                    <p className="text-slate-500 text-xs">{totalApplications} candidatures analysées</p>
                </div>
                <Badge className="ml-auto bg-amber-600/20 text-amber-300
                                  border border-amber-500/30 text-xs">
                    {reviewRate}% à revoir
                </Badge>
            </div>

            <div className="p-5 space-y-5">

                {/* Score moyen — anneau */}
                <div className="flex items-center gap-6
                                bg-slate-900/40 border border-slate-700 rounded-xl p-4">
                    <ScoreRing score={averageScore} />
                    <div className="flex-1 space-y-2">
                        <p className="text-white font-semibold text-sm">Score IA moyen</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex items-center gap-1 text-slate-400">
                                <div className="w-2 h-2 rounded-full bg-amber-400" />
                                À revoir (+40) : <span className="text-white font-medium ml-1">
                                    {reviewRate}%
                                </span>
                            </div>
                            <div className="flex items-center gap-1 text-slate-400">
                                <div className="w-2 h-2 rounded-full bg-red-400" />
                                Rejetés (-40) : <span className="text-white font-medium ml-1">
                                    {rejectRate}%
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                            <TrendingUp className="w-3 h-3 text-amber-400" />
                            Taux de révision : <span className="text-amber-400 font-medium ml-1">
                                {reviewRate}%
                            </span>
                        </div>
                    </div>
                </div>

                {/* Barres décisions - UNIQUEMENT À REVOIR ET REJETÉS */}
                <div className="space-y-2">
                    <StatBar
                        count={toReviewCount}
                        total={totalApplications}
                        icon={Clock}
                        label="À revoir (+40)"
                        color="bg-amber-500"
                        textColor="text-amber-400"
                        bgColor="bg-amber-500/5"
                        borderColor="border-amber-500/20"
                    />
                    <StatBar
                        count={rejectedCount}
                        total={totalApplications}
                        icon={XCircle}
                        label="Rejetés (-40)"
                        color="bg-red-500"
                        textColor="text-red-400"
                        bgColor="bg-red-500/5"
                        borderColor="border-red-500/20"
                    />
                </div>

                {/* Compétences — section detailed uniquement */}
                {detailed && (
                    <>
                        {topSkills.length > 0 && (
                            <div className="bg-slate-900/40 border border-slate-700 rounded-xl p-4">
                                <h4 className="text-white text-sm font-semibold mb-3
                                               flex items-center gap-2">
                                    <Award className="w-4 h-4 text-purple-400" />
                                    Compétences fréquentes
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {topSkills.map((s, i) => (
                                        <SkillChip key={i} label={s} variant="good" />
                                    ))}
                                </div>
                            </div>
                        )}

                        {missingSkillsTrends.length > 0 && (
                            <div className="bg-slate-900/40 border border-slate-700 rounded-xl p-4">
                                <h4 className="text-white text-sm font-semibold mb-3
                                               flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                                    Compétences manquantes
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {missingSkillsTrends.map((s, i) => (
                                        <SkillChip key={i} label={s} variant="missing" />
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}