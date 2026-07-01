/**
 * useVocalMonitor — Surveillance vocale en temps réel
 *
 * Ouvre le micro en continu et envoie un chunk audio toutes les 12s
 * au backend pour détecter les changements de locuteur.
 *
 * Usage dans AIInterviewPage :
 *   useVocalMonitor({
 *     token,
 *     active: appStep === 'interview' && ACTIVE_STATUSES.includes(state.status),
 *     onWarning: (msg, count) => { setWarningMessage(msg); setWarningCount(count) },
 *     onTerminated: (msg) => { setFraudTerminated(msg) },
 *   })
 */

import { useEffect, useRef, useCallback } from 'react'

const BASE = import.meta.env.VITE_API_BASE_URL || ''
const PREFIX = '/api/recruitment'

// Intervalle entre chaque envoi de chunk (ms)
const CHECK_INTERVAL_MS = 12_000   // 12 secondes

// Durée de chaque chunk enregistré (ms)
const CHUNK_DURATION_MS = 10_000  // 10 secondes

interface UseVocalMonitorOptions {
    token:        string
    active:       boolean
    onWarning?:   (message: string, count: number) => void
    onTerminated: (message: string) => void
}

export function useVocalMonitor({
                                    token,
                                    active,
                                    onWarning,
                                    onTerminated,
                                }: UseVocalMonitorOptions) {
    const streamRef        = useRef<MediaStream | null>(null)
    const recorderRef      = useRef<MediaRecorder | null>(null)
    const chunksRef        = useRef<Blob[]>([])
    const intervalRef      = useRef<ReturnType<typeof setInterval> | null>(null)
    const activeRef        = useRef(active)
    const warningCountRef  = useRef(0)
    const isRunningRef     = useRef(false)

    useEffect(() => { activeRef.current = active }, [active])

    // ── Envoi d'un chunk au backend ───────────────────────────────────────────
    const sendChunk = useCallback(async (blob: Blob) => {
        if (!activeRef.current || blob.size < 1000) return  // chunk trop petit → skip

        try {
            const form = new FormData()
            form.append('audio', blob, 'chunk.webm')
            form.append('timestamp', String(Date.now() / 1000))

            const res = await fetch(
                `${BASE}${PREFIX}/ai-interview/${token}/vocal-check/`,
                { method: 'POST', body: form }
            )

            if (!res.ok) return

            const data = await res.json()

            // Entretien arrêté par le backend
            if (data.terminated) {
                onTerminated('Entretien terminé : changement de locuteur détecté.')
                stop()
                return
            }

            // Warnings détectés
            if (data.warnings && data.warnings.length > 0) {
                warningCountRef.current += data.warnings.length
                const count = data.total_vocal_warnings || warningCountRef.current

                const w = data.warnings[0]
                const msg = `⚠️ ${w.description} (${count}/3 incidents)`

                if (onWarning) {
                    onWarning(msg, count)
                }
            }

        } catch (err) {
            // Erreur réseau → ne pas bloquer l'entretien
            console.warn('[VocalMonitor] Erreur envoi chunk:', err)
        }
    }, [token, onTerminated, onWarning])

    // ── Démarrage surveillance ────────────────────────────────────────────────
    const start = useCallback(async () => {
        if (isRunningRef.current) return
        isRunningRef.current = true

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate:       16000,
                }
            })
            streamRef.current = stream

            const startRecordingCycle = () => {
                if (!activeRef.current || !streamRef.current) return

                chunksRef.current = []

                const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                    ? 'audio/webm;codecs=opus'
                    : 'audio/webm'

                const recorder = new MediaRecorder(stream, { mimeType })
                recorderRef.current = recorder

                recorder.ondataavailable = (e) => {
                    if (e.data.size > 0) chunksRef.current.push(e.data)
                }

                recorder.onstop = () => {
                    const blob = new Blob(chunksRef.current, { type: mimeType })
                    sendChunk(blob)
                }

                recorder.start()

                // Arrêter après CHUNK_DURATION_MS pour envoyer le chunk
                setTimeout(() => {
                    if (recorder.state === 'recording') {
                        recorder.stop()
                    }
                }, CHUNK_DURATION_MS)
            }

            // Premier cycle immédiat
            startRecordingCycle()

            // Cycles suivants toutes les CHECK_INTERVAL_MS
            intervalRef.current = setInterval(() => {
                if (!activeRef.current) {
                    stop()
                    return
                }
                startRecordingCycle()
            }, CHECK_INTERVAL_MS)

        } catch (err) {
            console.warn('[VocalMonitor] Micro inaccessible:', err)
            isRunningRef.current = false
        }
    }, [sendChunk])

    // ── Arrêt surveillance ────────────────────────────────────────────────────
    const stop = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
        }
        if (recorderRef.current?.state === 'recording') {
            recorderRef.current.stop()
        }
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current   = null
        recorderRef.current = null
        isRunningRef.current = false
    }, [])

    // ── Démarrage / arrêt selon `active` ─────────────────────────────────────
    useEffect(() => {
        if (active) {
            start()
        } else {
            stop()
        }
        return () => stop()
    }, [active])  // eslint-disable-line react-hooks/exhaustive-deps

    return { stop }
}