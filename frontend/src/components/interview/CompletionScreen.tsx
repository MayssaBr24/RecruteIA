// src/components/interview/CompletionScreen.tsx
import { useEffect, useRef } from 'react'
import type { FinalizeResponse } from '../../types/interview'

interface Props { finalData: FinalizeResponse | null }

export function CompletionScreen({ finalData }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    // Confetti minimaliste
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight

        const particles = Array.from({ length: 60 }, () => ({
            x: Math.random() * canvas.width,
            y: -20,
            vy: 1.5 + Math.random() * 2.5,
            vx: (Math.random() - 0.5) * 1.5,
            size: 3 + Math.random() * 4,
            color: ['#fbbf24','#a78bfa','#34d399','#60a5fa','#f87171'][Math.floor(Math.random() * 5)],
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 4,
            opacity: 0.8 + Math.random() * 0.2,
        }))

        let frame = 0
        let raf: number
        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            frame++
            particles.forEach(p => {
                p.y += p.vy
                p.x += p.vx
                p.rotation += p.rotationSpeed
                ctx.save()
                ctx.globalAlpha = p.opacity * Math.max(0, 1 - p.y / canvas.height)
                ctx.translate(p.x, p.y)
                ctx.rotate((p.rotation * Math.PI) / 180)
                ctx.fillStyle = p.color
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
                ctx.restore()
            })
            if (frame < 180) raf = requestAnimationFrame(animate)
            else { ctx.clearRect(0, 0, canvas.width, canvas.height) }
        }
        raf = requestAnimationFrame(animate)
        return () => cancelAnimationFrame(raf)
    }, [])

    const score = finalData?.final_score ?? null
    const breakdown = finalData?.breakdown
    const feedback = finalData?.candidate_feedback

    const scoreColor = score === null ? '#fbbf24' : score >= 75 ? '#4ade80' : score >= 50 ? '#fbbf24' : '#f87171'

    const phases = breakdown ? [
        { label: 'Communication',    value: breakdown.communication,    color:'#60a5fa' },
        { label: 'Parcours CV',      value: breakdown.cv_clarification, color:'#a78bfa' },
        { label: 'Mise en situation',value: breakdown.scenario,         color:'#fbbf24' },
        { label: 'QCM Technique',    value: breakdown.qcm,              color:'#34d399' },
    ].filter(p => p.value > 0) : []

    return (
        <div className="relative flex flex-col items-center gap-10 text-center px-6 pb-16">
            <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{ zIndex:10 }} />

            {/* Icône succès */}
            <div className="w-20 h-20 rounded-full flex items-center justify-center mt-8"
                 style={{ background:'rgba(251,191,36,0.1)', border:'1px solid rgba(251,191,36,0.25)' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
            </div>

            {/* Titre */}
            <div className="flex flex-col gap-3">
                <h1 className="text-4xl font-light" style={{ color:'rgba(255,255,255,0.92)', letterSpacing:'-0.02em' }}>
                    Entretien terminé
                </h1>
                <p className="text-base" style={{ color:'rgba(255,255,255,0.4)' }}>
                    Merci pour votre participation. Vos réponses ont bien été enregistrées.
                </p>
            </div>

            {/* Score global */}
            {score !== null && (
                <div className="flex flex-col items-center gap-2">
                    <p className="text-xs font-medium tracking-widest uppercase" style={{ color:'rgba(255,255,255,0.3)' }}>Score global</p>
                    <div className="text-7xl font-light" style={{ color: scoreColor, letterSpacing:'-0.03em' }}>
                        {score}
                        <span className="text-3xl" style={{ color:'rgba(255,255,255,0.2)' }}>/100</span>
                    </div>
                    {breakdown?.warnings_penalty !== undefined && (
                        <p className="text-xs" style={{ color:'rgba(239,68,68,0.6)' }}>
                            Pénalité fraude appliquée : -{breakdown.warnings_penalty} pts
                        </p>
                    )}
                </div>
            )}

            {/* Détail scores par phase */}
            {phases.length > 0 && (
                <div className="w-full max-w-md flex flex-col gap-3">
                    <p className="text-xs font-medium tracking-widest uppercase text-left mb-1" style={{ color:'rgba(255,255,255,0.25)' }}>
                        Détail par phase
                    </p>
                    {phases.map(p => (
                        <div key={p.label} className="flex items-center gap-4">
                            <span className="text-xs w-36 text-right" style={{ color:'rgba(255,255,255,0.4)' }}>{p.label}</span>
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,0.06)' }}>
                                <div className="h-full rounded-full transition-all duration-1000"
                                     style={{ width:`${p.value}%`, background: p.color, opacity: 0.7 }} />
                            </div>
                            <span className="text-xs w-8 text-left font-mono" style={{ color:'rgba(255,255,255,0.4)' }}>{p.value}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Feedback candidat */}
            {feedback && (
                <div className="w-full max-w-lg rounded-2xl p-6 text-left"
                     style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)' }}>
                    <p className="text-xs font-medium tracking-widest uppercase mb-3" style={{ color:'rgba(255,255,255,0.25)' }}>
                        Retour de l'équipe RH
                    </p>
                    <p className="text-sm leading-relaxed" style={{ color:'rgba(255,255,255,0.65)' }}>{feedback}</p>
                </div>
            )}

            {/* Message final */}
            <p className="text-xs max-w-sm" style={{ color:'rgba(255,255,255,0.2)' }}>
                Vous pouvez fermer cette fenêtre. L'équipe RH prendra contact avec vous prochainement.
            </p>
        </div>
    )
}