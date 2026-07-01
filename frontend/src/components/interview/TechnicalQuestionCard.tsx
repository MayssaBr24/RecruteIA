import { useState, useCallback, useMemo, useRef } from 'react'
import { useAudioRecorder } from '../../hooks/useAudioRecorder'

interface CodeSample {
    file_path: string
    repo:      string
    language:  string
    content:   string
}

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
    codeSample?:       CodeSample | null
}

const ANGLE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
    architecture:         { label: 'Architecture',         icon: '⬡',   color: '#818cf8' },
    code_explanation:     { label: 'Explication de code',  icon: '{ }', color: '#34d399' },
    technologies:         { label: 'Choix technologiques', icon: '⚙',   color: '#f59e0b' },
    contribution_tache:   { label: 'Tâche complexe',       icon: '◈',   color: '#f472b6' },
    code_review:          { label: 'Code Review',          icon: '⟳',   color: '#fb923c' },
    securite_performance: { label: 'Séc. & Performance',   icon: '⚡',  color: '#ef4444' },
    contribution:         { label: 'Contribution équipe',  icon: '◈',   color: '#a78bfa' },
}

const LANG_LABELS: Record<string, string> = {
    py: 'Python', ts: 'TypeScript', tsx: 'TSX', js: 'JavaScript',
    jsx: 'JSX', java: 'Java', cs: 'C#', go: 'Go', rb: 'Ruby',
    php: 'PHP', vue: 'Vue', c: 'C', cpp: 'C++', rs: 'Rust',
    kt: 'Kotlin', swift: 'Swift', sh: 'Shell',
}

function CodeBlock({ sample }: { sample: CodeSample }) {
    const [expanded, setExpanded] = useState(false)
    const langLabel = LANG_LABELS[sample.language] || sample.language.toUpperCase()
    const lines     = sample.content.split('\n')
    const hasMore   = lines.length > 20
    const displayed = expanded ? lines : lines.slice(0, 20)

    return (
        <div className="mb-5 rounded-xl overflow-hidden" style={{
            background: 'rgba(0,0,0,0.45)',
            border:     '1px solid rgba(129,140,248,0.18)',
            boxShadow:  '0 2px 16px rgba(0,0,0,0.3)',
        }}>
            <div className="px-4 py-2.5 flex items-center justify-between" style={{
                borderBottom: '1px solid rgba(129,140,248,0.1)',
                background:   'rgba(129,140,248,0.06)',
            }}>
                <div className="flex items-center gap-2">
                    {['#ff5f57', '#febc2e', '#28c840'].map(c => (
                        <span key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, display: 'inline-block' }} />
                    ))}
                    <span style={{ fontSize: 11, color: 'rgba(129,140,248,0.7)', marginLeft: 6, fontFamily: 'monospace' }}>
                        {sample.repo} / {sample.file_path}
                    </span>
                </div>
                <span style={{
                    fontSize: 9, color: 'rgba(129,140,248,0.5)', letterSpacing: '0.1em',
                    background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.15)',
                    borderRadius: 4, padding: '2px 7px', fontFamily: 'monospace',
                }}>
                    {langLabel}
                </span>
            </div>

            <div className="px-4 pt-2 pb-1 flex items-center gap-2" style={{
                background:   'rgba(251,191,36,0.04)',
                borderBottom: '1px solid rgba(251,191,36,0.08)',
            }}>
                <span style={{ fontSize: 10, color: 'rgba(251,191,36,0.6)' }}>💡</span>
                <span style={{ fontSize: 10, color: 'rgba(251,191,36,0.55)', lineHeight: 1.4 }}>
                    Ce code est extrait de votre repo GitHub. Lisez-le attentivement avant de répondre.
                </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <pre style={{
                    margin: 0, padding: '16px',
                    fontSize: 12, lineHeight: 1.65,
                    color: 'rgba(255,255,255,0.82)',
                    fontFamily: '"JetBrains Mono","Fira Code","Cascadia Code",monospace',
                    whiteSpace: 'pre',
                    maxHeight: expanded ? 'none' : '320px',
                    overflow: expanded ? 'visible' : 'hidden',
                    position: 'relative',
                }}>
                    <code>
                        {displayed.map((line, i) => (
                            <span key={i} style={{ display: 'flex', gap: 16 }}>
                                <span style={{
                                    minWidth: 28, color: 'rgba(129,140,248,0.25)',
                                    userSelect: 'none', textAlign: 'right', flexShrink: 0,
                                }}>
                                    {i + 1}
                                </span>
                                <span>{line}</span>
                            </span>
                        ))}
                    </code>

                    {hasMore && !expanded && (
                        <div style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0, height: 64,
                            background: 'linear-gradient(transparent, rgba(0,0,0,0.45))',
                            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                            paddingBottom: 8,
                        }}>
                            <button
                                onClick={() => setExpanded(true)}
                                style={{
                                    fontSize: 11, color: 'rgba(129,140,248,0.7)',
                                    background: 'rgba(129,140,248,0.1)',
                                    border: '1px solid rgba(129,140,248,0.2)',
                                    borderRadius: 6, padding: '3px 12px', cursor: 'pointer',
                                }}
                            >
                                ↓ Voir les {lines.length - 20} lignes suivantes
                            </button>
                        </div>
                    )}
                </pre>

                {hasMore && expanded && (
                    <div style={{ padding: '0 16px 12px', textAlign: 'center' }}>
                        <button
                            onClick={() => setExpanded(false)}
                            style={{
                                fontSize: 11, color: 'rgba(129,140,248,0.5)',
                                background: 'rgba(129,140,248,0.06)',
                                border: '1px solid rgba(129,140,248,0.12)',
                                borderRadius: 6, padding: '3px 12px', cursor: 'pointer',
                            }}
                        >
                            ↑ Réduire
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

export function TechnicalQuestionCard({
                                          question,
                                          questionIndex,
                                          totalQuestions,
                                          angle,
                                          token,
                                          submitting,
                                          onSubmit,
                                          onVoiceResult,
                                          codeSample,
                                      }: Props) {
    // ── FIX 1 : useRef au lieu de useEffect pour reset au changement de question
    // useEffect + setState = cascading renders (ESLint warning)
    // useRef permet de détecter le changement sans déclencher un render supplémentaire
    const prevQuestionRef = useRef<string>(question)

    const [transcript,   setTranscript]   = useState('')
    const [supplement,   setSupplement]   = useState('')
    const [touched,      setTouched]      = useState(false)
    const [showTextZone, setShowTextZone] = useState(false)

    // Reset synchrone pendant le render si la question a changé
    // C'est le pattern recommandé React pour "derived state from props"
    if (prevQuestionRef.current !== question) {
        prevQuestionRef.current = question
        // Ces setState pendant le render sont OK : React les applique
        // dans le même cycle sans cascading renders
        setTranscript('')
        setSupplement('')
        setTouched(false)
        setShowTextZone(false)
    }

    const angleInfo = angle ? ANGLE_LABELS[angle] : null
    const fullAnswer = [transcript.trim(), supplement.trim()].filter(Boolean).join('\n\n')
    const canSubmit  = fullAnswer.length > 0 && !submitting

    const {
        isRecording,
        isTranscribing,
        error: audioError,
        start,
        stopAndTranscribe,
    } = useAudioRecorder(token,question)

    const handleMicClick = async () => {
        if (isRecording) {
            const result = await stopAndTranscribe()
            // ── FIX 2 : result.text peut être undefined → on garde string strict
            const text = result?.text ?? ''
            if (text) {
                // ── FIX 3 : le callback retourne toujours string (jamais null)
                setTranscript(prev => prev ? `${prev}\n\n${text}` : text)
            }
            if (result?.metrics && onVoiceResult) onVoiceResult(result.metrics)
        } else {
            await start()
        }
    }

    const handleSubmit = useCallback(() => {
        setTouched(true)
        if (!canSubmit) return
        onSubmit(fullAnswer)
        setTranscript('')
        setSupplement('')
        setTouched(false)
    }, [fullAnswer, canSubmit, onSubmit])

    const showError = touched && !fullAnswer && !submitting

    const waveformHeights = useMemo(
        () => Array.from({ length: 20 }, (_, i) => 8 + Math.sin(i) * 10 + ((i * 7) % 8)),
        []
    )

    return (
        <div className="w-full max-w-3xl mx-auto" style={{ animation: 'fadeSlideUp 0.4s ease both' }}>
            <style>{`
                @keyframes fadeSlideUp {
                    from { opacity: 0; transform: translateY(18px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes pulse-ring {
                    0%   { transform: scale(1);    opacity: 0.6; }
                    100% { transform: scale(1.35); opacity: 0; }
                }
            `}</style>

            {/* ── En-tête ── */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{
                        background: 'rgba(129,140,248,0.08)',
                        border:     '1px solid rgba(129,140,248,0.18)',
                    }}>
                        <span style={{ fontSize: 10, color: '#818cf8', letterSpacing: '0.12em', fontWeight: 700, textTransform: 'uppercase' }}>
                            Questions Techniques
                        </span>
                    </div>
                    {angleInfo && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md" style={{
                            background: `${angleInfo.color}0f`,
                            border:     `1px solid ${angleInfo.color}28`,
                        }}>
                            <span style={{ fontSize: 11, color: angleInfo.color }}>{angleInfo.icon}</span>
                            <span style={{ fontSize: 10, color: angleInfo.color, fontWeight: 600 }}>{angleInfo.label}</span>
                        </div>
                    )}
                </div>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.22)', fontVariantNumeric: 'tabular-nums' }}>
                    {questionIndex + 1} / {totalQuestions}
                </span>
            </div>

            {/* ── Carte principale ── */}
            <div className="relative overflow-hidden rounded-2xl p-6" style={{
                background: 'rgba(14,14,22,0.95)',
                border:     '1px solid rgba(129,140,248,0.14)',
                boxShadow:  '0 0 0 1px rgba(129,140,248,0.04), 0 24px 60px rgba(0,0,0,0.5)',
            }}>
                <div className="absolute inset-0 pointer-events-none" style={{
                    background:     'linear-gradient(transparent 50%, rgba(129,140,248,0.012) 50%)',
                    backgroundSize: '100% 4px', zIndex: 0,
                }} />

                <div className="relative z-10">
                    <div className="mb-2 flex items-center gap-2" style={{
                        color: 'rgba(129,140,248,0.6)', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
                    }}>
                        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 2, background: 'rgba(129,140,248,0.5)', marginRight: 2 }} />
                        QUESTION
                    </div>

                    <p className="mb-6 leading-relaxed" style={{
                        fontSize: 17, color: 'rgba(255,255,255,0.92)', fontWeight: 400, lineHeight: 1.7,
                    }}>
                        {question}
                    </p>

                    {codeSample && <CodeBlock sample={codeSample} />}

                    {/* ── Section vocale ── */}
                    <div className="mb-4 rounded-xl overflow-hidden" style={{
                        background: 'rgba(0,0,0,0.3)',
                        border: `1px solid ${
                            isRecording ? 'rgba(239,68,68,0.4)' :
                                transcript  ? 'rgba(34,197,94,0.3)' :
                                    'rgba(129,140,248,0.12)'
                        }`,
                        transition: 'border-color 0.3s ease',
                    }}>
                        <div className="px-4 py-3 flex items-center justify-between" style={{
                            borderBottom: '1px solid rgba(129,140,248,0.07)',
                        }}>
                            <div className="flex items-center gap-2">
                                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em' }}>
                                    RÉPONSE VOCALE
                                </span>
                                {isRecording    && <span style={{ fontSize: 10, color: 'rgba(239,68,68,0.8)'  }}>● Enregistrement…</span>}
                                {isTranscribing && <span style={{ fontSize: 10, color: 'rgba(251,191,36,0.8)' }}>⟳ Transcription…</span>}
                                {!isRecording && !isTranscribing && transcript &&
                                    <span style={{ fontSize: 10, color: 'rgba(34,197,94,0.8)' }}>✓ Transcrit</span>
                                }
                            </div>
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>
                                Vous pouvez ré-enregistrer
                            </span>
                        </div>

                        <div className="px-4 py-4">
                            {audioError && (
                                <p style={{ fontSize: 12, color: 'rgba(239,68,68,0.7)', marginBottom: 12 }}>{audioError}</p>
                            )}

                            <div className="flex items-center gap-3 mb-4">
                                <button
                                    onClick={handleMicClick}
                                    disabled={submitting || isTranscribing}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg"
                                    style={{
                                        background: isRecording ? 'rgba(239,68,68,0.15)' : 'rgba(129,140,248,0.08)',
                                        border:     isRecording ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(129,140,248,0.2)',
                                        color:      isRecording ? 'rgba(239,68,68,0.9)' : 'rgba(129,140,248,0.8)',
                                        fontSize: 13, cursor: submitting || isTranscribing ? 'not-allowed' : 'pointer',
                                        position: 'relative',
                                    }}
                                >
                                    {isRecording && (
                                        <span style={{
                                            position: 'absolute', inset: 0, borderRadius: 8,
                                            border: '1px solid rgba(239,68,68,0.5)',
                                            animation: 'pulse-ring 1.2s ease-out infinite',
                                        }} />
                                    )}
                                    {isRecording ? (
                                        <><span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(239,68,68,0.8)', display: 'inline-block' }} /> Arrêter l'enregistrement</>
                                    ) : isTranscribing ? (
                                        <><span className="inline-block w-3 h-3 rounded-full border border-amber-400/50 border-t-amber-400 animate-spin" /> Transcription…</>
                                    ) : (
                                        <><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(129,140,248,0.8)', display: 'inline-block' }} />
                                            {transcript ? '↺ Ré-enregistrer' : 'Démarrer l\'enregistrement'}</>
                                    )}
                                </button>
                            </div>

                            {isRecording && (
                                <div className="flex items-center gap-1 mb-3" style={{ height: 24 }}>
                                    {Array.from({ length: 20 }).map((_, i) => (
                                        <div key={i} style={{
                                            width: 3, borderRadius: 99,
                                            background: 'rgba(239,68,68,0.5)',
                                            animation: `pulse-ring ${0.4 + (i % 5) * 0.1}s ease-in-out infinite alternate`,
                                            height: `${waveformHeights[i]}px`,
                                        }} />
                                    ))}
                                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginLeft: 8 }}>Parlez clairement…</span>
                                </div>
                            )}

                            {transcript ? (
                                <div className="rounded-xl p-4" style={{
                                    background: 'rgba(34,197,94,0.04)',
                                    border:     '1px solid rgba(34,197,94,0.12)',
                                }}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span style={{ fontSize: 10, color: 'rgba(34,197,94,0.5)', letterSpacing: '0.08em' }}>
                                                TRANSCRIPTION — LECTURE SEULE
                                            </span>
                                            <span style={{
                                                fontSize: 9, color: 'rgba(34,197,94,0.4)',
                                                background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)',
                                                borderRadius: 4, padding: '1px 6px',
                                            }}>🔒</span>
                                        </div>
                                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>
                                            {transcript.split(/\s+/).filter(Boolean).length} mots
                                        </span>
                                    </div>
                                    <p style={{
                                        fontSize: 14, color: 'rgba(255,255,255,0.75)',
                                        lineHeight: 1.7, fontStyle: 'italic', userSelect: 'none',
                                    }}>
                                        {transcript}
                                    </p>
                                </div>
                            ) : !isRecording && !isTranscribing && (
                                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>
                                    La transcription apparaîtra ici après l'enregistrement.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* ── Complément texte ── */}
                    <div className="mb-5">
                        <button
                            onClick={() => setShowTextZone(v => !v)}
                            style={{
                                fontSize: 11, color: 'rgba(129,140,248,0.5)',
                                background: 'transparent', border: 'none',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                                padding: 0, marginBottom: showTextZone ? 10 : 0,
                            }}
                        >
                            <span style={{ fontSize: 9 }}>{showTextZone ? '▲' : '▼'}</span>
                            {showTextZone ? 'Masquer le complément écrit' : '+ Ajouter un complément écrit (noms, pseudocode…)'}
                        </button>

                        {showTextZone && (
                            <div className="rounded-xl overflow-hidden" style={{
                                background: 'rgba(0,0,0,0.25)',
                                border: `1px solid ${supplement ? 'rgba(129,140,248,0.25)' : 'rgba(129,140,248,0.1)'}`,
                                transition: 'border-color 0.2s',
                            }}>
                                <div className="px-3 py-2 flex items-center justify-between" style={{
                                    borderBottom: '1px solid rgba(129,140,248,0.07)',
                                }}>
                                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em' }}>
                                        COMPLÉMENT ÉCRIT
                                    </span>
                                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>
                                        {supplement.split(/\s+/).filter(Boolean).length} mots
                                    </span>
                                </div>
                                <textarea
                                    value={supplement}
                                    onChange={e => setSupplement(e.target.value)}
                                    placeholder="Noms de technologies, exemples de code, précisions que la voix n'a pas bien capturées…"
                                    rows={4}
                                    style={{
                                        width: '100%', background: 'transparent', border: 'none',
                                        outline: 'none', resize: 'vertical',
                                        fontSize: 13, color: 'rgba(255,255,255,0.75)',
                                        lineHeight: 1.65, padding: '12px 16px',
                                        fontFamily: 'inherit',
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    {/* ── Aide STAR ── */}
                    <div className="mb-5 px-4 py-3 rounded-xl flex items-start gap-3" style={{
                        background: 'rgba(129,140,248,0.04)',
                        border:     '1px solid rgba(129,140,248,0.08)',
                    }}>
                        <span style={{ fontSize: 12, color: 'rgba(129,140,248,0.5)', marginTop: 1 }}>💡</span>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6 }}>
                            Structurez votre réponse :{' '}
                            <strong style={{ color: 'rgba(129,140,248,0.5)' }}>Situation</strong>
                            {' → '}
                            <strong style={{ color: 'rgba(129,140,248,0.5)' }}>Action</strong>
                            {' → '}
                            <strong style={{ color: 'rgba(129,140,248,0.5)' }}>Résultat</strong>.
                            {codeSample && <>{' '}Référez-vous au code affiché ci-dessus.</>}
                        </p>
                    </div>

                    {/* ── Bouton soumettre ── */}
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
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
                            cursor: submitting ? 'not-allowed' : 'pointer',
                            boxShadow: canSubmit ? '0 0 20px rgba(129,140,248,0.08)' : 'none',
                        }}
                    >
                        {submitting ? (
                            <><span className="w-4 h-4 rounded-full border border-indigo-400/30 border-t-indigo-400 animate-spin" /> Analyse en cours…</>
                        ) : showError ? (
                            <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                            </svg> Enregistrez ou écrivez une réponse d'abord</>
                        ) : (
                            <>Valider la réponse <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M5 12h14M12 5l7 7-7 7"/>
                            </svg></>
                        )}
                    </button>

                    {fullAnswer && (
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', textAlign: 'center', marginTop: 8 }}>
                            {fullAnswer.split(/\s+/).filter(Boolean).length} mots au total
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}