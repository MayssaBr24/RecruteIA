import { useRef } from 'react'
import { X, Download, BrainCircuit, CheckCircle, AlertTriangle,
    Award, Target, Code, FileText } from 'lucide-react'

interface Certification {
    name: string; issuer: string; year?: number
    level: string; relevance: string
}
interface Project {
    name: string; type: string; technologies: string[]
    impact: string; complexity: string
    team_size?: string; duration?: string
}
interface AIReportData {
    ai_notes: string;
    full_name: string; job_offer_title: string; applied_date: string
    ai_score: number; ai_decision: string; ai_summary: string
    ai_strengths: string[]; ai_weaknesses: string[]
    ai_missing_skills: string[]; ai_recommendations: string
    ai_certifications: Certification[]; ai_projects: Project[]
    ai_breakdown?: Record<string, number>
    ai_coherence_flags?: string[]
    score_rationale?: string;
    detailed_justification?: {
        cv_justification: string;
        motivation_justification: string;
        softskills_justification: string;
        github_justification: string;
        coherence_justification: string;
        penalty_justification: string;
    };
}

const RELEVANCE_COLOR: Record<string, string> = {
    "Très pertinent": "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    "Pertinent":      "text-blue-400 bg-blue-500/10 border-blue-500/30",
    "Peu pertinent":  "text-slate-400 bg-slate-500/10 border-slate-500/30",
}
const COMPLEXITY_COLOR: Record<string, string> = {
    "Élevée":  "text-red-400",
    "Moyenne": "text-amber-400",
    "Faible":  "text-emerald-400",
}

export function AIReportModal({
                                  data, onClose
                              }: { data: AIReportData; onClose: () => void }) {
    const reportRef = useRef<HTMLDivElement>(null)

    const exportPDF = async () => {
        const { default: html2pdf } = await import('html2pdf.js')
        await html2pdf()
            .set({
                margin: 8, filename: `rapport-ia-${data.full_name.replace(/ /g, '-')}.pdf`,
                image: {type: 'jpeg', quality: 0.98},
                html2canvas: {scale: 2, backgroundColor: '#0f172a'},
                jsPDF: {unit: 'mm', format: 'a4', orientation: 'portrait'}
            })
            .from(reportRef.current)
            .save()
    }

    const score = data.ai_score ?? 0
    const radius = 44, stroke = 7
    const norm = radius - stroke / 2
    const circ = 2 * Math.PI * norm
    const filled = (score / 100) * circ
    const color = score >= 80 ? '#10b981' : score >= 60 ? '#818cf8'
        : score >= 40 ? '#f59e0b' : '#ef4444'
    console.log("Données reçues par la modale :", data); // Vérifiez ici si ai_notes contient du texte
    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center
                    bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="relative w-full max-w-4xl my-4">
                {/* Header actions */}
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-white font-bold text-lg flex items-center gap-2">
                        <BrainCircuit className="w-5 h-5 text-purple-400" />
                        Rapport d'analyse IA
                    </h2>
                    <div className="flex gap-2">
                        <button onClick={exportPDF}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl
                               bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium">
                            <Download className="w-4 h-4" /> Exporter PDF
                        </button>
                        <button onClick={onClose}
                                className="p-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Rapport (capturé pour le PDF) */}
                <div ref={reportRef}
                     className="bg-slate-900 rounded-2xl border border-slate-700 p-8 space-y-6">

                    {/* En-tête rapport */}
                    <div className="flex items-start justify-between border-b border-slate-700 pb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-white">{data.full_name}</h1>
                            <p className="text-purple-300 mt-1">{data.job_offer_title}</p>
                            <p className="text-slate-500 text-xs mt-1">
                                Analysé le {new Date(data.applied_date).toLocaleDateString('fr-FR')}
                            </p>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                            <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
                                <circle cx="48" cy="48" r={norm} fill="none" stroke="#1e293b" strokeWidth={stroke}/>
                                <circle cx="48" cy="48" r={norm} fill="none" stroke={color}
                                        strokeWidth={stroke} strokeLinecap="round"
                                        strokeDasharray={`${filled} ${circ - filled}`}/>
                            </svg>
                            <span className="text-2xl font-bold text-white -mt-16">{score}</span>
                            <span className="text-xs text-slate-400 mt-8">/100 — Score IA</span>
                        </div>
                    </div>

                    {/* Résumé */}
                    {data.ai_summary && (
                        <section>
                            <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-purple-400" /> Résumé du profil
                            </h3>
                            <p className="text-slate-300 text-sm leading-relaxed bg-slate-800/50
                            rounded-xl p-4 border border-slate-700">
                                {data.ai_summary}
                            </p>
                        </section>
                    )}

                    {/* Certifications */}
                    {data.ai_certifications?.length > 0 && (
                        <section>
                            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                                <Award className="w-4 h-4 text-amber-400" />
                                Certifications détectées ({data.ai_certifications.length})
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {data.ai_certifications.map((c, i) => (
                                    <div key={i} className="bg-slate-800/50 border border-slate-700
                                          rounded-xl p-3 flex items-start justify-between">
                                        <div>
                                            <p className="text-white text-sm font-medium">{c.name}</p>
                                            <p className="text-slate-400 text-xs">{c.issuer}
                                                {c.year ? ` · ${c.year}` : ''}</p>
                                            <p className="text-slate-500 text-xs mt-0.5">{c.level}</p>
                                        </div>
                                        <span className={`text-xs px-2 py-0.5 rounded-full border
                                     ${RELEVANCE_COLOR[c.relevance] ?? RELEVANCE_COLOR["Pertinent"]}`}>
                      {c.relevance}
                    </span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Projets */}
                    {data.ai_projects?.length > 0 && (
                        <section>
                            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                                <Code className="w-4 h-4 text-blue-400" />
                                Projets significatifs ({data.ai_projects.length})
                            </h3>
                            <div className="space-y-3">
                                {data.ai_projects.map((p, i) => (
                                    <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <p className="text-white text-sm font-medium">{p.name}</p>
                                                <span className="text-xs text-blue-400 bg-blue-500/10
                                         border border-blue-500/20 px-2 py-0.5 rounded-full">
                          {p.type}
                        </span>
                                            </div>
                                            <span className={`text-xs font-medium ${COMPLEXITY_COLOR[p.complexity]}`}>
                        Complexité {p.complexity}
                      </span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 mb-2">
                                            {p.technologies.map((t, j) => (
                                                <span key={j} className="text-xs px-2 py-0.5 rounded-md
                                                  bg-slate-700 text-slate-300">
                          {t}
                        </span>
                                            ))}
                                        </div>
                                        {p.impact && (
                                            <p className="text-slate-400 text-xs leading-relaxed">{p.impact}</p>
                                        )}
                                        {(p.team_size || p.duration) && (
                                            <p className="text-slate-500 text-xs mt-1">
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

                    {/* Forces / Faiblesses */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {data.ai_strengths?.length > 0 && (
                            <section>
                                <h3 className="text-emerald-400 font-semibold mb-2 flex items-center gap-2 text-sm">
                                    <CheckCircle className="w-4 h-4" /> Forces
                                </h3>
                                <div className="bg-emerald-500/5 border border-emerald-500/20
                                rounded-xl p-3 space-y-1">
                                    {data.ai_strengths.map((s, i) => (
                                        <p key={i} className="text-slate-300 text-xs flex items-start gap-2">
                                            <span className="text-emerald-400 mt-0.5">•</span>{s}
                                        </p>
                                    ))}
                                </div>
                            </section>
                        )}
                        {data.ai_weaknesses?.length > 0 && (
                            <section>
                                <h3 className="text-amber-400 font-semibold mb-2 flex items-center gap-2 text-sm">
                                    <AlertTriangle className="w-4 h-4" /> Points d'attention
                                </h3>
                                <div className="bg-amber-500/5 border border-amber-500/20
                                rounded-xl p-3 space-y-1">
                                    {data.ai_weaknesses.map((w, i) => (
                                        <p key={i} className="text-slate-300 text-xs flex items-start gap-2">
                                            <span className="text-amber-400 mt-0.5">•</span>{w}
                                        </p>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>

                    {/* Compétences manquantes */}
                    {data.ai_missing_skills?.length > 0 && (
                        <section>
                            <h3 className="text-red-400 font-semibold mb-2 flex items-center gap-2 text-sm">
                                <AlertTriangle className="w-4 h-4" /> Compétences manquantes
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {data.ai_missing_skills.map((s, i) => (
                                    <span key={i} className="text-xs px-2.5 py-1 rounded-full
                                           bg-red-500/10 text-red-400 border border-red-500/20">
                    {s}
                  </span>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Score breakdown */}
                    {data.ai_breakdown && (
                        <section>
                            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                                <Target className="w-4 h-4 text-indigo-400" /> Détail du score
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                    { key: 'cv_score', label: 'CV', color: 'text-purple-400' },
                                    { key: 'motivation_score', label: 'Motivation', color: 'text-blue-400' },
                                    { key: 'softskills_score', label: 'Soft skills', color: 'text-teal-400' },
                                    { key: 'github_score', label: 'GitHub', color: 'text-emerald-400' },
                                    { key: 'coherence_score', label: 'Cohérence', color: 'text-amber-400' },
                                    { key: 'penalty_applied', label: 'Pénalités', color: 'text-red-400' },
                                ].map(({ key, label, color }) =>
                                    data.ai_breakdown![key] !== undefined ? (
                                        <div key={key} className="bg-slate-800/50 border border-slate-700
                                              rounded-xl p-3 text-center">
                                            <p className={`text-lg font-bold ${color}`}>
                                                {key === 'penalty_applied'
                                                    ? `-${data.ai_breakdown![key]}`
                                                    : data.ai_breakdown![key]}
                                            </p>
                                            <p className="text-slate-500 text-xs mt-0.5">{label}</p>
                                        </div>
                                    ) : null
                                )}
                            </div>
                        </section>
                    )}

                    {/* Cohérence flags */}
                    {data.ai_coherence_flags?.length > 0 && (
                        <section className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                            <h3 className="text-red-400 font-semibold mb-2 text-sm">Alertes de cohérence</h3>
                            {data.ai_coherence_flags.map((f, i) => (
                                <p key={i} className="text-slate-300 text-xs flex items-start gap-2">
                                    <span className="text-red-400 mt-0.5">⚠</span>{f}
                                </p>
                            ))}
                        </section>
                    )}

                    {/* Recommandation finale */}
                    {data.ai_recommendations && (
                        <section className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
                            <h3 className="text-purple-400 font-semibold mb-2 flex items-center gap-2 text-sm">
                                <Target className="w-4 h-4" /> Recommandation IA
                            </h3>
                            <p className="text-slate-300 text-xs leading-relaxed">
                                {data.ai_recommendations}
                            </p>
                        </section>
                    )}
                    {/* Justification du score */}
                    {/* ============================================ */}
                    {/* SECTION JUSTIFICATION DÉTAILLÉE DU SCORE */}
                    {/* ============================================ */}
                    <section className="bg-slate-800/50 rounded-xl border border-purple-500/30 overflow-hidden">
                        {/* En-tête avec score */}
                        <div className="bg-gradient-to-r from-purple-600/20 to-indigo-600/20 p-5 border-b border-purple-500/30">
                            <h3 className="text-purple-400 font-bold text-lg flex items-center gap-2">
                                <BrainCircuit className="w-5 h-5" />
                                Pourquoi ce score de {score}/100 ?
                            </h3>
                            {data.score_rationale && (
                                <p className="text-slate-300 text-sm mt-2 leading-relaxed">
                                    {data.score_rationale}
                                </p>
                            )}
                        </div>

                        {/* Détail pas à pas */}
                        <div className="p-5 space-y-4">

                            {/* 1. Analyse CV */}
                            {data.ai_breakdown && (
                                <div className="border-l-4 border-emerald-500/50 pl-4">
                                    <h4 className="text-emerald-400 font-semibold text-sm mb-2 flex items-center gap-2">
                                        <FileText className="w-4 h-4" />
                                        1. Analyse du CV ({data.ai_breakdown.cv_score || 0}/100)
                                    </h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Pondération appliquée :</span>
                                            <span className="text-white font-mono">
                            {data.ai_breakdown.weighted_cv ||
                                (data.ai_breakdown.cv_score ? `${Math.round(data.ai_breakdown.cv_score * 0.4)}` : '0')} pts
                        </span>
                                        </div>
                                        <div className="bg-slate-900/50 rounded-lg p-3">
                                            <p className="text-slate-300 text-xs leading-relaxed">
                                                <span className="text-emerald-400 font-medium">🔍 Comment l'IA a analysé :</span><br/>
                                                • Extraction des compétences clés et mise en correspondance avec l'offre<br/>
                                                • Détection des années d'expérience réelles (vs déclarées)<br/>
                                                • Identification des projets pertinents et de leur complexité<br/>
                                                • Vérification des certifications et leur niveau de pertinence
                                            </p>
                                        </div>
                                        {data.detailed_justification?.cv_justification && (
                                            <p className="text-slate-300 text-xs bg-slate-800/30 p-2 rounded">
                                                💡 {data.detailed_justification.cv_justification}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* 2. Analyse Motivation */}
                            {data.ai_breakdown && data.ai_breakdown.motivation_score !== undefined && (
                                <div className="border-l-4 border-blue-500/50 pl-4">
                                    <h4 className="text-blue-400 font-semibold text-sm mb-2 flex items-center gap-2">
                                        <Target className="w-4 h-4" />
                                        2. Analyse de la motivation ({data.ai_breakdown.motivation_score}/100)
                                    </h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Pondération appliquée :</span>
                                            <span className="text-white font-mono">
                            {data.ai_breakdown.weighted_motivation ||
                                (data.ai_breakdown.motivation_score ? `${Math.round(data.ai_breakdown.motivation_score * 0.1)}` : '0')} pts
                        </span>
                                        </div>
                                        <div className="bg-slate-900/50 rounded-lg p-3">
                                            <p className="text-slate-300 text-xs leading-relaxed">
                                                <span className="text-blue-400 font-medium">🔍 Comment l'IA a analysé :</span><br/>
                                                • Personnalisation de la lettre (évite les génériques)<br/>
                                                • Compréhension réelle du poste et de l'entreprise<br/>
                                                • Qualité rédactionnelle et professionnalisme<br/>
                                                • Cohérence entre le CV et les motivations exprimées
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 3. Soft Skills */}
                            {data.ai_breakdown && (
                                <div className="border-l-4 border-teal-500/50 pl-4">
                                    <h4 className="text-teal-400 font-semibold text-sm mb-2 flex items-center gap-2">
                                        <Award className="w-4 h-4" />
                                        3. Évaluation des soft skills ({data.ai_breakdown.softskills_score || 0}/100)
                                    </h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Pondération appliquée :</span>
                                            <span className="text-white font-mono">
                            {data.ai_breakdown.weighted_softskills ||
                                (data.ai_breakdown.softskills_score ? `${Math.round(data.ai_breakdown.softskills_score * 0.15)}` : '0')} pts
                        </span>
                                        </div>
                                        <div className="bg-slate-900/50 rounded-lg p-3">
                                            <p className="text-slate-300 text-xs leading-relaxed">
                                                <span className="text-teal-400 font-medium">🔍 Comment l'IA a analysé :</span><br/>
                                                • Leadership : expérience de management ou mentorat<br/>
                                                • Autonomie : initiatives et projet personnels<br/>
                                                • Travail d'équipe : collaborations et contributions collectives<br/>
                                                • Résolution de problèmes : optimisations et innovations<br/>
                                                • Communication : documentation, présentations, reporting
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 4. GitHub / Portfolio */}
                            {data.ai_breakdown && data.ai_breakdown.github_score !== undefined && data.ai_breakdown.github_score > 0 && (
                                <div className="border-l-4 border-purple-500/50 pl-4">
                                    <h4 className="text-purple-400 font-semibold text-sm mb-2 flex items-center gap-2">
                                        <Code className="w-4 h-4" />
                                        4. Analyse GitHub/Portfolio ({data.ai_breakdown.github_score}/100)
                                    </h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Pondération appliquée :</span>
                                            <span className="text-white font-mono">
                            {data.ai_breakdown.weighted_github ||
                                (data.ai_breakdown.github_score ? `${Math.round(data.ai_breakdown.github_score * 0.3)}` : '0')} pts
                        </span>
                                        </div>
                                        <div className="bg-slate-900/50 rounded-lg p-3">
                                            <p className="text-slate-300 text-xs leading-relaxed">
                                                <span className="text-purple-400 font-medium">🔍 Comment l'IA a analysé :</span><br/>
                                                • Nombre et qualité des projets publics<br/>
                                                • Activité récente (commits, mises à jour)<br/>
                                                • Correspondance stack technique avec le poste<br/>
                                                • Documentation et lisibilité du code
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 5. Cohérence globale */}
                            {data.ai_breakdown && (
                                <div className="border-l-4 border-amber-500/50 pl-4">
                                    <h4 className="text-amber-400 font-semibold text-sm mb-2 flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4" />
                                        5. Vérification de cohérence ({data.ai_breakdown.coherence_score || 0}/100)
                                    </h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Pondération appliquée :</span>
                                            <span className="text-white font-mono">
                            {data.ai_breakdown.weighted_coherence ||
                                (data.ai_breakdown.coherence_score ? `${Math.round(data.ai_breakdown.coherence_score * 0.1)}` : '0')} pts
                        </span>
                                        </div>
                                        <div className="bg-slate-900/50 rounded-lg p-3">
                                            <p className="text-slate-300 text-xs leading-relaxed">
                                                <span className="text-amber-400 font-medium">🔍 Comment l'IA a analysé :</span><br/>
                                                • Écart entre expérience déclarée et CV réel<br/>
                                                • Compatibilité prétention salariale / budget<br/>
                                                • Disponibilité vs urgence du recrutement<br/>
                                                • Cohérence domaine (évite les hors-domaines complets)
                                            </p>
                                        </div>
                                        {data.ai_coherence_flags && data.ai_coherence_flags.length > 0 && (
                                            <div className="bg-red-500/10 p-2 rounded">
                                                <p className="text-red-400 text-xs font-medium">⚠️ Alertes détectées :</p>
                                                <ul className="text-slate-300 text-xs list-disc list-inside">
                                                    {data.ai_coherence_flags.slice(0, 3).map((flag, i) => (
                                                        <li key={i}>{flag}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* 6. Pénalités appliquées */}
                            {data.ai_breakdown && data.ai_breakdown.penalty_applied > 0 && (
                                <div className="border-l-4 border-red-500/50 pl-4">
                                    <h4 className="text-red-400 font-semibold text-sm mb-2 flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4" />
                                        6. Pénalités appliquées (-{data.ai_breakdown.penalty_applied} points)
                                    </h4>
                                    <div className="bg-red-500/10 rounded-lg p-3">
                                        <p className="text-slate-300 text-xs leading-relaxed">
                                            Des points ont été déduits pour les raisons suivantes :
                                        </p>
                                        <ul className="text-slate-300 text-xs list-disc list-inside mt-1">
                                            {!data.ai_breakdown.salary_compatible && (
                                                <li>💰 Prétention salariale incompatible avec le budget</li>
                                            )}
                                            {!data.ai_breakdown.experience_match && (
                                                <li>📅 Écart significatif entre expérience déclarée et CV</li>
                                            )}
                                            {data.ai_coherence_flags?.some(f => f.includes("hors domaine")) && (
                                                <li>🎯 Profil hors domaine par rapport au poste</li>
                                            )}
                                        </ul>
                                        {data.detailed_justification?.penalty_justification && (
                                            <p className="text-red-300 text-xs mt-2">
                                                💡 {data.detailed_justification.penalty_justification}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Récapitulatif du calcul */}
                        {data.ai_breakdown && (
                            <div className="bg-slate-900/80 p-4 border-t border-purple-500/30">
                                <h4 className="text-white font-semibold text-sm mb-2">📊 Récapitulatif du calcul</h4>
                                <div className="space-y-1 text-xs font-mono">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Score brut pondéré :</span>
                                        <span className="text-white">{((data.ai_breakdown.weighted_cv || 0) +
                                            (data.ai_breakdown.weighted_motivation || 0) +
                                            (data.ai_breakdown.weighted_softskills || 0) +
                                            (data.ai_breakdown.weighted_github || 0) +
                                            (data.ai_breakdown.weighted_coherence || 0)).toFixed(1)} pts</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Pénalités :</span>
                                        <span className="text-red-400">- {(data.ai_breakdown.penalty_applied || 0)} pts</span>
                                    </div>
                                    <div className="flex justify-between pt-1 border-t border-slate-700">
                                        <span className="text-purple-400 font-bold">Score final :</span>
                                        <span className="text-white font-bold text-base">{score}/100</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>

                    <p className="text-slate-600 text-xs text-center pt-2 border-t border-slate-800">
                        Rapport généré automatiquement — à titre indicatif uniquement
                    </p>
                </div>
            </div>
        </div>
    )
}