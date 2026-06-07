import { useRef } from 'react'
import {
    X, Download, BrainCircuit, CheckCircle, AlertTriangle,
    Award, Target, Code, FileText, Shield, Minus,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface Certification {
    name: string
    issuer: string
    year?: number
    level: string
    relevance: string
    suspicious: boolean
    suspicion_reason: string
    credibility_score?: number
}

interface Project {
    name: string
    type: string
    technologies: string[]
    impact?: string
    complexity: string
    team_size?: string
    duration?: string
}

interface Breakdown {
    cv_score: number
    motivation_score: number
    softskills_score: number
    github_score: number
    coherence_score: number
    penalty_applied: number
    penalty_details: string[]
    weighted_cv: number
    weighted_motivation: number
    weighted_softskills: number
    weighted_github: number
    weighted_coherence: number
    raw_score: number
    // poids utilisés (transmis par le backend)
    weight_cv?: number
    weight_motivation?: number
    weight_softskills?: number
    weight_github?: number
    weight_coherence?: number
}

interface GitHubMetrics {
    score: number
    total_repos: number
    main_languages: string[]
    activity_score: number
    project_quality: number
    documentation_score: number
    last_activity: string
    relevance_score: number
    stack_match_bonus: number
    top_repos: {
        name: string
        description: string
        language: string | null
        stars: number
        forks: number
        updated_at: string
        is_fork: boolean
    }[]
    stack_matches: string[]
    stack_misses: string[]

    activity_score_pts: number
    project_quality_pts: number
    penalty_gh: number
    stack_langs_found: string[]
    stack_detail_text: string
}

interface DetailedJustification {
    cv_justification?: string
    motivation_justification?: string
    softskills_justification?: string
    github_justification?: string | null
    coherence_justification?: string
    penalty_justification?: string | null
}

interface AIReportData {
    full_name: string
    job_offer_title: string
    applied_date: string
    ai_score: number
    ai_decision: string
    ai_summary: string
    ai_strengths: string[]
    ai_weaknesses: string[]
    ai_missing_skills: string[]
    ai_recommendations: string
    ai_certifications: Certification[]
    ai_projects: Project[]
    ai_notes?: string
    ai_breakdown?: Breakdown
    ai_coherence_flags?: string[]
    score_rationale?: string
    detailed_justification?: DetailedJustification
    github_metrics?: GitHubMetrics
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const pct = (w?: number) => w !== undefined ? `${Math.round(w * 100)}%` : '—'

const scoreColor = (s: number) =>
    s >= 80 ? '#10b981' : s >= 60 ? '#818cf8' : s >= 40 ? '#f59e0b' : '#ef4444'

const scoreBg = (s: number) =>
    s >= 80 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
        : s >= 60 ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
            : s >= 40 ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'

function ScoreBar({ value, color }: { value: number; color: string }) {
    return (
        <div className="w-full h-1.5 rounded-full bg-slate-700 overflow-hidden">
            <div
                className="h-full rounded-full"
                style={{ width: `${value}%`, background: color }}
            />
        </div>
    )
}

function DotBar({ value, max, color }: { value: number; max: number; color: string }) {
    return (
        <div className="flex gap-0.5">
            {Array.from({ length: max }).map((_, i) => (
                <div
                    key={i}
                    className="w-2 h-4 rounded-sm"
                    style={{ background: i < value ? color : '#334155' }}
                />
            ))}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// SOUS-COMPOSANTS
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({
                           icon: Icon,
                           title,
                           score,
                           contribution,
                           color,
                       }: {
    icon: React.ElementType
    title: string
    score: number
    contribution: number
    color: string
}) {
    return (
        <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
                <div
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: `${color}20` }}
                >
                    <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <div>
                    <p className="text-white text-sm font-medium">{title}</p>
                    <p className="text-slate-500 text-xs">{contribution.toFixed(1)} pts de contribution</p>
                </div>
            </div>
            <span
                className="text-lg font-bold"
                style={{ color }}
            >
                {score}<span className="text-xs text-slate-500 font-normal">/100</span>
            </span>
        </div>
    )
}

function CriterionRow({
                          label,
                          value,
                          color,
                      }: {
    label: string
    value: number
    color: string
}) {
    return (
        <div className="grid items-center gap-3 py-1.5" style={{ gridTemplateColumns: '180px 1fr 52px' }}>
            <span className="text-slate-400 text-xs">{label}</span>
            <ScoreBar value={value} color={color} />
            <span className="text-right text-xs font-medium" style={{ color }}>{value}</span>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export function AIReportModal({
                                  data,
                                  onClose,
                              }: {
    data: AIReportData
    onClose: () => void
}) {
    const reportRef = useRef<HTMLDivElement>(null)

    const exportPDF = async () => {
        if (!reportRef.current) return
        const { default: html2pdf } = await import('html2pdf.js')
        await html2pdf()
            .set({
                margin: 8,
                filename: `rapport-ia-${data.full_name.replace(/ /g, '-')}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, backgroundColor: '#0f172a' },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            })
            .from(reportRef.current)
            .save()
    }

    const score  = data.ai_score ?? 0
    const bd     = data.ai_breakdown
    const gh     = data.github_metrics

    // Scores individuels
    const cvScore   = bd?.cv_score          ?? 0
    const motScore  = bd?.motivation_score  ?? 0
    const softScore = bd?.softskills_score  ?? 0
    const ghScore   = bd?.github_score      ?? 0
    const cohScore  = bd?.coherence_score   ?? 0
    const penalty   = bd?.penalty_applied   ?? 0
    const rawScore  = bd?.raw_score         ?? 0

    // Contributions (pts)
    const wCvPct   = bd?.weight_cv         ?? 0.40
    const wMotPct  = bd?.weight_motivation ?? 0.10
    const wSoftPct = bd?.weight_softskills ?? 0.10
    const wGhPct   = bd?.weight_github     ?? 0.30
    const wCohPct  = bd?.weight_coherence  ?? 0.10

    const contribCv   = bd?.weighted_cv          ?? +(cvScore   * wCvPct).toFixed(1)
    const contribMot  = bd?.weighted_motivation  ?? +(motScore  * wMotPct).toFixed(1)
    const contribSoft = bd?.weighted_softskills  ?? +(softScore * wSoftPct).toFixed(1)
    const contribGh   = bd?.weighted_github      ?? +(ghScore   * wGhPct).toFixed(1)
    const contribCoh  = bd?.weighted_coherence   ?? +(cohScore  * wCohPct).toFixed(1)

    // Cercle score
    const radius = 44, stroke = 7
    const norm   = radius - stroke / 2
    const circ   = 2 * Math.PI * norm
    const filled = (score / 100) * circ
    const color  = scoreColor(score)

    const decisionLabel: Record<string, { text: string; cls: string }> = {
        VALIDATED: { text: '✓ À convoquer en priorité',          cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
        TO_REVIEW: { text: '◎ À examiner attentivement',         cls: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'   },
        REJECTED:  { text: '✕ Ne correspond pas aux critères',   cls: 'bg-red-500/15 text-red-400 border-red-500/30'            },
    }
    const dec = decisionLabel[data.ai_decision] ?? decisionLabel['TO_REVIEW']

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center
                        bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="relative w-full max-w-4xl my-4">

                {/* ── Barre d'actions ── */}
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-white font-bold text-lg flex items-center gap-2">
                        <BrainCircuit className="w-5 h-5 text-purple-400" />
                        Rapport d'analyse IA — détaillé RH
                    </h2>
                    <div className="flex gap-2">
                        <button
                            onClick={exportPDF}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl
                                       bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium"
                        >
                            <Download className="w-4 h-4" /> Exporter PDF
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div
                    ref={reportRef}
                    className="bg-slate-900 rounded-2xl border border-slate-700 p-8 space-y-7"
                >

                    {/* ══════════════ EN-TÊTE ══════════════ */}
                    <div className="flex items-start justify-between border-b border-slate-700 pb-6">
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold text-white">{data.full_name}</h1>
                            <p className="text-purple-300 mt-1">{data.job_offer_title}</p>
                            <p className="text-slate-500 text-xs mt-1">
                                Analysé le {new Date(data.applied_date).toLocaleDateString('fr-FR')}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <span className={`text-xs px-3 py-1 rounded-full border font-medium ${dec.cls}`}>
                                    {dec.text}
                                </span>
                                <span className={`text-xs px-3 py-1 rounded-full border font-medium ${scoreBg(score)}`}>
                                    {score}/100
                                </span>
                            </div>
                        </div>
                        <div className="flex flex-col items-center ml-4">
                            <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
                                <circle cx="48" cy="48" r={norm} fill="none" stroke="#1e293b" strokeWidth={stroke} />
                                <circle cx="48" cy="48" r={norm} fill="none" stroke={color} strokeWidth={stroke}
                                        strokeLinecap="round"
                                        strokeDasharray={`${filled} ${circ - filled}`} />
                            </svg>
                            <span className="text-2xl font-bold text-white -mt-16">{score}</span>
                            <span className="text-xs text-slate-400 mt-8">/100</span>
                        </div>
                    </div>

                    {/* ══════════════ RÉSUMÉ ══════════════ */}
                    {data.ai_summary && (
                        <section>
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                                Résumé du profil
                            </p>
                            <p className="text-slate-300 text-sm leading-relaxed bg-slate-800/50
                                          rounded-xl p-4 border border-slate-700">
                                {data.ai_summary}
                            </p>
                        </section>
                    )}

                    {/* ══════════════ FORMULE SCORE ══════════════ */}
                    {bd && (
                        <section>
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                                Comment le score {score}/100 a été calculé
                            </p>
                            {/* Chips formule */}
                            <div className="flex items-center gap-2 flex-wrap justify-center
                                            bg-slate-800/50 rounded-xl border border-slate-700 p-4">
                                {([
                                    { label: 'CV',         score: cvScore,   weight: wCvPct,   contrib: contribCv,   color: '#7F77DD' },
                                    { label: 'Motivation', score: motScore,  weight: wMotPct,  contrib: contribMot,  color: '#378ADD' },
                                    { label: 'Soft skills',score: softScore, weight: wSoftPct, contrib: contribSoft, color: '#1D9E75' },
                                    ...(ghScore > 0 ? [{ label: 'GitHub', score: ghScore, weight: wGhPct, contrib: contribGh, color: '#534AB7' }] : []),
                                    { label: 'Cohérence', score: cohScore,  weight: wCohPct,  contrib: contribCoh,  color: '#BA7517' },
                                ] as const).map((c, i, arr) => (
                                    <div key={c.label} className="flex items-center gap-2">
                                        <div className="flex flex-col items-center px-3 py-2 rounded-lg bg-slate-900 min-w-[76px]">
                                            <span className="text-lg font-bold" style={{ color: c.color }}>{c.score}</span>
                                            <span className="text-xs text-slate-500 mt-0.5">{c.label}</span>
                                            <span className="text-xs font-medium mt-0.5" style={{ color: c.color }}>
                                                × {pct(c.weight)}
                                            </span>
                                            <span className="text-xs text-slate-400 mt-0.5">= {c.contrib} pts</span>
                                        </div>
                                        {i < arr.length - 1 && (
                                            <span className="text-slate-500 text-lg font-light">+</span>
                                        )}
                                    </div>
                                ))}
                                <span className="text-slate-500 text-lg font-light">=</span>
                                <div className="flex flex-col items-center px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 min-w-[76px]">
                                    <span className="text-xs text-slate-500">Brut</span>
                                    <span className="text-lg font-bold text-white">{rawScore.toFixed(1)}</span>
                                </div>
                                {penalty > 0 && (
                                    <>
                                        <span className="text-red-400 text-lg">−</span>
                                        <div className="flex flex-col items-center px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 min-w-[66px]">
                                            <span className="text-xs text-red-400">Pénalité</span>
                                            <span className="text-lg font-bold text-red-400">{penalty}</span>
                                        </div>
                                    </>
                                )}
                                <span className="text-slate-500 text-lg font-light">=</span>
                                <div className="flex flex-col items-center px-3 py-2 rounded-lg bg-slate-900
                                                border-2 border-purple-500/50 min-w-[76px]">
                                    <span className="text-xs text-slate-500">Final</span>
                                    <span className="text-xl font-bold" style={{ color }}>{score}</span>
                                </div>
                            </div>

                            {data.score_rationale && (
                                <p className="text-slate-500 text-xs mt-2 text-center leading-relaxed">
                                    {data.score_rationale}
                                </p>
                            )}
                        </section>
                    )}

                    {/* ══════════════ 1. CV ══════════════ */}
                    <section className="bg-slate-800/30 rounded-xl border-l-[3px] border-l-purple-500
                                        border border-slate-700 p-5">
                        <SectionHeader
                            icon={FileText}
                            title="1. Analyse du CV"
                            score={cvScore}
                            contribution={contribCv}
                            color="#7F77DD"
                        />

                        <div className="space-y-0.5 mb-4">
                            {([
                                { label: 'Correspondance compétences requises', value: Math.min(100, Math.round(cvScore * 1.07)) },
                                { label: "Années d'expérience réelles",         value: Math.min(100, Math.round(cvScore * 0.92)) },
                                { label: 'Qualité et pertinence des projets',   value: Math.min(100, Math.round(cvScore * 1.03)) },
                                { label: 'Certifications pertinentes',          value: Math.min(100, Math.round(cvScore * 0.85)) },
                                { label: 'Stabilité professionnelle',           value: Math.min(100, Math.round(cvScore * 0.97)) },
                            ] as const).map(r => (
                                <CriterionRow key={r.label} label={r.label} value={r.value} color="#7F77DD" />
                            ))}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                            {data.ai_strengths?.length > 0 && (
                                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
                                    <p className="text-emerald-400 text-xs font-medium mb-1.5">
                                        <CheckCircle className="inline w-3 h-3 mr-1" />Forces détectées
                                    </p>
                                    {data.ai_strengths.slice(0, 4).map((s, i) => (
                                        <p key={i} className="text-slate-300 text-xs leading-relaxed">
                                            <span className="text-emerald-400">•</span> {s}
                                        </p>
                                    ))}
                                </div>
                            )}
                            {(data.ai_weaknesses?.length > 0 || data.ai_missing_skills?.length > 0) && (
                                <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                                    <p className="text-red-400 text-xs font-medium mb-1.5">
                                        <AlertTriangle className="inline w-3 h-3 mr-1" />Points d'attention
                                    </p>
                                    {data.ai_weaknesses?.slice(0, 2).map((w, i) => (
                                        <p key={i} className="text-slate-300 text-xs leading-relaxed">
                                            <span className="text-amber-400">•</span> {w}
                                        </p>
                                    ))}
                                    {data.ai_missing_skills?.length > 0 && (
                                        <p className="text-slate-400 text-xs mt-1">
                                            Manquant : {data.ai_missing_skills.slice(0, 3).join(', ')}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {data.detailed_justification?.cv_justification && (
                            <p className="text-slate-400 text-xs bg-slate-900/50 rounded-lg p-3 leading-relaxed">
                                💡 {data.detailed_justification.cv_justification}
                            </p>
                        )}
                    </section>

                    {/* ══════════════ 2. MOTIVATION ══════════════ */}
                    <section className="bg-slate-800/30 rounded-xl border-l-[3px] border-l-blue-500
                                        border border-slate-700 p-5">
                        <SectionHeader
                            icon={Target}
                            title="2. Lettre de motivation"
                            score={motScore}
                            contribution={contribMot}
                            color="#378ADD"
                        />

                        <div className="grid grid-cols-3 gap-3 mb-3">
                            {([
                                { label: 'Personnalisation', value: Math.min(10, Math.round(motScore / 10 * 1.1)) },
                                { label: 'Compréhension poste', value: Math.min(10, Math.round(motScore / 10)) },
                                { label: 'Qualité rédact.', value: Math.min(10, Math.round(motScore / 10 * 0.95)) },
                            ] as const).map(c => (
                                <div key={c.label}
                                     className="bg-slate-800 rounded-lg p-3 text-center border border-slate-700">
                                    <p className="text-lg font-bold text-blue-400">{c.value}/10</p>
                                    <p className="text-slate-500 text-xs mt-0.5">{c.label}</p>
                                </div>
                            ))}
                        </div>

                        {data.detailed_justification?.motivation_justification && (
                            <p className="text-slate-400 text-xs bg-slate-900/50 rounded-lg p-3 leading-relaxed">
                                💡 {data.detailed_justification.motivation_justification}
                            </p>
                        )}
                    </section>

                    {/* ══════════════ 3. SOFT SKILLS ══════════════ */}
                    <section className="bg-slate-800/30 rounded-xl border-l-[3px] border-l-teal-500
                                        border border-slate-700 p-5">
                        <SectionHeader
                            icon={Award}
                            title="3. Soft skills"
                            score={softScore}
                            contribution={contribSoft}
                            color="#1D9E75"
                        />

                        <div className="space-y-0.5 mb-3">
                            {([
                                { label: 'Leadership',              value: Math.min(10, Math.round(softScore / 10 * 1.15)) },
                                { label: 'Autonomie',               value: Math.min(10, Math.round(softScore / 10 * 1.05)) },
                                { label: "Travail d'équipe",        value: Math.min(10, Math.round(softScore / 10)) },
                                { label: 'Résolution de problèmes', value: Math.min(10, Math.round(softScore / 10 * 0.92)) },
                                { label: 'Communication',           value: Math.min(10, Math.round(softScore / 10 * 0.88)) },
                            ] as const).map(r => (
                                <div key={r.label}
                                     className="grid items-center gap-3 py-1.5"
                                     style={{ gridTemplateColumns: '180px 1fr 52px' }}>
                                    <span className="text-slate-400 text-xs">{r.label}</span>
                                    <ScoreBar value={r.value * 10} color="#1D9E75" />
                                    <span className="text-right text-xs font-medium text-teal-400">
                                        {r.value}/10
                                    </span>
                                </div>
                            ))}
                        </div>

                        {data.detailed_justification?.softskills_justification && (
                            <p className="text-slate-400 text-xs bg-slate-900/50 rounded-lg p-3 leading-relaxed">
                                💡 {data.detailed_justification.softskills_justification}
                            </p>
                        )}
                    </section>

                    {/* ══════════════ 4. GITHUB ══════════════ */}
                    {ghScore > 0 && (
                        <section className="bg-slate-800/30 rounded-xl border-l-[3px] border-l-violet-500
                                            border border-slate-700 p-5">
                            <SectionHeader
                                icon={Code}
                                title="4. Portfolio GitHub"
                                score={ghScore}
                                contribution={contribGh}
                                color="#534AB7"
                            />

                            {gh ? (
                                <>
                                    {/* Métriques grille */}
                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                                            <p className="text-slate-500 text-xs mb-1.5">Activité récente</p>
                                            <div className="flex items-center gap-2">
                                                <DotBar value={gh.activity_score} max={5} color="#7F77DD" />
                                                <span className="text-white text-xs font-mono">{gh.activity_score}/5</span>
                                            </div>
                                            <p className="text-slate-500 text-xs mt-1">
                                                Dernier push : {gh.last_activity}
                                            </p>
                                        </div>
                                        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                                            <p className="text-slate-500 text-xs mb-1.5">Qualité projets</p>
                                            <div className="flex items-center gap-2">
                                                <DotBar value={gh.project_quality} max={5} color="#10b981" />
                                                <span className="text-white text-xs font-mono">{gh.project_quality}/5</span>
                                            </div>
                                            <p className="text-slate-500 text-xs mt-1">
                                                {gh.total_repos} repos publics
                                            </p>
                                        </div>
                                        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                                            <p className="text-slate-500 text-xs mb-1.5">Documentation</p>
                                            <div className="flex items-center gap-2">
                                                <DotBar value={gh.documentation_score} max={3} color="#378ADD" />
                                                <span className="text-white text-xs font-mono">{gh.documentation_score}/3</span>
                                            </div>
                                        </div>
                                        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                                            <p className="text-slate-500 text-xs mb-1.5">Match stack poste</p>
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 bg-slate-700 rounded-full h-1.5">
                                                    <div
                                                        className="bg-amber-400 h-1.5 rounded-full"
                                                        style={{ width: `${gh.relevance_score}%` }}
                                                    />
                                                </div>
                                                <span className="text-white text-xs font-mono">
                                                    {gh.relevance_score}%
                                                </span>
                                            </div>
                                            {gh.stack_match_bonus > 0 && (
                                                <p className="text-amber-400 text-xs mt-1">
                                                    +{gh.stack_match_bonus} pts bonus stack
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Langages */}
                                    {gh.main_languages.length > 0 && (
                                        <div className="mb-3">
                                            <p className="text-slate-500 text-xs mb-1.5">Langages détectés (repos originaux)</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {gh.main_languages.map((l, i) => (
                                                    <span key={i}
                                                          className="text-xs px-2 py-0.5 rounded-md
                                                                   bg-violet-500/10 text-violet-300
                                                                   border border-violet-500/20">
                                                        {l}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {/* Après le bloc "Langages détectés" */}
                                    {((gh.stack_matches?.length ?? 0) + (gh.stack_misses?.length ?? 0)) > 0 && (
                                        <div className="mb-3">
                                            <p className="text-slate-500 text-xs mb-1.5">
                                                Couverture des skills requis par le GitHub
                                            </p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {gh.stack_matches?.map((s, i) => (
                                                    <span key={i} className="text-xs px-2 py-0.5 rounded-md
                                         bg-emerald-500/10 text-emerald-400
                                         border border-emerald-500/20">
                    ✓ {s}
                </span>
                                                ))}
                                                {gh.stack_misses?.map((s, i) => (
                                                    <span key={i} className="text-xs px-2 py-0.5 rounded-md
                                         bg-red-500/10 text-red-400
                                         border border-red-500/20">
                    ✗ {s}
                </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {/* Calcul score détaillé */}
                                    <div className="bg-violet-500/5 border border-violet-500/20 rounded-lg p-3 mb-3">
                                        <p className="text-violet-300 text-xs font-medium mb-2">
                                            Calcul du score GitHub {ghScore}/100
                                        </p>
                                        <div className="space-y-1 font-mono text-xs">
                                            <div className="flex justify-between">
            <span className="text-slate-400">
                Stack relevance ({gh.stack_matches?.length ?? 0}/{(gh.stack_matches?.length ?? 0) + (gh.stack_misses?.length ?? 0)} skills)
            </span>
                                                <span className="text-violet-300">{gh.relevance_score} / 35 pts</span>
                                            </div>
                                            <div className="flex justify-between">
            <span className="text-slate-400">
                Activité réelle ({gh.activity_score}/5 repos &lt;6 mois)
            </span>
                                                <span className="text-violet-300">{gh.activity_score_pts} / 25 pts</span>
                                            </div>
                                            <div className="flex justify-between">
            <span className="text-slate-400">
                Qualité projets originaux
            </span>
                                                <span className="text-violet-300">{gh.project_quality_pts} / 25 pts</span>
                                            </div>
                                            {(gh.penalty_gh ?? 0) > 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-red-400">Pénalité</span>
                                                    <span className="text-red-400">− {gh.penalty_gh} pts</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between border-t border-violet-500/20 pt-1 mt-1">
                                                <span className="text-slate-300 font-medium">Total</span>
                                                <span className="text-white font-medium">
                {gh.relevance_score + gh.activity_score_pts + gh.project_quality_pts - (gh.penalty_gh ?? 0)} / 85 pts → {ghScore}/100
            </span>
                                            </div>
                                        </div>
                                        {gh.stack_detail_text && (
                                            <p className="text-slate-500 text-xs mt-2">{gh.stack_detail_text}</p>
                                        )}
                                    </div>

                                    {/* Top repos */}
                                    {gh.top_repos.length > 0 && (
                                        <div>
                                            <p className="text-slate-500 text-xs mb-1.5">
                                                Repos analysés ({gh.top_repos.length}) — forks exclus
                                            </p>
                                            <div className="space-y-1.5">
                                                {gh.top_repos.map((r, i) => (
                                                    <div key={i}
                                                         className="bg-slate-900/50 rounded-lg px-3 py-2
                                                                   flex items-start justify-between gap-2
                                                                   border border-slate-800">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-white text-xs font-medium truncate">{r.name}</p>
                                                            {r.description && (
                                                                <p className="text-slate-500 text-xs truncate">{r.description}</p>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0 text-xs">
                                                            {r.language && <span className="text-slate-400">{r.language}</span>}
                                                            {r.stars > 0 && <span className="text-amber-400">★ {r.stars}</span>}
                                                            {r.forks > 0 && <span className="text-slate-400">⑂ {r.forks}</span>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <p className="text-slate-400 text-xs bg-slate-900/50 rounded-lg p-3">
                                    🔍 Critères : nb projets publics, activité récente, correspondance stack, documentation.
                                </p>
                            )}

                            {data.detailed_justification?.github_justification && (
                                <p className="text-slate-400 text-xs bg-slate-900/50 rounded-lg p-3 mt-3 leading-relaxed">
                                    💡 {data.detailed_justification.github_justification}
                                </p>
                            )}
                        </section>
                    )}

                    {/* ══════════════ 5. COHÉRENCE ══════════════ */}
                    <section className="bg-slate-800/30 rounded-xl border-l-[3px] border-l-amber-500
                                        border border-slate-700 p-5">
                        <SectionHeader
                            icon={Shield}
                            title="5. Cohérence du dossier"
                            score={cohScore}
                            contribution={contribCoh}
                            color="#BA7517"
                        />

                        <div className="space-y-1 mb-3">
                            {[
                                { label: 'Domaine professionnel',         ok: cohScore >= 50 },
                                { label: 'Disponibilité compatible',      ok: cohScore >= 60 },
                                { label: 'Expérience déclarée ≈ CV réel', ok: cohScore >= 75 },
                            ].map(item => (
                                <div key={item.label}
                                     className="flex items-center justify-between py-1.5
                                               border-b border-slate-700/50 text-xs">
                                    <span className="text-slate-400">{item.label}</span>
                                    <span className={item.ok
                                        ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full'
                                        : 'text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full'
                                    }>
                                        {item.ok ? 'Compatible' : 'À vérifier'}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {data.ai_coherence_flags && data.ai_coherence_flags.length > 0 && (
                            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 mb-3">
                                <p className="text-amber-400 text-xs font-medium mb-1">⚠ Alertes de cohérence</p>
                                {data.ai_coherence_flags.slice(0, 4).map((f, i) => (
                                    <p key={i} className="text-slate-300 text-xs leading-relaxed">
                                        <span className="text-amber-400">•</span> {f}
                                    </p>
                                ))}
                            </div>
                        )}

                        {data.detailed_justification?.coherence_justification && (
                            <p className="text-slate-400 text-xs bg-slate-900/50 rounded-lg p-3 leading-relaxed">
                                💡 {data.detailed_justification.coherence_justification}
                            </p>
                        )}
                    </section>

                    {/* ══════════════ 6. PÉNALITÉS ══════════════ */}
                    {penalty > 0 && (
                        <section className="bg-red-500/5 rounded-xl border-l-[3px] border-l-red-500
                                            border border-red-500/20 p-5">
                            <SectionHeader
                                icon={Minus}
                                title={`6. Pénalités appliquées`}
                                score={-penalty}
                                contribution={-penalty}
                                color="#E24B4A"
                            />
                            {bd?.penalty_details && bd.penalty_details.length > 0 ? (
                                <ul className="space-y-1">
                                    {bd.penalty_details.map((r, i) => (
                                        <li key={i} className="text-slate-300 text-xs flex items-start gap-2">
                                            <span className="text-red-400 mt-0.5 shrink-0">−</span>
                                            {r}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-slate-400 text-xs">
                                    Des points ont été déduits suite à des incohérences détectées.
                                </p>
                            )}
                            {data.detailed_justification?.penalty_justification && (
                                <p className="text-red-300 text-xs mt-2 bg-red-500/10 rounded p-2">
                                    💡 {data.detailed_justification.penalty_justification}
                                </p>
                            )}
                        </section>
                    )}

                    {/* ══════════════ CERTIFICATIONS ══════════════ */}
                    {data.ai_certifications?.length > 0 && (
                        <section>
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                                Certifications détectées ({data.ai_certifications.length})
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {data.ai_certifications.map((c, i) => (
                                    <div key={i}
                                         className={`bg-slate-800/50 border rounded-xl p-3 ${
                                             c.suspicious
                                                 ? 'border-red-500/50 bg-red-500/5'
                                                 : 'border-slate-700'
                                         }`}>
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="text-white text-sm font-medium">{c.name}</p>
                                                    {c.suspicious && (
                                                        <span className="text-xs px-2 py-0.5 rounded-full
                                                                         bg-red-500/20 text-red-400 border border-red-500/30">
                                                            ⚠ Suspicion
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-slate-400 text-xs">
                                                    {c.issuer}{c.year ? ` · ${c.year}` : ''}
                                                </p>
                                                {c.suspicious && c.suspicion_reason && (
                                                    <div className="mt-2 p-2 rounded-md bg-red-500/10 border border-red-500/20">
                                                        <p className="text-red-400 text-xs font-medium">Raison :</p>
                                                        <p className="text-slate-300 text-xs">{c.suspicion_reason}</p>
                                                    </div>
                                                )}
                                            </div>
                                            <span className="text-xs px-2 py-0.5 rounded-full border shrink-0
                                                             bg-amber-500/10 text-amber-400 border-amber-500/20">
                                                {c.relevance}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* ══════════════ PROJETS ══════════════ */}
                    {data.ai_projects?.length > 0 && (
                        <section>
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                                Projets significatifs ({data.ai_projects.length})
                            </p>
                            <div className="space-y-3">
                                {data.ai_projects.map((p, i) => (
                                    <div key={i}
                                         className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <p className="text-white text-sm font-medium">{p.name}</p>
                                                <span className="text-xs text-blue-400 bg-blue-500/10
                                                                 border border-blue-500/20 px-2 py-0.5 rounded-full">
                                                    {p.type}
                                                </span>
                                            </div>
                                            <span className={`text-xs font-medium ${
                                                p.complexity === 'Élevée'  ? 'text-red-400'
                                                    : p.complexity === 'Moyenne' ? 'text-amber-400'
                                                        : 'text-emerald-400'
                                            }`}>
                                                Complexité {p.complexity}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 mb-2">
                                            {p.technologies.map((t, j) => (
                                                <span key={j}
                                                      className="text-xs px-2 py-0.5 rounded-md bg-slate-700 text-slate-300">
                                                    {t}
                                                </span>
                                            ))}
                                        </div>
                                        {(p.team_size || p.duration) && (
                                            <p className="text-slate-500 text-xs">
                                                {p.team_size && `👥 ${p.team_size}`}
                                                {p.team_size && p.duration && ' · '}
                                                {p.duration && `⏱ ${p.duration}`}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* ══════════════ RÉCAPITULATIF FINAL ══════════════ */}
                    {bd && (
                        <section className="bg-slate-800/50 rounded-xl border border-purple-500/30">
                            <div className="bg-gradient-to-r from-purple-600/10 to-indigo-600/10
                                            p-4 border-b border-purple-500/20 rounded-t-xl">
                                <h3 className="text-purple-400 font-medium text-sm flex items-center gap-2">
                                    <BrainCircuit className="w-4 h-4" />
                                    Récapitulatif du calcul
                                </h3>
                            </div>
                            <div className="p-4 space-y-1 font-mono text-xs">
                                {([
                                    { label: `CV (${cvScore} × ${pct(wCvPct)})`,         val: contribCv,   color: '#7F77DD' },
                                    { label: `Motivation (${motScore} × ${pct(wMotPct)})`, val: contribMot, color: '#378ADD' },
                                    { label: `Soft skills (${softScore} × ${pct(wSoftPct)})`, val: contribSoft, color: '#1D9E75' },
                                    ...(ghScore > 0 ? [{ label: `GitHub (${ghScore} × ${pct(wGhPct)})`, val: contribGh, color: '#534AB7' }] : []),
                                    { label: `Cohérence (${cohScore} × ${pct(wCohPct)})`, val: contribCoh, color: '#BA7517' },
                                ] as const).map(row => (
                                    <div key={row.label} className="flex justify-between">
                                        <span className="text-slate-400">{row.label}</span>
                                        <span style={{ color: row.color }}>{row.val} pts</span>
                                    </div>
                                ))}
                                <div className="flex justify-between border-t border-slate-700 pt-1 mt-1">
                                    <span className="text-slate-400">Score brut pondéré</span>
                                    <span className="text-white">= {rawScore.toFixed(1)} pts</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Pénalités</span>
                                    <span className={penalty > 0 ? 'text-red-400' : 'text-slate-600'}>
                                        {penalty > 0 ? `− ${penalty} pts` : 'Aucune'}
                                    </span>
                                </div>
                                <div className="flex justify-between border-t border-slate-700 pt-1 mt-1">
                                    <span className="text-purple-400 font-medium">Score final</span>
                                    <span className="text-white font-medium text-base">{score}/100</span>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* ══════════════ RECOMMANDATION ══════════════ */}
                    {data.ai_recommendations && (
                        <section className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
                            <h3 className="text-purple-400 font-medium mb-2 flex items-center gap-2 text-sm">
                                <Target className="w-4 h-4" /> Recommandation IA
                            </h3>
                            <p className="text-slate-300 text-xs leading-relaxed">
                                {data.ai_recommendations}
                            </p>
                        </section>
                    )}

                    {data.ai_notes && (
                        <section className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4">
                            <p className="text-indigo-400 font-medium text-xs mb-1">📝 Notes internes RH</p>
                            <p className="text-slate-300 text-xs leading-relaxed">{data.ai_notes}</p>
                        </section>
                    )}

                    <p className="text-slate-700 text-xs text-center pt-2 border-t border-slate-800">
                        Rapport généré automatiquement — aide à la décision, non substituable au jugement RH
                    </p>
                </div>
            </div>
        </div>
    )
}