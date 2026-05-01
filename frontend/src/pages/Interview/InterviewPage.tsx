// src/pages/InterviewPage.tsx  v3
//
// Corrections v3 :
// ✅ Phase "technical" → TechnicalQuestionCard (composant dédié, pas QCM)
// ✅ Phase "qcm"       → QCMView uniquement (state.phase === 'qcm')
// ✅ Timer TOUJOURS affiché pour phases orales — valeur DEFAULT_TIME si backend manquant
// ✅ effectiveTimeLimitSeconds = state.questionTimeLimitSeconds || DEFAULT_TIME[phase]
// ✅ timerPaused uniquement pendant 'answering'
// ✅ state.currentAngle passé à TechnicalQuestionCard

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useInterview } from '../../hooks/useInterview'
import { useVideoRecorder } from '../../hooks/useVideoRecorder'
import { useAntiFraud } from '../../hooks/useAntiFraud'
import { useFaceDetection } from '../../hooks/useFaceDetection'
import { ErrorScreen, FraudScreen, LoadingScreen } from '../../components/interview/StatusScreens'
import { WelcomePage } from './WelcomePage'
import { PhaseBar } from '../../components/interview/PhaseBar'
import { PhaseTransition } from '../../components/interview/PhaseTransition'
import { QuestionCard } from '../../components/interview/QuestionCard'
import { ScenarioCard } from '../../components/interview/ScenarioCard'
import { TechnicalQuestionCard } from '../../components/interview/TechnicalQuestionCard'
import { QCMView } from '../../components/interview/QCMView'
import { CompletionScreen } from '../../components/interview/CompletionScreen'
import VoiceIndicator from '../../components/interview/VoiceIndicator'

// ── Durées par défaut (secondes) — fallback si le backend ne les retourne pas ──
const DEFAULT_TIME: Record<string, number> = {
    communication:    5 * 60,
    cv_clarification: 5 * 60,
    scenario:         10 * 60,
    technical:        10 * 60,
}

// Nombre de questions estimé par phase (affichage uniquement)
const PHASE_TOTALS: Record<string, number> = {
    communication:    5,
    cv_clarification: 3,
    scenario:         4,
    technical:        4,
}

const ACTIVE_STATUSES = ['ready', 'answering', 'qcm']
const ORAL_PHASES     = ['communication', 'cv_clarification', 'scenario', 'technical']

// ── Types analyse vocale ──────────────────────────────────────────────────────
export interface VoiceMetrics {
    confidence_score: number
    confidence_label: string
    fluency_score:    number
    fluency_label:    string
    wpm:              number
    wpm_label:        string
    vocal_score:      number
    stress_level:     'low' | 'medium' | 'high'
}

export default function AIInterviewPage() {
    const { token } = useParams<{ token: string }>()

    const interview = useInterview(token!)
    const { state, start, submitAnswer, submitQCM, selectQCMAnswer, setFraudTerminated } = interview

    const video = useVideoRecorder()

    const [appStep, setAppStep]                   = useState<'welcome' | 'interview'>('welcome')
    const [isFullscreen, setIsFullscreen]         = useState(false)
    const [fullscreenWarned, setFullscreenWarned] = useState(false)
    const [voiceMetrics, setVoiceMetrics]         = useState<VoiceMetrics | null>(null)

    useEffect(() => { start() }, [])

    useEffect(() => {
        const handler = () => {
            const inFs = !!document.fullscreenElement
            setIsFullscreen(inFs)
            if (!inFs && appStep === 'interview' && ACTIVE_STATUSES.includes(state.status)) {
                if (!fullscreenWarned) {
                    setFullscreenWarned(true)
                    import('../../api/interviewApi').then(({ interviewApi }) => {
                        interviewApi.warning(token!, 'screen_share_stopped', "Sortie du plein écran pendant l'entretien")
                    })
                }
            }
        }
        document.addEventListener('fullscreenchange', handler)
        return () => document.removeEventListener('fullscreenchange', handler)
    }, [appStep, state.status, fullscreenWarned, token])

    useAntiFraud({
        token:       token!,
        active:      appStep === 'interview' && ACTIVE_STATUSES.includes(state.status),
        onTerminated: async (msg) => { await video.stopAndUpload(token!); setFraudTerminated(msg) },
    })

    useFaceDetection({
        token:           token!,
        videoRef:        video.videoRef,
        active:          appStep === 'interview' && ACTIVE_STATUSES.includes(state.status),
        onTerminated:    async (msg) => { await video.stopAndUpload(token!); setFraudTerminated(msg) },
        checkIntervalMs: 8000,
    })

    useEffect(() => {
        if (state.status === 'completed' && video.isRecording) video.stopAndUpload(token!)
    }, [state.status])

    const handleBeginInterview = useCallback(async () => {
        try { await document.documentElement.requestFullscreen(); setIsFullscreen(true) }
        catch { setFullscreenWarned(true) }
        video.startRecording()
        setAppStep('interview')
    }, [video])

    const handleVoiceResult = useCallback((result: any) => {
        if (!result?.voice_metrics) return
        const m = result.voice_metrics
        const stressScore = 100 - ((m.confidence_score + m.fluency_score) / 2)
        const stressLevel: 'low' | 'medium' | 'high' =
            stressScore < 35 ? 'low' : stressScore < 65 ? 'medium' : 'high'
        setVoiceMetrics({ ...m, vocal_score: result.vocal_score, stress_level: stressLevel })
    }, [])

    // ── Calculs timer ─────────────────────────────────────────────────────────
    const showPhaseBar = appStep === 'interview' &&
        [...ACTIVE_STATUSES, 'transitioning'].includes(state.status)

    const isOralPhase = ORAL_PHASES.includes(state.phase) &&
        (state.status === 'ready' || state.status === 'answering')

    // Durée effective — JAMAIS undefined pour les phases orales
    const effectiveTimeLimitSeconds: number =
        (state.questionTimeLimitSeconds && state.questionTimeLimitSeconds > 0)
            ? state.questionTimeLimitSeconds
            : (DEFAULT_TIME[state.phase] ?? 5 * 60)

    const timerResetKey = `${state.phase}-${state.questionIndex}`
    const timerPaused   = state.status === 'answering'

    const prevPhase =
        state.phase === 'cv_clarification' ? 'communication' :
            state.phase === 'scenario'         ? 'cv_clarification' :
                state.phase === 'technical'        ? 'scenario' :
                    state.phase === 'qcm'             ? 'technical' :
                        state.phase

    // ══════════════════════════════════════════════════════════════════════════
    return (
        <div
            className="min-h-screen flex flex-col relative overflow-hidden"
            style={{ background: '#08080c', color: '#fff', fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }}
        >
            {/* Fond ambiant */}
            <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
                <div className="absolute opacity-[0.04]" style={{ top: '-10%', left: '20%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle,#fbbf24,transparent 70%)', filter: 'blur(70px)' }} />
                <div className="absolute opacity-[0.03]" style={{ bottom: '10%', right: '15%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle,#818cf8,transparent 70%)', filter: 'blur(90px)' }} />
            </div>

            {/* WELCOME */}
            {appStep === 'welcome' && state.status !== 'error' && (
                <>
                    {state.status === 'loading' ? (
                        <main className="relative z-10 flex-1 flex items-center justify-center"><LoadingScreen /></main>
                    ) : (
                        <WelcomePage
                            interviewData={{ interview_id: 0, candidate_name: state.candidateName, job_title: state.jobTitle, current_phase: state.phase, phase_info: state.phaseInfo as any, first_question: '', question_index: 0 }}
                            videoRef={video.videoRef}
                            onCameraStart={video.startCamera}
                            onBegin={handleBeginInterview}
                        />
                    )}
                </>
            )}

            {/* ERREUR */}
            {state.status === 'error' && (
                <main className="relative z-10 flex-1 flex items-center justify-center px-4">
                    <ErrorScreen message={state.errorMessage} onRetry={start} />
                </main>
            )}

            {/* ENTRETIEN */}
            {appStep === 'interview' && state.status !== 'error' && (
                <>
                    {/* Miniature caméra */}
                    {video.isRecording && (
                        <div className="fixed z-50 overflow-hidden rounded-2xl" style={{ bottom: 24, right: 24, width: 180, height: 112, border: '1px solid rgba(255,255,255,0.1)', background: '#000', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
                            <video ref={video.videoRef} autoPlay muted playsInline className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                            {voiceMetrics && (
                                <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: voiceMetrics.stress_level === 'low' ? 'rgba(34,197,94,0.7)' : voiceMetrics.stress_level === 'medium' ? 'rgba(251,191,36,0.7)' : 'rgba(239,68,68,0.7)', transition: 'background 1s ease' }} />
                            )}
                            <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,0,0,0.65)' }}>
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>REC</span>
                            </div>
                            {voiceMetrics && (
                                <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.65)', fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>
                                    {voiceMetrics.stress_level === 'low' ? '😌' : voiceMetrics.stress_level === 'medium' ? '🤔' : '😰'}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Avertissement plein écran */}
                    {!isFullscreen && (
                        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full flex items-center gap-2" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(251,191,36,0.8)" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
                            <span className="text-xs" style={{ color: 'rgba(251,191,36,0.8)' }}>Mode plein écran recommandé</span>
                            <button onClick={() => document.documentElement.requestFullscreen().catch(() => {})} className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>Activer</button>
                        </div>
                    )}

                    {/* Upload vidéo */}
                    {video.isUploading && (
                        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full border border-amber-400/30 border-t-amber-400 animate-spin" />
                                <span className="text-xs" style={{ color: 'rgba(251,191,36,0.8)' }}>Sauvegarde de la vidéo…</span>
                            </div>
                        </div>
                    )}

                    {/* PhaseBar avec timer ─────────────────────────────────── */}
                    {showPhaseBar && (
                        <PhaseBar
                            current={state.phase}
                            candidateName={state.candidateName}
                            jobTitle={state.jobTitle}
                            timeLimitSeconds={isOralPhase ? effectiveTimeLimitSeconds : undefined}
                            timerResetKey={isOralPhase ? timerResetKey : undefined}
                            timerPaused={timerPaused}
                        />
                    )}

                    {voiceMetrics && showPhaseBar && <VoiceIndicator metrics={voiceMetrics} />}

                    {/* Contenu principal */}
                    <main className="relative flex-1 flex items-center justify-center px-4"
                          style={{ zIndex: 10, paddingTop: showPhaseBar ? 108 : 48, paddingBottom: 48 }}>

                        {state.status === 'fraud' && <FraudScreen message={state.fraudMessage} />}

                        {state.status === 'transitioning' && (
                            <PhaseTransition completedPhase={prevPhase} nextPhase={state.phase} phaseScore={state.phaseScore} nextPhaseInfo={state.nextPhaseInfo} />
                        )}

                        {/* COMMUNICATION & CV CLARIFICATION */}
                        {(state.status === 'ready' || state.status === 'answering') &&
                            (state.phase === 'communication' || state.phase === 'cv_clarification') && (
                                <QuestionCard
                                    key={timerResetKey}
                                    question={state.currentQuestion}
                                    questionIndex={state.questionIndex}
                                    totalQuestions={PHASE_TOTALS[state.phase] ?? 4}
                                    phase={state.phase}
                                    token={token!}
                                    submitting={state.status === 'answering'}
                                    onSubmit={submitAnswer}
                                    onVoiceResult={handleVoiceResult}
                                    timeLimitSeconds={effectiveTimeLimitSeconds}
                                    timerResetKey={timerResetKey}
                                />
                            )}

                        {/* SCENARIO */}
                        {(state.status === 'ready' || state.status === 'answering') &&
                            state.phase === 'scenario' && (
                                <ScenarioCard
                                    key={`scenario-${state.questionIndex}`}
                                    question={state.currentQuestion}
                                    scenarioTheme={state.scenarioTheme}
                                    questionIndex={state.questionIndex}
                                    totalScenarios={state.totalScenarios}
                                    isContradictionFollowup={state.isContradictionFollowup}
                                    token={token!}
                                    submitting={state.status === 'answering'}
                                    onSubmit={submitAnswer}
                                    onVoiceResult={handleVoiceResult}
                                    timeLimitSeconds={effectiveTimeLimitSeconds}
                                    timerResetKey={timerResetKey}
                                />
                            )}

                        {/* QUESTIONS TECHNIQUES ORALES ─── NE JAMAIS AFFICHER LE QCM ICI */}
                        {(state.status === 'ready' || state.status === 'answering') &&
                            state.phase === 'technical' && (
                                <TechnicalQuestionCard
                                    key={`technical-${state.questionIndex}`}
                                    question={state.currentQuestion}
                                    questionIndex={state.questionIndex}
                                    totalQuestions={PHASE_TOTALS.technical}
                                    angle={state.currentAngle}
                                    token={token!}
                                    submitting={state.status === 'answering'}
                                    onSubmit={submitAnswer}
                                    onVoiceResult={handleVoiceResult}
                                    timeLimitSeconds={effectiveTimeLimitSeconds}
                                    timerResetKey={timerResetKey}
                                />
                            )}

                        {/* QCM TECHNIQUE ─── UNIQUEMENT phase "qcm", jamais "technical" */}
                        {(state.status === 'qcm' ||
                            (state.status === 'answering' && state.phase === 'qcm')) && (
                            <QCMView
                                questions={state.qcmQuestions}
                                answers={state.qcmAnswers}
                                timeLimitSeconds={state.qcmTimeLimit}
                                submitting={state.status === 'answering'}
                                onSelect={selectQCMAnswer}
                                onSubmit={() => submitQCM(state.qcmAnswers)}
                            />
                        )}

                        {/* COMPLETION */}
                        {state.status === 'completed' && (
                            <CompletionScreen finalData={state.finalData} videoUploading={video.isUploading} videoUploaded={video.isDone} />
                        )}
                    </main>
                </>
            )}

            {/* Grain texture */}
            <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 20, opacity: 0.018, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E")` }} />
        </div>
    )
}