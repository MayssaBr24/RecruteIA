// src/hooks/useVideoRecorder.ts
// Enregistre la vidéo de l'entretien en continu et l'uploade à la fin

import { useRef, useState, useCallback } from 'react'
import { interviewApi } from '../api/interviewApi'

type VideoState = 'idle' | 'requesting' | 'recording' | 'uploading' | 'done' | 'error'

export interface UseVideoRecorderReturn {
    videoState:  VideoState
    videoRef:    React.RefObject<HTMLVideoElement>
    stream:      MediaStream | null
    error:       string
    isRecording: boolean
    isUploading: boolean
    isDone:      boolean
    startCamera: () => Promise<boolean>   // démarre caméra + micro, retourne succès
    startRecording: () => void            // commence l'enregistrement (après startCamera)
    stopAndUpload:  (token: string) => Promise<void>  // arrête + uploade
    stopCamera:     () => void            // libère le stream sans uploader
}

export function useVideoRecorder(): UseVideoRecorderReturn {
    const [videoState, setVideoState] = useState<VideoState>('idle')
    const [error,      setError]      = useState('')
    const [stream,     setStream]     = useState<MediaStream | null>(null)

    const videoRef       = useRef<HTMLVideoElement>(null)
    const mediaRecorder  = useRef<MediaRecorder | null>(null)
    const chunks         = useRef<Blob[]>([])

    const isRecording = videoState === 'recording'
    const isUploading = videoState === 'uploading'
    const isDone      = videoState === 'done'

    // ── Démarrage de la caméra ────────────────────────────────────────
    const startCamera = useCallback(async (): Promise<boolean> => {
        setVideoState('requesting')
        setError('')
        try {
            const s = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
                audio: true,
            })
            setStream(s)
            if (videoRef.current) {
                videoRef.current.srcObject = s
                videoRef.current.muted = true // pas de feedback audio local
                await videoRef.current.play()
            }
            setVideoState('idle')
            return true
        } catch (err: any) {
            const msg =
                err?.name === 'NotAllowedError'  ? 'Accès caméra/micro refusé. Autorisez l\'accès dans votre navigateur.' :
                    err?.name === 'NotFoundError'    ? 'Caméra ou micro non trouvé sur cet appareil.' :
                        err?.name === 'NotReadableError' ? 'Caméra déjà utilisée par une autre application.' :
                            'Impossible d\'accéder à la caméra. Vérifiez vos périphériques.'
            setError(msg)
            setVideoState('error')
            return false
        }
    }, [])

    // ── Début de l'enregistrement ─────────────────────────────────────
    const startRecording = useCallback(() => {
        if (!stream) { setError('Caméra non initialisée.'); return }

        chunks.current = []

        // Choisir le meilleur codec disponible
        const mimeType =
            MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' :
                MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ? 'video/webm;codecs=vp8,opus' :
                    MediaRecorder.isTypeSupported('video/webm')                 ? 'video/webm' :
                        MediaRecorder.isTypeSupported('video/mp4')                  ? 'video/mp4' :
                            ''

        try {
            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
            mediaRecorder.current = recorder

            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) chunks.current.push(e.data)
            }
            recorder.onerror = () => {
                setError('Erreur d\'enregistrement vidéo.')
                setVideoState('error')
            }

            recorder.start(2000) // chunk toutes les 2 secondes
            setVideoState('recording')
        } catch (err) {
            setError('Impossible de démarrer l\'enregistrement vidéo.')
            setVideoState('error')
        }
    }, [stream])

    // ── Arrêt + upload ────────────────────────────────────────────────
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

                // Ne pas uploader si la vidéo est vide ou trop petite (< 10 Ko)
                if (blob.size < 10_000) { resolve(); return }

                setVideoState('uploading')
                try {
                    await interviewApi.uploadVideo(token, blob)
                    setVideoState('done')
                } catch (err) {
                    console.error('Upload vidéo échoué :', err)
                    // On ne bloque pas l'entretien si l'upload échoue
                    setVideoState('done')
                }
                resolve()
            }

            recorder.stop()
            // Arrêter le stream après l'enregistrement
            stream?.getTracks().forEach(t => t.stop())
        })
    }, [stream])

    // ── Arrêt sans upload ─────────────────────────────────────────────
    const stopCamera = useCallback(() => {
        if (mediaRecorder.current?.state === 'recording') {
            mediaRecorder.current.stop()
        }
        stream?.getTracks().forEach(t => t.stop())
        setStream(null)
        setVideoState('idle')
    }, [stream])

    return {
        videoState, videoRef, stream, error,
        isRecording, isUploading, isDone,
        startCamera, startRecording, stopAndUpload, stopCamera,
    }
}