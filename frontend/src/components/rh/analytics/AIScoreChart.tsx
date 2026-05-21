import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { BrainCircuit, HelpCircle } from 'lucide-react'
import { Application } from '../../../hooks/useRHData'
import { useState } from 'react'

interface AIScoreChartProps {
    applications: Application[]
    detailed?: boolean
}

function getBarColor(score: number): string {
    if (score >= 80) return '#10b981'
    if (score >= 60) return '#818cf8'
    if (score >= 40) return '#f59e0b'
    return '#ef4444'
}

function ScoreBand({ color, label, description }: { color: string; label: string; description: string }) {
    return (
        <div className="group relative">
            <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs text-slate-400">{label}</span>
                <HelpCircle className="w-3 h-3 text-slate-500 cursor-help" />
            </div>
            <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-10">
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-slate-300 whitespace-nowrap">
                    {description}
                </div>
            </div>
        </div>
    )
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: { name: string; score: number; decision: string } }[] }) {
    if (!active || !payload?.length) return null
    const d = payload[0].payload

    const getAdvice = (score: number) => {
        if (score >= 80) return "Profil très prometteur, prioriser en entretien"
        if (score >= 60) return "Bon profil, mérite un entretien"
        if (score >= 40) return "Profil à approfondir, compétences partielles"
        return "Profil éloigné des critères, peu recommandé"
    }

    return (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 shadow-xl text-sm max-w-xs">
            <p className="text-white font-semibold mb-2">{d.name}</p>
            <div className="space-y-1.5">
                <div>
                    <p className="text-slate-400 text-xs">Score IA CV</p>
                    <p className="text-white text-xl font-bold">{d.score}<span className="text-slate-500 text-sm">/100</span></p>
                </div>
                <div>
                    <p className="text-slate-400 text-xs">Décision IA</p>
                    <p className="text-purple-400 text-sm">{d.decision || 'En attente'}</p>
                </div>
                <div className="pt-2 border-t border-slate-700">
                    <p className="text-slate-400 text-xs">Recommandation</p>
                    <p className="text-slate-300 text-xs">{getAdvice(d.score)}</p>
                </div>
            </div>
        </div>
    )
}

export function AIScoreChart({ applications = [], detailed = false }: AIScoreChartProps) {
    const [showExplanation, setShowExplanation] = useState(false)

    if (!applications || applications.length === 0) {
        return (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 text-center">
                <BrainCircuit className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">Aucune donnée disponible</p>
                <p className="text-slate-500 text-sm mt-1">Les scores apparaîtront après analyse IA</p>
            </div>
        )
    }

    // Remplacez cette partie dans AIScoreChart.tsx
    const chartData = applications
        .map(app => ({
            name: app.full_name?.split(' ')[0] ?? 'N/A',
            score: typeof app.ai_score === 'boolean' ? (app.ai_score ? 100 : 0) : Number(app.ai_score) || 0,
            decision: app.ai_decision ?? 'PENDING',
            fullName: app.full_name,
            // Si vous avez une date, gardez-la pour le tri
            date: app.created_at ? new Date(app.created_at).getTime() : 0        }))
        .filter(d => d.score > 0)
        .sort((a, b) => a.date - b.date)
        // TRI CHRONOLOGIQUE : Au lieu du .sort par score, on trie par date
        .slice(0, detailed ? 20 : 10)

    const distribution = {
        excellent: chartData.filter(d => d.score >= 80).length,
        bon: chartData.filter(d => d.score >= 60 && d.score < 80).length,
        moyen: chartData.filter(d => d.score >= 40 && d.score < 60).length,
        faible: chartData.filter(d => d.score < 40).length
    }

    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
            {/* Header avec explication */}
            <div className="p-5 border-b border-slate-700">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                            <BrainCircuit className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-lg">Distribution des scores IA de CV</h3>
                            <p className="text-slate-400 text-sm">Analyse des CV par intelligence artificielle</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowExplanation(!showExplanation)}
                        className="text-slate-400 hover:text-purple-400 transition-colors"
                    >
                        <HelpCircle className="w-5 h-5" />
                    </button>
                </div>

                {/* Panneau d'explication */}
                {showExplanation && (
                    <div className="mt-4 p-4 bg-purple-900/20 border border-purple-500/20 rounded-xl">
                        <h4 className="text-purple-300 font-semibold text-sm mb-2">📖 Comment interpréter ce graphique ?</h4>
                        <div className="space-y-2 text-sm text-slate-300">
                            <p>Ce graphique présente le classement des candidats par score IA, du plus prometteur au moins adapté.</p>
                            <ul className="list-disc list-inside space-y-1 ml-2">
                                <li><span className="text-emerald-400">Barres vertes (80+)</span> : Excellents profils, compétences parfaitement alignées</li>
                                <li><span className="text-blue-400">Barres bleues (60-79)</span> : Bons profils, légères lacunes à combler</li>
                                <li><span className="text-amber-400">Barres oranges (40-59)</span> : Profils moyens, nécessitent un approfondissement</li>
                                <li><span className="text-red-400">Barres rouges (&lt;40)</span> : Faible adéquation avec le poste</li>
                            </ul>
                            <p className="text-slate-400 text-xs mt-2">💡 Astuce : Passez la souris sur une barre pour voir les détails du candidat</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Statistiques de distribution */}
            <div className="grid grid-cols-4 gap-2 p-4 border-b border-slate-700 bg-slate-900/30">
                <div className="text-center">
                    <div className="text-emerald-400 text-xl font-bold">{distribution.excellent}</div>
                    <div className="text-slate-400 text-xs">Excellents</div>
                </div>
                <div className="text-center">
                    <div className="text-blue-400 text-xl font-bold">{distribution.bon}</div>
                    <div className="text-slate-400 text-xs">Bons</div>
                </div>
                <div className="text-center">
                    <div className="text-amber-400 text-xl font-bold">{distribution.moyen}</div>
                    <div className="text-slate-400 text-xs">Moyens</div>
                </div>
                <div className="text-center">
                    <div className="text-red-400 text-xl font-bold">{distribution.faible}</div>
                    <div className="text-slate-400 text-xs">Faibles</div>
                </div>
            </div>

            {/* Graphique */}
            <div className="p-5">
                <div className="w-full h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical" margin={{ left: 80, right: 20, top: 5, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" />
                            <XAxis type="number" domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis
                                type="category"
                                dataKey="name"
                                width={70}
                                tick={{ fill: '#94a3b8', fontSize: 12 }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.05)' }} />
                            <Bar dataKey="score" radius={[0, 6, 6, 0]} maxBarSize={10}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={getBarColor(entry.score)} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Légende détaillée */}
                <div className="flex flex-wrap items-center justify-center gap-6 mt-6 pt-4 border-t border-slate-700">
                    <ScoreBand color="#10b981" label="Excellent (80-100)" description="Priorité entretien - Profil très prometteur" />
                    <ScoreBand color="#818cf8" label="Bon (60-79)" description="À convoquer - Bonnes compétences" />
                    <ScoreBand color="#f59e0b" label="Moyen (40-59)" description="À évaluer - Compétences partielles" />
                    <ScoreBand color="#ef4444" label="Faible (&lt;40)" description="Peu recommandé - Écart important" />
                </div>
            </div>
        </div>
    )
}