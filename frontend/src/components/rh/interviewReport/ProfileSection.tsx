import {ProfileInconsistency} from "../../../types/types.ts";
import {Section} from "./Section.tsx";
import {Badge} from "./Badge.tsx";

interface Props {
    profile_inconsistencies: ProfileInconsistency[]
}

/** Returns the colour for a profile-inconsistency severity level. */
function incColor(severity: string): string {
    switch (severity) {
        case 'high':   return '#f87171'
        case 'medium': return '#fbbf24'
        default:       return '#60a5fa'
    }
}

export function ProfileSection({ profile_inconsistencies }: Props) {
    return (
        <Section id="profile" title="Incohérences de profil" icon="◍" accent="#a78bfa">
            {/* Disclaimer */}
            <div
                style={{
                    padding: '8px 14px',
                    borderRadius: 6,
                    background: 'rgba(167,139,250,0.06)',
                    border: '1px solid rgba(167,139,250,0.15)',
                    marginBottom: 16,
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.35)',
                }}
            >
                ℹ️ Ces incohérences{' '}
                <strong style={{ color: 'rgba(255,255,255,0.5)' }}>
                    n'ont pas impacté le score automatique
                </strong>
                . Elles sont à explorer lors de l'entretien humain de suivi.
            </div>

            {profile_inconsistencies.length === 0 ? (
                <div
                    style={{
                        padding: '14px 18px',
                        borderRadius: 10,
                        background: 'rgba(74,222,128,0.05)',
                        border: '1px solid rgba(74,222,128,0.15)',
                        fontSize: 13,
                        color: '#4ade80',
                    }}
                >
                    ✓ Aucune incohérence de profil détectée.
                </div>
            ) : (
                profile_inconsistencies.map((inc, i) => {
                    const color = incColor(inc.severity)
                    return (
                        <div
                            key={i}
                            style={{
                                marginBottom: 12,
                                padding: 16,
                                borderRadius: 10,
                                background: `${color}06`,
                                border: `1px solid ${color}18`,
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    gap: 8,
                                    alignItems: 'center',
                                    marginBottom: 6,
                                }}
                            >
                                <Badge text={inc.type} color={color} />
                                <Badge text={inc.severity} color={color} />
                            </div>

                            <p
                                style={{
                                    margin: '0 0 8px',
                                    fontSize: 13,
                                    color: 'rgba(255,255,255,0.7)',
                                }}
                            >
                                {inc.description}
                            </p>

                            {inc.suggested_question && (
                                <div
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: 6,
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(255,255,255,0.05)',
                                        fontSize: 12,
                                        color: 'rgba(255,255,255,0.45)',
                                        lineHeight: 1.6,
                                        marginBottom: 6,
                                    }}
                                >
                  <span
                      style={{
                          color: 'rgba(255,255,255,0.25)',
                          fontSize: 10,
                          display: 'block',
                          marginBottom: 4,
                      }}
                  >
                    QUESTION SUGGÉRÉE
                  </span>
                                    {inc.suggested_question}
                                </div>
                            )}

                            {inc.rh_note && (
                                <div style={{ fontSize: 11, color, marginTop: 4 }}>
                                    → Note RH : {inc.rh_note}
                                </div>
                            )}
                        </div>
                    )
                })
            )}
        </Section>
    )
}