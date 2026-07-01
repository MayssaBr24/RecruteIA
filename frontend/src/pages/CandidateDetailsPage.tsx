import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    ArrowLeft, Download, Mail, MapPin, GraduationCap,
    Briefcase, Linkedin, Globe, Calendar,
    FileText, BrainCircuit, CheckCircle,
    Clock, XCircle, Award, AlertTriangle, Zap,
    Phone, Loader2, CalendarCheck,
} from 'lucide-react'
import { useToast } from '../../hooks/use-toast'
import api from '../lib/api'
import {AIReportModal} from "./rh/AIReportModal.tsx";
import {HireConfirmModal} from "../components/rh/Hire/HireConfirmModal.tsx";

// ══════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════

interface CandidateProfile {
    id:                  number
    full_name:           string
    email:               string
    phone:               string
    cv_file:             string
    cover_letter_file:   string
    applied_date:        string
    status:              string
    job_offer_title:     string
    nationality:         string
    university:          string
    degree_level:        string
    graduation_year:     string
    experience_years:    number
    linkedin_url:        string
    portfolio_url:       string
    current_location:    string
    salary_expectation:  number | null
    availability_date:   string | null
    // IA
    ai_score:            number | null
    ai_decision:         'VALIDATED' | 'TO_REVIEW' | 'REJECTED' | 'PENDING' | null
    ai_strengths:        string | null
    ai_weaknesses:       string | null
    ai_summary:          string | null
    // Timeline statut
    status_history?:     { status: string; date: string; note?: string }[]
    certifications?: {
        id: number
        name: string
        issuing_organization: string
        credential_url: string
        file: string | null
    }[]
    recommendation_letters?: {
        id: number
        recommender_name: string
        recommender_position: string
        recommender_company: string
        file: string | null
    }[]
}


// ══════════════════════════════════════════════
// SOUS-COMPOSANTS
// ══════════════════════════════════════════════

// Anneau circulaire score IA
function ScoreRing({ score }: { score: number }) {
    const radius  = 44
    const stroke  = 7
    const norm    = radius - stroke / 2
    const circ    = 2 * Math.PI * norm
    const filled  = (score / 100) * circ

    const color =
        score >= 80 ? '#10b981' :
            score >= 60 ? '#818cf8' :
                score >= 40 ? '#f59e0b' : '#ef4444'

    const label =
        score >= 80 ? 'Excellent' :
            score >= 60 ? 'Bon'       :
                score >= 40 ? 'Moyen'     : 'Faible'

    return (
        <div className="flex flex-col items-center gap-1">
            <div className="relative w-24 h-24 flex items-center justify-center">
                <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
                    <circle cx="48" cy="48" r={norm} fill="none"
                            stroke="#1e293b" strokeWidth={stroke} />
                    <circle cx="48" cy="48" r={norm} fill="none"
                            stroke={color} strokeWidth={stroke}
                            strokeLinecap="round"
                            strokeDasharray={`${filled} ${circ - filled}`}
                            style={{ transition: 'stroke-dasharray 1s ease' }} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-white">{score}</span>
                    <span className="text-xs text-slate-400">/100</span>
                </div>
            </div>
            <span className="text-xs font-semibold" style={{ color }}>{label}</span>
        </div>
    )
}

// Carte section sombre
function Section({
                     icon: Icon, title, iconColor, children,
                 }: {
    icon:      React.ElementType
    title:     string
    iconColor: string
    children:  React.ReactNode
}) {
    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 p-5 border-b border-slate-700">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center
                                 bg-slate-700/50 border border-slate-600`}>
                    <Icon className={`w-4 h-4 ${iconColor}`} />
                </div>
                <h3 className="text-white font-semibold text-sm">{title}</h3>
            </div>
            <div className="p-5">{children}</div>
        </div>
    )
}

// Ligne info
function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-start justify-between py-2.5 border-b border-slate-700/50 last:border-0">
            <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">{label}</span>
            <span className="text-sm text-white font-medium text-right max-w-[60%]">
                {value || '—'}
            </span>
        </div>
    )
}


const DECISION_CONFIG: Record<string, {
    bg: string; text: string; border: string; label: string; icon: React.ElementType
}> = {
    VALIDATED: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', label: '✓ Validé',     icon: CheckCircle  },
    TO_REVIEW: { bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-amber-500/30',   label: '⏳ À examiner', icon: Clock        },
    REJECTED:  { bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-red-500/30',     label: '✗ Refusé',     icon: XCircle      },
    PENDING:   { bg: 'bg-slate-500/10',   text: 'text-slate-400',   border: 'border-slate-500/30',   label: 'En attente',   icon: Clock        },
}

// ══════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ══════════════════════════════════════════════

function CandidateDetailsPage() {
    const { id }       = useParams<{ id: string }>()
    const navigate     = useNavigate()
    const { toast }    = useToast()

    const [candidate, setCandidate] = useState<CandidateProfile | null>(null)
    const [loading, setLoading]     = useState(true)
    const [launching, setLaunching] = useState(false)
    const [showReport, setShowReport] = useState(false)
    const [reportData, setReportData] = useState(null)

    useEffect(() => {
        const fetch = async () => {
            try {
                setLoading(true)
                const res = await api.get(`/applications/${id}/`)
                setCandidate(res.data)
            } catch (err) {
                console.error(err)
                toast({ title: 'Erreur', description: 'Profil introuvable', variant: 'destructive' })
                navigate('/rh/applications')
            } finally {
                setLoading(false)
            }
        }
        if (id) fetch()
    }, [id, navigate, toast])

    const handleLaunchInterview = async () => {
        if (!candidate) return
        try {
            setLaunching(true)
            await api.post(`/rh/applications/${candidate.id}/launch-interview/`)
            toast({ title: '🤖 Entretien IA lancé', description: 'Le candidat recevra un lien par email.' })
            navigate('/rh/interviews')
        } catch (err) {
            console.error(err)
            toast({ title: 'Erreur', description: "Impossible de lancer l'entretien.", variant: 'destructive' })
        } finally {
            setLaunching(false)
        }

    }
    const handleOpenReport = async () => {
        if (!candidate) return; // or show an error toast

        try {
            const res = await api.get(`/rh/applications/${candidate.id}/ai-report/`)
            setReportData(res.data)
            setShowReport(true)
        } catch {
            toast({ title: 'Erreur', description: 'Impossible de charger le rapport.', variant: 'destructive' })
        }
    }
    const [showHireModal, setShowHireModal] = useState(false)


    const handleHire = async () => {
        if (!candidate) return
        try {
            await api.post(`/rh/applications/${candidate.id}/hire/`)
            toast({
                title: '🎉 Recruté !',
                description: `${candidate.full_name} a été transféré vers la page Employés.`
            })
            // Redirige vers la page employés après recrutement
            navigate('/rh/employees')
        } catch (err) {
            console.error(err)
            toast({ title: 'Erreur', description: "Impossible de marquer comme recruté.", variant: 'destructive' })
        }
    }
    // ── Loading ────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-purple-400" />
                    <p className="text-slate-400 text-sm">Chargement du profil...</p>
                </div>
            </div>
        )
    }

    if (!candidate) return null

    const dec        = DECISION_CONFIG[candidate.ai_decision ?? 'PENDING']
    const DecIcon    = dec.icon
    const score      = candidate.ai_score ?? 0
    const isHired    = candidate.status === 'hired'
    const hasInterview = candidate.status === 'interview_scheduled'


    // ── Render ─────────────────────────────────
    return (
        <div className="min-h-screen bg-slate-950">
            <div className="max-w-5xl mx-auto px-4 py-8">

                {/* Bouton retour */}
                <button onClick={() => navigate('/rh/applications')}
                        className="flex items-center gap-2 text-slate-400 hover:text-white
                               text-sm mb-6 transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    Retour aux candidatures
                </button>

                {/* ══ HERO HEADER ══════════════════════════ */}
                <div className="relative overflow-hidden rounded-2xl
                                bg-gradient-to-br from-purple-900/50 via-slate-800/80 to-blue-900/50
                                border border-slate-700 p-6 mb-6">

                    {/* Glow décoratif */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10
                                    rounded-full blur-3xl pointer-events-none" />

                    <div className="relative flex flex-col md:flex-row gap-6">

                        {/* Avatar + nom */}
                        <div className="flex items-start gap-5">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br
                                            from-purple-600 to-blue-600 flex items-center
                                            justify-center text-white text-xl font-bold shrink-0">
                                {candidate.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <div className="flex items-center gap-3 flex-wrap">
                                    <h1 className="text-2xl font-bold text-white">
                                        {candidate.full_name}
                                    </h1>
                                    <span className={`inline-flex items-center gap-1.5 text-xs
                                                     px-2.5 py-1 rounded-full border font-medium
                                                     ${dec.bg} ${dec.text} ${dec.border}`}>
                                        <DecIcon className="w-3 h-3" />
                                        {dec.label}
                                    </span>
                                    {isHired && (
                                        <span className="inline-flex items-center gap-1 text-xs
                                                         px-2.5 py-1 rounded-full font-medium
                                                         bg-emerald-600 text-white">
                                            <Award className="w-3 h-3" /> Recruté
                                        </span>
                                    )}
                                </div>
                                <p className="text-purple-300 text-sm mt-1">{candidate.job_offer_title}</p>
                                <div className="flex flex-wrap gap-3 mt-3">
                                    {candidate.current_location && (
                                        <span className="flex items-center gap-1 text-xs text-slate-400">
                                            <MapPin className="w-3 h-3 text-purple-400" />
                                            {candidate.current_location}
                                        </span>
                                    )}
                                    <span className="flex items-center gap-1 text-xs text-slate-400">
                                        <Briefcase className="w-3 h-3 text-blue-400" />
                                        {candidate.experience_years} ans d'exp.
                                    </span>
                                    <span className="flex items-center gap-1 text-xs text-slate-400">
                                        <Calendar className="w-3 h-3 text-emerald-400" />
                                        {candidate.availability_date
                                            ? `Dispo. ${new Date(candidate.availability_date).toLocaleDateString('fr-FR')}`
                                            : 'Disponible immédiatement'
                                        }
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Score IA */}
                        {score > 0 && (
                            <div className="md:ml-auto">
                                <ScoreRing score={score} />
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-3 mt-5 pt-5 border-t border-slate-700">
                        <a href={`mailto:${candidate.email}`}>
                            <button className="flex items-center gap-2 px-4 py-2 rounded-xl
                                               bg-slate-700 hover:bg-slate-600 text-white text-sm
                                               font-medium transition-all">
                                <Mail className="w-4 h-4" /> Contacter
                            </button>
                        </a>
                        {candidate.linkedin_url && (
                            <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer">
                                <button className="flex items-center gap-2 px-4 py-2 rounded-xl
                                                   bg-blue-600/20 hover:bg-blue-600/30 text-blue-300
                                                   border border-blue-500/30 text-sm font-medium transition-all">
                                    <Linkedin className="w-4 h-4" /> LinkedIn
                                </button>
                            </a>
                        )}
                        {!hasInterview && !isHired && (
                            <button onClick={handleLaunchInterview} disabled={launching}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl
                                           bg-purple-600 hover:bg-purple-700 text-white
                                           text-sm font-medium transition-all disabled:opacity-50">
                                {launching
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : <Zap className="w-4 h-4" />
                                }
                                Lancer entretien IA
                            </button>

                        )}
                        {candidate.ai_score && (
                            <button onClick={handleOpenReport}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl
                     bg-indigo-600 hover:bg-indigo-700 text-white
                     text-sm font-medium transition-all">
                                <FileText className="w-4 h-4" /> Rapport IA
                            </button>
                        )}
                        {/* Dans les Actions — remplacez le bouton existant */}
                        {!isHired  && (
                            <button onClick={() => setShowHireModal(true)}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl
                       bg-emerald-600 hover:bg-emerald-700 text-white
                       text-sm font-medium transition-all">
                                <CheckCircle className="w-4 h-4" />
                                Recruter
                            </button>
                        )}

                        {/* Juste avant la fermeture du composant */}
                        {showHireModal && candidate && (
                            <HireConfirmModal
                                candidateName={candidate.full_name}
                                onConfirm={handleHire}
                                onClose={() => setShowHireModal(false)}
                            />
                        )}
                    </div>
                    {showReport && reportData && (
                        <AIReportModal data={reportData} onClose={() => setShowReport(false)} />
                    )}
                </div>

                {/* ══ TIMELINE STATUT ══════════════════════ */}


                {/* ══ GRILLE PRINCIPALE ════════════════════ */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                    {/* Col gauche */}
                    <div className="space-y-5">

                        {/* Formation */}
                        <Section icon={GraduationCap} title="Formation académique" iconColor="text-purple-400">
                            <InfoRow label="Université"      value={candidate.university     ?? '—'} />
                            <InfoRow label="Diplôme"         value={candidate.degree_level   ?? '—'} />
                            <InfoRow label="Année"           value={candidate.graduation_year ?? '—'} />
                            <InfoRow label="Nationalité"     value={candidate.nationality     ?? '—'} />
                        </Section>

                        {/* Expérience */}
                        <Section icon={Briefcase} title="Expérience & Réseaux" iconColor="text-blue-400">
                            <InfoRow label="Années d'exp." value={`${candidate.experience_years} ans`} />
                            {candidate.linkedin_url && (
                                <div className="pt-3">
                                    <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer"
                                       className="flex items-center gap-2 text-blue-400 hover:text-blue-300
                                                   text-sm transition-colors">
                                        <Linkedin className="w-4 h-4" />
                                        Profil LinkedIn
                                    </a>
                                </div>
                            )}
                            {candidate.portfolio_url && (
                                <div className="pt-2">
                                    <a href={candidate.portfolio_url} target="_blank" rel="noopener noreferrer"
                                       className="flex items-center gap-2 text-blue-400 hover:text-blue-300
                                                   text-sm transition-colors">
                                        <Globe className="w-4 h-4" />
                                        Portfolio / GitHub
                                    </a>
                                </div>
                            )}
                        </Section>

                        {/* IA Résumé */}
                        {candidate.ai_summary && (
                            <Section icon={BrainCircuit} title="Résumé IA" iconColor="text-indigo-400">
                                <p className="text-slate-300 text-sm leading-relaxed">
                                    {candidate.ai_summary}
                                </p>
                            </Section>
                        )}
                    </div>

                    {/* Col droite */}
                    <div className="space-y-5">

                        {/* Forces / Faiblesses IA */}
                        {(candidate.ai_strengths || candidate.ai_weaknesses) && (
                            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
                                <div className="flex items-center gap-3 p-5 border-b border-slate-700">
                                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20
                                                    flex items-center justify-center">
                                        <BrainCircuit className="w-4 h-4 text-indigo-400" />
                                    </div>
                                    <h3 className="text-white font-semibold text-sm">Analyse IA</h3>
                                </div>
                                <div className="p-5 space-y-4">
                                    {candidate.ai_strengths && (
                                        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                                            <p className="text-emerald-400 text-xs font-semibold uppercase
                                                          tracking-wide mb-2 flex items-center gap-1.5">
                                                <CheckCircle className="w-3.5 h-3.5" /> Forces
                                            </p>
                                            <p className="text-slate-300 text-sm leading-relaxed">
                                                {candidate.ai_strengths}
                                            </p>
                                        </div>
                                    )}
                                    {candidate.ai_weaknesses && (
                                        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                                            <p className="text-amber-400 text-xs font-semibold uppercase
                                                          tracking-wide mb-2 flex items-center gap-1.5">
                                                <AlertTriangle className="w-3.5 h-3.5" /> Points d'attention
                                            </p>
                                            <p className="text-slate-300 text-sm leading-relaxed">
                                                {candidate.ai_weaknesses}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Logistique */}
                        <Section icon={CalendarCheck} title="disponibilité" iconColor="text-emerald-400">

                            <InfoRow
                                label="Disponibilité"
                                value={candidate.availability_date
                                    ? new Date(candidate.availability_date).toLocaleDateString('fr-FR')
                                    : 'Immédiate'
                                }
                            />
                            <div className="flex items-center gap-1 text-xs text-slate-400 pt-3">
                                <Phone className="w-3 h-3 text-emerald-400" />
                                {candidate.phone}
                            </div>
                        </Section>

                        {/* Documents */}
                        <Section icon={FileText} title="Documents de candidature" iconColor="text-amber-400">
                            <div className="space-y-3">
                                {/* CV */}
                                <div className="flex items-center justify-between p-3
                                                bg-slate-900/50 border border-slate-700 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-red-500/10 border border-red-500/20
                                                        rounded-lg flex items-center justify-center">
                                            <span className="text-red-400 text-xs font-bold">PDF</span>
                                        </div>
                                        <div>
                                            <p className="text-white text-sm font-medium">CV</p>
                                            <p className="text-slate-500 text-xs">Document principal</p>
                                        </div>
                                    </div>
                                    {candidate.cv_file && (
                                        <a href={candidate.cv_file} target="_blank" rel="noopener noreferrer">
                                            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                                               bg-slate-700 hover:bg-slate-600 text-slate-300
                                                               text-xs font-medium transition-all">
                                                <Download className="w-3.5 h-3.5" /> Télécharger
                                            </button>
                                        </a>
                                    )}
                                </div>

                                {/* Lettre */}
                                {candidate.cover_letter_file && (
                                    <div className="flex items-center justify-between p-3
                                                    bg-slate-900/50 border border-slate-700 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20
                                                            rounded-lg flex items-center justify-center">
                                                <span className="text-blue-400 text-xs font-bold">PDF</span>
                                            </div>
                                            <div>
                                                <p className="text-white text-sm font-medium">Lettre de motivation</p>
                                                <p className="text-slate-500 text-xs">Motivation du candidat</p>
                                            </div>
                                        </div>
                                        <a href={candidate.cover_letter_file} target="_blank" rel="noopener noreferrer">
                                            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                                               bg-slate-700 hover:bg-slate-600 text-slate-300
                                                               text-xs font-medium transition-all">
                                                <Download className="w-3.5 h-3.5" /> Télécharger
                                            </button>
                                        </a>
                                    </div>
                                )}
                            </div>
                            {/* Certifications */}
                            {candidate.certifications?.map((cert, i) => (
                                <div key={i} className="flex items-center justify-between p-3
                    bg-slate-900/50 border border-slate-700 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20
                            rounded-lg flex items-center justify-center">
                                            <span className="text-amber-400 text-xs font-bold">CERT</span>
                                        </div>
                                        <div>
                                            <p className="text-white text-sm font-medium">{cert.name}</p>
                                            <p className="text-slate-500 text-xs">
                                                {cert.issuing_organization || 'Certification'}
                                            </p>
                                        </div>
                                    </div>
                                    {cert.file && (
                                        <a href={cert.file} target="_blank" rel="noopener noreferrer">
                                            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                   bg-slate-700 hover:bg-slate-600 text-slate-300
                                   text-xs font-medium transition-all">
                                                <Download className="w-3.5 h-3.5" /> Télécharger
                                            </button>
                                        </a>
                                    )}
                                </div>
                            ))}

                            {/* Lettres de recommandation */}
                            {candidate.recommendation_letters?.map((rec, i) => (
                                <div key={i} className="flex items-center justify-between p-3
                    bg-slate-900/50 border border-slate-700 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20
                            rounded-lg flex items-center justify-center">
                                            <span className="text-emerald-400 text-xs font-bold">REC</span>
                                        </div>
                                        <div>
                                            <p className="text-white text-sm font-medium">
                                                Recommandation — {rec.recommender_name}
                                            </p>
                                            <p className="text-slate-500 text-xs">
                                                {rec.recommender_position}
                                                {rec.recommender_company ? ` · ${rec.recommender_company}` : ''}
                                            </p>
                                        </div>
                                    </div>
                                    {rec.file && (
                                        <a href={rec.file} target="_blank" rel="noopener noreferrer">
                                            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                   bg-slate-700 hover:bg-slate-600 text-slate-300
                                   text-xs font-medium transition-all">
                                                <Download className="w-3.5 h-3.5" /> Télécharger
                                            </button>
                                        </a>
                                    )}
                                </div>
                            ))}
                        </Section>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex gap-3 mt-6 pt-6 border-t border-slate-800">
                    <button onClick={() => navigate('/rh/applications')}
                            className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300
                                   hover:bg-slate-800 text-sm font-medium transition-all">
                        Retour à la liste
                    </button>
                </div>
            </div>
        </div>
    )
}

export default CandidateDetailsPage