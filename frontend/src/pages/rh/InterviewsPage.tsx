import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    BrainCircuit, Clock, CheckCircle2, XCircle,
    AlertTriangle, Video, FileText
} from 'lucide-react'
import { Badge }      from '../../../components/ui/badge'
import { Button }     from '../../../components/ui/button'
import { Card }       from '../../../components/ui/card'
import { PageHeader } from '../../components/rh/layout/PageHeader'
import { InterviewVideoModal } from '../../components/rh/interviews/InterviewVideoModal'
import api from '../../lib/api'

// ── Types alignés sur le vrai format API ────────────────────────────
interface InterviewScores {
    communication: number | null
    clarification:  number | null
    scenario:       number | null
    qcm:            number | null
    vocal:          number | null
    global:         number | null
}

interface InterviewData {
    id:    number
    token: string
    status: string
    current_phase: string
    recommendation:       string | null
    final_recommendation: string | null
    scores: InterviewScores
    ai_interview_feedback: string
    rh_annotation: string | null
    rh_rating:     number | null
    started_at:    string | null
    completed_at:  string | null
    warnings_count: number
    video_url:      string | null
    application: {
        id:             number
        full_name:      string
        email:          string
        job_offer_title: string
        ai_score:       number
    }
    ai_interview_score: number | null
}

interface APIResponse {
    interviews: InterviewData[]
    stats: {
        total_candidates:  number
        completed_count:   number
        avg_global:        number | null
        avg_communication: number | null
        avg_scenario:      number | null
        avg_qcm:           number | null
        validated_count:   number
        to_review_count:   number
        rejected_count:    number
    }
}

// ── Config statuts ───────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    pending:          { label: 'En attente',  color: 'bg-slate-700 text-slate-300', icon: <Clock className="w-3 h-3" /> },
    in_progress:      { label: 'En cours',    color: 'bg-blue-600/20 text-blue-400 border border-blue-500/30',   icon: <BrainCircuit className="w-3 h-3" /> },
    completed:        { label: 'Terminé',     color: 'bg-green-600/20 text-green-400 border border-green-500/30', icon: <CheckCircle2 className="w-3 h-3" /> },
    expired:          { label: 'Expiré',      color: 'bg-slate-700 text-slate-400',  icon: <Clock className="w-3 h-3" /> },
    fraud_terminated: { label: 'Fraude',      color: 'bg-red-600/20 text-red-400 border border-red-500/30',      icon: <XCircle className="w-3 h-3" /> },
}

// ── Badge recommandation ─────────────────────────────────────────────
const RECO_CONFIG: Record<string, { label: string; color: string }> = {
    VALIDATED: { label: 'Validé',   color: 'bg-green-600/20 text-green-400 border border-green-500/30' },
    TO_REVIEW: { label: 'À revoir', color: 'bg-amber-600/20 text-amber-400 border border-amber-500/30'  },
    REJECTED:  { label: 'Rejeté',   color: 'bg-red-600/20 text-red-400 border border-red-500/30'    },
}

// ── Composant barre de score ─────────────────────────────────────────
function ScoreBar({ score, label }: { score: number | null; label: string }) {
    if (score === null) return (
        <div className="text-center">
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className="text-slate-600 text-sm">—</p>
        </div>
    )
    const color =
        score >= 80 ? 'text-green-400' :
            score >= 60 ? 'text-blue-400'  :
                score >= 40 ? 'text-yellow-400' : 'text-red-400'
    return (
        <div className="text-center">
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className={`text-sm font-bold ${color}`}>{score}</p>
        </div>
    )
}

// ════════════════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ════════════════════════════════════════════════════════════════════
export function InterviewsPage() {
    const navigate = useNavigate()
    const [interviews,     setInterviews]     = useState<InterviewData[]>([])
    const [apiStats,       setApiStats]       = useState<APIResponse['stats'] | null>(null)
    const [loading,        setLoading]        = useState(true)
    const [error,          setError]          = useState<string | null>(null)
    const [videoInterview, setVideoInterview] = useState<InterviewData | null>(null)
    const [filter,         setFilter]         = useState<string>('all')

    // ── Chargement ─────────────────────────────────────────────────
    useEffect(() => {
        api.get('/rh/interviews/')
            .then(r => {
                const data = r.data
                if (Array.isArray(data)) {
                    setInterviews(data)
                    setApiStats(null)
                } else if (data && Array.isArray(data.interviews)) {
                    setInterviews(data.interviews)
                    setApiStats(data.stats || null)
                } else {
                    console.warn('Format inattendu :', data)
                    setInterviews([])
                }
            })
            .catch(err => {
                console.error(err)
                setError('Impossible de charger les entretiens.')
                setInterviews([])
            })
            .finally(() => setLoading(false))
    }, [])

    // ── Filtres ─────────────────────────────────────────────────────
    const filtered = filter === 'all' ? interviews : interviews.filter(i => i.status === filter)

    // ── Stats ───────────────────────────────────────────────────────
    const stats = apiStats ? {
        total:     apiStats.total_candidates,
        completed: apiStats.completed_count,
        pending:   interviews.filter(i => i.status === 'pending').length,
        fraud:     interviews.filter(i => i.status === 'fraud_terminated').length,
        avgScore:  apiStats.avg_global ?? 0,
    } : {
        total:     interviews.length,
        completed: interviews.filter(i => i.status === 'completed').length,
        pending:   interviews.filter(i => i.status === 'pending').length,
        fraud:     interviews.filter(i => i.status === 'fraud_terminated').length,
        avgScore: (() => {
            const withScore = interviews.filter(i => i.scores?.global != null)
            if (!withScore.length) return 0
            return Math.round(withScore.reduce((acc, i) => acc + (i.scores.global || 0), 0) / withScore.length)
        })(),
    }

    // ── Rendu ───────────────────────────────────────────────────────
    return (
        <div className="p-6 space-y-6">
            <PageHeader
                title="Entretiens IA"
                subtitle="Résultats et rapports des entretiens automatisés"
                badge="IA"
                badgeIcon={<BrainCircuit className="w-3 h-3" />}
            />

            {/* Stats rapides */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total',       value: stats.total,             color: 'text-white'      },
                    { label: 'Terminés',    value: stats.completed,         color: 'text-green-400'  },
                    { label: 'En attente',  value: stats.pending,           color: 'text-blue-400'   },
                    { label: 'Score moyen', value: `${stats.avgScore}/100`, color: 'text-purple-400' },
                ].map(s => (
                    <Card key={s.label} className="bg-slate-800/50 border-slate-700 p-4 text-center">
                        <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-xs text-slate-400 mt-1">{s.label}</p>
                    </Card>
                ))}
            </div>

            {/* Recommandations (si stats API dispo) */}
            {apiStats && (
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'Validés',  value: apiStats.validated_count, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
                        { label: 'À revoir', value: apiStats.to_review_count, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20'  },
                        { label: 'Rejetés',  value: apiStats.rejected_count,  color: 'text-red-400',   bg: 'bg-red-500/10 border-red-500/20'      },
                    ].map(s => (
                        <Card key={s.label} className={`border p-3 text-center ${s.bg}`}>
                            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
                        </Card>
                    ))}
                </div>
            )}

            {/* Filtres */}
            <div className="flex gap-2 flex-wrap">
                {['all', 'pending', 'in_progress', 'completed', 'fraud_terminated'].map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                            filter === f
                                ? 'bg-purple-600 text-white'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                    >
                        {f === 'all' ? `Tous (${interviews.length})` : STATUS_CONFIG[f]?.label || f}
                    </button>
                ))}
            </div>

            {/* Erreur */}
            {error && (
                <Card className="bg-red-900/20 border-red-500/30 p-4 text-center">
                    <p className="text-red-400">{error}</p>
                </Card>
            )}

            {/* Liste */}
            {loading ? (
                <div className="text-center py-12 text-slate-400">Chargement...</div>
            ) : filtered.length === 0 ? (
                <Card className="bg-slate-800/50 border-slate-700 p-12 text-center">
                    <BrainCircuit className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400">Aucun entretien trouvé</p>
                </Card>
            ) : (
                <div className="space-y-3">
                    {filtered.map(interview => {
                        const sc        = interview.scores ?? {}
                        const statusCfg = STATUS_CONFIG[interview.status] || STATUS_CONFIG['pending']
                        const recoCfg   = RECO_CONFIG[interview.final_recommendation ?? '']
                        const hasVideo  = !!interview.video_url

                        return (
                            <Card
                                key={interview.id}
                                className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-all p-4"
                            >
                                <div className="flex items-center gap-4">

                                    {/* Candidat + statuts */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <p className="text-white font-semibold truncate">
                                                {interview.application.full_name}
                                            </p>
                                            <Badge className={`text-xs shrink-0 ${statusCfg.color}`}>
                                                {statusCfg.icon}
                                                <span className="ml-1">{statusCfg.label}</span>
                                            </Badge>
                                            {recoCfg && (
                                                <Badge className={`text-xs shrink-0 ${recoCfg.color}`}>
                                                    {recoCfg.label}
                                                </Badge>
                                            )}
                                            {interview.warnings_count > 0 && (
                                                <Badge className="bg-orange-600/20 text-orange-400 border border-orange-500/30 text-xs">
                                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                                    {interview.warnings_count} warning{interview.warnings_count > 1 ? 's' : ''}
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-slate-400 text-sm truncate">
                                            {interview.application.job_offer_title}
                                        </p>
                                    </div>

                                    {/* Scores */}
                                    <div className="hidden md:grid grid-cols-5 gap-3 bg-slate-900/50 rounded-lg px-4 py-2">
                                        <ScoreBar score={sc.communication ?? null} label="Comm."  />
                                        <ScoreBar score={sc.clarification  ?? null} label="CV"     />
                                        <ScoreBar score={sc.scenario       ?? null} label="Scén."  />
                                        <ScoreBar score={sc.qcm            ?? null} label="QCM"    />
                                        <ScoreBar score={sc.vocal          ?? null} label="Vocal"  />
                                    </div>

                                    {/* Score global */}
                                    <div className="text-center shrink-0 w-20">
                                        {sc.global != null ? (
                                            <>
                                                <p className={`text-2xl font-bold ${
                                                    sc.global >= 80 ? 'text-green-400' :
                                                        sc.global >= 60 ? 'text-blue-400'  : 'text-red-400'
                                                }`}>
                                                    {sc.global}
                                                </p>
                                                <p className="text-xs text-slate-500">/ 100</p>
                                            </>
                                        ) : (
                                            <p className="text-slate-600 text-sm">—</p>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setVideoInterview(interview)}
                                            disabled={!hasVideo}
                                            title={hasVideo ? 'Voir la vidéo' : 'Aucune vidéo'}
                                            className={`border-slate-600 shrink-0 transition-all ${
                                                hasVideo
                                                    ? 'text-cyan-400 border-cyan-500/40 hover:bg-cyan-500/10'
                                                    : 'text-slate-600 border-slate-700 cursor-not-allowed opacity-50'
                                            }`}
                                        >
                                            <Video className="w-4 h-4 mr-1" />
                                            Vidéo
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => navigate(`/rh/interviews/${interview.token}/report`)}
                                            className="border-slate-600 text-slate-300 hover:bg-slate-700 shrink-0"
                                        >
                                            <FileText className="w-4 h-4 mr-1" />
                                            Rapport
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        )
                    })}
                </div>
            )}

            {/* Modal Vidéo */}
            {videoInterview && (
                <InterviewVideoModal interview={videoInterview} onClose={() => setVideoInterview(null)} />
            )}
        </div>
    )
}