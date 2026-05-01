import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { TrendingUp, HelpCircle } from 'lucide-react'
import { useState } from 'react'

// Types pour les données
interface TimelineData {
    candidate_name: string
    communication_score: number
    clarification_score: number
    qcm_score: number
}

interface TooltipPayload {
    color: string
    name: string
    value: number
}

interface CustomTooltipProps {
    active?: boolean
    payload?: Array<{ color: string; name: string; value: number }>
    label?: string
}

// Composant Tooltip défini en dehors du render
const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (!active || !payload?.length) return null

    return (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 shadow-xl min-w-[200px]">
            <p className="text-white font-semibold mb-2">{label}</p>
            <div className="space-y-2">
                {payload.map((item, idx: number) => (
                    <div key={idx} className="flex justify-between items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="text-slate-400 text-xs">{item.name}</span>
                        </div>
                        <span className="text-white font-bold text-sm">{item.value}%</span>
                    </div>
                ))}
                <div className="pt-2 border-t border-slate-700 mt-2">
                    <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-xs">Score total</span>
                        <span className="text-purple-400 font-bold">
                            {payload.reduce((sum: number, item: TooltipPayload) => sum + item.value, 0) / payload.length}%
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}

// Composant Legend formatter
const LegendFormatter = (value: string) => <span className="text-slate-300 text-sm">{value}</span>

interface TimelineMasteryChartProps {
    data: TimelineData[]
}

export function TimelineMasteryChart({ data }: TimelineMasteryChartProps) {
    const [showGuide, setShowGuide] = useState<boolean>(false)

    // Calcul de la moyenne générale
    const calculateAverage = () => {
        if (data.length === 0) return 0
        const total = data.reduce((acc: number, d: TimelineData) => {
            return acc + (d.communication_score + d.clarification_score + d.qcm_score) / 3
        }, 0)
        return Math.round(total / data.length)
    }

    // Calcul du point fort collectif
    const getStrongestPoint = () => {
        if (data.length === 0) return null

        const avg = {
            comm: data.reduce((a: number, d: TimelineData) => a + d.communication_score, 0) / data.length,
            clarif: data.reduce((a: number, d: TimelineData) => a + d.clarification_score, 0) / data.length,
            qcm: data.reduce((a: number, d: TimelineData) => a + d.qcm_score, 0) / data.length
        }

        const entries = Object.entries(avg) as [keyof typeof avg, number][]
        const max = entries.sort((a, b) => b[1] - a[1])[0]

        const names = { comm: 'Communication', clarif: 'Clarification', qcm: 'Technique' }
        return `${names[max[0]]} (${Math.round(max[1])}%)`
    }

    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-700">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-lg">Timeline de Maîtrise</h3>
                            <p className="text-slate-400 text-sm">Distribution des compétences par candidat</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowGuide(!showGuide)}
                        className="text-slate-400 hover:text-emerald-400 transition-colors text-sm flex items-center gap-1"
                    >
                        <HelpCircle className="w-4 h-4" />
                        Guide
                    </button>
                </div>

                {showGuide && (
                    <div className="mt-4 p-4 bg-emerald-900/20 border border-emerald-500/20 rounded-xl">
                        <h4 className="text-emerald-300 font-semibold text-sm mb-2">📊 Comment lire cette timeline ?</h4>
                        <div className="space-y-2 text-sm text-slate-300">
                            <p>Chaque barre empilée représente un candidat et montre la répartition de ses compétences.</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                                <div>
                                    <p className="text-emerald-400 font-medium mb-1">Couleurs des compétences :</p>
                                    <ul className="space-y-1 text-slate-400">
                                        <li>🟣 <strong>Communication</strong> - Expression et présentation</li>
                                        <li>🔵 <strong>Clarification</strong> - Questions et précisions</li>
                                        <li>🟠 <strong>Technique QCM</strong> - Connaissances théoriques</li>
                                    </ul>
                                </div>
                                <div>
                                    <p className="text-emerald-400 font-medium mb-1">Lecture rapide :</p>
                                    <ul className="space-y-1 text-slate-400">
                                        <li>• Barre haute = Bon score global</li>
                                        <li>• Couleurs équilibrées = Profil polyvalent</li>
                                        <li>• Dominance d'une couleur = Spécialisation</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-5">
                <div className="h-[400px] w-full overflow-x-auto">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={data}
                            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                            barGap={8}
                            barCategoryGap={12}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis
                                dataKey="candidate_name"
                                angle={-45}
                                textAnchor="end"
                                height={80}
                                tick={{ fill: '#94a3b8', fontSize: 11 }}
                                interval={0}
                            />
                            <YAxis
                                tick={{ fill: '#94a3b8', fontSize: 11 }}
                                label={{ value: 'Score (%)', angle: -90, position: 'left', fill: '#64748b', fontSize: 11 }}
                                domain={[0, 100]}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend
                                wrapperStyle={{ paddingTop: 20 }}
                                formatter={LegendFormatter}
                            />
                            <Bar dataKey="communication_score" name="Communication" stackId="a" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="clarification_score" name="Clarification" stackId="a" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="qcm_score" name="Technique QCM" stackId="a" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Analyse rapide */}
                <div className="mt-4 p-3 bg-slate-900/40 rounded-lg">
                    <div className="flex flex-col md:flex-row gap-4 text-xs">
                        <div className="flex-1 text-center md:text-left">
                            <p className="text-slate-400">
                                📈 <strong className="text-white">Tendance générale :</strong>{' '}
                                {data.length > 0 && `Moyenne de ${calculateAverage()}%`}
                            </p>
                        </div>
                        <div className="flex-1 text-center md:text-left">
                            <p className="text-slate-400">
                                🎯 <strong className="text-white">Point fort collectif :</strong>{' '}
                                {data.length > 0 && getStrongestPoint()}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}