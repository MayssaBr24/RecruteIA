
import { useState, useRef, useEffect } from 'react'
import { useAudioRecorder } from '../../hooks/useAudioRecorder'

interface Props {
    question: string
    scenarioTheme: string
    questionIndex: number
    totalScenarios: number
    isContradictionFollowup: boolean
    token: string
    submitting: boolean
    onSubmit: (answer: string) => void
    onVoiceResult?: (result: any) => void  // ✅ nouveau : transmet les métriques vocales
}

export function ScenarioCard({
                                 question, scenarioTheme, questionIndex, totalScenarios,
                                 isContradictionFollowup, token, submitting, onSubmit, onVoiceResult
                             }: Props) {
    const [answer, setAnswer] = useState('')
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const {
        isRecording, isTranscribing, error: audioError,
        start, stopAndTranscribe,
    } = useAudioRecorder(token)

    useEffect(() => { setAnswer(''); textareaRef.current?.focus() }, [question])

    useEffect(() => {
        const ta = textareaRef.current
        if (!ta) return
        ta.style.height = 'auto'
        ta.style.height = `${ta.scrollHeight}px`
    }, [answer])

    const handleMicClick = async () => {
        if (isRecording) {
            // ✅ stopAndTranscribe retourne { text, metrics }
            const result = await stopAndTranscribe()
            if (result?.text) setAnswer(prev => prev ? `${prev} ${result.text}` : result.text)
            // Transmet les métriques vocales au parent
            if (result?.metrics && onVoiceResult) onVoiceResult(result.metrics)
        } else {
            await start()
        }
    }

    const handleSubmit = () => {
        if (!answer.trim() || submitting) return
        onSubmit(answer.trim())
        setAnswer('')
    }

    return (
        <div className="w-full max-w-2xl mx-auto flex flex-col gap-5">

            {/* En-tête */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <span className="text-xs font-medium tracking-widest uppercase px-3 py-1 rounded-full"
                          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: 'rgba(251,191,36,0.7)' }}>
                        Mise en situation
                    </span>
                    {scenarioTheme && (
                        <span className="text-xs font-medium px-3 py-1 rounded-full capitalize"
                              style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)', color: 'rgba(168,85,247,0.75)' }}>
                            {scenarioTheme}
                        </span>
                    )}
                    {isContradictionFollowup && (
                        <span className="text-xs font-medium px-3 py-1 rounded-full"
                              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'rgba(239,68,68,0.7)' }}>
                            Précision demandée
                        </span>
                    )}
                </div>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    Scénario {questionIndex + 1} / {totalScenarios}
                </span>
            </div>

            {/* Carte scénario */}
            <div className="rounded-2xl p-8"
                 style={{
                     background: 'rgba(251,191,36,0.04)',
                     border: '1px solid rgba(251,191,36,0.12)',
                     borderLeft: '3px solid rgba(251,191,36,0.4)',
                 }}>
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center"
                         style={{ background: 'rgba(251,191,36,0.12)' }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                             stroke="rgba(251,191,36,0.8)" strokeWidth="2" strokeLinecap="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                    </div>
                    <span className="text-xs font-medium tracking-wide uppercase"
                          style={{ color: 'rgba(251,191,36,0.5)' }}>Contexte</span>
                </div>
                <p className="text-xl font-light leading-relaxed italic"
                   style={{ color: 'rgba(255,255,255,0.88)', letterSpacing: '-0.01em' }}>
                    {question}
                </p>
            </div>

            {/* Conseil */}
            <p className="text-xs px-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Décrivez les actions concrètes que vous prendriez. Soyez précis et structuré.
            </p>

            {/* Zone de réponse */}
            <div className="relative rounded-xl overflow-hidden"
                 style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
                <textarea
                    ref={textareaRef}
                    value={answer}
                    onChange={e => setAnswer(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit() }}
                    placeholder="Décrivez comment vous géreriez cette situation…"
                    disabled={submitting || isTranscribing}
                    className="w-full bg-transparent resize-none outline-none px-5 pt-4 pb-16 text-base leading-relaxed"
                    style={{ color: 'rgba(255,255,255,0.85)', minHeight: 140, caretColor: '#fbbf24' }}
                    rows={5}
                />

                {/* Barre recording live */}
                {isRecording && (
                    <div className="absolute top-3 right-4 flex items-center gap-1">
                        {[0.4, 0.7, 1, 0.7, 0.4].map((h, i) => (
                            <div key={i}
                                 className="w-0.5 rounded-full animate-pulse"
                                 style={{
                                     height: 12 * h,
                                     background: '#ef4444',
                                     animationDelay: `${i * 0.1}s`,
                                     animationDuration: '0.8s',
                                 }} />
                        ))}
                    </div>
                )}

                <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-3"
                     style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(8,8,12,0.5)' }}>

                    {/* Bouton micro */}
                    <button
                        onClick={handleMicClick}
                        disabled={submitting}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
                        style={{
                            background: isRecording ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
                            border: isRecording ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(255,255,255,0.08)',
                            color: isRecording ? '#f87171' : 'rgba(255,255,255,0.38)',
                        }}>
                        {isRecording ? (
                            <><span className="inline-block w-2 h-2 rounded-full bg-red-400 animate-pulse" /> Arrêter</>
                        ) : isTranscribing ? (
                            <span style={{ color: 'rgba(251,191,36,0.7)' }}>Analyse…</span>
                        ) : (
                            <><MicIcon /> Microphone</>
                        )}
                    </button>

                    {audioError && <span className="text-xs" style={{ color: 'rgba(239,68,68,0.7)' }}>{audioError}</span>}

                    {/* Bouton soumettre */}
                    <button
                        onClick={handleSubmit}
                        disabled={!answer.trim() || submitting}
                        className="flex items-center gap-2 px-5 py-1.5 rounded-lg text-sm font-medium transition-all duration-200"
                        style={{
                            background: answer.trim() && !submitting ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.04)',
                            border: answer.trim() && !submitting ? '1px solid rgba(251,191,36,0.35)' : '1px solid rgba(255,255,255,0.06)',
                            color: answer.trim() && !submitting ? '#fbbf24' : 'rgba(255,255,255,0.2)',
                            cursor: answer.trim() && !submitting ? 'pointer' : 'not-allowed',
                        }}>
                        {submitting
                            ? <span className="inline-block w-3 h-3 rounded-full border border-amber-400/50 border-t-amber-400 animate-spin" />
                            : <ArrowIcon />}
                        {submitting ? 'Envoi…' : 'Répondre'}
                    </button>
                </div>
            </div>
        </div>
    )
}

function MicIcon() {
    return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
}
function ArrowIcon() {
    return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
    </svg>
}