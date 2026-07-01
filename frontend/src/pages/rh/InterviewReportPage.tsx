import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {ReportData} from "../../types/types.ts";
import {fetchReport} from "../../lib/api.ts";
import {ScoresSection} from "../../components/rh/interviewReport/ScoresSection.tsx";
import {TranscriptSection} from "../../components/rh/interviewReport/TranscriptSection.tsx";
import {VoiceSection} from "../../components/rh/interviewReport/VoiceSection.tsx";
import {SecuritySection} from "../../components/rh/interviewReport/SecuritySection.tsx";
import {QCMSection} from "../../components/rh/interviewReport/QCMSection.tsx";
import {ProfileSection} from "../../components/rh/interviewReport/ProfileSection.tsx";
import {RecoSection} from "../../components/rh/interviewReport/RecoSection.tsx";
import {SummarySection} from "../../components/rh/interviewReport/SummarySection.tsx";

// ── Navigation config ─────────────────────────────────────────────────────────
const NAV = [
    { id: 'summary',    label: 'Résumé',        icon: '◈' },
    { id: 'scores',     label: 'Scores',         icon: '◉' },
    { id: 'transcript', label: 'Transcription',  icon: '◎' },
    { id: 'voice',      label: 'Vocal',          icon: '◐' },
    { id: 'security',   label: 'Sécurité',       icon: '◧' },
    { id: 'qcm',        label: 'QCM',            icon: '◫' },
    { id: 'profile',    label: 'Profil',         icon: '◍' },
    { id: 'reco',       label: 'Recommandation', icon: '●' },
] as const

type SectionId = (typeof NAV)[number]['id']

// ── Print helper ──────────────────────────────────────────────────────────────
function buildPrintHtml(content: HTMLElement, candidateName: string): string {
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map((el) => {
            if (el.tagName === 'LINK') {
                const href = (el as HTMLLinkElement).href
                return href ? `<link rel="stylesheet" href="${href}">` : ''
            }
            return (el as HTMLStyleElement).outerHTML
        })
        .join('')

    // Strip rgba backgrounds so browsers print them on white paper
    const clone = content.cloneNode(true) as HTMLElement
    clone.querySelectorAll<HTMLElement>('[style*="background"]').forEach((el) => {
        const s = el.getAttribute('style') ?? ''
        el.setAttribute(
            'style',
            s.replace(/rgba\(([0-9]+),\s*([0-9]+),\s*([0-9]+),\s*[0-9.]+\)/g, 'rgb($1,$2,$3)'),
        )
    })

    return `<!DOCTYPE html>
<html>
<head>
  <title>Rapport entretien — ${candidateName}</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  ${styles}
  <style>
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
    @page{size:A4;margin:1.5cm}
    @media print{
      body{background:white!important;margin:0!important;padding:0!important}
      .no-print{display:none!important}
      body,div,p,span,h1,h2,h3,h4,h5,h6,td,th{color:#1e293b!important}
      div,section,article{background-color:white!important}
      [style*="border"]{border-color:#cbd5e1!important}
      [style*="color:#4ade80"]{color:#059669!important}
      [style*="color:#fbbf24"]{color:#d97706!important}
      [style*="color:#f87171"]{color:#dc2626!important}
      [style*="color:#fb923c"]{color:#ea580c!important}
      [style*="color:#818cf8"]{color:#4f46e5!important}
      [style*="color:#34d399"]{color:#059669!important}
      [style*="color:#60a5fa"]{color:#2563eb!important}
      [style*="color:#a78bfa"]{color:#7c3aed!important}
      section{break-inside:avoid;page-break-inside:avoid}
      [style*="border-radius"]{border:1px solid #e2e8f0!important;box-shadow:none!important}
      td,th{color:#1e293b!important}
      [style*="color:rgba(255,255,255"]{color:#1e293b!important}
      [style*="color: rgba(255,255,255"]{color:#1e293b!important}
      [style*="color:#ffffff"]{color:#1e293b!important}
      [style*="color: #ffffff"]{color:#1e293b!important}
    }
  </style>
</head>
<body style="background:white;margin:0;padding:20px;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:960px;margin:0 auto;">${clone.outerHTML}</div>
  <script>
    window.onload=()=>{setTimeout(()=>{window.print();window.onafterprint=()=>window.close()},500)}
  </script>
</body>
</html>`
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function InterviewReportPage() {
    const { token } = useParams<{ token: string }>()

    const [report,        setReport]        = useState<ReportData | null>(null)
    const [loading,       setLoading]       = useState(true)
    const [error,         setError]         = useState('')
    const [activeSection, setActiveSection] = useState<SectionId>('summary')

    const printRef = useRef<HTMLDivElement>(null)

    // ── Fetch report (single effect, no duplicate) ────────────────────────────
    useEffect(() => {
        if (!token) return
        setLoading(true)
        fetchReport(token)
            .then(setReport)
            .catch((e: Error) => setError(e.message))
            .finally(() => setLoading(false))
    }, [token])

    // ── Track active section via IntersectionObserver ─────────────────────────
    useEffect(() => {
        const observers: IntersectionObserver[] = []

        NAV.forEach(({ id }) => {
            const el = document.getElementById(id)
            if (!el) return
            const obs = new IntersectionObserver(
                ([entry]) => { if (entry.isIntersecting) setActiveSection(id) },
                { rootMargin: '-20% 0px -70% 0px' },
            )
            obs.observe(el)
            observers.push(obs)
        })

        return () => observers.forEach((o) => o.disconnect())
    }, [report]) // re-run once the report DOM is rendered

    // ── Print / PDF export ────────────────────────────────────────────────────
    const handlePrint = useCallback(() => {
        if (!printRef.current) {
            console.error('Print ref not attached.')
            return
        }
        const win = window.open('', '_blank')
        if (!win) {
            alert('Veuillez autoriser les popups pour exporter le PDF')
            return
        }
        win.document.write(
            buildPrintHtml(printRef.current, report?.candidate?.full_name ?? 'Candidat'),
        )
        win.document.close()
    }, [report])

    // ── Loading state ─────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div
                style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#080b12',
                    color: 'rgba(255,255,255,0.4)',
                    fontFamily: 'DM Mono, monospace',
                    fontSize: 13,
                }}
            >
                <div style={{ textAlign: 'center' }}>
                    <div
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            border: '2px solid rgba(251,191,36,0.2)',
                            borderTopColor: '#fbbf24',
                            animation: 'spin 0.8s linear infinite',
                            margin: '0 auto 16px',
                        }}
                    />
                    Génération du rapport…
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        )
    }

    // ── Error state ───────────────────────────────────────────────────────────
    if (error || !report) {
        return (
            <div
                style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#080b12',
                    color: '#f87171',
                    fontFamily: 'DM Mono, monospace',
                }}
            >
                Rapport introuvable — {error}
            </div>
        )
    }

    const {
        scores,
        score_breakdown,
        transcript_phases,
        voice_analysis,
        security_warnings,
        qcm_detail,
        profile_inconsistencies,
        recommendation,
    } = report

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div
            style={{
                minHeight: '100vh',
                background: 'transparent',
                color: '#e2e8f0',
                fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
            }}
        >
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        ::selection { background: rgba(251,191,36,0.2); }
        nav { scrollbar-width: none; }
        nav::-webkit-scrollbar { display: none; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          section { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

            {/* ── Sticky header ────────────────────────────────────────────────── */}
            <header
                className="no-print"
                style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 100,
                    background: 'rgba(13,17,28,0.7)',
                    backdropFilter: 'blur(12px)',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    padding: '0 24px',
                    width: '100%',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', height: 64 }}>
                    {/* Back link */}
                    <a
                        href="/rh/interviews"
                        style={{
                            color: 'rgba(255,255,255,0.5)',
                            fontSize: 13,
                            textDecoration: 'none',
                            marginRight: 32,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontWeight: 500,
                        }}
                    >
                        <span style={{ fontSize: 18 }}>←</span> Retour
                    </a>

                    {/* Section navigation */}
                    <nav style={{ display: 'flex', gap: 8, flex: 1, overflowX: 'auto' }}>
                        {NAV.map((n) => {
                            const isActive = activeSection === n.id
                            return (
                                <a
                                    key={n.id}
                                    href={`#${n.id}`}
                                    onClick={() => setActiveSection(n.id)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        padding: '8px 16px',
                                        borderRadius: 8,
                                        fontSize: 12,
                                        fontWeight: 600,
                                        textDecoration: 'none',
                                        whiteSpace: 'nowrap',
                                        transition: 'all 0.2s ease',
                                        color:      isActive ? '#fbbf24' : 'rgba(255,255,255,0.45)',
                                        background: isActive ? 'rgba(251,191,36,0.1)' : 'transparent',
                                        border:     isActive ? '1px solid rgba(251,191,36,0.2)' : '1px solid transparent',
                                    }}
                                >
                                    <span style={{ opacity: 0.8 }}>{n.icon}</span>
                                    {n.label}
                                </a>
                            )
                        })}
                    </nav>

                    {/* PDF export button */}
                    <button
                        onClick={handlePrint}
                        style={{
                            marginLeft: 24,
                            padding: '8px 20px',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            background: 'rgba(251,191,36,0.15)',
                            border: '1px solid rgba(251,191,36,0.3)',
                            color: '#fbbf24',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            transition: 'all 0.2s ease',
                            whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(251,191,36,0.25)'
                            e.currentTarget.style.borderColor = 'rgba(251,191,36,0.5)'
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(251,191,36,0.15)'
                            e.currentTarget.style.borderColor = 'rgba(251,191,36,0.3)'
                        }}
                    >
                        📄 Exporter en PDF
                    </button>
                </div>
            </header>

            {/* ── Report content ────────────────────────────────────────────────── */}
            <div ref={printRef} style={{ maxWidth: 960, margin: '0 auto', padding: '48px 24px 96px' }}>
                <SummarySection    report={report} />
                <ScoresSection
                    scores={scores}
                    score_breakdown={score_breakdown}
                    security_warnings={security_warnings}
                />
                <TranscriptSection transcript_phases={transcript_phases} />
                <VoiceSection      voice_analysis={voice_analysis} />
                <SecuritySection   security_warnings={security_warnings} />
                <QCMSection        qcm_detail={qcm_detail} />
                <ProfileSection    profile_inconsistencies={profile_inconsistencies} />
                <RecoSection
                    recommendation={recommendation}
                    report={report}
                />
            </div>
        </div>
    )
}