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
import { useVocalMonitor } from '../../hooks/useVocalMonitor'

const DEFAULT_TIME: Record<string, number> = {
    communication:    3 * 60,
    cv_clarification: 3 * 60,
    scenario:         7 * 60,
    technical:        7 * 60,
}

const PHASE_TOTALS: Record<string, number> = {
    communication:    5,
    cv_clarification: 3,
    scenario:         4,
    technical:        4,
}
const ACTIVE_STATUSES = ['ready', 'answering', 'qcm']
const ORAL_PHASES     = ['communication', 'cv_clarification', 'scenario', 'technical']

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
    const {
        state, start, submitAnswer, submitQCM,
        selectQCMAnswer, setFraudTerminated, setScenarioReady
    } = interview

    const video = useVideoRecorder()

    const [appStep, setAppStep]                   = useState<'welcome' | 'interview'>('welcome')
    const [isFullscreen, setIsFullscreen]         = useState(false)
    const [fullscreenWarned, setFullscreenWarned] = useState(false)
    const [voiceMetrics, setVoiceMetrics]         = useState<VoiceMetrics | null>(null)
    const [warningMessage, setWarningMessage]     = useState<string>('')
    const [warningCount, setWarningCount]         = useState<number>(0)
    const [breakCountdown, setBreakCountdown]     = useState<number>(0)

    useEffect(() => { start() }, [])

    // ── Fullscreen ────────────────────────────────────────────────────────────
    useEffect(() => {
        const handler = () => {
            const inFs = !!document.fullscreenElement
            setIsFullscreen(inFs)

            if (!inFs && appStep === 'interview' && ACTIVE_STATUSES.includes(state.status)) {
                // Ré-entrer automatiquement en fullscreen après 2 secondes
                setTimeout(() => {
                    document.documentElement.requestFullscreen().catch(() => {})
                }, 2000)

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

    // ── Pause / reprise caméra pendant le break ─────────────────────────────────
    // Dès qu'on entre en statut 'break', on met l'enregistrement vidéo en pause
    // (les pistes restent ouvertes, juste le MediaRecorder est pausé : on garde
    // les chunks déjà enregistrés). Dès qu'on quitte 'break' (retour vers
    // 'ready'/'answering'/'qcm' après le scenario-ready), on reprend
    // l'enregistrement sur le MÊME flux, sans recréer de nouveau Blob.
    useEffect(() => {
        if (state.status === 'break' && video.isRecording) {
            video.pauseRecording()
        } else if (state.status !== 'break' && video.isPaused) {
            video.resumeRecording()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.status])

    // ── Break countdown ───────────────────────────────────────────────────────
    useEffect(() => {
        if (state.status !== 'break') return
        setBreakCountdown(state.breakTimeLeft || 60)
    }, [state.status])

    useEffect(() => {
        if (state.status !== 'break' || breakCountdown <= 0) return

        const interval = setInterval(() => {
            setBreakCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(interval)
                    pollScenarioReady()
                    return 0
                }
                return prev - 1
            })
        }, 1000)

        return () => clearInterval(interval)
    }, [state.status, breakCountdown])

    const pollScenarioReady = useCallback(async () => {
        try {
            const res  = await fetch(`/api/recruitment/ai-interview/${token}/scenario-ready/`)
            const data = await res.json()
            if (data.ready) {
                setScenarioReady(data)
            } else {
                setTimeout(pollScenarioReady, 3000)
            }
        } catch {
            setTimeout(pollScenarioReady, 5000)
        }
    }, [token, setScenarioReady])

    // ── Anti-fraude ───────────────────────────────────────────────────────────
    // `active` retombe à false automatiquement pendant 'break' puisque
    // ACTIVE_STATUSES ne contient plus ce statut : pas de détection de fraude
    // ni de face-detection pendant la pause.
    useAntiFraud({
        token:        token!,
        active:       appStep === 'interview' && ACTIVE_STATUSES.includes(state.status),
        onTerminated: async (msg) => { await video.stopAndUpload(token!); setFraudTerminated(msg) },
        onWarning:    (msg, count) => {
            setWarningMessage(msg)
            setWarningCount(count)
            setTimeout(() => setWarningMessage(''), 5000)
        },
    })
    useVocalMonitor({
        token:        token!,
        active:       appStep === 'interview' && ACTIVE_STATUSES.includes(state.status),
        onTerminated: async (msg) => { await video.stopAndUpload(token!); setFraudTerminated(msg) },
        onWarning:    (msg, count) => {
            setWarningMessage(msg)
            setWarningCount(count)
            setTimeout(() => setWarningMessage(''), 6000)
        },
    })

    useFaceDetection({
        token:           token!,
        videoRef:        video.videoRef,
        active:          appStep === 'interview' && ACTIVE_STATUSES.includes(state.status),
        onTerminated:    async (msg) => { await video.stopAndUpload(token!); setFraudTerminated(msg) },
        onWarning:       (msg, _type, count) => {
            setWarningMessage(msg)
            setWarningCount(count)
            setTimeout(() => setWarningMessage(''), 5000)
        },
        checkIntervalMs: 5000,
    })

    useEffect(() => {
        if (state.status === 'completed') {
            video.stopAndUpload(token!)
        }
    }, [state.status])

    const handleBeginInterview = useCallback(async () => {
        try { await document.documentElement.requestFullscreen(); setIsFullscreen(true) }
        catch { setFullscreenWarned(true) }

        if (!video.stream) {
            const ok = await video.startCamera()
            if (!ok) return
        }
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

    // ── Timer ─────────────────────────────────────────────────────────────────
    const showPhaseBar = appStep === 'interview' &&
        [...ACTIVE_STATUSES, 'transitioning'].includes(state.status)

    const isOralPhase = ORAL_PHASES.includes(state.phase) &&
        (state.status === 'ready' || state.status === 'answering')

    const effectiveTimeLimitSeconds: number =
        (state.questionTimeLimitSeconds && state.questionTimeLimitSeconds > 0)
            ? state.questionTimeLimitSeconds
            : (DEFAULT_TIME[state.phase] ?? 5 * 60)

    const timerResetKey = `${state.phase}-${state.questionIndex}`
    const timerPaused   = state.status === 'answering'

    const prevPhase =
        state.phase === 'cv_clarification' ? 'communication' :
            state.phase === 'scenario'          ? 'cv_clarification' :
                state.phase === 'technical'         ? 'scenario' :
                    state.phase === 'qcm'              ? 'technical' :
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
                        <main className="relative z-10 flex-1 flex items-center justify-center">
                            <LoadingScreen />
                        </main>
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
                    {/* Miniature caméra — masquée pendant le break puisque
                        video.isRecording devient false (état 'paused') */}
                    {video.isRecording && (
                        <div
                            className="fixed z-50 overflow-hidden rounded-2xl"
                            style={{
                                bottom: 24, right: 24, width: 180, height: 112,
                                border: '1px solid rgba(255,255,255,0.1)', background: '#000',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                                display: video.isRecording ? 'block' : 'none',
                            }}
                        >
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

                    {/* Warning fraude */}
                    {warningMessage && (
                        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl flex items-center gap-3 max-w-sm" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', backdropFilter: 'blur(8px)' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(239,68,68,0.8)" strokeWidth="2">
                                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                                <line x1="12" y1="9" x2="12" y2="13"/>
                                <line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                            <span style={{ fontSize: 12, color: 'rgba(239,68,68,0.9)' }}>{warningMessage}</span>
                            <span style={{ fontSize: 10, color: 'rgba(239,68,68,0.5)', marginLeft: 'auto' }}>{warningCount}/3</span>
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

                    {/* PhaseBar */}
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

                    {/* Contenu principal */}
                    <main className="relative flex-1 flex items-center justify-center px-4"
                          style={{ zIndex: 10, paddingTop: showPhaseBar ? 108 : 48, paddingBottom: 48 }}>

                        {state.status === 'fraud' && <FraudScreen message={state.fraudMessage} />}

                        {state.status === 'transitioning' && (
                            <PhaseTransition
                                completedPhase={prevPhase}
                                nextPhase={state.phase}
                                phaseScore={state.phaseScore}
                                nextPhaseInfo={state.nextPhaseInfo}
                            />
                        )}

                        {/* BREAK — pause avant scénarios */}
                        {state.status === 'break' && (
                            <div className="flex flex-col items-center gap-8 text-center max-w-md mx-auto">
                                <div
                                    className="w-36 h-36 rounded-full flex items-center justify-center"
                                    style={{
                                        background: 'rgba(251,191,36,0.06)',
                                        border:     '2px solid rgba(251,191,36,0.15)',
                                    }}
                                >
                                    <span className="text-5xl font-light tabular-nums" style={{ color: '#fbbf24' }}>
                                        {Math.floor(breakCountdown / 60)}:{String(breakCountdown % 60).padStart(2, '0')}
                                    </span>
                                </div>

                                <div>
                                    <h2 className="text-2xl font-light mb-3" style={{ color: 'rgba(255,255,255,0.9)' }}>
                                        Pause
                                    </h2>
                                    <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                        Vous avez bien répondu aux questions de parcours.<br />
                                        Les mises en situation démarreront automatiquement.
                                    </p>
                                </div>

                                <div
                                    className="flex items-center gap-2 px-4 py-2 rounded-full text-xs"
                                    style={{
                                        background:  breakCountdown <= 30 ? 'rgba(251,191,36,0.1)'  : 'rgba(255,255,255,0.04)',
                                        border:      breakCountdown <= 30 ? '1px solid rgba(251,191,36,0.25)' : '1px solid rgba(255,255,255,0.07)',
                                        color:       breakCountdown <= 30 ? 'rgba(251,191,36,0.7)'  : 'rgba(255,255,255,0.25)',
                                        transition:  'all 0.5s ease',
                                    }}
                                >
                                    <span
                                        className="w-1.5 h-1.5 rounded-full animate-pulse"
                                        style={{ background: breakCountdown <= 30 ? '#fbbf24' : 'rgba(255,255,255,0.2)' }}
                                    />
                                    {breakCountdown <= 30
                                        ? 'Chargement des mises en situation…'
                                        : 'Préparez-vous pour la prochaine étape'}
                                </div>
                            </div>
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

                        {/* TECHNICAL */}
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

                        {/* QCM */}
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
                            <CompletionScreen
                                finalData={state.finalData as any}
                                videoUploading={video.isUploading}
                                videoUploaded={video.isDone}
                            />
                        )}
                    </main>
                </>
            )}

            {/* Grain texture */}
            <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 20, opacity: 0.018, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E")` }} />
        </div>
    )
}