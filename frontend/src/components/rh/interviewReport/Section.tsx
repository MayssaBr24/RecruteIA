import type { ReactNode } from 'react'

interface SectionProps {
    id: string
    title: string
    icon: string
    children: ReactNode
    accent?: string
}

/**
 * Standard section wrapper used in the report.
 * Renders an anchor target (`id`), a divider header with icon + title,
 * and the section children.
 */
export function Section({ id, title, icon, children, accent = '#fbbf24' }: SectionProps) {
    return (
        <section id={id} style={{ marginBottom: 48 }}>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 20,
                    paddingBottom: 12,
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}
            >
                <span style={{ fontSize: 16 }}>{icon}</span>
                <h2
                    style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: accent,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        margin: 0,
                    }}
                >
                    {title}
                </h2>
            </div>
            {children}
        </section>
    )
}