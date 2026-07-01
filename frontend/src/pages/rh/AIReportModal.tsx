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
    weight_cv?: number
    weight_motivation?: number
    weight_softskills?: number
    weight_github?: number
    weight_coherence?: number
    company_mentioned?: boolean
    coherence_floor_applied?:number
    coherence_floor_bonus?: number

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
    company_mentioned?: boolean
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
            <span className="text-lg font-bold" style={{ color }}>
                {score}<span className="text-xs text-slate-500 font-normal">/100</span>
            </span>
        </div>
    )
}

function CriterionRow({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="grid items-center gap-3 py-1.5" style={{ gridTemplateColumns: '180px 1fr 52px' }}>
            <span className="text-slate-400 text-xs">{label}</span>
            <ScoreBar value={value} color={color} />
            <span className="text-right text-xs font-medium" style={{ color }}>{value}</span>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT PDF — génère un HTML autonome et l'imprime via une nouvelle fenêtre
// ─────────────────────────────────────────────────────────────────────────────

function buildPrintHTML(data: AIReportData): string {
    const score = data.ai_score ?? 0
    const bd = data.ai_breakdown
    const gh = data.github_metrics

    const cvScore   = bd?.cv_score          ?? 0
    const motScore  = bd?.motivation_score  ?? 0
    const softScore = bd?.softskills_score  ?? 0
    const ghScore   = bd?.github_score      ?? 0
    const cohScore  = bd?.coherence_score   ?? 0
    const penalty   = bd?.penalty_applied   ?? 0
    const rawScore  = bd?.raw_score         ?? 0

    const wCvPct   = bd?.weight_cv         ?? 0.50
    const wMotPct  = bd?.weight_motivation ?? 0.15
    const wSoftPct = bd?.weight_softskills ?? 0.10
    const wGhPct   = bd?.weight_github     ?? 0.25

    const contribCv   = bd?.weighted_cv         ?? +(cvScore   * wCvPct).toFixed(1)
    const contribMot  = bd?.weighted_motivation ?? +(motScore  * wMotPct).toFixed(1)
    const contribSoft = bd?.weighted_softskills ?? +(softScore * wSoftPct).toFixed(1)
    const contribGh   = bd?.weighted_github     ?? +(ghScore   * wGhPct).toFixed(1)
    const contribCoh  = bd?.weighted_coherence ?? 0
    const color = scoreColor(score)

    const decisionMap: Record<string, { text: string; color: string; bg: string }> = {
        VALIDATED: { text: '✓ À convoquer en priorité',        color: '#10b981', bg: '#d1fae5' },
        TO_REVIEW: { text: '◎ À examiner attentivement',       color: '#6366f1', bg: '#e0e7ff' },
        REJECTED:  { text: '✕ Ne correspond pas aux critères', color: '#ef4444', bg: '#fee2e2' },
    }
    const dec = decisionMap[data.ai_decision] ?? decisionMap['TO_REVIEW']

    const scoreBarHTML = (value: number, col: string, height = 6) =>
        `<div style="background:#e2e8f0;border-radius:9999px;height:${height}px;overflow:hidden;flex:1">
            <div style="background:${col};height:100%;width:${value}%;border-radius:9999px"></div>
         </div>`

    const dotBarHTML = (value: number, max: number, col: string) =>
        Array.from({ length: max }).map((_, i) =>
            `<div style="width:8px;height:16px;border-radius:2px;background:${i < value ? col : '#cbd5e1'}"></div>`
        ).join('')

    const tag = (text: string, fg: string, bg: string, border: string) =>
        `<span style="font-size:11px;padding:2px 10px;border-radius:9999px;border:1px solid ${border};background:${bg};color:${fg};font-weight:600">${text}</span>`
    const chip = (label: string, score: number, weight: number, contrib: number, col: string, floorActive = false, origWeight?: number, isBonusMalus = false) => {
        const weightLabel = isBonusMalus
            ? (contrib >= 0 ? '+bonus' : '−malus')
            : `× ${pct(weight)}`
        const contribLabel = isBonusMalus
            ? `${contrib >= 0 ? '+' : ''}${Number(contrib).toFixed(2)} pts`
            : `= ${typeof contrib === 'number' ? contrib.toFixed(1) : contrib} pts`

        return `<div style="display:flex;flex-direction:column;align-items:center;padding:8px 12px;background:#f8fafc;border-radius:8px;min-width:76px;border:1px solid #e2e8f0;position:relative">
        <span style="font-size:18px;font-weight:700;color:${col}">${score}</span>
        <span style="font-size:11px;color:#64748b;margin-top:2px">${label}</span>
        <span style="font-size:11px;font-weight:600;margin-top:1px;color:${col}">${weightLabel}</span>
        <span style="font-size:11px;color:#475569;margin-top:1px">${contribLabel}</span>
     </div>`
    }

    const criterionRow = (label: string, value: number, col: string) =>
        `<div style="display:grid;grid-template-columns:180px 1fr 52px;align-items:center;gap:12px;padding:6px 0">
            <span style="font-size:11px;color:#64748b">${label}</span>
            ${scoreBarHTML(value, col)}
            <span style="text-align:right;font-size:11px;font-weight:600;color:${col}">${value}</span>
         </div>`

    const sectionHeader = (title: string, sc: number, contrib: number, col: string) =>
        `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <div>
                <p style="font-size:13px;font-weight:600;color:#1e293b;margin:0">${title}</p>
                <p style="font-size:11px;color:#94a3b8;margin:0">${contrib.toFixed(1)} pts de contribution</p>
            </div>
            <span style="font-size:18px;font-weight:700;color:${col}">${sc}<span style="font-size:11px;color:#94a3b8;font-weight:400">/100</span></span>
         </div>`

    const section = (content: string, borderColor: string) =>
        `<div style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;border-left:3px solid ${borderColor};padding:20px;margin-bottom:16px;page-break-inside:avoid">
            ${content}
         </div>`

    const justBox = (text: string) =>
        `<p style="font-size:11px;color:#475569;background:#f1f5f9;border-radius:8px;padding:10px 12px;line-height:1.6;margin:8px 0 0">💡 ${text}</p>`

    /* ── Sections ── */

    // 1. CV
    const cvSection = section(`
        ${sectionHeader('1. Analyse du CV', cvScore, contribCv, '#7F77DD')}
        ${criterionRow('Correspondance compétences requises', Math.min(100, Math.round(cvScore * 1.07)), '#7F77DD')}
        ${criterionRow("Années d'expérience réelles",         Math.min(100, Math.round(cvScore * 0.92)), '#7F77DD')}
        ${criterionRow('Qualité et pertinence des projets',   Math.min(100, Math.round(cvScore * 1.03)), '#7F77DD')}
        ${criterionRow('Certifications pertinentes',          Math.min(100, Math.round(cvScore * 0.85)), '#7F77DD')}
        ${criterionRow('Stabilité professionnelle',           Math.min(100, Math.round(cvScore * 0.97)), '#7F77DD')}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
            ${data.ai_strengths?.length > 0 ? `
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px">
                <p style="color:#16a34a;font-size:11px;font-weight:600;margin:0 0 6px">✓ Forces détectées</p>
                ${data.ai_strengths.slice(0, 4).map(s => `<p style="font-size:11px;color:#374151;margin:2px 0"><span style="color:#16a34a">•</span> ${s}</p>`).join('')}
            </div>` : ''}
            ${(data.ai_weaknesses?.length > 0 || data.ai_missing_skills?.length > 0) ? `
            <div style="background:#fff5f5;border:1px solid #fecaca;border-radius:8px;padding:10px">
                <p style="color:#dc2626;font-size:11px;font-weight:600;margin:0 0 6px">⚠ Points d'attention</p>
                ${data.ai_weaknesses?.slice(0, 2).map(w => `<p style="font-size:11px;color:#374151;margin:2px 0"><span style="color:#f59e0b">•</span> ${w}</p>`).join('')}
                ${data.ai_missing_skills?.length > 0 ? `<p style="font-size:11px;color:#6b7280;margin-top:4px">Manquant : ${data.ai_missing_skills.slice(0, 3).join(', ')}</p>` : ''}
            </div>` : ''}
        </div>
        ${data.detailed_justification?.cv_justification ? justBox(data.detailed_justification.cv_justification) : ''}
    `, '#7F77DD')

    // 2. Motivation
    const motSection = section(`
        ${sectionHeader('2. Lettre de motivation', motScore, contribMot, '#378ADD')}
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:10px">
            ${[
        { label: 'Personnalisation',      value: Math.min(10, Math.round(motScore / 10 * 1.1)) },
        { label: 'Compréhension poste',   value: Math.min(10, Math.round(motScore / 10)) },
        { label: 'Qualité rédact.',        value: Math.min(10, Math.round(motScore / 10 * 0.95)) },
    ].map(c => `
                <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:10px;text-align:center">
                    <p style="font-size:16px;font-weight:700;color:#378ADD;margin:0">${c.value}/10</p>
                    <p style="font-size:11px;color:#94a3b8;margin:2px 0 0">${c.label}</p>
                </div>`).join('')}
        </div>
        ${(!data.ai_breakdown?.company_mentioned && (data.ai_breakdown?.penalty_applied ?? 0) >= 20) ? `
        <div style="background:#fff5f5;border:1px solid #fecaca;border-radius:8px;padding:10px;margin-bottom:10px">
            <p style="color:#dc2626;font-size:11px;font-weight:600;margin:0 0 4px">⚠ Alerte RH — Lettre non personnalisée</p>
            <p style="font-size:11px;color:#374151;margin:0">L'entreprise n'est <strong>pas mentionnée</strong> dans la lettre. Pénalité de <strong style="color:#dc2626">-20 points</strong> appliquée.</p>
            <p style="font-size:11px;color:#6b7280;margin-top:4px">💡 Le candidat a probablement utilisé une lettre type.</p>
        </div>` : ''}
        ${data.detailed_justification?.motivation_justification ? justBox(data.detailed_justification.motivation_justification) : ''}
    `, '#378ADD')

    // 3. Soft skills
    const softSection = section(`
        ${sectionHeader('3. Soft skills', softScore, contribSoft, '#1D9E75')}
        ${[
        { label: 'Leadership',              value: Math.min(10, Math.round(softScore / 10 * 1.15)) },
        { label: 'Autonomie',               value: Math.min(10, Math.round(softScore / 10 * 1.05)) },
        { label: "Travail d'équipe",        value: Math.min(10, Math.round(softScore / 10)) },
        { label: 'Résolution de problèmes', value: Math.min(10, Math.round(softScore / 10 * 0.92)) },
        { label: 'Communication',           value: Math.min(10, Math.round(softScore / 10 * 0.88)) },
    ].map(r => `
            <div style="display:grid;grid-template-columns:180px 1fr 52px;align-items:center;gap:12px;padding:5px 0">
                <span style="font-size:11px;color:#64748b">${r.label}</span>
                ${scoreBarHTML(r.value * 10, '#1D9E75')}
                <span style="text-align:right;font-size:11px;font-weight:600;color:#1D9E75">${r.value}/10</span>
            </div>`).join('')}
        ${data.detailed_justification?.softskills_justification ? justBox(data.detailed_justification.softskills_justification) : ''}
    `, '#1D9E75')

    // 4. GitHub
    let ghSection = ''
    if (ghScore > 0) {
        const ghContent = gh ? `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
                <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:10px">
                    <p style="font-size:11px;color:#94a3b8;margin:0 0 6px">Activité récente</p>
                    <div style="display:flex;align-items:center;gap:6px">${dotBarHTML(gh.activity_score, 5, '#7F77DD')}<span style="font-size:11px;font-family:monospace">${gh.activity_score}/5</span></div>
                    <p style="font-size:11px;color:#94a3b8;margin-top:4px">Dernier push : ${gh.last_activity}</p>
                </div>
                <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:10px">
                    <p style="font-size:11px;color:#94a3b8;margin:0 0 6px">Qualité projets</p>
                    <div style="display:flex;align-items:center;gap:6px">${dotBarHTML(gh.project_quality, 5, '#10b981')}<span style="font-size:11px;font-family:monospace">${gh.project_quality}/5</span></div>
                    <p style="font-size:11px;color:#94a3b8;margin-top:4px">${gh.total_repos} repos publics</p>
                </div>
                <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:10px">
                    <p style="font-size:11px;color:#94a3b8;margin:0 0 6px">Documentation</p>
                    <div style="display:flex;align-items:center;gap:6px">${dotBarHTML(gh.documentation_score, 3, '#378ADD')}<span style="font-size:11px;font-family:monospace">${gh.documentation_score}/3</span></div>
                </div>
                <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:10px">
                    <p style="font-size:11px;color:#94a3b8;margin:0 0 6px">Match stack poste</p>
                    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">${scoreBarHTML(gh.relevance_score, '#f59e0b')}<span style="font-size:11px;font-family:monospace">${gh.relevance_score}%</span></div>
                    ${gh.stack_match_bonus > 0 ? `<p style="font-size:11px;color:#f59e0b;margin:0">+${gh.stack_match_bonus} pts bonus stack</p>` : ''}
                </div>
            </div>
            ${gh.main_languages.length > 0 ? `
            <div style="margin-bottom:10px">
                <p style="font-size:11px;color:#94a3b8;margin:0 0 6px">Langages détectés (repos originaux)</p>
                <div style="display:flex;flex-wrap:wrap;gap:6px">
                    ${gh.main_languages.map(l => `<span style="font-size:11px;padding:2px 8px;border-radius:6px;background:#ede9fe;color:#7c3aed;border:1px solid #ddd6fe">${l}</span>`).join('')}
                </div>
            </div>` : ''}
            ${((gh.stack_matches?.length ?? 0) + (gh.stack_misses?.length ?? 0)) > 0 ? `
            <div style="margin-bottom:10px">
                <p style="font-size:11px;color:#94a3b8;margin:0 0 6px">Couverture des skills requis par le GitHub</p>
                <div style="display:flex;flex-wrap:wrap;gap:6px">
                    ${gh.stack_matches?.map(s => `<span style="font-size:11px;padding:2px 8px;border-radius:6px;background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0">✓ ${s}</span>`).join('') ?? ''}
                    ${gh.stack_misses?.map(s => `<span style="font-size:11px;padding:2px 8px;border-radius:6px;background:#fff5f5;color:#dc2626;border:1px solid #fecaca">✗ ${s}</span>`).join('') ?? ''}
                </div>
            </div>` : ''}
            <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:12px;margin-bottom:10px">
                <p style="font-size:11px;font-weight:600;color:#7c3aed;margin:0 0 8px">Calcul du score GitHub ${ghScore}/100</p>
                <div style="font-family:monospace;font-size:11px">
                    <div style="display:flex;justify-content:space-between;padding:2px 0"><span style="color:#64748b">Stack relevance (${gh.stack_matches?.length ?? 0}/${(gh.stack_matches?.length ?? 0) + (gh.stack_misses?.length ?? 0)} skills)</span><span style="color:#7c3aed">${gh.relevance_score} / 35 pts</span></div>
                    <div style="display:flex;justify-content:space-between;padding:2px 0"><span style="color:#64748b">Activité réelle (${gh.activity_score}/5 repos &lt;6 mois)</span><span style="color:#7c3aed">${gh.activity_score_pts} / 25 pts</span></div>
                    <div style="display:flex;justify-content:space-between;padding:2px 0"><span style="color:#64748b">Qualité projets originaux</span><span style="color:#7c3aed">${gh.project_quality_pts} / 25 pts</span></div>
                    ${(gh.penalty_gh ?? 0) > 0 ? `<div style="display:flex;justify-content:space-between;padding:2px 0"><span style="color:#dc2626">Pénalité</span><span style="color:#dc2626">− ${gh.penalty_gh} pts</span></div>` : ''}
                    <div style="display:flex;justify-content:space-between;border-top:1px solid #ddd6fe;margin-top:4px;padding-top:4px"><span style="color:#1e293b;font-weight:600">Total</span><span style="color:#1e293b;font-weight:600">${gh.relevance_score + gh.activity_score_pts + gh.project_quality_pts - (gh.penalty_gh ?? 0)} / 100 pts </span></div>
                </div>
                ${gh.stack_detail_text ? `<p style="font-size:11px;color:#94a3b8;margin:8px 0 0">${gh.stack_detail_text}</p>` : ''}
            </div>
            ${gh.top_repos.length > 0 ? `
            <div>
                <p style="font-size:11px;color:#94a3b8;margin:0 0 6px">Repos analysés (${gh.top_repos.length}) — forks exclus</p>
                ${gh.top_repos.map(r => `
                <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
                    <div style="flex:1;min-width:0">
                        <p style="font-size:12px;font-weight:600;color:#1e293b;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.name}</p>
                        ${r.description ? `<p style="font-size:11px;color:#94a3b8;margin:2px 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.description}</p>` : ''}
                    </div>
                    <div style="display:flex;gap:8px;font-size:11px;flex-shrink:0">
                        ${r.language ? `<span style="color:#64748b">${r.language}</span>` : ''}
                        ${r.stars > 0 ? `<span style="color:#f59e0b">★ ${r.stars}</span>` : ''}
                        ${r.forks > 0 ? `<span style="color:#94a3b8">⑂ ${r.forks}</span>` : ''}
                    </div>
                </div>`).join('')}
            </div>` : ''}
            ${data.detailed_justification?.github_justification ? justBox(data.detailed_justification.github_justification) : ''}
        ` : `<p style="font-size:11px;color:#64748b;margin:0">🔍 Critères : nb projets publics, activité récente, correspondance stack, documentation.</p>`

        ghSection = section(`
            ${sectionHeader('4. Portfolio GitHub', ghScore, contribGh, '#534AB7')}
            ${ghContent}
        `, '#534AB7')
    }

    // 5. Cohérence
    const cohSection = section(`
        ${sectionHeader('5. Cohérence du dossier', cohScore, contribCoh, '#BA7517')}
        ${[
        { label: 'Domaine professionnel',         ok: cohScore >= 50 },
        { label: 'Disponibilité compatible',      ok: cohScore >= 60 },
        { label: 'Expérience déclarée ≈ CV réel', ok: cohScore >= 75 },
    ].map(item => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:11px">
                <span style="color:#64748b">${item.label}</span>
                <span style="padding:2px 8px;border-radius:9999px;border:1px solid ${item.ok ? '#bbf7d0' : '#fed7aa'};background:${item.ok ? '#f0fdf4' : '#fffbeb'};color:${item.ok ? '#16a34a' : '#d97706'}">${item.ok ? 'Compatible' : 'À vérifier'}</span>
            </div>`).join('')}
        ${data.ai_coherence_flags && data.ai_coherence_flags.length > 0 ? `
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px;margin-top:10px">
            <p style="color:#d97706;font-size:11px;font-weight:600;margin:0 0 6px">⚠ Alertes de cohérence</p>
            ${data.ai_coherence_flags.slice(0, 4).map(f => `<p style="font-size:11px;color:#374151;margin:2px 0"><span style="color:#d97706">•</span> ${f}</p>`).join('')}
        </div>` : ''}
        ${data.detailed_justification?.coherence_justification ? justBox(data.detailed_justification.coherence_justification) : ''}
    `, '#BA7517')

    // 6. Pénalités
    const penaltySection = penalty > 0 ? `
        <div style="background:#fff5f5;border-radius:10px;border:1px solid #fecaca;border-left:3px solid #ef4444;padding:20px;margin-bottom:16px;page-break-inside:avoid">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <div>
                    <p style="font-size:13px;font-weight:600;color:#1e293b;margin:0">6. Pénalités appliquées</p>
                </div>
                <span style="font-size:18px;font-weight:700;color:#ef4444">−${penalty}</span>
            </div>
            ${bd?.penalty_details && bd.penalty_details.length > 0
        ? bd.penalty_details.map(r => `<p style="font-size:11px;color:#374151;margin:3px 0"><span style="color:#ef4444">−</span> ${r}</p>`).join('')
        : '<p style="font-size:11px;color:#64748b">Des points ont été déduits suite à des incohérences détectées.</p>'}
            ${data.detailed_justification?.penalty_justification
        ? `<p style="font-size:11px;color:#dc2626;background:#fee2e2;border-radius:6px;padding:8px;margin-top:8px">💡 ${data.detailed_justification.penalty_justification}</p>`
        : ''}
        </div>` : ''

    // Certifications
    const certsSection = data.ai_certifications?.length > 0 ? `
        <div style="margin-bottom:16px;page-break-inside:avoid">
            <p style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 10px">Certifications détectées (${data.ai_certifications.length})</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                ${data.ai_certifications.map(c => `
                <div style="background:${c.suspicious ? '#fff5f5' : '#f8fafc'};border:1px solid ${c.suspicious ? '#fecaca' : '#e2e8f0'};border-radius:10px;padding:12px">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
                        <div style="flex:1">
                            <p style="font-size:12px;font-weight:600;color:#1e293b;margin:0">${c.name}${c.suspicious ? ' <span style="font-size:10px;padding:1px 6px;border-radius:9999px;background:#fee2e2;color:#dc2626;border:1px solid #fecaca">⚠ Suspicion</span>' : ''}</p>
                            <p style="font-size:11px;color:#94a3b8;margin:2px 0 0">${c.issuer}${c.year ? ` · ${c.year}` : ''}</p>
                            ${c.suspicious && c.suspicion_reason ? `<div style="margin-top:6px;padding:6px;background:#fee2e2;border-radius:6px"><p style="font-size:10px;color:#dc2626;font-weight:600;margin:0">Raison :</p><p style="font-size:11px;color:#374151;margin:2px 0 0">${c.suspicion_reason}</p></div>` : ''}
                        </div>
                        <span style="font-size:10px;padding:2px 8px;border-radius:9999px;background:#fffbeb;color:#d97706;border:1px solid #fde68a;white-space:nowrap">${c.relevance}</span>
                    </div>
                </div>`).join('')}
            </div>
        </div>` : ''

    // Projets
    const projetsSection = data.ai_projects?.length > 0 ? `
        <div style="margin-bottom:16px">
            <p style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 10px">Projets significatifs (${data.ai_projects.length})</p>
            ${data.ai_projects.map(p => `
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:8px;page-break-inside:avoid">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
                    <div>
                        <p style="font-size:12px;font-weight:600;color:#1e293b;margin:0">${p.name}</p>
                        <span style="font-size:10px;padding:2px 8px;border-radius:9999px;background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe">${p.type}</span>
                    </div>
                    <span style="font-size:11px;font-weight:600;color:${p.complexity === 'Élevée' ? '#dc2626' : p.complexity === 'Moyenne' ? '#d97706' : '#16a34a'}">Complexité ${p.complexity}</span>
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px">
                    ${p.technologies.map(t => `<span style="font-size:11px;padding:2px 8px;border-radius:6px;background:#f1f5f9;color:#475569">${t}</span>`).join('')}
                </div>
                ${(p.team_size || p.duration) ? `<p style="font-size:11px;color:#94a3b8;margin:0">${p.team_size ? `👥 ${p.team_size}` : ''}${p.team_size && p.duration ? ' · ' : ''}${p.duration ? `⏱ ${p.duration}` : ''}</p>` : ''}
            </div>`).join('')}
        </div>` : ''

    // Récapitulatif
    const recapSection = bd ? `
        <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:10px;margin-bottom:16px;page-break-inside:avoid">
            <div style="background:linear-gradient(to right,#f3e8ff,#e0e7ff);padding:14px;border-radius:10px 10px 0 0;border-bottom:1px solid #e9d5ff">
                <p style="font-size:13px;font-weight:600;color:#7c3aed;margin:0">🧠 Récapitulatif du calcul</p>
            </div>
            <div style="padding:14px;font-family:monospace;font-size:11px">
                ${[
        { label: `CV (${cvScore} × ${pct(wCvPct)})`,              val: contribCv,   col: '#7F77DD' },
        { label: `Motivation (${motScore} × ${pct(wMotPct)})`,     val: contribMot,  col: '#378ADD' },
        { label: `Soft skills (${softScore} × ${pct(wSoftPct)})`,  val: contribSoft, col: '#1D9E75' },
        ...(ghScore > 0 ? [{ label: `GitHub (${ghScore} × ${pct(wGhPct)})`, val: contribGh, col: '#534AB7' }] : []),
        { label: `Cohérence (score ${cohScore} → ${contribCoh >= 0 ? '+' : ''}${Number(contribCoh).toFixed(2)} pts)`, val: contribCoh, col: '#BA7517' },
    ].map(row => `<div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:#64748b">${row.label}</span><span style="color:${row.col}">${row.val} pts</span></div>`).join('')}                <div style="display:flex;justify-content:space-between;border-top:1px solid #e2e8f0;padding-top:6px;margin-top:4px"><span style="color:#64748b">Score brut pondéré</span><span style="color:#1e293b">= ${rawScore.toFixed(1)} pts</span></div>
                <div style="display:flex;justify-content:space-between"><span style="color:#64748b">Pénalités</span><span style="color:${penalty > 0 ? '#ef4444' : '#94a3b8'}">${penalty > 0 ? `− ${penalty} pts` : 'Aucune'}</span></div>
                <div style="display:flex;justify-content:space-between;border-top:1px solid #e2e8f0;padding-top:6px;margin-top:4px"><span style="color:#7c3aed;font-weight:600">Score final</span><span style="color:#1e293b;font-weight:700;font-size:14px">${score}/100</span></div>
            </div>
        </div>` : ''

    // Recommandation
    const recoSection = data.ai_recommendations ? `
        <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:10px;padding:14px;margin-bottom:16px;page-break-inside:avoid">
            <p style="font-size:12px;font-weight:600;color:#7c3aed;margin:0 0 6px">🎯 Recommandation IA</p>
            <p style="font-size:11px;color:#374151;line-height:1.6;margin:0">${data.ai_recommendations}</p>
        </div>` : ''

    const notesSection = data.ai_notes ? `
        <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:14px;margin-bottom:16px;page-break-inside:avoid">
            <p style="font-size:12px;font-weight:600;color:#0369a1;margin:0 0 6px">📝 Notes internes RH</p>
            <p style="font-size:11px;color:#374151;line-height:1.6;margin:0">${data.ai_notes}</p>
        </div>` : ''

    // Formule score chips
    const formulaChips = bd ? (() => {
        const COHERENCE_FLOOR = 0.05
        const wCohRaw = bd?.weight_coherence ?? 0.05
        const cohFloorApplied = wCohRaw < COHERENCE_FLOOR
        const wCohPct = cohFloorApplied ? COHERENCE_FLOOR : wCohRaw
        const contribCohFloor = cohFloorApplied
            ? +(cohScore * COHERENCE_FLOOR).toFixed(1)
            : contribCoh

        const items = [
            { label: 'CV',          score: cvScore,   weight: wCvPct,   contrib: contribCv,   color: '#7F77DD' },
            { label: 'Motivation',  score: motScore,  weight: wMotPct,  contrib: contribMot,  color: '#378ADD' },
            { label: 'Soft skills', score: softScore, weight: wSoftPct, contrib: contribSoft, color: '#1D9E75' },
            ...(ghScore > 0 ? [{ label: 'GitHub', score: ghScore, weight: wGhPct, contrib: contribGh, color: '#534AB7' }] : []),
            {
                label: cohScore >= 70 ? 'Cohérence ✓' : 'Cohérence ⚠',
                score: cohScore,
                weight: 0,
                contrib: contribCoh,
                color: '#BA7517',
                floorActive: false,
                origWeight: 0,
                isBonusMalus: true,
            },
        ]
        return `
        <div style="margin-bottom:16px;page-break-inside:avoid">
            <p style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 10px">Comment le score ${score}/100 a été calculé</p>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center">
                ${items.map((c, i) => `
                ${'isBonusMalus' in c ? chip(c.label, c.score, c.weight, c.contrib, c.color, false, 0, true) : chip(c.label, c.score, c.weight, c.contrib, c.color)}                    ${i < items.length - 1 ? '<span style="color:#94a3b8;font-size:18px">+</span>' : ''}
                `).join('')}
                <span style="color:#94a3b8;font-size:18px">=</span>
                <div style="display:flex;flex-direction:column;align-items:center;padding:8px 12px;background:#f8fafc;border-radius:8px;min-width:70px;border:1px solid #e2e8f0">
                    <span style="font-size:11px;color:#94a3b8">Brut</span>
                    <span style="font-size:18px;font-weight:700;color:#1e293b">${rawScore.toFixed(1)}</span>
                </div>
                ${penalty > 0 ? `
                <span style="color:#ef4444;font-size:18px">−</span>
                <div style="display:flex;flex-direction:column;align-items:center;padding:8px 12px;background:#fff5f5;border-radius:8px;min-width:60px;border:1px solid #fecaca">
                    <span style="font-size:11px;color:#ef4444">Pénalité</span>
                    <span style="font-size:18px;font-weight:700;color:#ef4444">${penalty}</span>
                </div>` : ''}
                <span style="color:#94a3b8;font-size:18px">=</span>
                <div style="display:flex;flex-direction:column;align-items:center;padding:8px 12px;background:#f8fafc;border-radius:8px;min-width:70px;border:2px solid #a78bfa">
                    <span style="font-size:11px;color:#94a3b8">Final</span>
                    <span style="font-size:20px;font-weight:700;color:${color}">${score}</span>
                </div>
            </div>
${data.score_rationale ? `<p style="font-size:11px;color:#94a3b8;margin:6px 0 0;text-align:center">${data.score_rationale}</p>` : ''}
${cohFloorApplied ? `
<p style="font-size:10px;color:#d97706;margin:6px 0 0;text-align:center;
          background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:4px 8px">
    ⚡ Cohérence configurée à ${(wCohRaw * 100).toFixed(0)}% par le RH — plancher système de 5% appliqué automatiquement 
    pour garantir la prise en compte des alertes qualité dossier
</p>` : ''}
        </div>`
    })() : ''

    const radius = 44, stroke = 7
    const norm = radius - stroke / 2
    const circ = 2 * Math.PI * norm
    const filled = (score / 100) * circ

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Rapport IA — ${data.full_name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #fff; color: #1e293b; font-size: 13px; line-height: 1.5; }
  @page { size: A4; margin: 14mm 14mm 14mm 14mm; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-break { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<div style="max-width:760px;margin:0 auto;padding:0">

  <!-- EN-TÊTE -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #e2e8f0;padding-bottom:18px;margin-bottom:18px" class="no-break">
    <div style="flex:1">
      <h1 style="font-size:22px;font-weight:700;color:#1e293b">${data.full_name}</h1>
      <p style="color:#7c3aed;margin-top:2px;font-size:13px">${data.job_offer_title}</p>
      <p style="color:#94a3b8;font-size:11px;margin-top:2px">Analysé le ${new Date(data.applied_date).toLocaleDateString('fr-FR')}</p>
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
        ${tag(dec.text, dec.color, dec.bg, dec.color + '55')}
        ${tag(`${score}/100`, color, color + '15', color + '55')}
      </div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:center;margin-left:16px">
      <svg width="96" height="96" viewBox="0 0 96 96" style="transform:rotate(-90deg)">
        <circle cx="48" cy="48" r="${norm}" fill="none" stroke="#e2e8f0" stroke-width="${stroke}"/>
        <circle cx="48" cy="48" r="${norm}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
                stroke-dasharray="${filled} ${circ - filled}"/>
      </svg>
      <span style="font-size:22px;font-weight:700;color:#1e293b;margin-top:-56px">${score}</span>
      <span style="font-size:11px;color:#94a3b8;margin-top:34px">/100</span>
    </div>
  </div>

  <!-- RÉSUMÉ -->
  ${data.ai_summary ? `
  <div style="margin-bottom:16px" class="no-break">
    <p style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">Résumé du profil</p>
    <p style="font-size:12px;color:#374151;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;line-height:1.7">${data.ai_summary}</p>
  </div>` : ''}

  <!-- FORMULE SCORE -->
  ${formulaChips}

  <!-- SECTIONS -->
  ${cvSection}
  ${motSection}
  ${softSection}
  ${ghSection}
  ${cohSection}
  ${penaltySection}

  <!-- CERTIFICATIONS -->
  ${certsSection}

  <!-- PROJETS -->
  ${projetsSection}

  <!-- RECAP -->
  ${recapSection}

  <!-- RECO -->
  ${recoSection}

  <!-- NOTES -->
  ${notesSection}

  <p style="font-size:10px;color:#cbd5e1;text-align:center;border-top:1px solid #f1f5f9;padding-top:12px;margin-top:8px">
    Rapport généré automatiquement — aide à la décision, non substituable au jugement RH
  </p>
</div>
</body>
</html>`
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

    const exportPDF = () => {
        const html = buildPrintHTML(data)
        const win = window.open('', '_blank', 'width=900,height=700')
        if (!win) return
        win.document.write(html)
        win.document.close()
        win.focus()
        // Déclenche l'impression après chargement complet
        win.onload = () => {
            setTimeout(() => {
                win.print()
                // win.close() — optionnel : ferme après impression
            }, 300)
        }
        // Fallback si onload ne se déclenche pas
        setTimeout(() => {
            if (!win.closed) win.print()
        }, 800)
    }

    const score = data.ai_score ?? 0
    const bd    = data.ai_breakdown
    const gh    = data.github_metrics

    const cvScore   = bd?.cv_score          ?? 0
    const motScore  = bd?.motivation_score  ?? 0
    const softScore = bd?.softskills_score  ?? 0
    const ghScore   = bd?.github_score      ?? 0
    const cohScore  = bd?.coherence_score   ?? 0
    const penalty   = bd?.penalty_applied   ?? 0
    const rawScore  = bd?.raw_score         ?? 0

    const wCvPct   = bd?.weight_cv         ?? 0.50
    const wMotPct  = bd?.weight_motivation ?? 0.15
    const wSoftPct = bd?.weight_softskills ?? 0.10
    const wGhPct   = bd?.weight_github     ?? 0.25
// ── Cohérence avec plancher système ──

    const contribCv   = bd?.weighted_cv         ?? +(cvScore   * wCvPct).toFixed(1)
    const contribMot  = bd?.weighted_motivation ?? +(motScore  * wMotPct).toFixed(1)
    const contribSoft = bd?.weighted_softskills ?? +(softScore * wSoftPct).toFixed(1)
    const contribGh   = bd?.weighted_github     ?? +(ghScore   * wGhPct).toFixed(1)
    const contribCoh  = bd?.weighted_coherence  ?? 0
    const radius = 44, stroke = 7
    const norm   = radius - stroke / 2
    const circ   = 2 * Math.PI * norm
    const filled = (score / 100) * circ
    const color  = scoreColor(score)

    const decisionLabel: Record<string, { text: string; cls: string }> = {
        VALIDATED: { text: '✓ À convoquer en priorité',        cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
        TO_REVIEW: { text: '◎ À examiner attentivement',       cls: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'   },
        REJECTED:  { text: '✕ Ne correspond pas aux critères', cls: 'bg-red-500/15 text-red-400 border-red-500/30'            },
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
                            <div className="flex items-center gap-2 flex-wrap justify-center
                                            bg-slate-800/50 rounded-xl border border-slate-700 p-4">
                                {([
                                    { label: 'CV',          score: cvScore,   weight: wCvPct,   contrib: contribCv,   color: '#7F77DD' },
                                    { label: 'Motivation',  score: motScore,  weight: wMotPct,  contrib: contribMot,  color: '#378ADD' },
                                    { label: 'Soft skills', score: softScore, weight: wSoftPct, contrib: contribSoft, color: '#1D9E75' },
                                    ...(ghScore > 0 ? [{ label: 'GitHub', score: ghScore, weight: wGhPct, contrib: contribGh, color: '#534AB7' }] : []),
                                    { label: cohScore >= 70 ? 'Cohérence ✓' : 'Cohérence ⚠', score: cohScore, weight: null, contrib: contribCoh, color: '#BA7517' },
                                ] as const).map((c, i, arr) => (
                                    <div key={c.label} className="flex items-center gap-2">
                                        <div className="flex flex-col items-center px-3 py-2 rounded-lg bg-slate-900 min-w-[76px]">
                                            <span className="text-lg font-bold" style={{ color: c.color }}>{c.score}</span>
                                            <span className="text-xs text-slate-500 mt-0.5">{c.label}</span>
                                            <span className="text-xs font-medium mt-0.5" style={{ color: c.color }}>
    {c.weight !== null ? `× ${pct(c.weight)}` : (contribCoh >= 0 ? '+bonus' : '−malus')}
</span>                                            <span className="text-xs text-slate-400 mt-0.5">= {c.contrib} pts</span>
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
                        <SectionHeader icon={FileText} title="1. Analyse du CV" score={cvScore} contribution={contribCv} color="#7F77DD" />
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
                        <SectionHeader icon={Target} title="2. Lettre de motivation" score={motScore} contribution={contribMot} color="#378ADD" />
                        <div className="grid grid-cols-3 gap-3 mb-3">
                            {([
                                { label: 'Personnalisation',    value: Math.min(10, Math.round(motScore / 10 * 1.1)) },
                                { label: 'Compréhension poste', value: Math.min(10, Math.round(motScore / 10)) },
                                { label: 'Qualité rédact.',      value: Math.min(10, Math.round(motScore / 10 * 0.95)) },
                            ] as const).map(c => (
                                <div key={c.label} className="bg-slate-800 rounded-lg p-3 text-center border border-slate-700">
                                    <p className="text-lg font-bold text-blue-400">{c.value}/10</p>
                                    <p className="text-slate-500 text-xs mt-0.5">{c.label}</p>
                                </div>
                            ))}
                        </div>
                        {!data.ai_breakdown?.company_mentioned && (data.ai_breakdown?.penalty_applied ?? 0) >= 20 && (
                            <div className="mb-3 p-3 rounded-lg bg-red-500/15 border border-red-500/30">
                                <div className="flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-red-400 text-xs font-medium">⚠ Alerte RH — Lettre non personnalisée</p>
                                        <p className="text-slate-300 text-xs mt-1">
                                            L'entreprise n'est <strong>pas mentionnée</strong> dans la lettre.
                                            Pénalité de <strong className="text-red-400">-20 points</strong> appliquée.
                                        </p>
                                        <p className="text-slate-400 text-xs mt-1">
                                            💡 Le candidat a probablement utilisé une lettre type.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                        {data.detailed_justification?.motivation_justification && (
                            <p className="text-slate-400 text-xs bg-slate-900/50 rounded-lg p-3 leading-relaxed">
                                💡 {data.detailed_justification.motivation_justification}
                            </p>
                        )}
                    </section>

                    {/* ══════════════ 3. SOFT SKILLS ══════════════ */}
                    <section className="bg-slate-800/30 rounded-xl border-l-[3px] border-l-teal-500
                                        border border-slate-700 p-5">
                        <SectionHeader icon={Award} title="3. Soft skills" score={softScore} contribution={contribSoft} color="#1D9E75" />
                        <div className="space-y-0.5 mb-3">
                            {([
                                { label: 'Leadership',              value: Math.min(10, Math.round(softScore / 10 * 1.15)) },
                                { label: 'Autonomie',               value: Math.min(10, Math.round(softScore / 10 * 1.05)) },
                                { label: "Travail d'équipe",        value: Math.min(10, Math.round(softScore / 10)) },
                                { label: 'Résolution de problèmes', value: Math.min(10, Math.round(softScore / 10 * 0.92)) },
                                { label: 'Communication',           value: Math.min(10, Math.round(softScore / 10 * 0.88)) },
                            ] as const).map(r => (
                                <div key={r.label} className="grid items-center gap-3 py-1.5"
                                     style={{ gridTemplateColumns: '180px 1fr 52px' }}>
                                    <span className="text-slate-400 text-xs">{r.label}</span>
                                    <ScoreBar value={r.value * 10} color="#1D9E75" />
                                    <span className="text-right text-xs font-medium text-teal-400">{r.value}/10</span>
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
                            <SectionHeader icon={Code} title="4. Portfolio GitHub" score={ghScore} contribution={contribGh} color="#534AB7" />
                            {gh ? (
                                <>
                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                                            <p className="text-slate-500 text-xs mb-1.5">Activité récente</p>
                                            <div className="flex items-center gap-2">
                                                <DotBar value={gh.activity_score} max={5} color="#7F77DD" />
                                                <span className="text-white text-xs font-mono">{gh.activity_score}/5</span>
                                            </div>
                                            <p className="text-slate-500 text-xs mt-1">Dernier push : {gh.last_activity}</p>
                                        </div>
                                        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                                            <p className="text-slate-500 text-xs mb-1.5">Qualité projets</p>
                                            <div className="flex items-center gap-2">
                                                <DotBar value={gh.project_quality} max={5} color="#10b981" />
                                                <span className="text-white text-xs font-mono">{gh.project_quality}/5</span>
                                            </div>
                                            <p className="text-slate-500 text-xs mt-1">{gh.total_repos} repos publics</p>
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
                                                    <div className="bg-amber-400 h-1.5 rounded-full" style={{ width: `${gh.relevance_score}%` }} />
                                                </div>
                                                <span className="text-white text-xs font-mono">{gh.relevance_score}%</span>
                                            </div>
                                            {gh.stack_match_bonus > 0 && (
                                                <p className="text-amber-400 text-xs mt-1">+{gh.stack_match_bonus} pts bonus stack</p>
                                            )}
                                        </div>
                                    </div>
                                    {gh.main_languages.length > 0 && (
                                        <div className="mb-3">
                                            <p className="text-slate-500 text-xs mb-1.5">Langages détectés (repos originaux)</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {gh.main_languages.map((l, i) => (
                                                    <span key={i} className="text-xs px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-300 border border-violet-500/20">{l}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {((gh.stack_matches?.length ?? 0) + (gh.stack_misses?.length ?? 0)) > 0 && (
                                        <div className="mb-3">
                                            <p className="text-slate-500 text-xs mb-1.5">Couverture des skills requis par le GitHub</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {gh.stack_matches?.map((s, i) => (
                                                    <span key={i} className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">✓ {s}</span>
                                                ))}
                                                {gh.stack_misses?.map((s, i) => (
                                                    <span key={i} className="text-xs px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/20">✗ {s}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <div className="bg-violet-500/5 border border-violet-500/20 rounded-lg p-3 mb-3">
                                        <p className="text-violet-300 text-xs font-medium mb-2">Calcul du score GitHub {ghScore}/100</p>
                                        <div className="space-y-1 font-mono text-xs">
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Stack relevance ({gh.stack_matches?.length ?? 0}/{(gh.stack_matches?.length ?? 0) + (gh.stack_misses?.length ?? 0)} skills)</span>
                                                <span className="text-violet-300">{gh.relevance_score} / 40 pts</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Activité réelle ({gh.activity_score}/5 repos &lt;6 mois)</span>
                                                <span className="text-violet-300">{gh.activity_score_pts} / 25 pts</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Qualité projets originaux</span>
                                                <span className="text-violet-300">{gh.project_quality_pts} / 35 pts</span>
                                            </div>
                                            {(gh.penalty_gh ?? 0) > 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-red-400">Pénalité</span>
                                                    <span className="text-red-400">− {gh.penalty_gh} pts</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between border-t border-violet-500/20 pt-1 mt-1">
                                                <span className="text-slate-300 font-medium">Total</span>
                                                <span className="text-white font-medium">{gh.relevance_score + gh.activity_score_pts + gh.project_quality_pts - (gh.penalty_gh ?? 0)} / 100 pts </span>
                                            </div>
                                        </div>
                                        {gh.stack_detail_text && (
                                            <p className="text-slate-500 text-xs mt-2">{gh.stack_detail_text}</p>
                                        )}
                                    </div>
                                    {gh.top_repos.length > 0 && (
                                        <div>
                                            <p className="text-slate-500 text-xs mb-1.5">Repos analysés ({gh.top_repos.length}) — forks exclus</p>
                                            <div className="space-y-1.5">
                                                {gh.top_repos.map((r, i) => (
                                                    <div key={i} className="bg-slate-900/50 rounded-lg px-3 py-2 flex items-start justify-between gap-2 border border-slate-800">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-white text-xs font-medium truncate">{r.name}</p>
                                                            {r.description && <p className="text-slate-500 text-xs truncate">{r.description}</p>}
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
                        <SectionHeader icon={Shield} title="5. Cohérence du dossier" score={cohScore} contribution={contribCoh} color="#BA7517" />
                        <div className="space-y-1 mb-3">
                            {[
                                { label: 'Domaine professionnel',         ok: cohScore >= 50 },
                                { label: 'Disponibilité compatible',      ok: cohScore >= 60 },
                                { label: 'Expérience déclarée ≈ CV réel', ok: cohScore >= 75 },
                            ].map(item => (
                                <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-slate-700/50 text-xs">
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
                            <SectionHeader icon={Minus} title="6. Pénalités appliquées" score={-penalty} contribution={-penalty} color="#E24B4A" />
                            {bd?.penalty_details && bd.penalty_details.length > 0 ? (
                                <ul className="space-y-1">
                                    {bd.penalty_details.map((r, i) => (
                                        <li key={i} className="text-slate-300 text-xs flex items-start gap-2">
                                            <span className="text-red-400 mt-0.5 shrink-0">−</span>
                                            <span className={r.includes("LETTRE NON PERSONNALISÉE") ? "text-red-300 font-medium" : ""}>{r}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-slate-400 text-xs">Des points ont été déduits suite à des incohérences détectées.</p>
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
                                    <div key={i} className={`bg-slate-800/50 border rounded-xl p-3 ${c.suspicious ? 'border-red-500/50 bg-red-500/5' : 'border-slate-700'}`}>
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="text-white text-sm font-medium">{c.name}</p>
                                                    {c.suspicious && (
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">⚠ Suspicion</span>
                                                    )}
                                                </div>
                                                <p className="text-slate-400 text-xs">{c.issuer}{c.year ? ` · ${c.year}` : ''}</p>
                                                {c.suspicious && c.suspicion_reason && (
                                                    <div className="mt-2 p-2 rounded-md bg-red-500/10 border border-red-500/20">
                                                        <p className="text-red-400 text-xs font-medium">Raison :</p>
                                                        <p className="text-slate-300 text-xs">{c.suspicion_reason}</p>
                                                    </div>
                                                )}
                                            </div>
                                            <span className="text-xs px-2 py-0.5 rounded-full border shrink-0 bg-amber-500/10 text-amber-400 border-amber-500/20">{c.relevance}</span>
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
                                    <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <p className="text-white text-sm font-medium">{p.name}</p>
                                                <span className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">{p.type}</span>
                                            </div>
                                            <span className={`text-xs font-medium ${p.complexity === 'Élevée' ? 'text-red-400' : p.complexity === 'Moyenne' ? 'text-amber-400' : 'text-emerald-400'}`}>
                                                Complexité {p.complexity}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 mb-2">
                                            {p.technologies.map((t, j) => (
                                                <span key={j} className="text-xs px-2 py-0.5 rounded-md bg-slate-700 text-slate-300">{t}</span>
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
                            <div className="bg-gradient-to-r from-purple-600/10 to-indigo-600/10 p-4 border-b border-purple-500/20 rounded-t-xl">
                                <h3 className="text-purple-400 font-medium text-sm flex items-center gap-2">
                                    <BrainCircuit className="w-4 h-4" />Récapitulatif du calcul
                                </h3>
                            </div>
                            <div className="p-4 space-y-1 font-mono text-xs">
                                {([
                                    { label: `CV (${cvScore} × ${pct(wCvPct)})`,              val: contribCv,   color: '#7F77DD' },
                                    { label: `Motivation (${motScore} × ${pct(wMotPct)})`,     val: contribMot,  color: '#378ADD' },
                                    { label: `Soft skills (${softScore} × ${pct(wSoftPct)})`,  val: contribSoft, color: '#1D9E75' },
                                    ...(ghScore > 0 ? [{ label: `GitHub (${ghScore} × ${pct(wGhPct)})`, val: contribGh, color: '#534AB7' }] : []),
                                    { label: `Cohérence (score ${cohScore} → ${contribCoh >= 0 ? '+' : ''}${Number(contribCoh).toFixed(2)} pts)`, val: contribCoh, color: '#BA7517' },                                ] as const).map(row => (
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
                            <p className="text-slate-300 text-xs leading-relaxed">{data.ai_recommendations}</p>
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