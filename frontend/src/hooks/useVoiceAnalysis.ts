import { useState, useRef, useCallback } from 'react'
import { interviewApi } from '../api/interviewApi'

export interface VoiceMetrics {
    volumeLevel:    number   // 0-100 — niveau du micro en temps réel
    isSpeaking:     boolean  // true si le candidat parle
    silenceDuration:number   // secondes de silence consécutives
    avgVolume:      number   // volume moyen de la réponse
    wordCount:      number   // mots transcrits par Whisper
    vocalScore:     number | null  // score vocal retourné par le backend
}

const INITIAL_METRICS: VoiceMetrics = {
    volumeLevel: 0, isSpeaking: false,
    silenceDuration: 0, avgVolume: 0,
    wordCount: 0, vocalScore: null,
}

type RecState = 'idle' | 'recording' | 'transcribing' | 'error'

export function useVoiceAnalysis(token: string) {
    const [recState,    setRecState]    = useState<RecState>('idle')
    const [metrics,     setMetrics]     = useState<VoiceMetrics>(INITIAL_METRICS)
    const [transcript,  setTranscript]  = useState('')
    const [audioError,  setAudioError]  = useState('')

    const mediaRecorder  = useRef<MediaRecorder | null>(null)
    const chunks         = useRef<Blob[]>([])
    const analyserRef    = useRef<AnalyserNode | null>(null)
    const audioCtxRef    = useRef<AudioContext | null>(null)
    const animFrameRef   = useRef<number>(0)
    const silenceTimer   = useRef<number>(0)
    const volumeSamples  = useRef<number[]>([])
    const streamRef      = useRef<MediaStream | null>(null)

    const isRecording   = recState === 'recording'
    const isTranscribing = recState === 'transcribing'

    // ── Analyse du volume en temps réel ─────────────────────────────
    const startVolumeAnalysis = useCallback((stream: MediaStream) => {
        try {
            const ctx = new AudioContext()
            audioCtxRef.current = ctx
            const source   = ctx.createMediaStreamSource(stream)
            const analyser = ctx.createAnalyser()
            analyser.fftSize = 512
            analyser.smoothingTimeConstant = 0.3
            source.connect(analyser)
            analyserRef.current = analyser

            const dataArray = new Uint8Array(analyser.frequencyBinCount)

            const tick = () => {
                analyser.getByteFrequencyData(dataArray)
                const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
                const vol = Math.min(100, Math.round(avg * 2.5))

                volumeSamples.current.push(vol)
                const speaking = vol > 12

                if (!speaking) {
                    silenceTimer.current += 0.05  // ~50ms par frame
                } else {
                    silenceTimer.current = 0
                }

                const avgVol = volumeSamples.current.length > 0
                    ? Math.round(volumeSamples.current.reduce((a, b) => a + b, 0) / volumeSamples.current.length)
                    : 0

                setMetrics(prev => ({
                    ...prev,
                    volumeLevel:     vol,
                    isSpeaking:      speaking,
                    silenceDuration: silenceTimer.current,
                    avgVolume:       avgVol,
                }))

                animFrameRef.current = requestAnimationFrame(tick)
            }

            animFrameRef.current = requestAnimationFrame(tick)
        } catch {
            // Analyse optionnelle — ne bloque pas si elle échoue
        }
    }, [])

    const stopVolumeAnalysis = useCallback(() => {
        cancelAnimationFrame(animFrameRef.current)
        analyserRef.current = null
        audioCtxRef.current?.close().catch(() => {})
        audioCtxRef.current = null
        volumeSamples.current = []
        silenceTimer.current  = 0
    }, [])

    // ── Démarrer l'enregistrement audio ─────────────────────────────
    // Utilise le stream vidéo existant si disponible (même micro)
    const startRecording = useCallback(async (existingStream?: MediaStream | null) => {
        setAudioError('')
        setTranscript('')
        chunks.current = []

        try {
            let stream: MediaStream

            if (existingStream) {
                // Réutilise le micro du stream vidéo
                const audioTracks = existingStream.getAudioTracks()
                if (audioTracks.length === 0) throw new Error('no_audio')
                stream = new MediaStream(audioTracks)
            } else {
                // Micro seul si pas de stream vidéo
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 }
                })
            }

            streamRef.current = stream
            startVolumeAnalysis(stream)

            const mimeType =
                MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' :
                    MediaRecorder.isTypeSupported('audio/webm')              ? 'audio/webm' :
                        'audio/ogg'

            const recorder = new MediaRecorder(stream, { mimeType })
            mediaRecorder.current = recorder

            recorder.ondataavailable = e => {
                if (e.data?.size > 0) chunks.current.push(e.data)
            }

            recorder.start(250)
            setRecState('recording')
        } catch (err: any) {
            const msg = err?.message === 'no_audio'
                ? 'Aucun micro détecté dans le stream vidéo.'
                : 'Impossible d\'accéder au microphone.'
            setAudioError(msg)
            setRecState('error')
        }
    }, [startVolumeAnalysis])

    // ── Arrêter + transcrire ─────────────────────────────────────────
    // Retourne { text, vocalScore } ou null si erreur
    const stopAndTranscribe = useCallback((): Promise<{ text: string; vocalScore: number | null } | null> => {
        return new Promise(resolve => {
            const recorder = mediaRecorder.current
            if (!recorder || recState !== 'recording') { resolve(null); return }

            stopVolumeAnalysis()

            recorder.onstop = async () => {
                if (chunks.current.length === 0) { setRecState('idle'); resolve(null); return }

                setRecState('transcribing')

                const blob = new Blob(chunks.current, { type: recorder.mimeType || 'audio/webm' })
                chunks.current = []

                // Audio trop court (< 1s) → on ne transcrit pas
                if (blob.size < 2000) {
                    setRecState('idle')
                    resolve(null)
                    return
                }

                try {
                    const result = await interviewApi.audio(token, blob)
                    const text = result.text || ''
                    const vocalScore = result.vocal_score ?? null

                    setTranscript(text)
                    setMetrics(prev => ({
                        ...prev,
                        wordCount:  result.word_count  || 0,
                        vocalScore,
                    }))
                    setRecState('idle')
                    resolve({ text, vocalScore })
                } catch {
                    setAudioError('Transcription échouée — répondez par écrit.')
                    setRecState('error')
                    resolve(null)
                }
            }

            recorder.stop()
        })
    }, [token, recState, stopVolumeAnalysis])

    // ── Annuler ──────────────────────────────────────────────────────
    const cancel = useCallback(() => {
        if (mediaRecorder.current?.state !== 'inactive') {
            mediaRecorder.current?.stop()
        }
        stopVolumeAnalysis()
        chunks.current = []
        setRecState('idle')
        setAudioError('')
    }, [stopVolumeAnalysis])

    const resetError = () => { setRecState('idle'); setAudioError('') }

    return {
        recState, isRecording, isTranscribing,
        metrics, transcript, audioError,
        startRecording, stopAndTranscribe, cancel, resetError,
    }
}