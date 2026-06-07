export type Phase =
    | 'communication'
    | 'cv_clarification'
    | 'scenario'
    | 'technical'
    | 'qcm'
    | 'completed'

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
    questions:        number
    description:      string
}

// ── Fix 1 : ajouter index signature pour que StartResponse soit assignable
//            à Record<string, unknown> (résout resolveRaw(data))
export interface StartResponse {
    interview_id:    number
    candidate_name:  string
    job_title:       string
    current_phase:   Phase
    phase_info:      Record<Phase, PhaseInfo>
    first_question:  string
    question_index:  number
    total_scenarios: number
    [key: string]:   unknown   // ← index signature ajoutée
}

export interface AnswerPayload {
    answer:                string
    question_index:        number
    phase:                 Phase | 'qcm'   // ← 'qcm' autorisé
    current_question:      string
    response_time_seconds: number
    qcm_answers?:          Record<string, number>  // ← Fix 2 : champ optionnel
}

// ── Fix 3 : QCMAnswerPayload — phase 'qcm' (pas 'technical')
export interface QCMAnswerPayload {
    phase:                 'qcm'                   // ← corrigé : 'qcm' et non 'technical'
    qcm_answers:           Record<string, number>
    answer:                string
    question_index:        number
    current_question:      string
    response_time_seconds: number
}

export interface AnswerResponse {
    next_question?:             string
    question_index?:            number
    phase?:                     Phase
    is_phase_end?:              boolean
    phase_score?:               number
    next_phase?:                Phase
    next_phase_info?:           string
    questions_remaining?:       number
    // Scénario
    scenario_theme?:            string
    total_scenarios?:           number
    is_contradiction_followup?: boolean
    // Questions techniques orales
    current_angle?:             string
    total_technical?:           number
    time_limit_seconds?:        number
    // QCM
    qcm_questions?:             QCMQuestion[]
    qcm_time_limit_seconds?:    number
    // Fin QCM
    qcm_score?:                 number
    correct_answers?:           number
    total_questions?:           number
    next_step?:                 'finalize'
    message?:                   string
}

export interface QCMQuestion {
    question:   string
    options:    string[]
    difficulty: 'easy' | 'medium' | 'hard'
    domain:     string
}

export interface FinalizeResponse {
    status: 'completed'
    final_score: number
    breakdown: {
        communication:    number
        cv_clarification: number
        scenario:         number
        qcm:              number
        coding:           number
        vocal:            number | null
        warnings_penalty: number | undefined
    }
    candidate_feedback: string
    message:            string
}

export interface WarningResponse {
    warning_count:                  number
    fraud_score:                    number
    terminated:                     boolean
    remaining_before_termination?:  number
    message?:                       string
}

export interface AudioResponse {
    text:             string
    word_count:       number
    duration_seconds: number
    voice_metrics:    Record<string, number>
    vocal_score:      number
}

// État interne du hook useInterview
export interface InterviewState {
    status:                  'loading' | 'ready' | 'answering' | 'transitioning' | 'qcm' | 'completed' | 'fraud' | 'error'
    candidateName:           string
    jobTitle:                string
    phase:                   Phase
    phaseInfo:               Record<string, PhaseInfo>
    questionIndex:           number
    currentQuestion:         string
    timeLimitSeconds:        number | null
    questionTimeLimitSeconds: number | null
    currentAngle:            string
    totalTechnical:          number
    scenarioTheme:           string
    isContradictionFollowup: boolean
    qcmQuestions:            QCMQuestion[]
    qcmTimeLimit:            number
    qcmAnswers:              Record<string, number>
    phaseScore:              number | null
    nextPhaseInfo:           string
    totalScenarios:          number
    finalData:               FinalizeResponse | null
    fraudMessage:            string
    errorMessage:            string
    startTime:               number
}