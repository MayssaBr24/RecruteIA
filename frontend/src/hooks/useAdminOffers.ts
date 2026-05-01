import { useState, useEffect } from 'react'
import api from '../lib/api'
import { useToast } from './use-toast'

export interface AdminOffer {
    id: number
    title: string
    description: string
    skills_required: string
    created_by: number
    created_by_name: string
    is_active: boolean
    created_at: string
    updated_at: string
    applications_count: number
}

export function useAdminOffers() {
    const { toast } = useToast()
    const [offers, setOffers] = useState<AdminOffer[]>([])
    const [loading, setLoading] = useState(false)
    const [filters, setFilters] = useState({
        rh_id: '',
        is_active: '',
        search: ''
    })

    const fetchOffers = async () => {
        try {
            setLoading(true)
            const params = new URLSearchParams()

            if (filters.rh_id) params.append('rh_id', filters.rh_id)
            if (filters.is_active) params.append('is_active', filters.is_active)
            if (filters.search) params.append('search', filters.search)

            const response = await api.get(`/recruitment/admin/offers/?${params.toString()}`)
            setOffers(response.data)
        } catch (error) {
            console.error('Erreur:', error)
            toast({
                title: 'Erreur',
                description: 'Impossible de charger les offres',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    const archiveOffer = async (offerId: number) => {
        try {
            await api.post(`/recruitment/admin/offers/${offerId}/archive/`)

            setOffers(offers.map(offer =>
                offer.id === offerId
                    ? { ...offer, is_active: false }
                    : offer
            ))

            toast({
                title: 'Succès',
                description: 'Offre archivée',
            })
        } catch (error) {
            console.error('Erreur:', error)
            toast({
                title: 'Erreur',
                description: 'Impossible d\'archiver l\'offre',
                variant: 'destructive',
            })
        }
    }

    useEffect(() => {
        fetchOffers()
    }, [filters])

    return {
        offers,
        loading,
        filters,
        setFilters,
        archiveOffer,
        refetch: fetchOffers
    }
}