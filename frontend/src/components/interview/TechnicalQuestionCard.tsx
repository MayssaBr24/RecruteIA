
import { useState, useRef, useCallback } from 'react'

interface Props {
    question:          string
    questionIndex:     number
    totalQuestions:    number
    angle?:            string
    token:             string
    submitting:        boolean
    onSubmit:          (answer: string) => void
    onVoiceResult?:    (result: any) => void
    timeLimitSeconds?: number
    timerResetKey?:    string
}

const ANGLE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
    architecture:         { label: 'Architecture',         icon: '⬡', color: '#818cf8' },
    technologies:         { label: 'Choix technologiques', icon: '⚙', color: '#34d399' },
    securite_performance: { label: 'Séc. & Performance',   icon: '⚡', color: '#fb923c' },
    contribution:         { label: 'Contribution équipe',  icon: '◈', color: '#f472b6' },
}

const MIN_CHARS = 30

export function TechnicalQuestionCard({
                                          question,
                                          questionIndex,
                                          totalQuestions,
                                          angle,

                                          submitting,
                                          onSubmit,

                                      }: Props) {
    const [answer, setAnswer]     = useState('')
    const [charCount, setCharCount] = useState(0)
    const [touched, setTouched]   = useState(false)   // ← pour n'afficher l'erreur qu'après 1er clic
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const angleInfo = angle ? ANGLE_LABELS[angle] : null
    const isEnough  = answer.trim().length >= MIN_CHARS
    // ✅ canSubmit ne dépend QUE de isEnough et submitting — pas d'autre garde
    const canSubmit = isEnough && !submitting

    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value
        setAnswer(val)
        setCharCount(val.length)
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
        }
    }, [])

    const handleSubmit = useCallback(() => {
        setTouched(true)
        if (!canSubmit) return
        // ✅ Reset local avant d'appeler le parent
        const trimmed = answer.trim()
        setAnswer('')
        setCharCount(0)
        setTouched(false)
        if (textareaRef.current) textareaRef.current.style.height = 'auto'
        onSubmit(trimmed)
    }, [answer, canSubmit, onSubmit])

    // Afficher le message d'erreur seulement si le candidat a cliqué sans assez de texte
    const showError = touched && !isEnough && !submitting

    return (
        <div
            className="w-full max-w-3xl mx-auto"
            style={{ animation: 'fadeSlideUp 0.4s ease both' }}
        >
            <style>{`
                @keyframes fadeSlideUp {
                    from { opacity: 0; transform: translateY(18px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>

            {/* ── En-tête ─────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    {/* Badge phase */}
                    <div
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                        style={{
                            background: 'rgba(129,140,248,0.08)',
                            border: '1px solid rgba(129,140,248,0.18)',
                        }}
                    >
                        <span style={{
                            fontSize: 10, color: '#818cf8',
                            letterSpacing: '0.12em', fontWeight: 700, textTransform: 'uppercase',
                        }}>
                            Questions Techniques
                        </span>
                    </div>

                    {/* Badge angle */}
                    {angleInfo && (
                        <div
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md"
                            style={{
                                background: `${angleInfo.color}0f`,
                                border: `1px solid ${angleInfo.color}28`,
                            }}
                        >
                            <span style={{ fontSize: 11, color: angleInfo.color }}>{angleInfo.icon}</span>
                            <span style={{ fontSize: 10, color: angleInfo.color, fontWeight: 600 }}>
                                {angleInfo.label}
                            </span>
                        </div>
                    )}
                </div>

                {/* Compteur question */}
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.22)', fontVariantNumeric: 'tabular-nums' }}>
                    {questionIndex + 1} / {totalQuestions}
                </span>
            </div>

            {/* ── Carte principale ─────────────────────────────────────────── */}
            <div
                className="relative overflow-hidden rounded-2xl p-6"
                style={{
                    background: 'rgba(14,14,22,0.95)',
                    border: '1px solid rgba(129,140,248,0.14)',
                    boxShadow: '0 0 0 1px rgba(129,140,248,0.04), 0 24px 60px rgba(0,0,0,0.5)',
                }}
            >
                {/* Fond scanline déco */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background: 'linear-gradient(transparent 50%, rgba(129,140,248,0.012) 50%)',
                        backgroundSize: '100% 4px',
                        zIndex: 0,
                    }}
                />
                <div
                    className="absolute top-0 right-0 w-24 h-24 pointer-events-none"
                    style={{
                        background: 'radial-gradient(circle at top right, rgba(129,140,248,0.07), transparent 70%)',
                    }}
                />

                <div className="relative z-10">
                    {/* Label question */}
                    <div
                        className="mb-2 flex items-center gap-2"
                        style={{ color: 'rgba(129,140,248,0.6)', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em' }}
                    >
                        <span style={{
                            display: 'inline-block', width: 6, height: 6,
                            borderRadius: 2, background: 'rgba(129,140,248,0.5)', marginRight: 2,
                        }} />
                        QUESTION
                    </div>

                    {/* Texte question */}
                    <p
                        className="mb-6 leading-relaxed"
                        style={{ fontSize: 17, color: 'rgba(255,255,255,0.92)', fontWeight: 400, lineHeight: 1.7 }}
                    >
                        {question}
                    </p>

                    {/* ── Zone de réponse ─────────────────────────────────── */}
                    <div
                        className="relative rounded-xl overflow-hidden mb-4"
                        style={{
                            background: 'rgba(0,0,0,0.35)',
                            border: showError
                                ? '1px solid rgba(239,68,68,0.35)'   // ← rouge si erreur
                                : '1px solid rgba(129,140,248,0.12)',
                            transition: 'border-color 0.2s ease',
                        }}
                    >
                        {/* Barre titre "terminal" */}
                        <div
                            className="px-4 pt-3 pb-1 flex items-center gap-2"
                            style={{ borderBottom: '1px solid rgba(129,140,248,0.07)' }}
                        >
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(239,68,68,0.5)', display: 'inline-block' }} />
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(251,191,36,0.5)', display: 'inline-block' }} />
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(34,197,94,0.5)', display: 'inline-block' }} />
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.15)', marginLeft: 8, letterSpacing: '0.08em' }}>
                                votre_réponse.txt
                            </span>
                        </div>

                        <textarea
                            ref={textareaRef}
                            value={answer}
                            onChange={handleChange}
                            disabled={submitting}
                            placeholder="Décrivez votre approche avec des exemples concrets — architecture, décisions techniques, résultats mesurables…"
                            rows={6}
                            className="w-full resize-none outline-none bg-transparent"
                            style={{
                                padding: '16px',
                                fontSize: 14,
                                lineHeight: 1.7,
                                color: 'rgba(255,255,255,0.82)',
                                caretColor: '#818cf8',
                                fontFamily: "'DM Sans', sans-serif",
                                opacity: submitting ? 0.5 : 1,
                            }}
                        />

                        {/* Pied : compteur + barre progression */}
                        <div className="px-4 pb-3 flex items-center justify-between">
                            {/* ✅ Message d'erreur visible si trop court */}
                            {showError ? (
                                <span style={{ fontSize: 11, color: 'rgba(239,68,68,0.75)', fontWeight: 500 }}>
                                    ✕ Réponse trop courte — encore {MIN_CHARS - answer.trim().length} caractères
                                </span>
                            ) : (
                                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.15)', letterSpacing: '0.06em' }}>
                                    {isEnough
                                        ? `${charCount} car. ✓`
                                        : `min. ${MIN_CHARS} car. (${MIN_CHARS - answer.trim().length} restants)`
                                    }
                                </span>
                            )}

                            {/* Barre de progression */}
                            <div style={{
                                width: 60, height: 2, borderRadius: 99,
                                background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
                            }}>
                                <div style={{
                                    height: '100%',
                                    width: `${Math.min(100, (answer.trim().length / MIN_CHARS) * 100)}%`,
                                    background: isEnough
                                        ? 'rgba(34,197,94,0.7)'
                                        : showError
                                            ? 'rgba(239,68,68,0.5)'
                                            : 'rgba(129,140,248,0.4)',
                                    borderRadius: 99,
                                    transition: 'width 0.15s ease, background 0.3s ease',
                                }} />
                            </div>
                        </div>
                    </div>

                    {/* ── Aide méthode STAR ────────────────────────────────── */}
                    <div
                        className="mb-5 px-4 py-3 rounded-xl flex items-start gap-3"
                        style={{
                            background: 'rgba(129,140,248,0.04)',
                            border: '1px solid rgba(129,140,248,0.08)',
                        }}
                    >
                        <span style={{ fontSize: 12, color: 'rgba(129,140,248,0.5)', marginTop: 1 }}>💡</span>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6 }}>
                            Structurez votre réponse :{' '}
                            <strong style={{ color: 'rgba(129,140,248,0.5)' }}>Situation</strong>
                            {' → '}
                            <strong style={{ color: 'rgba(129,140,248,0.5)' }}>Action</strong>
                            {' → '}
                            <strong style={{ color: 'rgba(129,140,248,0.5)' }}>Résultat</strong>.
                            {' '}Mentionnez des technologies, chiffres et décisions concrètes.
                        </p>
                    </div>

                    {/* ── Bouton soumettre ─────────────────────────────────── */}
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}        // ✅ désactivé UNIQUEMENT si en cours d'envoi
                        className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2"
                        style={{
                            background: canSubmit
                                ? 'linear-gradient(135deg, rgba(129,140,248,0.22), rgba(129,140,248,0.12))'
                                : showError
                                    ? 'rgba(239,68,68,0.06)'
                                    : 'rgba(255,255,255,0.03)',
                            border: canSubmit
                                ? '1px solid rgba(129,140,248,0.35)'
                                : showError
                                    ? '1px solid rgba(239,68,68,0.2)'
                                    : '1px solid rgba(255,255,255,0.06)',
                            color: canSubmit
                                ? '#a5b4fc'
                                : showError
                                    ? 'rgba(239,68,68,0.6)'
                                    : 'rgba(255,255,255,0.18)',
                            cursor: submitting ? 'not-allowed' : 'pointer',  // ✅ toujours cliquable (affiche l'erreur)
                            boxShadow: canSubmit ? '0 0 20px rgba(129,140,248,0.08)' : 'none',
                            transition: 'all 0.2s ease',
                        }}
                    >
                        {submitting ? (
                            <>
                                <span className="w-4 h-4 rounded-full border border-indigo-400/30 border-t-indigo-400 animate-spin" />
                                Analyse en cours…
                            </>
                        ) : !isEnough && touched ? (
                            // ✅ Message explicite quand trop court
                            <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                                </svg>
                                Réponse trop courte ({MIN_CHARS - answer.trim().length} caractères manquants)
                            </>
                        ) : (
                            <>
                                Valider la réponse
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M5 12h14M12 5l7 7-7 7"/>
                                </svg>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}