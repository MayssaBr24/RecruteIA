import {SecurityWarnings} from "../../../types/types.ts";
import {Section} from "./Section.tsx";
import {formatDate, severityColor} from "../../../types/utils.ts";
import {Badge} from "./Badge.tsx";


interface Props {
    security_warnings: SecurityWarnings
}

export function SecuritySection({ security_warnings }: Props) {
    return (
        <Section id="security" title="Incidents de sécurité" icon="◧" accent="#f97316">
            {security_warnings.count === 0 ? (
                <div
                    style={{
                        padding: '16px 20px',
                        borderRadius: 10,
                        background: 'rgba(74,222,128,0.05)',
                        border: '1px solid rgba(74,222,128,0.15)',
                        fontSize: 13,
                        color: '#4ade80',
                    }}
                >
                    ✓ Aucun incident de sécurité détecté pendant l'entretien.
                </div>
            ) : (
                <>
                    {/* ── Summary counters ── */}
                    <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                        <div
                            style={{
                                padding: '10px 16px',
                                borderRadius: 8,
                                background: 'rgba(239,68,68,0.08)',
                                border: '1px solid rgba(239,68,68,0.2)',
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 20,
                                    fontWeight: 800,
                                    color: '#f87171',
                                    fontFamily: 'DM Mono, monospace',
                                }}
                            >
                                {security_warnings.count}
                            </div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>incidents total</div>
                        </div>

                        <div
                            style={{
                                padding: '10px 16px',
                                borderRadius: 8,
                                background: 'rgba(239,68,68,0.08)',
                                border: '1px solid rgba(239,68,68,0.2)',
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 20,
                                    fontWeight: 800,
                                    color: '#f87171',
                                    fontFamily: 'DM Mono, monospace',
                                }}
                            >
                                -{security_warnings.total_penalty}
                            </div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>pts de pénalité</div>
                        </div>

                        {security_warnings.terminated && (
                            <div
                                style={{
                                    padding: '10px 16px',
                                    borderRadius: 8,
                                    background: 'rgba(239,68,68,0.12)',
                                    border: '1px solid rgba(239,68,68,0.35)',
                                    flex: 1,
                                }}
                            >
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#f87171' }}>
                                    ⛔ Entretien interrompu automatiquement
                                </div>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                                    3 incidents atteints
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Warning list ── */}
                    {security_warnings.entries.map((w, i) => (
                        <div
                            key={w.id}
                            style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 14,
                                padding: '12px 16px',
                                borderRadius: 10,
                                background: `${severityColor(w.severity)}06`,
                                border: `1px solid ${severityColor(w.severity)}18`,
                                marginBottom: 10,
                            }}
                        >
                            {/* Incident number */}
                            <div
                                style={{
                                    width: 26,
                                    height: 26,
                                    borderRadius: '50%',
                                    background: `${severityColor(w.severity)}15`,
                                    border: `1px solid ${severityColor(w.severity)}35`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: severityColor(w.severity),
                                    flexShrink: 0,
                                    fontFamily: 'DM Mono, monospace',
                                }}
                            >
                                {i + 1}
                            </div>

                            <div style={{ flex: 1 }}>
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        marginBottom: 4,
                                    }}
                                >
                  <span
                      style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: severityColor(w.severity),
                      }}
                  >
                    {w.label}
                  </span>
                                    <Badge text={w.severity} color={severityColor(w.severity)} />
                                </div>

                                {w.details && (
                                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>
                                        {w.details}
                                    </div>
                                )}

                                <div
                                    style={{
                                        fontSize: 10,
                                        color: 'rgba(255,255,255,0.2)',
                                        fontFamily: 'DM Mono, monospace',
                                    }}
                                >
                                    {formatDate(w.created_at)}
                                    <span style={{ marginLeft: 8, color: 'rgba(255,255,255,0.15)' }}>
                    type: {w.type}
                  </span>
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
                                -{w.penalty_pts} pts
                            </div>
                        </div>
                    ))}
                </>
            )}
        </Section>
    )
}