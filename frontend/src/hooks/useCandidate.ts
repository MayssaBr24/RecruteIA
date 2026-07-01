
import { useState, useCallback } from 'react'
import api from '../lib/api'
import { useToast } from './use-toast'

export interface InterviewInvitation {
    id: number
    application: number
    candidate_name: string
    candidate_email: string
    candidate_phone: string
    job_title: string
    interviewer_name: string
    interview_date: string
    interview_time: string
    meeting_link: string
    status: 'pending' | 'sent' | 'accepted' | 'declined' | 'cancelled'
    sent_at: string | null
    created_at: string
}

export interface ApplicationDetail {
    id: number
    full_name: string
    email: string
    phone: string
    nationality: string
    university: string
    degree_level: string
    graduation_year: number | null
    experience_years: number
    linkedin_url: string
    github_url: string
    current_location: string
    salary_expectation: number | null
    availability_date: string | null
    cv_file: string
    cover_letter_file: string | null
    applied_date: string
    status: string
    ai_score: number
    ai_summary: string
    ai_decision: string
    ai_missing_skills: string[]
    ai_strengths: string[]
    ai_weaknesses: string[]
    ai_recommendations: string
    job_offer_title: string
    job_offer_description: string
    ai_interview: {
        id: number
        communication_score: number
        clarification_score: number
        qcm_score: number
        coding_score: number
        ai_interview_score: number
        ai_interview_feedback: string
        video_recording: string | null
        duration_minutes: number
        status: string
    } | null
    interview_invitations: InterviewInvitation[]
}

export function useCandidate() {
    const [loading, setLoading] = useState(false)
    const [candidate, setCandidate] = useState<ApplicationDetail | null>(null)
    const { toast } = useToast()

    // Récupérer les détails d'un candidat
    const fetchCandidate = useCallback(async (applicationId: number) => {
        setLoading(true)
        try {
            const response = await api.get(`/rh/candidates/${applicationId}/`)
            setCandidate(response.data)
            return response.data
        } catch (error: any) {
            console.error('Erreur chargement candidat:', error)
            toast({
                title: 'Erreur',
                description: error.response?.data?.error || 'Impossible de charger les détails du candidat',
                variant: 'destructive'
            })
            throw error
        } finally {
            setLoading(false)
        }
    }, [toast])

    // Créer une invitation
    const createInvitation = useCallback(async (applicationId: number, data: {
        interview_date: string
        interview_time: string
        meeting_link: string
        interviewer_name: string
    }) => {
        setLoading(true)
        try {
            const response = await api.post(`/rh/candidates/${applicationId}/invitations/create/`, data)
            toast({
                title: 'Invitation créée',
                description: "L'invitation a été créée avec succès",
            })
            return response.data
        } catch (error: any) {
            console.error('Erreur création invitation:', error)
            toast({
                title: 'Erreur',
                description: error.response?.data?.error || "Impossible de créer l'invitation",
                variant: 'destructive'
            })
            throw error
        } finally {
            setLoading(false)
        }
    }, [toast])

    // Envoyer une invitation par email
    const sendInvitation = useCallback(async (invitationId: number) => {
        setLoading(true)
        try {
            const response = await api.post('/rh/invitations/send/', { invitation_id: invitationId })
            toast({
                title: 'Invitation envoyée',
                description: "L'invitation a été envoyée par email au candidat",
            })
            return response.data
        } catch (error: any) {
            console.error('Erreur envoi invitation:', error)
            toast({
                title: 'Erreur',
                description: error.response?.data?.error || "Impossible d'envoyer l'invitation",
                variant: 'destructive'
            })
            throw error
        } finally {
            setLoading(false)
        }
    }, [toast])

    // Récupérer les invitations d'un candidat
    const fetchInvitations = useCallback(async (applicationId: number) => {
        setLoading(true)
        try {
            const response = await api.get(`/rh/candidates/${applicationId}/invitations/`)
            return response.data
        } catch (error: any) {
            console.error('Erreur chargement invitations:', error)
            toast({
                title: 'Erreur',
                description: error.response?.data?.error || "Impossible de charger les invitations",
                variant: 'destructive'
            })
            throw error
        } finally {
            setLoading(false)
        }
    }, [toast])

    return {
        loading,
        candidate,
        fetchCandidate,
        createInvitation,
        sendInvitation,
        fetchInvitations,
    }
}