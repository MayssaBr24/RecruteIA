
interface BadgeProps {
    text: string
    color: string
}

/** Small pill badge with a coloured border and tinted background. */
export function Badge({ text, color }: BadgeProps) {
    return (
        <span
            style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color,
                background: `${color}18`,
                border: `1px solid ${color}30`,
                borderRadius: 4,
                padding: '2px 8px',
            }}
        >
      {text}
    </span>
    )
}