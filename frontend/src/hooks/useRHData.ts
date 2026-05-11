import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import { useToast } from './use-toast'

export type AIDecision = 'VALIDATED' | 'TO_REVIEW' | 'REJECTED' | 'PENDING'

export interface JobOffer {
    id: number
    title: string
    description: string
    requirements: string
    soft_skills?: string          // ← ajouter
    experience_years?: number     // ← ajouter
    education_level?: string      // ← ajouter
    created_at: string
    applications_count?: number
    location?: string
    contract_type?: string
    department?: string
    weight_cv?: number
    weight_motivation?: number
    weight_softskills?: number
    weight_github?: number
    offer_deadline?: string
}

export interface Application {
    applied_date: string | null | undefined;
    id: number
    full_name: string
    email: string
    phone: string
    job_offer_title: string
    status: 'pending' | 'interview_scheduled' | 'rejected' | 'accepted'| 'hired'
    created_at: string
    cv_file: string
    cover_letter_file: string
    ai_score: number
    ai_decision?: AIDecision
    ai_strengths?: string[]
    ai_weaknesses?: string[]
    ai_missing_skills?: string[]
    ai_candidate_message?: string
    ai_next_steps?: string
    professional_stability?: string
}

export interface AIAnalytics {
    topSkills: string[]
    missingSkillsTrends: string[]
    topStrengths?: string[]
    topWeaknesses?: string[]
    averageScore?: number
    totalAnalyzed?: number
}

// ✅ Une seule définition avec les poids
export interface NewJobForm {
    title: string
    description: string
    requirements: string
    experience_years: string
    education_level: string
    soft_skills: string
    location: string
    contract_type: string
    weight_cv: string
    weight_motivation: string
    weight_softskills: string
    weight_github: string
    offer_deadline: string        // date
    agents_needed: string         // number
    interview_type: 'RH' | 'AI',

}


export interface WeightsConfig {
    cv: number
    motivation: number
    softskills: number
    github: number
}

export const AI_DECISIONS = ['VALIDATED', 'TO_REVIEW', 'REJECTED', 'PENDING'] as const

export function toAIDecision(val: string | undefined | null): AIDecision {
    if (val && AI_DECISIONS.includes(val as AIDecision)) {
        return val as AIDecision
    }
    return 'PENDING'
}

interface RawApplication extends Omit<Application, 'ai_score' | 'cv_file' | 'cover_letter_file'> {
    ai_score?: number | boolean | null
    cv_file?: string | null
    cover_letter_file?: string | null
}

function normalizeAIScore(score: number | boolean | null | undefined): number {
    if (typeof score === 'boolean') return score ? 100 : 0
    if (typeof score === 'number') return Math.min(100, Math.max(0, score))
    return 0
}

export function useRHData() {
    const { toast } = useToast()

    const [jobs, setJobs] = useState<JobOffer[]>([])
    const [applications, setApplications] = useState<Application[]>([])
    const [loadingJobs, setLoadingJobs] = useState(false)
    const [loadingApps, setLoadingApps] = useState(false)

    const fetchJobs = useCallback(async () => {
        try {
            setLoadingJobs(true)
            const response = await api.get('/recruitment/rh/jobs/')
            setJobs(response.data)
        } catch {
            toast({
                title: 'Erreur',
                description: 'Erreur lors du chargement des offres',
                variant: 'destructive',
            })
        } finally {
            setLoadingJobs(false)
        }
    }, [toast])

    const fetchApplications = useCallback(async () => {
        try {
            setLoadingApps(true)
            const response = await api.get('/recruitment/rh/applications/')

            const normalized: Application[] = (response.data as RawApplication[]).map((app) => ({
                ...app,
                cv_file: app.cv_file ?? '',
                cover_letter_file: app.cover_letter_file ?? '',
                ai_score: normalizeAIScore(app.ai_score),
                ai_decision: toAIDecision(app.ai_decision),
                ai_strengths: app.ai_strengths || [],
                ai_weaknesses: app.ai_weaknesses || [],
                ai_missing_skills: app.ai_missing_skills || [],
                ai_candidate_message: app.ai_candidate_message || '',
                ai_next_steps: app.ai_next_steps || '',
            }))

            setApplications(normalized)
        } catch {
            toast({
                title: 'Erreur',
                description: 'Erreur lors du chargement des candidatures',
                variant: 'destructive',
            })
        } finally {
            setLoadingApps(false)
        }
    }, [toast])

    const updateJobWeights = useCallback(async (jobId: number, weights: WeightsConfig) => {
        try {
            await api.post(`/recruitment/jobs/${jobId}/update_weights/`, { weights })
            await fetchJobs()
            toast({ title: 'Succès', description: 'Poids mis à jour avec succès' })
            return true
        } catch {
            toast({
                title: 'Erreur',
                description: 'Impossible de mettre à jour les poids',
                variant: 'destructive',
            })
            return false
        }
    }, [toast, fetchJobs])

    useEffect(() => {
        fetchJobs()
        fetchApplications()
    }, [fetchJobs, fetchApplications])

    return {
        jobs,
        applications,
        loadingJobs,
        loadingApps,
        addJob: (job: JobOffer) => setJobs(prev => [...prev, job]),
        removeJob: (jobId: number) => setJobs(prev => prev.filter(job => job.id !== jobId)),
        refetchJobs: fetchJobs,
        refetchApplications: fetchApplications,
        updateJobWeights,
    }
}