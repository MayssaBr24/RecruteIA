import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, Loader2, RefreshCw } from 'lucide-react'
import { Card } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { PageHeader } from '../../components/rh/layout/PageHeader'
import {
    LineChart, Line, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts'
import api from '../../lib/api'

interface GraphPoint {
    month: string
    count?: number
    predicted?: number
}

interface ForecastingData {
    kpis: {
        total_offers: number
        total_applications: number
        conversion_rate: number
        avg_time_to_hire: number
    }
    graph_data: {
        applications_trend: {
            historical: GraphPoint[]
            predictions: GraphPoint[]
        }
        by_department: Array<{ department: string; offers_count: number }>
        by_source: Array<{ source: string; count: number }>
    }
    trend: {
        trend_pct: number
        trend_label: string
    }
    ai_analysis: string
    generated_at: string
}

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444']

export function ForecastingPage() {
    // Remplacement de <any> par l'interface dédiée
    const [data, setData] = useState<ForecastingData | null>(null)
    const [loading, setLoading] = useState<boolean>(true)

    // Utilisation de useCallback pour éviter de recréer la fonction à chaque rendu
    const load = useCallback(async () => {
        setLoading(true)
        try {
            const r = await api.get<ForecastingData>('/recruitment/rh/forecasting/')
            setData(r.data)
        } catch (error) {
            console.error("Erreur lors du chargement des prévisions:", error)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        load()
    }, [load]) // load est maintenant stable grâce à useCallback

    // Préparation des données du graphique (mémoïsé ou calculé au rendu)
    const combinedData = data ? [
        ...(data.graph_data.applications_trend.historical || []).map((d) => ({
            month: d.month,
            réel: d.count,
            prévu: null,
        })),
        ...(data.graph_data.applications_trend.predictions || []).map((d) => ({
            month: d.month,
            réel: null,
            prévu: d.predicted,
        })),
    ] : []

    return (
        <div className="p-6 space-y-6">
            <PageHeader
                title="Prévisions RH"
                subtitle="Estimation des besoins en personnel par IA"
                badge="IA Prédictive"
                badgeIcon={<TrendingUp className="w-3 h-3" />}
                actions={
                    <Button
                        onClick={load}
                        variant="outline"
                        size="sm"
                        className="border-slate-700 text-slate-300"
                        disabled={loading}
                    >
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
                    {/* KPIs */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: 'Total offres',      value: data.kpis.total_offers },
                            { label: 'Total candidatures', value: data.kpis.total_applications },
                            { label: 'Taux conversion',   value: `${data.kpis.conversion_rate}%` },
                            { label: 'Délai moyen',       value: `${data.kpis.avg_time_to_hire}j` },
                        ].map(k => (
                            <Card key={k.label} className="bg-slate-800/50 border-slate-700 p-4 text-center">
                                <p className="text-2xl font-bold text-purple-400">{k.value}</p>
                                <p className="text-xs text-slate-400 mt-1">{k.label}</p>
                            </Card>
                        ))}
                    </div>

                    {/* Graphique tendance + prévisions */}
                    <Card className="bg-slate-800/50 border-slate-700 p-6">
                        <h3 className="text-white font-semibold mb-4">Candidatures — Historique & Prévisions</h3>
                        <ResponsiveContainer width="100%" height={280}>
                            <LineChart data={combinedData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="month" stroke="#64748b" tick={{ fontSize: 12 }} />
                                <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                                />
                                <Legend />
                                <Line
                                    type="monotone" dataKey="réel"
                                    stroke="#8b5cf6" strokeWidth={2}
                                    dot={{ fill: '#8b5cf6' }}
                                />
                                <Line
                                    type="monotone" dataKey="prévu"
                                    stroke="#3b82f6" strokeWidth={2}
                                    strokeDasharray="5 5"
                                    dot={{ fill: '#3b82f6' }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Par département */}
                        <Card className="bg-slate-800/50 border-slate-700 p-6">
                            <h3 className="text-white font-semibold mb-4">Offres par département</h3>
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={data.graph_data.by_department}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis dataKey="department" stroke="#64748b" tick={{ fontSize: 11 }} />
                                    <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }} />
                                    <Bar dataKey="offers_count" fill="#8b5cf6" radius={[4,4,0,0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </Card>

                        {/* Par source */}
                        <Card className="bg-slate-800/50 border-slate-700 p-6">
                            <h3 className="text-white font-semibold mb-4">Sources des candidatures</h3>
                            {data.graph_data.by_source.length > 0 ? (
                                <ResponsiveContainer width="100%" height={220}>
                                    <PieChart>
                                        <Pie
                                            data={data.graph_data.by_source}
                                            dataKey="count"
                                            nameKey="source"
                                            cx="50%" cy="50%"
                                            outerRadius={80}
                                            label={({ percent = 0, payload }) =>
                                                `${payload?.source ?? ''} ${(percent * 100).toFixed(0)}%`
                                            }
                                        >
                                            {data.graph_data.by_source.map((_, i) => (
                                                <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <p className="text-slate-500 text-center py-8 text-sm">Données insuffisantes</p>
                            )}
                        </Card>
                    </div>

                    {/* Tendance & Analyse IA */}
                    <Card className="bg-slate-800/50 border-slate-700 p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <TrendingUp className="w-5 h-5 text-purple-400" />
                            <h3 className="text-white font-semibold">Tendance</h3>
                            <span className={`text-sm font-bold ${data.trend.trend_pct > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {data.trend.trend_pct > 0 ? '+' : ''}{data.trend.trend_pct}%
                            </span>
                            <span className="text-slate-400 text-sm">— {data.trend.trend_label}</span>
                        </div>
                        <div className="border-t border-slate-700 pt-4 mt-4">
                            <div className="flex items-center gap-2 mb-2">
                                <h3 className="text-white font-semibold">Analyse IA</h3>
                                <span className="text-xs text-slate-500 ml-auto">{data.generated_at}</span>
                            </div>
                            <pre className="whitespace-pre-wrap text-slate-300 text-sm leading-relaxed font-sans">
                                {data.ai_analysis}
                            </pre>
                        </div>
                    </Card>
                </>
            )}
        </div>
    )
}