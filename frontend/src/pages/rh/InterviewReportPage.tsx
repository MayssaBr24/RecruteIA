
import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'

// ── Types ─────────────────────────────────────────────────────────────────────
interface ReportData {
    generated_at: string
    interview_token: string
    interview_id: number
    status: string
    candidate: Candidate
    job_offer: JobOffer
    timing: Timing
    scores: Scores
    score_breakdown: ScoreBreakdown[]
    transcript_phases: TranscriptPhase[]
    voice_analysis: VoiceAnalysis
    security_warnings: SecurityWarnings
    qcm_detail: QCMDetail
    profile_inconsistencies: ProfileInconsistency[]
    recommendation: Recommendation
    has_video: boolean
    video_url?: string
}

interface Candidate {
    id: number; full_name: string; email: string; phone: string
    current_position: string; experience_years: number
    degree: string; university: string; location: string
    linkedin_url: string; github_username: string
    ai_summary: string; ai_strengths: string[]
    ai_weaknesses: string[]; ai_missing_skills: string[]
}
interface JobOffer { id: number; title: string; domain: string; requirements: string; city: string }
interface Timing { started_at: string; completed_at: string; duration_seconds: number; duration_label: string }
interface Scores { communication: number; cv_clarification: number; technical: number; scenario: number; qcm: number; vocal?: number; global: number }
interface ScoreBreakdown { phase: string; label: string; score: number; weight: number; contribution: number }
interface TranscriptEntry {
    question_index: number; question: string; answer: string
    response_time_sec: number; response_time_label: string
    vocal_score?: number; voice_metrics?: any; word_count?: number
    timestamp: string
}
interface TranscriptPhase { phase: string; phase_label: string; entries: TranscriptEntry[]; count: number }
interface VoiceEntry {
    index: number; phase: string; phase_label: string; vocal_score: number
    word_count: number; duration_label: string; wpm: number; wpm_label: string
    confidence_score: number; confidence_label: string
    fluency_score: number; fluency_label: string
    pitch_stability: number; speech_activity: number; silence_ratio: number; pause_count: number
    anomalies: any[]; has_double_voice: boolean; has_speaker_change: boolean
    speaker_confidence: number
}
interface VoiceAnalysis {
    available: boolean
    entries: VoiceEntry[]
    anomalies: any[]
    summary: { avg_vocal_score: number; avg_wpm: number; avg_confidence: number; avg_fluency: number; total_anomalies: number; has_double_voice: boolean; has_speaker_change: boolean; critical_anomalies: any[] }
}
interface SecurityWarning { id: number; type: string; label: string; severity: string; severity_icon: string; details: string; created_at: string; penalty_pts: number }
interface SecurityWarnings { entries: SecurityWarning[]; count: number; total_penalty: number; terminated: boolean; termination_reason?: string }
interface QCMItem { index: number; question: string; options: string[]; correct_index: number; correct_option: string; candidate_index?: number; candidate_option: string; is_correct: boolean; difficulty: string; domain: string; explanation: string }
interface QCMDetail { available: boolean; questions: QCMItem[]; score: number; correct: number; total: number }
interface ProfileInconsistency { type: string; description: string; severity: string; suggested_question?: string; rh_note?: string }
interface Recommendation { ai_recommendation: string; override_recommendation?: string; final_recommendation: string; rh_annotation?: string; rh_rating?: number; ai_feedback_full: string }

// ── API ───────────────────────────────────────────────────────────────────────
async function fetchReport(token: string): Promise<ReportData> {
    const url = `/api/recruitment/ai-interview/${token}/report/`
    console.log('Fetching report from:', url)  // Debug
    console.log('Token:', token)  // Debug

    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
    })

    console.log('Response status:', res.status)  // Debug

    if (!res.ok) {
        const errorText = await res.text()
        console.error('Error response:', errorText)  // Debug
        throw new Error(`HTTP ${res.status}: ${errorText}`)
    }
    return res.json()
}

// ── Couleurs score ────────────────────────────────────────────────────────────
function scoreColor(s: number) {
    if (s >= 80) return '#4ade80'
    if (s >= 60) return '#fbbf24'
    if (s >= 40) return '#fb923c'
    return '#f87171'
}
function scoreBg(s: number) {
    if (s >= 80) return 'rgba(74,222,128,0.10)'
    if (s >= 60) return 'rgba(251,191,36,0.10)'
    if (s >= 40) return 'rgba(251,146,60,0.10)'
    return 'rgba(248,113,113,0.10)'
}
function recoColor(r: string) {
    return r === 'VALIDATED' ? '#4ade80' : r === 'REJECTED' ? '#f87171' : r === 'TO_REVIEW' ? '#fbbf24' : '#94a3b8'
}
function recoLabel(r: string) {
    return r === 'VALIDATED' ? '✅ Validé' : r === 'REJECTED' ? '❌ Rejeté' : r === 'TO_REVIEW' ? '🟡 À revoir' : '⏳ En attente'
}
function severityColor(s: string) {
    return s === 'critical' ? '#ef4444' : s === 'high' ? '#f97316' : s === 'medium' ? '#fbbf24' : '#60a5fa'
}
function diffColor(d: string) {
    return d === 'hard' ? '#f87171' : d === 'medium' ? '#fbbf24' : '#4ade80'
}

// ── Jauge circulaire ──────────────────────────────────────────────────────────
function CircleGauge({ score, size = 72, stroke = 5 }: { score: number; size?: number; stroke?: number }) {
    const r = (size - stroke * 2) / 2
    const circ = 2 * Math.PI * r
    const dash = (score / 100) * circ
    const color = scoreColor(score)
    return (
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
                    strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                    style={{ transition: 'stroke-dasharray 1s ease' }} />
        </svg>
    )
}

// ── Barre de score ────────────────────────────────────────────────────────────
function ScoreBar({ score, label, sub }: { score: number; label: string; sub?: string }) {
    return (
        <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{label}</span>
                <span style={{ fontSize: 12, color: scoreColor(score), fontWeight: 700 }}>{score}/100{sub ? ` · ${sub}` : ''}</span>
            </div>
            <div style={{ height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${score}%`, background: scoreColor(score), borderRadius: 99, transition: 'width 1.2s ease' }} />
            </div>
        </div>
    )
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ id, title, icon, children, accent = '#fbbf24' }: { id: string; title: string; icon: string; children: React.ReactNode; accent?: string }) {
    return (
        <section id={id} style={{ marginBottom: 48 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, paddingBottom: 12, borderBottom: `1px solid rgba(255,255,255,0.06)` }}>
                <span style={{ fontSize: 16 }}>{icon}</span>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: accent, letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>{title}</h2>
            </div>
            {children}
        </section>
    )
}

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ text, color }: { text: string; color: string }) {
    return (
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color, background: `${color}18`, border: `1px solid ${color}30`, borderRadius: 4, padding: '2px 8px' }}>
      {text}
    </span>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE PRINCIPALE
// ─────────────────────────────────────────────────────────────────────────────

export default function InterviewReportPage() {
    const { token } = useParams<{ token: string }>()
    const [report, setReport] = useState<ReportData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [activeSection, setActiveSection] = useState('summary')
    const printRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!token) return
        fetchReport(token)
            .then(setReport)
            .catch(e => setError(e.message))
            .finally(() => setLoading(false))
    }, [token])

    if (loading) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080b12', color: 'rgba(255,255,255,0.4)', fontFamily: 'DM Mono, monospace', fontSize: 13 }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(251,191,36,0.2)', borderTopColor: '#fbbf24', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
                Génération du rapport…
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    )

    if (error || !report) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080b12', color: '#f87171', fontFamily: 'DM Mono, monospace' }}>
            Rapport introuvable — {error}
        </div>
    )

    const { candidate, job_offer, timing, scores, score_breakdown, transcript_phases, voice_analysis, security_warnings, qcm_detail, profile_inconsistencies, recommendation } = report

    const NAV = [
        { id: 'summary',     label: 'Résumé',       icon: '◈' },
        { id: 'scores',      label: 'Scores',        icon: '◉' },
        { id: 'transcript',  label: 'Transcription', icon: '◎' },
        { id: 'voice',       label: 'Vocal',         icon: '◐' },
        { id: 'security',    label: 'Sécurité',      icon: '◧' },
        { id: 'qcm',         label: 'QCM',           icon: '◫' },
        { id: 'profile',     label: 'Profil',        icon: '◍' },
        { id: 'reco',        label: 'Recommandation',icon: '●' },
    ]

    return (
        <div style={{ minHeight: '100vh', background: 'transparent', color: '#e2e8f0', fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        ::selection { background: rgba(251,191,36,0.2); }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
        }
      `}</style>

            {/* ── HEADER ─────────────────────────────────────────────────────────── */}
            <header
                className="no-print"
                style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 100,
                    // 1. On utilise une couleur plus transparente pour laisser passer le layout
                    background: 'rgba(13, 17, 28, 0.7)',
                    backdropFilter: 'blur(12px)',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    padding: '0 24px',
                    width: '100%'
                }}
            >
                <div style={{
                    // 2. On enlève le maxWidth rigide pour que ça s'aligne avec le reste du dashboard
                    display: 'flex',
                    alignItems: 'center',
                    height: 64 // Augmenté légèrement pour correspondre au standard du dashboard
                }}>
                    {/* Bouton Retour stylisé */}
                    <a
                        href="/rh/interviews"
                        style={{
                            color: 'rgba(255,255,255,0.5)',
                            fontSize: 13,
                            textDecoration: 'none',
                            marginRight: 32,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontWeight: 500
                        }}
                    >
                        <span style={{ fontSize: 18 }}>←</span> Retour
                    </a>

                    {/* Navigation interne */}
                    <nav style={{
                        display: 'flex',
                        gap: 8,
                        flex: 1,
                        overflowX: 'auto',
                        scrollbarWidth: 'none' // Cache la barre de scroll sur Firefox
                    }}>
                        {NAV.map(n => (
                            <a
                                key={n.id}
                                href={`#${n.id}`}
                                onClick={() => setActiveSection(n.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    textDecoration: 'none',
                                    whiteSpace: 'nowrap',
                                    transition: 'all 0.2s ease',
                                    color: activeSection === n.id ? '#fbbf24' : 'rgba(255,255,255,0.45)',
                                    background: activeSection === n.id ? 'rgba(251,191,36,0.1)' : 'transparent',
                                    border: activeSection === n.id ? '1px solid rgba(251,191,36,0.2)' : '1px solid transparent'
                                }}
                            >
                                <span style={{ opacity: 0.8 }}>{n.icon}</span>
                                {n.label}
                            </a>
                        ))}
                    </nav>


                </div>
            </header>

            {/* ── CONTENU ─────────────────────────────────────────────────────────── */}
            <div ref={printRef} style={{ maxWidth: 960, margin: '0 auto', padding: '48px 24px 96px' }}>

                {/* ════════════════════════════════════════════════════════════════════
            SECTION 1 — RÉSUMÉ EXÉCUTIF
        ════════════════════════════════════════════════════════════════════ */}
                <section id="summary" style={{ marginBottom: 56 }}>
                    {/* Bandeau recommandation */}
                    <div style={{ padding: '12px 20px', borderRadius: 10, background: `${recoColor(recommendation.final_recommendation)}12`, border: `1px solid ${recoColor(recommendation.final_recommendation)}30`, marginBottom: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 20 }}>
              {recommendation.final_recommendation === 'VALIDATED' ? '✅' : recommendation.final_recommendation === 'REJECTED' ? '❌' : recommendation.final_recommendation === 'TO_REVIEW' ? '🟡' : '⏳'}
            </span>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: recoColor(recommendation.final_recommendation) }}>
                                {recoLabel(recommendation.final_recommendation)}
                            </div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Recommandation finale</div>
                        </div>
                        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                            <div style={{ fontSize: 28, fontWeight: 800, color: scoreColor(scores.global), fontFamily: 'DM Mono, monospace' }}>{scores.global}</div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>SCORE GLOBAL / 100</div>
                        </div>
                    </div>

                    {/* Grille candidat + poste + timing */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                        {/* Candidat */}
                        <div style={{ padding: 20, borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 12 }}>Candidat</div>
                            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{candidate.full_name}</div>
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 2 }}>{candidate.email}</div>
                            {candidate.phone && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{candidate.phone}</div>}
                            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{candidate.current_position || 'Sans poste actuel'}</div>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{candidate.experience_years} ans d'exp. · {candidate.location}</div>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{candidate.degree} — {candidate.university}</div>
                            </div>
                            {(candidate.linkedin_url || candidate.github_username) && (
                                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                                    {candidate.linkedin_url && <a href={candidate.linkedin_url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: '#60a5fa', textDecoration: 'none' }}>LinkedIn ↗</a>}
                                    {candidate.github_username && <a href={`https://github.com/${candidate.github_username}`} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: '#60a5fa', textDecoration: 'none' }}>GitHub ↗</a>}
                                </div>
                            )}
                        </div>

                        {/* Poste */}
                        <div style={{ padding: 20, borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 12 }}>Poste</div>
                            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{job_offer.title}</div>
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 2 }}>{job_offer.domain}</div>
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{job_offer.city}</div>
                            {job_offer.requirements && (
                                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>
                                    {job_offer.requirements.slice(0, 120)}{job_offer.requirements.length > 120 ? '…' : ''}
                                </div>
                            )}
                        </div>

                        {/* Timing */}
                        <div style={{ padding: 20, borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 12 }}>Déroulement</div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>
                                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Début : </span>
                                {timing.started_at ? new Date(timing.started_at).toLocaleString('fr-FR') : '—'}
                            </div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>
                                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Fin : </span>
                                {timing.completed_at ? new Date(timing.completed_at).toLocaleString('fr-FR') : '—'}
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'DM Mono, monospace', color: '#fbbf24', marginTop: 8 }}>{timing.duration_label}</div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>durée totale</div>
                            <div style={{ marginTop: 12 }}>
                                <Badge text={report.status === 'completed' ? 'Complété' : 'Fraude terminée'} color={report.status === 'completed' ? '#4ade80' : '#f87171'} />
                            </div>
                            {security_warnings.count > 0 && (
                                <div style={{ marginTop: 8 }}>
                                    <Badge text={`${security_warnings.count} warning${security_warnings.count > 1 ? 's' : ''}`} color="#f97316" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Résumé IA du candidat */}
                    {candidate.ai_summary && (
                        <div style={{ marginTop: 16, padding: 20, borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 8 }}>Résumé IA du profil</div>
                            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, margin: 0 }}>{candidate.ai_summary}</p>
                            <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                {candidate.ai_strengths.slice(0, 4).map((s, i) => (
                                    <span key={i} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80' }}>+ {s}</span>
                                ))}
                                {candidate.ai_weaknesses.slice(0, 3).map((w, i) => (
                                    <span key={i} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>− {w}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                {/* ════════════════════════════════════════════════════════════════════
            SECTION 2 — SCORES DÉTAILLÉS
        ════════════════════════════════════════════════════════════════════ */}
                <Section id="scores" title="Scores détaillés" icon="◉" accent="#fbbf24">
                    {/* Score global central */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 32, padding: 24, borderRadius: 14, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 20 }}>
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                            <CircleGauge score={scores.global} size={100} stroke={7} />
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: 22, fontWeight: 800, color: scoreColor(scores.global), fontFamily: 'DM Mono, monospace' }}>{scores.global}</span>
                                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>/100</span>
                            </div>
                        </div>
                        <div style={{ flex: 1 }}>
                            {score_breakdown.filter(b => b.phase !== 'vocal').map(b => (
                                <ScoreBar key={b.phase} score={b.score} label={b.label} sub={`poids ${Math.round(b.weight * 100)}%`} />
                            ))}
                        </div>
                    </div>

                    {/* Grille scores par phase */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                        {[
                            { key: 'communication',    label: 'Communication',    icon: '💬', score: scores.communication },
                            { key: 'cv_clarification', label: 'Parcours CV',      icon: '📋', score: scores.cv_clarification },
                            { key: 'technical',        label: 'Technique oral',   icon: '⚙️', score: scores.technical },
                            { key: 'scenario',         label: 'Scénarios',        icon: '🎯', score: scores.scenario },
                            { key: 'qcm',             label: 'QCM',              icon: '📊', score: scores.qcm },
                            { key: 'vocal',           label: 'Vocal',            icon: '🎙️', score: scores.vocal ?? 0 },
                        ].map(({ key, label, icon, score }) => (
                            <div key={key} style={{ padding: 16, borderRadius: 10, background: scoreBg(score), border: `1px solid ${scoreColor(score)}20`, textAlign: 'center' }}>
                                <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
                                <div style={{ fontSize: 22, fontWeight: 800, color: scoreColor(score), fontFamily: 'DM Mono, monospace' }}>{score ?? '—'}</div>
                                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Pénalités */}
                    {security_warnings.total_penalty > 0 && (
                        <div style={{ marginTop: 14, padding: '10px 16px', borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Pénalité sécurité appliquée</span>
                            <span style={{ fontSize: 13, color: '#f87171', fontWeight: 700, fontFamily: 'DM Mono, monospace' }}>-{security_warnings.total_penalty} pts</span>
                        </div>
                    )}
                </Section>

                {/* ════════════════════════════════════════════════════════════════════
            SECTION 3 — TRANSCRIPTION COMPLÈTE
        ════════════════════════════════════════════════════════════════════ */}
                <Section id="transcript" title="Transcription complète" icon="◎" accent="#818cf8">
                    {transcript_phases.length === 0 ? (
                        <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, fontStyle: 'italic' }}>Aucune transcription disponible.</div>
                    ) : transcript_phases.map(ph => (
                        <div key={ph.phase} style={{ marginBottom: 32 }}>
                            {/* En-tête phase */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                                <div style={{ padding: '4px 12px', borderRadius: 6, background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.2)', fontSize: 11, fontWeight: 700, color: '#818cf8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                    {ph.phase_label}
                                </div>
                                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>{ph.count} question{ph.count > 1 ? 's' : ''}</span>
                            </div>

                            {/* Entrées Q/R */}
                            {ph.entries.map((entry, i) => (
                                <div key={i} style={{ marginBottom: 16, padding: 18, borderRadius: 12, background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
                                    {/* Numéro */}
                                    <div style={{ position: 'absolute', top: -10, left: 16, background: 'rgba(129,140,248,0.15)', border: '1px solid rgba(129,140,248,0.25)', borderRadius: 4, padding: '0 8px', fontSize: 10, color: '#818cf8', fontFamily: 'DM Mono, monospace' }}>
                                        Q{entry.question_index + 1}
                                    </div>

                                    {/* Question */}
                                    <div style={{ marginBottom: 10 }}>
                                        <div style={{ fontSize: 10, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', marginBottom: 4 }}>Question</div>
                                        <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.65 }}>{entry.question}</p>
                                    </div>

                                    {/* Réponse */}
                                    <div style={{ paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ fontSize: 10, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', marginBottom: 4 }}>Réponse du candidat</div>
                                        <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7 }}>
                                            {entry.answer || <em style={{ color: 'rgba(255,255,255,0.2)' }}>Aucune réponse</em>}
                                        </p>
                                    </div>

                                    {/* Méta : temps + vocal */}
                                    <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'DM Mono, monospace' }}>⏱ {entry.response_time_label}</span>
                                        {entry.word_count != null && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'DM Mono, monospace' }}>{entry.word_count} mots</span>}
                                        {entry.vocal_score != null && (
                                            <span style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: scoreColor(entry.vocal_score) }}>
                        🎙 Score vocal : {entry.vocal_score}/100
                      </span>
                                        )}
                                        {entry.voice_metrics && (
                                            <>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'DM Mono, monospace' }}>
                          Confiance : {entry.voice_metrics.confidence_label}
                        </span>
                                                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'DM Mono, monospace' }}>
                          Fluidité : {entry.voice_metrics.fluency_label}
                        </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </Section>

                {/* ════════════════════════════════════════════════════════════════════
            SECTION 4 — ANALYSE VOCALE
        ════════════════════════════════════════════════════════════════════ */}
                <Section id="voice" title="Analyse vocale détaillée" icon="◐" accent="#34d399">
                    {!voice_analysis.available ? (
                        <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, fontStyle: 'italic' }}>Aucune analyse vocale disponible.</div>
                    ) : (
                        <>
                            {/* Résumé vocal */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                                {[
                                    { label: 'Score vocal moyen', value: voice_analysis.summary.avg_vocal_score, unit: '/100', color: scoreColor(voice_analysis.summary.avg_vocal_score) },
                                    { label: 'Débit moyen', value: voice_analysis.summary.avg_wpm, unit: ' mpm', color: '#818cf8' },
                                    { label: 'Confiance moy.', value: voice_analysis.summary.avg_confidence, unit: '/100', color: '#34d399' },
                                    { label: 'Fluidité moy.', value: voice_analysis.summary.avg_fluency, unit: '/100', color: '#fbbf24' },
                                ].map(({ label, value, unit, color }) => (
                                    <div key={label} style={{ padding: 16, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
                                        <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: 'DM Mono, monospace' }}>{value ?? '—'}{unit}</div>
                                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{label}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Alertes critiques */}
                            {(voice_analysis.summary.has_double_voice || voice_analysis.summary.has_speaker_change) && (
                                <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', marginBottom: 16 }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: '#f87171', marginBottom: 4 }}>⛔ Anomalies critiques détectées</div>
                                    {voice_analysis.summary.has_double_voice && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>• Double voix détectée dans l'audio</div>}
                                    {voice_analysis.summary.has_speaker_change && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>• Changement de locuteur détecté</div>}
                                </div>
                            )}

                            {/* Tableau par réponse */}
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                    <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                        {['#', 'Phase', 'Score', 'Mots', 'Débit', 'Confiance', 'Fluidité', 'Stabilité pitch', 'Anomalies'].map(h => (
                                            <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', fontWeight: 600 }}>{h}</th>
                                        ))}
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {voice_analysis.entries.map(e => (
                                        <tr key={e.index} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                            <td style={{ padding: '10px 12px', fontFamily: 'DM Mono, monospace', color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{e.index}</td>
                                            <td style={{ padding: '10px 12px', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{e.phase_label}</td>
                                            <td style={{ padding: '10px 12px', fontFamily: 'DM Mono, monospace', fontWeight: 700, color: scoreColor(e.vocal_score) }}>{e.vocal_score}</td>
                                            <td style={{ padding: '10px 12px', fontFamily: 'DM Mono, monospace', color: 'rgba(255,255,255,0.4)' }}>{e.word_count}</td>
                                            <td style={{ padding: '10px 12px', fontFamily: 'DM Mono, monospace', color: '#818cf8' }}>{e.wpm} <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>mpm</span></td>
                                            <td style={{ padding: '10px 12px' }}>
                                                <div style={{ fontSize: 11, color: scoreColor(e.confidence_score) }}>{e.confidence_score}/100</div>
                                                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>{e.confidence_label}</div>
                                            </td>
                                            <td style={{ padding: '10px 12px' }}>
                                                <div style={{ fontSize: 11, color: scoreColor(e.fluency_score) }}>{e.fluency_score}/100</div>
                                                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>{e.fluency_label}</div>
                                            </td>
                                            <td style={{ padding: '10px 12px', fontFamily: 'DM Mono, monospace', color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{e.pitch_stability}%</td>
                                            <td style={{ padding: '10px 12px' }}>
                                                {e.anomalies.length > 0 ? (
                                                    e.anomalies.map((a, i) => (
                                                        <div key={i} style={{ fontSize: 10, color: severityColor(a.severity), marginBottom: 2 }}>
                                                            {a.severity === 'critical' ? '⛔' : a.severity === 'high' ? '🔴' : '🟡'} {a.type} <span style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'DM Mono, monospace' }}>{a.timestamp}</span>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.15)' }}>—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Toutes anomalies vocales */}
                            {voice_analysis.anomalies.length > 0 && (
                                <div style={{ marginTop: 20 }}>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                        Anomalies horodatées ({voice_analysis.anomalies.length})
                                    </div>
                                    {voice_analysis.anomalies.map((a, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 14px', borderRadius: 8, background: `${severityColor(a.severity)}08`, border: `1px solid ${severityColor(a.severity)}20`, marginBottom: 8 }}>
                                            <span style={{ fontSize: 14, flexShrink: 0 }}>{a.severity === 'critical' ? '⛔' : a.severity === 'high' ? '🔴' : '🟡'}</span>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 12, fontWeight: 600, color: severityColor(a.severity) }}>{a.type}</div>
                                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{a.description}</div>
                                                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 2, fontFamily: 'DM Mono, monospace' }}>
                                                    Phase : {a.phase_label} · Timestamp : {a.timestamp}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: '#f87171', fontFamily: 'DM Mono, monospace', flexShrink: 0 }}>
                                                -{a.penalty} pts
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </Section>

                {/* ════════════════════════════════════════════════════════════════════
            SECTION 5 — WARNINGS DE SÉCURITÉ
        ════════════════════════════════════════════════════════════════════ */}
                <Section id="security" title="Incidents de sécurité" icon="◧" accent="#f97316">
                    {security_warnings.count === 0 ? (
                        <div style={{ padding: '16px 20px', borderRadius: 10, background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.15)', fontSize: 13, color: '#4ade80' }}>
                            ✓ Aucun incident de sécurité détecté pendant l'entretien.
                        </div>
                    ) : (
                        <>
                            {/* Résumé sécurité */}
                            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                                <div style={{ padding: '10px 16px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                                    <div style={{ fontSize: 20, fontWeight: 800, color: '#f87171', fontFamily: 'DM Mono, monospace' }}>{security_warnings.count}</div>
                                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>incidents total</div>
                                </div>
                                <div style={{ padding: '10px 16px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                                    <div style={{ fontSize: 20, fontWeight: 800, color: '#f87171', fontFamily: 'DM Mono, monospace' }}>-{security_warnings.total_penalty}</div>
                                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>pts de pénalité</div>
                                </div>
                                {security_warnings.terminated && (
                                    <div style={{ padding: '10px 16px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', flex: 1 }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: '#f87171' }}>⛔ Entretien interrompu automatiquement</div>
                                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>3 incidents atteints</div>
                                    </div>
                                )}
                            </div>

                            {/* Liste des warnings */}
                            {security_warnings.entries.map((w, i) => (
                                <div key={w.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '12px 16px', borderRadius: 10, background: `${severityColor(w.severity)}06`, border: `1px solid ${severityColor(w.severity)}18`, marginBottom: 10 }}>
                                    {/* Numéro */}
                                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: `${severityColor(w.severity)}15`, border: `1px solid ${severityColor(w.severity)}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: severityColor(w.severity), flexShrink: 0, fontFamily: 'DM Mono, monospace' }}>
                                        {i + 1}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: severityColor(w.severity) }}>{w.label}</span>
                                            <Badge text={w.severity} color={severityColor(w.severity)} />
                                        </div>
                                        {w.details && (
                                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>{w.details}</div>
                                        )}
                                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'DM Mono, monospace' }}>
                                            {w.created_at ? new Date(w.created_at).toLocaleString('fr-FR') : '—'}
                                            <span style={{ marginLeft: 8, color: 'rgba(255,255,255,0.15)' }}>type: {w.type}</span>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: '#f87171', fontFamily: 'DM Mono, monospace', flexShrink: 0 }}>
                                        -{w.penalty_pts} pts
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </Section>

                {/* ════════════════════════════════════════════════════════════════════
            SECTION 6 — QCM DÉTAILLÉ
        ════════════════════════════════════════════════════════════════════ */}
                <Section id="qcm" title="QCM technique — Détail" icon="◫" accent="#60a5fa">
                    {!qcm_detail.available ? (
                        <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, fontStyle: 'italic' }}>QCM non disponible.</div>
                    ) : (
                        <>
                            {/* Score QCM */}
                            <div style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'center' }}>
                                <div style={{ padding: '12px 20px', borderRadius: 10, background: scoreBg(qcm_detail.score), border: `1px solid ${scoreColor(qcm_detail.score)}25` }}>
                                    <div style={{ fontSize: 28, fontWeight: 800, color: scoreColor(qcm_detail.score), fontFamily: 'DM Mono, monospace' }}>{qcm_detail.correct}/{qcm_detail.total}</div>
                                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>bonnes réponses</div>
                                </div>
                                <div style={{ padding: '12px 20px', borderRadius: 10, background: scoreBg(qcm_detail.score), border: `1px solid ${scoreColor(qcm_detail.score)}25` }}>
                                    <div style={{ fontSize: 28, fontWeight: 800, color: scoreColor(qcm_detail.score), fontFamily: 'DM Mono, monospace' }}>{qcm_detail.score}%</div>
                                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>score QCM</div>
                                </div>
                            </div>

                            {/* Questions */}
                            {qcm_detail.questions.map((q, i) => (
                                <div key={i} style={{ marginBottom: 14, padding: 16, borderRadius: 10, background: q.is_correct ? 'rgba(74,222,128,0.04)' : 'rgba(248,113,113,0.04)', border: `1px solid ${q.is_correct ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)'}` }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                                        <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{q.is_correct ? '✅' : '❌'}</span>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                                                <Badge text={q.difficulty} color={diffColor(q.difficulty)} />
                                                {q.domain && <Badge text={q.domain} color="#60a5fa" />}
                                                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'DM Mono, monospace' }}>Q{i + 1}</span>
                                            </div>
                                            <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>{q.question}</p>
                                        </div>
                                    </div>

                                    {/* Options */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginLeft: 24 }}>
                                        {q.options.map((opt, oi) => {
                                            const isCorrect  = oi === q.correct_index
                                            const isCandidate = oi === q.candidate_index
                                            const bg = isCorrect ? 'rgba(74,222,128,0.1)' : isCandidate && !isCorrect ? 'rgba(248,113,113,0.1)' : 'rgba(255,255,255,0.02)'
                                            const border = isCorrect ? 'rgba(74,222,128,0.3)' : isCandidate && !isCorrect ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.05)'
                                            const color  = isCorrect ? '#4ade80' : isCandidate && !isCorrect ? '#f87171' : 'rgba(255,255,255,0.45)'
                                            return (
                                                <div key={oi} style={{ padding: '6px 10px', borderRadius: 6, background: bg, border: `1px solid ${border}`, fontSize: 11, color, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    {isCorrect && <span>✓</span>}
                                                    {isCandidate && !isCorrect && <span>✗</span>}
                                                    {!isCorrect && !isCandidate && <span style={{ opacity: 0 }}>·</span>}
                                                    {opt}
                                                    {isCandidate && <span style={{ marginLeft: 'auto', fontSize: 9, opacity: 0.6 }}>candidat</span>}
                                                </div>
                                            )
                                        })}
                                    </div>

                                    {/* Explication */}
                                    {q.explanation && (
                                        <div style={{ marginTop: 8, marginLeft: 24, padding: '6px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>
                                            💡 {q.explanation}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </>
                    )}
                </Section>

                {/* ════════════════════════════════════════════════════════════════════
            SECTION 7 — INCOHÉRENCES PROFIL
        ════════════════════════════════════════════════════════════════════ */}
                <Section id="profile" title="Incohérences de profil" icon="◍" accent="#a78bfa">
                    <div style={{ padding: '8px 14px', borderRadius: 6, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)', marginBottom: 16, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                        ℹ️ Ces incohérences <strong style={{ color: 'rgba(255,255,255,0.5)' }}>n'ont pas impacté le score automatique</strong>. Elles sont à explorer lors de l'entretien humain de suivi.
                    </div>

                    {profile_inconsistencies.length === 0 ? (
                        <div style={{ padding: '14px 18px', borderRadius: 10, background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.15)', fontSize: 13, color: '#4ade80' }}>
                            ✓ Aucune incohérence de profil détectée.
                        </div>
                    ) : profile_inconsistencies.map((inc, i) => {
                        const color = inc.severity === 'high' ? '#f87171' : inc.severity === 'medium' ? '#fbbf24' : '#60a5fa'
                        return (
                            <div key={i} style={{ marginBottom: 12, padding: 16, borderRadius: 10, background: `${color}06`, border: `1px solid ${color}18` }}>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                                    <Badge text={inc.type} color={color} />
                                    <Badge text={inc.severity} color={color} />
                                </div>
                                <p style={{ margin: '0 0 8px', fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{inc.description}</p>
                                {inc.suggested_question && (
                                    <div style={{ padding: '8px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, marginBottom: 6 }}>
                                        <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, display: 'block', marginBottom: 4 }}>QUESTION SUGGÉRÉE</span>
                                        {inc.suggested_question}
                                    </div>
                                )}
                                {inc.rh_note && (
                                    <div style={{ fontSize: 11, color: color, marginTop: 4 }}>
                                        → Note RH : {inc.rh_note}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </Section>

                {/* ════════════════════════════════════════════════════════════════════
            SECTION 8 — RECOMMANDATION FINALE
        ════════════════════════════════════════════════════════════════════ */}
                <Section id="reco" title="Recommandation finale" icon="●" accent={recoColor(recommendation.final_recommendation)}>
                    {/* Verdict */}
                    <div style={{ padding: 24, borderRadius: 14, background: `${recoColor(recommendation.final_recommendation)}08`, border: `1px solid ${recoColor(recommendation.final_recommendation)}25`, marginBottom: 20, textAlign: 'center' }}>
                        <div style={{ fontSize: 36, marginBottom: 8 }}>
                            {recommendation.final_recommendation === 'VALIDATED' ? '✅' : recommendation.final_recommendation === 'REJECTED' ? '❌' : recommendation.final_recommendation === 'TO_REVIEW' ? '🟡' : '⏳'}
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: recoColor(recommendation.final_recommendation) }}>
                            {recoLabel(recommendation.final_recommendation)}
                        </div>
                        {recommendation.override_recommendation && (
                            <div style={{ marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                                (Recommandation IA : {recoLabel(recommendation.ai_recommendation)} — surchargée par le RH)
                            </div>
                        )}
                    </div>

                    {/* Feedback IA complet */}
                    {recommendation.ai_feedback_full && (
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 8 }}>Analyse IA détaillée</div>
                            <div style={{ padding: 18, borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.8, whiteSpace: 'pre-wrap', fontFamily: 'DM Mono, monospace' }}>
                                {recommendation.ai_feedback_full}
                            </div>
                        </div>
                    )}

                    {/* Annotation RH */}
                    {recommendation.rh_annotation && (
                        <div style={{ padding: 16, borderRadius: 10, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}>
                            <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(251,191,36,0.6)', marginBottom: 6 }}>Annotation RH</div>
                            <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>{recommendation.rh_annotation}</p>
                            {recommendation.rh_rating && (
                                <div style={{ marginTop: 8, fontSize: 12, color: '#fbbf24' }}>
                                    {'★'.repeat(recommendation.rh_rating)}{'☆'.repeat(5 - recommendation.rh_rating)} ({recommendation.rh_rating}/5)
                                </div>
                            )}
                        </div>
                    )}

                    {/* Vidéo */}
                    {report.has_video && report.video_url && (
                        <div style={{ marginTop: 16, padding: 16, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 10 }}>Enregistrement vidéo</div>
                            <video src={report.video_url} controls style={{ width: '100%', borderRadius: 8, maxHeight: 320 }} />
                        </div>
                    )}

                    {/* Footer rapport */}
                    <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.15)', fontFamily: 'DM Mono, monospace' }}>
                        <span>Rapport généré le {new Date(report.generated_at).toLocaleString('fr-FR')}</span>
                        <span>Entretien #{report.interview_id} · {report.interview_token.slice(0, 8)}…</span>
                    </div>
                </Section>

            </div>
        </div>
    )
}