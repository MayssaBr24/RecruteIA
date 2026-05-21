import {formatDate, recoColor, recoLabel} from "../../../types/utils.ts";
import {Section} from "./Section.tsx";
import {Recommendation, ReportData} from "../../../types/types.ts";


interface Props {
    recommendation: Recommendation
    report: Pick<ReportData, 'generated_at' | 'interview_id' | 'interview_token' | 'has_video' | 'video_url'>
}

export function RecoSection({ recommendation, report }: Props) {
    const recoKey = recommendation.final_recommendation
    const color   = recoColor(recoKey)
    const emoji   =
        recoKey === 'VALIDATED' ? '✅'
            : recoKey === 'REJECTED' ? '❌'
                : recoKey === 'TO_REVIEW' ? '🟡'
                    : '⏳'

    return (
        <Section id="reco" title="Recommandation finale" icon="●" accent={color}>
            {/* ── Verdict card ── */}
            <div
                style={{
                    padding: 24,
                    borderRadius: 14,
                    background: `${color}08`,
                    border: `1px solid ${color}25`,
                    marginBottom: 20,
                    textAlign: 'center',
                }}
            >
                <div style={{ fontSize: 36, marginBottom: 8 }}>{emoji}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color }}>
                    {recoLabel(recoKey)}
                </div>
                {recommendation.override_recommendation && (
                    <div style={{ marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                        (Recommandation IA : {recoLabel(recommendation.ai_recommendation)} — surchargée par le
                        RH)
                    </div>
                )}
            </div>

            {/* ── Full AI feedback ── */}
            {recommendation.ai_feedback_full && (
                <div style={{ marginBottom: 16 }}>
                    <div
                        style={{
                            fontSize: 10,
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            color: 'rgba(255,255,255,0.25)',
                            marginBottom: 8,
                        }}
                    >
                        Analyse IA détaillée
                    </div>
                    <div
                        style={{
                            padding: 18,
                            borderRadius: 12,
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.05)',
                            fontSize: 13,
                            color: 'rgba(255,255,255,0.65)',
                            lineHeight: 1.8,
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'DM Mono, monospace',
                        }}
                    >
                        {recommendation.ai_feedback_full}
                    </div>
                </div>
            )}

            {/* ── HR annotation ── */}
            {recommendation.rh_annotation && (
                <div
                    style={{
                        padding: 16,
                        borderRadius: 10,
                        background: 'rgba(251,191,36,0.06)',
                        border: '1px solid rgba(251,191,36,0.2)',
                    }}
                >
                    <div
                        style={{
                            fontSize: 10,
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            color: 'rgba(251,191,36,0.6)',
                            marginBottom: 6,
                        }}
                    >
                        Annotation RH
                    </div>
                    <p
                        style={{
                            margin: 0,
                            fontSize: 13,
                            color: 'rgba(255,255,255,0.7)',
                            lineHeight: 1.6,
                        }}
                    >
                        {recommendation.rh_annotation}
                    </p>
                    {recommendation.rh_rating != null && (
                        <div style={{ marginTop: 8, fontSize: 12, color: '#fbbf24' }}>
                            {'★'.repeat(recommendation.rh_rating)}
                            {'☆'.repeat(5 - recommendation.rh_rating)} ({recommendation.rh_rating}/5)
                        </div>
                    )}
                </div>
            )}

            {/* ── Video recording ── */}
            {report.has_video && report.video_url && (
                <div
                    style={{
                        marginTop: 16,
                        padding: 16,
                        borderRadius: 10,
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.06)',
                    }}
                >
                    <div
                        style={{
                            fontSize: 10,
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            color: 'rgba(255,255,255,0.25)',
                            marginBottom: 10,
                        }}
                    >
                        Enregistrement vidéo
                    </div>
                    <video
                        src={report.video_url}
                        controls
                        style={{ width: '100%', borderRadius: 8, maxHeight: 320 }}
                    />
                </div>
            )}

            {/* ── Report footer ── */}
            <div
                style={{
                    marginTop: 32,
                    paddingTop: 16,
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 10,
                    color: 'rgba(255,255,255,0.15)',
                    fontFamily: 'DM Mono, monospace',
                }}
            >
                <span>Rapport généré le {formatDate(report.generated_at)}</span>
                <span>
          Entretien #{report.interview_id} · {report.interview_token.slice(0, 8)}…
        </span>
            </div>
        </Section>
    )
}