import {scoreColor} from "../../../types/utils.ts";

interface ScoreBarProps {
    score: number
    label: string
    sub?: string
}

/** Horizontal progress bar labelled with score and an optional sub-text. */
export function ScoreBar({ score, label, sub }: ScoreBarProps) {
    return (
        <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{label}</span>
                <span style={{ fontSize: 12, color: scoreColor(score), fontWeight: 700 }}>
          {score}/100{sub ? ` · ${sub}` : ''}
        </span>
            </div>
            <div
                style={{
                    height: 5,
                    borderRadius: 99,
                    background: 'rgba(255,255,255,0.06)',
                    overflow: 'hidden',
                }}
            >
                <div
                    style={{
                        height: '100%',
                        width: `${score}%`,
                        background: scoreColor(score),
                        borderRadius: 99,
                        transition: 'width 1.2s ease',
                    }}
                />
            </div>
        </div>
    )
}