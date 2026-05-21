import {scoreColor, severityColor, severityIcon} from "../../../types/utils.ts";
import { Section } from "./Section.tsx";
import {VoiceAnalysis} from "../../../types/types.ts";


interface Props {
    voice_analysis: VoiceAnalysis
}

export function VoiceSection({ voice_analysis }: Props) {
    return (
        <Section id="voice" title="Analyse vocale détaillée" icon="◐" accent="#34d399">
            {!voice_analysis.available ? (
                <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, fontStyle: 'italic' }}>
                    Aucune analyse vocale disponible.
                </div>
            ) : (
                <>
                    {/* ── Summary tiles ── */}
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: 12,
                            marginBottom: 20,
                        }}
                    >
                        {[
                            {
                                label: 'Score vocal moyen',
                                value: voice_analysis.summary.avg_vocal_score,
                                unit: '/100',
                                color: scoreColor(voice_analysis.summary.avg_vocal_score),
                            },
                            {
                                label: 'Débit moyen',
                                value: voice_analysis.summary.avg_wpm,
                                unit: ' mpm',
                                color: '#818cf8',
                            },
                            {
                                label: 'Confiance moy.',
                                value: voice_analysis.summary.avg_confidence,
                                unit: '/100',
                                color: '#34d399',
                            },
                            {
                                label: 'Fluidité moy.',
                                value: voice_analysis.summary.avg_fluency,
                                unit: '/100',
                                color: '#fbbf24',
                            },
                        ].map(({ label, value, unit, color }) => (
                            <div
                                key={label}
                                style={{
                                    padding: 16,
                                    borderRadius: 10,
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    textAlign: 'center',
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 22,
                                        fontWeight: 800,
                                        color,
                                        fontFamily: 'DM Mono, monospace',
                                    }}
                                >
                                    {value ?? '—'}
                                    {unit}
                                </div>
                                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                                    {label}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── Critical alerts ── */}
                    {(voice_analysis.summary.has_double_voice ||
                        voice_analysis.summary.has_speaker_change) && (
                        <div
                            style={{
                                padding: '12px 16px',
                                borderRadius: 8,
                                background: 'rgba(239,68,68,0.08)',
                                border: '1px solid rgba(239,68,68,0.25)',
                                marginBottom: 16,
                            }}
                        >
                            <div
                                style={{ fontSize: 12, fontWeight: 700, color: '#f87171', marginBottom: 4 }}
                            >
                                ⛔ Anomalies critiques détectées
                            </div>
                            {voice_analysis.summary.has_double_voice && (
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                                    • Double voix détectée dans l'audio
                                </div>
                            )}
                            {voice_analysis.summary.has_speaker_change && (
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                                    • Changement de locuteur détecté
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Per-response table ── */}
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                {[
                                    '#',
                                    'Phase',
                                    'Score',
                                    'Mots',
                                    'Débit',
                                    'Confiance',
                                    'Fluidité',
                                    'Stabilité pitch',
                                    'Anomalies',
                                ].map((h) => (
                                    <th
                                        key={h}
                                        style={{
                                            padding: '8px 12px',
                                            textAlign: 'left',
                                            fontSize: 10,
                                            letterSpacing: '0.08em',
                                            textTransform: 'uppercase',
                                            color: 'rgba(255,255,255,0.25)',
                                            fontWeight: 600,
                                        }}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                            </thead>
                            <tbody>
                            {voice_analysis.entries.map((e) => (
                                <tr key={e.index} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                    <td
                                        style={{
                                            padding: '10px 12px',
                                            fontFamily: 'DM Mono, monospace',
                                            color: 'rgba(255,255,255,0.3)',
                                            fontSize: 11,
                                        }}
                                    >
                                        {e.index}
                                    </td>
                                    <td
                                        style={{
                                            padding: '10px 12px',
                                            fontSize: 11,
                                            color: 'rgba(255,255,255,0.5)',
                                        }}
                                    >
                                        {e.phase_label}
                                    </td>
                                    <td
                                        style={{
                                            padding: '10px 12px',
                                            fontFamily: 'DM Mono, monospace',
                                            fontWeight: 700,
                                            color: scoreColor(e.vocal_score),
                                        }}
                                    >
                                        {e.vocal_score}
                                    </td>
                                    <td
                                        style={{
                                            padding: '10px 12px',
                                            fontFamily: 'DM Mono, monospace',
                                            color: 'rgba(255,255,255,0.4)',
                                        }}
                                    >
                                        {e.word_count}
                                    </td>
                                    <td
                                        style={{
                                            padding: '10px 12px',
                                            fontFamily: 'DM Mono, monospace',
                                            color: '#818cf8',
                                        }}
                                    >
                                        {e.wpm}{' '}
                                        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>mpm</span>
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>
                                        <div style={{ fontSize: 11, color: scoreColor(e.confidence_score) }}>
                                            {e.confidence_score}/100
                                        </div>
                                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>
                                            {e.confidence_label}
                                        </div>
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>
                                        <div style={{ fontSize: 11, color: scoreColor(e.fluency_score) }}>
                                            {e.fluency_score}/100
                                        </div>
                                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>
                                            {e.fluency_label}
                                        </div>
                                    </td>
                                    <td
                                        style={{
                                            padding: '10px 12px',
                                            fontFamily: 'DM Mono, monospace',
                                            color: 'rgba(255,255,255,0.4)',
                                            fontSize: 11,
                                        }}
                                    >
                                        {e.pitch_stability}%
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>
                                        {e.anomalies.length > 0 ? (
                                            e.anomalies.map((a, i) => (
                                                <div
                                                    key={i}
                                                    style={{
                                                        fontSize: 10,
                                                        color: severityColor(a.severity),
                                                        marginBottom: 2,
                                                    }}
                                                >
                                                    {severityIcon(a.severity)} {a.type}{' '}
                                                    <span
                                                        style={{
                                                            color: 'rgba(255,255,255,0.25)',
                                                            fontFamily: 'DM Mono, monospace',
                                                        }}
                                                    >
                              {a.timestamp}
                            </span>
                                                </div>
                                            ))
                                        ) : (
                                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.15)' }}>—</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>

                    {/* ── All timestamped anomalies ── */}
                    {voice_analysis.anomalies.length > 0 && (
                        <div style={{ marginTop: 20 }}>
                            <div
                                style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: 'rgba(255,255,255,0.4)',
                                    marginBottom: 10,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.08em',
                                }}
                            >
                                Anomalies horodatées ({voice_analysis.anomalies.length})
                            </div>
                            {voice_analysis.anomalies.map((a, i) => (
                                <div
                                    key={i}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: 12,
                                        padding: '10px 14px',
                                        borderRadius: 8,
                                        background: `${severityColor(a.severity)}08`,
                                        border: `1px solid ${severityColor(a.severity)}20`,
                                        marginBottom: 8,
                                    }}
                                >
                                    <span style={{ fontSize: 14, flexShrink: 0 }}>{severityIcon(a.severity)}</span>
                                    <div style={{ flex: 1 }}>
                                        <div
                                            style={{ fontSize: 12, fontWeight: 600, color: severityColor(a.severity) }}
                                        >
                                            {a.type}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                                            {a.description}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 10,
                                                color: 'rgba(255,255,255,0.2)',
                                                marginTop: 2,
                                                fontFamily: 'DM Mono, monospace',
                                            }}
                                        >
                                            Phase : {a.phase_label} · Timestamp : {a.timestamp}
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 12,
                                            fontWeight: 700,
                                            color: '#f87171',
                                            fontFamily: 'DM Mono, monospace',
                                            flexShrink: 0,
                                        }}
                                    >
                                        -{a.penalty} pts
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </Section>
    )
}