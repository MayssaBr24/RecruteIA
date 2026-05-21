// ─────────────────────────────────────────────────────────────────────────────
//  Logique de soumission du formulaire
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3'
import { useToast } from '../../hooks/use-toast'
import {AIAnalysisResult, ApiErrorResponse, AxiosLikeError, FormDataState, OAuthStatus} from "../types/types.ts";
import api from "../api/api.ts";
import {clearAllCache, GITHUB_DATA_KEY} from "../types/constants.ts";

interface SubmitParams {
    jobId: string
    formData: FormDataState
    oauthStatus: OAuthStatus
    emailVerifiedToken: string
    emailVerified: boolean
}

interface SubmitResult {
    submitting: boolean
    submitted: boolean
    aiAnalysis: AIAnalysisResult | null
    handleSubmit: (params: SubmitParams) => (e: React.FormEvent) => Promise<void>
    resetSubmission: () => void
}

// Réponse brute de l'API
interface ApplicationApiResponse {
    status?: string
    email?: string
    ai_analysis?: {
        status?: 'completed' | 'pending' | 'error'
        score?: number
        cv_score?: number
        motivation_score?: number
        github_score?: number
        github_relevance?: number
        coherence_score?: number
        coherence_flags?: string[]
        breakdown?: AIAnalysisResult['breakdown']
        candidate_message?: string
        message?: string
        next_steps?: string
    }
}

export function useApplicationForm(): SubmitResult {
    const { toast }          = useToast()
    const { executeRecaptcha } = useGoogleReCaptcha()

    const [submitting,  setSubmitting]  = useState(false)
    const [submitted,   setSubmitted]   = useState(false)
    const [aiAnalysis,  setAiAnalysis]  = useState<AIAnalysisResult | null>(null)

    const resetSubmission = () => {
        setSubmitted(false)
        setAiAnalysis(null)
    }

    const handleSubmit =
        ({ jobId, formData, oauthStatus, emailVerifiedToken, emailVerified }: SubmitParams) =>
            async (e: React.FormEvent) => {
                e.preventDefault()

                // ── Validation ───────────────────────────────────────────────────────────
                if (!emailVerified) {
                    toast({
                        title: 'Email non vérifié',
                        description: 'Vérifiez votre email avant de soumettre',
                        variant: 'destructive',
                    })
                    return
                }
                if (!formData.cv_file) {
                    toast({
                        title: 'CV manquant',
                        description: 'Le CV (PDF) est obligatoire',
                        variant: 'destructive',
                    })
                    return
                }

                // ── reCAPTCHA ────────────────────────────────────────────────────────────
                if (!executeRecaptcha) {
                    toast({ title: 'Erreur', description: 'reCAPTCHA non chargé', variant: 'destructive' })
                    return
                }
                const recaptchaToken = await executeRecaptcha('submit_application')

                try {
                    setSubmitting(true)

                    const data = buildFormData({
                        jobId,
                        formData,
                        oauthStatus,
                        emailVerifiedToken,
                        recaptchaToken,
                    })

                    const res = await api.post('/applications/', data, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                    })

                    const body = res.data as ApplicationApiResponse

                    // Cas email à confirmer
                    if (body.status === 'pending_email_verification') {
                        setSubmitted(true)
                        setAiAnalysis({
                            status: 'pending',
                            message: `Un email de confirmation a été envoyé à ${body.email ?? ''}. Cliquez sur le lien pour lancer l'analyse de votre CV.`,
                            next_steps: 'Vérifiez votre boîte mail (et vos spams).',
                        })
                        clearAllCache(jobId)
                        return
                    }

                    const ai = body.ai_analysis ?? {}
                    setAiAnalysis({
                        status:           ai.status            ?? 'completed',
                        score:            ai.score,
                        cv_score:         ai.cv_score,
                        motivation_score: ai.motivation_score,
                        github_score:     ai.github_score,
                        github_relevance: ai.github_relevance,
                        coherence_score:  ai.coherence_score,
                        coherence_flags:  ai.coherence_flags   ?? [],
                        breakdown:        ai.breakdown,
                        message:          ai.candidate_message ?? ai.message ?? 'Analyse effectuée.',
                        next_steps:       ai.next_steps        ?? 'Vous recevrez un email sous 48h.',
                    })

                    clearAllCache(jobId)
                    setSubmitted(true)
                    toast({ title: 'Candidature envoyée !', description: 'Vérifiez votre email pour confirmer.' })

                } catch (err: unknown) {
                    toast({ title: 'Erreur', description: formatApiError(err), variant: 'destructive' })
                } finally {
                    setSubmitting(false)
                }
            }

    return { submitting, submitted, aiAnalysis, handleSubmit, resetSubmission }
}

// ── Helpers privés ────────────────────────────────────────────────────────────

interface BuildFormDataParams {
    jobId: string
    formData: FormDataState
    oauthStatus: OAuthStatus
    emailVerifiedToken: string
    recaptchaToken: string
}

function buildFormData({
                           jobId,
                           formData,
                           oauthStatus,
                           emailVerifiedToken,
                           recaptchaToken,
                       }: BuildFormDataParams): FormData {
    const data = new FormData()

    data.append('recaptcha_token', recaptchaToken)
    data.append('job_offer',         jobId)
    data.append('full_name',         formData.full_name.trim())
    data.append('email',             formData.email.trim())
    data.append('phone',             formData.phone.trim())
    data.append('cv_file',           formData.cv_file!)
    data.append('linkedin_verified', oauthStatus.linkedin === 'verified' ? 'true' : 'false')
    data.append('github_verified',   oauthStatus.github   === 'verified' ? 'true' : 'false')
    data.append('email_verified_token', emailVerifiedToken)

    if (formData.cover_letter_file)           data.append('cover_letter_file',  formData.cover_letter_file)
    if (formData.nationality?.trim())         data.append('nationality',        formData.nationality.trim())
    if (formData.university?.trim())          data.append('university',         formData.university.trim())
    if (formData.degree_level?.trim())        data.append('degree_level',       formData.degree_level.trim())
    if (formData.graduation_year?.trim())     data.append('graduation_year',    formData.graduation_year.trim())
    if (formData.current_position?.trim())    data.append('current_position',   formData.current_position.trim())
    if (formData.experience_years?.trim())    data.append('experience_years',   formData.experience_years.trim())
    if (formData.linkedin_url?.trim())        data.append('linkedin_url',       formData.linkedin_url.trim())
    if (formData.github_url?.trim())          data.append('github_url',         formData.github_url.trim())
    if (formData.current_location?.trim())    data.append('current_location',   formData.current_location.trim())
    if (formData.salary_expectation?.trim())  data.append('salary_expectation', formData.salary_expectation.trim())
    if (formData.availability_date?.trim())   data.append('availability_date',  formData.availability_date.trim())

    data.append('professional_links', JSON.stringify(formData.professional_links))

    data.append(
        'certifications',
        JSON.stringify(
            formData.certifications.map((c) => ({
                name: c.name,
                issuing_organization: c.issuing_organization,
                credential_url: c.credential_url,
            })),
        ),
    )
    formData.certifications.forEach((cert, i) => {
        if (cert.file) data.append(`cert_file_${i}`, cert.file)
    })

    data.append(
        'recommendation_letters',
        JSON.stringify(
            formData.recommendation_letters.map((r) => ({
                recommender_name:     r.recommender_name,
                recommender_position: r.recommender_position,
                recommender_company:  r.recommender_company,
                relationship:         r.relationship,
            })),
        ),
    )
    formData.recommendation_letters.forEach((rec, i) => {
        if (rec.file) data.append(`rec_file_${i}`, rec.file)
    })

    const storedGithub = localStorage.getItem(GITHUB_DATA_KEY(jobId))
    const githubToSend = storedGithub
        ?? (formData.github_data ? JSON.stringify(formData.github_data) : null)
    data.append('github_data', githubToSend ?? '{}')

    return data
}

function formatApiError(err: unknown): string {
    const fallback = 'Une erreur est survenue'
    if (typeof err !== 'object' || err === null) return fallback

    const shaped = err as AxiosLikeError
    const d = shaped.response?.data
    if (!d) return fallback

    if (d.message) return d.message
    if (d.detail)  return d.detail

    return (
        Object.entries(d as ApiErrorResponse)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v ?? '')}`)
            .join('\n') || fallback
    )
}
