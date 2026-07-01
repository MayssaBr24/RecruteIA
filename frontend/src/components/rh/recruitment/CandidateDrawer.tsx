import {
    C, VERDICT, FRAUD, INV_STATUS,
    Badge, ScoreRing, Bar,
} from "./ui";
import { QualifiedCandidate } from "./types";
import { useState } from "react";
import {
    X, User, Mail, Phone, MapPin, Calendar, DollarSign,
    GraduationCap, Briefcase, Download,
    Video, Clock, AlertTriangle, CheckCircle, Award, TrendingUp,
    Send, Loader2, FileText
} from "lucide-react";
import { toast } from "../../../../hooks/use-toast.ts";
import api from "../../../lib/api.ts";
import html2pdf from 'html2pdf.js';
import {Button} from "../../../../components/ui/button.tsx";
import { useNavigate } from 'react-router-dom'

type Tab = "overview" | "profile" | "interview" | "video";

interface Props {
    candidate: QualifiedCandidate;
    onClose: () => void;
    onInvite: (c: QualifiedCandidate) => void;
}

export function CandidateDrawer({ candidate, onClose, onInvite }: Props) {
    const [tab, setTab] = useState<Tab>("overview");
    const [isDownloading, setIsDownloading] = useState(false);

    // Safely pull data
    const a = candidate.ai_analysis;
    const verdict = VERDICT[a?.verdict] ?? VERDICT.NEUTRAL;
    const fraud = FRAUD[a?.fraud_risk] ?? FRAUD.LOW;
    const inv = INV_STATUS[String(candidate.invitation_status)] ?? INV_STATUS["null"];

    const strengths = a?.strengths?.length ? a.strengths : candidate.ai_strengths;
    const areasToExplore = a?.areas_to_explore?.length ? a.areas_to_explore : candidate.ai_weaknesses;
    const recommendation = a?.recommendation || candidate.ai_summary || "Analyse non disponible.";
    const feedback = a?.interview_feedback || candidate.ai_interview_feedback || "";
    const navigate = useNavigate()


    const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: "overview", label: "Analyse IA", icon: <TrendingUp className="w-4 h-4" /> },
        { id: "profile", label: "Profil", icon: <User className="w-4 h-4" /> },
        { id: "interview", label: "Entretien", icon: <Briefcase className="w-4 h-4" /> },
        { id: "video", label: "Vidéo", icon: <Video className="w-4 h-4" /> },
    ];

    // Fonction pour générer le HTML du rapport
    const generateReportHTML = (data: any) => {
        const score = data.ai_score ?? candidate.ai_score ?? 0;
        const color = score >= 80 ? '#10b981' : score >= 60 ? '#818cf8' : score >= 40 ? '#f59e0b' : '#ef4444';

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Rapport IA - ${data.full_name || candidate.full_name}</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    body {
                        font-family: 'Helvetica Neue', Arial, sans-serif;
                        background: #0f172a;
                        padding: 40px;
                        color: #e2e8f0;
                    }
                    .container {
                        max-width: 1000px;
                        margin: 0 auto;
                        background: #1e293b;
                        border-radius: 16px;
                        padding: 40px;
                        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                    }
                    h1 {
                        font-size: 28px;
                        font-weight: bold;
                        color: white;
                        margin-bottom: 8px;
                    }
                    h2 {
                        font-size: 20px;
                        font-weight: 600;
                        color: #a78bfa;
                        margin-top: 24px;
                        margin-bottom: 16px;
                        border-bottom: 2px solid #334155;
                        padding-bottom: 8px;
                    }
                    h3 {
                        font-size: 16px;
                        font-weight: 600;
                        color: #cbd5e1;
                        margin-top: 16px;
                        margin-bottom: 8px;
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        border-bottom: 2px solid #334155;
                        padding-bottom: 20px;
                        margin-bottom: 24px;
                    }
                    .score-circle {
                        text-align: center;
                    }
                    .score-value {
                        font-size: 48px;
                        font-weight: bold;
                        color: ${color};
                    }
                    .score-label {
                        font-size: 12px;
                        color: #94a3b8;
                        margin-top: 4px;
                    }
                    .badge {
                        display: inline-block;
                        padding: 4px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                        font-weight: 500;
                        margin-top: 8px;
                    }
                    .badge-success { background: #10b98120; color: #10b981; border: 1px solid #10b98140; }
                    .badge-warning { background: #f59e0b20; color: #f59e0b; border: 1px solid #f59e0b40; }
                    .badge-info { background: #3b82f620; color: #60a5fa; border: 1px solid #3b82f640; }
                    .section {
                        background: #0f172a;
                        border-radius: 12px;
                        padding: 20px;
                        margin-bottom: 20px;
                    }
                    .strength-item, .weakness-item {
                        padding: 8px 0;
                        border-bottom: 1px solid #334155;
                    }
                    .strength-item:last-child, .weakness-item:last-child {
                        border-bottom: none;
                    }
                    .skill-tag {
                        display: inline-block;
                        background: #ef444420;
                        color: #f87171;
                        padding: 4px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                        margin: 4px 4px 0 0;
                    }
                    .footer {
                        margin-top: 32px;
                        padding-top: 16px;
                        border-top: 1px solid #334155;
                        text-align: center;
                        font-size: 11px;
                        color: #64748b;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div>
                            <h1>${data.full_name || candidate.full_name}</h1>
                            <p style="color: #a78bfa; margin-top: 4px;">${data.job_offer_title || candidate.job_title}</p>
                            <p style="color: #64748b; font-size: 12px; margin-top: 8px;">
                                Analysé le ${new Date(data.applied_date || candidate.applied_date).toLocaleDateString('fr-FR')}
                            </p>
                        </div>
                        <div class="score-circle">
                            <div class="score-value">${score}/100</div>
                            <div class="score-label">Score IA</div>
                        </div>
                    </div>

                    ${data.ai_summary || candidate.ai_summary ? `
                        <div class="section">
                            <h2>📋 Résumé du profil</h2>
                            <p style="line-height: 1.6;">${data.ai_summary || candidate.ai_summary}</p>
                        </div>
                    ` : ''}

                    <div class="section">
                        <h2>💪 Points forts</h2>
                        ${(data.ai_strengths || strengths || []).map((s: string) => `
                            <div class="strength-item">✓ ${s}</div>
                        `).join('')}
                    </div>

                    <div class="section">
                        <h2>⚠️ Points d'amélioration</h2>
                        ${(data.ai_weaknesses || areasToExplore || []).map((w: string) => `
                            <div class="weakness-item">• ${w}</div>
                        `).join('')}
                    </div>

                    ${(data.ai_missing_skills || candidate.ai_missing_skills || []).length > 0 ? `
                        <div class="section">
                            <h2>🎯 Compétences manquantes</h2>
                            <div>
                                ${(data.ai_missing_skills || candidate.ai_missing_skills || []).map((s: string) => `
                                    <span class="skill-tag">${s}</span>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    <div class="section">
                        <h2>🎯 Recommandation IA</h2>
                        <p style="line-height: 1.6;">${data.ai_recommendations || candidate.ai_recommendations || recommendation}</p>
                    </div>

                    <div class="footer">
                        Rapport généré automatiquement par l'IA — à titre indicatif uniquement
                    </div>
                </div>
            </body>
            </html>
        `;
    };

    const handleDownloadReport = async () => {
        setIsDownloading(true);
        try {
            // Récupérer les données du rapport
            const res = await api.get(`/rh/applications/${candidate.application_id}/ai-report/`);
            const reportData = res.data;

            // Générer le HTML
            const html = generateReportHTML(reportData);

            // Créer un élément temporaire pour le PDF
            const element = document.createElement('div');
            element.innerHTML = html;
            document.body.appendChild(element);

            // Générer le PDF
            const opt = {
                margin: [0.5, 0.5, 0.5, 0.5],
                filename: `rapport-ia-${candidate.full_name.replace(/ /g, '-')}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, backgroundColor: '#0f172a' },
                jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
            };

            await html2pdf().set(opt).from(element).save();

            // Nettoyer
            document.body.removeChild(element);

            toast({
                title: 'Succès',
                description: 'Le rapport a été téléchargé avec succès.',
                variant: 'default'
            });
        } catch (error) {
            console.error("Erreur:", error);
            toast({
                title: 'Erreur',
                description: 'Impossible de générer le rapport.',
                variant: 'destructive'
            });
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 transition-all duration-300"
                onClick={onClose}
            />

            {/* Drawer panel */}
            <div className="fixed right-0 top-0 h-full w-full max-w-3xl bg-gradient-to-b from-slate-900 to-slate-800 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">

                {/* Gold accent line */}
                <div className="h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />

                {/* Sticky header */}
                <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700">
                    <div className="p-6">
                        {/* Top row: avatar + info + close */}
                        <div className="flex gap-4 items-start mb-5">
                            <div
                                className="w-16 h-16 rounded-xl flex-shrink-0 flex items-center justify-center"
                                style={{
                                    background: `${verdict.color}15`,
                                    border: `2px solid ${verdict.color}40`,
                                }}
                            >
                                <span className="font-bold text-2xl" style={{ color: verdict.color }}>
                                    {candidate.full_name?.charAt(0)?.toUpperCase() ?? "?"}
                                </span>
                            </div>

                            <div className="flex-1 min-w-0">
                                <h2 className="text-xl font-bold text-white mb-1">
                                    {candidate.full_name}
                                </h2>
                                <p className="text-sm text-slate-400">{candidate.email}</p>
                                {candidate.phone && (
                                    <p className="text-sm text-slate-400">{candidate.phone}</p>
                                )}
                                <p className="text-sm text-purple-400 mt-1">{candidate.job_title}</p>
                            </div>

                            <button
                                onClick={onClose}
                                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors flex items-center justify-center text-slate-400 hover:text-white border border-slate-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Score chips */}
                        <div className="flex flex-wrap gap-3 mb-5">
                            <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                <ScoreRing score={candidate.ai_interview_score} size={40} color={C.gold} />
                                <div>
                                    <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                                        Entretien IA
                                    </div>
                                    <div className="text-lg font-bold text-white">
                                        {candidate.ai_interview_score}/100
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                                <ScoreRing score={candidate.ai_score} size={40} color={C.cyan} />
                                <div>
                                    <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                                        Score Global
                                    </div>
                                    <div className="text-lg font-bold text-white">
                                        {candidate.ai_score}/100
                                    </div>
                                </div>
                            </div>

                            <Badge label={verdict.label} color={verdict.color} bg={verdict.bg} />
                            <Badge label={fraud.label} color={fraud.color} bg={fraud.bg} />
                            <Badge label={inv.label} color={inv.color} bg={inv.bg} />
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-1 bg-slate-800/50 rounded-xl p-1">
                            {TABS.map(({ id, label, icon }) => (
                                <button
                                    key={id}
                                    onClick={() => setTab(id)}
                                    className={`
                                        flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm transition-all duration-200
                                        ${tab === id
                                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                                    }
                                    `}
                                >
                                    {icon}
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {/* ── OVERVIEW TAB ── */}
                    {tab === "overview" && (
                        <div className="space-y-5 animate-in fade-in duration-200">
                            {/* Recommendation Card */}
                            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5">
                                <div className="flex items-center gap-2 mb-3">
                                    <Award className="w-5 h-5 text-purple-400" />
                                    <h3 className="font-semibold text-white">Avis de l'IA</h3>
                                </div>
                                <p className="text-slate-300 text-sm leading-relaxed mb-4">
                                    {recommendation}
                                </p>

                                {/* BOUTON TÉLÉCHARGER RAPPORT IA */}
                                <button
                                    onClick={handleDownloadReport}
                                    disabled={isDownloading}
                                    className="flex items-center justify-center gap-2 w-full mb-4 px-4 py-2.5 rounded-xl
                                             bg-gradient-to-r from-indigo-600 to-purple-600
                                             hover:from-indigo-700 hover:to-purple-700
                                             text-white text-sm font-medium transition-all duration-300
                                             shadow-lg hover:shadow-indigo-500/25
                                             disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isDownloading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Génération du rapport...
                                        </>
                                    ) : (
                                        <>
                                            <Download className="w-4 h-4" />
                                            Télécharger le rapport complet de l'IA (PDF)
                                        </>
                                    )}
                                </button>

                                <div className="space-y-3">
                                    <Bar label="Communication" value={a?.score_breakdown?.communication} color={C.gold} />
                                    <Bar label="Cohérence CV" value={a?.score_breakdown?.cv_coherence} color={C.cyan} />
                                    <Bar label="Technique" value={a?.score_breakdown?.technical} color={C.green} />
                                </div>
                            </div>

                            {/* Strengths / Areas Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="bg-emerald-500/5 rounded-xl border border-emerald-500/20 p-5">
                                    <div className="flex items-center gap-2 mb-3">
                                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                                        <h3 className="font-semibold text-emerald-400">Points forts</h3>
                                    </div>
                                    {strengths && strengths.length > 0 ? (
                                        <ul className="space-y-2">
                                            {strengths.slice(0, 5).map((s, i) => (
                                                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                                                    <span className="text-emerald-400 mt-0.5">•</span>
                                                    <span>{s}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-slate-500 text-sm">Aucun point signalé</p>
                                    )}
                                </div>

                                <div className="bg-amber-500/5 rounded-xl border border-amber-500/20 p-5">
                                    <div className="flex items-center gap-2 mb-3">
                                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                                        <h3 className="font-semibold text-amber-400">À explorer</h3>
                                    </div>
                                    {areasToExplore && areasToExplore.length > 0 ? (
                                        <ul className="space-y-2">
                                            {areasToExplore.slice(0, 5).map((s, i) => (
                                                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                                                    <span className="text-amber-400 mt-0.5">•</span>
                                                    <span>{s}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-slate-500 text-sm">Aucun point à signaler</p>
                                    )}
                                </div>
                            </div>

                            {feedback && (
                                <div className="bg-cyan-500/5 rounded-xl border-l-4 border-cyan-400 p-5">
                                    <div className="flex items-center gap-2 mb-2">
                                        <MessageSquare className="w-5 h-5 text-cyan-400" />
                                        <h3 className="font-semibold text-cyan-400">Feedback entretien</h3>
                                    </div>
                                    <p className="text-slate-300 text-sm leading-relaxed">{feedback}</p>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            const token = candidate.interview?.token ?? (candidate as any).interview_token;
                                            if (token) {
                                                navigate(`/rh/interviews/${token}/report`);
                                            } else {
                                                toast({
                                                    title: 'Erreur',
                                                    description: 'Rapport indisponible pour cet entretien.',
                                                    variant: 'destructive'
                                                });
                                            }
                                        }}                                        className="border-slate-600 text-slate-300 hover:bg-slate-700 shrink-0"
                                    >
                                        <FileText className="w-4 h-4 mr-1" />
                                        Rapport
                                    </Button>
                                </div>

                            )}

                            {candidate.ai_missing_skills && candidate.ai_missing_skills.length > 0 && (
                                <div className="bg-red-500/5 rounded-xl border border-red-500/20 p-5">
                                    <div className="flex items-center gap-2 mb-3">
                                        <AlertTriangle className="w-5 h-5 text-red-400" />
                                        <h3 className="font-semibold text-red-400">Compétences manquantes</h3>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {candidate.ai_missing_skills.map((s, i) => (
                                            <span key={i} className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-sm border border-red-500/20">
                                                {s}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={() => onInvite(candidate)}
                                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold hover:shadow-lg hover:shadow-purple-500/25 transition-all flex items-center justify-center gap-2"
                            >
                                <Send className="w-5 h-5" />
                                Inviter à l'entretien final
                            </button>
                        </div>
                    )}

                    {/* ── PROFILE TAB ── */}
                    {tab === "profile" && (
                        <div className="space-y-5 animate-in fade-in duration-200">
                            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <User className="w-5 h-5 text-purple-400" />
                                    <h3 className="font-semibold text-white">Informations personnelles</h3>
                                </div>
                                <div className="space-y-3">
                                    <InfoRow icon={<User className="w-4 h-4" />} label="Nom complet" value={candidate.full_name} />
                                    <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={candidate.email} />
                                    <InfoRow icon={<Phone className="w-4 h-4" />} label="Téléphone" value={candidate.phone || "Non renseigné"} />
                                    <InfoRow icon={<MapPin className="w-4 h-4" />} label="Nationalité" value={candidate.nationality || "Non renseignée"} />
                                    <InfoRow icon={<MapPin className="w-4 h-4" />} label="Localisation" value={candidate.current_location || "Non renseignée"} />
                                    <InfoRow icon={<Calendar className="w-4 h-4" />} label="Date de disponibilité" value={candidate.availability_date || "Non renseignée"} />
                                    <InfoRow icon={<DollarSign className="w-4 h-4" />} label="Prétention salariale"
                                             value={candidate.salary_expectation ? `${candidate.salary_expectation} TND / mois` : "Non renseignée"} />
                                    <InfoRow icon={<Calendar className="w-4 h-4" />} label="Date de candidature"
                                             value={candidate.applied_date ? new Date(candidate.applied_date).toLocaleDateString("fr-FR") : "Non renseignée"} />
                                </div>
                            </div>

                            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <GraduationCap className="w-5 h-5 text-purple-400" />
                                    <h3 className="font-semibold text-white">Formation & Études</h3>
                                </div>
                                <div className="space-y-3">
                                    <InfoRow icon={<GraduationCap className="w-4 h-4" />} label="Établissement" value={candidate.university || "Non renseigné"} />
                                    <InfoRow icon={<GraduationCap className="w-4 h-4" />} label="Diplôme" value={candidate.degree_level || "Non renseigné"} />
                                    <InfoRow icon={<Calendar className="w-4 h-4" />} label="Année d'obtention" value={candidate.graduation_year ? String(candidate.graduation_year) : "Non renseignée"} />
                                    <InfoRow icon={<Briefcase className="w-4 h-4" />} label="Expérience" value={candidate.experience_years != null ? `${candidate.experience_years} an(s)` : "Non renseigné"} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── INTERVIEW TAB ── */}
                    {tab === "interview" && (
                        <div className="space-y-5 animate-in fade-in duration-200">
                            <div className="flex justify-center py-6">
                                <ScoreRing score={candidate.ai_interview_score} size={120} color={C.gold} />
                            </div>

                            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5">
                                <h3 className="font-semibold text-white mb-4">Scores par phase</h3>
                                <div className="space-y-4">
                                    <Bar label="Communication" value={candidate.communication_score} color={C.gold} />
                                    <Bar label="Clarification CV" value={candidate.clarification_score} color={C.cyan} />
                                    <Bar label="QCM Technique" value={candidate.qcm_score} color={C.green} />
                                    {candidate.coding_score != null && (
                                        <Bar label="Exercice Coding" value={candidate.coding_score} color={C.amber} />
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 text-center">
                                    <Clock className="w-5 h-5 text-purple-400 mx-auto mb-2" />
                                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Durée</div>
                                    <div className="text-lg font-bold text-white">
                                        {candidate.interview_duration != null ? `${candidate.interview_duration} min` : "—"}
                                    </div>
                                </div>
                                <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 text-center">
                                    <AlertTriangle className="w-5 h-5 text-amber-400 mx-auto mb-2" />
                                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Avertissements</div>
                                    <div className="text-lg font-bold text-white">
                                        {candidate.warnings_count === 0 ? "Aucun" : candidate.warnings_count}
                                    </div>
                                </div>
                                <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 text-center">
                                    <AlertTriangle className="w-5 h-5 text-red-400 mx-auto mb-2" />
                                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Risque fraude</div>
                                    <div className="text-sm font-semibold" style={{ color: fraud.color }}>{fraud.label}</div>
                                </div>
                            </div>

                            {feedback && (
                                <div className="bg-cyan-500/5 rounded-xl border-l-4 border-cyan-400 p-5">
                                    <h3 className="font-semibold text-cyan-400 mb-2">Feedback final</h3>
                                    <p className="text-slate-300 text-sm leading-relaxed">{feedback}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── VIDEO TAB ── */}
                    {tab === "video" && (
                        <div className="animate-in fade-in duration-200">
                            {candidate.has_video && candidate.video_url ? (
                                <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Video className="w-5 h-5 text-purple-400" />
                                        <h3 className="font-semibold text-white">Enregistrement de l'entretien</h3>
                                    </div>
                                    <div className="bg-black rounded-xl overflow-hidden aspect-video border border-slate-600">
                                        <video controls className="w-full h-full object-contain">
                                            <source src={candidate.video_url} />
                                            Votre navigateur ne supporte pas la lecture vidéo.
                                        </video>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-12 text-center">
                                    <Video className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                                    <h3 className="text-lg font-semibold text-white mb-2">Aucune vidéo disponible</h3>
                                    <p className="text-slate-400">Le candidat n'a pas fourni d'enregistrement vidéo</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

// Composant InfoRow
function InfoRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string | number | null | undefined }) {
    if (!value) return null;
    return (
        <div className="flex items-center gap-3 text-sm">
            {icon && <span className="text-slate-500 w-5">{icon}</span>}
            <span className="text-slate-400 w-32">{label}</span>
            <span className="text-white flex-1">{value}</span>
        </div>
    );
}

// Icône MessageSquare
function MessageSquare(props: any) {
    return (
        <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
    );
}