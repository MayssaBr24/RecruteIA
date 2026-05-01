// src/components/interview/PhaseBar.tsx
//
// Corrections :
// ✅ Phase "technical" = questions techniques orales (séparée du QCM)
// ✅ Phase "qcm" = QCM technique (15 min) — nouvelle phase explicite
// ✅ QuestionTimer intégré dans la PhaseBar pour visibilité maximale
// ✅ Labels FR corrects

import type { Phase } from '../../types/interview'
import {QuestionTimer} from "../rh/interviews/Questiontimer.tsx";

const PHASES: { key: Phase; label: string; short: string }[] = [
    { key: 'communication',    label: 'Communication',       short: 'Comm.'   },
    { key: 'cv_clarification', label: 'Parcours CV',         short: 'CV'      },
    { key: 'scenario',         label: 'Mise en situation',   short: 'Scén.'   },
    { key: 'technical',        label: 'Questions Techniques',short: 'Tech.'   },
    { key: 'qcm',              label: 'QCM Technique',       short: 'QCM'     },
]

// Ordre strict pour le calcul de progression
const ORDER: Phase[] = [
    'communication',
    'cv_clarification',
    'scenario',
    'technical',
    'qcm',
    'completed',
]

interface Props {
    current: Phase
    candidateName: string
    jobTitle: string
    /** Secondes restantes pour la question courante (optionnel) */
    timeLimitSeconds?: number
    /** Clé de reset du timer (change à chaque nouvelle question) */
    timerResetKey?: string
    /** Appelé quand le timer expire */
    onTimerExpire?: () => void
    /** Si true, le timer est en pause (ex: pendant la soumission) */
    timerPaused?: boolean
}

export function PhaseBar({
                             current,
                             candidateName,
                             jobTitle,
                             timeLimitSeconds,
                             timerResetKey,
                             onTimerExpire,
                             timerPaused,
                         }: Props) {
    const currentIdx = ORDER.indexOf(current)

    return (
        <header
            className="fixed top-0 left-0 right-0 z-50 px-6 py-4"
            style={{
                background:    'rgba(8,8,12,0.88)',
                backdropFilter:'blur(20px)',
                borderBottom:  '1px solid rgba(255,255,255,0.06)',
            }}
        >
            <div className="max-w-5xl mx-auto flex items-center gap-6">

                {/* Infos candidat */}
                <div className="flex-shrink-0 min-w-0">
                    <p
                        className="text-xs font-medium tracking-widest uppercase mb-0.5"
                        style={{ color: 'rgba(251,191,36,0.65)' }}
                    >
                        {jobTitle}
                    </p>
                    <p
                        className="text-sm font-medium truncate"
                        style={{ color: 'rgba(255,255,255,0.85)' }}
                    >
                        {candidateName}
                    </p>
                </div>

                {/* Phases */}
                <div className="flex items-center gap-2 flex-1 justify-center">
                    {PHASES.map((ph, i) => {
                        const done   = ORDER.indexOf(ph.key) < currentIdx
                        const active = ph.key === current
                        return (
                            <div key={ph.key} className="flex items-center gap-2">
                                {i > 0 && (
                                    <div
                                        className="h-px w-5 flex-shrink-0"
                                        style={{
                                            background: done
                                                ? 'rgba(251,191,36,0.45)'
                                                : 'rgba(255,255,255,0.08)',
                                        }}
                                    />
                                )}
                                <div
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-500"
                                    style={{
                                        background: active
                                            ? 'rgba(251,191,36,0.12)'
                                            : done
                                                ? 'rgba(251,191,36,0.05)'
                                                : 'rgba(255,255,255,0.03)',
                                        border: active
                                            ? '1px solid rgba(251,191,36,0.38)'
                                            : done
                                                ? '1px solid rgba(251,191,36,0.14)'
                                                : '1px solid rgba(255,255,255,0.06)',
                                        color: active
                                            ? '#fbbf24'
                                            : done
                                                ? 'rgba(251,191,36,0.55)'
                                                : 'rgba(255,255,255,0.22)',
                                    }}
                                >
                                    {done && (
                                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                            <path
                                                d="M2 5l2 2 4-4"
                                                stroke="currentColor"
                                                strokeWidth="1.5"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                    )}
                                    <span className="hidden sm:inline">{ph.label}</span>
                                    <span className="sm:hidden">{ph.short}</span>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Timer — visible uniquement si timeLimitSeconds fourni et phase active */}
                {timeLimitSeconds && timeLimitSeconds > 0 && timerResetKey &&
                    current !== 'completed' && current !== 'qcm' && (
                        <div className="flex-shrink-0">
                            <QuestionTimer
                                totalSeconds={timeLimitSeconds}
                                resetKey={timerResetKey}
                                onExpire={onTimerExpire}
                                paused={timerPaused}
                            />
                        </div>
                    )}

                {/* Badge "Entretien IA" si pas de timer */}
                {(!timeLimitSeconds || current === 'qcm') && (
                    <div
                        className="flex-shrink-0 text-xs tracking-widest uppercase"
                        style={{ color: 'rgba(255,255,255,0.12)' }}
                    >
                        Entretien IA
                    </div>
                )}
            </div>
        </header>
    )
}