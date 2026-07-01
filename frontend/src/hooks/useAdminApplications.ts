import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import { useToast } from './use-toast'

export interface AdminApplication {
    id: number
    full_name: string
    email: string
    phone: string
    job_offer: number
    job_title: string
    rh_name: string
    status: string
    created_at: string
    cv_file?: string
    cover_letter_file?: string
}

export function useAdminApplications() {
    const { toast } = useToast()
    const [applications, setApplications] = useState<AdminApplication[]>([])
    const [loading, setLoading] = useState(false)
    const [filters, setFilters] = useState({
        status: '',
        rh_id: '',
        offer_ids: [] as string[]
    })

    const fetchApplications = useCallback(async () => {
        try {
            console.log('🔄 Fetch avec filters:', filters)
            setLoading(true)
            const params = new URLSearchParams()

            if (filters.status) params.append('status', filters.status)
            if (filters.rh_id) params.append('rh_id', filters.rh_id)

            // ✅ MULTIPLE offer_id
            filters.offer_ids.forEach(id => params.append('offer_id', id))

            console.log('📡 URL:', `/admin/applications/?${params.toString()}`)

            const { data } = await api.get(`/admin/applications/?${params.toString()}`)
            setApplications(data)
            console.log('✅ Data reçue:', data.length, 'candidatures')
        } catch (error) {
            console.error('❌ Erreur:', error)
            toast({
                title: 'Erreur',
                description: 'Impossible de charger les candidatures',
            })
        } finally {
            setLoading(false)
        }
    }, [filters, toast])

    useEffect(() => {
        fetchApplications()
    }, [fetchApplications])

    // ✅ setFilters SIMPLE qui marche à 100%
    const updateFilters = (newFilters: Partial<typeof filters>) => {
        console.log('🔧 Mise à jour filters:', newFilters)
        setFilters(prevFilters => ({
            ...prevFilters,
            ...newFilters,
            offer_ids: newFilters.offer_ids ? [...newFilters.offer_ids] : prevFilters.offer_ids
        }))
    }

    console.log('🎯 État actuel:', { filters, applications: applications.length })

    return {
        applications,
        loading,
        filters,
        setFilters: updateFilters,
        refetch: fetchApplications
    }
}