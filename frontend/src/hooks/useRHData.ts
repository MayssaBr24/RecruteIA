// hooks/useRHData.ts
import { useState, useEffect } from 'react'
import api from '../lib/api'
import { useToast } from './use-toast'

export interface JobOffer {
    id: number
    title: string
    description: string
    skills_required: string
    created_at: string
    applications_count?: number
}

export interface Application {
    id: number
    full_name: string
    email: string
    phone: string
    job_offer_title: string
    created_at: string
    cv_file?: string
    cover_letter_file?: string
    status?: 'pending' | 'interview_scheduled' | 'rejected' | 'accepted'
}

export function useRHData() {
    const { toast } = useToast()
    const [jobs, setJobs] = useState<JobOffer[]>([])
    const [applications, setApplications] = useState<Application[]>([])
    const [loadingJobs, setLoadingJobs] = useState(false)
    const [loadingApps, setLoadingApps] = useState(false)

    // Load jobs
    useEffect(() => {
        const fetchJobs = async () => {
            try {
                setLoadingJobs(true)
                const response = await api.get('/recruitment/rh/jobs/')
                setJobs(response.data)
            } catch (err) {
                console.error('Erreur:', err)
                toast({
                    title: 'Erreur',
                    description: 'Erreur lors du chargement des offres',
                    variant: 'destructive',
                })
            } finally {
                setLoadingJobs(false)
            }
        }
        fetchJobs()
    }, [toast])

    // Load applications
    useEffect(() => {
        const fetchApplications = async () => {
            try {
                setLoadingApps(true)
                const response = await api.get('/recruitment/rh/applications/')
                setApplications(response.data)
            } catch (err) {
                console.error('Erreur:', err)
                toast({
                    title: 'Erreur',
                    description: 'Erreur lors du chargement des candidatures',
                    variant: 'destructive',
                })
            } finally {
                setLoadingApps(false)
            }
        }
        fetchApplications()
    }, [toast])

    const addJob = (job: JobOffer) => {
        setJobs([...jobs, job])
    }

    return {
        jobs,
        applications,
        loadingJobs,
        loadingApps,
        addJob
    }
}