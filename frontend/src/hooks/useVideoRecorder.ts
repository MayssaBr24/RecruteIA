import { useRef, useState, useCallback } from 'react'
import { interviewApi } from '../api/interviewApi'

type VideoState = 'idle' | 'requesting' | 'recording' | 'paused' | 'uploading' | 'done' | 'error'

export interface UseVideoRecorderReturn {
    videoState:  VideoState
    videoRef: React.RefObject<HTMLVideoElement | null>
    stream:      MediaStream | null
    error:       string
    isRecording: boolean
    isPaused:    boolean
    isUploading: boolean
    isDone:      boolean
    startCamera:    () => Promise<boolean>
    startRecording: () => void
    pauseRecording: () => void
    resumeRecording: () => void
    stopAndUpload:  (token: string) => Promise<void>
    stopCamera:     () => void
}

export function useVideoRecorder(): UseVideoRecorderReturn {
    const [videoState, setVideoState] = useState<VideoState>('idle')
    const [error,      setError]      = useState('')
    const [stream,     setStream]     = useState<MediaStream | null>(null)

    const videoRefInternal = useRef<HTMLVideoElement | null>(null)
    const mediaRecorder    = useRef<MediaRecorder | null>(null)
    const chunks           = useRef<Blob[]>([])
    const streamRef        = useRef<MediaStream | null>(null)

    // Ref-callback : réassigne le stream chaque fois que l'élément <video>
    // est (re)monté dans le DOM (ex: WelcomePage -> AIInterviewPage),
    // même si `stream` lui n'a pas changé. Corrige srcObject = null
    // après remontage de l'élément <video>.
    const videoRefCallback = useCallback((el: HTMLVideoElement | null) => {
        videoRefInternal.current = el
        if (el && streamRef.current) {
            el.srcObject = streamRef.current
            el.muted = true
            el.play().catch(() => {})
        }
    }, [])

    // Exposé tel un RefObject classique : { current } en lecture,
    // mais l'assignation passe par videoRefCallback côté JSX via `ref={...}`.
    // On combine les deux : un objet avec getter `current` ET callable.
    const videoRef = videoRefCallback as unknown as React.RefObject<HTMLVideoElement | null>
    Object.defineProperty(videoRef, 'current', {
        get: () => videoRefInternal.current,
        set: (el: HTMLVideoElement | null) => { videoRefInternal.current = el },
        configurable: true,
    })

    const isRecording = videoState === 'recording'
    const isPaused     = videoState === 'paused'
    const isUploading = videoState === 'uploading'
    const isDone      = videoState === 'done'

    const startCamera = useCallback(async (): Promise<boolean> => {
        setVideoState('requesting')
        setError('')
        try {
            const s = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
                audio: true,
            })
            setStream(s)
            streamRef.current = s
            if (videoRefInternal.current) {
                videoRefInternal.current.srcObject = s
                videoRefInternal.current.muted = true
                await videoRefInternal.current.play()
            }
            setVideoState('idle')
            return true
        } catch (err: unknown) {
            const name = err instanceof Error ? (err as DOMException).name : ''
            const msg =
                name === 'NotAllowedError'  ? "Accès caméra/micro refusé. Autorisez l'accès dans votre navigateur." :
                    name === 'NotFoundError'    ? 'Caméra ou micro non trouvé sur cet appareil.' :
                        name === 'NotReadableError' ? 'Caméra déjà utilisée par une autre application.' :
                            'Impossible d\'accéder à la caméra. Vérifiez vos périphériques.'
            setError(msg)
            setVideoState('error')
            return false
        }
    }, [])

    const startRecording = useCallback(() => {
        if (!stream) { setError('Caméra non initialisée.'); return }

        chunks.current = []

        const mimeType =
            MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' :
                MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ? 'video/webm;codecs=vp8,opus' :
                    MediaRecorder.isTypeSupported('video/webm')                 ? 'video/webm' :
                        MediaRecorder.isTypeSupported('video/mp4')                  ? 'video/mp4' :
                            ''

        // Bitrate réduit : un entretien de 40 min doit rester < 100 Mo (limite Cloudinary)
        // 250 kbps vidéo + 64 kbps audio ≈ 94 Mo pour 40 min — largement suffisant
        // pour la vérification d'identité, pas pour du streaming HD.
        const recorderOptions: MediaRecorderOptions = {
            ...(mimeType ? { mimeType } : {}),
            videoBitsPerSecond: 250_000,
            audioBitsPerSecond: 64_000,
        }

        try {
            const recorder = new MediaRecorder(stream, recorderOptions)
            mediaRecorder.current = recorder
            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) chunks.current.push(e.data)
            }
            recorder.onerror = () => {
                setError("Erreur d'enregistrement vidéo.")
                setVideoState('error')
            }

            recorder.start(2000)
            setVideoState('recording')
        } catch {
            setError("Impossible de démarrer l'enregistrement vidéo.")
            setVideoState('error')
        }
    }, [stream])

    // Met l'enregistrement en pause (ex: pendant le break de 5 min) sans
    // fermer le MediaRecorder ni vider les chunks déjà capturés. La caméra
    // et le micro restent ouverts (stream non stoppé) pour pouvoir reprendre
    // instantanément, mais on coupe les pistes de l'aperçu si besoin côté UI.
    const pauseRecording = useCallback(() => {
        const recorder = mediaRecorder.current
        if (recorder && recorder.state === 'recording') {
            recorder.pause()
        }
        setVideoState('paused')
    }, [])

    // Reprend l'enregistrement après une pause. Le MediaRecorder reprend
    // l'écriture dans le MÊME blob logique (mêmes chunks.current), donc
    // l'upload final contiendra une vidéo continue avec un "trou" silencieux
    // correspondant à la durée du break (pas de nouvel upload, pas de reset).
    const resumeRecording = useCallback(() => {
        const recorder = mediaRecorder.current
        if (recorder && recorder.state === 'paused') {
            recorder.resume()
            setVideoState('recording')
            return
        }
        // Si le recorder n'existe plus / a été arrêté entre temps (cas limite),
        // on relance un enregistrement frais sur le stream courant plutôt que
        // de rester bloqué en silence.
        if (stream && (!recorder || recorder.state === 'inactive')) {
            startRecording()
        }
    }, [stream, startRecording])

    const stopAndUpload = useCallback((token: string): Promise<void> => {
        return new Promise((resolve) => {
            const recorder = mediaRecorder.current
            if (!recorder || recorder.state === 'inactive') {
                resolve()
                return
            }

            recorder.onstop = async () => {
                if (chunks.current.length === 0) { resolve(); return }

                const mimeType = recorder.mimeType || 'video/webm'
                const blob = new Blob(chunks.current, { type: mimeType })

                if (blob.size < 10_000) { resolve(); return }

                // Garde-fou : limite Cloudinary = 100 Mo
                const MAX_SIZE = 95 * 1024 * 1024  // marge de sécurité
                if (blob.size > MAX_SIZE) {
                    console.warn(`Vidéo trop volumineuse (${(blob.size / 1_000_000).toFixed(1)} Mo) — upload ignoré`)
                    setVideoState('done')  // n'empêche pas la fin de l'entretien
                    resolve()
                    return
                }

                setVideoState('uploading')
                try {
                    await interviewApi.uploadVideo(token, blob)
                } catch (err) {
                    console.error('Upload vidéo échoué', err)
                }
                setVideoState('done')
                resolve()
            }

            // Si on stoppe pendant que le recorder est en pause, certains
            // navigateurs déclenchent quand même 'onstop' correctement après
            // recorder.stop() — pas besoin de resume() avant.
            recorder.stop()
            streamRef.current?.getTracks().forEach(t => t.stop())
        })
    }, [])

    const stopCamera = useCallback(() => {
        if (mediaRecorder.current?.state === 'recording' || mediaRecorder.current?.state === 'paused') {
            mediaRecorder.current.stop()
        }
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = null
        setStream(null)
        setVideoState('idle')
    }, [])

    return {
        videoState, videoRef, stream, error,
        isRecording, isPaused, isUploading, isDone,
        startCamera, startRecording, pauseRecording, resumeRecording, stopAndUpload, stopCamera,
    }
}