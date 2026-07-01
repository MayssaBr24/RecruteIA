
import { useRef, useState, useCallback } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE_URL + '/api'

export interface UseInterviewRecorderReturn {
    isRecording:    boolean
    isUploading:    boolean
    uploadDone:     boolean
    uploadError:    string | null
    startRecording: () => Promise<boolean>
    stopAndUpload:  (token: string) => Promise<void>
}

export function useInterviewRecorder(): UseInterviewRecorderReturn {
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef        = useRef<Blob[]>([])
    const streamRef        = useRef<MediaStream | null>(null)

    const [isRecording, setIsRecording] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadDone,  setUploadDone]  = useState(false)
    const [uploadError, setUploadError] = useState<string | null>(null)

    const startRecording = useCallback(async (): Promise<boolean> => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1280, height: 720, facingMode: 'user' },
                audio: true,
            })
            streamRef.current = stream

            const mimeType =
                MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
                    ? 'video/webm;codecs=vp9,opus'
                    : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
                        ? 'video/webm;codecs=vp8,opus'
                        : 'video/webm'

            const recorder = new MediaRecorder(stream, {
                mimeType,
                videoBitsPerSecond: 1_000_000,
            })

            chunksRef.current = []
            recorder.ondataavailable = (e: BlobEvent) => {
                if (e.data.size > 0) chunksRef.current.push(e.data)
            }

            recorder.start(1000)
            mediaRecorderRef.current = recorder
            setIsRecording(true)
            setUploadDone(false)
            setUploadError(null)
            return true
        } catch (err) {
            console.warn('[Recorder] Permission refusée :', err)
            setIsRecording(false)
            return false
        }
    }, [])

    const stopAndUpload = useCallback(async (token: string): Promise<void> => {
        const recorder = mediaRecorderRef.current
        if (!recorder) return

        setIsUploading(true)

        await new Promise<void>(resolve => {
            recorder.onstop = () => resolve()
            recorder.stop()
        })

        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = null
        setIsRecording(false)

        const mimeType    = recorder.mimeType || 'video/webm'
        const blob        = new Blob(chunksRef.current, { type: mimeType })
        chunksRef.current = []

        try {
            const formData  = new FormData()
            const extension = mimeType.includes('mp4') ? 'mp4' : 'webm'
            formData.append('video', blob, `entretien_${token}.${extension}`)

            const response = await fetch(
                `${API_BASE}/ai-interview/${token}/video/`,
                { method: 'POST', body: formData }
            )

            if (!response.ok) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data.error || `Erreur HTTP ${response.status}`)
            }

            setUploadDone(true)
            setUploadError(null)
        } catch (err: any) {
            console.error('[Recorder] Upload échoué :', err)
            setUploadError(err.message || 'Erreur upload vidéo')
        } finally {
            setIsUploading(false)
        }
    }, [])

    return { isRecording, isUploading, uploadDone, uploadError, startRecording, stopAndUpload }
}