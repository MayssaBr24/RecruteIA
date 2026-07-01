import { useEffect, useRef, useCallback } from 'react'
import * as faceapi from 'face-api.js'
import { interviewApi } from '../api/interviewApi'

interface UseFaceDetectionOptions {
    token:            string
    videoRef:         React.RefObject<HTMLVideoElement | null>
    active:           boolean
    onTerminated:     (msg: string) => void
    onWarning?:       (msg: string, type: string, count: number) => void
    checkIntervalMs?: number
}

const MODEL_URL = '/models'

let modelsLoaded = false
let modelsLoadingPromise: Promise<void> | null = null

async function ensureModelsLoaded() {
    if (modelsLoaded) {
        console.log('[FaceDetection] modèles déjà chargés')
        return
    }
    if (!modelsLoadingPromise) {
        console.log('[FaceDetection] chargement des modèles...')
        modelsLoadingPromise = faceapi.nets.tinyFaceDetector
            .loadFromUri(MODEL_URL)
            .then(() => {
                modelsLoaded = true
                console.log('[FaceDetection] ✅ modèles chargés OK')
            })
            .catch((err) => {
                console.error('[FaceDetection] ❌ échec chargement modèles:', err)
                modelsLoadingPromise = null
            })
    }
    return modelsLoadingPromise
}

export function useFaceDetection({
                                     token, videoRef, active, onTerminated, onWarning, checkIntervalMs = 5000,
                                 }: UseFaceDetectionOptions) {
    const intervalRef     = useRef<ReturnType<typeof setInterval> | null>(null)
    const noFaceCount     = useRef(0)
    const offCenterCount  = useRef(0)
    const coolingDown     = useRef<Record<string, boolean>>({})

    // ── Refs stables pour éviter de relancer le useEffect ─────────────
    const onTerminatedRef = useRef(onTerminated)
    const onWarningRef    = useRef(onWarning)
    const tokenRef        = useRef(token)
    useEffect(() => { onTerminatedRef.current = onTerminated }, [onTerminated])
    useEffect(() => { onWarningRef.current = onWarning }, [onWarning])
    useEffect(() => { tokenRef.current = token }, [token])

    const sendWarning = useCallback(async (
        type: 'face_not_visible' | 'multiple_faces' | 'face_not_centered',
        details: string,
    ) => {
        console.log('[FaceDetection] >>> sendWarning appelé:', type, details)

        if (coolingDown.current[type]) {
            console.log('[FaceDetection] cooldown actif, warning ignoré:', type)
            return
        }
        coolingDown.current[type] = true
        setTimeout(() => { coolingDown.current[type] = false }, 10_000)

        try {
            const res = await interviewApi.warning(tokenRef.current, type, details)
            console.log('[FaceDetection] réponse backend:', res)
            if (res.terminated) {
                onTerminatedRef.current(res.message || 'Entretien terminé pour comportement suspect.')
            } else if (onWarningRef.current) {
                onWarningRef.current(
                    res.message || `Incident détecté (${type})`,
                    type,
                    res.warning_count,
                )
            }
        } catch (err) {
            console.error('[FaceDetection] ❌ erreur appel warning API:', err)
        }
    }, [])

    const analyzeFrame = useCallback(async () => {
        console.log('[FaceDetection] --- analyzeFrame tick ---')

        const video = videoRef.current
        if (!video) {
            console.warn('[FaceDetection] videoRef.current est null')
            return
        }
        if (video.readyState < 2) {
            console.warn('[FaceDetection] video pas prête, readyState =', video.readyState)
            return
        }

        await ensureModelsLoaded()
        if (!modelsLoaded) {
            console.warn('[FaceDetection] modèles non chargés, skip')
            return
        }

        try {
            const detections = await faceapi.detectAllFaces(
                video,
                new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }),
            )
            console.log('[FaceDetection] visages détectés:', detections.length)

            // ── Aucun visage ──────────────────────────────────────────
            if (detections.length === 0) {
                noFaceCount.current++
                offCenterCount.current = 0
                console.log('[FaceDetection] noFaceCount =', noFaceCount.current)
                if (noFaceCount.current >= 1) {
                    sendWarning('face_not_visible', 'Aucun visage détecté')
                    noFaceCount.current = 0
                }
                return
            }
            noFaceCount.current = 0

            // ── Plusieurs visages ────────────────────────────────────
            if (detections.length > 1) {
                sendWarning('multiple_faces', `${detections.length} visages détectés`)
                return
            }

            // ── Visage non centré ────────────────────────────────────
            const box = detections[0].box
            const videoW = video.videoWidth
            const videoH = video.videoHeight

            const dx = Math.abs((box.x + box.width / 2)  - videoW / 2) / videoW
            const dy = Math.abs((box.y + box.height / 2) - videoH / 2) / videoH

            console.log('[FaceDetection] dx =', dx.toFixed(3), 'dy =', dy.toFixed(3))

            if (dx > 0.25 || dy > 0.25) {
                offCenterCount.current++
                console.log('[FaceDetection] offCenterCount =', offCenterCount.current)
                if (offCenterCount.current >= 2) {
                    sendWarning('face_not_centered', `Visage décentré (dx=${(dx*100).toFixed(0)}%, dy=${(dy*100).toFixed(0)}%)`)
                    offCenterCount.current = 0
                }
            } else {
                offCenterCount.current = 0
            }
        } catch (err) {
            console.error('[FaceDetection] ❌ erreur detectAllFaces:', err)
        }
    }, [videoRef, sendWarning])

    useEffect(() => {
        console.log('[FaceDetection] useEffect déclenché, active =', active)

        if (!active) {
            console.log('[FaceDetection] inactive, arrêt de la surveillance')
            if (intervalRef.current) clearInterval(intervalRef.current)
            return
        }

        ensureModelsLoaded()

        console.log('[FaceDetection] démarrage dans 3s...')
        const startTimeout = setTimeout(() => {
            console.log('[FaceDetection] ✅ intervalle démarré, checkIntervalMs =', checkIntervalMs)
            intervalRef.current = setInterval(analyzeFrame, checkIntervalMs)
        }, 3000)

        return () => {
            console.log('[FaceDetection] cleanup useEffect')
            clearTimeout(startTimeout)
            if (intervalRef.current) clearInterval(intervalRef.current)
        }
    }, [active, checkIntervalMs])
}