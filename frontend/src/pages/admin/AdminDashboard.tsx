import { Loader2, Activity, BarChart3, AlertCircle} from 'lucide-react'
import { useAdminDashboard } from '../../hooks/useAdminDashboard'
import { Button } from '../../../components/ui/button'
import { Card } from '../../../components/ui/card'
import { AdminKPICards } from "./dashboard/AdminKPICards"
import { AdminCharts } from "./dashboard/AdminCharts"
import { RecentActivityTable } from "./dashboard/RecentActivityTable"
import { useState } from "react"
import { motion } from 'framer-motion'

export default function AdminDashboard() {
    const { stats, charts, activities, loading, error, refetch } = useAdminDashboard()
    const [isRefreshing, setIsRefreshing] = useState(false)

    const handleRefresh = async () => {
        setIsRefreshing(true)
        await refetch()
        setIsRefreshing(false)
    }

    if (loading) return <LoadingState />
    if (error) return <ErrorState error={error} onRetry={handleRefresh} />

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8" // Marges simplifiées pour tout le bloc
        >
            {/* Header section */}


            <AdminKPICards stats={stats} />

            {/* Charts section */}
            {charts?.applications_trend?.length > 0 ? (
                <section>
                    <h3 className="text-lg font-semibold text-white mb-4">Analyses & Tendances</h3>
                    <Card className="border-gray-800 bg-gray-900/50 p-6">
                        <AdminCharts charts={charts} />
                    </Card>
                </section>
            ) : (
                <EmptyState icon={BarChart3} title="Pas de données" desc="Les graphiques apparaîtront bientôt." />
            )}

            {/* Activities section */}
            {activities?.length > 0 ? (
                <section>
                    <h3 className="text-lg font-semibold text-white mb-4">Activité Récente</h3>
                    <RecentActivityTable activities={activities} />
                </section>
            ) : (
                <EmptyState icon={Activity} title="Aucune activité" desc="L'activité de la plateforme apparaîtra ici." />
            )}
        </motion.div>
    )
}

// --- Composants de secours simplifiés ---

const LoadingState = () => (
    <div className="flex items-center justify-center h-64">
        <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
    </div>
)

const ErrorState = ({ error, onRetry }: { error: string, onRetry: () => void }) => (
    <div className="text-center p-8 border border-red-500/20 rounded-xl bg-red-950/10">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-white mb-4">{error}</p>
        <Button onClick={onRetry}>Réessayer</Button>
    </div>
)

const EmptyState = ({ icon: Icon, title, desc }: any) => (
    <div className="text-center py-12 border border-dashed border-gray-800 rounded-xl">
        <Icon className="w-10 h-10 text-gray-700 mx-auto mb-3" />
        <h3 className="text-gray-300 font-medium">{title}</h3>
        <p className="text-gray-500 text-sm">{desc}</p>
    </div>
)