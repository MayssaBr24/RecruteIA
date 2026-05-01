// src/hooks/useInterview.ts
//
// CORRECTIONS FINALES :
// ✅ extractQ / extractTimeLimit / extractTheme / extractContradiction conservés (robustes)
// ✅ Transition scenario → technical (oral) : next_phase==='technical' SANS qcm_questions
// ✅ Transition technical → qcm            : next_phase==='qcm' AVEC qcm_questions
// ✅ submitQCM envoie phase: 'qcm' (et non 'technical')
// ✅ Questions techniques orales : currentAngle + totalTechnical mis à jour
// ✅ Flux complet : communication → cv_clarification → scenario → technical → qcm → completed

import { useState, useCallback, useRef } from 'react'
import type { InterviewState, Phase } from '../types/interview'
import { interviewApi } from '../api/interviewApi'

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACTEURS — robustes aux deux formats (string brute OU objet enrichi)
// ─────────────────────────────────────────────────────────────────────────────

type RawQ = string | Record<string, unknown> | null | undefined

/** Extrait toujours une string depuis un payload question. Jamais d'objet. */
function extractQ(raw: RawQ): string {
    if (!raw) return ''
    if (typeof raw === 'string') return raw
    if (typeof raw === 'object') {
        const q = (raw as Record<string, unknown>).question
        if (typeof q === 'string') return q
    }
    return ''
}

/** Extrait le time_limit_seconds (null si absent ou string brute). */
function extractTimeLimit(raw: RawQ): number | null {
    if (!raw || typeof raw === 'string') return null
    const v = (raw as Record<string, unknown>).time_limit_seconds
    return typeof v === 'number' ? v : null
}

/** Extrait le thème scénario. */
function extractTheme(raw: RawQ): string {
    if (!raw || typeof raw === 'string') return ''
    const v = (raw as Record<string, unknown>).theme
    return typeof v === 'string' ? v : ''
}

/** Extrait is_contradiction_followup. */
function extractContradiction(raw: RawQ): boolean {
    if (!raw || typeof raw === 'string') return false
    return !!(raw as Record<string, unknown>).is_contradiction_followup
}

/** Extrait l'angle de la question technique orale. */
function extractAngle(raw: RawQ): string {
    if (!raw || typeof raw === 'string') return ''
    const v = (raw as Record<string, unknown>).angle
    return typeof v === 'string' ? v : ''
}

/**
 * Résout le champ "question" dans une réponse API complète.
 * Cherche dans cet ordre : first_question → next_question → question
 * Chacun peut être une string OU un objet enrichi.
 */
function resolveRaw(data: Record<string, unknown>): RawQ {
    return (data.first_question ?? data.next_question ?? data.question ?? null) as RawQ
}

// ─────────────────────────────────────────────────────────────────────────────
// STATE INITIAL
// ─────────────────────────────────────────────────────────────────────────────

const INITIAL_STATE = {
    status:                  'loading'       as InterviewState['status'],
    candidateName:           '',
    jobTitle:                '',
    phase:                   'communication' as Phase,
    phaseInfo:               {}              as any,
    questionIndex:           0,
    currentQuestion:         '',
    timeLimitSeconds:        null            as number | null,
    currentAngle:            '',             // angle question technique orale
    totalTechnical:          0,              // nb questions techniques orales
    scenarioTheme:           '',
    isContradictionFollowup: false,
    qcmQuestions:            []              as any[],
    qcmTimeLimit:            15 * 60,
    qcmAnswers:              {}              as Record<string, number>,
    phaseScore:              null            as number | null,
    nextPhaseInfo:           '',
    totalScenarios:          4,
    finalData:               null            as any,
    fraudMessage:            '',
    errorMessage:            '',
    startTime:               Date.now(),
}

type State = typeof INITIAL_STATE

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useInterview(token: string) {
    const [state, setState] = useState<State>(INITIAL_STATE)

    const stateRef      = useRef<State>(INITIAL_STATE)
    const submittingRef = useRef(false)

    const update = useCallback((patch: Partial<State>) => {
        setState(prev => {
            const next = { ...prev, ...patch }
            stateRef.current = next
            return next
        })
    }, [])

    // ── Démarrage ─────────────────────────────────────────────────────────────
    const start = useCallback(async () => {
        try {
            const data = await interviewApi.start(token)
            const raw  = resolveRaw(data)

            const next: State = {
                ...INITIAL_STATE,
                status:           'ready',
                candidateName:    String(data.candidate_name ?? ''),
                jobTitle:         String(data.job_title       ?? ''),
                phase:            (data.current_phase ?? 'communication') as Phase,
                phaseInfo:        (data.phase_info ?? {}) as any,
                questionIndex:    Number(data.question_index ?? 0),
                totalScenarios:   Number(data.total_scenarios ?? 4),
                currentQuestion:  extractQ(raw),
                timeLimitSeconds: extractTimeLimit(raw),
                startTime:        Date.now(),
            }
            stateRef.current = next
            setState(next)
        } catch (err: any) {
            const msg = err?.response?.data?.error ?? "Impossible de démarrer l'entretien."
            update({ status: 'error', errorMessage: msg })
        }
    }, [token, update])

    // ── Soumission d'une réponse ──────────────────────────────────────────────
    const submitAnswer = useCallback(async (answer: string) => {
        const currentState = stateRef.current

        if (submittingRef.current) return
        if (currentState.status === 'answering') return

        submittingRef.current = true
        update({ status: 'answering' })

        const responseTime = Math.round((Date.now() - currentState.startTime) / 1000)

        try {
            const data: Record<string, unknown> = await interviewApi.answer(token, {
                answer,
                question_index:        currentState.questionIndex,
                phase:                 currentState.phase,
                current_question:      currentState.currentQuestion,
                response_time_seconds: responseTime,
            })

            // ── Fin → finaliser ───────────────────────────────────────────────
            if (data.next_step === 'finalize') {
                await _finalize()
                return
            }

            // ── Transition de phase ───────────────────────────────────────────
            if (data.is_phase_end && data.next_phase) {
                const nextPhase = data.next_phase as Phase

                // ════════════════════════════════════════════════════════════
                // CAS 1 : scenario → technical (questions orales)
                // Le backend envoie next_question (string/objet) SANS qcm_questions
                // ════════════════════════════════════════════════════════════
                if (nextPhase === 'technical' && !data.qcm_questions) {
                    const raw = resolveRaw(data)
                    update({
                        status:        'transitioning',
                        phaseScore:    (data.phase_score as number) ?? null,
                        nextPhaseInfo: String(data.next_phase_info ?? ''),
                    })
                    setTimeout(() => {
                        setState(prev => {
                            const next: State = {
                                ...prev,
                                status:          'ready',
                                phase:           'technical',
                                questionIndex:   Number(data.question_index ?? 0),
                                currentQuestion: extractQ(raw),
                                timeLimitSeconds: extractTimeLimit(raw)
                                    ?? (data.time_limit_seconds as number)
                                    ?? 10 * 60,
                                currentAngle:    extractAngle(raw)
                                    || String(data.current_angle ?? ''),
                                totalTechnical:  Number(data.total_technical ?? 4),
                                scenarioTheme:   '',
                                isContradictionFollowup: false,
                                startTime:       Date.now(),
                            }
                            stateRef.current = next
                            return next
                        })
                    }, 3000)
                    return
                }

                // ════════════════════════════════════════════════════════════
                // CAS 2 : technical (oral) → qcm
                // Le backend envoie qcm_questions + next_phase === 'qcm'
                // ════════════════════════════════════════════════════════════
                if (nextPhase === 'qcm' && data.qcm_questions) {
                    update({
                        status:        'transitioning',
                        phaseScore:    (data.phase_score as number) ?? null,
                        nextPhaseInfo: String(data.next_phase_info ?? ''),
                    })
                    setTimeout(() => {
                        setState(prev => {
                            const next: State = {
                                ...prev,
                                status:       'qcm',
                                phase:        'qcm',
                                qcmQuestions: data.qcm_questions as any[],
                                qcmTimeLimit: Number(data.qcm_time_limit_seconds ?? 15 * 60),
                                qcmAnswers:   {},
                                startTime:    Date.now(),
                            }
                            stateRef.current = next
                            return next
                        })
                    }, 3000)
                    return
                }

                // ════════════════════════════════════════════════════════════
                // CAS 3 : cv_clarification → scenario
                // Le backend envoie le 1er scénario directement
                // ════════════════════════════════════════════════════════════
                if (nextPhase === 'scenario') {
                    const raw = resolveRaw(data)
                    update({
                        status:        'transitioning',
                        phaseScore:    (data.phase_score as number) ?? null,
                        nextPhaseInfo: String(data.next_phase_info ?? ''),
                    })
                    setTimeout(() => {
                        setState(prev => {
                            const next: State = {
                                ...prev,
                                status:                  'ready',
                                phase:                   'scenario',
                                questionIndex:           0,
                                currentQuestion:         extractQ(raw),
                                timeLimitSeconds:        extractTimeLimit(raw) ?? 10 * 60,
                                scenarioTheme:           extractTheme(raw)
                                    || String(data.scenario_theme ?? ''),
                                totalScenarios:          Number(data.total_scenarios ?? 4),
                                isContradictionFollowup: false,
                                startTime:               Date.now(),
                            }
                            stateRef.current = next
                            return next
                        })
                    }, 3000)
                    return
                }

                // ════════════════════════════════════════════════════════════
                // CAS 4 : communication → cv_clarification (et autres génériques)
                // ════════════════════════════════════════════════════════════
                const raw = resolveRaw(data)
                update({
                    status:        'transitioning',
                    phaseScore:    (data.phase_score as number) ?? null,
                    nextPhaseInfo: String(data.next_phase_info ?? ''),
                })
                setTimeout(() => {
                    setState(prev => {
                        const next: State = {
                            ...prev,
                            status:                  'ready',
                            phase:                   nextPhase,
                            questionIndex:           Number(data.question_index ?? 0),
                            currentQuestion:         extractQ(raw),
                            timeLimitSeconds:        extractTimeLimit(raw) ?? 5 * 60,
                            currentAngle:            '',
                            scenarioTheme:           '',
                            isContradictionFollowup: false,
                            startTime:               Date.now(),
                        }
                        stateRef.current = next
                        return next
                    })
                }, 3000)
                return
            }

            // ── Question suivante dans la même phase ──────────────────────────
            const raw = resolveRaw(data)
            setState(prev => {
                const next: State = {
                    ...prev,
                    status:                  'ready',
                    questionIndex:           Number(data.question_index ?? prev.questionIndex + 1),
                    currentQuestion:         extractQ(raw) || prev.currentQuestion,
                    timeLimitSeconds:        extractTimeLimit(raw)
                        ?? (data.time_limit_seconds as number | null)
                        ?? prev.timeLimitSeconds,
                    // ✅ Mise à jour angle pour les questions techniques orales
                    currentAngle:            extractAngle(raw)
                        || String(data.current_angle ?? prev.currentAngle),
                    scenarioTheme:           extractTheme(raw)
                        || String(data.scenario_theme ?? prev.scenarioTheme),
                    isContradictionFollowup: extractContradiction(raw)
                        || !!(data.is_contradiction_followup),
                    startTime:               Date.now(),
                }
                stateRef.current = next
                return next
            })

        } catch (err: any) {
            const msg = err?.response?.data?.error ?? "Erreur lors de l'envoi de la réponse."
            update({ status: 'error', errorMessage: msg })
        } finally {
            submittingRef.current = false
        }
    }, [token, update])

    // ── Soumission QCM ────────────────────────────────────────────────────────
    // ✅ FIX CRITIQUE : phase doit être 'qcm' (pas 'technical')
    const submitQCM = useCallback(async (answers: Record<string, number>) => {
        if (submittingRef.current) return
        submittingRef.current = true
        update({ status: 'answering', qcmAnswers: answers })

        try {
            await interviewApi.answer(token, {
                phase:                 'qcm',       // ← 'qcm' et non 'technical'
                qcm_answers:           answers,
                answer:                '',
                question_index:        0,
                current_question:      'QCM',
                response_time_seconds: 0,
            })
            await _finalize()
        } catch {
            update({ status: 'error', errorMessage: 'Erreur lors de la soumission du QCM.' })
        } finally {
            submittingRef.current = false
        }
    }, [token, update])

    // ── Finalisation ──────────────────────────────────────────────────────────
    const _finalize = async () => {
        try {
            const finalData = await interviewApi.finalize(token)
            setState(prev => {
                const next: State = {
                    ...prev,
                    status:    'completed',
                    phase:     'completed',
                    finalData,
                }
                stateRef.current = next
                return next
            })
        } catch {
            setState(prev => {
                const next: State = {
                    ...prev,
                    status:    'completed',
                    phase:     'completed',
                    finalData: null,
                }
                stateRef.current = next
                return next
            })
        }
    }

    // ── Sélection réponse QCM ─────────────────────────────────────────────────
    const selectQCMAnswer = useCallback((questionIdx: number, optionIdx: number) => {
        setState(prev => {
            const next: State = {
                ...prev,
                qcmAnswers: { ...prev.qcmAnswers, [String(questionIdx)]: optionIdx },
            }
            stateRef.current = next
            return next
        })
    }, [])

    // ── Fraude ────────────────────────────────────────────────────────────────
    const setFraudTerminated = useCallback((message: string) => {
        update({ status: 'fraud', fraudMessage: message })
    }, [update])

    return {
        state,
        start,
        submitAnswer,
        submitQCM,
        selectQCMAnswer,
        setFraudTerminated,
    }
}