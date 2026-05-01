// src/hooks/useAudioRecorder.ts
// ✅ FIX: stopAndTranscribe retourne { text, metrics } au lieu de string | null
// → compatible avec VoiceIndicator + ScenarioCard + QuestionCard

import { useState, useRef, useCallback } from 'react'
import { interviewApi } from '../api/interviewApi'

type RecorderState = 'idle' | 'recording' | 'transcribing' | 'error'

export interface AudioTranscribeResult {
    text: string | null
    metrics: any | null   // VoiceMetrics depuis le backend
}

export function useAudioRecorder(token: string) {
    const [recorderState, setRecorderState] = useState<RecorderState>('idle')
    const [error, setError] = useState('')
    const mediaRecorder = useRef<MediaRecorder | null>(null)
    const chunks = useRef<Blob[]>([])
    const streamRef = useRef<MediaStream | null>(null)

    const isRecording    = recorderState === 'recording'
    const isTranscribing = recorderState === 'transcribing'

    const start = useCallback(async () => {
        setError('')
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            streamRef.current = stream

            const mimeType =
                MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' :
                    MediaRecorder.isTypeSupported('audio/webm')              ? 'audio/webm' :
                        'audio/ogg'

            const recorder = new MediaRecorder(stream, { mimeType })
            mediaRecorder.current = recorder
            chunks.current = []

            recorder.ondataavailable = e => {
                if (e.data.size > 0) chunks.current.push(e.data)
            }

            recorder.start(250)
            setRecorderState('recording')
        } catch {
            setError('Microphone inaccessible. Vérifiez les permissions.')
            setRecorderState('error')
        }
    }, [])

    // ✅ FIX: retourne { text, metrics } pour alimenter VoiceIndicator
    const stopAndTranscribe = useCallback((): Promise<AudioTranscribeResult> => {
        return new Promise(resolve => {
            if (!mediaRecorder.current || recorderState !== 'recording') {
                resolve({ text: null, metrics: null })
                return
            }

            mediaRecorder.current.onstop = async () => {
                streamRef.current?.getTracks().forEach(t => t.stop())
                setRecorderState('transcribing')

                try {
                    const blob = new Blob(
                        chunks.current,
                        { type: mediaRecorder.current?.mimeType || 'audio/webm' }
                    )
                    const result = await interviewApi.audio(token, blob)
                    setRecorderState('idle')

                    // ✅ On retourne text + toutes les métriques vocales
                    resolve({
                        text:    result.text || null,
                        metrics: result,    // contient voice_metrics, vocal_score, wpm, etc.
                    })
                } catch {
                    setError('Transcription échouée. Tapez votre réponse manuellement.')
                    setRecorderState('error')
                    resolve({ text: null, metrics: null })
                }
            }

            mediaRecorder.current.stop()
        })
    }, [token, recorderState])

    const cancel = useCallback(() => {
        if (mediaRecorder.current?.state === 'recording') {
            mediaRecorder.current.stop()
        }
        streamRef.current?.getTracks().forEach(t => t.stop())
        chunks.current = []
        setRecorderState('idle')
        setError('')
    }, [])

    const resetError = useCallback(() => {
        setRecorderState('idle')
        setError('')
    }, [])

    return {
        recorderState,
        isRecording,
        isTranscribing,
        error,
        start,
        stopAndTranscribe,
        cancel,
        resetError,
    }
}