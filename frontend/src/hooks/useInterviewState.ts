// src/hooks/useInterviewState.ts
// Gère tout l'état de l'entretien : phases, questions, scores, réponses

import { useState, useRef, useEffect } from 'react'
import { AudioResult } from '../components/interview/AudioRecorder'

export type Phase =
    | 'loading'
    | 'setup'
    | 'communication'
    | 'cv_clarification'
    | 'technical_qcm'
    | 'technical_code'
    | 'completed'
    | 'error'
    | 'fraud'

export type AnswerMode = 'text' | 'voice'

export interface InterviewData {
    interview_id:  number
    candidate_name: string
    job_title:     string
    current_phase: string
    phase_info:    Record<string, { duration: number; questions: number }>
    first_question: string
    question_index: number
}

export interface QCMQuestion {
    question:   string
    options:    string[]
    correct:    number
    difficulty: string
    technology: string
}

export interface CodingExercise {
    title:       string
    description: string
    starter_code: string
    test_cases:  Array<{ input: string; expected: string; is_public: boolean }>
    time_limit_minutes: number
    language:    string
    hints?:      string[]
}

export function useInterviewState() {
    // ── Phase & données ──────────────────────────────────────────────
    const [phase,         setPhase]         = useState<Phase>('loading')
    const [interviewData, setInterviewData] = useState<InterviewData | null>(null)
    const [currentQuestion, setCurrentQuestion] = useState('')
    const [questionIndex,   setQuestionIndex]   = useState(0)
    const [currentPhase,    setCurrentPhase]    = useState('communication')
    const [submitting,      setSubmitting]      = useState(false)
    const [error,           setError]           = useState('')

    // ── Mode de réponse ──────────────────────────────────────────────
    const [answerMode,  setAnswerMode]  = useState<AnswerMode>('text')
    const [textAnswer,  setTextAnswer]  = useState('')
    const [voiceResult, setVoiceResult] = useState<AudioResult | null>(null)
    const [voiceScores, setVoiceScores] = useState<number[]>([])

    // ── QCM ──────────────────────────────────────────────────────────
    const [qcmQuestions, setQcmQuestions] = useState<QCMQuestion[]>([])
    const [qcmAnswers,   setQcmAnswers]   = useState<Record<string, number>>({})
    const [qcmScore,     setQcmScore]     = useState<number | null>(null)

    // ── Code ─────────────────────────────────────────────────────────
    const [codingExercise, setCodingExercise] = useState<CodingExercise | null>(null)
    const [codingScore,    setCodingScore]    = useState<number | null>(null)

    // ── Score final ──────────────────────────────────────────────────
    const [finalScore,     setFinalScore]     = useState<number | null>(null)
    const [finalBreakdown, setFinalBreakdown] = useState<Record<string, number>>({})
    const [finalFeedback,  setFinalFeedback]  = useState('')

    // ── Anti-fraude ──────────────────────────────────────────────────
    const [warningCount,   setWarningCount]   = useState(0)
    const [showWarning,    setShowWarning]    = useState(false)
    const [warningMessage, setWarningMessage] = useState('')

    // ── Timers ────────────────────────────────────────────────────────
    const [timeLeft,   setTimeLeft]   = useState(120)
    const [globalTime, setGlobalTime] = useState(0)
    const timerRef        = useRef<NodeJS.Timeout | null>(null)
    const globalTimerRef  = useRef<NodeJS.Timeout | null>(null)
    // Correction: initialiser à 0 au lieu de Date.now()
    const responseStartTime = useRef<number>(0)

    // Initialiser responseStartTime au premier render uniquement
    useEffect(() => {
        if (responseStartTime.current === 0) {
            responseStartTime.current = Date.now()
        }
    }, [])

    // ── Caméra ────────────────────────────────────────────────────────
    const [cameraActive, setCameraActive] = useState(false)
    const [cameraError,  setCameraError]  = useState('')
    const videoRef  = useRef<HTMLVideoElement>(null)
    const streamRef = useRef<MediaStream | null>(null)

    const resetAnswer = () => {
        setTextAnswer('')
        setVoiceResult(null)
        setAnswerMode('text')
    }

    // Fonction utilitaire pour réinitialiser le timer de réponse
    const resetResponseTimer = () => {
        responseStartTime.current = Date.now()
    }

    return {
        // Phase
        phase, setPhase,
        interviewData, setInterviewData,
        currentQuestion, setCurrentQuestion,
        questionIndex, setQuestionIndex,
        currentPhase, setCurrentPhase,
        submitting, setSubmitting,
        error, setError,
        // Réponse
        answerMode, setAnswerMode,
        textAnswer, setTextAnswer,
        voiceResult, setVoiceResult,
        voiceScores, setVoiceScores,
        resetAnswer,
        // QCM
        qcmQuestions, setQcmQuestions,
        qcmAnswers, setQcmAnswers,
        qcmScore, setQcmScore,
        // Code
        codingExercise, setCodingExercise,
        codingScore, setCodingScore,
        // Final
        finalScore, setFinalScore,
        finalBreakdown, setFinalBreakdown,
        finalFeedback, setFinalFeedback,
        // Anti-fraude
        warningCount, setWarningCount,
        showWarning, setShowWarning,
        warningMessage, setWarningMessage,
        // Timers
        timeLeft, setTimeLeft,
        globalTime, setGlobalTime,
        timerRef, globalTimerRef,
        responseStartTime,
        resetResponseTimer, // Exporter la fonction utilitaire
        // Caméra
        cameraActive, setCameraActive,
        cameraError, setCameraError,
        videoRef, streamRef,
    }
}