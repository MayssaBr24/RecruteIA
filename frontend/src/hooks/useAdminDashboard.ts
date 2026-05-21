import { useState, useEffect } from 'react'
import api from '../lib/api'
import { useToast } from './use-toast'

export interface DashboardStats {
    users: {
        total: number
        rh: number
        admins: number
        active: number
    }
    offers: {
        total: number
        active: number
        this_month: number
    }
    applications: {
        total: number
        pending: number
        this_month: number
    }
    interviews: {
        total: number
        upcoming: number
    }
    conversion_rate: number
    system_status: string
}

export interface ChartData {
    applications_trend: Array<{ month: string; count: number }>
    offers_by_rh: Array<{ created_by__username: string; count: number }>
    applications_by_status: Array<{ status: string; count: number }>
    interviews_by_status: Array<{ status: string; count: number }>
}

export interface Activity {
    id: number
    username: string
    activity_type: string
    description: string
    ip_address?: string
    created_at: string
}

export function useAdminDashboard() {
    const { toast } = useToast()
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [charts, setCharts] = useState<ChartData | null>(null)
    const [activities, setActivities] = useState<Activity[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchDashboardData = async () => {
        try {
            setLoading(true)
            setError(null)

            const statsResponse = await api.get('/recruitment/admin/dashboard/stats/')
            setStats(statsResponse.data)

            const chartsResponse = await api.get('/recruitment/admin/dashboard/charts/')
            setCharts(chartsResponse.data)

            const activityResponse = await api.get('/recruitment/admin/dashboard/activity/?limit=10')
            setActivities(activityResponse.data.activities || [])

        } catch (error) {
            const message = error instanceof Error ? error.message : 'Erreur lors du chargement'
            console.error('Erreur dashboard:', error)
            setError(message)
            toast({
                title: 'Erreur',
                description: 'Impossible de charger les données du dashboard',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchDashboardData()
    }, [])

    return {
        stats,
        charts,
        activities,
        loading,
        error,
        refetch: fetchDashboardData
    }
}