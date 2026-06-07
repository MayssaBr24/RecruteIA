import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import {
    Loader2, ArrowLeft, MapPin, FileText, GraduationCap,
    Award,  Users, Sparkles, Clock, Zap,
    CheckCircle2, Globe,
} from 'lucide-react'
import api from '../lib/api'
import { useToast } from '../hooks/use-toast'

interface Job {
    id:               number
    title:            string
    description:      string
    requirements:     string
    experience_years: number
    education_level:  string
    soft_skills:      string
    location:         string
    contract_type:    string
    applied_date:     string
    offer_deadline?:  string
    created_by_name?: string
}

const getDaysLeft = (deadline: string) => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const end   = new Date(deadline); end.setHours(0, 0, 0, 0)
    return Math.ceil((end.getTime() - today.getTime()) / 864e5)
}

const formatDate = (s: string) =>
    new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

const formatList = (str: string) =>
    str ? str.split(',').map(s => s.trim()).filter(Boolean) : []

// ── Badge deadline ──────────────────────────────
function DeadlineWidget({ deadline }: { deadline: string }) {
    const days = getDaysLeft(deadline)
    const urgent = days <= 7 && days >= 0

    return (
        <div className={`rounded-2xl p-5 border ${
            urgent
                ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200'
                : 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200'
        }`}>
            <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-2 ${
                urgent ? 'text-amber-700' : 'text-emerald-700'
            }`}>
                <Clock className="w-3.5 h-3.5" />
                Date limite de candidature
            </div>
            <div className={`text-xl font-extrabold mb-2 ${urgent ? 'text-amber-900' : 'text-emerald-900'}`}>
                {formatDate(deadline)}
            </div>
            {days >= 0 ? (
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                    urgent
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                }`}>
                    <Zap className="w-3 h-3" />
                    {days === 0 ? 'Dernier jour !' : `${days} jour${days > 1 ? 's' : ''} restant${days > 1 ? 's' : ''}`}
                </div>
            ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500">
                    Clôturée
                </div>
            )}
        </div>
    )
}

export function JobDetailsPage() {
    const { id }     = useParams<{ id: string }>()
    const navigate   = useNavigate()
    const { toast }  = useToast()
    const [job, setJob]       = useState<Job | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetch = async () => {
            try {
                setLoading(true)
                const res = await api.get(`/recruitment/jobs/${id}/`)
                setJob(res.data)
            } catch {
                toast({ title: 'Erreur', description: 'Offre non trouvée', variant: 'destructive' })
                navigate('/')
            } finally {
                setLoading(false)
            }
        }
        if (id) fetch()
    }, [id, toast, navigate])

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50">
                <Header />
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                </div>
            </div>
        )
    }

    if (!job) {
        return (
            <div className="min-h-screen bg-slate-50">
                <Header />
                <div className="p-8 text-center text-slate-500">Offre introuvable.</div>
            </div>
        )
    }

    const hardSkills = formatList(job.requirements)
    const softSkills = formatList(job.soft_skills)
    const isRemote   = (job.location ?? '').toLowerCase().includes('remote')
      return (
        <div className="min-h-screen bg-slate-50">
            <Header />

            <main className="max-w-5xl mx-auto px-4 md:px-8 py-8">

                {/* Retour */}
                <button
                    onClick={() => navigate('/')}                    className="inline-flex items-center gap-2 text-slate-500 text-sm font-medium
               px-4 py-2 rounded-xl border border-slate-200 bg-white
               hover:text-indigo-600 hover:border-indigo-200 transition-all mb-6"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Retour aux offres
                </button>
                {/* ── HERO CARD ── */}
                <div className="relative overflow-hidden rounded-2xl bg-[#0c1222] mb-6">

                    {/* déco */}
                    <div className="absolute -top-20 -left-20 w-64 h-64
                                    bg-indigo-600/20 rounded-full blur-[80px] pointer-events-none" />
                    <div className="absolute -bottom-10 -right-10 w-48 h-48
                                    bg-sky-600/15 rounded-full blur-[60px] pointer-events-none" />
                    <div
                        className="absolute inset-0 opacity-[0.04] pointer-events-none"
                        style={{
                            backgroundImage: `
                                linear-gradient(rgba(99,102,241,1) 1px, transparent 1px),
                                linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)`,
                            backgroundSize: '40px 40px',
                        }}
                    />

                    <div className="relative z-10 p-8">
                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8">

                            {/* Gauche */}
                            <div className="flex-1 min-w-0">

                                {/* Badge recrutement IA */}
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full
                                                bg-indigo-500/10 border border-indigo-500/25 mb-5">
                                    <Zap className="w-3.5 h-3.5 text-indigo-400" />
                                    <span className="text-indigo-300 text-xs font-semibold">
                                        Recrutement IA actif
                                    </span>
                                </div>

                                <h1 className="text-3xl md:text-4xl font-extrabold text-white
                                               leading-tight tracking-tight mb-5">
                                    {job.title}
                                </h1>

                                {/* Meta chips */}
                                <div className="flex flex-wrap gap-3">
                                    <span className="flex items-center gap-2 text-sm text-slate-400">
                                        {isRemote
                                            ? <Globe className="w-4 h-4 text-sky-400" />
                                            : <MapPin className="w-4 h-4 text-sky-400" />}
                                        {job.location || 'Lieu non précisé'}
                                    </span>
                                    {[
                                        job.contract_type || 'CDI',
                                        job.experience_years > 0 ? `${job.experience_years}+ ans` : 'Junior',
                                        job.education_level,
                                    ].filter(Boolean).map((chip, i) => (
                                        <span key={i}
                                              className="px-3 py-1 rounded-full text-xs font-semibold
                                                         bg-white/8 border border-white/10 text-slate-300">
                                            {chip}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* CTA droite */}
                            <div className="flex flex-col items-end gap-3 shrink-0">
                                <button
                                    onClick={() => navigate(`/apply/${id}`)}
                                    className="relative overflow-hidden h-12 px-7 rounded-xl
                                               bg-gradient-to-r from-indigo-600 to-sky-500
                                               hover:from-indigo-700 hover:to-sky-600
                                               text-white text-sm font-bold flex items-center gap-2
                                               shadow-lg shadow-indigo-500/40
                                               transition-all duration-200 hover:-translate-y-0.5
                                               hover:shadow-xl hover:shadow-indigo-500/50 group"
                                >
                                    {/* shine */}
                                    <span className="absolute inset-0 bg-gradient-to-r from-transparent
                                                     via-white/20 to-transparent -translate-x-full
                                                     group-hover:translate-x-full transition-transform duration-700" />
                                    <Sparkles className="w-4 h-4" />
                                    Postuler maintenant
                                    <span className="px-2 py-0.5 bg-white/20 rounded-full text-[10px] font-bold">
                                        IA
                                    </span>
                                </button>
                                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                    CV analysé instantanément en 30s
                                </p>
                            </div>
                        </div>

                        {/* Stats row */}
                        <div className="grid grid-cols-3 gap-px bg-white/5 mt-8 rounded-xl overflow-hidden">
                            {[
                                { val: '48h',  label: 'Réponse garantie', gradient: 'from-indigo-400 to-sky-400' },
                                { val: '30s',  label: 'Analyse IA du CV', gradient: 'from-emerald-400 to-teal-400' },
                                {
                                    val: job.offer_deadline
                                        ? `${Math.max(0, getDaysLeft(job.offer_deadline))}j`
                                        : '—',
                                    label: 'Reste pour postuler',
                                    gradient: 'from-amber-400 to-orange-400',
                                },
                            ].map(({ val, label, gradient }, i) => (
                                <div key={i} className="bg-slate-900/60 py-4 text-center">
                                    <div className={`text-xl font-extrabold bg-gradient-to-r ${gradient}
                                                     bg-clip-text text-transparent`}>
                                        {val}
                                    </div>
                                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">
                                        {label}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── BODY ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                    {/* Description (2/3) */}
                    <div className="lg:col-span-2">
                        <div className="bg-white border border-slate-200 rounded-2xl p-7">
                            <h2 className="flex items-center gap-2.5 text-base font-bold text-slate-900 mb-5">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-indigo-500 to-sky-500
                                                flex items-center justify-center">
                                    <FileText className="w-4 h-4 text-white" />
                                </div>
                                Description du poste
                            </h2>
                            <div className="text-sm text-slate-600 leading-[1.85] whitespace-pre-line">
                                {job.description}
                            </div>
                        </div>
                    </div>

                    {/* Sidebar (1/3) */}
                    <div className="flex flex-col gap-4">

                        {/* Profil recherché */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-5">
                            <h3 className="flex items-center gap-2.5 text-sm font-bold text-slate-900 mb-4">
                                <div className="w-7 h-7 rounded-lg bg-gradient-to-r from-indigo-500 to-sky-500
                                                flex items-center justify-center">
                                    <GraduationCap className="w-3.5 h-3.5 text-white" />
                                </div>
                                Profil recherché
                            </h3>
                            <div className="space-y-3">
                                {[
                                    {
                                        label: 'Expérience',
                                        value: job.experience_years > 0
                                            ? `${job.experience_years}+ ans`
                                            : 'Junior / Débutant accepté',
                                    },
                                    {
                                        label: "Niveau d'études",
                                        value: job.education_level || 'Non spécifié',
                                    },
                                    {
                                        label: 'Contrat',
                                        value: job.contract_type || 'CDI',
                                    },
                                ].map(({ label, value }) => (
                                    <div key={label}
                                         className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                                        <div className="text-[10px] text-slate-400 uppercase tracking-wider
                                                        font-bold mb-1">
                                            {label}
                                        </div>
                                        <div className="text-sm font-bold text-slate-900">{value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Hard Skills */}
                        {hardSkills.length > 0 && (
                            <div className="bg-white border border-slate-200 rounded-2xl p-5">
                                <h3 className="flex items-center gap-2.5 text-sm font-bold text-slate-900 mb-4">
                                    <div className="w-7 h-7 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600
                                                    flex items-center justify-center">
                                        <Award className="w-3.5 h-3.5 text-white" />
                                    </div>
                                    Hard Skills
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {hardSkills.map((skill, i) => (
                                        <span key={i}
                                              className="px-3 py-1.5 rounded-lg text-xs font-semibold
                                                         bg-indigo-50 text-indigo-700
                                                         border border-indigo-100">
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Soft Skills */}
                        {softSkills.length > 0 && (
                            <div className="bg-white border border-slate-200 rounded-2xl p-5">
                                <h3 className="flex items-center gap-2.5 text-sm font-bold text-slate-900 mb-4">
                                    <div className="w-7 h-7 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500
                                                    flex items-center justify-center">
                                        <Users className="w-3.5 h-3.5 text-white" />
                                    </div>
                                    Soft Skills
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {softSkills.map((skill, i) => (
                                        <span key={i}
                                              className="px-3 py-1.5 rounded-lg text-xs font-semibold
                                                         bg-emerald-50 text-emerald-700
                                                         border border-emerald-100">
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Deadline */}
                        {job.offer_deadline && (
                            <DeadlineWidget deadline={job.offer_deadline} />
                        )}

                        {/* CTA mobile / répété */}
                        <button
                            onClick={() => navigate(`/apply/${id}`)}
                            className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500
                                       hover:from-indigo-700 hover:to-sky-600 text-white text-sm font-bold
                                       flex items-center justify-center gap-2 transition-all duration-200
                                       shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40
                                       hover:-translate-y-0.5"
                        >
                            <Sparkles className="w-4 h-4" />
                            Postuler maintenant
                        </button>
                    </div>
                </div>
            </main>
        </div>
    )
}