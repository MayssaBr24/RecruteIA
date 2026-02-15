// hooks/useInterviewPlanning.ts
import { useState, useEffect } from 'react'
import api from '../lib/api' // Utilise ton instance api personnalisée
import { useToast } from './use-toast'

export interface Availability {
    id: number
    day_of_week?: number | null
    specific_date?: string | null
    start_time: string
    end_time: string
    is_active: boolean
}

export interface Exception {
    id: number
    date: string
}

export interface Interview {
    id: number
    application_id: number
    candidate_name: string
    candidate_email: string
    candidate_phone: string
    job_title: string
    scheduled_date: string
    scheduled_time: string
    duration_minutes: number
    meeting_link?: string
    status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
    notes?: string
}

export interface RHSettings {
    disable_weekends: boolean
    lunch_break_start: string
    lunch_break_end: string
    enable_lunch_break: boolean
    default_interview_duration: number
}

export function useInterviewPlanning() {
    const { toast } = useToast()
    const [availabilities, setAvailabilities] = useState<Availability[]>([])
    const [interviews, setInterviews] = useState<Interview[]>([])
    const [exceptions, setExceptions] = useState<Exception[]>([]) // Corrigé ici
    const [settings, setSettings] = useState<RHSettings | null>(null)
    const [loading, setLoading] = useState(false)

    // Charger les exceptions
    const fetchExceptions = async () => {
        try {
            const response = await api.get('/recruitment/rh/exceptions/')
            setExceptions(response.data)
        } catch (error) {
            console.error('Erreur exceptions:', error)
        }
    }

    // Charger les disponibilités
    const fetchAvailabilities = async () => {
        try {
            const response = await api.get('/recruitment/rh/availabilities/')
            setAvailabilities(response.data)
        } catch (error) {
            console.error('Erreur:', error)
            toast({
                title: 'Erreur',
                description: 'Impossible de charger les disponibilités',
                variant: 'destructive',
            })
        }
    }

    // Charger les entretiens
    const fetchInterviews = async () => {
        try {
            const response = await api.get('/recruitment/rh/interviews/')
            setInterviews(response.data)
        } catch (error) {
            console.error('Erreur:', error)
            toast({
                title: 'Erreur',
                description: 'Impossible de charger les entretiens',
                variant: 'destructive',
            })
        }
    }

    // Charger les paramètres
    const fetchSettings = async () => {
        try {
            const response = await api.get('/recruitment/rh/settings/')
            setSettings(response.data)
        } catch (error) {
            console.error('Erreur:', error)
        }
    }

    // Ajouter une disponibilité (Unique ou Récurrente)
    const addAvailability = async (data: any) => {
        try {
            setLoading(true)
            const response = await api.post('/recruitment/rh/availabilities/', data)
            setAvailabilities([...availabilities, response.data])
            toast({
                title: 'Succès',
                description: 'Disponibilité ajoutée',
            })
            return response.data
        } catch (error) {
            console.error('Erreur:', error)
            toast({
                title: 'Erreur',
                description: 'Impossible d\'ajouter la disponibilité',
                variant: 'destructive',
            })
            throw error
        } finally {
            setLoading(false)
        }
    }
    const deleteException = async (id: number) => {
        try {
            await api.delete(`/recruitment/rh/exceptions/${id}/`);
            setExceptions(exceptions.filter(ex => ex.id !== id));
            toast({ title: 'Réactivé', description: 'Le créneau est de nouveau disponible.' });
        } catch (error) {
            console.error(error);
        }
    };

    // Ajouter une exception (Annuler un jour précis)
    const addException = async (data: { date: string }) => {
        try {
            setLoading(true)
            const response = await api.post('/recruitment/rh/exceptions/', data)
            setExceptions([...exceptions, response.data])
            toast({
                title: 'Succès',
                description: 'Le jour a été marqué comme indisponible',
            })
        } catch (error) {
            console.error("Erreur:", error)
            toast({
                title: 'Erreur',
                description: 'Impossible d\'annuler ce jour',
                variant: 'destructive',
            })
            throw error
        } finally {
            setLoading(false)
        }
    };

    // Supprimer une disponibilité
    const deleteAvailability = async (id: number) => {
        try {
            await api.delete(`/recruitment/rh/availabilities/${id}/`)
            setAvailabilities(availabilities.filter(a => a.id !== id))
            toast({
                title: 'Succès',
                description: 'Disponibilité supprimée',
            })
        } catch (error) {
            console.error('Erreur:', error)
            toast({
                title: 'Erreur',
                description: 'Impossible de supprimer la disponibilité',
                variant: 'destructive',
            })
        }
    }

    // Mettre à jour les paramètres
    const updateSettings = async (data: Partial<RHSettings>) => {
        try {
            const response = await api.put('/recruitment/rh/settings/', data)
            setSettings(response.data)
            toast({
                title: 'Succès',
                description: 'Paramètres mis à jour',
            })
        } catch (error) {
            console.error('Erreur:', error)
            toast({
                title: 'Erreur',
                description: 'Impossible de mettre à jour les paramètres',
                variant: 'destructive',
            })
        }
    }

    // Confirmer un entretien
    const confirmInterview = async (id: number) => {
        try {
            const response = await api.post(`/recruitment/rh/interviews/${id}/confirm/`)
            setInterviews(interviews.map(i => i.id === id ? response.data.interview : i))
        } catch (error) {
            console.error('Erreur:', error)
        }
    }

    // Annuler un entretien
    const cancelInterview = async (id: number) => {
        try {
            const response = await api.post(`/recruitment/rh/interviews/${id}/cancel/`)
            setInterviews(interviews.map(i => i.id === id ? response.data.interview : i))
        } catch (error) {
            console.error('Erreur:', error)
        }
    }

    useEffect(() => {
        fetchAvailabilities()
        fetchInterviews()
        fetchSettings()
        fetchExceptions() // On charge les exceptions au démarrage
    }, [])

    return {
        availabilities,
        interviews,
        settings,
        exceptions,
        loading,
        addAvailability,
        deleteAvailability,
        addException,
        updateSettings,
        confirmInterview,
        cancelInterview,
        deleteException,
        refetch: () => {
            fetchAvailabilities()
            fetchInterviews()
            fetchExceptions()
        }
    }
}