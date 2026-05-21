
/** Returns a colour string based on a 0-100 score. */
export function scoreColor(s: number): string {
    if (s >= 80) return '#4ade80'
    if (s >= 60) return '#fbbf24'
    if (s >= 40) return '#fb923c'
    return '#f87171'
}

/** Returns a translucent background matching the score colour. */
export function scoreBg(s: number): string {
    if (s >= 80) return 'rgba(74,222,128,0.10)'
    if (s >= 60) return 'rgba(251,191,36,0.10)'
    if (s >= 40) return 'rgba(251,146,60,0.10)'
    return 'rgba(248,113,113,0.10)'
}

/** Returns the colour associated with a recommendation status. */
export function recoColor(r: string): string {
    switch (r) {
        case 'VALIDATED': return '#4ade80'
        case 'REJECTED':  return '#f87171'
        case 'TO_REVIEW': return '#fbbf24'
        default:          return '#94a3b8'
    }
}

/** Returns a human-readable label with emoji for a recommendation status. */
export function recoLabel(r: string): string {
    switch (r) {
        case 'VALIDATED': return '✅ Validé'
        case 'REJECTED':  return '❌ Rejeté'
        case 'TO_REVIEW': return '🟡 À revoir'
        default:          return '⏳ En attente'
    }
}

/** Returns a colour representing an incident/anomaly severity. */
export function severityColor(s: string): string {
    switch (s) {
        case 'critical': return '#ef4444'
        case 'high':     return '#f97316'
        case 'medium':   return '#fbbf24'
        default:         return '#60a5fa'
    }
}

/** Returns a colour for a QCM difficulty level. */
export function diffColor(d: string): string {
    switch (d) {
        case 'hard':   return '#f87171'
        case 'medium': return '#fbbf24'
        default:       return '#4ade80'
    }
}

/** Returns the emoji icon for a severity level. */
export function severityIcon(s: string): string {
    switch (s) {
        case 'critical': return '⛔'
        case 'high':     return '🔴'
        default:         return '🟡'
    }
}

/** Formats a Date (or ISO string) to a French locale string. */
export function formatDate(value: string | null | undefined): string {
    if (!value) return '—'
    return new Date(value).toLocaleString('fr-FR')
}


// utils.ts
import { getDay } from 'date-fns'

export const getDjangoDayNum = (d: Date): number => {
    const jsDay = getDay(d)
    return jsDay === 0 ? 6 : jsDay - 1
}
