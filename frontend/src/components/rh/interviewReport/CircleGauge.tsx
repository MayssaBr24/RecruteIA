import {scoreColor} from "../../../types/utils.ts";

interface CircleGaugeProps {
    score: number
    size?: number
    stroke?: number
}

/**
 * Animated SVG circular gauge.
 * `score` should be between 0 and 100.
 */
export function CircleGauge({ score, size = 72, stroke = 5 }: CircleGaugeProps) {
    const r = (size - stroke * 2) / 2
    const circ = 2 * Math.PI * r
    const dash = (score / 100) * circ
    const color = scoreColor(score)

    return (
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
            <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth={stroke}
            />
            <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={color}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${circ}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 1s ease' }}
            />
        </svg>
    )
}