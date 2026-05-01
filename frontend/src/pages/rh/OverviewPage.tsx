// src/pages/rh/OverviewPage.tsx

import { useMemo } from 'react'
import { BrainCircuit } from 'lucide-react'
import { useRHData, toAIDecision } from '../../hooks/useRHData.ts'
import { KPICards }            from '../../components/rh/dashboard/KPICards.tsx'
import { AICandidateRanking }  from '../../components/rh/analytics/AICandidateRanking.tsx'
import { AIScoreChart }        from '../../components/rh/analytics/AIScoreChart.tsx'
import { AIInsightsPanel }     from '../../components/rh/analytics/AIInsightsPanel.tsx'
import { PageHeader }          from '../../components/rh/layout/PageHeader.tsx'

export function OverviewPage() {
    const { jobs, applications } = useRHData()

    const stats = useMemo(() => {
        const activeJobs = jobs.length
        const pendingApplications = applications.filter(
            a => a.status === 'pending'
        ).length
        const responseRate = applications.length > 0
            ? Math.round(
                applications.filter(a => a.status !== 'pending').length /
                applications.length * 100
            )
            : 0
        const upcomingInterviews = applications.filter(
            a => a.status === 'interview_scheduled'
        ).length
        const averageAIScore = applications.length > 0
            ? Math.round(
                applications.reduce((acc, a) => acc + (a.ai_score || 0), 0) /
                applications.length
            )
            : 0
        const validatedCount = applications.filter(
            a => a.ai_decision === 'VALIDATED'
        ).length
        const toReviewCount = applications.filter(
            a => a.ai_decision === 'TO_REVIEW'
        ).length
        const rejectedCount = applications.filter(
            a => a.ai_decision === 'REJECTED'
        ).length
        const topCandidates = applications
            .filter(a => (a.ai_score || 0) > 0)
            .sort((a, b) => (b.ai_score || 0) - (a.ai_score || 0))
            .slice(0, 5)
            .map(a => ({
                id: a.id,
                full_name: a.full_name,
                job_offer_title: a.job_offer_title,
                ai_score: a.ai_score || 0,
                ai_decision: toAIDecision(a.ai_decision)
            }))

        return {
            activeJobs, pendingApplications, responseRate,
            upcomingInterviews, averageAIScore, validatedCount,
            toReviewCount, rejectedCount, topCandidates
        }
    }, [jobs, applications])

    return (
        <div className="p-6 space-y-6">
            <PageHeader
                title="Vue générale"
                subtitle="Tableau de bord recrutement intelligent"
                badge="IA Active"
                badgeIcon={<BrainCircuit className="w-3 h-3" />}
                right={
                    <div className="text-right">
                        <p className="text-xs text-slate-400">Score IA moyen</p>
                        <p className="text-3xl font-bold text-white">
                            {stats.averageAIScore}
                            <span className="text-slate-400 text-lg">/100</span>
                        </p>
                    </div>
                }
            />

            <KPICards
                activeJobs={stats.activeJobs}
                pendingApplications={stats.pendingApplications}
                responseRate={stats.responseRate}
                upcomingInterviews={stats.upcomingInterviews}
                aiStats={{
                    averageScore: stats.averageAIScore,
                    validatedCount: stats.validatedCount,
                    toReviewCount: stats.toReviewCount,
                    rejectedCount: stats.rejectedCount
                }}
            />

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <AICandidateRanking candidates={stats.topCandidates} />
                <AIScoreChart applications={applications} />
            </div>

            <AIInsightsPanel
                totalApplications={applications.length}
                averageScore={stats.averageAIScore}
                validatedCount={stats.validatedCount}
                toReviewCount={stats.toReviewCount}
                rejectedCount={stats.rejectedCount}
                topSkills={[]}
                missingSkillsTrends={[]}
            />
        </div>
    )
}