import { useParams, useNavigate } from 'react-router-dom'
import {
    Loader2, ArrowLeft, Upload, GraduationCap, Linkedin,
    Calendar, Sparkles, CheckCircle2,
    Github, ShieldCheck, ExternalLink, User,
    Briefcase, Plus, X, Award, Mail, AlertCircle,
} from 'lucide-react'
import { Input }  from '../../components/ui/input'
import { Header } from '../components/Header'
import { useToast } from '../hooks/use-toast'
import api from '../lib/api'
import {
    clearAllCache,
    DEFAULT_FORM,
    loadFormCache,
    loadGithubData,
    loadOAuthCache,
    saveFormCache, saveGithubData,
    saveOAuthCache
} from "../types/constants.ts";
import {Field, FileZone, SectionHeader} from "./applicationForm/ui-primitives.tsx";
import {CertificationUploader} from "./applicationForm/CertificationUploader.tsx";
import {FormDataState, OAuthStatus, VerifiedProfiles} from "../types/types.ts";
import React, {useEffect, useRef, useState} from "react";
import {useOtp} from "../hooks/useOtp.ts";
import {useApplicationForm} from "../hooks/useApplicationForm.ts";
import {SuccessView} from "./applicationForm/SuccessView.tsx";
import {RecommendationUploader} from "./applicationForm/RecommendationUploader.tsx";
import { LocationSelector } from "./applicationForm/LocationSelector.tsx"
// ─────────────────────────────────────────────────────────────────────────────
export function ApplicationFormPage() {
    const { id }    = useParams<{ id: string }>()
    const navigate  = useNavigate()
    const { toast } = useToast()
    const jobId     = id ?? ''


    // ── Refs ────────────────────────────────────────────────────────────────────
    const emailRef        = useRef<HTMLDivElement>(null)
    const phoneRef        = useRef<HTMLDivElement>(null)
    const fullNameRef     = useRef<HTMLDivElement>(null)
    const degreeLevelRef  = useRef<HTMLDivElement>(null)
    const universityRef   = useRef<HTMLDivElement>(null)
    const expYearsRef     = useRef<HTMLDivElement>(null)

    const fieldRefs: Record<string, React.RefObject<HTMLDivElement | null>> = {
        email:            emailRef,
        phone:            phoneRef,
        full_name:        fullNameRef,
        degree_level:     degreeLevelRef,
        university:       universityRef,
        experience_years: expYearsRef,
    }

    // ── État local ──────────────────────────────────────────────────────────────
    const [loading,   setLoading]   = useState(true)
    const [jobTitle,  setJobTitle]  = useState('')
    const [weightGithub, setWeightGithub] = useState<number>(1)

    const [showEmailVerificationError, setShowEmailVerificationError] = useState(false)

    const [oauthStatus, setOauthStatus] = useState<OAuthStatus>(
        () => loadOAuthCache(jobId).status,
    )
    const [verifiedProfiles, setVerifiedProfiles] = useState<VerifiedProfiles>(
        () => loadOAuthCache(jobId).profiles,
    )
    const [formData, setFormData] = useState<FormDataState>(() => ({
        ...DEFAULT_FORM,
        ...loadFormCache(jobId),
        github_data: loadGithubData(jobId),
    }))


    const {
        otpSent, otpCode, emailVerified, emailVerifiedToken,
        otpLoading, setOtpCode, resetVerification, sendOTP, verifyOTP,
    } = useOtp(jobId)

    const { submitting, submitted, aiAnalysis, fieldErrors, clearFieldError, handleSubmit, resetSubmission } = useApplicationForm()

    // ── useEffects ──────────────────────────────────────────────────────────────
    useEffect(() => {
        if (jobId) saveFormCache(jobId, formData)
    }, [formData, jobId])

    useEffect(() => {
        if (jobId) saveOAuthCache(jobId, oauthStatus, verifiedProfiles)
    }, [oauthStatus, verifiedProfiles, jobId])

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const ghOk   = params.get('github_verified')   === 'true'
        const liOk   = params.get('linkedin_verified') === 'true'
        if (!ghOk && !liOk) return

        const cached      = loadFormCache(jobId)
        const cachedOAuth = loadOAuthCache(jobId)

        const newStatus: OAuthStatus = {
            ...cachedOAuth.status,
            github:   ghOk ? 'verified' : cachedOAuth.status.github,
            linkedin: liOk ? 'verified' : cachedOAuth.status.linkedin,
        }
        const newProfiles: VerifiedProfiles = {
            github_url:   params.get('github_url')   ?? cachedOAuth.profiles.github_url,
            linkedin_url: params.get('linkedin_url') ?? cachedOAuth.profiles.linkedin_url,
        }

        const rawGithubData = params.get('github_data')
        if (rawGithubData) {
            try {
                const parsed = JSON.parse(decodeURIComponent(rawGithubData)) as Record<string, unknown>
                saveGithubData(jobId, parsed)
            } catch { /* ignore */ }
        }

        const merged: FormDataState = {
            ...DEFAULT_FORM,
            ...cached,
            github_url:   params.get('github_url')   ?? cached.github_url   ?? '',
            linkedin_url: params.get('linkedin_url') ?? cached.linkedin_url ?? '',
            cv_file: null,
            cover_letter_file: null,
            github_data: null,
        }

        setOauthStatus(newStatus)
        setVerifiedProfiles(newProfiles)
        setFormData(merged)
        saveFormCache(jobId, merged)
        saveOAuthCache(jobId, newStatus, newProfiles)
        toast({ title: 'Profil vérifié ✓', description: 'Informations récupérées et sauvegardées.' })
        window.history.replaceState({}, '', window.location.pathname)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (!jobId) { navigate('/'); return }
        ;(async () => {
            try {
                const res = await api.get(`/jobs/${jobId}/`)
                const jobData = res.data as { title: string; weight_github: number }
                setJobTitle(jobData.title)
                setWeightGithub(jobData.weight_github ?? 1)            } catch {
                toast({ title: 'Erreur', description: 'Offre introuvable', variant: 'destructive' })
                navigate('/')
            } finally {
                setLoading(false)
            }
        })()
    }, [jobId, navigate, toast])

    // Scroll vers le premier champ en erreur
    useEffect(() => {
        if (Object.keys(fieldErrors).length === 0) return
        const firstKey = Object.keys(fieldErrors)[0]
        fieldRefs[firstKey]?.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fieldErrors])

    // ── Helpers ─────────────────────────────────────────────────────────────────
    const set = <K extends keyof FormDataState>(k: K, v: FormDataState[K]) =>
        setFormData((p) => ({ ...p, [k]: v }))

    const connectLinkedIn = () => {
        setOauthStatus((p) => ({ ...p, linkedin: 'loading' }))
        window.location.href = `/api/recruitment/auth/linkedin/?job_id=${jobId}`
    }
    const connectGitHub = () => {
        setOauthStatus((p) => ({ ...p, github: 'loading' }))
        window.location.href = `/api/recruitment/auth/github/?job_id=${jobId}`
    }

    const handleReset = () => {
        clearAllCache(jobId)
        resetSubmission()
        setOauthStatus({ linkedin: 'idle', github: 'idle' })
        setVerifiedProfiles({ linkedin_url: '', github_url: '' })
        setFormData(DEFAULT_FORM)
    }

    // ── Soumission ──────────────────────────────────────────────────────────────
    const onSubmit = handleSubmit({ jobId, formData, oauthStatus, emailVerifiedToken, emailVerified })

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!emailVerified) {
            setShowEmailVerificationError(true)
            toast({
                title: 'Email non vérifié',
                description: 'Vérifiez votre email avant de soumettre.',
                variant: 'destructive',
            })
            emailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            return
        }
        setShowEmailVerificationError(false)
        onSubmit(e)
    }

    const ErrMsg = ({ field }: { field: string }) =>
        fieldErrors[field] ? (
            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {fieldErrors[field]}
            </p>
        ) : null

    // ── Returns conditionnels ───────────────────────────────────────────────────
    if (submitted && aiAnalysis) {
        return <SuccessView aiAnalysis={aiAnalysis} onReset={handleReset} />
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <Header />
            <main className="max-w-2xl mx-auto px-4 py-8">

                <button
                    onClick={() => navigate(`/jobs/${jobId}`)}
                    className="inline-flex items-center gap-2 text-slate-500 text-sm font-medium
                     px-4 py-2 rounded-xl border border-slate-200 bg-white
                     hover:text-indigo-600 hover:border-indigo-200 transition-all mb-5"
                >
                    <ArrowLeft className="w-4 h-4" /> Retour à l&apos;offre
                </button>

                {/* Hero banner */}
                <div className="relative overflow-hidden rounded-2xl bg-[#0c1222] mb-5 p-6">
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-600/20 rounded-full blur-[60px] pointer-events-none" />
                    <div
                        className="absolute inset-0 opacity-[0.04] pointer-events-none"
                        style={{
                            backgroundImage: `linear-gradient(rgba(99,102,241,1) 1px, transparent 1px),linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)`,
                            backgroundSize: '32px 32px',
                        }}
                    />
                    <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap">
                        <div>
                            <div className="text-[17px] font-extrabold text-white mb-1">Candidature — {jobTitle}</div>
                            <div className="text-xs text-slate-500">Les champs <span className="text-indigo-400">★</span> sont obligatoires</div>
                        </div>
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full shrink-0 bg-indigo-500/10 border border-indigo-500/25">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="text-xs text-indigo-300 font-semibold">Analyse IA automatique</span>
                        </div>
                    </div>
                </div>

                {/* Form card */}
                <div className="bg-white border border-slate-200 rounded-2xl p-7">

                    <div className="flex gap-3 bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6">
                        <Sparkles className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-slate-700">
                            <strong>Analyse IA instantanée</strong> — Votre CV, lettre et profil GitHub
                            sont analysés en ~30 secondes pour évaluer l&apos;adéquation avec le poste.
                        </p>
                    </div>

                    {/* Bannière erreurs globales */}
                    {Object.keys(fieldErrors).length > 0 && (
                        <div className="flex gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-700 font-medium">
                                Corrigez les erreurs ci-dessous avant de soumettre.
                            </p>
                        </div>
                    )}

                    <form onSubmit={handleFormSubmit} className="space-y-8">

                        {/* ─ 1. Informations personnelles ──────────────────────────── */}
                        <div>
                            <SectionHeader
                                icon={User}
                                gradient="from-indigo-500 to-indigo-600"
                                title="Informations personnelles"
                                subtitle="Identité et coordonnées"
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                                <div ref={fullNameRef}>
                                    <Field label="Nom complet" required>
                                        <Input
                                            value={formData.full_name}
                                            onChange={(e) => set('full_name', e.target.value)}
                                            placeholder="Mayssa Ben Romdhane"
                                            required
                                            className="h-10 rounded-xl border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-400"
                                        />
                                        <ErrMsg field="full_name" />
                                    </Field>
                                </div>

                                {/* Email + OTP */}
                                <div ref={emailRef}>
                                    <Field label="Email" required>
                                        <div className="space-y-2">
                                            <div className="flex gap-2">

                                                <Input

                                                    type="email"
                                                    value={formData.email}
                                                    onChange={(e) => {
                                                        set('email', e.target.value)
                                                        resetVerification()
                                                        setShowEmailVerificationError(false)
                                                    }}
                                                    onBlur={(e) => {
                                                        const email = e.target.value.trim()
                                                        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                                                            toast({ title: 'Email invalide', description: 'Format incorrect.', variant: 'destructive' })
                                                        }
                                                    }}
                                                    placeholder="mayssa@example.com"
                                                    disabled={emailVerified && !fieldErrors.email}                                                    className={`h-10 rounded-xl border-slate-200 bg-slate-50 flex-1
                                                        ${showEmailVerificationError && !emailVerified ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                                    required

                                                />
                                                {!emailVerified ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => { sendOTP(formData.email); setShowEmailVerificationError(false) }}
                                                        disabled={otpLoading || !formData.email}
                                                        className="px-3 h-10 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap"
                                                    >
                                                        {otpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Vérifier'}
                                                    </button>
                                                ) : (
                                                    <div className="flex items-center gap-1 px-3 bg-emerald-100 rounded-xl">
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                                        <span className="text-xs text-emerald-700 font-bold">Vérifié</span>
                                                    </div>
                                                )}
                                            </div>

                                            {otpSent && !emailVerified && (
                                                <div className="flex gap-2">
                                                    <Input
                                                        placeholder="Code à 6 chiffres"
                                                        value={otpCode}
                                                        onChange={(e) => setOtpCode(e.target.value)}
                                                        maxLength={6}
                                                        className="h-10 rounded-xl tracking-widest text-center font-bold text-lg"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => verifyOTP(formData.email)}
                                                        disabled={otpLoading || otpCode.length !== 6}
                                                        className="px-3 h-10 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
                                                    >
                                                        {otpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmer'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => sendOTP(formData.email)}
                                                        disabled={otpLoading}
                                                        className="px-3 h-10 rounded-xl border border-slate-300 text-slate-600 text-xs hover:bg-slate-50"
                                                    >
                                                        Renvoyer
                                                    </button>
                                                </div>
                                            )}

                                            {showEmailVerificationError && !emailVerified && (
                                                <div className="flex items-start gap-2 mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                                                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                                    <div>
                                                        <p className="text-sm font-semibold text-red-700">Email non vérifié</p>
                                                        <p className="text-xs text-red-600 mt-0.5">
                                                            Cliquez sur <span className="font-bold">"Vérifier"</span> puis saisissez le code reçu.
                                                        </p>
                                                    </div>
                                                </div>
                                            )}


                                        </div>
                                        <ErrMsg field="email" />
                                    </Field>
                                </div>

                                <div ref={phoneRef}>
                                    <Field label="Téléphone" required>
                                        <Input
                                            type="tel"
                                            value={formData.phone}
                                            onChange={(e) => { set('phone', e.target.value); clearFieldError('phone') }}
                                            placeholder="+216 12 345 678"
                                            required
                                            className="h-10 rounded-xl border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-400"
                                        />
                                        <ErrMsg field="phone" />
                                    </Field>
                                </div>



                                <LocationSelector
                                    nationality={formData.nationality}
                                    city={formData.current_location}
                                    onNationalityChange={(val) => set('nationality', val)}
                                    onCityChange={(val) => set('current_location', val)}
                                />
                            </div>
                        </div>

                        {/* ─ 2. Formation & Expérience ──────────────────────────────── */}
                        <div>
                            <SectionHeader
                                icon={GraduationCap}
                                gradient="from-violet-500 to-purple-500"
                                title="Formation & Expérience"
                                subtitle="Parcours académique et professionnel"
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                                <div ref={universityRef}>
                                    <Field label="Université / École">
                                        <Input
                                            value={formData.university}
                                            onChange={(e) => set('university', e.target.value)}
                                            placeholder="ESSAT Gabès"
                                            className="h-10 rounded-xl border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-400"
                                        />
                                        <ErrMsg field="university" />
                                    </Field>
                                </div>

                                <div ref={degreeLevelRef}>
                                    <Field label="Diplôme">
                                        <Input
                                            value={formData.degree_level}
                                            onChange={(e) => { set('degree_level', e.target.value); clearFieldError('degree_level') }}
                                            placeholder="Licence en Informatique"
                                            className="h-10 rounded-xl border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-400"
                                        />
                                        <ErrMsg field="degree_level" />
                                    </Field>
                                </div>

                                <Field label="Année d'obtention">
                                    <Input
                                        type="number"
                                        value={formData.graduation_year}
                                        onChange={(e) => set('graduation_year', e.target.value)}
                                        placeholder="2025"
                                        min="1980" max="2030"
                                        className="h-10 rounded-xl border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-400"
                                    />
                                </Field>

                                <div ref={expYearsRef}>
                                    <Field label="Années d'expérience" hint="Nombre exact">
                                        <Input
                                            type="number"
                                            value={formData.experience_years}
                                            onChange={(e) => set('experience_years', e.target.value)}
                                            placeholder="Ex : 4"
                                            min="0" max="50" step="1"
                                            className="h-10 rounded-xl border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-400"
                                        />
                                        <ErrMsg field="experience_years" />
                                    </Field>
                                </div>

                                <div className="md:col-span-2">
                                    <Field label="Poste actuel" hint="Titre de votre poste actuel ou dernier poste occupé">
                                        <div className="relative">
                                            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <Input
                                                value={formData.current_position}
                                                onChange={(e) => set('current_position', e.target.value)}
                                                placeholder="Ex : Développeur fullstack chez Acme"
                                                className="h-10 pl-9 rounded-xl border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-400"
                                            />
                                        </div>
                                    </Field>
                                </div>
                            </div>
                        </div>

                        {/* ─ 3. Réseaux & Vérification OAuth ───────────────────────── */}
                        <div>
                            <SectionHeader
                                icon={ShieldCheck}
                                gradient="from-emerald-500 to-teal-500"
                                title="Réseaux & Vérification"
                                subtitle="Authentification anti-triche via OAuth"
                            />
                            <div className="flex gap-3 bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-4">
                                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                <p className="text-sm text-slate-700">
                                    Connectez vos comptes pour vérifier l&apos;authenticité de vos profils.
                                </p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <OAuthCard
                                    platform="linkedin"
                                    status={oauthStatus.linkedin}
                                    verifiedUrl={verifiedProfiles.linkedin_url}
                                    manualUrl={formData.linkedin_url}
                                    onConnect={connectLinkedIn}
                                    onDisconnect={() => {
                                        setOauthStatus((p) => ({ ...p, linkedin: 'idle' }))
                                        setVerifiedProfiles((p) => ({ ...p, linkedin_url: '' }))
                                        set('linkedin_url', '')
                                    }}
                                    onManualChange={(url) => set('linkedin_url', url)}
                                />
                                {weightGithub > 0 && (
                                    <OAuthCard
                                    platform="github"
                                    status={oauthStatus.github}
                                    verifiedUrl={verifiedProfiles.github_url}
                                    manualUrl={formData.github_url}
                                    onConnect={connectGitHub}
                                    onDisconnect={() => {
                                        setOauthStatus((p) => ({ ...p, github: 'idle' }))
                                        setVerifiedProfiles((p) => ({ ...p, github_url: '' }))
                                        set('github_url', '')
                                    }}
                                    onManualChange={(url) => set('github_url', url)}
                                />
                                 )}
                            </div>
                            <div className="flex gap-2 mt-3">
                                {(['linkedin', 'github'] as const).map((platform) => (
                                    <span
                                        key={platform}
                                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                                            oauthStatus[platform] === 'verified'
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-slate-100 text-slate-400'
                                        }`}
                                    >
                                        {platform === 'linkedin' ? <Linkedin className="w-3 h-3" /> : <Github className="w-3 h-3" />}
                                        {platform === 'linkedin' ? 'LinkedIn' : 'GitHub'}{' '}
                                        {oauthStatus[platform] === 'verified' ? 'vérifié' : 'non vérifié'}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* ─ 4. Documents ──────────────────────────────────────────── */}
                        <div>
                            <SectionHeader
                                icon={Upload}
                                gradient="from-amber-500 to-orange-500"
                                title="Documents & Disponibilité"
                                subtitle="CV obligatoire · lettre optionnelle"
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <FileZone
                                    file={formData.cv_file}
                                    onChange={(f) => set('cv_file', f)}
                                    label="CV (PDF)"
                                    accept=".pdf"
                                    maxMb={5}
                                    required
                                />
                                <FileZone
                                    file={formData.cover_letter_file}
                                    onChange={(f) => set('cover_letter_file', f)}
                                    label="Lettre de motivation"
                                    accept=".pdf"
                                    maxMb={3}
                                />
                            </div>
                        </div>

                        {/* ─ 5. Certifications ─────────────────────────────────────── */}
                        <div className="pt-6 border-t border-slate-100">
                            <SectionHeader
                                icon={Award}
                                gradient="from-emerald-500 to-teal-500"
                                title="Certifications"
                                subtitle="Ajoutez vos certificats et diplômes"
                            />
                            <CertificationUploader
                                certifications={formData.certifications}
                                onChange={(certs) => set('certifications', certs)}
                            />
                        </div>

                        {/* ─ 6. Sites professionnels ───────────────────────────────── */}
                        <div className="pt-6 border-t border-slate-100">
                            <SectionHeader
                                icon={ExternalLink}
                                gradient="from-cyan-500 to-blue-500"
                                title="Sites professionnels"
                                subtitle="Portfolio, Bayt, Indeed..."
                            />
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-500 uppercase">Liens</span>
                                    <button
                                        type="button"
                                        onClick={() => set('professional_links', [...formData.professional_links, { platform: '', url: '' }])}
                                        className="flex items-center gap-1 text-xs text-indigo-600 font-bold hover:underline"
                                    >
                                        <Plus className="w-3 h-3" /> Ajouter un site
                                    </button>
                                </div>
                                {formData.professional_links.map((link, index) => (
                                    <div key={index} className="flex gap-2">
                                        <Input
                                            placeholder="Ex: Bayt, Indeed..."
                                            value={link.platform}
                                            onChange={(e) => {
                                                const next = [...formData.professional_links]
                                                next[index] = { ...next[index], platform: e.target.value }
                                                set('professional_links', next)
                                            }}
                                            className="w-1/3 bg-slate-50"
                                        />
                                        <Input
                                            placeholder="https://..."
                                            value={link.url}
                                            onChange={(e) => {
                                                const next = [...formData.professional_links]
                                                next[index] = { ...next[index], url: e.target.value }
                                                set('professional_links', next)
                                            }}
                                            className="flex-1 bg-slate-50"
                                        />
                                        {formData.professional_links.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => set('professional_links', formData.professional_links.filter((_, i) => i !== index))}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ─ 7. Lettres de recommandation ──────────────────────────── */}
                        <div className="pt-6 border-t border-slate-100">
                            <SectionHeader
                                icon={Mail}
                                gradient="from-rose-500 to-pink-500"
                                title="Lettres de recommandation"
                                subtitle="Recommandations de vos anciens contacts professionnels"
                            />
                            <RecommendationUploader
                                recommendations={formData.recommendation_letters}
                                onChange={(recs) => set('recommendation_letters', recs)}
                            />
                        </div>

                        {/* ─ 8. Disponibilité ──────────────────────────────────────── */}
                        <div className="pt-6 border-t border-slate-100">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Field label="Date de disponibilité">
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <Input
                                            type="date"
                                            value={formData.availability_date}
                                            onChange={(e) => set('availability_date', e.target.value)}
                                            className="h-10 pl-9 rounded-xl border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-400"
                                        />
                                    </div>
                                </Field>
                            </div>
                        </div>

                        {/* Submit */}
                        <div className="flex gap-3 pt-2 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => navigate(-1)}
                                className="flex-1 h-12 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 bg-white hover:bg-slate-50 transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="flex-[2] h-12 rounded-xl border-none text-sm font-bold text-white
                                   bg-gradient-to-r from-indigo-600 to-sky-500 hover:from-indigo-700 hover:to-sky-600
                                   transition-all duration-200 flex items-center justify-center gap-2
                                   shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:-translate-y-0.5
                                   disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                            >
                                {submitting
                                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyse en cours…</>
                                    : <><Sparkles className="w-4 h-4" /> Envoyer ma candidature</>
                                }
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// OAuthCard
// ─────────────────────────────────────────────────────────────────────────────
interface OAuthCardProps {
    platform: 'linkedin' | 'github'
    status: OAuthStatus['linkedin']
    verifiedUrl: string
    manualUrl: string
    onConnect: () => void
    onDisconnect: () => void
    onManualChange: (url: string) => void
}

function OAuthCard({ platform, status, verifiedUrl, manualUrl, onConnect, onDisconnect, onManualChange }: OAuthCardProps) {
    const isLinkedIn  = platform === 'linkedin'
    const Icon        = isLinkedIn ? Linkedin : Github
    const label       = isLinkedIn ? 'LinkedIn' : 'GitHub'
    const placeholder = isLinkedIn ? 'https://linkedin.com/in/…' : 'https://github.com/…'
    const connectLabel = isLinkedIn ? 'Connecter LinkedIn' : 'Connecter GitHub'

    return (
        <div className={`rounded-2xl border p-4 transition-all ${status === 'verified' ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                    <Icon className={`w-4 h-4 ${isLinkedIn ? 'text-blue-600' : ''}`} />
                    {label}
                </div>
                {status === 'verified' && (
                    <span className="flex items-center gap-1 text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Vérifié
                    </span>
                )}
            </div>

            {status === 'verified' ? (
                <>
                    <div className="bg-white border border-emerald-200 rounded-xl p-3">
                        <div className="text-sm font-semibold text-emerald-700">Compte connecté</div>
                        {verifiedUrl && (
                            <a href={verifiedUrl} target="_blank" rel="noopener noreferrer"
                               className={`flex items-center gap-1 text-xs hover:underline mt-1 truncate ${isLinkedIn ? 'text-blue-600' : 'text-slate-600'}`}>
                                <ExternalLink className="w-3 h-3 shrink-0" />
                                {verifiedUrl}
                            </a>
                        )}
                    </div>
                    <button type="button" onClick={onDisconnect} className="mt-2 text-xs text-slate-400 hover:text-slate-600 underline">
                        Changer de compte
                    </button>
                </>
            ) : (
                <>
                    <button
                        type="button"
                        onClick={onConnect}
                        disabled={status === 'loading'}
                        className={`w-full h-9 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${
                            isLinkedIn
                                ? 'border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700'
                                : 'border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700'
                        }`}
                    >
                        {status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
                        {status === 'loading' ? 'Redirection…' : connectLabel}
                    </button>
                    <div className="flex items-center gap-2 my-2">
                        <div className="flex-1 h-px bg-slate-200" />
                        <span className="text-xs text-slate-400">ou manuellement</span>
                        <div className="flex-1 h-px bg-slate-200" />
                    </div>
                    <Input
                        type="url"
                        placeholder={placeholder}
                        value={manualUrl}
                        onChange={(e) => onManualChange(e.target.value)}
                        className="h-9 text-sm rounded-xl border-slate-200 bg-slate-50"
                    />
                </>
            )}
        </div>
    )
}