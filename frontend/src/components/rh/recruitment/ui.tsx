// components/ui.tsx
// Design tokens + shared atomic components

import React from "react";

// ── Tokens ────────────────────────────────────────────────────────────────────
export const C = {
    bg0:      "#06080e",
    bg1:      "#090d18",
    bg2:      "#0e1420",
    bg3:      "#131c2c",
    bg4:      "#182234",
    border:   "rgba(255,255,255,0.07)",
    borderHi: "rgba(255,255,255,0.14)",
    gold:     "#d4a843",
    goldDim:  "rgba(212,168,67,0.13)",
    cyan:     "#38bdf8",
    cyanDim:  "rgba(56,189,248,0.11)",
    green:    "#34d399",
    greenDim: "rgba(52,211,153,0.11)",
    rose:     "#f87171",
    roseDim:  "rgba(248,113,113,0.11)",
    amber:    "#fbbf24",
    amberDim: "rgba(251,191,36,0.11)",
    t1: "#e8edf5",
    t2: "#7d8fa8",
    t3: "#3d5068",
} as const;

export type Color = { label: string; color: string; bg: string };

export const VERDICT: Record<string, Color> = {
    HIGHLY_RECOMMENDED: { label: "Top profil",  color: C.gold,  bg: C.goldDim  },
    RECOMMENDED:        { label: "Recommandé",  color: C.cyan,  bg: C.cyanDim  },
    NEUTRAL:            { label: "À évaluer",   color: C.amber, bg: C.amberDim },
};
export const FRAUD: Record<string, Color> = {
    LOW:    { label: "Aucun risque",  color: C.green, bg: C.greenDim },
    MEDIUM: { label: "Risque modéré", color: C.amber, bg: C.amberDim },
    HIGH:   { label: "Risque élevé",  color: C.rose,  bg: C.roseDim  },
};
export const INV_STATUS: Record<string, Color> = {
    "null":    { label: "Non invité", color: C.t3,    bg: "rgba(61,80,104,0.18)" },
    "sent":    { label: "Invité ✓",   color: C.green, bg: C.greenDim },
    "accepted":{ label: "Accepté",   color: C.cyan,  bg: C.cyanDim  },
    "declined":{ label: "Refusé",    color: C.rose,  bg: C.roseDim  },
};

// ── Global CSS (inject once) ──────────────────────────────────────────────────
export const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.rq { font-family: 'Plus Jakarta Sans', sans-serif; color: ${C.t1}; }

@keyframes rq-in    { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
@keyframes rq-right { from{opacity:0;transform:translateX(24px)} to{opacity:1;transform:translateX(0)} }
@keyframes rq-pop   { from{opacity:0;transform:scale(.96)}       to{opacity:1;transform:scale(1)}      }
@keyframes rq-spin  { to{transform:rotate(360deg)} }
@keyframes rq-shim  {
  0%  { background-position: -600px 0 }
  100%{ background-position:  600px 0 }
}

.rq-card {
  background: ${C.bg2};
  border: 1px solid ${C.border};
  border-radius: 12px;
  transition: border-color .18s, transform .18s, box-shadow .18s;
}
.rq-card:hover {
  border-color: ${C.borderHi};
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(0,0,0,.35);
}

.rq-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  border: none; border-radius: 8px; cursor: pointer;
  font-family: inherit; font-size: 13px; font-weight: 600;
  padding: 8px 16px; transition: all .15s; white-space: nowrap;
}
.rq-btn-gold { background: ${C.gold}; color: #06080e; }
.rq-btn-gold:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(212,168,67,.35); }
.rq-btn-gold:disabled { opacity: .4; cursor: not-allowed; }

.rq-btn-ghost { background: transparent; border: 1px solid ${C.borderHi}; color: ${C.t2}; }
.rq-btn-ghost:hover { background: rgba(255,255,255,.05); color: ${C.t1}; }

.rq-input {
  width: 100%; padding: 9px 12px; border-radius: 8px;
  border: 1px solid ${C.border};
  background: ${C.bg3}; color: ${C.t1};
  font-family: inherit; font-size: 13px; outline: none;
  transition: border-color .15s;
}
.rq-input:focus   { border-color: ${C.gold}; }
.rq-input::placeholder { color: ${C.t3}; }

.rq-select {
  padding: 9px 30px 9px 12px; border-radius: 8px;
  border: 1px solid ${C.border};
  background: ${C.bg3}; color: ${C.t1};
  font-family: inherit; font-size: 13px; outline: none;
  cursor: pointer; appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 5 5-5' fill='none' stroke='%237d8fa8' stroke-width='1.4' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  transition: border-color .15s;
}
.rq-select:focus { border-color: ${C.gold}; }
.rq-select option { background: ${C.bg2}; }

.rq-tab {
  padding: 6px 14px; border-radius: 7px; border: none;
  background: transparent; color: ${C.t2};
  font-family: inherit; font-size: 12px; font-weight: 600;
  cursor: pointer; transition: all .15s;
}
.rq-tab.active  { background: ${C.goldDim}; color: ${C.gold}; }
.rq-tab:hover:not(.active) { background: rgba(255,255,255,.04); color: ${C.t1}; }

.rq-shim {
  background: linear-gradient(90deg, ${C.bg3} 0%, ${C.bg4} 50%, ${C.bg3} 100%);
  background-size: 600px 100%;
  animation: rq-shim 1.3s ease infinite;
  border-radius: 7px;
}

/* Drawer — overlays on top of page, NOT full-screen override */
.rq-backdrop {
  position: fixed; inset: 0;
  background: rgba(6,8,14,.78);
  backdrop-filter: blur(5px);
  z-index: 200;
}
.rq-drawer {
  position: fixed; top: 0; right: 0; bottom: 0;
  width: min(640px, 92vw);
  background: ${C.bg1};
  border-left: 1px solid ${C.border};
  overflow-y: auto; z-index: 201;
  animation: rq-right .28s cubic-bezier(.16,1,.3,1);
  box-shadow: -16px 0 48px rgba(0,0,0,.5);
}

/* Modal */
.rq-modal-wrap {
  position: fixed; inset: 0;
  background: rgba(6,8,14,.82);
  backdrop-filter: blur(6px);
  z-index: 300;
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
}
.rq-modal {
  background: ${C.bg2};
  border: 1px solid ${C.border};
  border-radius: 16px;
  width: min(480px, 100%);
  animation: rq-pop .22s ease;
  box-shadow: 0 24px 64px rgba(0,0,0,.6);
  overflow: hidden;
}

/* Toast */
.rq-toast {
  position: fixed; top: 20px; right: 20px; z-index: 500;
  padding: 12px 18px; border-radius: 10px;
  font-size: 13px; font-weight: 600;
  display: flex; align-items: center; gap: 8px;
  animation: rq-in .25s ease;
  box-shadow: 0 8px 24px rgba(0,0,0,.4);
  max-width: 340px;
}
`;

// ── Badge pill ────────────────────────────────────────────────────────────────
interface BadgeProps { label: string; color: string; bg: string; }
export function Badge({ label, color, bg }: BadgeProps) {
    return (
        <span style={{
            display: "inline-flex", alignItems: "center",
            background: bg, color,
            fontSize: 11, fontWeight: 600,
            padding: "2px 8px", borderRadius: 5,
            border: `1px solid ${color}22`,
            whiteSpace: "nowrap",
        }}>
      {label}
    </span>
    );
}

// ── Score ring ────────────────────────────────────────────────────────────────
interface ScoreRingProps { score: number | null; size?: number; color?: string; }
export function ScoreRing({ score, size = 56, color = C.gold }: ScoreRingProps) {
    const v  = score ?? 0;
    const sw = size > 60 ? 6 : 5;
    const r  = (size - sw) / 2;
    const ci = 2 * Math.PI * r;
    const d  = ci - (v / 100) * ci;
    return (
        <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
            <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
                <circle cx={size/2} cy={size/2} r={r} fill="none"
                        stroke="rgba(255,255,255,0.07)" strokeWidth={sw} />
                <circle cx={size/2} cy={size/2} r={r} fill="none"
                        stroke={color} strokeWidth={sw} strokeLinecap="round"
                        strokeDasharray={ci} strokeDashoffset={d}
                        style={{ transition: "stroke-dashoffset .7s ease" }}
                />
            </svg>
            <div style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
            }}>
        <span style={{ fontWeight: 800, fontSize: size > 60 ? 17 : 13, color, lineHeight: 1 }}>
          {score ?? "—"}
        </span>
                <span style={{ fontSize: 9, color: C.t3, marginTop: 1 }}>/100</span>
            </div>
        </div>
    );
}

// ── Progress bar ──────────────────────────────────────────────────────────────
interface BarProps { label: string; value: number | null; color?: string; }
export function Bar({ label, value, color = C.cyan }: BarProps) {
    return (
        <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 12, color: C.t2 }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>{value ?? "—"}</span>
            </div>
            <div style={{ height: 4, background: "rgba(255,255,255,.06)", borderRadius: 99 }}>
                <div style={{
                    height: "100%", width: `${value ?? 0}%`,
                    background: color, borderRadius: 99,
                    transition: "width .7s ease",
                }} />
            </div>
        </div>
    );
}

// ── Info row ──────────────────────────────────────────────────────────────────
interface InfoRowProps { label: string; value: string | number | null | undefined; }
export function InfoRow({ label, value }: InfoRowProps) {
    return (
        <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "flex-start",
            padding: "9px 0", borderBottom: `1px solid ${C.border}`,
            gap: 12,
        }}>
            <span style={{ fontSize: 12, color: C.t2, flexShrink: 0 }}>{label}</span>
            <span style={{ fontSize: 12, color: C.t1, fontWeight: 500, textAlign: "right" }}>
        {value !== null && value !== undefined && value !== "" ? String(value) : "—"}
      </span>
        </div>
    );
}

// ── Skeleton block ────────────────────────────────────────────────────────────
interface SkeletonProps { w?: string | number; h?: number; radius?: number; style?: React.CSSProperties; }
export function Skeleton({ w = "100%", h = 14, radius = 7, style }: SkeletonProps) {
    return (
        <div className="rq-shim" style={{ width: w, height: h, borderRadius: radius, ...style }} />
    );
}

// ── Section title inside drawer/modal ────────────────────────────────────────
interface SectionTitleProps { children: React.ReactNode; }
export function SectionTitle({ children }: SectionTitleProps) {
    return (
        <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
            textTransform: "uppercase", color: C.gold, marginBottom: 14,
        }}>
            {children}
        </div>
    );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
interface SpinnerProps { size?: number; color?: string; }
export function Spinner({ size = 16, color = "#06080e" }: SpinnerProps) {
    return (
        <span style={{
            display: "inline-block", width: size, height: size, borderRadius: "50%",
            border: `2px solid ${color}44`, borderTopColor: color,
            animation: "rq-spin .7s linear infinite", flexShrink: 0,
        }} />
    );
}