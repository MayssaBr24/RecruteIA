// src/components/interview/QuestionTimer.tsx
//
// Timer visible par le candidat pendant une question.
// - Affiche le temps restant en mm:ss
// - Barre de progression qui se vide
// - Change de couleur selon urgence (vert → orange → rouge)
// - Appelle onExpire quand le temps est écoulé

import { useEffect, useRef, useState } from 'react'

interface Props {
    /** Durée totale en secondes */
    totalSeconds: number
    /** Clé unique pour forcer le reset (ex: `${phase}-${questionIndex}`) */
    resetKey: string
    /** Appelé quand le compte à rebours atteint 0 */
    onExpire?: () => void
    /** Si true, le timer est en pause */
    paused?: boolean
}

export function QuestionTimer({ totalSeconds, resetKey, onExpire, paused = false }: Props) {
    const [remaining, setRemaining] = useState(totalSeconds)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const expiredRef  = useRef(false)

    // Reset complet à chaque changement de resetKey ou totalSeconds
    useEffect(() => {
        setRemaining(totalSeconds)
        expiredRef.current = false
    }, [resetKey, totalSeconds])

    // Décompte
    useEffect(() => {
        if (paused) {
            if (intervalRef.current) clearInterval(intervalRef.current)
            return
        }

        intervalRef.current = setInterval(() => {
            setRemaining(prev => {
                if (prev <= 1) {
                    clearInterval(intervalRef.current!)
                    if (!expiredRef.current) {
                        expiredRef.current = true
                        onExpire?.()
                    }
                    return 0
                }
                return prev - 1
            })
        }, 1000)

        return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
    }, [resetKey, paused, onExpire])

    const ratio    = Math.max(0, remaining / totalSeconds)
    const minutes  = Math.floor(remaining / 60)
    const seconds  = remaining % 60
    const timeStr  = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

    // Couleur selon urgence
    const isUrgent  = ratio < 0.20   // < 20% restant
    const isWarning = ratio < 0.40   // < 40% restant

    const barColor = isUrgent
        ? 'rgba(239,68,68,0.85)'          // rouge
        : isWarning
            ? 'rgba(251,146,60,0.85)'     // orange
            : 'rgba(34,197,94,0.75)'      // vert

    const textColor = isUrgent
        ? 'rgba(239,68,68,0.9)'
        : isWarning
            ? 'rgba(251,146,60,0.9)'
            : 'rgba(255,255,255,0.55)'

    return (
        <div
            className="flex items-center gap-3"
            style={{ minWidth: 120 }}
            aria-label={`Temps restant : ${timeStr}`}
            role="timer"
        >
            {/* Icône horloge */}
            <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke={textColor} strokeWidth="2"
                style={{ flexShrink: 0, transition: 'stroke 0.5s' }}
            >
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
            </svg>

            {/* Affichage mm:ss */}
            <span
                style={{
                    color:      textColor,
                    fontSize:   13,
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '0.04em',
                    transition: 'color 0.5s',
                    ...(isUrgent && remaining > 0 ? { animation: 'timerPulse 1s ease-in-out infinite' } : {}),
                }}
            >
                {timeStr}
            </span>

            {/* Barre de progression */}
            <div
                style={{
                    width:  80,
                    height: 3,
                    borderRadius: 99,
                    background: 'rgba(255,255,255,0.07)',
                    overflow: 'hidden',
                    flexShrink: 0,
                }}
            >
                <div
                    style={{
                        height:     '100%',
                        width:      `${ratio * 100}%`,
                        background: barColor,
                        borderRadius: 99,
                        transition: 'width 1s linear, background 0.5s ease',
                    }}
                />
            </div>

            {/* Animation pulse pour l'urgence */}
            <style>{`
                @keyframes timerPulse {
                    0%, 100% { opacity: 1; }
                    50%       { opacity: 0.45; }
                }
            `}</style>
        </div>
    )
}