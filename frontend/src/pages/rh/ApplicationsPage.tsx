import { useRHData }         from '../../hooks/useRHData.ts'
import { ApplicationsTable } from '../../components/rh/applications/ApplicationsTable.tsx'
import { PageHeader }        from '../../components/rh/layout/PageHeader.tsx'

export function ApplicationsPage() {
    const { applications, loadingApps } = useRHData()

    return (
        <div className="p-6 space-y-6">
            <PageHeader
                title="Candidatures"
                subtitle={`${applications.length} candidature${applications.length > 1 ? 's' : ''} reçues`}
            />
            <ApplicationsTable
                applications={applications}
                loading={loadingApps}
            />
        </div>
    )
}