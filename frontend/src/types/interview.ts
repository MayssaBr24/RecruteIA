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
    | 'fullscreen_exit'
    | 'multi_screen'
    | 'face_not_centered'
    | 'devtools_open'
    | 'speaker_change'
    | 'multiple_speakers_simultaneous'
    | 'question_reread'


export interface PhaseInfo {
    duration_minutes: number
    questions:        number
    description:      string
}

export interface StartResponse {
    interview_id:    number
    candidate_name:  string
    job_title:       string
    current_phase:   Phase
    phase_info:      Record<Phase, PhaseInfo>
    first_question:  string
    question_index:  number
    total_scenarios: number
    [key: string]:   unknown
}

export interface AnswerPayload {
    answer:                string
    question_index:        number
    phase:                 Phase | 'qcm'
    current_question:      string
    response_time_seconds: number
    qcm_answers?:          Record<string, number>
}

export interface QCMAnswerPayload {
    phase:                 'qcm'
    qcm_answers:           Record<string, number>
    answer:                string
    question_index:        number
    current_question:      string
    response_time_seconds: number
}

// ✅ AJOUT: Types pour les warnings vocaux
export interface VocalWarning {
    type:         'speaker_change' | 'multiple_speakers_simultaneous' | 'question_reread'
    severity:     'low' | 'medium' | 'high' | 'critical'
    penalty:      number
    description:  string
    details?:     Record<string, unknown>
}

export interface IdentityFlags {
    speaker_changed:    boolean
    multiple_speakers:  boolean
    question_reread:    boolean
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
    qcm_skipped?:               boolean
    // Fin QCM
    qcm_score?:                 number
    correct_answers?:           number
    total_questions?:           number
    next_step?:                 'finalize'
    message?:                   string
    // ✅ AJOUT: Champs sécurité vocale
    vocal_warnings?:            VocalWarning[]
    vocal_security_penalty?:    number
    identity_flags?:            IdentityFlags
    terminated?:                boolean
    error?:                     string
}

export interface QCMQuestion {
    question:   string
    options:    string[]
    difficulty: 'easy' | 'medium' | 'hard'
    domain:     string
}

// ✅ AJOUT: Types pour la sécurité vocale dans FinalizeResponse
export interface VocalSecuritySummary {
    total_warnings:   number
    speaker_changes:  number
    multiple_speakers: number
    question_rereads: number
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
    // ✅ AJOUT: Champs sécurité vocale
    vocal_security_summary?: VocalSecuritySummary
    is_vocal_suspicious?:    boolean
    security_penalty?:       number
}

export interface WarningResponse {
    warning_count:                  number
    fraud_score:                    number
    terminated:                     boolean
    remaining_before_termination?:  number
    message?:                       string
}

// ✅ AJOUT: Types pour la sécurité vocale dans AudioResponse
export interface SpeakerConsistency {
    is_consistent:    boolean
    confidence:       number
    details?:         Record<string, unknown>
}

export interface MultipleSpeakersResult {
    unique_speakers:        number
    has_multiple:           boolean
    total_segments_analyzed?: number
}

export interface AudioResponse {
    text:             string
    word_count:       number
    duration_seconds: number
    voice_metrics:    Record<string, number>
    vocal_score:      number
    // ✅ AJOUT: Champs sécurité vocale
    anomalies?:            VocalWarning[]
    speaker_consistency?:  SpeakerConsistency
    has_speaker_change?:   boolean
    has_multiple_speakers?: boolean
    user_message?:         string
}

// ✅ AJOUT: Types pour les stats de sécurité vocale
export interface VocalMetricsHistory {
    timestamp:          string
    phase:              string
    vocal_score:        number
    has_speaker_change: boolean
    has_multiple_speakers: boolean
    anomalies_count:    number
}

export interface VocalSecurityStatsResponse {
    vocal_security_summary: VocalSecuritySummary
    vocal_metrics_history:  VocalMetricsHistory[]
    is_suspicious:          boolean
}

// État interne du hook useInterview
export interface InterviewState {
    status:                  'loading' | 'ready' | 'answering' | 'transitioning' | 'qcm' | 'completed' | 'fraud' | 'error'| 'break'
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
    // ✅ AJOUT: Champs sécurité vocale
    vocalWarnings:           VocalWarning[]
    vocalSecurityPenalty:    number
    hasSpeakerChange:        boolean
    hasMultipleSpeakers:     boolean
    questionRereadDetected:  boolean
    speakerConsistency:      SpeakerConsistency | null
    anomalies:               VocalWarning[]
    isVocalSuspicious:       boolean
}