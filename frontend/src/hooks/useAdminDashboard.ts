// hooks/useAdminDashboard.ts - VERSION COMPLÈTE
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
    user: number
    username: string
    activity_type: string
    description: string
    ip_address?: string
    timestamp: string
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

            // Fetch stats
            const statsResponse = await api.get('/recruitment/admin/dashboard/stats/')
            console.log('Stats:', statsResponse.data)
            setStats(statsResponse.data)

            // Fetch charts data
            const chartsResponse = await api.get('/recruitment/admin/dashboard/charts/')
            console.log('Charts:', chartsResponse.data)
            setCharts(chartsResponse.data)

            // Fetch recent activity
            const activityResponse = await api.get('/recruitment/admin/dashboard/activity/?limit=10')
            console.log('Activities:', activityResponse.data)
            setActivities(activityResponse.data)

        } catch (error: any) {
            console.error('Erreur dashboard:', error)
            setError(error.message || 'Erreur lors du chargement')
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