import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import {
    Loader2, ArrowLeft, Upload, GraduationCap, Linkedin,
    DollarSign, Calendar, Sparkles, CheckCircle2, TrendingUp, FileText,
    AlertCircle, Info, Github, ShieldCheck, ExternalLink, User,
    Briefcase, BarChart2, Plus, X, Award, Mail,
} from 'lucide-react'
import api from '../lib/api'
import { useToast } from '../hooks/use-toast'
import {useGoogleReCaptcha} from "react-google-recaptcha-v3";

// ── Types ────────────────────────────────────────────────────────────────────

interface ScoreBreakdown {
    cv_score?: number
    motivation_score?: number
    softskills_score?: number
    github_score?: number
    coherence_score?: number
    penalty_applied?: number
}

interface AIAnalysisResult {
    status: 'completed' | 'pending' | 'error'
    score?: number
    cv_score?: number
    motivation_score?: number
    github_score?: number
    github_relevance?: number
    coherence_score?: number
    coherence_flags?: string[]
    breakdown?: ScoreBreakdown
    message: string
    next_steps?: string
}

interface ProfessionalLink {
    platform: string
    url: string
}

interface CertificateData {
    id: string
    name: string
    issuing_organization: string
    credential_url: string
    file: File | null
    file_preview?: string
}

// NOUVEAU: Interface pour les lettres de recommandation multiples
interface RecommendationData {
    id: string
    recommender_name: string
    recommender_position: string
    recommender_company: string
    relationship: string
    file: File | null
    file_preview?: string
}

interface OAuthStatus {
    linkedin: 'idle' | 'loading' | 'verified' | 'error'
    github:   'idle' | 'loading' | 'verified' | 'error'
}

interface FormDataState {
    full_name: string
    email: string
    phone: string
    nationality: string
    university: string
    degree_level: string
    graduation_year: string
    current_position: string
    experience_years: string
    linkedin_url: string
    github_url: string
    current_location: string
    salary_expectation: string
    availability_date: string
    cv_file: File | null
    cover_letter_file: File | null
    professional_links: ProfessionalLink[]
    // NOUVEAU: Certificats et Recommandations
    certifications: CertificateData[]
    recommendation_letters: RecommendationData[]
    // NOUVEAU: Stocker les données GitHub enrichies
    github_data: Record<string, any> | null

}

// ── Cache helpers ─────────────────────────────────────────────────────────────

const CACHE_KEY  = (id: string) => `application_form_${id}`
const OAUTH_KEY  = (id: string) => `application_oauth_${id}`

function loadFormCache(id: string): Partial<Omit<FormDataState, 'cv_file' | 'cover_letter_file' | 'certifications.file' | 'recommendation_letters.file'>> {
    try {
        const r = localStorage.getItem(CACHE_KEY(id));
        return r ? JSON.parse(r) : {}
    }
    catch { return {} }
}
function saveFormCache(id: string, data: FormDataState) {
    try {
        const { cv_file, cover_letter_file, certifications, recommendation_letters, ...rest } = data
        // Ne pas sauvegarder les fichiers dans le cache
        localStorage.setItem(CACHE_KEY(id), JSON.stringify(rest))
    } catch { /* ignore */ }
}

function loadOAuthCache(id: string) {
    try {
        const r = localStorage.getItem(OAUTH_KEY(id))
        if (r) return JSON.parse(r)
    } catch { /* ignore */ }
    return {
        status: { linkedin: 'idle', github: 'idle' },
        profiles: { linkedin_url: '', github_url: '' },
    }
}

function saveOAuthCache(
    id: string,
    status: OAuthStatus,
    profiles: { linkedin_url: string; github_url: string },
) {
    try { localStorage.setItem(OAUTH_KEY(id), JSON.stringify({ status, profiles })) }
    catch { /* ignore */ }
}

function clearAllCache(id: string) {
    localStorage.removeItem(CACHE_KEY(id))
    localStorage.removeItem(OAUTH_KEY(id))
}

// Générer un ID unique
const generateId = () => Math.random().toString(36).substring(2, 9)

const DEFAULT_FORM: FormDataState = {
    full_name: '', email: '', phone: '', nationality: '',
    university: '', degree_level: '', graduation_year: '',
    current_position: '',
    experience_years: '',
    linkedin_url: '', github_url: '',
    current_location: '', salary_expectation: '', availability_date: '',
    cv_file: null, cover_letter_file: null,
    professional_links: [{ platform: '', url: '' }],
    // NOUVEAU: Tableaux vides pour commencer
    certifications: [],
    recommendation_letters: [],
    github_data: null,

}

// ── Small reusable components ─────────────────────────────────────────────────

function SectionHeader({ icon: Icon, gradient, title, subtitle }: {
    icon: React.ElementType; gradient: string; title: string; subtitle: string
}) {
    return (
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-r ${gradient}
                             flex items-center justify-center flex-shrink-0`}>
                <Icon className="w-4 h-4 text-white" />
            </div>
            <div>
                <div className="text-[15px] font-bold text-slate-900">{title}</div>
                <div className="text-xs text-slate-400 mt-0.5">{subtitle}</div>
            </div>
        </div>
    )
}

function Field({ label, required, hint, children }: {
    label: string; required?: boolean; hint?: string; children: React.ReactNode
}) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-500 tracking-wide uppercase">
                {label} {required && <span className="text-indigo-500">★</span>}
            </Label>
            {children}
            {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
        </div>
    )
}

// ── Score mini-bar (used in success screen breakdown) ────────────────────────

function ScoreBar({ label, value, max = 100, color }: {
    label: string; value: number | undefined; max?: number; color: string
}) {
    if (value === undefined || value === null) return null
    const pct = Math.round((value / max) * 100)
    return (
        <div className="space-y-1">
            <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">{label}</span>
                <span className="text-xs font-bold text-slate-700">{Math.round(value)}<span className="text-slate-400">/{max}</span></span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-700 ${color}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    )
}

// ── File drop zone ────────────────────────────────────────────────────────────

function FileZone({ file, onChange, label, accept, maxMb, required }: {
    file: File | null
    onChange: (f: File | null) => void
    label: string; accept: string; maxMb: number; required?: boolean
}) {
    const { toast } = useToast()
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0] || null
        if (!f) return
        if (!f.name.toLowerCase().endsWith('.pdf')) {
            toast({ title: 'Format invalide', description: 'Seuls les PDF sont acceptés', variant: 'destructive' })
            e.target.value = ''; return
        }
        if (f.size > maxMb * 1024 * 1024) {
            toast({ title: 'Fichier trop volumineux', description: `Max ${maxMb} MB`, variant: 'destructive' })
            e.target.value = ''; return
        }
        onChange(f)
    }
    return (
        <div>
            <Label className="text-xs font-semibold text-slate-500 tracking-wide uppercase mb-1.5 block">
                {label} {required && <span className="text-indigo-500">★</span>}
            </Label>
            <label className={`flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2
                               border-dashed cursor-pointer transition-all ${
                file
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/30'
            }`}>
                <input type="file" accept={accept} onChange={handleChange} className="hidden" />
                {file ? (
                    <>
                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                        <span className="text-sm font-semibold text-emerald-700 text-center break-all">{file.name}</span>
                        <span className="text-xs text-emerald-500">Cliquer pour changer</span>
                    </>
                ) : (
                    <>
                        <Upload className="w-6 h-6 text-slate-400" />
                        <span className="text-sm font-semibold text-slate-600">Glissez ou cliquez</span>
                        <span className="text-xs text-slate-400">PDF · max {maxMb} MB</span>
                    </>
                )}
            </label>
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOUVEAU: Composant Certifications Multiples
// ═══════════════════════════════════════════════════════════════════════════════

function CertificationUploader({
                                   certifications,
                                   onChange
                               }: {
    certifications: CertificateData[]
    onChange: (certs: CertificateData[]) => void
}) {
    const { toast } = useToast()

    const addCert = () => {
        onChange([...certifications, {
            id: generateId(),
            name: '',
            issuing_organization: '',
            credential_url: '',
            file: null,
        }])
    }

    const removeCert = (id: string) => {
        onChange(certifications.filter(c => c.id !== id))
    }

    const updateCert = (id: string, field: keyof CertificateData, value: any) => {
        const updated = certifications.map(cert =>
            cert.id === id ? { ...cert, [field]: value } : cert
        )
        onChange(updated)
    }

    const handleFileChange = (id: string, file: File | null) => {
        if (!file) return
        if (file.size > 5 * 1024 * 1024) {
            toast({ title: 'Fichier trop volumineux', description: 'Max 5 MB', variant: 'destructive' })
            return
        }
        const updated = certifications.map(cert =>
            cert.id === id ? { ...cert, file } : cert
        )
        onChange(updated)
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <Label className="text-xs font-bold text-slate-500 uppercase">
                    Certifications
                </Label>
                <button
                    type="button"
                    onClick={addCert}
                    className="flex items-center gap-1 text-xs text-indigo-600 font-bold hover:underline"
                >
                    <Plus className="w-3 h-3" />
                    Ajouter certification
                </button>
            </div>

            {certifications.map((cert) => (
                <div key={cert.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="flex items-start gap-3">
                        <div className="flex-1 space-y-2">
                            <Input
                                placeholder="Nom du certificat (ex: AWS Solutions Architect)"
                                value={cert.name}
                                onChange={(e) => updateCert(cert.id, 'name', e.target.value)}
                                className="h-9 bg-white"
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <Input
                                    placeholder="Organisme émetteur"
                                    value={cert.issuing_organization}
                                    onChange={(e) => updateCert(cert.id, 'issuing_organization', e.target.value)}
                                    className="h-9 bg-white"
                                />
                                <Input
                                    type="url"
                                    placeholder="URL credential (optionnel)"
                                    value={cert.credential_url}
                                    onChange={(e) => updateCert(cert.id, 'credential_url', e.target.value)}
                                    className="h-9 bg-white"
                                />
                            </div>
                            <div>
                                <input
                                    type="file"
                                    id={`cert-file-${cert.id}`}
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    className="hidden"
                                    onChange={(e) => {
                                        const f = e.target.files?.[0] || null
                                        handleFileChange(cert.id, f)
                                        e.target.value = ''
                                    }}
                                />
                                <label
                                    htmlFor={`cert-file-${cert.id}`}
                                    className="flex items-center gap-2 p-3 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-indigo-400 transition-colors"
                                >
                                    <FileText className="w-4 h-4 text-slate-400" />
                                    <span className="text-xs text-slate-500 flex-1 truncate">
                                        {cert.file ? cert.file.name : 'Fichier (PDF/Image, max 5MB)'}
                                    </span>
                                </label>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => removeCert(cert.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ))}

            {certifications.length === 0 && (
                <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <Award className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm text-slate-400">
                        Aucune certification ajoutée.<br/>
                        Cliquez sur "+ Ajouter certification".
                    </p>
                </div>
            )}
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOUVEAU: Composant Lettres de Recommandation Multiples
// ═══════════════════════════════════════════════════════════════════════════════

function RecommendationUploader({
                                    recommendations,
                                    onChange
                                }: {
    recommendations: RecommendationData[]
    onChange: (recs: RecommendationData[]) => void
}) {
    const { toast } = useToast()

    const addRec = () => {
        onChange([...recommendations, {
            id: generateId(),
            recommender_name: '',
            recommender_position: '',
            recommender_company: '',
            relationship: 'manager',
            file: null,
        }])
    }

    const removeRec = (id: string) => {
        onChange(recommendations.filter(r => r.id !== id))
    }

    const updateRec = (id: string, field: keyof RecommendationData, value: any) => {
        const updated = recommendations.map(rec =>
            rec.id === id ? { ...rec, [field]: value } : rec
        )
        onChange(updated)
    }

    const handleFileChange = (id: string, file: File | null) => {
        if (!file) return
        if (file.size > 3 * 1024 * 1024) {
            toast({ title: 'Fichier trop volumineux', description: 'Max 3 MB', variant: 'destructive' })
            return
        }
        if (!file.name.toLowerCase().endsWith('.pdf')) {
            toast({ title: 'Format invalide', description: 'Seuls les PDF sont acceptés', variant: 'destructive' })
            return
        }
        const updated = recommendations.map(rec =>
            rec.id === id ? { ...rec, file } : rec
        )
        onChange(updated)
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <Label className="text-xs font-bold text-slate-500 uppercase">
                    Lettres de recommandation
                </Label>
                <button
                    type="button"
                    onClick={addRec}
                    className="flex items-center gap-1 text-xs text-indigo-600 font-bold hover:underline"
                >
                    <Plus className="w-3 h-3" />
                    Ajouter recommandation
                </button>
            </div>

            {recommendations.map((rec) => (
                <div key={rec.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="flex items-start gap-3">
                        <div className="flex-1 space-y-2">
                            <Input
                                placeholder="Nom du recommandeur"
                                value={rec.recommender_name}
                                onChange={(e) => updateRec(rec.id, 'recommender_name', e.target.value)}
                                className="h-9 bg-white"
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <Input
                                    placeholder="Poste du recommandeur"
                                    value={rec.recommender_position}
                                    onChange={(e) => updateRec(rec.id, 'recommender_position', e.target.value)}
                                    className="h-9 bg-white"
                                />
                                <Input
                                    placeholder="Entreprise"
                                    value={rec.recommender_company}
                                    onChange={(e) => updateRec(rec.id, 'recommender_company', e.target.value)}
                                    className="h-9 bg-white"
                                />
                            </div>
                            <select
                                value={rec.relationship}
                                onChange={(e) => updateRec(rec.id, 'relationship', e.target.value)}
                                className="h-9 px-3 bg-white border border-slate-200 rounded-xl text-sm w-full"
                            >
                                <option value="manager">Ancien Manager</option>
                                <option value="colleague">Collègue</option>
                                <option value="professor">Professeur</option>
                                <option value="client">Client</option>
                                <option value="mentor">Mentor</option>
                                <option value="other">Autre</option>
                            </select>
                            <div>
                                <input
                                    type="file"
                                    id={`rec-file-${rec.id}`}
                                    accept=".pdf"
                                    className="hidden"
                                    onChange={(e) => {
                                        const f = e.target.files?.[0] || null
                                        handleFileChange(rec.id, f)
                                        e.target.value = ''
                                    }}
                                />
                                <label
                                    htmlFor={`rec-file-${rec.id}`}
                                    className="flex items-center gap-2 p-3 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-indigo-400 transition-colors"
                                >
                                    <Mail className="w-4 h-4 text-slate-400" />
                                    <span className="text-xs text-slate-500 flex-1 truncate">
                                        {rec.file ? rec.file.name : 'Lettre (PDF, max 3MB)'}
                                    </span>
                                </label>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => removeRec(rec.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ))}

            {recommendations.length === 0 && (
                <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <Mail className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm text-slate-400">
                        Aucune recommandation ajoutée.<br/>
                        Cliquez sur "+ Ajouter recommandation".
                    </p>
                </div>
            )}
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════════

export function ApplicationFormPage() {
    const { id }    = useParams<{ id: string }>()
    const navigate  = useNavigate()
    const { toast } = useToast()
    const jobId     = id || ''

    const [loading, setLoading]       = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted]   = useState(false)
    const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null)
    const [jobTitle, setJobTitle]     = useState('')
    const { executeRecaptcha } = useGoogleReCaptcha()
    const [oauthStatus, setOauthStatus] = useState<OAuthStatus>(() =>
        loadOAuthCache(id || '').status
    )
    const [verifiedProfiles, setVerifiedProfiles] = useState(() =>
        loadOAuthCache(id || '').profiles
    )
    // États à ajouter
    const [otpSent, setOtpSent] = useState(false)
    const [otpCode, setOtpCode] = useState('')
    const [emailVerified, setEmailVerified] = useState(false)
    const [emailVerifiedToken, setEmailVerifiedToken] = useState('')
    const [otpLoading, setOtpLoading] = useState(false)

// Fonction envoyer OTP
    const sendOTP = async () => {
        if (!formData.email?.trim()) {
            toast({ title: 'Email manquant', variant: 'destructive' }); return
        }
        setOtpLoading(true)
        try {
            await api.post('/recruitment/send-otp/', { email: formData.email.trim() })
            setOtpSent(true)
            toast({ title: 'Code envoyé !', description: `Vérifiez ${formData.email}` })
        } catch (err: any) {
            toast({ title: 'Erreur', description: err.response?.data?.error || 'Erreur envoi', variant: 'destructive' })
        } finally { setOtpLoading(false) }
    }

// Fonction vérifier OTP
    const verifyOTP = async () => {
        setOtpLoading(true)
        try {
            const res = await api.post('/recruitment/verify-otp/', {
                email: formData.email.trim(),
                code: otpCode.trim()
            })
            setEmailVerified(true)
            setEmailVerifiedToken(res.data.verified_token)
            toast({ title: '✅ Email vérifié !', description: 'Vous pouvez compléter votre candidature.' })
        } catch (err: any) {
            toast({ title: 'Code incorrect', description: err.response?.data?.error, variant: 'destructive' })
        } finally { setOtpLoading(false) }
    }

    function loadGithubData(jobId: string): Record<string, any> | null {
        try {
            const r = localStorage.getItem(`github_data_${jobId}`)
            return r ? JSON.parse(r) : null
        } catch { return null }
    }


    const [formData, setFormData] = useState<FormDataState>(() => ({
        ...DEFAULT_FORM,
        ...loadFormCache(id || ''),
        github_data: loadGithubData(id || '') || null,  // ← AJOUTER ICI
    }))


    // Auto-save (sans les fichiers)
    useEffect(() => { if (jobId) saveFormCache(jobId, formData) }, [formData, jobId])
    useEffect(() => {
        if (jobId) saveOAuthCache(jobId, oauthStatus, verifiedProfiles)
    }, [oauthStatus, verifiedProfiles, jobId])

    // OAuth return
    // Dans useEffect OAuth (remplace le bloc existant)
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
        const newProfiles = {
            github_url:   params.get('github_url')   || cachedOAuth.profiles.github_url,
            linkedin_url: params.get('linkedin_url') || cachedOAuth.profiles.linkedin_url,
        }

        // ── CAPTURER github_data DEPUIS URL ──
        const rawGithubData = params.get('github_data')
        let parsedGithubData = null
        if (rawGithubData) {
            try {
                parsedGithubData = JSON.parse(decodeURIComponent(rawGithubData))
            } catch {
                parsedGithubData = null
            }
        }

        const merged: FormDataState = {
            ...DEFAULT_FORM, ...cached,
            full_name:    params.get('full_name')    || cached.full_name    || '',
            email:        params.get('email')        || cached.email        || '',
            github_url:   params.get('github_url')   || cached.github_url   || '',
            linkedin_url: params.get('linkedin_url') || cached.linkedin_url || '',
            cv_file: null, cover_letter_file: null,
            certifications: formData.certifications,
            recommendation_letters: formData.recommendation_letters,
            github_data: null,  // ← AJOUTER CETTE LIGNE
        }
        setOauthStatus(newStatus)
        setVerifiedProfiles(newProfiles)
        setFormData(merged)

        // ── SAUVEGARDER github_data DANS LE CACHE ──
        if (parsedGithubData) {
            try {
                localStorage.setItem(`github_data_${jobId}`, JSON.stringify(parsedGithubData))
            } catch { /* ignore */ }
        }

        saveFormCache(jobId, merged)
        saveOAuthCache(jobId, newStatus, newProfiles)
        toast({ title: 'Profil vérifié ✓', description: 'Informations récupérées et sauvegardées.' })
        window.history.replaceState({}, '', window.location.pathname)
    }, [])

    // Load job
    useEffect(() => {
        ;(async () => {
            if (!jobId) { navigate('/'); return }
            try {
                const res = await api.get(`/recruitment/jobs/${jobId}/`)
                setJobTitle(res.data.title)
            } catch {
                toast({ title: 'Erreur', description: 'Offre introuvable', variant: 'destructive' })
                navigate('/')
            } finally { setLoading(false) }
        })()
    }, [jobId, navigate, toast])

    const set = (k: keyof FormDataState, v: unknown) =>
        setFormData(p => ({ ...p, [k]: v }))

    const connectLinkedIn = () => {
        setOauthStatus(p => ({ ...p, linkedin: 'loading' }))
        window.location.href = `http://localhost:8888/api/recruitment/auth/linkedin/?job_id=${jobId}`
    }
    const connectGitHub = () => {
        setOauthStatus(p => ({ ...p, github: 'loading' }))
        window.location.href = `http://localhost:8888/api/recruitment/auth/github/?job_id=${jobId}`
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // ── 1. Validation ──
        if (!emailVerified) {
            toast({ title: 'Email non vérifié', description: 'Vérifiez votre email avant de soumettre', variant: 'destructive' })
            return
        }
        if (!formData.cv_file) {
            toast({ title: 'CV manquant', description: 'Le CV (PDF) est obligatoire', variant: 'destructive' })
            return
        }

        // ── 2. reCAPTCHA ──
        if (!executeRecaptcha) {
            toast({ title: 'Erreur', description: 'reCAPTCHA non chargé', variant: 'destructive' })
            return
        }
        const recaptchaToken = await executeRecaptcha('submit_application')

        try {
            setSubmitting(true)

            // ── 3. UN SEUL FormData avec TOUT dedans ──
            const data = new FormData()

            // reCAPTCHA en premier
            data.append('recaptcha_token', recaptchaToken)

            // Champs obligatoires
            data.append('job_offer', jobId)
            data.append('full_name', formData.full_name.trim())
            data.append('email', formData.email.trim())
            data.append('phone', formData.phone.trim())
            data.append('cv_file', formData.cv_file)
            data.append('linkedin_verified', oauthStatus.linkedin === 'verified' ? 'true' : 'false')
            data.append('github_verified', oauthStatus.github === 'verified' ? 'true' : 'false')
            data.append('email_verified_token', emailVerifiedToken)

            // Champs optionnels
            if (formData.cover_letter_file) data.append('cover_letter_file', formData.cover_letter_file)
            if (formData.nationality?.trim()) data.append('nationality', formData.nationality.trim())
            if (formData.university?.trim()) data.append('university', formData.university.trim())
            if (formData.degree_level?.trim()) data.append('degree_level', formData.degree_level.trim())
            if (formData.graduation_year?.trim()) data.append('graduation_year', formData.graduation_year.trim())
            if (formData.current_position?.trim()) data.append('current_position', formData.current_position.trim())
            if (formData.experience_years?.trim()) data.append('experience_years', formData.experience_years.trim())
            if (formData.linkedin_url?.trim()) data.append('linkedin_url', formData.linkedin_url.trim())
            if (formData.github_url?.trim()) data.append('github_url', formData.github_url.trim())
            if (formData.current_location?.trim()) data.append('current_location', formData.current_location.trim())
            if (formData.salary_expectation?.trim()) data.append('salary_expectation', formData.salary_expectation.trim())
            if (formData.availability_date?.trim()) data.append('availability_date', formData.availability_date.trim())

            // Liens professionnels
            data.append('professional_links', JSON.stringify(formData.professional_links))

            // Certifications
            data.append('certifications', JSON.stringify(
                formData.certifications.map(cert => ({
                    name: cert.name,
                    issuing_organization: cert.issuing_organization,
                    credential_url: cert.credential_url,
                }))
            ))
            formData.certifications.forEach((cert, index) => {
                if (cert.file) data.append(`cert_file_${index}`, cert.file)
            })

            // Lettres de recommandation
            data.append('recommendation_letters', JSON.stringify(
                formData.recommendation_letters.map(rec => ({
                    recommender_name: rec.recommender_name,
                    recommender_position: rec.recommender_position,
                    recommender_company: rec.recommender_company,
                    relationship: rec.relationship,
                }))
            ))
            formData.recommendation_letters.forEach((rec, index) => {
                if (rec.file) data.append(`rec_file_${index}`, rec.file)
            })

            // GitHub data
            const storedGithubData = localStorage.getItem(`github_data_${jobId}`)
            const githubDataToSend = storedGithubData
                || (formData.github_data ? JSON.stringify(formData.github_data) : null)
            data.append('github_data', githubDataToSend || '{}')

            // ── 4. UN SEUL envoi ──
            console.log("SUBMIT START")
            const res = await api.post('/recruitment/applications/', data, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })
            console.log("RESPONSE =>", res.data)
            if (res.data.status === 'pending_email_verification') {
                setSubmitted(true)
                setAiAnalysis({
                    status: 'pending',
                    message: `Un email de confirmation a été envoyé à ${res.data.email}. Cliquez sur le lien pour lancer l'analyse de votre CV.`,
                    next_steps: 'Vérifiez votre boîte mail (et vos spams).'
                })
            }

            const ai = res.data.ai_analysis || {}
            setAiAnalysis({
                status:            ai.status || 'completed',
                score:             ai.score,
                cv_score:          ai.cv_score,
                motivation_score:  ai.motivation_score,
                github_score:      ai.github_score,
                github_relevance:  ai.github_relevance,
                coherence_score:   ai.coherence_score,
                coherence_flags:   ai.coherence_flags || [],
                breakdown:         ai.breakdown || {},
                message:           ai.candidate_message || ai.message || 'Analyse effectuée.',
                next_steps:        ai.next_steps || 'Vous recevrez un email sous 48h.',
            })
            clearAllCache(jobId)
            setSubmitted(true)
            toast({ title: 'Candidature envoyée !', description: 'Vérifiez votre email pour confirmer.' })

        } catch (err: unknown) {
            type E = { response?: { data?: Record<string, string | string[]> & { message?: string; detail?: string } } }
            const axiosErr = err as E
            let msg = "Une erreur est survenue"
            if (axiosErr.response?.data) {
                const d = axiosErr.response.data
                msg = d.message || d.detail
                    || Object.entries(d).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n')
                    || msg
            }
            toast({ title: 'Erreur', description: msg, variant: 'destructive' })
        } finally {
            setSubmitting(false)
        }
    }
    const handleReset = () => {
        clearAllCache(jobId)
        setSubmitted(false); setAiAnalysis(null)
        setOauthStatus({ linkedin: 'idle', github: 'idle' })
        setVerifiedProfiles({ linkedin_url: '', github_url: '' })
        setFormData(DEFAULT_FORM)
    }

    // ── Vue succès ────────────────────────────────────────────────────────────

    if (submitted && aiAnalysis) {
        const score      = aiAnalysis.score ?? 0
        const scoreColor = score >= 80 ? '#10b981' : score >= 58 ? '#6366f1' : '#f59e0b'
        const hasBreakdown = aiAnalysis.breakdown && Object.keys(aiAnalysis.breakdown).length > 0
        const hasFlags     = aiAnalysis.coherence_flags && aiAnalysis.coherence_flags.length > 0
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
                                            <circle cx="64" cy="64" r="54"
                                                    stroke={scoreColor} strokeWidth="10" fill="none"
                                                    strokeDasharray={`${score * 3.39} 339`}
                                                    strokeLinecap="round"
                                                    style={{ transition: 'stroke-dasharray 1.2s ease' }} />
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
                                        {score >= 80
                                            ? <><TrendingUp className="w-4 h-4" /> Profil excellent</>
                                            : score >= 58
                                                ? <><FileText className="w-4 h-4" /> Profil prometteur</>
                                                : <><AlertCircle className="w-4 h-4" /> À examiner</>}
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
                                        <ScoreBar label="CV & compétences"   value={aiAnalysis.cv_score}        color="bg-indigo-500" />
                                        <ScoreBar label="Lettre motivation"  value={aiAnalysis.motivation_score} color="bg-sky-500" />
                                        <ScoreBar label="Soft skills"        value={aiAnalysis.breakdown?.softskills_score} color="bg-teal-500" />
                                        <ScoreBar label="GitHub"             value={aiAnalysis.github_score}    color="bg-violet-500" />
                                        <ScoreBar label="Cohérence dossier"  value={aiAnalysis.coherence_score} color="bg-emerald-500" />
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

                                {/* Alertes de cohérence (flags) */}
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
                                            <strong>Score indicatif</strong> — Cette estimation ne constitue pas une décision finale.
                                            Notre équipe RH examinera votre dossier dans son ensemble.
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
                                onClick={handleReset}
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

    // ── Loading ───────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        )
    }

    // ── Formulaire ────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-slate-50">
            <Header />
            <main className="max-w-2xl mx-auto px-4 py-8">

                {/* Retour */}
                <button
                    onClick={() => navigate(`/jobs/${jobId}`)}
                    className="inline-flex items-center gap-2 text-slate-500 text-sm font-medium
                               px-4 py-2 rounded-xl border border-slate-200 bg-white
                               hover:text-indigo-600 hover:border-indigo-200 transition-all mb-5"
                >
                    <ArrowLeft className="w-4 h-4" /> Retour à l'offre
                </button>

                {/* Hero banner */}
                <div className="relative overflow-hidden rounded-2xl bg-[#0c1222] mb-5 p-6">
                    <div className="absolute -top-10 -right-10 w-40 h-40
                                    bg-indigo-600/20 rounded-full blur-[60px] pointer-events-none" />
                    <div
                        className="absolute inset-0 opacity-[0.04] pointer-events-none"
                        style={{
                            backgroundImage: `
                                linear-gradient(rgba(99,102,241,1) 1px, transparent 1px),
                                linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)`,
                            backgroundSize: '32px 32px',
                        }}
                    />
                    <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap">
                        <div>
                            <div className="text-[17px] font-extrabold text-white mb-1">
                                Candidature — {jobTitle}
                            </div>
                            <div className="text-xs text-slate-500">
                                Les champs <span className="text-indigo-400">★</span> sont obligatoires
                            </div>
                        </div>
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full shrink-0
                                        bg-indigo-500/10 border border-indigo-500/25">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="text-xs text-indigo-300 font-semibold">Analyse IA automatique</span>
                        </div>
                    </div>
                </div>

                {/* Form card */}
                <div className="bg-white border border-slate-200 rounded-2xl p-7">

                    {/* Alert IA */}
                    <div className="flex gap-3 bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6">
                        <Sparkles className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-slate-700">
                            <strong>Analyse IA instantanée</strong> — Votre CV, lettre et profil GitHub
                            sont analysés en ~30 secondes pour évaluer l'adéquation avec le poste.
                            Le score obtenu est indicatif.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8">

                        {/* ─ 1. Informations personnelles ─ */}
                        <div>
                            <SectionHeader
                                icon={User}
                                gradient="from-indigo-500 to-indigo-600"
                                title="Informations personnelles"
                                subtitle="Identité et coordonnées"
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Field label="Nom complet" required>
                                    <Input value={formData.full_name}
                                           onChange={e => set('full_name', e.target.value)}
                                           placeholder="Mayssa Ben Romdhane" required
                                           className="h-10 rounded-xl border-slate-200 bg-slate-50
                                                      focus:bg-white focus:border-indigo-400 focus:ring-indigo-400/20" />
                                </Field>
                                <Field label="Email" required>
                                    <div className="space-y-2">
                                        <div className="flex gap-2">
                                            <Input
                                                type="email"
                                                value={formData.email}
                                                onChange={e => { set('email', e.target.value); setEmailVerified(false); setOtpSent(false) }}
                                                placeholder="Mayssan@example.com"
                                                disabled={emailVerified}
                                                className="h-10 rounded-xl border-slate-200 bg-slate-50 flex-1"
                                                required
                                            />
                                            {!emailVerified && (
                                                <button type="button" onClick={sendOTP} disabled={otpLoading || !formData.email}
                                                        className="px-3 h-10 rounded-xl bg-indigo-600 text-white text-xs font-bold
                               hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap">
                                                    {otpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Vérifier'}
                                                </button>
                                            )}
                                            {emailVerified && (
                                                <div className="flex items-center gap-1 px-3 bg-emerald-100 rounded-xl">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                                    <span className="text-xs text-emerald-700 font-bold">Vérifié</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Saisie du code OTP */}
                                        {otpSent && !emailVerified && (
                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder="Code à 6 chiffres"
                                                    value={otpCode}
                                                    onChange={e => setOtpCode(e.target.value)}
                                                    maxLength={6}
                                                    className="h-10 rounded-xl tracking-widest text-center font-bold text-lg"
                                                />
                                                <button type="button" onClick={verifyOTP} disabled={otpLoading || otpCode.length !== 6}
                                                        className="px-3 h-10 rounded-xl bg-emerald-600 text-white text-xs font-bold
                               hover:bg-emerald-700 disabled:opacity-50">
                                                    {otpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmer'}
                                                </button>
                                                <button type="button" onClick={sendOTP} disabled={otpLoading}
                                                        className="px-3 h-10 rounded-xl border border-slate-300 text-slate-600
                               text-xs hover:bg-slate-50">
                                                    Renvoyer
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </Field>
                                <Field label="Téléphone" required>
                                    <Input type="tel" value={formData.phone}
                                           onChange={e => set('phone', e.target.value)}
                                           placeholder="+33 6 12 34 56 78" required
                                           className="h-10 rounded-xl border-slate-200 bg-slate-50
                                                      focus:bg-white focus:border-indigo-400 focus:ring-indigo-400/20" />
                                </Field>
                                <Field label="Nationalité">
                                    <Input value={formData.nationality}
                                           onChange={e => set('nationality', e.target.value)}
                                           placeholder="Ex : Française, Tunisienne…"
                                           className="h-10 rounded-xl border-slate-200 bg-slate-50
                                                      focus:bg-white focus:border-indigo-400 focus:ring-indigo-400/20" />
                                </Field>
                                <div className="md:col-span-2">
                                    <Field label="Ville actuelle">
                                        <Input value={formData.current_location}
                                               onChange={e => set('current_location', e.target.value)}
                                               placeholder="Paris, France"
                                               className="h-10 rounded-xl border-slate-200 bg-slate-50
                                                          focus:bg-white focus:border-indigo-400 focus:ring-indigo-400/20" />
                                    </Field>
                                </div>
                            </div>
                        </div>

                        {/* ─ 2. Formation & Expérience ─ */}
                        <div>
                            <SectionHeader
                                icon={GraduationCap}
                                gradient="from-violet-500 to-purple-500"
                                title="Formation & Expérience"
                                subtitle="Parcours académique et professionnel"
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Field label="Université / École">
                                    <Input value={formData.university}
                                           onChange={e => set('university', e.target.value)}
                                           placeholder="Université Paris-Saclay"
                                           className="h-10 rounded-xl border-slate-200 bg-slate-50
                                                      focus:bg-white focus:border-indigo-400 focus:ring-indigo-400/20" />
                                </Field>
                                <Field label="Diplôme">
                                    <Input value={formData.degree_level}
                                           onChange={e => set('degree_level', e.target.value)}
                                           placeholder="Master Informatique"
                                           className="h-10 rounded-xl border-slate-200 bg-slate-50
                                                      focus:bg-white focus:border-indigo-400 focus:ring-indigo-400/20" />
                                </Field>
                                <Field label="Année d'obtention">
                                    <Input type="number" value={formData.graduation_year}
                                           onChange={e => set('graduation_year', e.target.value)}
                                           placeholder="2023" min="1980" max="2030"
                                           className="h-10 rounded-xl border-slate-200 bg-slate-50
                                                      focus:bg-white focus:border-indigo-400 focus:ring-indigo-400/20" />
                                </Field>
                                <Field label="Années d'expérience" hint="Nombre exact">
                                    <Input
                                        type="number"
                                        value={formData.experience_years}
                                        onChange={e => set('experience_years', e.target.value)}
                                        placeholder="Ex : 4"
                                        min="0" max="50" step="1"
                                        className="h-10 rounded-xl border-slate-200 bg-slate-50
                                                   focus:bg-white focus:border-indigo-400 focus:ring-indigo-400/20"
                                    />
                                </Field>
                                <div className="md:col-span-2">
                                    <Field label="Poste actuel" hint="Titre de votre poste actuel ou dernier poste occupé">
                                        <div className="relative">
                                            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <Input
                                                value={formData.current_position}
                                                onChange={e => set('current_position', e.target.value)}
                                                placeholder="Ex : Développeur fullstack chez Acme"
                                                className="h-10 pl-9 rounded-xl border-slate-200 bg-slate-50
                                                           focus:bg-white focus:border-indigo-400 focus:ring-indigo-400/20"
                                            />
                                        </div>
                                    </Field>
                                </div>
                            </div>
                        </div>

                        {/* ─ 3. Réseaux & Vérification OAuth ─ */}
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
                                    Connectez vos comptes pour vérifier l'authenticité de vos profils.
                                    Le profil GitHub est également analysé automatiquement.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                                {/* LinkedIn */}
                                <div className={`rounded-2xl border p-4 transition-all ${
                                    oauthStatus.linkedin === 'verified'
                                        ? 'border-emerald-200 bg-emerald-50/50'
                                        : 'border-slate-200 bg-white'
                                }`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                                            <Linkedin className="w-4 h-4 text-blue-600" /> LinkedIn
                                        </div>
                                        {oauthStatus.linkedin === 'verified' && (
                                            <span className="flex items-center gap-1 text-[11px] font-bold
                                                             bg-emerald-100 text-emerald-700 border border-emerald-200
                                                             px-2 py-0.5 rounded-full">
                                                <CheckCircle2 className="w-3 h-3" /> Vérifié
                                            </span>
                                        )}
                                    </div>
                                    {oauthStatus.linkedin === 'verified' ? (
                                        <>
                                            <div className="bg-white border border-emerald-200 rounded-xl p-3">
                                                <div className="text-sm font-semibold text-emerald-700">Compte connecté</div>
                                                {verifiedProfiles.linkedin_url && (
                                                    <a href={verifiedProfiles.linkedin_url} target="_blank" rel="noopener noreferrer"
                                                       className="flex items-center gap-1 text-xs text-blue-600
                                                                  hover:underline mt-1 truncate">
                                                        <ExternalLink className="w-3 h-3 shrink-0" />
                                                        {verifiedProfiles.linkedin_url}
                                                    </a>
                                                )}
                                            </div>
                                            <button type="button"
                                                    onClick={() => {
                                                        setOauthStatus(p => ({ ...p, linkedin: 'idle' }))
                                                        setVerifiedProfiles(p => ({ ...p, linkedin_url: '' }))
                                                        set('linkedin_url', '')
                                                    }}
                                                    className="mt-2 text-xs text-slate-400 hover:text-slate-600 underline">
                                                Changer de compte
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button type="button" onClick={connectLinkedIn}
                                                    disabled={oauthStatus.linkedin === 'loading'}
                                                    className="w-full h-9 rounded-xl border border-blue-200
                                                               bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm
                                                               font-semibold flex items-center justify-center gap-2
                                                               transition-colors disabled:opacity-50">
                                                {oauthStatus.linkedin === 'loading'
                                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                                    : <Linkedin className="w-4 h-4" />}
                                                {oauthStatus.linkedin === 'loading' ? 'Redirection…' : 'Connecter LinkedIn'}
                                            </button>
                                            <div className="flex items-center gap-2 my-2">
                                                <div className="flex-1 h-px bg-slate-200" />
                                                <span className="text-xs text-slate-400">ou manuellement</span>
                                                <div className="flex-1 h-px bg-slate-200" />
                                            </div>
                                            <Input type="url" placeholder="https://linkedin.com/in/…"
                                                   value={formData.linkedin_url}
                                                   onChange={e => set('linkedin_url', e.target.value)}
                                                   className="h-9 text-sm rounded-xl border-slate-200 bg-slate-50" />
                                        </>
                                    )}
                                </div>

                                {/* GitHub */}
                                <div className={`rounded-2xl border p-4 transition-all ${
                                    oauthStatus.github === 'verified'
                                        ? 'border-emerald-200 bg-emerald-50/50'
                                        : 'border-slate-200 bg-white'
                                }`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                                            <Github className="w-4 h-4" /> GitHub
                                        </div>
                                        {oauthStatus.github === 'verified' && (
                                            <span className="flex items-center gap-1 text-[11px] font-bold
                                                             bg-emerald-100 text-emerald-700 border border-emerald-200
                                                             px-2 py-0.5 rounded-full">
                                                <CheckCircle2 className="w-3 h-3" /> Vérifié
                                            </span>
                                        )}
                                    </div>
                                    {oauthStatus.github === 'verified' ? (
                                        <>
                                            <div className="bg-white border border-emerald-200 rounded-xl p-3">
                                                <div className="text-sm font-semibold text-emerald-700">Compte connecté</div>
                                                {verifiedProfiles.github_url && (
                                                    <a href={verifiedProfiles.github_url} target="_blank" rel="noopener noreferrer"
                                                       className="flex items-center gap-1 text-xs text-slate-600
                                                                  hover:underline mt-1 truncate">
                                                        <ExternalLink className="w-3 h-3 shrink-0" />
                                                        {verifiedProfiles.github_url}
                                                    </a>
                                                )}
                                            </div>
                                            <button type="button"
                                                    onClick={() => {
                                                        setOauthStatus(p => ({ ...p, github: 'idle' }))
                                                        setVerifiedProfiles(p => ({ ...p, github_url: '' }))
                                                        set('github_url', '')
                                                    }}
                                                    className="mt-2 text-xs text-slate-400 hover:text-slate-600 underline">
                                                Changer de compte
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button type="button" onClick={connectGitHub}
                                                    disabled={oauthStatus.github === 'loading'}
                                                    className="w-full h-9 rounded-xl border border-slate-300
                                                               bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm
                                                               font-semibold flex items-center justify-center gap-2
                                                               transition-colors disabled:opacity-50">
                                                {oauthStatus.github === 'loading'
                                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                                    : <Github className="w-4 h-4" />}
                                                {oauthStatus.github === 'loading' ? 'Redirection…' : 'Connecter GitHub'}
                                            </button>
                                            <div className="flex items-center gap-2 my-2">
                                                <div className="flex-1 h-px bg-slate-200" />
                                                <span className="text-xs text-slate-400">ou manuellement</span>
                                                <div className="flex-1 h-px bg-slate-200" />
                                            </div>
                                            <Input type="url" placeholder="https://github.com/…"
                                                   value={formData.github_url}
                                                   onChange={e => set('github_url', e.target.value)}
                                                   className="h-9 text-sm rounded-xl border-slate-200 bg-slate-50" />
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Status global */}
                            <div className="flex gap-2 mt-3">
                                {(['linkedin', 'github'] as const).map(platform => (
                                    <span key={platform}
                                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full
                                                       text-xs font-semibold ${
                                              oauthStatus[platform] === 'verified'
                                                  ? 'bg-emerald-100 text-emerald-700'
                                                  : 'bg-slate-100 text-slate-400'
                                          }`}>
                                        {platform === 'linkedin'
                                            ? <Linkedin className="w-3 h-3" />
                                            : <Github className="w-3 h-3" />}
                                        {platform === 'linkedin' ? 'LinkedIn' : 'GitHub'}{' '}
                                        {oauthStatus[platform] === 'verified' ? 'vérifié' : 'non vérifié'}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* ─ 4. Documents & Disponibilité ─ */}
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
                                    onChange={f => set('cv_file', f)}
                                    label="CV (PDF)"
                                    accept=".pdf"
                                    maxMb={5}
                                    required
                                />
                                <FileZone
                                    file={formData.cover_letter_file}
                                    onChange={f => set('cover_letter_file', f)}
                                    label="Lettre de motivation"
                                    accept=".pdf"
                                    maxMb={3}
                                />
                            </div>
                        </div>

                        {/* ─ 5. Certifications ── NOUVEAU ────────────────────────────── */}
                        <div className="pt-6 border-t border-slate-100">
                            <SectionHeader
                                icon={Award}
                                gradient="from-emerald-500 to-teal-500"
                                title="Certifications"
                                subtitle="Ajoutez vos certificats et diplômes . "
                            />
                            <CertificationUploader
                                certifications={formData.certifications}
                                onChange={(certs) => set('certifications', certs)}
                            />
                        </div>

                        {/* ─ 6. Sites professionnels ──────────────────────────────────── */}
                        <div className="pt-6 border-t border-slate-100">
                            <SectionHeader
                                icon={ExternalLink}
                                gradient="from-cyan-500 to-blue-500"
                                title="Sites professionnels"
                                subtitle="Portfolio, Bayt, Indeed..."
                            />
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <Label className="text-xs font-bold text-slate-500 uppercase">Liens</Label>
                                    <button
                                        type="button"
                                        onClick={() => set('professional_links', [...formData.professional_links, { platform: '', url: '' }])}
                                        className="text-xs text-indigo-600 font-bold hover:underline"
                                    >
                                        + Ajouter un site
                                    </button>
                                </div>

                                {formData.professional_links.map((link, index) => (
                                    <div key={index} className="flex gap-2">
                                        <Input
                                            placeholder="Ex: Bayt, Indeed..."
                                            value={link.platform}
                                            onChange={(e) => {
                                                const next = [...formData.professional_links];
                                                next[index].platform = e.target.value;
                                                set('professional_links', next);
                                            }}
                                            className="w-1/3 bg-slate-50"
                                        />
                                        <Input
                                            placeholder="https://..."
                                            value={link.url}
                                            onChange={(e) => {
                                                const next = [...formData.professional_links];
                                                next[index].url = e.target.value;
                                                set('professional_links', next);
                                            }}
                                            className="flex-1 bg-slate-50"
                                        />
                                        {formData.professional_links.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const next = formData.professional_links.filter((_, i) => i !== index);
                                                    set('professional_links', next);
                                                }}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ─ 7. Lettres de recommandation ── NOUVEAU ──────────────── */}
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

                        {/* ─ 8. Salaire & Disponibilité ─────────────────────────────── */}
                        <div className="pt-6 border-t border-slate-100">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Field label="Prétention salariale (€/mois)">
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <Input type="number" placeholder="Ex : 3 500"
                                               value={formData.salary_expectation}
                                               onChange={e => set('salary_expectation', e.target.value)}
                                               min="0" step="100"
                                               className="h-10 pl-9 rounded-xl border-slate-200 bg-slate-50
                                                          focus:bg-white focus:border-indigo-400" />
                                    </div>
                                </Field>
                                <Field label="Date de disponibilité">
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <Input type="date" value={formData.availability_date}
                                               onChange={e => set('availability_date', e.target.value)}
                                               className="h-10 pl-9 rounded-xl border-slate-200 bg-slate-50
                                                          focus:bg-white focus:border-indigo-400" />
                                    </div>
                                </Field>
                            </div>
                        </div>

                        {/* Submit */}
                        <div className="flex gap-3 pt-2 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => navigate(-1)}
                                className="flex-1 h-12 border border-slate-200 rounded-xl text-sm
                                           font-semibold text-slate-600 bg-white hover:bg-slate-50 transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="flex-[2] h-12 rounded-xl border-none text-sm font-bold
                                           text-white bg-gradient-to-r from-indigo-600 to-sky-500
                                           hover:from-indigo-700 hover:to-sky-600 transition-all duration-200
                                           flex items-center justify-center gap-2
                                           shadow-lg shadow-indigo-500/30 hover:shadow-xl
                                           hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed
                                           disabled:hover:translate-y-0"
                            >
                                {submitting ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Analyse en cours…</>
                                ) : (
                                    <><Sparkles className="w-4 h-4" /> Envoyer ma candidature</>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    )
}
