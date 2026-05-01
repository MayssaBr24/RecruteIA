// src/hooks/useAntiFraud.ts
// Surveille les comportements suspects et envoie des warnings au backend

import { useEffect, useRef, useCallback } from 'react'
import type { WarningType } from '../types/interview'
import {interviewApi} from "../api/interviewApi.ts";

interface UseAntiFraudOptions {
    token: string
    active: boolean // false pendant loading/completed/fraud
    onTerminated: (message: string) => void
}

export function useAntiFraud({ token, active, onTerminated }: UseAntiFraudOptions) {
    const activeRef = useRef(active)
    const coolingDown = useRef<Record<string, number>>({}) // évite les doubles warnings

    useEffect(() => {
        activeRef.current = active
    }, [active])

    const sendWarning = useCallback(async (type: WarningType, details = '') => {
        if (!activeRef.current) return

        // Anti-spam : même type de warning pas plus d'une fois toutes les 3s
        const now = Date.now()
        const last = coolingDown.current[type] || 0
        if (now - last < 3000) return
        coolingDown.current[type] = now

        const response = await interviewApi.warning(token, type, details)
        if (response.terminated) {
            onTerminated(response.message || 'Entretien terminé pour comportement suspect.')
        }
    }, [token, onTerminated])

    // ── Changement de visibilité (changement d'onglet) ───────────────
    useEffect(() => {
        const handler = () => {
            if (document.visibilityState === 'hidden') {
                sendWarning('tab_switch', 'Page masquée')
            }
        }
        document.addEventListener('visibilitychange', handler)
        return () => document.removeEventListener('visibilitychange', handler)
    }, [sendWarning])

    // ── Perte de focus de la fenêtre ─────────────────────────────────
    useEffect(() => {
        const handler = () => sendWarning('window_blur', 'Fenêtre en arrière-plan')
        window.addEventListener('blur', handler)
        return () => window.removeEventListener('blur', handler)
    }, [sendWarning])

    // ── Copier-coller ────────────────────────────────────────────────
    useEffect(() => {
        const handler = () => sendWarning('copy_paste', 'Copier-coller détecté')
        document.addEventListener('paste', handler)
        return () => document.removeEventListener('paste', handler)
    }, [sendWarning])

    // ── Sortie plein écran (si activé) ───────────────────────────────
    useEffect(() => {
        const handler = () => {
            if (!document.fullscreenElement) {
                sendWarning('screen_share_stopped', 'Sortie du mode plein écran')
            }
        }
        document.addEventListener('fullscreenchange', handler)
        return () => document.removeEventListener('fullscreenchange', handler)
    }, [sendWarning])
}