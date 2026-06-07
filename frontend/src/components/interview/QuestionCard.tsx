import { useState, useRef, useEffect } from 'react'
import { useAudioRecorder } from '../../hooks/useAudioRecorder'

// ── Type retour de stopAndTranscribe ──────────────────────────────────────────
interface AudioResult {
    text?:    string | null
    metrics?: Record<string, unknown>
}

interface Props {
    question:          string
    questionIndex:     number
    totalQuestions:    number
    phase:             string
    token:             string
    submitting:        boolean
    onSubmit:          (answer: string) => void
    onVoiceResult?:    (result: Record<string, unknown>) => void
    timeLimitSeconds?: number
    timerResetKey?:    string
}

export function QuestionCard({
                                 question, questionIndex, totalQuestions, phase, token,
                                 submitting, onSubmit,
                                 onVoiceResult,
                                 // timeLimitSeconds et timerResetKey reçus mais gérés par le parent via PhaseBar
                             }: Props) {
    const [answer, setAnswer] = useState<string>('')
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const prevQuestionRef = useRef<string>('')

    const {
        isRecording, isTranscribing,
        error: audioError,
        start, stopAndTranscribe,
    } = useAudioRecorder(token)

    const questionText: string = typeof question === 'string'
        ? question
        : (question as Record<string, unknown>)?.question as string ?? String(question ?? '')

    // ── Reset answer sans setState synchrone dans effect ─────────────────────
    // La key={timerResetKey} dans le parent remonte le composant → answer revient à ''
    // Ce useEffect ne fait que le focus, sans setState
    useEffect(() => {
        if (prevQuestionRef.current !== questionText) {
            prevQuestionRef.current = questionText
            // Reset via ref directement sur le DOM — pas de setState
            if (textareaRef.current) {
                textareaRef.current.value = ''
                textareaRef.current.focus()
            }
        }
    }, [questionText])

    // ── Auto-resize textarea ──────────────────────────────────────────────────
    useEffect(() => {
        const ta = textareaRef.current
        if (!ta) return
        ta.style.height = 'auto'
        ta.style.height = `${ta.scrollHeight}px`
    }, [answer])

    // ── Micro ─────────────────────────────────────────────────────────────────
    const handleMicClick = async () => {
        if (isRecording) {
            const result: AudioResult = await stopAndTranscribe()
            if (result.text) {
                setAnswer(prev => prev ? `${prev} ${result.text ?? ''}` : result.text ?? '')
            }
            if (result.metrics && onVoiceResult) {
                onVoiceResult(result.metrics)
            }
        } else {
            await start()
        }
    }

    // ── Soumission ────────────────────────────────────────────────────────────
    const handleSubmit = () => {
        const trimmed = answer.trim()
        if (!trimmed || submitting) return
        onSubmit(trimmed)
        setAnswer('')
    }

    const handleKey = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
    }

    const phaseLabel: Record<string, string> = {
        communication:    'Communication',
        cv_clarification: 'Clarification CV',
        scenario:         'Mise en situation',
        technical:        'Technique',
    }

    return (
        <div className="w-full max-w-2xl mx-auto flex flex-col gap-6">

            {/* En-tête de phase */}
            <div className="flex items-center justify-between">
                <span
                    className="text-xs font-medium tracking-widest uppercase px-3 py-1 rounded-full"
                    style={{
                        background: 'rgba(251,191,36,0.08)',
                        border:     '1px solid rgba(251,191,36,0.2)',
                        color:      'rgba(251,191,36,0.7)',
                    }}
                >
                    {phaseLabel[phase] || phase}
                </span>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    Question {questionIndex + 1} / {totalQuestions}
                </span>
            </div>

            {/* Question */}
            <div
                className="rounded-2xl p-8"
                style={{
                    background: 'rgba(255,255,255,0.03)',
                    border:     '1px solid rgba(255,255,255,0.07)',
                }}
            >
                <p
                    className="text-2xl font-light leading-relaxed"
                    style={{ color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.01em' }}
                >
                    {questionText}
                </p>
            </div>

            {/* Zone de réponse */}
            <div className="flex flex-col gap-3">
                <div
                    className="relative rounded-xl overflow-hidden"
                    style={{
                        background: 'rgba(255,255,255,0.04)',
                        border:     '1px solid rgba(255,255,255,0.09)',
                    }}
                >
                    <textarea
                        ref={textareaRef}
                        value={answer}
                        onChange={e => setAnswer(e.target.value)}
                        onKeyDown={handleKey}
                        placeholder="Rédigez votre réponse ici… (Ctrl+Entrée pour valider)"
                        disabled={submitting || isTranscribing}
                        className="w-full bg-transparent resize-none outline-none px-5 pt-4 pb-16 text-base leading-relaxed"
                        style={{
                            color:      'rgba(255,255,255,0.85)',
                            minHeight:  120,
                            caretColor: '#fbbf24',
                        }}
                        rows={4}
                    />

                    {/* Barre d'outils */}
                    <div
                        className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-3"
                        style={{
                            borderTop:  '1px solid rgba(255,255,255,0.06)',
                            background: 'rgba(8,8,12,0.5)',
                        }}
                    >
                        {/* Bouton micro */}
                        <button
                            onClick={handleMicClick}
                            disabled={submitting}
                            title={isRecording ? "Arrêter l'enregistrement" : 'Répondre avec le microphone'}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
                            style={{
                                background: isRecording
                                    ? 'rgba(239,68,68,0.15)'
                                    : 'rgba(255,255,255,0.05)',
                                border: isRecording
                                    ? '1px solid rgba(239,68,68,0.35)'
                                    : '1px solid rgba(255,255,255,0.08)',
                                color: isRecording ? '#f87171' : 'rgba(255,255,255,0.4)',
                            }}
                        >
                            {isRecording ? (
                                <>
                                    <span className="inline-block w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                                    Arrêter
                                </>
                            ) : isTranscribing ? (
                                <span style={{ color: 'rgba(251,191,36,0.7)' }}>Transcription…</span>
                            ) : (
                                <><MicIcon /> Microphone</>
                            )}
                        </button>

                        {audioError && (
                            <span className="text-xs" style={{ color: 'rgba(239,68,68,0.7)' }}>
                                {audioError}
                            </span>
                        )}

                        {/* Bouton valider */}
                        <button
                            onClick={handleSubmit}
                            disabled={!answer.trim() || submitting}
                            className="flex items-center gap-2 px-5 py-1.5 rounded-lg text-sm font-medium transition-all duration-200"
                            style={{
                                background: answer.trim() && !submitting
                                    ? 'rgba(251,191,36,0.15)'
                                    : 'rgba(255,255,255,0.04)',
                                border: answer.trim() && !submitting
                                    ? '1px solid rgba(251,191,36,0.35)'
                                    : '1px solid rgba(255,255,255,0.06)',
                                color: answer.trim() && !submitting
                                    ? '#fbbf24'
                                    : 'rgba(255,255,255,0.2)',
                                cursor: answer.trim() && !submitting ? 'pointer' : 'not-allowed',
                            }}
                        >
                            {submitting
                                ? <span className="inline-block w-3 h-3 rounded-full border border-amber-400/50 border-t-amber-400 animate-spin" />
                                : <ArrowIcon />
                            }
                            {submitting ? 'Envoi…' : 'Répondre'}
                        </button>
                    </div>
                </div>

                <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.18)' }}>
                    Ctrl + Entrée pour valider · Prenez le temps de développer votre réponse
                </p>
            </div>
        </div>
    )
}

function MicIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
    )
}

function ArrowIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
        </svg>
    )
}