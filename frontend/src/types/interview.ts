
export type Phase = 'communication' | 'cv_clarification' | 'scenario' | 'technical' | 'qcm' | 'completed'

export type WarningType =
    | 'tab_switch'
    | 'window_blur'
    | 'copy_paste'
    | 'face_not_visible'
    | 'multiple_faces'
    | 'phone_detected'
    | 'screen_share_stopped'
    | 'time_exceeded'

export interface PhaseInfo {
    duration_minutes: number
    questions: number
    description: string
}

export interface StartResponse {
    interview_id: number
    candidate_name: string
    job_title: string
    current_phase: Phase
    phase_info: Record<Phase, PhaseInfo>
    first_question: string
    question_index: number
}

export interface AnswerPayload {
    answer: string
    question_index: number
    phase: Phase
    current_question: string
    response_time_seconds: number
}

export interface QCMAnswerPayload {
    phase: 'technical'
    qcm_answers: Record<string, number>
    answer: string
    question_index: number
    current_question: string
    response_time_seconds: number
}

export interface AnswerResponse {
    next_question?: string
    question_index?: number
    phase?: Phase
    is_phase_end?: boolean
    phase_score?: number
    next_phase?: Phase
    next_phase_info?: string
    questions_remaining?: number
    // Scénario
    scenario_theme?: string
    total_scenarios?: number
    is_contradiction_followup?: boolean
    // QCM
    qcm_questions?: QCMQuestion[]
    qcm_time_limit_seconds?: number
    // Fin QCM
    qcm_score?: number
    correct_answers?: number
    total_questions?: number
    next_step?: 'finalize'
    message?: string
}

export interface QCMQuestion {
    question: string
    options: string[]
    difficulty: 'easy' | 'medium' | 'hard'
    domain: string
}

export interface FinalizeResponse {
    status: 'completed'
    final_score: number
    breakdown: {
        communication: number
        cv_clarification: number
        scenario: number
        qcm: number
        coding: number
        vocal: number | null
        warnings_penalty: number
    }
    candidate_feedback: string
    message: string
}

export interface WarningResponse {
    warning_count: number
    fraud_score: number
    terminated: boolean
    remaining_before_termination?: number
    message?: string
}

export interface AudioResponse {
    text: string
    word_count: number
    duration_seconds: number
    voice_metrics: Record<string, number>
    vocal_score: number
}

// État interne du hook useInterview
export interface InterviewState {
    timeLimitSeconds:        number | null   // ← secondes pour QuestionTimer (null = pas de timer)
    status: 'loading' | 'ready' | 'answering' | 'transitioning' | 'qcm' | 'completed' | 'fraud' | 'error'
    candidateName: string
    jobTitle: string
    phase: Phase
    phaseInfo: Record<string, PhaseInfo>
    questionIndex: number
    currentQuestion: string
    scenarioTheme: string
    isContradictionFollowup: boolean
    qcmQuestions: QCMQuestion[]
    qcmTimeLimit: number
    qcmAnswers: Record<string, number>
    phaseScore: number | null
    nextPhaseInfo: string
    totalScenarios: number
    finalData: FinalizeResponse | null
    fraudMessage: string
    errorMessage: string
    startTime: number // timestamp du début de la question courante
}

