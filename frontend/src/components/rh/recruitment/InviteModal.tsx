// src/components/rh/recruitment/InviteModal.tsx

import { useState } from "react";
import { InviteFormData, QualifiedCandidate } from "./types";
import { Spinner } from "./ui.tsx";
import { sendInvitation } from "../../../hooks/useQualifiedCandidates.ts";
import { Calendar, Clock, Video, MapPin, User, Send, X, CheckCircle } from "lucide-react";

interface Props {
    candidate: QualifiedCandidate;
    onClose: () => void;
    onSuccess: (applicationId: number) => void;
}

interface FormState {
    interview_date: string;
    interview_time: string;
    meeting_link: string;
    interviewer_name: string;
    mode: "online" | "onsite";
}

const INITIAL_FORM: FormState = {
    interview_date: "",
    interview_time: "",
    meeting_link: "",
    interviewer_name: "",
    mode: "online",
};

export function InviteModal({ candidate, onClose, onSuccess }: Props) {
    const [form, setForm] = useState<FormState>(INITIAL_FORM);
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState("");

    const upd = <K extends keyof FormState>(key: K, value: FormState[K]) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    const isValid =
        form.interview_date.trim() !== "" &&
        form.interview_time.trim() !== "" &&
        form.meeting_link.trim() !== "" &&
        form.interviewer_name.trim() !== "";

    const today = new Date().toISOString().split("T")[0];

    const handleSubmit = async () => {
        if (!isValid) return;
        setLoading(true);
        setError("");
        try {
            const payload: InviteFormData = {
                application_id: candidate.application_id,
                interview_date: form.interview_date,
                interview_time: form.interview_time,
                meeting_link: form.meeting_link,
                interviewer_name: form.interviewer_name,
                location: form.mode === "onsite" ? form.meeting_link : undefined,
            };
            await sendInvitation(payload);
            setDone(true);
            setTimeout(() => {
                onSuccess(candidate.application_id);
                onClose();
            }, 1800);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Une erreur est survenue");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="relative w-full max-w-2xl mx-4 animate-in fade-in zoom-in duration-200">
                {/* Modal Container */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl overflow-hidden border border-slate-700">

                    {/* Gold Accent Line */}
                    <div className="h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />

                    {/* Header */}
                    <div className="p-6 border-b border-slate-700">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                                        Entretien Final
                                    </span>
                                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                        Étape décisive
                                    </span>
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-1">
                                    Inviter {candidate.full_name}
                                </h2>
                                <p className="text-sm text-slate-400">
                                    {candidate.job_title} · {candidate.email}
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors flex items-center justify-center text-slate-400 hover:text-white border border-slate-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Body */}
                    {done ? (
                        /* Success State */
                        <div className="p-12 text-center">
                            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-5 border-2 border-emerald-500/50">
                                <CheckCircle className="w-10 h-10 text-emerald-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-emerald-400 mb-3">
                                Invitation envoyée !
                            </h3>
                            <p className="text-slate-300 text-base">
                                Un email a été envoyé à <strong className="text-white">{candidate.email}</strong>
                            </p>
                            <p className="text-slate-500 text-sm mt-2">
                                Le candidat recevra toutes les informations nécessaires
                            </p>
                        </div>
                    ) : (
                        /* Form */
                        <div className="p-6 space-y-5">
                            {/* Mode Toggle */}
                            <div className="bg-slate-800/50 rounded-xl p-1.5 flex gap-1 border border-slate-700">
                                {(["online", "onsite"] as const).map((m) => (
                                    <button
                                        key={m}
                                        onClick={() => upd("mode", m)}
                                        className={`
                                            flex-1 py-2.5 rounded-lg font-medium text-sm transition-all duration-200
                                            flex items-center justify-center gap-2
                                            ${form.mode === m
                                            ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                                        }
                                        `}
                                    >
                                        {m === "online" ? <Video className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                                        {m === "online" ? "Visioconférence" : "Présentiel"}
                                    </button>
                                ))}
                            </div>

                            {/* Date & Time Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-2">
                                        <Calendar className="w-3.5 h-3.5" />
                                        Date *
                                    </label>
                                    <input
                                        type="date"
                                        className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500 transition-colors"
                                        value={form.interview_date}
                                        min={today}
                                        onChange={(e) => upd("interview_date", e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-2">
                                        <Clock className="w-3.5 h-3.5" />
                                        Heure *
                                    </label>
                                    <input
                                        type="time"
                                        className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500 transition-colors"
                                        value={form.interview_time}
                                        onChange={(e) => upd("interview_time", e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Meeting Link / Location */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-2">
                                    {form.mode === "online" ? <Video className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                                    {form.mode === "online" ? "Lien de réunion *" : "Adresse / Lieu *"}
                                </label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500 transition-colors"
                                    value={form.meeting_link}
                                    placeholder={
                                        form.mode === "online"
                                            ? "https://meet.google.com/xyz-abc-def"
                                            : "10 Rue de la République, Tunis"
                                    }
                                    onChange={(e) => upd("meeting_link", e.target.value)}
                                />
                            </div>

                            {/* Interviewer Name */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-2">
                                    <User className="w-3.5 h-3.5" />
                                    Interviewer *
                                </label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500 transition-colors"
                                    value={form.interviewer_name}
                                    placeholder="Dr. Ahmed Mansouri, Directeur Technique"
                                    onChange={(e) => upd("interviewer_name", e.target.value)}
                                />
                            </div>

                            {/* Preview Card */}
                            {isValid && (
                                <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-xl p-4 border border-purple-500/20">
                                    <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-2">
                                        📋 Récapitulatif
                                    </p>
                                    <div className="space-y-1.5 text-sm">
                                        <p className="text-slate-300">
                                            <span className="text-slate-500">Candidat :</span> {candidate.full_name}
                                        </p>
                                        <p className="text-slate-300">
                                            <span className="text-slate-500">Date & heure :</span> {form.interview_date} à {form.interview_time}
                                        </p>
                                        <p className="text-slate-300">
                                            <span className="text-slate-500">Interviewer :</span> {form.interviewer_name}
                                        </p>
                                        <p className="text-slate-300">
                                            <span className="text-slate-500">{form.mode === "online" ? "Lien" : "Adresse"} :</span> {form.meeting_link}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Error Message */}
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                                    <p className="text-red-400 text-sm text-center">{error}</p>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-3">
                                <button
                                    onClick={onClose}
                                    className="flex-1 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors border border-slate-600"
                                >
                                    Annuler
                                </button>
                                <button
                                    disabled={loading || !isValid}
                                    onClick={handleSubmit}
                                    className={`
                                        flex-1 px-5 py-2.5 rounded-xl font-medium transition-all duration-200
                                        flex items-center justify-center gap-2
                                        ${isValid && !loading
                                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:shadow-lg hover:shadow-purple-500/25'
                                        : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                    }
                                    `}
                                >
                                    {loading ? (
                                        <>
                                            <Spinner size={18} color="#ffffff" />
                                            <span>Envoi en cours...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4" />
                                            <span>Envoyer l'invitation</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}