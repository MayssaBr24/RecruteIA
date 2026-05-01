
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Button }      from '../../../components/ui/button.tsx'
import { useRHData }   from '../../hooks/useRHData.ts'
import { OffersGrid }  from '../../components/rh/offers/OffersGrid.tsx'
import { PageHeader }  from '../../components/rh/layout/PageHeader.tsx'

export function OffersPage() {
    const navigate = useNavigate()
    const { jobs, loadingJobs, refetchJobs } = useRHData()

    return (
        <div className="p-6 space-y-6">
            <PageHeader
                title="Offres d'emploi"
                subtitle={`${jobs.length} offre${jobs.length > 1 ? 's' : ''} au total`}
                actions={
                    <Button
                        onClick={() => navigate('/rh/offers/create')}
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Nouvelle offre
                    </Button>
                }
            />
            <OffersGrid
                jobs={jobs}
                loading={loadingJobs}
                onCreateClick={() => navigate('/rh/offers/create')}
                onJobUpdate={refetchJobs}
            />
        </div>
    )
}