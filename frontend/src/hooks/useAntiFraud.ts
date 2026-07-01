import { useEffect, useRef, useCallback } from 'react'
import type {IdentityFlags, VocalWarning, WarningType} from '../types/interview'
import { interviewApi } from '../api/interviewApi.ts'

interface UseAntiFraudOptions {
    token: string
    active: boolean
    onTerminated: (message: string) => void
    onWarning?: (message: string, count: number) => void
    answerBoxSelector?: string
}

export function useAntiFraud({
                                 token,
                                 active,
                                 onTerminated,
                                 onWarning,
                                 answerBoxSelector = 'textarea',
                             }: UseAntiFraudOptions) {
    const activeRef   = useRef(active)
    const coolingDown = useRef<Record<string, number>>({})

    useEffect(() => { activeRef.current = active }, [active])

    const sendWarning = useCallback(async (type: WarningType, details = '') => {
        if (!activeRef.current) return
        const now  = Date.now()
        const last = coolingDown.current[type] || 0
        if (now - last < 30_000) return
        coolingDown.current[type] = now

        const response = await interviewApi.warning(token, type, details)
        if (response.terminated) {
            onTerminated(response.message || 'Entretien terminé pour comportement suspect.')
        } else if (onWarning && response.message) {
            onWarning(response.message, response.warning_count)
        }
    }, [token, onTerminated, onWarning])

    // ── Changement d'onglet ──────────────────────────────────────────
    useEffect(() => {
        const handler = () => {
            if (document.visibilityState === 'hidden')
                sendWarning('tab_switch', 'Page masquée')
        }
        document.addEventListener('visibilitychange', handler)
        return () => document.removeEventListener('visibilitychange', handler)
    }, [sendWarning])

    // ── Copier-coller hors zone de réponse ───────────────────────────
    useEffect(() => {
        const handler = (e: ClipboardEvent) => {
            const target = e.target as HTMLElement | null
            if (target && (
                target.tagName === 'TEXTAREA' ||
                target.tagName === 'INPUT'    ||
                target.closest(answerBoxSelector)
            )) return
            sendWarning('copy_paste', 'Copier-coller hors zone de réponse')
        }
        document.addEventListener('paste', handler)
        return () => document.removeEventListener('paste', handler)
    }, [sendWarning, answerBoxSelector])

    // ── Sortie plein écran ───────────────────────────────────────────
    useEffect(() => {
        const handler = () => {
            if (!document.fullscreenElement)
                sendWarning('fullscreen_exit', 'Sortie du mode plein écran')
        }
        document.addEventListener('fullscreenchange', handler)
        return () => document.removeEventListener('fullscreenchange', handler)
    }, [sendWarning])

    // ── Multi-écran (AnyDesk nécessite souvent un 2e écran) ──────────
    useEffect(() => {
        interface ScreenExtended extends Screen {
            isExtended?: boolean
        }
        interface ScreenDetails {
            screens: unknown[]
        }
        interface WindowWithScreenDetails extends Window {
            getScreenDetails?: () => Promise<ScreenDetails>
        }

        const extScreen = screen as ScreenExtended
        if (extScreen.isExtended) {
            sendWarning('multi_screen', 'Configuration multi-écran détectée')
        }

        const win = window as WindowWithScreenDetails
        if (typeof win.getScreenDetails === 'function') {
            win.getScreenDetails()
                .then((details) => {
                    if (details?.screens?.length > 1)
                        sendWarning('multi_screen', `${details.screens.length} écrans détectés`)
                })
                .catch(() => {})
        }
    }, [sendWarning])

    // ── DevTools ouverts ─────────────────────────────────────────────
    // Astuce : console.log avec getter déclenche un timing différent
    // quand DevTools est ouvert
    useEffect(() => {
        let devtoolsOpen = false
        const threshold  = 160

        const check = () => {
            const heightDiff = window.outerHeight - window.innerHeight
            const widthDiff  = window.outerWidth  - window.innerWidth

            const isOpen = heightDiff > threshold || widthDiff > threshold

            if (isOpen && !devtoolsOpen) {
                devtoolsOpen = true
                sendWarning('devtools_open', "DevTools ouvert pendant l'entretien")
            } else if (!isOpen) {
                devtoolsOpen = false
            }
        }

        const interval = setInterval(check, 3000)
        return () => clearInterval(interval)
    }, [sendWarning])

    const detectVocalWarnings = useCallback((response: {
        vocal_warnings?: VocalWarning[]
        anomalies?: VocalWarning[]
        vocal_security_penalty?: number
        identity_flags?: IdentityFlags
        has_speaker_change?: boolean
        has_multiple_speakers?: boolean
        user_message?: string
        terminated?: boolean
    }) => {
        if (response.terminated) {
            onTerminated('Entretien terminé pour raisons de sécurité vocale.')
            return
        }

        const warnings = response.vocal_warnings ?? response.anomalies ?? []

        const relevant = warnings.filter(w =>
            ['speaker_change', 'multiple_speakers_simultaneous', 'question_reread'].includes(w.type)
        )

        if (relevant.length > 0 && onWarning) {
            const critical = relevant.filter(w => w.severity === 'critical' || w.severity === 'high')
            if (critical.length > 0) {
                onWarning(
                    `⚠️ Anomalie vocale critique: ${critical.map(w => w.description).join(', ')}`,
                    relevant.length
                )
            } else {
                onWarning(relevant[0].description || 'Anomalie vocale détectée', relevant.length)
            }
        }

        if (response.user_message && onWarning) {
            onWarning(response.user_message, warnings.length)
        }
    }, [onTerminated, onWarning])

    return {
        sendWarning,
        detectVocalWarnings,
    }
}