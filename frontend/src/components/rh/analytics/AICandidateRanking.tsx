import { Trophy, TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react'

interface Candidate {
    id:              number
    full_name:       string
    ai_score:        number
    ai_decision?:    'VALIDATED' | 'TO_REVIEW' | 'REJECTED' | 'PENDING'
    job_offer_title: string
}

interface AICandidateRankingProps {
    candidates: Candidate[]
}

// ── Helpers ────────────────────────────────────────────────

const DECISION_CONFIG = {
    VALIDATED: { bg: 'bg-emerald-500/8', text: 'text-emerald-600', border: 'border-emerald-500/15', label: 'Validé' },
    TO_REVIEW: { bg: 'bg-amber-500/8', text: 'text-amber-600', border: 'border-amber-500/15', label: 'À examiner' },
    REJECTED:  { bg: 'bg-rose-500/8', text: 'text-rose-600', border: 'border-rose-500/15', label: 'Refusé' },
    PENDING:   { bg: 'bg-gray-500/8', text: 'text-gray-500', border: 'border-gray-500/15', label: 'En attente' },
}

function getScoreColor(score: number): string {
    if (score >= 80) return 'text-emerald-700'
    if (score >= 60) return 'text-amber-700'
    if (score >= 40) return 'text-gray-700'
    return 'text-gray-500'
}

function getBarColor(score: number): string {
    if (score >= 80) return 'bg-gradient-to-r from-emerald-500 to-emerald-400'
    if (score >= 60) return 'bg-gradient-to-r from-amber-400 to-amber-500'
    if (score >= 40) return 'bg-gradient-to-r from-amber-500 to-amber-400'
    return 'bg-gradient-to-r from-gray-400 to-gray-300'
}

function getScoreLabel(score: number) {
    if (score >= 80) return { label: 'Excellent', icon: <TrendingUp className="w-3 h-3" /> }
    if (score >= 60) return { label: 'Bon',       icon: <TrendingUp className="w-3 h-3" /> }
    if (score >= 40) return { label: 'Moyen',     icon: <Minus className="w-3 h-3" /> }
    return                  { label: 'Faible',    icon: <TrendingDown className="w-3 h-3" /> }
}

function Initials({ name }: { name: string }) {
    const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

    return (
        <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700
                        flex items-center justify-center text-slate-300 text-sm font-semibold shrink-0">
            {initials}
        </div>
    )
}

// ── Composant ──────────────────────────────────────────────

export function AICandidateRanking({ candidates }: AICandidateRankingProps) {

    if (candidates.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16
                            border-2 border-dashed border-slate-700 rounded-xl bg-slate-900">
                <Trophy className="w-10 h-10 text-slate-700 mb-3" />
                <p className="text-slate-500 text-sm font-medium">Aucun candidat analysé</p>
                <p className="text-slate-600 text-xs mt-1">Les scores apparaîtront après analyse IA</p>
            </div>
        )
    }

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden">

            {/* Header */}
            <div className="flex items-center gap-3 p-5 border-b border-slate-800 bg-slate-900/50">
                {/* Conteneur avec un léger éclat doré */}
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20
                    flex items-center justify-center">
                    {/* Icône en couleur ambre/or */}
                    <Trophy className="w-4 h-4 text-amber-400" />
                </div>

                <div>
                    <h3 className="text-slate-100 font-semibold text-base">Classement des candidats</h3>
                    <p className="text-slate-500 text-xs">Triés par score IA décroissant</p>
                </div>
            </div>

            {/* Liste */}
            <div className="divide-y divide-slate-800">
                {candidates.slice(0, 5).map((candidate) => {
                    const dec    = DECISION_CONFIG[candidate.ai_decision ?? 'PENDING']
                    const sl     = getScoreLabel(candidate.ai_score)

                    return (
                        <div key={candidate.id}
                             className="flex items-center gap-4 px-5 py-4
                                       hover:bg-slate-800/50 transition-all group cursor-pointer">



                            {/* Avatar */}
                            <Initials name={candidate.full_name} />

                            {/* Infos */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-slate-100 text-sm font-semibold truncate">
                                        {candidate.full_name}
                                    </p>
                                    <span className={`text-xs px-2 py-0.5 rounded-full border
                                                     ${dec.bg} ${dec.text} ${dec.border}`}>
                                        {dec.label}
                                    </span>
                                </div>
                                <p className="text-slate-500 text-xs truncate mt-0.5">
                                    {candidate.job_offer_title}
                                </p>

                                {/* Barre score */}
                                <div className="mt-2 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full ${getBarColor(candidate.ai_score)}
                                                   rounded-full transition-all duration-700`}
                                        style={{ width: `${candidate.ai_score}%` }}
                                    />
                                </div>
                            </div>

                            {/* Score */}
                            <div className="text-right shrink-0">
                                <p className={`text-2xl font-bold ${getScoreColor(candidate.ai_score)}`}>
                                    {candidate.ai_score}
                                </p>
                                <div className={`flex items-center gap-1 justify-end text-xs ${getScoreColor(candidate.ai_score)} opacity-70`}>
                                    {sl.icon}
                                    <span>{sl.label}</span>
                                </div>
                            </div>

                            {/* Chevron */}
                            <ChevronRight className="w-4 h-4 text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    )
                })}
            </div>
        </div>
    )
}