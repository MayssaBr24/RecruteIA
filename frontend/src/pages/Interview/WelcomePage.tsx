// src/pages/WelcomePage.tsx
// ✅ FIX: useVideoRecorder() retiré d'ici — il vit dans InterviewPage
// WelcomePage reçoit videoRef, onCameraStart, onBegin comme props
// → un seul stream partagé, pas de double instanciation

import { useState } from 'react'

interface StartResponse {
    interview_id: number
    candidate_name: string
    job_title: string
    current_phase: string
    phase_info: any
    first_question: string
    question_index: number
}

interface Props {
    interviewData: StartResponse
    videoRef: React.RefObject<HTMLVideoElement>        // ✅ ref partagée depuis InterviewPage
    onCameraStart: () => Promise<boolean>              // ✅ startCamera() depuis InterviewPage
    onBegin: () => void                                // ✅ startRecording() + fullscreen depuis InterviewPage
    videoError?: string                                // ✅ erreur caméra depuis InterviewPage
    onStopCamera?: () => void                          // ✅ stopCamera() depuis InterviewPage
}

type Step = 'info' | 'rules' | 'check' | 'ready'

const PHASES_INFO = [
    { icon: '💬', label: 'Communication',    desc: '4 questions comportementales',   duration: '15 min' },
    { icon: '📄', label: 'Parcours CV',       desc: '3 questions sur votre parcours', duration: '10 min' },
    { icon: '🎭', label: 'Mise en situation', desc: '2 scénarios professionnels',     duration: '15 min' },
    { icon: '📝', label: 'QCM Technique',     desc: '10 questions métier/technique',  duration: '20 min' },
]

const RULES = [
    { icon: '📷', text: 'Votre caméra et microphone doivent rester allumés pendant tout l\'entretien.' },
    { icon: '👁️', text: 'Votre visage doit être visible et bien éclairé en permanence.' },
    { icon: '🚫', text: 'Ne changez pas d\'onglet ou de fenêtre — cela génère un avertissement.' },
    { icon: '🤐', text: 'Ne copiez-collez pas de contenu externe dans vos réponses.' },
    { icon: '🏠', text: 'Installez-vous dans un endroit calme, sans bruit ni interruption.' },
    { icon: '⏱️', text: 'L\'entretien dure environ 60 minutes. Prévoyez ce temps sans interruption.' },
    { icon: '📵', text: 'Rangez votre téléphone et fermez toutes les applications inutiles.' },
    { icon: '⚠️', text: '3 infractions graves entraînent la fin automatique de l\'entretien.' },
]

export function WelcomePage({
                                interviewData,
                                videoRef,
                                onCameraStart,
                                onBegin,
                                videoError,
                                onStopCamera,
                            }: Props) {
    const [step,         setStep]         = useState<Step>('info')
    const [rulesChecked, setRulesChecked] = useState(false)
    const [starting,     setStarting]     = useState(false)
    const [cameraOk,     setCameraOk]     = useState(false)
    const [checking,     setChecking]     = useState(false)

    const totalMin = PHASES_INFO.reduce((acc, p) => acc + parseInt(p.duration), 0)

    // ── Étape vérification caméra ─────────────────────────────────────
    const handleCheckCamera = async () => {
        setStep('check')
        setChecking(true)
        // ✅ Appelle startCamera() du parent (useVideoRecorder dans InterviewPage)
        const ok = await onCameraStart()
        setChecking(false)
        if (ok) {
            setCameraOk(true)
            setStep('ready')
        }
        // Si erreur → videoError sera rempli par le parent
    }

    // ── Démarrage de l'entretien ──────────────────────────────────────
    const handleBegin = async () => {
        if (starting || !cameraOk) return
        setStarting(true)
        // ✅ startRecording() + fullscreen gérés dans InterviewPage
        onBegin()
    }

    // ── Retour depuis vérif caméra ────────────────────────────────────
    const handleBackFromCamera = () => {
        onStopCamera?.()
        setCameraOk(false)
        setStep('rules')
    }

    return (
        <div
            className="min-h-screen flex items-center justify-center px-4 py-12"
            style={{ background: '#08080c' }}
        >
            {/* Fond ambiant */}
            <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
                <div className="absolute opacity-[0.05]"
                     style={{
                         top: '5%', left: '30%', width: 500, height: 500, borderRadius: '50%',
                         background: 'radial-gradient(circle, #fbbf24, transparent 70%)', filter: 'blur(80px)',
                     }} />
            </div>

            <div className="relative z-10 w-full max-w-2xl flex flex-col gap-6">

                {/* En-tête */}
                <div className="text-center flex flex-col gap-3">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mx-auto"
                         style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-xs font-medium tracking-widest uppercase text-amber-400">
                            Entretien IA
                        </span>
                    </div>
                    <h1 className="text-3xl font-light"
                        style={{ color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.02em' }}>
                        Bienvenue, {interviewData.candidate_name}
                    </h1>
                    <p className="text-base" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        Poste : <span style={{ color: 'rgba(255,255,255,0.7)' }}>{interviewData.job_title}</span>
                    </p>
                </div>

                {/* ── ÉTAPE 1 : Informations ──────────────────────────────── */}
                {step === 'info' && (
                    <div className="flex flex-col gap-4">
                        <div className="rounded-2xl p-6 flex flex-col gap-4"
                             style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-medium tracking-widest uppercase"
                                    style={{ color: 'rgba(255,255,255,0.4)' }}>Déroulement</h2>
                                <span className="text-xs px-3 py-1 rounded-full"
                                      style={{
                                          background: 'rgba(251,191,36,0.08)',
                                          border: '1px solid rgba(251,191,36,0.18)',
                                          color: 'rgba(251,191,36,0.7)',
                                      }}>
                                    ~{totalMin} minutes
                                </span>
                            </div>
                            <div className="flex flex-col gap-3">
                                {PHASES_INFO.map((p, i) => (
                                    <div key={i} className="flex items-center gap-4 p-3 rounded-xl"
                                         style={{
                                             background: 'rgba(255,255,255,0.02)',
                                             border: '1px solid rgba(255,255,255,0.05)',
                                         }}>
                                        <span className="text-2xl flex-shrink-0">{p.icon}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium"
                                                      style={{ color: 'rgba(255,255,255,0.85)' }}>
                                                    {p.label}
                                                </span>
                                                <span className="text-xs"
                                                      style={{ color: 'rgba(255,255,255,0.25)' }}>
                                                    {p.desc}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="text-xs flex-shrink-0"
                                              style={{ color: 'rgba(251,191,36,0.5)' }}>
                                            {p.duration}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={() => setStep('rules')}
                            className="w-full py-3 rounded-xl text-sm font-medium transition-all duration-200"
                            style={{
                                background: 'rgba(251,191,36,0.12)',
                                border: '1px solid rgba(251,191,36,0.3)',
                                color: '#fbbf24',
                            }}>
                            Continuer →
                        </button>
                    </div>
                )}

                {/* ── ÉTAPE 2 : Règles ────────────────────────────────────── */}
                {step === 'rules' && (
                    <div className="flex flex-col gap-4">
                        <div className="rounded-2xl p-6 flex flex-col gap-3"
                             style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                            <h2 className="text-sm font-medium tracking-widest uppercase mb-2"
                                style={{ color: 'rgba(255,255,255,0.4)' }}>
                                Règles de l'entretien
                            </h2>
                            {RULES.map((r, i) => (
                                <div key={i} className="flex items-start gap-3">
                                    <span className="text-lg flex-shrink-0 mt-0.5">{r.icon}</span>
                                    <p className="text-sm leading-relaxed"
                                       style={{ color: 'rgba(255,255,255,0.65)' }}>
                                        {r.text}
                                    </p>
                                </div>
                            ))}
                        </div>

                        {/* Checkbox */}
                        <label
                            className="flex items-center gap-3 cursor-pointer p-4 rounded-xl transition-all"
                            style={{
                                background: rulesChecked ? 'rgba(251,191,36,0.05)' : 'rgba(255,255,255,0.02)',
                                border: `1px solid ${rulesChecked ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.07)'}`,
                            }}>
                            <div
                                onClick={() => setRulesChecked(p => !p)}
                                className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all"
                                style={{
                                    background: rulesChecked ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.05)',
                                    border: `1px solid ${rulesChecked ? 'rgba(251,191,36,0.5)' : 'rgba(255,255,255,0.15)'}`,
                                }}>
                                {rulesChecked && (
                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                        <path d="M2 5l2 2 4-4" stroke="#fbbf24" strokeWidth="1.5"
                                              strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                )}
                            </div>
                            <span className="text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
                                J'ai lu et j'accepte les règles de l'entretien. Je comprends que toute
                                infraction peut entraîner l'arrêt automatique de la session.
                            </span>
                        </label>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setStep('info')}
                                className="px-5 py-3 rounded-xl text-sm font-medium transition-all"
                                style={{
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    color: 'rgba(255,255,255,0.4)',
                                }}>
                                ← Retour
                            </button>
                            <button
                                onClick={handleCheckCamera}
                                disabled={!rulesChecked}
                                className="flex-1 py-3 rounded-xl text-sm font-medium transition-all duration-200"
                                style={{
                                    background: rulesChecked ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.04)',
                                    border: `1px solid ${rulesChecked ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.06)'}`,
                                    color: rulesChecked ? '#fbbf24' : 'rgba(255,255,255,0.2)',
                                    cursor: rulesChecked ? 'pointer' : 'not-allowed',
                                }}>
                                Vérifier ma caméra →
                            </button>
                        </div>
                    </div>
                )}

                {/* ── ÉTAPE 3 : Vérification caméra ───────────────────────── */}
                {(step === 'check' || step === 'ready') && (
                    <div className="flex flex-col gap-4">
                        <div className="rounded-2xl overflow-hidden"
                             style={{
                                 border: '1px solid rgba(255,255,255,0.07)',
                                 aspectRatio: '16/9',
                                 background: '#000',
                                 position: 'relative',
                             }}>
                            {/* ✅ videoRef partagé depuis InterviewPage */}
                            <video
                                ref={videoRef}
                                autoPlay
                                muted
                                playsInline
                                className="w-full h-full object-cover"
                                style={{ transform: 'scaleX(-1)' }}
                            />

                            {/* Chargement */}
                            {checking && (
                                <div className="absolute inset-0 flex items-center justify-center"
                                     style={{ background: 'rgba(0,0,0,0.5)' }}>
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-8 h-8 rounded-full border animate-spin"
                                             style={{
                                                 borderColor: 'rgba(251,191,36,0.2)',
                                                 borderTopColor: '#fbbf24',
                                             }} />
                                        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                                            Accès caméra en cours…
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Guide cadrage */}
                            {step === 'ready' && (
                                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                    <div className="w-32 h-40 rounded-full"
                                         style={{ border: '2px dashed rgba(251,191,36,0.3)' }} />
                                </div>
                            )}

                            {/* Badge LIVE */}
                            {step === 'ready' && (
                                <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                                     style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
                                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>LIVE</span>
                                </div>
                            )}
                        </div>

                        {/* Erreur caméra */}
                        {videoError && (
                            <div className="p-4 rounded-xl"
                                 style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                                <p className="text-sm" style={{ color: 'rgba(239,68,68,0.85)' }}>{videoError}</p>
                                <button
                                    onClick={handleCheckCamera}
                                    className="text-xs mt-2 underline"
                                    style={{ color: 'rgba(239,68,68,0.6)' }}>
                                    Réessayer
                                </button>
                            </div>
                        )}

                        {/* Prêt */}
                        {step === 'ready' && !videoError && (
                            <>
                                <div className="p-3 rounded-xl flex items-center gap-3"
                                     style={{
                                         background: 'rgba(34,197,94,0.06)',
                                         border: '1px solid rgba(34,197,94,0.15)',
                                     }}>
                                    <span className="text-green-400">✓</span>
                                    <p className="text-sm" style={{ color: 'rgba(34,197,94,0.8)' }}>
                                        Caméra et microphone opérationnels.
                                        Assurez-vous que votre visage est bien centré.
                                    </p>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={handleBackFromCamera}
                                        className="px-5 py-3 rounded-xl text-sm font-medium transition-all"
                                        style={{
                                            background: 'rgba(255,255,255,0.04)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            color: 'rgba(255,255,255,0.4)',
                                        }}>
                                        ← Retour
                                    </button>
                                    <button
                                        onClick={handleBegin}
                                        disabled={starting}
                                        className="flex-1 py-3 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2"
                                        style={{
                                            background: starting ? 'rgba(255,255,255,0.04)' : 'rgba(251,191,36,0.15)',
                                            border: `1px solid ${starting ? 'rgba(255,255,255,0.06)' : 'rgba(251,191,36,0.4)'}`,
                                            color: starting ? 'rgba(255,255,255,0.2)' : '#fbbf24',
                                        }}>
                                        {starting ? (
                                            <>
                                                <span className="w-4 h-4 rounded-full border border-amber-400/30 border-t-amber-400 animate-spin" />
                                                Démarrage…
                                            </>
                                        ) : (
                                            <>
                                                <span className="w-2 h-2 rounded-full bg-red-400" />
                                                Démarrer l'entretien
                                            </>
                                        )}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Footer */}
                <p className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>
                    Cet entretien est confidentiel et sécurisé · Propulsé par IA
                </p>
            </div>
        </div>
    )
}