// src/pages/rh/analytics/AnalyticsPage.tsx

import { useState, useEffect } from 'react'
import { BarChart3, ChevronDown, ChevronUp } from 'lucide-react'
import { useRHData } from '../../hooks/useRHData.ts'
import { AIScoreChart } from '../../components/rh/analytics/AIScoreChart.tsx'
import { CandidateRadarChart } from '../../components/rh/analytics/CandidateRadarChart.tsx'
import { TimelineMasteryChart } from '../../components/rh/analytics/TimelineMasteryChart.tsx'
import { GrowthMatrix } from '../../components/rh/analytics/GrowthMatrix.tsx'
import { AIInsightsPanel } from '../../components/rh/analytics/AIInsightsPanel.tsx'
import { PageHeader } from '../../components/rh/layout/PageHeader.tsx'
import { useToast } from '../../hooks/use-toast.ts'
import api from '../../lib/api.ts'

export function AnalyticsPage() {
    const { applications } = useRHData()
    const { toast } = useToast()

    const [showCvSection, setShowCvSection] = useState(true)
    const [showInsightsSection, setShowInsightsSection] = useState(true)
    const [showInterviewsSection, setShowInterviewsSection] = useState(true)

    const [aiAnalytics, setAiAnalytics] = useState({
        topSkills: [],
        missingSkillsTrends: []
    })
    const [interviewStats, setInterviewStats] = useState({
        averages: { avg_comm: 0, avg_clarif: 0, avg_qcm: 0 },
        timeline: [],
        matrix: []
    })

    useEffect(() => {
        api.get('/recruitment/rh/ai-analytics/')
            .then(r => setAiAnalytics(r.data))
            .catch(() => toast({ title: 'Erreur chargement analytics', variant: 'destructive' }))

        api.get('/recruitment/rh/global-interview-analytics/')
            .then(r => setInterviewStats(r.data))
            .catch(() => toast({ title: 'Erreur chargement interviews', variant: 'destructive' }))
    }, [])

    const stats = {
        validated: applications.filter(a => a.ai_decision === 'VALIDATED').length,
        toReview: applications.filter(a => a.ai_decision === 'TO_REVIEW').length,
        rejected: applications.filter(a => a.ai_decision === 'REJECTED').length,
        avgScore: Math.round(applications.reduce((acc, a) => acc + (a.ai_score || 0), 0) / (applications.length || 1))
    }

    return (
        <div className="p-4 md:p-6 space-y-6 md:space-y-8 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 min-h-screen">

            <PageHeader
                title="Analytics IA"
                subtitle="Tableau de bord stratégique - Analyse des candidatures et performances"
                badge="IA Premium"
                badgeIcon={<BarChart3 className="w-3 h-3" />}
            />

            {/* ============================================================ */}
            {/* CADRE 1 : Analyse des CV */}
            {/* ============================================================ */}
            <div className="bg-slate-800/30 rounded-2xl border border-slate-700 overflow-hidden">
                <button
                    onClick={() => setShowCvSection(!showCvSection)}
                    className="w-full flex items-center justify-between p-5 bg-slate-800/50 border-b border-slate-700 hover:bg-slate-800/70 transition-colors"
                >
                    <div>
                        <h2 className="text-white font-bold text-lg">📄 Analyse des CV</h2>
                        <p className="text-slate-400 text-sm">Distribution des scores IA par candidat</p>
                    </div>
                    {showCvSection ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>

                {showCvSection && (
                    <div className="p-5">
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                            <div className="xl:col-span-2">
                                <AIScoreChart applications={applications} detailed />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ============================================================ */}
            {/* CADRE 2 : Insights IA */}
            {/* ============================================================ */}
            <div className="bg-slate-800/30 rounded-2xl border border-slate-700 overflow-hidden">
                <button
                    onClick={() => setShowInsightsSection(!showInsightsSection)}
                    className="w-full flex items-center justify-between p-5 bg-slate-800/50 border-b border-slate-700 hover:bg-slate-800/70 transition-colors"
                >
                    <div>
                        <h2 className="text-white font-bold text-lg">💡 Insights IA</h2>
                        <p className="text-slate-400 text-sm">Statistiques et tendances des candidatures</p>
                    </div>
                    {showInsightsSection ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>

                {showInsightsSection && (
                    <div className="p-5">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <AIInsightsPanel
                                totalApplications={applications.length}
                                averageScore={stats.avgScore}
                                validatedCount={stats.validated}
                                toReviewCount={stats.toReview}
                                rejectedCount={stats.rejected}
                                topSkills={aiAnalytics.topSkills}
                                missingSkillsTrends={aiAnalytics.missingSkillsTrends}
                                detailed
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* ============================================================ */}
            {/* CADRE 3 : Analyse des entretiens IA */}
            {/* ============================================================ */}
            <div className="bg-slate-800/30 rounded-2xl border border-slate-700 overflow-hidden">
                <button
                    onClick={() => setShowInterviewsSection(!showInterviewsSection)}
                    className="w-full flex items-center justify-between p-5 bg-slate-800/50 border-b border-slate-700 hover:bg-slate-800/70 transition-colors"
                >
                    <div>
                        <h2 className="text-white font-bold text-lg">🎯 Analyse des entretiens IA</h2>
                        <p className="text-slate-400 text-sm">Évaluation des compétences en entretien technique</p>
                    </div>
                    {showInterviewsSection ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>

                {showInterviewsSection && (
                    <div className="p-5">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-1">
                                <CandidateRadarChart
                                    data={{
                                        comm: interviewStats.averages.avg_comm,
                                        clarif: interviewStats.averages.avg_clarif,
                                        qcm: interviewStats.averages.avg_qcm,
                                    }}
                                />
                            </div>
                            <div className="lg:col-span-2 space-y-6">
                                <GrowthMatrix data={interviewStats.matrix} />
                                <TimelineMasteryChart data={interviewStats.timeline} />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ============================================================ */}
            {/* CADRE 4 : Guide d'interprétation */}
            {/* ============================================================ */}
            <div className="bg-slate-800/40 rounded-xl p-6 border border-slate-700">
                <div className="flex flex-col md:flex-row gap-6 text-sm">
                    <div className="flex-1">
                        <h4 className="text-purple-400 font-semibold mb-2">📊 Matrice de Croissance</h4>
                        <p className="text-slate-400">Chaque bulle représente un candidat. Plus la bulle est grosse, plus le score global est élevé.
                            Les candidats en haut à droite (Communication + Technique élevés) sont les profils les plus prometteurs.</p>
                    </div>
                    <div className="flex-1">
                        <h4 className="text-purple-400 font-semibold mb-2">📈 Timeline de Maîtrise</h4>
                        <p className="text-slate-400">Visualise l'évolution des compétences par candidat. Chaque barre empilée montre la répartition
                            des scores (Communication, Clarification, Technique, Coding) pour chaque profil.</p>
                    </div>
                    <div className="flex-1">
                        <h4 className="text-purple-400 font-semibold mb-2">🔄 Signature de Performance</h4>
                        <p className="text-slate-400">Le graphique radar compare les forces et faiblesses moyennes des candidats sur
                            les 4 axes d'évaluation. Plus la zone est étendue, meilleure est la performance globale.</p>
                    </div>
                </div>
            </div>
        </div>
    )
}