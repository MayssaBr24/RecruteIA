// src/pages/rh/PlanningPage.tsx

import { Calendar }         from 'lucide-react'
import { InterviewCalendar } from '../../components/rh/calendar/InterviewCalendar.tsx'
import { PageHeader }        from '../../components/rh/layout/PageHeader.tsx'

export function PlanningPage() {
    return (
        <div className="p-6 space-y-6">
            <PageHeader
                title="Planning RH"
                subtitle="Votre calendrier personnel et rappels"
                badge="Smart"
                badgeIcon={<Calendar className="w-3 h-3" />}
            />
            <InterviewCalendar />
        </div>
    )
}