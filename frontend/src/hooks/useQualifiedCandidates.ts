import { useState, useEffect, useCallback } from "react";
import { QualifiedCandidate} from "../components/rh/recruitment/types";
import {InvitePayload} from "../components/rh/recruitment/types/recruitment.ts";

const BASE = import.meta.env.VITE_API_BASE_URL + "/api/recruitment";

function token(): string {
    return localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token") ?? "";
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const r = await fetch(`${BASE}${path}`, {
        ...init,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}`, "ngrok-skip-browser-warning": "true", ...(init.headers ?? {}) },
    });
    if (!r.ok) {
        const b = await r.json().catch(() => ({})) as Record<string, string>;
        throw new Error(b.error ?? b.detail ?? `HTTP ${r.status}`);
    }
    return r.json();
}

export function useQualifiedCandidates() {
    const [candidates, setCandidates] = useState<QualifiedCandidate[]>([]);
    const [loading,    setLoading]    = useState(true);
    const [error,      setError]      = useState("");

    const load = useCallback(async () => {
        setLoading(true); setError("");
        try {
            const d = await api<{ results?: QualifiedCandidate[] } | QualifiedCandidate[]>("/rh/qualified-candidates/");
            setCandidates(Array.isArray(d) ? d : (d.results ?? []));
        } catch (e) {
            setError(e instanceof Error ? e.message : "Erreur inconnue");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const markInvited = (id: number) =>
        setCandidates(p => p.map(c => c.application_id === id ? { ...c, invitation_status: "sent" as const } : c));

    return { candidates, loading, error, reload: load, markInvited, setCandidates };}

export async function sendInvitation(payload: InvitePayload): Promise<void> {
    await api("/rh/send-invitation/", { method: "POST", body: JSON.stringify(payload) });
}