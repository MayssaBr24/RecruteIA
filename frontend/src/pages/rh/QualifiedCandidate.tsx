import { useState, useMemo } from "react";
import { Search, Users, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { InviteModal } from "../../components/rh/recruitment/InviteModal.tsx";
import { CandidateCard } from "../../components/rh/recruitment/CandidateCard.tsx";
import { CandidateDrawer } from "../../components/rh/recruitment/CandidateDrawer.tsx";
import { useQualifiedCandidates } from "../../hooks/useQualifiedCandidates.ts";
import { useToast } from "../../hooks/use-toast.ts";
import type { QualifiedCandidate } from "../../components/rh/recruitment/types";
import api from "../../lib/api.ts";
import {HireConfirmModal} from "../../components/rh/Hire/HireConfirmModal.tsx";

interface ToastState { message: string; type: "success" | "error"; }

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
    const isOk = toast.type === "success";
    return (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-2 fade-in duration-300">
            <div className={`flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg border
                ${isOk
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
                <span className="text-lg">{isOk ? "✓" : "✕"}</span>
                <span className="text-sm font-medium">{toast.message}</span>
                <button onClick={onClose} className="ml-2 opacity-50 hover:opacity-100">
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

export default function QualifiedCandidatePage() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { candidates, loading, error, reload, markInvited, setCandidates } =
        useQualifiedCandidates();

    const [search, setSearch]           = useState("");
    const [offerFilter, setOfferFilter] = useState("all");
    const [sort, setSort]               = useState("score_desc");
    const [viewing, setViewing]         = useState<QualifiedCandidate | null>(null);
    const [inviting, setInviting]       = useState<QualifiedCandidate | null>(null);
    const [hiring, setHiring]           = useState<QualifiedCandidate | null>(null);
    const [localToast, setLocalToast]   = useState<ToastState | null>(null);

    const showLocalToast = (message: string, type: "success" | "error" = "success") => {
        setLocalToast({ message, type });
        setTimeout(() => setLocalToast(null), 3500);
    };

    // ── Recrutement ──────────────────────────────────────
    // ── Dans QualifiedCandidatePage.tsx ──────────────────────────
    const handleHireConfirm = async () => {
        if (!hiring) return
        try {
            await api.post(`/rh/applications/${hiring.application_id}/hire/`)

            // 1. Suppression immédiate de la liste locale
            setCandidates((prev) => prev.filter(c => c.application_id !== hiring.application_id));

            showLocalToast(`🎉 ${hiring.full_name} recruté`)
            setHiring(null)

            // 2. Navigation vers la page des employés
            navigate('/rh/employees')
        } catch {
            toast({
                title: 'Erreur',
                description: 'Impossible de recruter ce candidat.',
                variant: 'destructive'
            })
        }
    }

    // ── Filtres & tri ─────────────────────────────────────
    const offerOptions = useMemo(() => {
        const map = new Map<number, string>();
        candidates.forEach(c => {
            if (!map.has(c.job_offer_id)) map.set(c.job_offer_id, c.job_title);
        });
        return [
            { id: "all", title: "Toutes les offres" },
            ...Array.from(map.entries()).map(([id, title]) => ({ id: String(id), title }))
        ];
    }, [candidates]);

    const filtered = useMemo(() => {
        return candidates
            .filter(c => offerFilter === "all" || String(c.job_offer_id) === offerFilter)
            .filter(c => {
                if (!search) return true;
                const q = search.toLowerCase();
                return (
                    c.full_name?.toLowerCase().includes(q) ||
                    c.email?.toLowerCase().includes(q) ||
                    c.university?.toLowerCase().includes(q) ||
                    c.job_title?.toLowerCase().includes(q)
                );
            })
            .sort((a, b) => {
                switch (sort) {
                    case "score_desc": return (b.ai_interview_score ?? 0) - (a.ai_interview_score ?? 0);
                    case "score_asc":  return (a.ai_interview_score ?? 0) - (b.ai_interview_score ?? 0);
                    case "name":       return (a.full_name ?? "").localeCompare(b.full_name ?? "");
                    default: return 0;
                }
            });
    }, [candidates, search, offerFilter, sort]);

    const stats = useMemo(() => ({
        total:   candidates.length,
        top:     candidates.filter(c => c.ai_analysis?.verdict === "HIGHLY_RECOMMENDED").length,
        invited: candidates.filter(c => c.invitation_status === "sent").length,
        avg:     candidates.length
            ? Math.round(candidates.reduce((s, c) => s + (c.ai_interview_score ?? 0), 0) / candidates.length)
            : 0,
    }), [candidates]);

    const handleInviteSuccess = (applicationId: number) => {
        markInvited(applicationId);
        const name = candidates.find(c => c.application_id === applicationId)?.full_name ?? "";
        showLocalToast(`Invitation envoyée à ${name}`);
    };

    const openInviteFromDrawer = (c: QualifiedCandidate) => {
        setViewing(null);
        setTimeout(() => setInviting(c), 100);
    };

    return (
        <div className="p-4 md:p-6 space-y-6 md:space-y-8
                        bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 min-h-screen">

            {localToast && (
                <Toast toast={localToast} onClose={() => setLocalToast(null)} />
            )}

            {/* Header */}
            <div className="bg-slate-800/30 rounded-2xl border border-slate-700 overflow-hidden">
                <div className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-0.5 bg-purple-400 rounded-full" />
                                <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
                                    Recrutement
                                </span>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-bold text-white">
                                Candidats Qualifiés
                            </h1>
                            <p className="text-slate-400 text-sm mt-1">
                                Score entretien IA ≥ 70 — prêts pour l'entretien final
                            </p>
                        </div>

                        <div className="flex gap-3">
                            {[
                                { val: stats.total,   color: "text-white",        label: "Qualifiés"    },
                                { val: stats.top,     color: "text-amber-400",    label: "Top profils"  },
                                { val: stats.invited, color: "text-emerald-400",  label: "Invités"      },
                                { val: stats.avg,     color: "text-cyan-400",     label: "Score moyen"  },
                            ].map(s => (
                                <div key={s.label}
                                     className="bg-slate-900/50 rounded-xl px-4 py-2 text-center
                                                border border-slate-700">
                                    <div className={`text-2xl font-bold ${s.color}`}>{s.val}</div>
                                    <div className="text-xs text-slate-500">{s.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Filtres */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                className="w-full pl-9 pr-4 py-2 bg-slate-900/50 border border-slate-700
                                           rounded-xl text-white text-sm placeholder:text-slate-500
                                           focus:outline-none focus:border-purple-500 transition-colors"
                                placeholder="Rechercher par nom, email, université..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <select
                            className="px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-xl
                                       text-white text-sm focus:outline-none focus:border-purple-500"
                            value={offerFilter}
                            onChange={e => setOfferFilter(e.target.value)}>
                            {offerOptions.map(o => (
                                <option key={o.id} value={o.id}>{o.title}</option>
                            ))}
                        </select>
                        <select
                            className="px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-xl
                                       text-white text-sm focus:outline-none focus:border-purple-500"
                            value={sort}
                            onChange={e => setSort(e.target.value)}>
                            <option value="score_desc">Score ↓ décroissant</option>
                            <option value="score_asc">Score ↑ croissant</option>
                            <option value="name">Nom A → Z</option>
                        </select>
                        <div className="text-sm text-slate-500 flex items-center whitespace-nowrap">
                            {loading ? "Chargement..." : `${filtered.length} résultat${filtered.length !== 1 ? "s" : ""}`}
                        </div>
                    </div>
                </div>
            </div>

            {/* Grille candidats */}
            <div className="bg-slate-800/30 rounded-2xl border border-slate-700 overflow-hidden">
                <div className="p-6">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 mb-6">
                            <div className="flex items-center justify-between flex-wrap gap-4">
                                <div>
                                    <h3 className="text-red-400 font-semibold mb-1">Erreur de chargement</h3>
                                    <p className="text-slate-400 text-sm">{error}</p>
                                </div>
                                <button onClick={reload}
                                        className="px-4 py-2 rounded-lg bg-slate-700 text-white
                                                   text-sm hover:bg-slate-600 transition-colors">
                                    Réessayer
                                </button>
                            </div>
                        </div>
                    )}

                    {loading && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="bg-slate-800/50 rounded-xl border border-slate-700
                                                        p-4 animate-pulse">
                                    <div className="flex items-start gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-slate-700" />
                                        <div className="flex-1">
                                            <div className="h-4 bg-slate-700 rounded w-3/4 mb-2" />
                                            <div className="h-3 bg-slate-700 rounded w-1/2 mb-2" />
                                            <div className="h-3 bg-slate-700 rounded w-2/3" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {!loading && !error && filtered.length === 0 && (
                        <div className="text-center py-16">
                            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center
                                            justify-center mx-auto mb-4 border border-slate-700">
                                <Users className="w-8 h-8 text-slate-600" />
                            </div>
                            <h3 className="text-white font-semibold text-lg mb-2">
                                Aucun candidat trouvé
                            </h3>
                            <p className="text-slate-400 text-sm">
                                {search || offerFilter !== "all"
                                    ? "Essayez de modifier vos filtres ou votre recherche"
                                    : "Les candidats ayant passé l'entretien IA avec un score ≥ 70 apparaîtront ici"}
                            </p>
                        </div>
                    )}

                    {!loading && !error && filtered.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filtered.map(candidate => (
                                <CandidateCard
                                    key={candidate.application_id}
                                    candidate={candidate}
                                    onView={setViewing}
                                    onInvite={setInviting}
                                    onHire={setHiring}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Drawer */}
            {viewing && (
                <CandidateDrawer
                    candidate={viewing}
                    onClose={() => setViewing(null)}
                    onInvite={openInviteFromDrawer}
                />
            )}

            {/* Modal invitation */}
            {inviting && (
                <InviteModal
                    candidate={inviting}
                    onClose={() => setInviting(null)}
                    onSuccess={handleInviteSuccess}
                />
            )}

            {/* Modal confirmation recrutement */}
            {hiring && (
                <HireConfirmModal
                    candidateName={hiring.full_name}
                    onConfirm={handleHireConfirm}
                    onClose={() => setHiring(null)}
                />
            )}
        </div>
    );
}