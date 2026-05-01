import { useCallback } from 'react'
import api from '../lib/api'
import { useInterviewRecorder } from './useInterviewRecorder'

const RESPONSE_TIME_LIMIT = 120

export function useInterviewLogic(token: string | undefined, state: any) {
    const recorder = useInterviewRecorder()

    // ── Cleanup ──────────────────────────────────────────────────────
    const cleanup = useCallback(() => {
        if (state.timerRef.current)       clearInterval(state.timerRef.current)
        if (state.globalTimerRef.current) clearInterval(state.globalTimerRef.current)
        stopCamera()
    }, [])

    // ── Caméra ───────────────────────────────────────────────────────
    const startCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false,
            })
            state.streamRef.current = stream
            if (state.videoRef.current) {
                state.videoRef.current.srcObject = stream
            }
            state.setCameraActive(true)
            state.setCameraError('')
        } catch {
            state.setCameraError("Impossible d'accéder à la caméra.")
        }
    }, [state])

    const stopCamera = useCallback(() => {
        if (state.streamRef.current) {
            state.streamRef.current.getTracks().forEach((t: MediaStreamTrack) => t.stop())
            state.streamRef.current = null
        }
        state.setCameraActive(false)
    }, [state])

    // ── Démarrage entretien ──────────────────────────────────────────
    const startInterview = useCallback(async () => {
        try {
            const response = await api.get(`/recruitment/interview/${token}/start/`)
            state.setInterviewData(response.data)
            state.setCurrentQuestion(response.data.first_question)
            state.setQuestionIndex(response.data.question_index)
            state.setPhase('setup')
        } catch (err: any) {
            state.setError(err.response?.data?.error || 'Lien invalide ou expiré')
            state.setPhase('error')
        }
    }, [token, state])


    // ── Timers ───────────────────────────────────────────────────────
    const startGlobalTimer = useCallback(() => {
        state.globalTimerRef.current = setInterval(() => {
            state.setGlobalTime((prev: number) => prev + 1)
        }, 1000)
    }, [state])

    const startQuestionTimer = useCallback(() => {
        if (state.timerRef.current) clearInterval(state.timerRef.current)
        state.setTimeLeft(RESPONSE_TIME_LIMIT)
        state.responseStartTime.current = Date.now()

        state.timerRef.current = setInterval(() => {
            state.setTimeLeft((prev: number) => {
                if (prev <= 1) {
                    clearInterval(state.timerRef.current!)
                    handleSubmitAnswer('[Temps écoulé — pas de réponse]')
                    return 0
                }
                return prev - 1
            })
        }, 1000)
    }, [state])

    // ── Anti-fraude ──────────────────────────────────────────────────
    const setupAntiCheat = useCallback(() => {
        const handleVisibility = () => {
            if (document.hidden) triggerWarning('tab_switch', "Changement d'onglet détecté !")
        }
        const handlePaste = (e: ClipboardEvent) => {
            e.preventDefault()
            triggerWarning('copy_paste', 'Copier-coller non autorisé !')
        }
        const handleFullscreen = () => {
            if (!document.fullscreenElement) {
                triggerWarning('fullscreen_exit', 'Restez en plein écran !')
                document.documentElement.requestFullscreen().catch(() => {})
            }
        }
        document.addEventListener('visibilitychange', handleVisibility)
        document.addEventListener('paste', handlePaste)
        document.addEventListener('fullscreenchange', handleFullscreen)
    }, [])

    const triggerWarning = useCallback(async (type: string, message: string) => {
        try {
            const response = await api.post(`/recruitment/interview/${token}/warning/`, {
                warning_type: type, details: message,
            })
            const newCount = response.data.warning_count
            state.setWarningCount(newCount)
            state.setWarningMessage(message)
            state.setShowWarning(true)
            setTimeout(() => state.setShowWarning(false), 4000)

            if (response.data.terminated) {
                cleanup()
                state.setPhase('fraud')
            }
        } catch {
            console.error('Erreur warning')
        }
    }, [token, state, cleanup])

    // ── Begin (bouton Démarrer) ──────────────────────────────────────
    const handleBeginInterview = useCallback(async () => {
        if (!state.cameraActive) await startCamera()

        // Démarrer l'enregistrement vidéo
        await recorder.startRecording()

        try {
            await document.documentElement.requestFullscreen()
        } catch {
            console.warn('Plein écran non disponible')
        }

        state.setPhase('communication')
        startGlobalTimer()
        startQuestionTimer()
        setupAntiCheat()
    }, [state, startCamera, recorder, startGlobalTimer, startQuestionTimer, setupAntiCheat])




    // ── Soumission réponse ───────────────────────────────────────────
    // ── Soumission réponse ───────────────────────────────────────────
    const handleSubmitAnswer = useCallback(async (forcedAnswer?: string) => {
        let finalAnswer = forcedAnswer

        // 1. Récupération du texte
        if (!finalAnswer) {
            if (state.answerMode === 'voice' && state.voiceResult?.text) {
                finalAnswer = state.voiceResult.text
            } else {
                finalAnswer = state.textAnswer.trim()
            }
        }

        if (!finalAnswer || state.submitting) return

        const responseTime = Math.round(
            (Date.now() - state.responseStartTime.current) / 1000
        )

        if (state.timerRef.current) clearInterval(state.timerRef.current)
        state.setSubmitting(true)

        try {
            // --- 1. ENVOI DE L'AUDIO (Si mode voix) ---
            if (state.answerMode === 'voice' && state.voiceResult?.blob) {
                const audioData = new FormData();
                // On s'assure que c'est bien un Blob/File
                audioData.append('audio', state.voiceResult.blob, 'response.webm');

                // Utilise l'URL relative sans répéter /api si ton instance le gère déjà
                await api.post(`/recruitment/interview/${token}/audio/`, audioData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }

            // --- 2. PRÉPARATION DU PAYLOAD (Sans objets cycliques) ---
            // On n'envoie que des types primitifs (string, number)
            const payload = {
                answer:                  String(finalAnswer),
                question_index:          Number(state.questionIndex),
                phase:                   String(state.currentPhase),
                current_question:        typeof state.currentQuestion === 'string'
                    ? state.currentQuestion
                    : state.currentQuestion?.text || "Question",
                response_time_seconds:   Number(responseTime),
            };

            if (state.answerMode === 'voice' && state.voiceResult) {
                // On s'assure de ne pas envoyer l'objet blob ici pour éviter l'erreur cyclique
                payload.vocal_score   = state.voiceResult.vocal_score;
                payload.voice_metrics = state.voiceResult.voice_metrics;

                state.setVoiceScores((prev: number[]) => [
                    ...prev, state.voiceResult!.vocal_score
                ]);
            }

            // --- 3. ENVOI DE LA RÉPONSE ---
            const response = await api.post(`/recruitment/interview/${token}/answer/`, payload);


            state.resetAnswer()
            const data = response.data

            if (data.is_phase_end) {
                await handlePhaseTransition(data)
            } else {
                state.setCurrentQuestion(data.next_question)
                state.setQuestionIndex(data.question_index)
                startQuestionTimer()
            }
        } catch (err) {
            console.error("Erreur lors de la soumission:", err)
            state.setError("Erreur lors de l'envoi de la réponse")
        } finally {
            state.setSubmitting(false)
        }
    }, [token, state, startQuestionTimer])

    // ── Transitions de phase ─────────────────────────────────────────
    const handlePhaseTransition = useCallback(async (data: Record<string, unknown>) => {
        const nextPhase = data.next_phase as string

        if (nextPhase === 'cv_clarification') {
            state.setCurrentPhase('cv_clarification')
            state.setPhase('cv_clarification')
            state.setCurrentQuestion(data.next_question as string)
            state.setQuestionIndex(0)
            startQuestionTimer()
            return
        }

        if (nextPhase === 'technical') {
            state.setCurrentPhase('technical')
            state.setQcmQuestions(data.qcm_questions)
            state.setQuestionIndex(0)
            if (state.timerRef.current) clearInterval(state.timerRef.current)
            state.setPhase('technical_qcm')
            loadCodingExercise()
        }
    }, [state, startQuestionTimer])

    // ── Exercice de code ─────────────────────────────────────────────
    const loadCodingExercise = useCallback(async () => {
        try {
            const response = await api.get(`/recruitment/interview/${token}/coding-exercise/`)
            state.setCodingExercise(response.data)
        } catch {
            console.error('Exercice de code non disponible')
        }
    }, [token, state])

    // ── Soumission QCM ───────────────────────────────────────────────
    const handleSubmitQCM = useCallback(async () => {
        if (Object.keys(state.qcmAnswers).length < state.qcmQuestions.length) {
            state.setError('Répondez à toutes les questions.')
            return
        }

        state.setSubmitting(true)
        try {
            const response = await api.post(`/recruitment/interview/${token}/answer/`, {
                answer:        'QCM soumis',
                question_index: 0,
                phase:         'technical',
                qcm_answers:   state.qcmAnswers,
            })
            state.setQcmScore(response.data.qcm_score)

            if (state.codingExercise) {
                state.setPhase('technical_code')
            } else {
                await finalizeInterview()
            }
        } catch {
            state.setError('Erreur soumission QCM')
        } finally {
            state.setSubmitting(false)
        }
    }, [token, state])

    // ── Soumission code ──────────────────────────────────────────────
    const handleCodeSubmit = useCallback(async (score: number) => {
        state.setCodingScore(score)
        setTimeout(() => finalizeInterview(), 2000)
    }, [state])

    // ── Finalisation ─────────────────────────────────────────────────
    const finalizeInterview = useCallback(async () => {
        try {
            const avgVocalScore = state.voiceScores.length > 0
                ? Math.round(
                    state.voiceScores.reduce((a: number, b: number) => a + b, 0) /
                    state.voiceScores.length
                )
                : null

            const response = await api.post(`/recruitment/interview/${token}/finalize/`, {
                avg_vocal_score: avgVocalScore,
            })

            state.setFinalScore(response.data.final_score)
            state.setFinalBreakdown(response.data.breakdown)
            state.setFinalFeedback(response.data.feedback)

            cleanup()
            state.setPhase('completed')

            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {})
            }

            // ✅ Upload vidéo automatiquement après finalize
            if (token) {
                await recorder.stopAndUpload(token)
            }
        } catch {
            state.setError('Erreur lors de la finalisation')
        }
    }, [token, state, cleanup, recorder])

    return {
        recorder,
        cleanup,
        startCamera,
        stopCamera,
        startInterview,
        startQuestionTimer,
        handleBeginInterview,
        handleSubmitAnswer,
        handleSubmitQCM,
        handleCodeSubmit,
        finalizeInterview,
        triggerWarning,
    }
}