import {ScoreBreakdown} from "../components/rh/recruitment/types";
import {Availability} from "../hooks/useInterviewPlanning.ts";

export interface ReportData {
    generated_at: string
    interview_token: string
    interview_id: number
    status: string
    candidate: Candidate
    job_offer: JobOffer
    timing: Timing
    scores: Scores
    score_breakdown: ScoreBreakdown[]
    transcript_phases: TranscriptPhase[]
    voice_analysis: VoiceAnalysis
    security_warnings: SecurityWarnings
    qcm_detail: QCMDetail
    profile_inconsistencies: ProfileInconsistency[]
    recommendation: Recommendation
    has_video: boolean
    video_url?: string
}

export interface Candidate {
    id: number
    full_name: string
    email: string
    phone: string
    current_position: string
    experience_years: number
    degree: string
    university: string
    location: string
    linkedin_url: string
    github_username: string
    ai_summary: string
    ai_strengths: string[]
    ai_weaknesses: string[]
    ai_missing_skills: string[]
}

export interface JobOffer {
    id: number
    title: string
    domain: string
    requirements: string
    city: string
}

export interface Timing {
    started_at: string
    completed_at: string
    duration_seconds: number
    duration_label: string
}

export interface Scores {
    communication: number
    cv_clarification: number
    technical: number
    scenario: number
    qcm: number
    vocal?: number
    global: number
}



export interface TranscriptEntry {
    question_index: number
    question: string
    answer: string
    response_time_sec: number
    response_time_label: string
    vocal_score?: number
    voice_metrics?: VoiceMetrics
    word_count?: number
    timestamp: string
}

export interface VoiceMetrics {
    confidence_label: string
    fluency_label: string
    [key: string]: unknown
}

export interface TranscriptPhase {
    phase: string
    phase_label: string
    entries: TranscriptEntry[]
    count: number
}

export interface VoiceAnomaly {
    type: string
    severity: 'critical' | 'high' | 'medium' | 'low'
    description: string
    timestamp: string
    phase_label: string
    penalty: number
    [key: string]: unknown
}

export interface VoiceEntry {
    index: number
    phase: string
    phase_label: string
    vocal_score: number
    word_count: number
    duration_label: string
    wpm: number
    wpm_label: string
    confidence_score: number
    confidence_label: string
    fluency_score: number
    fluency_label: string
    pitch_stability: number
    speech_activity: number
    silence_ratio: number
    pause_count: number
    anomalies: VoiceAnomaly[]
    has_double_voice: boolean
    has_speaker_change: boolean
    speaker_confidence: number
}

export interface VoiceAnalysis {
    available: boolean
    entries: VoiceEntry[]
    anomalies: VoiceAnomaly[]
    summary: {
        avg_vocal_score: number
        avg_wpm: number
        avg_confidence: number
        avg_fluency: number
        total_anomalies: number
        has_double_voice: boolean
        has_speaker_change: boolean
        critical_anomalies: VoiceAnomaly[]
    }
}

export interface SecurityWarning {
    id: number
    type: string
    label: string
    severity: string
    severity_icon: string
    details: string
    created_at: string
    penalty_pts: number
}

export interface SecurityWarnings {
    entries: SecurityWarning[]
    count: number
    total_penalty: number
    terminated: boolean
    termination_reason?: string
}

export interface QCMItem {
    index: number
    question: string
    options: string[]
    correct_index: number
    correct_option: string
    candidate_index?: number
    candidate_option: string
    is_correct: boolean
    difficulty: string
    domain: string
    explanation: string
}

export interface QCMDetail {
    available: boolean
    questions: QCMItem[]
    score: number
    correct: number
    total: number
}

export interface ProfileInconsistency {
    type: string
    description: string
    severity: string
    suggested_question?: string
    rh_note?: string
}

export interface Recommendation {
    ai_recommendation: string
    override_recommendation?: string
    final_recommendation: string
    rh_annotation?: string
    rh_rating?: number
    ai_feedback_full: string
}

// ─────────────────────────────────────────────────────────────────────────────
// types.ts — Interfaces & types partagés
// ─────────────────────────────────────────────────────────────────────────────



export interface AIAnalysisResult {
    status: 'completed' | 'pending' | 'error'
    score?: number
    cv_score?: number
    motivation_score?: number
    github_score?: number
    github_relevance?: number
    coherence_score?: number
    coherence_flags?: string[]
    breakdown?: ScoreBreakdown
    message: string
    next_steps?: string
}

export interface ProfessionalLink {
    platform: string
    url: string
}

export interface CertificateData {
    id: string
    name: string
    issuing_organization: string
    credential_url: string
    file: File | null
    file_preview?: string
}

export interface RecommendationData {
    id: string
    recommender_name: string
    recommender_position: string
    recommender_company: string
    relationship: string
    file: File | null
    file_preview?: string
}

export type OAuthPlatformStatus = 'idle' | 'loading' | 'verified' | 'error'

export interface OAuthStatus {
    linkedin: OAuthPlatformStatus
    github: OAuthPlatformStatus
}

export interface VerifiedProfiles {
    linkedin_url: string
    github_url: string
}

export interface FormDataState {
    full_name: string
    email: string
    phone: string
    nationality: string
    university: string
    degree_level: string
    graduation_year: string
    current_position: string
    experience_years: string
    linkedin_url: string
    github_url: string
    current_location: string
    salary_expectation: string
    availability_date: string
    cv_file: File | null
    cover_letter_file: File | null
    professional_links: ProfessionalLink[]
    certifications: CertificateData[]
    recommendation_letters: RecommendationData[]
    github_data: Record<string, unknown> | null
}

// Type pour les erreurs Axios
export interface ApiErrorResponse {
    message?: string
    detail?: string
    [key: string]: string | string[] | undefined
}

export interface AxiosLikeError {
    response?: {
        data?: ApiErrorResponse
    }
}
// ══════════════════════════════════════════
// TYPES — Employees Module
// ══════════════════════════════════════════

export interface Employee {
    id: number
    full_name: string
    email: string
    phone: string
    current_location: string
    nationality: string
    university: string
    degree_level: string
    graduation_year: string
    experience_years: number
    job_offer_title: string
    hired_at: string
    salary_expectation: number | null
    linkedin_url: string
    cv_file: string
    // Documents RH
    contract_file: string | null
    cin_file: string | null
    cin_number: string | null
    rib_file: string | null
    rib_number: string | null
    photo_file: string | null
    start_date: string | null
    department: string | null
    position_title: string | null
    employee_id: string | null
    // IA
    ai_score: number | null
    ai_decision: string | null
    ai_summary: string | null
    ai_strengths: string[] | null
    ai_weaknesses: string[] | null
    ai_missing_skills: string[] | null
    ai_recommendations: string | null
    ai_interview_score: number
    ai_analysis: any
    status: string
    // champs drawer
    applied_date: string
    availability_date: string | null
    job_title: string
    job_location: string
    job_contract_type: string
    cover_letter_url: string
    cv_file_url: string
    github_url: string
    communication_score: number
    clarification_score: number
    qcm_score: number
    coding_score: number | null
    interview_duration: number | null
    warnings_count: number
    has_video: boolean
    video_url: string | null
    completed_at: string | null
    invitation_status: string | null
    ai_interview_feedback: string | null
}

export interface AddEmployeeForm {
    full_name: string
    email: string
    phone: string
    position_title: string
    department: string
    start_date: string
    salary: string
    employee_id: string
    nationality: string
    current_location: string
}

export interface EmployeeDocForm {
    // Infos RH
    employee_id: string
    position_title: string
    department: string
    start_date: string
    // CIN
    cin_number: string
    cin_file: File | null
    // RIB
    rib_number: string
    rib_file: File | null
    // Autres
    contract_file: File | null
    photo_file: File | null
    diplomas_file: File | null
    criminal_record_file: File | null
    medical_file: File | null
}

// types.ts

export type NoteLevel = 'info' | 'warning' | 'urgent'

export interface RHNote {
    id:                  number
    date:                string
    content:             string
    level:               NoteLevel
    notify_at:           string | null
    linked_offer_title:  string | null
}

export interface RHNotification {
    type:    string
    title:   string
    message: string
    date:    string
    level:   'info' | 'warning' | 'success' | 'urgent'  // ← Propriété manquante
}

export interface WeekStats {
    new_applications:   number
    interviews_done:    number
    avg_score:          number
    active_offers:      number
    conversion_rate:    number
    trend_pct:          number
}

export interface OfferTimeline {
    id:         number
    title:      string
    contract:   string | null
    department: string | null
    deadline:   string | null
    days_left:  number | null
    is_expired: boolean
    stats: {
        total:       number
        screened:    number
        interviewed: number
        hired:       number
    }
    progress: number
    stage:    string
}

export interface AIInterviewCalendar {
    id:             number
    candidate_name: string
    job_title:      string
    scheduled_date: string
    scheduled_time: string | null
    status:         string
    score:          number | null
}

export type EventType = 'availability' | 'interview_ai' | 'note'

export interface DayEvent {
    id:        string
    type:      EventType
    label:     string
    time?:     string
    dotColor:  string
    bgColor:   string
    textColor: string
    avail?:    Availability
    interview?: AIInterviewCalendar
    note?:     RHNote
}

export interface DeleteTarget {
    type:  'availability'
    avail: Availability
}

export const NOTE_CFG: Record<NoteLevel, { bg: string; text: string; border: string; emoji: string }> = {
    info:    { bg: 'bg-blue-500/10',  text: 'text-blue-400',  border: 'border-blue-500/30',  emoji: '💬' },
    warning: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', emoji: '⚠️' },
    urgent:  { bg: 'bg-red-500/10',   text: 'text-red-400',   border: 'border-red-500/30',   emoji: '🔴' },
}

export const STAGE_CFG: Record<string, { label: string; color: string }> = {
    published:    { label: 'Publiée',      color: 'bg-slate-500'  },
    applications: { label: 'Candidatures', color: 'bg-blue-500'   },
    screening:    { label: 'Présélection', color: 'bg-purple-500' },
    interviews:   { label: 'Entretiens',   color: 'bg-amber-500'  },
    hired:        { label: 'Recruté ✓',    color: 'bg-emerald-500'},
}

export const NOTIF_CFG: Record<string, { bg: string; text: string; border: string }> = {
    warning: { bg: 'bg-amber-500/10',  text: 'text-amber-300',  border: 'border-amber-500/20'  },
    info:    { bg: 'bg-blue-500/10',   text: 'text-blue-300',   border: 'border-blue-500/20'   },
    success: { bg: 'bg-emerald-500/10',text: 'text-emerald-300',border: 'border-emerald-500/20'},
    urgent:  { bg: 'bg-red-500/10',    text: 'text-red-300',    border: 'border-red-500/20'    },
}