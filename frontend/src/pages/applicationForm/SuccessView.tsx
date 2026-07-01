import { useNavigate } from 'react-router-dom'
import {
    CheckCircle2, TrendingUp, FileText, AlertCircle,
    BarChart2, Sparkles, Info, ArrowLeft, Github,
    Shield, Star, MessageSquare,
} from 'lucide-react'
import { Header } from '../../components/Header'
import { AIAnalysisResult } from '../../types/types.ts'

interface SuccessViewProps {
    aiAnalysis: AIAnalysisResult
    onReset: () => void
}

// ── Barre de score réutilisable ───────────────────────────────────────────────
function ScoreRow({
                      label, value, icon, color,
                  }: { label: string; value?: number | null; icon: React.ReactNode; color: string }) {
    if (value === undefined || value === null) return null
    const pct = Math.max(0, Math.min(100, value))
    return (
        <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                 style={{ background: `${color}18` }}>
                <span style={{ color }}>{icon}</span>
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-medium text-slate-500">{label}</span>
                    <span className="text-xs font-bold tabular-nums" style={{ color }}>
                        {value}<span className="text-slate-300 font-normal">/100</span>
                    </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: color }}
                    />
                </div>
            </div>
        </div>
    )
}

// ── Juge la couleur selon le score ────────────────────────────────────────────
function scoreColor(s: number) {
    if (s >= 75) return '#10b981'
    if (s >= 40) return '#6366f1'
    return '#f59e0b'
}

function scoreLabel(s: number) {
    if (s >= 75) return { text: 'Profil solide', icon: <TrendingUp className="w-3.5 h-3.5" />, bg: 'bg-emerald-50', fg: 'text-emerald-700', border: 'border-emerald-200' }
    if (s >= 40) return { text: 'Dossier prometteur', icon: <FileText className="w-3.5 h-3.5" />, bg: 'bg-indigo-50', fg: 'text-indigo-700', border: 'border-indigo-200' }
    return { text: 'À revoir', icon: <AlertCircle className="w-3.5 h-3.5" />, bg: 'bg-amber-50', fg: 'text-amber-700', border: 'border-amber-200' }
}

export function SuccessView({ aiAnalysis }: SuccessViewProps) {
    const navigate = useNavigate()

    const score   = aiAnalysis.score ?? 0
    const color   = scoreColor(score)
    const label   = scoreLabel(score)
    const hasBreakdown = Boolean(aiAnalysis.breakdown && Object.keys(aiAnalysis.breakdown).length > 0)
    const hasFlags     = Boolean(aiAnalysis.coherence_flags?.length)

    // Circonférence pour le SVG radial (r=52 → C≈326.7)
    const C   = 2 * Math.PI * 52
    const arc = (score / 100) * C

    return (
        <div className="min-h-screen" style={{ background: '#f8f9fb' }}>
            <Header />

            <main className="max-w-xl mx-auto px-4 py-10 space-y-4">

                {/* ── Carte principale ─────────────────────────────────────── */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

                    {/* Bande supérieure colorée selon score */}
                    <div className="h-1.5 w-full" style={{ background: color }} />

                    <div className="p-6 space-y-6">

                        {/* En-tête */}
                        <div className="flex items-start gap-4">
                            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                                 style={{ background: `${color}14` }}>
                                <CheckCircle2 className="w-5 h-5" style={{ color }} />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-slate-900 leading-tight">
                                    Candidature reçue
                                </h1>
                                <p className="text-sm text-slate-400 mt-0.5">
                                    Votre dossier a été analysé automatiquement.
                                </p>
                            </div>
                        </div>

                        {aiAnalysis.status === 'completed' && (
                            <>
                                {/* Score radial + badge */}
                                <div className="flex items-center gap-6">
                                    {/* SVG radial */}
                                    <div className="relative shrink-0 w-24 h-24">
                                        <svg viewBox="0 0 120 120" className="w-24 h-24 -rotate-90">
                                            <circle cx="60" cy="60" r="52"
                                                    fill="none" stroke="#f1f5f9" strokeWidth="9" />
                                            <circle cx="60" cy="60" r="52"
                                                    fill="none" stroke={color} strokeWidth="9"
                                                    strokeLinecap="round"
                                                    strokeDasharray={`${arc} ${C}`}
                                                    style={{ transition: 'stroke-dasharray 1.1s cubic-bezier(.4,0,.2,1)' }}
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-2xl font-extrabold text-slate-900 tabular-nums leading-none">
                                                {score}
                                            </span>
                                            <span className="text-[10px] text-slate-400 mt-0.5">/ 100</span>
                                        </div>
                                    </div>

                                    {/* Texte à droite du cercle */}
                                    <div className="space-y-2">
                                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full
                                            text-xs font-semibold border ${label.bg} ${label.fg} ${label.border}`}>
                                            {label.icon}
                                            {label.text}
                                        </div>

                                        <p className="text-xs text-slate-400 leading-relaxed max-w-[180px]">
                                            Score calculé sur CV, lettre, cohérence et GitHub.
                                        </p>
                                    </div>
                                </div>

                                {/* Séparateur */}
                                <div className="border-t border-slate-50" />

                                {/* Breakdown des scores */}
                                {hasBreakdown && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <BarChart2 className="w-3.5 h-3.5 text-slate-300" />
                                            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                                Détail de l'analyse
                                            </span>
                                        </div>
                                        <div className="space-y-3">
                                            <ScoreRow label="CV & compétences"
                                                      value={aiAnalysis.cv_score}
                                                      icon={<FileText className="w-3.5 h-3.5" />}
                                                      color="#6366f1" />
                                            <ScoreRow label="Lettre de motivation"
                                                      value={aiAnalysis.motivation_score}
                                                      icon={<MessageSquare className="w-3.5 h-3.5" />}
                                                      color="#0ea5e9" />
                                            <ScoreRow label="Soft skills"
                                                      value={aiAnalysis.breakdown?.softskills_score}
                                                      icon={<Star className="w-3.5 h-3.5" />}
                                                      color="#14b8a6" />
                                            <ScoreRow label="GitHub"
                                                      value={aiAnalysis.github_score}
                                                      icon={<Github className="w-3.5 h-3.5" />}
                                                      color="#8b5cf6" />
                                            <ScoreRow label="Cohérence du dossier"
                                                      value={aiAnalysis.coherence_score}
                                                      icon={<Shield className="w-3.5 h-3.5" />}
                                                      color="#10b981" />
                                        </div>
                                    </div>
                                )}

                                {/* Alertes cohérence */}
                                {hasFlags && (
                                    <>
                                        <div className="border-t border-slate-50" />
                                        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                                <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">
                                                    Points à clarifier
                                                </span>
                                            </div>
                                            <ul className="space-y-1">
                                                {aiAnalysis.coherence_flags!.map((flag, i) => (
                                                    <li key={i} className="text-xs text-slate-600 pl-5 relative before:content-['·']
                                                        before:absolute before:left-1.5 before:text-amber-400 before:font-bold">
                                                        {flag}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </>
                                )}

                                {/* Message IA */}
                                {aiAnalysis.message && (
                                    <>
                                        <div className="border-t border-slate-50" />
                                        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
                                            <div className="flex gap-2.5">
                                                <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                                                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                                                    {aiAnalysis.message}
                                                </p>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* Prochaines étapes */}
                                {aiAnalysis.next_steps && (
                                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                                        <p className="text-xs text-slate-500 leading-relaxed whitespace-pre-line">
                                            {aiAnalysis.next_steps}
                                        </p>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Disclaimer */}
                        <div className="flex gap-2.5 pt-1">
                            <Info className="w-3.5 h-3.5 text-slate-300 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                                Ce score est indicatif. La décision finale appartient à l'équipe RH
                                qui examinera votre dossier complet.
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── Action ───────────────────────────────────────────────── */}
                <button
                    onClick={() => navigate('/')}
                    className="w-full h-11 flex items-center justify-center gap-2
                        rounded-xl border border-slate-200 bg-white text-sm font-medium
                        text-slate-500 hover:bg-slate-50 hover:text-slate-700
                        transition-colors duration-150 shadow-sm"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Retour aux offres
                </button>
            </main>
        </div>
    )
}