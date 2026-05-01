// src/components/rh/analytics/CandidateRadarChart.tsx

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { Radar as RadarIcon, HelpCircle } from 'lucide-react'
import { useState } from 'react'

// Types
interface RadarData {
    subject: string
    value: number
    description: string
}

interface PerformanceLevel {
    level: string
    color: string
}

interface ChartData {
    comm: number
    clarif: number
    qcm: number
}

interface CustomTooltipProps {
    active?: boolean
    payload?: Array<{
        payload: RadarData
    }>
}

// Fonction helper pour le niveau de performance
const getPerformanceLevel = (value: number): PerformanceLevel => {
    if (value >= 80) return { level: 'Excellent', color: '#10b981' }
    if (value >= 60) return { level: 'Bon', color: '#818cf8' }
    if (value >= 40) return { level: 'Moyen', color: '#f59e0b' }
    return { level: 'À améliorer', color: '#ef4444' }
}

// Composant Tooltip défini en dehors du render
const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
    if (!active || !payload?.length) return null
    const item = payload[0].payload
    const perf = getPerformanceLevel(item.value)

    return (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-xl">
            <p className="text-white font-semibold mb-1">{item.subject}</p>
            <p className="text-2xl font-bold" style={{ color: perf.color }}>
                {item.value}<span className="text-sm text-slate-500">/100</span>
            </p>
            <p className="text-slate-400 text-xs mt-1">{perf.level}</p>
            <p className="text-slate-500 text-xs mt-2">{item.description}</p>
        </div>
    )
}

export function CandidateRadarChart({ data }: { data: ChartData }) {
    const [showDetails, setShowDetails] = useState<boolean>(false)

    const chartData: RadarData[] = [
        { subject: 'Communication', value: data.comm || 0, description: "Clarté d'expression, capacité à vulgariser" },
        { subject: 'Clarification', value: data.clarif || 0, description: 'Pose de questions pertinentes, reformulation' },
        { subject: 'Technique (QCM)', value: data.qcm || 0, description: 'Connaissances théoriques du domaine' },
    ]

    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-700">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                            <RadarIcon className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-lg">Signature de Performance</h3>
                            <p className="text-slate-400 text-sm">Profil moyen des candidats en entretien</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="text-slate-400 hover:text-purple-400 transition-colors"
                    >
                        <HelpCircle className="w-5 h-5" />
                    </button>
                </div>

                {showDetails && (
                    <div className="mt-4 p-4 bg-blue-900/20 border border-blue-500/20 rounded-xl">
                        <h4 className="text-blue-300 font-semibold text-sm mb-2">📐 Comment interpréter ce radar ?</h4>
                        <div className="space-y-2 text-sm text-slate-300">
                            <p>Le graphique radar visualise les forces et faiblesses moyennes des candidats sur 3 axes d'évaluation.</p>
                            <ul className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                                <li><strong className="text-purple-400">Communication</strong> : Capacité à s'exprimer clairement</li>
                                <li><strong className="text-purple-400">Clarification</strong> : Aptitude à poser les bonnes questions</li>
                                <li><strong className="text-purple-400">Technique QCM</strong> : Connaissances fondamentales</li>
                            </ul>
                            <p className="text-slate-400 text-xs mt-2">💡 Plus la zone est étendue, meilleure est la performance globale du vivier de candidats.</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-5">
                <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
                            <PolarGrid stroke="#334155" />
                            <PolarAngleAxis
                                dataKey="subject"
                                tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
                            />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 9 }} />
                            <Radar
                                name="Score moyen"
                                dataKey="value"
                                stroke="#8b5cf6"
                                strokeWidth={3}
                                fill="#8b5cf6"
                                fillOpacity={0.25}
                            />
                            <Tooltip content={<CustomTooltip />} />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>

                {/* Résumé des performances */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {chartData.map((item) => {
                        const perf = getPerformanceLevel(item.value)
                        return (
                            <div key={item.subject} className="text-center p-2 bg-slate-900/40 rounded-lg">
                                <p className="text-slate-400 text-xs mb-1">{item.subject}</p>
                                <p className="text-lg font-bold" style={{ color: perf.color }}>{item.value}%</p>
                                <p className="text-xs" style={{ color: perf.color }}>{perf.level}</p>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}