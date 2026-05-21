import {Scores, SecurityWarnings} from "../../../types/types.ts";
import {Section} from "./Section.tsx";
import {CircleGauge} from "./CircleGauge.tsx";
import {scoreBg, scoreColor} from "../../../types/utils.ts";
import {ScoreBar} from "./ScoreBar.tsx";
import {ScoreBreakdown} from "../recruitment/types";

interface Props {
    scores: Scores
    score_breakdown: ScoreBreakdown[]
    security_warnings: SecurityWarnings
}

const PHASE_META: { key: keyof Scores; label: string; icon: string }[] = [
    { key: 'communication',    label: 'Communication',  icon: '💬' },
    { key: 'cv_clarification', label: 'Parcours CV',    icon: '📋' },
    { key: 'technical',        label: 'Technique oral', icon: '⚙️' },
    { key: 'scenario',         label: 'Scénarios',      icon: '🎯' },
    { key: 'qcm',             label: 'QCM',            icon: '📊' },
    { key: 'vocal',           label: 'Vocal',          icon: '🎙️' },
]

export function ScoresSection({ scores, score_breakdown, security_warnings }: Props) {
    return (
        <Section id="scores" title="Scores détaillés" icon="◉" accent="#fbbf24">
            {/* Global score + breakdown bars */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 32,
                    padding: 24,
                    borderRadius: 14,
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    marginBottom: 20,
                }}
            >
                {/* Circle gauge */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                    <CircleGauge score={scores.global} size={100} stroke={7} />
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
            <span
                style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: scoreColor(scores.global),
                    fontFamily: 'DM Mono, monospace',
                }}
            >
              {scores.global}
            </span>
                        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>/100</span>
                    </div>
                </div>

                {/* Per-phase bars (exclude vocal which has its own section) */}
                <div style={{ flex: 1 }}>
                    {score_breakdown
                        .filter((b) => b.phase !== 'vocal')
                        .map((b) => (
                            <ScoreBar
                                key={b.phase}
                                score={b.score}
                                label={b.label}
                                sub={`poids ${Math.round(b.weight * 100)}%`}
                            />
                        ))}
                </div>
            </div>

            {/* Phase score tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {PHASE_META.map(({ key, label, icon }) => {
                    const score = scores[key] ?? 0
                    return (
                        <div
                            key={key}
                            style={{
                                padding: 16,
                                borderRadius: 10,
                                background: scoreBg(score),
                                border: `1px solid ${scoreColor(score)}20`,
                                textAlign: 'center',
                            }}
                        >
                            <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
                            <div
                                style={{
                                    fontSize: 22,
                                    fontWeight: 800,
                                    color: scoreColor(score),
                                    fontFamily: 'DM Mono, monospace',
                                }}
                            >
                                {score ?? '—'}
                            </div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                                {label}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Security penalty indicator */}
            {security_warnings.total_penalty > 0 && (
                <div
                    style={{
                        marginTop: 14,
                        padding: '10px 16px',
                        borderRadius: 8,
                        background: 'rgba(239,68,68,0.06)',
                        border: '1px solid rgba(239,68,68,0.15)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
            Pénalité sécurité appliquée
          </span>
                    <span
                        style={{
                            fontSize: 13,
                            color: '#f87171',
                            fontWeight: 700,
                            fontFamily: 'DM Mono, monospace',
                        }}
                    >
            -{security_warnings.total_penalty} pts
          </span>
                </div>
            )}
        </Section>
    )
}