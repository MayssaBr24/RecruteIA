// src/components/rh/analytics/GrowthMatrix.tsx

import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { TrendingUp, Target } from 'lucide-react'
import { useState } from 'react'

// Types pour les données
interface MatrixData {
    candidate_name?: string
    communication_score: number
    qcm_score: number
    ai_interview_score: number
}

interface CustomTooltipProps {
    active?: boolean
    payload?: Array<{
        payload: MatrixData
    }>
}

interface QuadrantInfo {
    zone: string
    color: string
    advice: string
}

interface GrowthMatrixProps {
    data: MatrixData[]
}

// Fonctions helpers
const getQuadrantInfo = (comm: number, tech: number): QuadrantInfo => {
    if (comm >= 70 && tech >= 70) {
        return { zone: "🌟 Élite", color: "text-purple-400", advice: "Top priorité - Profil d'exception" }
    }
    if (comm >= 70 && tech < 70) {
        return { zone: "💬 Communicateur", color: "text-blue-400", advice: "Bon communicateur, à renforcer techniquement" }
    }
    if (comm < 70 && tech >= 70) {
        return { zone: "🔧 Technicien", color: "text-emerald-400", advice: "Solide techniquement, à développer en communication" }
    }
    return { zone: "📈 À développer", color: "text-amber-400", advice: "Potentiel à explorer sur les deux axes" }
}

// Composant Tooltip défini en dehors du render
const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
    if (!active || !payload?.length) return null
    const p = payload[0].payload
    const quadrant = getQuadrantInfo(p.communication_score, p.qcm_score)

    return (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 shadow-xl max-w-xs">
            <p className="text-white font-semibold mb-2">{p.candidate_name || 'Candidat'}</p>
            <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                    <span className="text-slate-400">Communication</span>
                    <span className="text-white font-bold">{p.communication_score}%</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-slate-400">Technique (QCM)</span>
                    <span className="text-white font-bold">{p.qcm_score}%</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-slate-400">Score global</span>
                    <span className="text-purple-400 font-bold">{p.ai_interview_score}%</span>
                </div>
                <div className="pt-2 border-t border-slate-700">
                    <div className={`text-xs font-semibold ${quadrant.color}`}>{quadrant.zone}</div>
                    <div className="text-slate-400 text-xs mt-1">{quadrant.advice}</div>
                </div>
            </div>
        </div>
    )
}

export function GrowthMatrix({ data }: GrowthMatrixProps) {
    const [showGuide, setShowGuide] = useState<boolean>(false)

    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-700">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                            <Target className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-lg">Matrice de Croissance</h3>
                            <p className="text-slate-400 text-sm">Communication vs Compétences techniques</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowGuide(!showGuide)}
                        className="text-slate-400 hover:text-purple-400 transition-colors text-sm flex items-center gap-1"
                    >
                        <TrendingUp className="w-4 h-4" />
                        Guide
                    </button>
                </div>

                {showGuide && (
                    <div className="mt-4 p-4 bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded-xl border border-purple-500/20">
                        <h4 className="text-purple-300 font-semibold text-sm mb-2">📊 Comment lire cette matrice ?</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-slate-300 mb-2">🔍 <strong className="text-white">Lecture du graphique</strong></p>
                                <ul className="space-y-1 text-slate-400">
                                    <li>• <strong className="text-purple-400">Axe X</strong> : Score en Communication (0-100%)</li>
                                    <li>• <strong className="text-purple-400">Axe Y</strong> : Score Technique QCM (0-100%)</li>
                                    <li>• <strong className="text-purple-400">Taille bulle</strong> : Score global à l'entretien</li>
                                </ul>
                            </div>
                            <div>
                                <p className="text-slate-300 mb-2">🎯 <strong className="text-white">Les 4 zones stratégiques</strong></p>
                                <ul className="space-y-1 text-slate-400">
                                    <li>• 🌟 <strong className="text-purple-400">Zone Élite</strong> (haut-droite) : Profils complets</li>
                                    <li>• 💬 <strong className="text-blue-400">Zone Communicateur</strong> : À renforcer techniquement</li>
                                    <li>• 🔧 <strong className="text-emerald-400">Zone Technicien</strong> : À développer en soft skills</li>
                                    <li>• 📈 <strong className="text-amber-400">Zone À développer</strong> : Potentiel à explorer</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-5">
                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <XAxis
                                type="number"
                                dataKey="communication_score"
                                name="Communication"
                                unit="%"
                                domain={[0, 100]}
                                tick={{ fill: '#94a3b8', fontSize: 11 }}
                                label={{ value: 'Score Communication →', position: 'bottom', fill: '#64748b', fontSize: 11 }}
                            />
                            <YAxis
                                type="number"
                                dataKey="qcm_score"
                                name="Technique"
                                unit="%"
                                domain={[0, 100]}
                                tick={{ fill: '#94a3b8', fontSize: 11 }}
                                label={{ value: '↑ Score Technique', angle: -90, position: 'left', fill: '#64748b', fontSize: 11 }}
                            />
                            <ZAxis type="number" dataKey="ai_interview_score" range={[60, 400]} />

                            {/* Lignes de référence quadrant */}
                            <ReferenceLine x={70} stroke="#475569" strokeDasharray="3 3" />
                            <ReferenceLine y={70} stroke="#475569" strokeDasharray="3 3" />

                            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                            <Scatter
                                name="Candidats"
                                data={data}
                                fill="#8b5cf6"
                                fillOpacity={0.6}
                                stroke="#a78bfa"
                                strokeWidth={1}
                            />
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>

                <div className="mt-4 p-3 bg-slate-900/40 rounded-lg">
                    <p className="text-slate-400 text-xs text-center">
                        💡 <strong className="text-purple-400">Conseil :</strong> Les candidats dans le quadrant supérieur droit (Élite) sont les plus prometteurs.
                        Priorisez-les pour les recrutements stratégiques.
                    </p>
                </div>
            </div>
        </div>
    )
}