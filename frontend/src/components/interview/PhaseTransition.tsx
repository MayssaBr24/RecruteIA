import { useEffect, useState } from 'react'

const PHASE_LABELS: Record<string, string> = {
    communication:    'Communication',
    cv_clarification: 'Parcours CV',
    scenario:         'Mise en situation',
    technical:        'QCM Technique',
}

interface Props {
    completedPhase: string
    nextPhase: string
    phaseScore: number | null
    nextPhaseInfo: string
}

export function PhaseTransition({ completedPhase, nextPhase, phaseScore, nextPhaseInfo }: Props) {
    const [count, setCount] = useState(3)

    useEffect(() => {
        const t = setInterval(() => setCount(p => Math.max(0, p - 1)), 1000)
        return () => clearInterval(t)
    }, [])

    const scoreColor =
        phaseScore === null ? 'rgba(255,255,255,0.5)'
            : phaseScore >= 75  ? '#4ade80'
                : phaseScore >= 50  ? '#fbbf24'
                    : '#f87171'

    return (
        <div className="flex flex-col items-center justify-center gap-8 text-center px-6">

            {/* Score de la phase terminée */}
            {phaseScore !== null && (
                <div className="flex flex-col items-center gap-2">
                    <p className="text-xs font-medium tracking-widest uppercase" style={{ color:'rgba(255,255,255,0.3)' }}>
                        Phase {PHASE_LABELS[completedPhase] || completedPhase} — Score
                    </p>
                    <div className="text-6xl font-light" style={{ color: scoreColor, letterSpacing:'-0.03em' }}>
                        {phaseScore}
                        <span className="text-2xl" style={{ color:'rgba(255,255,255,0.2)' }}>/100</span>
                    </div>
                </div>
            )}

            {/* Séparateur */}
            <div className="w-16 h-px" style={{ background:'rgba(255,255,255,0.08)' }} />

            {/* Prochaine phase */}
            <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full"
                     style={{ background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.2)' }}>
          <span className="text-xs font-medium tracking-widest uppercase" style={{ color:'rgba(251,191,36,0.7)' }}>
            Prochaine phase
          </span>
                    <span className="text-xs font-medium" style={{ color:'#fbbf24' }}>
            {PHASE_LABELS[nextPhase] || nextPhase}
          </span>
                </div>
                {nextPhaseInfo && (
                    <p className="text-sm max-w-sm" style={{ color:'rgba(255,255,255,0.45)' }}>{nextPhaseInfo}</p>
                )}
            </div>

            {/* Compte à rebours */}
            <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-full flex items-center justify-center border" style={{ borderColor:'rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.04)' }}>
                    <span className="text-2xl font-light" style={{ color:'rgba(255,255,255,0.6)' }}>{count}</span>
                </div>
                <p className="text-xs" style={{ color:'rgba(255,255,255,0.25)' }}>Démarrage automatique…</p>
            </div>
        </div>
    )
}