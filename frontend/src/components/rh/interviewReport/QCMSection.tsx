import {QCMDetail} from "../../../types/types.ts";
import {Section} from "./Section.tsx";
import {diffColor, scoreBg, scoreColor} from "../../../types/utils.ts";
import {Badge} from "./Badge.tsx";


interface Props {
    qcm_detail: QCMDetail
}

export function QCMSection({ qcm_detail }: Props) {
    return (
        <Section id="qcm" title="QCM technique — Détail" icon="◫" accent="#60a5fa">
            {!qcm_detail.available ? (
                <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, fontStyle: 'italic' }}>
                    QCM non disponible.
                </div>
            ) : (
                <>
                    {/* ── Score summary ── */}
                    <div style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'center' }}>
                        {[
                            {
                                value: `${qcm_detail.correct}/${qcm_detail.total}`,
                                label: 'bonnes réponses',
                            },
                            { value: `${qcm_detail.score}%`, label: 'score QCM' },
                        ].map(({ value, label }) => (
                            <div
                                key={label}
                                style={{
                                    padding: '12px 20px',
                                    borderRadius: 10,
                                    background: scoreBg(qcm_detail.score),
                                    border: `1px solid ${scoreColor(qcm_detail.score)}25`,
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 28,
                                        fontWeight: 800,
                                        color: scoreColor(qcm_detail.score),
                                        fontFamily: 'DM Mono, monospace',
                                    }}
                                >
                                    {value}
                                </div>
                                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{label}</div>
                            </div>
                        ))}
                    </div>

                    {/* ── Question list ── */}
                    {qcm_detail.questions.map((q, i) => (
                        <div
                            key={i}
                            style={{
                                marginBottom: 14,
                                padding: 16,
                                borderRadius: 10,
                                background: q.is_correct
                                    ? 'rgba(74,222,128,0.04)'
                                    : 'rgba(248,113,113,0.04)',
                                border: `1px solid ${
                                    q.is_correct ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)'
                                }`,
                            }}
                        >
                            {/* Question header */}
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 10,
                                    marginBottom: 10,
                                }}
                            >
                <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>
                  {q.is_correct ? '✅' : '❌'}
                </span>
                                <div style={{ flex: 1 }}>
                                    <div
                                        style={{
                                            display: 'flex',
                                            gap: 8,
                                            marginBottom: 6,
                                            flexWrap: 'wrap',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <Badge text={q.difficulty} color={diffColor(q.difficulty)} />
                                        {q.domain && <Badge text={q.domain} color="#60a5fa" />}
                                        <span
                                            style={{
                                                fontSize: 10,
                                                color: 'rgba(255,255,255,0.2)',
                                                fontFamily: 'DM Mono, monospace',
                                            }}
                                        >
                      Q{i + 1}
                    </span>
                                    </div>
                                    <p
                                        style={{
                                            margin: 0,
                                            fontSize: 13,
                                            color: 'rgba(255,255,255,0.8)',
                                            lineHeight: 1.6,
                                        }}
                                    >
                                        {q.question}
                                    </p>
                                </div>
                            </div>

                            {/* Answer options grid */}
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: 6,
                                    marginLeft: 24,
                                }}
                            >
                                {q.options.map((opt, oi) => {
                                    const isCorrect   = oi === q.correct_index
                                    const isCandidate = oi === q.candidate_index
                                    const wrongAnswer = isCandidate && !isCorrect

                                    const bg     = isCorrect
                                        ? 'rgba(74,222,128,0.1)'
                                        : wrongAnswer
                                            ? 'rgba(248,113,113,0.1)'
                                            : 'rgba(255,255,255,0.02)'
                                    const border = isCorrect
                                        ? 'rgba(74,222,128,0.3)'
                                        : wrongAnswer
                                            ? 'rgba(248,113,113,0.3)'
                                            : 'rgba(255,255,255,0.05)'
                                    const color  = isCorrect
                                        ? '#4ade80'
                                        : wrongAnswer
                                            ? '#f87171'
                                            : 'rgba(255,255,255,0.45)'

                                    return (
                                        <div
                                            key={oi}
                                            style={{
                                                padding: '6px 10px',
                                                borderRadius: 6,
                                                background: bg,
                                                border: `1px solid ${border}`,
                                                fontSize: 11,
                                                color,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 6,
                                            }}
                                        >
                                            {isCorrect && <span>✓</span>}
                                            {wrongAnswer && <span>✗</span>}
                                            {!isCorrect && !isCandidate && (
                                                <span style={{ opacity: 0 }}>·</span>
                                            )}
                                            {opt}
                                            {isCandidate && (
                                                <span style={{ marginLeft: 'auto', fontSize: 9, opacity: 0.6 }}>
                          candidat
                        </span>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Explanation */}
                            {q.explanation && (
                                <div
                                    style={{
                                        marginTop: 8,
                                        marginLeft: 24,
                                        padding: '6px 10px',
                                        borderRadius: 6,
                                        background: 'rgba(255,255,255,0.03)',
                                        fontSize: 11,
                                        color: 'rgba(255,255,255,0.35)',
                                        lineHeight: 1.5,
                                    }}
                                >
                                    💡 {q.explanation}
                                </div>
                            )}
                        </div>
                    ))}
                </>
            )}
        </Section>
    )
}