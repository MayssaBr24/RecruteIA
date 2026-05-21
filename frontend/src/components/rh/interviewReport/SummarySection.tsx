import {formatDate, recoColor, recoLabel, scoreColor} from "../../../types/utils.ts";
import {Badge} from "./Badge.tsx";
import {ReportData} from "../../../types/types.ts";

interface Props {
    report: ReportData
}

export function SummarySection({ report }: Props) {
    const { candidate, job_offer, timing, scores, security_warnings, recommendation } = report
    const recoKey = recommendation.final_recommendation
    const recoEmoji =
        recoKey === 'VALIDATED' ? '✅'
            : recoKey === 'REJECTED' ? '❌'
                : recoKey === 'TO_REVIEW' ? '🟡'
                    : '⏳'

    return (
        <section id="summary" style={{ marginBottom: 56 }}>
            {/* ── Recommendation banner ── */}
            <div
                style={{
                    padding: '12px 20px',
                    borderRadius: 10,
                    background: `${recoColor(recoKey)}12`,
                    border: `1px solid ${recoColor(recoKey)}30`,
                    marginBottom: 28,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                }}
            >
                <span style={{ fontSize: 20 }}>{recoEmoji}</span>
                <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: recoColor(recoKey) }}>
                        {recoLabel(recoKey)}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Recommandation finale</div>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div
                        style={{
                            fontSize: 28,
                            fontWeight: 800,
                            color: scoreColor(scores.global),
                            fontFamily: 'DM Mono, monospace',
                        }}
                    >
                        {scores.global}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>
                        SCORE GLOBAL / 100
                    </div>
                </div>
            </div>

            {/* ── Candidate / Job / Timing grid ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                {/* Candidate card */}
                <div
                    style={{
                        padding: 20,
                        borderRadius: 12,
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.06)',
                    }}
                >
                    <div
                        style={{
                            fontSize: 10,
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            color: 'rgba(255,255,255,0.25)',
                            marginBottom: 12,
                        }}
                    >
                        Candidat
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{candidate.full_name}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 2 }}>
                        {candidate.email}
                    </div>
                    {candidate.phone && (
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{candidate.phone}</div>
                    )}
                    <div
                        style={{
                            marginTop: 10,
                            paddingTop: 10,
                            borderTop: '1px solid rgba(255,255,255,0.05)',
                        }}
                    >
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                            {candidate.current_position || 'Sans poste actuel'}
                        </div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
                            {candidate.experience_years} ans d'exp. · {candidate.location}
                        </div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
                            {candidate.degree} — {candidate.university}
                        </div>
                    </div>
                    {(candidate.linkedin_url || candidate.github_username) && (
                        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                            {candidate.linkedin_url && (
                                <a
                                    href={candidate.linkedin_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ fontSize: 10, color: '#60a5fa', textDecoration: 'none' }}
                                >
                                    LinkedIn ↗
                                </a>
                            )}
                            {candidate.github_username && (
                                <a
                                    href={`https://github.com/${candidate.github_username}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ fontSize: 10, color: '#60a5fa', textDecoration: 'none' }}
                                >
                                    GitHub ↗
                                </a>
                            )}
                        </div>
                    )}
                </div>

                {/* Job offer card */}
                <div
                    style={{
                        padding: 20,
                        borderRadius: 12,
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.06)',
                    }}
                >
                    <div
                        style={{
                            fontSize: 10,
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            color: 'rgba(255,255,255,0.25)',
                            marginBottom: 12,
                        }}
                    >
                        Poste
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{job_offer.title}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 2 }}>
                        {job_offer.domain}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{job_offer.city}</div>
                    {job_offer.requirements && (
                        <div
                            style={{
                                marginTop: 10,
                                paddingTop: 10,
                                borderTop: '1px solid rgba(255,255,255,0.05)',
                                fontSize: 11,
                                color: 'rgba(255,255,255,0.3)',
                                lineHeight: 1.5,
                            }}
                        >
                            {job_offer.requirements.length > 120
                                ? `${job_offer.requirements.slice(0, 120)}…`
                                : job_offer.requirements}
                        </div>
                    )}
                </div>

                {/* Timing card */}
                <div
                    style={{
                        padding: 20,
                        borderRadius: 12,
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.06)',
                    }}
                >
                    <div
                        style={{
                            fontSize: 10,
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            color: 'rgba(255,255,255,0.25)',
                            marginBottom: 12,
                        }}
                    >
                        Déroulement
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>
                        <span style={{ color: 'rgba(255,255,255,0.5)' }}>Début : </span>
                        {formatDate(timing.started_at)}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>
                        <span style={{ color: 'rgba(255,255,255,0.5)' }}>Fin : </span>
                        {formatDate(timing.completed_at)}
                    </div>
                    <div
                        style={{
                            fontSize: 20,
                            fontWeight: 700,
                            fontFamily: 'DM Mono, monospace',
                            color: '#fbbf24',
                            marginTop: 8,
                        }}
                    >
                        {timing.duration_label}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>durée totale</div>
                    <div style={{ marginTop: 12 }}>
                        <Badge
                            text={report.status === 'completed' ? 'Complété' : 'Fraude terminée'}
                            color={report.status === 'completed' ? '#4ade80' : '#f87171'}
                        />
                    </div>
                    {security_warnings.count > 0 && (
                        <div style={{ marginTop: 8 }}>
                            <Badge
                                text={`${security_warnings.count} warning${security_warnings.count > 1 ? 's' : ''}`}
                                color="#f97316"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* ── AI profile summary ── */}
            {candidate.ai_summary && (
                <div
                    style={{
                        marginTop: 16,
                        padding: 20,
                        borderRadius: 12,
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.06)',
                    }}
                >
                    <div
                        style={{
                            fontSize: 10,
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            color: 'rgba(255,255,255,0.25)',
                            marginBottom: 8,
                        }}
                    >
                        Résumé IA du profil
                    </div>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, margin: 0 }}>
                        {candidate.ai_summary}
                    </p>
                    <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {candidate.ai_strengths.slice(0, 4).map((s, i) => (
                            <span
                                key={i}
                                style={{
                                    fontSize: 10,
                                    padding: '2px 8px',
                                    borderRadius: 4,
                                    background: 'rgba(74,222,128,0.08)',
                                    border: '1px solid rgba(74,222,128,0.2)',
                                    color: '#4ade80',
                                }}
                            >
                + {s}
              </span>
                        ))}
                        {candidate.ai_weaknesses.slice(0, 3).map((w, i) => (
                            <span
                                key={i}
                                style={{
                                    fontSize: 10,
                                    padding: '2px 8px',
                                    borderRadius: 4,
                                    background: 'rgba(248,113,113,0.08)',
                                    border: '1px solid rgba(248,113,113,0.2)',
                                    color: '#f87171',
                                }}
                            >
                − {w}
              </span>
                        ))}
                    </div>
                </div>
            )}
        </section>
    )
}