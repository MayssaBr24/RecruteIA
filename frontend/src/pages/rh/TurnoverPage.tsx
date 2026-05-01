// src/pages/rh/TurnoverPage.tsx

import { useState, useEffect } from 'react'
import { RefreshCw, Loader2 } from 'lucide-react'
import { Card }    from '../../../components/ui/card'
import { Button }  from '../../../components/ui/button'
import { PageHeader } from '../../components/rh/layout/PageHeader'
import {
    Tooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    ResponsiveContainer, RadarChart, Radar,
    PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts'
import api from '../../lib/api'

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b']

// Types
interface FunnelStage {
    stage: string
    count: number
    pct: number
}

interface PhaseScores {
    communication: number
    clarification: number
    qcm: number
}

interface GraphData {
    funnel: FunnelStage[]
    phase_scores: PhaseScores
    source_performance: Array<{ source: string; total: number; hired: number }>
}

interface InterviewStats {
    completion_rate: number
    abandon_rate: number
    fraud_rate: number
    avg_score: number
}

interface RepeatedOffer {
    title: string
    count: number
}

interface Stats {
    interview: InterviewStats
    repeated_offers: RepeatedOffer[]
}

interface TurnoverData {
    graph_data: GraphData
    stats: Stats
    ai_analysis: string
    generated_at: string
}

export function TurnoverPage() {
    const [data, setData] = useState<TurnoverData | null>(null)
    const [loading, setLoading] = useState<boolean>(true)

    // Correction : Déplacer la logique de chargement DANS l'effet
    useEffect(() => {
        let isMounted = true

        const loadData = async () => {
            if (!isMounted) return
            setLoading(true)
            try {
                const response = await api.get('/recruitment/rh/turnover/')
                if (isMounted) {
                    setData(response.data)
                }
            } catch (error) {
                if (isMounted) {
                    console.error(error)
                }
            } finally {
                if (isMounted) {
                    setLoading(false)
                }
            }
        }

        loadData()

        return () => {
            isMounted = false
        }
    }, []) // Pas de dépendances externes

    // Fonction pour recharger manuellement (utilisée par le bouton)
    const handleRefresh = async () => {
        setLoading(true)
        try {
            const response = await api.get('/recruitment/rh/turnover/')
            setData(response.data)
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    // Données radar pour scores par phase (sans Coding)
    const radarData = data ? [
        { phase: 'Communication', score: data.graph_data.phase_scores.communication },
        { phase: 'Clarification', score: data.graph_data.phase_scores.clarification },
        { phase: 'Technique QCM', score: data.graph_data.phase_scores.qcm },
    ] : []

    return (
        <div className="p-6 space-y-6">
            <PageHeader
                title="Analyse Turnover"
                subtitle="Analyse du funnel de recrutement et points de friction"
                badge="IA"
                badgeIcon={<RefreshCw className="w-3 h-3" />}
                actions={
                    <Button onClick={handleRefresh} variant="outline" size="sm"
                            className="border-slate-700 text-slate-300" disabled={loading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Actualiser
                    </Button>
                }
            />

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <div className="text-center">
                        <Loader2 className="w-10 h-10 animate-spin text-purple-400 mx-auto mb-3" />
                        <p className="text-slate-400">Analyse en cours...</p>
                    </div>
                </div>
            ) : !data ? (
                <Card className="bg-slate-800/50 border-slate-700 p-12 text-center">
                    <p className="text-slate-400">Données insuffisantes</p>
                </Card>
            ) : (
                <>
                    {/* Stats entretiens */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            {
                                label: 'Taux complétion',
                                value: `${data.stats.interview.completion_rate}%`,
                                color: 'text-green-400'
                            },
                            {
                                label: 'Taux abandon',
                                value: `${data.stats.interview.abandon_rate}%`,
                                color: 'text-yellow-400'
                            },
                            {
                                label: 'Taux fraude',
                                value: `${data.stats.interview.fraud_rate}%`,
                                color: 'text-red-400'
                            },
                            {
                                label: 'Score moyen',
                                value: `${data.stats.interview.avg_score}/100`,
                                color: 'text-purple-400'
                            },
                        ].map(s => (
                            <Card key={s.label}
                                  className="bg-slate-800/50 border-slate-700 p-4 text-center">
                                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                                <p className="text-xs text-slate-400 mt-1">{s.label}</p>
                            </Card>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Funnel */}
                        <Card className="bg-slate-800/50 border-slate-700 p-6">
                            <h3 className="text-white font-semibold mb-4">
                                Funnel de recrutement
                            </h3>
                            <div className="space-y-3">
                                {data.graph_data.funnel.map((stage: FunnelStage, i: number) => (
                                    <div key={stage.stage}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-slate-300">{stage.stage}</span>
                                            <span className="text-white font-medium">
                                                {stage.count}
                                                <span className="text-slate-400 ml-1 text-xs">
                                                    ({stage.pct}%)
                                                </span>
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-700 rounded-full h-2">
                                            <div
                                                className="h-2 rounded-full transition-all"
                                                style={{
                                                    width: `${stage.pct}%`,
                                                    background: COLORS[i % COLORS.length]
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>

                        {/* Radar scores phases (sans Coding) */}
                        <Card className="bg-slate-800/50 border-slate-700 p-6">
                            <h3 className="text-white font-semibold mb-4">
                                Scores moyens par phase entretien
                            </h3>
                            <ResponsiveContainer width="100%" height={220}>
                                <RadarChart data={radarData}>
                                    <PolarGrid stroke="#334155" />
                                    <PolarAngleAxis
                                        dataKey="phase"
                                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                                    />
                                    <PolarRadiusAxis
                                        domain={[0, 100]}
                                        tick={{ fill: '#64748b', fontSize: 10 }}
                                    />
                                    <Radar
                                        name="Score"
                                        dataKey="score"
                                        stroke="#8b5cf6"
                                        fill="#8b5cf6"
                                        fillOpacity={0.3}
                                    />
                                    <Tooltip contentStyle={{
                                        background: '#1e293b',
                                        border: '1px solid #334155',
                                        borderRadius: '8px', color: '#fff'
                                    }} />
                                </RadarChart>
                            </ResponsiveContainer>
                        </Card>

                        {/* Performance sources */}
                        <Card className="bg-slate-800/50 border-slate-700 p-6">
                            <h3 className="text-white font-semibold mb-4">
                                Performance par source
                            </h3>
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={data.graph_data.source_performance}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis dataKey="source" stroke="#64748b" tick={{ fontSize: 11 }} />
                                    <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                                    <Tooltip contentStyle={{
                                        background: '#1e293b',
                                        border: '1px solid #334155',
                                        borderRadius: '8px', color: '#fff'
                                    }} />
                                    <Bar dataKey="total"
                                         name="Candidatures"
                                         fill="#8b5cf6" radius={[4,4,0,0]} />
                                    <Bar dataKey="hired"
                                         name="Recrutés"
                                         fill="#10b981" radius={[4,4,0,0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </Card>

                        {/* Postes répétés */}
                        {data.stats.repeated_offers.length > 0 && (
                            <Card className="bg-slate-800/50 border-slate-700 p-6">
                                <h3 className="text-white font-semibold mb-4">
                                    Postes difficiles à pourvoir
                                </h3>
                                <div className="space-y-3">
                                    {data.stats.repeated_offers.map((offer: RepeatedOffer) => (
                                        <div key={offer.title}
                                             className="flex items-center justify-between
                                                       bg-slate-900/50 rounded-lg px-4 py-3">
                                            <p className="text-slate-300 text-sm truncate">
                                                {offer.title}
                                            </p>
                                            <span className="text-orange-400 font-bold text-sm shrink-0 ml-3">
                                                ×{offer.count}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        )}
                    </div>

                    {/* Analyse IA */}
                    <Card className="bg-slate-800/50 border-slate-700 p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <RefreshCw className="w-5 h-5 text-purple-400" />
                            <h3 className="text-white font-semibold">Synthèse IA</h3>
                            <span className="text-xs text-slate-500 ml-auto">
                                {data.generated_at}
                            </span>
                        </div>
                        <pre className="whitespace-pre-wrap text-slate-300 text-sm
                                        leading-relaxed font-sans">
                            {data.ai_analysis}
                        </pre>
                    </Card>
                </>
            )}
        </div>
    )
}