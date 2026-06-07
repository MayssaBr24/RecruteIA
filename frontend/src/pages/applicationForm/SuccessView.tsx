
import { useNavigate } from 'react-router-dom'
import {
    CheckCircle2, TrendingUp, FileText, AlertCircle,
    BarChart2, Sparkles, Info,
} from 'lucide-react'
import { Header } from '../../components/Header'
import { ScoreBar } from './ui-primitives'
import {AIAnalysisResult} from "../../types/types.ts";

interface SuccessViewProps {
    aiAnalysis: AIAnalysisResult
    onReset: () => void
}

export function SuccessView({ aiAnalysis, onReset }: SuccessViewProps) {
    const navigate = useNavigate()

    const score      = aiAnalysis.score ?? 0
    const scoreColor = score >= 80 ? '#10b981' : score >= 58 ? '#6366f1' : '#f59e0b'
    const hasBreakdown = Boolean(aiAnalysis.breakdown && Object.keys(aiAnalysis.breakdown).length > 0)
    const hasFlags     = Boolean(aiAnalysis.coherence_flags?.length)
    const penalty      = aiAnalysis.breakdown?.penalty_applied ?? 0

    return (
        <div className="min-h-screen bg-slate-50">
            <Header />
            <main className="max-w-2xl mx-auto px-4 py-12">
                <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm space-y-6">

                    {/* Icône succès */}
                    <div className="text-center">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-sky-500
                            flex items-center justify-center mx-auto mb-4
                            shadow-lg shadow-indigo-500/30">
                            <CheckCircle2 className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-2xl font-extrabold text-slate-900 mb-1">Candidature envoyée !</h1>
                        <p className="text-slate-500 text-sm">Votre dossier a été reçu et analysé par notre IA.</p>
                    </div>

                    {aiAnalysis.status === 'completed' && score !== undefined && (
                        <>
                            {/* Score radial */}
                            <div className="flex flex-col items-center">
                                <div className="relative w-32 h-32">
                                    <svg className="-rotate-90 w-32 h-32" viewBox="0 0 128 128">
                                        <circle cx="64" cy="64" r="54" stroke="#f1f5f9" strokeWidth="10" fill="none" />
                                        <circle
                                            cx="64" cy="64" r="54"
                                            stroke={scoreColor} strokeWidth="10" fill="none"
                                            strokeDasharray={`${score * 3.39} 339`}
                                            strokeLinecap="round"
                                            style={{ transition: 'stroke-dasharray 1.2s ease' }}
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-3xl font-extrabold text-slate-900">{score}</span>
                                        <span className="text-xs text-slate-400">/ 100</span>
                                    </div>
                                </div>

                                {/* Badge décision */}
                                <div className={`mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-full
                                 font-semibold text-sm ${
                                    score >= 80
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : score >= 58
                                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                    {score >= 80 ? (
                                        <><TrendingUp className="w-4 h-4" /> Profil excellent</>
                                    ) : score >= 58 ? (
                                        <><FileText className="w-4 h-4" /> Profil prometteur</>
                                    ) : (
                                        <><AlertCircle className="w-4 h-4" /> À examiner</>
                                    )}
                                </div>
                            </div>

                            {/* Breakdown des scores */}
                            {hasBreakdown && (
                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <BarChart2 className="w-4 h-4 text-slate-400" />
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                      Détail des scores
                    </span>
                                    </div>
                                    <ScoreBar label="CV & compétences"  value={aiAnalysis.cv_score}                        color="bg-indigo-500" />
                                    <ScoreBar label="Lettre motivation" value={aiAnalysis.motivation_score}                color="bg-sky-500" />
                                    <ScoreBar label="Soft skills"       value={aiAnalysis.breakdown?.softskills_score}     color="bg-teal-500" />
                                    <ScoreBar label="GitHub"            value={aiAnalysis.github_score}                    color="bg-violet-500" />
                                    <ScoreBar label="Cohérence dossier" value={aiAnalysis.coherence_score}                 color="bg-emerald-500" />
                                    {penalty > 0 && (
                                        <div className="pt-1 border-t border-slate-200">
                                            <div className="flex justify-between text-xs">
                                                <span className="text-amber-600 font-semibold">Pénalités appliquées</span>
                                                <span className="text-amber-700 font-bold">−{penalty} pts</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Alertes de cohérence */}
                            {hasFlags && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                        <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">
                      Points à clarifier en entretien
                    </span>
                                    </div>
                                    {aiAnalysis.coherence_flags!.map((flag, i) => (
                                        <p key={i} className="text-sm text-slate-700 pl-6">• {flag}</p>
                                    ))}
                                </div>
                            )}

                            {/* Disclaimer */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                <div className="flex gap-2">
                                    <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                                    <p className="text-sm text-slate-600">
                                        <strong>Score indicatif</strong> — Cette estimation ne constitue pas une
                                        décision finale. Notre équipe RH examinera votre dossier dans son ensemble.
                                    </p>
                                </div>
                            </div>

                            {/* Message IA */}
                            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                                <div className="flex gap-2">
                                    <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                                    <p className="text-sm text-slate-700 whitespace-pre-line">{aiAnalysis.message}</p>
                                </div>
                            </div>

                            {/* Prochaines étapes */}
                            {aiAnalysis.next_steps && (
                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                                    <p className="text-sm text-slate-600 whitespace-pre-line">
                                        {aiAnalysis.next_steps}
                                    </p>
                                </div>
                            )}
                        </>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={() => navigate('/')}
                            className="flex-1 h-11 border border-slate-200 rounded-xl text-sm
                         font-semibold text-slate-600 bg-white hover:bg-slate-50 transition-colors"
                        >
                            Retour aux offres
                        </button>
                        <button
                            onClick={onReset}
                            className="flex-1 h-11 rounded-xl text-sm font-bold text-white
                         bg-gradient-to-r from-indigo-600 to-sky-500
                         hover:from-indigo-700 hover:to-sky-600 transition-all"
                        >
                            Autre candidature
                        </button>
                    </div>
                </div>
            </main>
        </div>
    )
}