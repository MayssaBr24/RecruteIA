import {TranscriptPhase} from "../../../types/types.ts";
import {Section} from "./Section.tsx";
import {scoreColor} from "../../../types/utils.ts";

interface Props {
    transcript_phases: TranscriptPhase[]
}

export function TranscriptSection({ transcript_phases }: Props) {
    return (
        <Section id="transcript" title="Transcription complète" icon="◎" accent="#818cf8">
            {transcript_phases.length === 0 ? (
                <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, fontStyle: 'italic' }}>
                    Aucune transcription disponible.
                </div>
            ) : (
                transcript_phases.map((ph) => (
                    <div key={ph.phase} style={{ marginBottom: 32 }}>
                        {/* Phase header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                            <div
                                style={{
                                    padding: '4px 12px',
                                    borderRadius: 6,
                                    background: 'rgba(129,140,248,0.1)',
                                    border: '1px solid rgba(129,140,248,0.2)',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: '#818cf8',
                                    letterSpacing: '0.08em',
                                    textTransform: 'uppercase',
                                }}
                            >
                                {ph.phase_label}
                            </div>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
                {ph.count} question{ph.count > 1 ? 's' : ''}
              </span>
                        </div>

                        {/* Q&A entries */}
                        {ph.entries.map((entry, i) => (
                            <div
                                key={i}
                                style={{
                                    marginBottom: 16,
                                    padding: 18,
                                    borderRadius: 12,
                                    background: 'rgba(255,255,255,0.015)',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    position: 'relative',
                                }}
                            >
                                {/* Index badge */}
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: -10,
                                        left: 16,
                                        background: 'rgba(129,140,248,0.15)',
                                        border: '1px solid rgba(129,140,248,0.25)',
                                        borderRadius: 4,
                                        padding: '0 8px',
                                        fontSize: 10,
                                        color: '#818cf8',
                                        fontFamily: 'DM Mono, monospace',
                                    }}
                                >
                                    Q{entry.question_index + 1}
                                </div>

                                {/* Question */}
                                <div style={{ marginBottom: 10 }}>
                                    <div
                                        style={{
                                            fontSize: 10,
                                            letterSpacing: '0.1em',
                                            color: 'rgba(255,255,255,0.25)',
                                            textTransform: 'uppercase',
                                            marginBottom: 4,
                                        }}
                                    >
                                        Question
                                    </div>
                                    <p
                                        style={{
                                            margin: 0,
                                            fontSize: 13,
                                            color: 'rgba(255,255,255,0.7)',
                                            lineHeight: 1.65,
                                        }}
                                    >
                                        {entry.question}
                                    </p>
                                </div>

                                {/* Answer */}
                                <div style={{ paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div
                                        style={{
                                            fontSize: 10,
                                            letterSpacing: '0.1em',
                                            color: 'rgba(255,255,255,0.25)',
                                            textTransform: 'uppercase',
                                            marginBottom: 4,
                                        }}
                                    >
                                        Réponse du candidat
                                    </div>
                                    <p
                                        style={{
                                            margin: 0,
                                            fontSize: 13,
                                            color: 'rgba(255,255,255,0.85)',
                                            lineHeight: 1.7,
                                        }}
                                    >
                                        {entry.answer || (
                                            <em style={{ color: 'rgba(255,255,255,0.2)' }}>Aucune réponse</em>
                                        )}
                                    </p>
                                </div>

                                {/* Meta row */}
                                <div
                                    style={{
                                        marginTop: 10,
                                        paddingTop: 8,
                                        borderTop: '1px solid rgba(255,255,255,0.04)',
                                        display: 'flex',
                                        gap: 16,
                                        flexWrap: 'wrap',
                                    }}
                                >
                  <span
                      style={{
                          fontSize: 10,
                          color: 'rgba(255,255,255,0.2)',
                          fontFamily: 'DM Mono, monospace',
                      }}
                  >
                    ⏱ {entry.response_time_label}
                  </span>

                                    {entry.word_count != null && (
                                        <span
                                            style={{
                                                fontSize: 10,
                                                color: 'rgba(255,255,255,0.2)',
                                                fontFamily: 'DM Mono, monospace',
                                            }}
                                        >
                      {entry.word_count} mots
                    </span>
                                    )}

                                    {entry.vocal_score != null && (
                                        <span
                                            style={{
                                                fontSize: 10,
                                                fontFamily: 'DM Mono, monospace',
                                                color: scoreColor(entry.vocal_score),
                                            }}
                                        >
                      🎙 Score vocal : {entry.vocal_score}/100
                    </span>
                                    )}

                                    {entry.voice_metrics && (
                                        <>
                      <span
                          style={{
                              fontSize: 10,
                              color: 'rgba(255,255,255,0.2)',
                              fontFamily: 'DM Mono, monospace',
                          }}
                      >
                        Confiance : {entry.voice_metrics.confidence_label}
                      </span>
                                            <span
                                                style={{
                                                    fontSize: 10,
                                                    color: 'rgba(255,255,255,0.2)',
                                                    fontFamily: 'DM Mono, monospace',
                                                }}
                                            >
                        Fluidité : {entry.voice_metrics.fluency_label}
                      </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ))
            )}
        </Section>
    )
}