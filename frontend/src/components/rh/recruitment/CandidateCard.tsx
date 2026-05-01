import { Eye, Send, TrendingUp, MapPin, Briefcase, GraduationCap, UserCheck } from "lucide-react";
import { QualifiedCandidate } from "./types";

interface Props {
    candidate: QualifiedCandidate;
    onView: (c: QualifiedCandidate) => void;
    onInvite: (c: QualifiedCandidate) => void;
    onHire: (c: QualifiedCandidate) => void;
}

export function CandidateCard({ candidate, onView, onInvite, onHire }: Props) {
    const score = candidate.ai_interview_score;
    const verdict = candidate.ai_analysis?.verdict;

    const getScoreColor = () => {
        if (score >= 85) return "text-emerald-400";
        if (score >= 75) return "text-cyan-400";
        if (score >= 70) return "text-amber-400";
        return "text-red-400";
    };

    const getVerdictBadge = () => {
        if (verdict === "HIGHLY_RECOMMENDED")
            return { label: "Top profil", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" };
        if (verdict === "RECOMMENDED")
            return { label: "Recommandé", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" };
        return { label: "Neutre", color: "bg-slate-500/20 text-slate-400 border-slate-500/30" };
    };

    const verdictBadge = getVerdictBadge();

    return (
        <div className="group bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden
                        hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10
                        transition-all duration-300">
            <div className="h-1 bg-gradient-to-r from-purple-600 to-blue-600"
                 style={{ width: `${score}%` }} />

            <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600
                                        flex items-center justify-center text-white font-bold text-lg">
                            {candidate.full_name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                            <h3 className="text-white font-semibold text-base leading-tight">
                                {candidate.full_name}
                            </h3>
                            <p className="text-slate-400 text-xs">{candidate.job_title}</p>
                        </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full border ${verdictBadge.color}`}>
                        {verdictBadge.label}
                    </span>
                </div>

                <div className="flex items-center justify-between mb-3 p-2 bg-slate-900/50 rounded-lg">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-purple-400" />
                        <span className="text-slate-400 text-xs">Score entretien IA</span>
                    </div>
                    <span className={`text-xl font-bold ${getScoreColor()}`}>{score}/100</span>
                </div>

                <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <GraduationCap className="w-3.5 h-3.5" />
                        <span className="truncate">{candidate.university || "Université non renseignée"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Briefcase className="w-3.5 h-3.5" />
                        <span>{candidate.experience_years || 0} ans d'expérience</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{candidate.current_location || "Localisation non renseignée"}</span>
                    </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-700">
                    <button
                        onClick={() => onView(candidate)}
                        className="flex-1 py-2 rounded-lg bg-slate-700/50 text-slate-300
                                   hover:bg-slate-700 transition-colors flex items-center
                                   justify-center gap-1.5 text-xs">
                        <Eye className="w-3.5 h-3.5" /> Profil
                    </button>
                    <button
                        onClick={() => onInvite(candidate)}
                        className="flex-1 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600
                                   text-white hover:shadow-lg transition-all flex items-center
                                   justify-center gap-1.5 text-xs">
                        <Send className="w-3.5 h-3.5" /> Inviter
                    </button>
                    <button
                        onClick={() => onHire(candidate)}
                        className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700
                                   text-white transition-all flex items-center
                                   justify-center gap-1.5 text-xs">
                        <UserCheck className="w-3.5 h-3.5" /> Recruter
                    </button>
                </div>
            </div>
        </div>
    );
}