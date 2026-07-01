import { useState, useCallback, useRef } from 'react'
import type { FinalizeResponse, InterviewState, Phase, QCMQuestion } from '../types/interview'
import { interviewApi } from '../api/interviewApi'

type RawQ = string | Record<string, unknown> | null | undefined

function extractQ(raw: RawQ): string {
    if (!raw) return ''
    if (typeof raw === 'string') return raw
    if (typeof raw === 'object') {
        const q = (raw as Record<string, unknown>).question
        if (typeof q === 'string') return q
    }
    return ''
}

function extractTimeLimit(raw: RawQ): number | null {
    if (!raw || typeof raw === 'string') return null
    const v = (raw as Record<string, unknown>).time_limit_seconds
    return typeof v === 'number' ? v : null
}

function extractTheme(raw: RawQ): string {
    if (!raw || typeof raw === 'string') return ''
    const v = (raw as Record<string, unknown>).theme
    return typeof v === 'string' ? v : ''
}

function extractContradiction(raw: RawQ): boolean {
    if (!raw || typeof raw === 'string') return false
    return !!(raw as Record<string, unknown>).is_contradiction_followup
}

function extractAngle(raw: RawQ): string {
    if (!raw || typeof raw === 'string') return ''
    const v = (raw as Record<string, unknown>).angle
    return typeof v === 'string' ? v : ''
}

function resolveRaw(data: Record<string, unknown>): RawQ {
    return (data.first_question ?? data.next_question ?? data.question ?? null) as RawQ
}

interface AnswerResponse {
    next_step?: string
    is_phase_end?: boolean
    next_phase?: string
    phase_score?: number | null
    next_phase_info?: string
    question_index?: number
    qcm_questions?: unknown[]
    qcm_time_limit_seconds?: number
    time_limit_seconds?: number
    total_technical?: number
    current_angle?: string
    scenario_theme?: string
    is_contradiction_followup?: boolean
    first_question?: RawQ
    next_question?: RawQ
    question?: RawQ
    break_time_seconds?: number  // ← AJOUT
    [key: string]: unknown
}

// ─────────────────────────────────────────────────────────────────────────────
// STATE INITIAL
// ─────────────────────────────────────────────────────────────────────────────

const INITIAL_STATE = {
    status:                   'loading'       as InterviewState['status'],
    candidateName:            '',
    jobTitle:                 '',
    phase:                    'communication' as Phase,
    phaseInfo:                {}              as Record<string, unknown>,
    questionIndex:            0,
    currentQuestion:          '',
    timeLimitSeconds:         null            as number | null,
    questionTimeLimitSeconds: null            as number | null,
    currentAngle:             '',
    totalTechnical:           0,
    scenarioTheme:            '',
    isContradictionFollowup:  false,
    qcmQuestions:             []              as QCMQuestion[],
    qcmTimeLimit:             15 * 60,
    qcmAnswers:               {}              as Record<string, number>,
    phaseScore:               null            as number | null,
    nextPhaseInfo:            '',
    totalScenarios:           4,
    finalData:                null            as FinalizeResponse | null,
    fraudMessage:             '',
    errorMessage:             '',
    startTime:                Date.now(),
    breakTimeLeft:            0,              // ← AJOUT
}

type State = typeof INITIAL_STATE

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useInterview(token: string) {
    const [state, setState] = useState<State>(INITIAL_STATE)
    const stateRef          = useRef<State>(INITIAL_STATE)
    const submittingRef     = useRef(false)

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
                phaseInfo:        (data.phase_info ?? {}) as Record<string, unknown>,
                questionIndex:    Number(data.question_index ?? 0),
                totalScenarios:   Number(data.total_scenarios ?? 4),
                currentQuestion:  extractQ(raw),
                timeLimitSeconds: extractTimeLimit(raw),
                startTime:        Date.now(),
            }
            stateRef.current = next
            setState(next)
        } catch (err) {
            const error = err as { response?: { data?: { error?: string } } }
            const msg = error?.response?.data?.error ?? "Impossible de démarrer l'entretien."
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
            const data: AnswerResponse = await interviewApi.answer(token, {
                answer,
                question_index:        currentState.questionIndex,
                phase:                 currentState.phase,
                current_question:      currentState.currentQuestion,
                response_time_seconds: responseTime,
            }) as AnswerResponse

            if (data.next_step === 'finalize') {
                await _finalize()
                return
            }

            if (data.is_phase_end && data.next_phase) {
                const nextPhase = data.next_phase as Phase

                // CAS 1 : scenario → technical
                if (nextPhase === 'technical' && !data.qcm_questions) {
                    const raw = resolveRaw(data)
                    update({
                        status:        'transitioning',
                        phaseScore:    data.phase_score ?? null,
                        nextPhaseInfo: String(data.next_phase_info ?? ''),
                    })
                    setTimeout(() => {
                        setState(prev => {
                            const next: State = {
                                ...prev,
                                status:                  'ready',
                                phase:                   'technical',
                                questionIndex:           Number(data.question_index ?? 0),
                                currentQuestion:         extractQ(raw),
                                timeLimitSeconds:        extractTimeLimit(raw) ?? data.time_limit_seconds ?? 10 * 60,
                                currentAngle:            extractAngle(raw) || String(data.current_angle ?? ''),
                                totalTechnical:          Number(data.total_technical ?? 4),
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

                // CAS 2 : technical → qcm
                if (nextPhase === 'qcm' && data.qcm_questions) {
                    update({
                        status:        'transitioning',
                        phaseScore:    data.phase_score ?? null,
                        nextPhaseInfo: String(data.next_phase_info ?? ''),
                    })
                    setTimeout(() => {
                        setState(prev => {
                            const next: State = {
                                ...prev,
                                status:       'qcm',
                                phase:        'qcm',
                                qcmQuestions: (data.qcm_questions ?? []) as QCMQuestion[],
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

                // CAS 3 : cv_clarification → scenario (avec pause)
                if (nextPhase === 'scenario') {
                    const breakTime = Number(data.break_time_seconds ?? 0)

                    update({
                        status:        'transitioning',
                        phaseScore:    data.phase_score ?? null,
                        nextPhaseInfo: String(data.next_phase_info ?? ''),
                    })

                    setTimeout(() => {
                        if (breakTime > 0) {
                            setState(prev => {
                                const next: State = {
                                    ...prev,
                                    status:        'break',
                                    phase:         'scenario',
                                    breakTimeLeft: breakTime,
                                    startTime:     Date.now(),
                                }
                                stateRef.current = next
                                return next
                            })
                        } else {
                            const raw = resolveRaw(data)
                            setState(prev => {
                                const next: State = {
                                    ...prev,
                                    status:                  'ready',
                                    phase:                   'scenario',
                                    questionIndex:           0,
                                    currentQuestion:         extractQ(raw),
                                    timeLimitSeconds:        extractTimeLimit(raw) ?? 7 * 60,
                                    scenarioTheme:           String(data.scenario_theme ?? ''),
                                    totalScenarios:          Number(data.total_scenarios ?? 4),
                                    isContradictionFollowup: false,
                                    breakTimeLeft:           0,
                                    startTime:               Date.now(),
                                }
                                stateRef.current = next
                                return next
                            })
                        }
                    }, 3000)
                    return
                }

                // CAS 4 : communication → cv_clarification (et autres)
                const raw = resolveRaw(data)
                update({
                    status:        'transitioning',
                    phaseScore:    data.phase_score ?? null,
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
                    timeLimitSeconds:        extractTimeLimit(raw) ?? data.time_limit_seconds ?? prev.timeLimitSeconds,
                    currentAngle:            extractAngle(raw) || String(data.current_angle ?? prev.currentAngle),
                    scenarioTheme:           extractTheme(raw) || String(data.scenario_theme ?? prev.scenarioTheme),
                    isContradictionFollowup: extractContradiction(raw) || !!(data.is_contradiction_followup),
                    startTime:               Date.now(),
                }
                stateRef.current = next
                return next
            })

        } catch (err) {
            const error = err as { response?: { data?: { error?: string } } }
            const msg = error?.response?.data?.error ?? "Erreur lors de l'envoi de la réponse."
            update({ status: 'error', errorMessage: msg })
        } finally {
            submittingRef.current = false
        }
    }, [token, update])

    // ── Soumission QCM ────────────────────────────────────────────────────────
    const submitQCM = useCallback(async (answers: Record<string, number>) => {
        if (submittingRef.current) return
        submittingRef.current = true
        update({ status: 'answering', qcmAnswers: answers })
        try {
            await interviewApi.answer(token, {
                phase:                 'qcm',
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
                const next: State = { ...prev, status: 'completed', phase: 'completed', finalData }
                stateRef.current = next
                return next
            })
        } catch {
            setState(prev => {
                const next: State = { ...prev, status: 'completed', phase: 'completed', finalData: null }
                stateRef.current = next
                return next
            })
        }
    }

    // ── Sélection QCM ─────────────────────────────────────────────────────────
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

    // ── setScenarioReady — appelé après polling scenario-ready ────────────────
    const setScenarioReady = useCallback((data: Record<string, unknown>) => {
        const raw = resolveRaw(data)
        setState(prev => {
            const next: State = {
                ...prev,
                status:                  'ready',
                phase:                   'scenario',
                questionIndex:           0,
                currentQuestion:         extractQ(raw),
                timeLimitSeconds:        7 * 60,
                scenarioTheme:           String(data.scenario_theme ?? ''),
                totalScenarios:          Number(data.total_scenarios ?? 4),
                isContradictionFollowup: false,
                breakTimeLeft:           0,
                startTime:               Date.now(),
            }
            stateRef.current = next
            return next
        })
    }, [])

    return {
        state,
        start,
        submitAnswer,
        submitQCM,
        selectQCMAnswer,
        setFraudTerminated,
        setScenarioReady,
    }
}