// Détecte l'absence de visage via luminosité/mouvement et envoie des warnings
// Utilise uniquement les APIs navigateur natives (pas de lib externe)

import { useEffect, useRef, useCallback } from 'react'
import { interviewApi } from '../api/interviewApi'

interface UseFaceDetectionOptions {
    token:           string
    videoRef:        React.RefObject<HTMLVideoElement>
    active:          boolean         // actif seulement pendant l'entretien
    onTerminated:    (msg: string) => void
    checkIntervalMs: number          // fréquence de vérification (défaut 8000ms)
}

export function useFaceDetection({
                                     token, videoRef, active, onTerminated, checkIntervalMs = 8000,
                                 }: UseFaceDetectionOptions) {
    const canvasRef       = useRef<HTMLCanvasElement>(document.createElement('canvas'))
    const intervalRef     = useRef<ReturnType<typeof setInterval> | null>(null)
    const noFaceCount     = useRef(0)     // compteur consécutif sans visage
    const prevFrameData   = useRef<Uint8ClampedArray | null>(null)
    const coolingDown     = useRef(false)

    const sendWarning = useCallback(async (type: 'face_not_visible' | 'multiple_faces', details: string) => {
        if (coolingDown.current) return
        coolingDown.current = true
        setTimeout(() => { coolingDown.current = false }, 10_000) // cooldown 10s

        const res = await interviewApi.warning(token, type, details)
        if (res.terminated) {
            onTerminated(res.message || 'Entretien terminé pour comportement suspect.')
        }
    }, [token, onTerminated])

    // ── Analyse d'une frame vidéo ─────────────────────────────────────
    const analyzeFrame = useCallback(() => {
        const video  = videoRef.current
        const canvas = canvasRef.current
        if (!video || video.readyState < 2) return

        const W = 160, H = 120  // basse résolution pour les perfs
        canvas.width  = W
        canvas.height = H

        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return

        ctx.drawImage(video, 0, 0, W, H)
        const frame = ctx.getImageData(0, 0, W, H)
        const data  = frame.data

        // ── 1. Luminosité moyenne ──────────────────────────────────────
        // Si trop sombre → caméra bouchée ou lumière coupée
        let totalBrightness = 0
        for (let i = 0; i < data.length; i += 4) {
            totalBrightness += (data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114)
        }
        const avgBrightness = totalBrightness / (W * H)

        if (avgBrightness < 15) {
            // Image quasi noire — caméra cachée ou lumière coupée
            noFaceCount.current++
            if (noFaceCount.current >= 2) {
                sendWarning('face_not_visible', `Caméra obstruée ou trop sombre (luminosité: ${avgBrightness.toFixed(0)})`)
                noFaceCount.current = 0
            }
            prevFrameData.current = data
            return
        }

        // ── 2. Détection de mouvement (différence inter-frames) ────────
        // Si aucun mouvement → personne devant la caméra
        if (prevFrameData.current) {
            let diff = 0
            for (let i = 0; i < data.length; i += 4) {
                diff += Math.abs(data[i]   - prevFrameData.current[i])
                    + Math.abs(data[i+1] - prevFrameData.current[i+1])
                    + Math.abs(data[i+2] - prevFrameData.current[i+2])
            }
            const avgDiff = diff / (W * H * 3)

            if (avgDiff < 1.5) {
                // Très peu de mouvement — image statique (absent ou image fixe)
                noFaceCount.current++
                if (noFaceCount.current >= 3) {
                    sendWarning('face_not_visible', `Aucun mouvement détecté (score: ${avgDiff.toFixed(2)})`)
                    noFaceCount.current = 0
                }
            } else {
                // Mouvement normal → visage probablement présent
                noFaceCount.current = Math.max(0, noFaceCount.current - 1)
            }
        }

        // ── 3. Détection de teinte "peau" dans la zone centrale ────────
        // Vérifie la présence d'une teinte de peau dans le centre de l'image
        let skinPixels = 0
        const cx = Math.floor(W / 2), cy = Math.floor(H / 2)
        const radius = Math.floor(Math.min(W, H) * 0.35)

        for (let y = cy - radius; y < cy + radius; y++) {
            for (let x = cx - radius; x < cx + radius; x++) {
                const i = (y * W + x) * 4
                const r = data[i], g = data[i+1], b = data[i+2]
                // Heuristique de teinte peau (fonctionne pour toutes les carnations)
                if (r > 60 && g > 40 && b > 20 && r > g && r > b &&
                    Math.abs(r - g) > 15 && r - b > 20) {
                    skinPixels++
                }
            }
        }

        const skinRatio = skinPixels / (Math.PI * radius * radius)
        if (skinRatio < 0.05 && avgBrightness > 30) {
            // Peu de pixels "peau" dans la zone centrale → peut-être pas de visage
            noFaceCount.current++
            if (noFaceCount.current >= 4) {
                sendWarning('face_not_visible', `Visage non détecté (ratio peau: ${(skinRatio * 100).toFixed(1)}%)`)
                noFaceCount.current = 0
            }
        } else {
            noFaceCount.current = Math.max(0, noFaceCount.current - 1)
        }

        prevFrameData.current = new Uint8ClampedArray(data)
    }, [videoRef, sendWarning])

    // ── Démarrage / arrêt de la surveillance ─────────────────────────
    useEffect(() => {
        if (!active) {
            if (intervalRef.current) clearInterval(intervalRef.current)
            return
        }
        // Attendre 5s avant la première vérification (temps de se installer)
        const startTimeout = setTimeout(() => {
            intervalRef.current = setInterval(analyzeFrame, checkIntervalMs)
        }, 5000)

        return () => {
            clearTimeout(startTimeout)
            if (intervalRef.current) clearInterval(intervalRef.current)
        }
    }, [active, analyzeFrame, checkIntervalMs])
}