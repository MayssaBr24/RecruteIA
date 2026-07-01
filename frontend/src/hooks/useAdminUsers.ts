import { useState, useEffect } from 'react'
import api from '../lib/api'
import { useToast } from './use-toast'

export interface AdminUser {
    id: number
    username: string
    email: string
    first_name: string
    last_name: string
    role: 'SUPERADMIN' | 'RH' | 'ADMIN'
    is_active: boolean
    is_staff: boolean
    date_joined: string
    last_login: string | null
    last_login_formatted: string
    total_offers: number
    total_applications: number
    total_interviews: number
}

export function useAdminUsers() {
    const { toast } = useToast()
    const [users, setUsers] = useState<AdminUser[]>([])
    const [loading, setLoading] = useState(false)
    const [filters, setFilters] = useState({
        role: '',
        is_active: '',
        search: ''
    })

    const fetchUsers = async () => {
        try {
            setLoading(true)
            const params = new URLSearchParams()

            if (filters.role) params.append('role', filters.role)
            if (filters.is_active) params.append('is_active', filters.is_active)
            if (filters.search) params.append('search', filters.search)

            const response = await api.get(`/admin/users/?${params.toString()}`)
            setUsers(response.data.results || response.data)        } catch (error) {
            console.error('Erreur:', error)
            toast({
                title: 'Erreur',
                description: 'Impossible de charger les utilisateurs',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    const toggleUserActive = async (userId: number) => {
        try {
            const response = await api.post(`/admin/users/${userId}/toggle-active/`)

            // Mettre à jour localement
            setUsers(users.map(user =>
                user.id === userId
                    ? { ...user, is_active: response.data.is_active }
                    : user
            ))

            toast({
                title: 'Succès',
                description: response.data.message,
            })
        } catch (error) {
            console.error('Erreur:', error)
            toast({
                title: 'Erreur',
                description: 'Impossible de modifier le statut',
                variant: 'destructive',
            })
        }
    }

    const deleteUser = async (userId: number) => {
        try {
            await api.delete(`/admin/users/${userId}/`)
            setUsers(users.filter(user => user.id !== userId))

            toast({
                title: 'Succès',
                description: 'Utilisateur supprimé',
            })
        } catch (error) {
            console.error('Erreur:', error)
            toast({
                title: 'Erreur',
                description: 'Impossible de supprimer l\'utilisateur',
                variant: 'destructive',
            })
        }
    }

    useEffect(() => {
        fetchUsers()
    }, [filters])

    return {
        users,
        loading,
        filters,
        setFilters,
        toggleUserActive,
        deleteUser,
        refetch: fetchUsers
    }
}