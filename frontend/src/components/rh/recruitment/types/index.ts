// types/index.ts

export type InvitationStatus = "sent" | "accepted" | "declined" | "cancelled" | null;
export type VerdictType = "HIGHLY_RECOMMENDED" | "RECOMMENDED" | "NEUTRAL";
export type FraudRisk = "LOW" | "MEDIUM" | "HIGH";
export type AiDecision = "VALIDATED" | "TO_REVIEW" | "REJECTED" | "PENDING";

export interface ScoreBreakdown {
    communication: number | null;
    cv_coherence: number | null;
    technical: number | null;
}

export interface AiAnalysis {
    verdict: VerdictType;
    verdict_label: string;
    fraud_risk: FraudRisk;
    fraud_label: string;
    overall_score: number;
    score_breakdown: ScoreBreakdown;
    strengths: string[];
    areas_to_explore: string[];
    recommendation: string;
    interview_feedback: string;
}

export interface QualifiedCandidate {
    // Identité
    application_id: number;
    full_name: string;
    email: string;
    phone: string | null;
    nationality: string | null;
    current_location: string | null;

    // Formation & Expérience
    university: string | null;
    degree_level: string | null;
    graduation_year: number | null;
    experience_years: number | null;

    // Liens
    linkedin_url: string | null;
    github_url: string | null;
    cv_file_url: string | null;
    cover_letter_url: string | null;

    // Infos pro
    salary_expectation: number | null;
    availability_date: string | null;
    applied_date: string;

    // Scores IA screening
    ai_score: number;
    ai_summary: string;
    ai_decision: AiDecision;
    ai_strengths: string[];
    ai_weaknesses: string[];
    ai_missing_skills: string[];
    ai_recommendations: string;

    // Entretien IA
    interview_id: number;
    interview_token: string;
    ai_interview_score: number;
    communication_score: number | null;
    clarification_score: number | null;
    qcm_score: number | null;
    coding_score: number | null;
    ai_interview_feedback: string;
    warnings_count: number;
    interview_duration: number | null;
    completed_at: string | null;

    // Vidéo
    has_video: boolean;
    video_url: string | null;

    // Offre
    job_offer_id: number;
    job_title: string;
    job_location: string;
    job_contract_type: string;

    // Analyse IA globale
    ai_analysis: AiAnalysis;

    // Invitation
    invitation_status: InvitationStatus;
    invitation_id: number | null;
    invitation_date: string | null;
}

export interface InviteFormData {
    application_id: number;
    interview_date: string;
    interview_time: string;
    meeting_link: string;
    interviewer_name: string;
    location?: string;
}

