import { useRef, useState } from 'react'
import {
    X, Video, Play, Pause, Volume2, VolumeX,
    Download, AlertTriangle, User, Briefcase,
    Clock, Maximize2
} from 'lucide-react'
import { Button } from '../../../../components/ui/button'

interface InterviewVideoModalProps {
    interview: {
        token: string
        video_url: string | null
        warnings_count: number
        completed_at: string | null
        started_at: string | null
        scores: {
            global: number | null
            communication: number | null
            clarification: number | null
            scenario: number | null
            qcm: number | null
            coding: number | null
            vocal: number | null
        }
        application: {
            full_name: string
            job_offer_title: string
            email: string
        }
    }
    onClose: () => void
}

function formatDuration(start: string | null, end: string | null): string {
    if (!start || !end) return '—'
    const diff = Math.floor(
        (new Date(end).getTime() - new Date(start).getTime()) / 1000
    )
    const m = Math.floor(diff / 60)
    const s = diff % 60
    return `${m}m ${s.toString().padStart(2, '0')}s`
}

function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    })
}

export function InterviewVideoModal({ interview, onClose }: InterviewVideoModalProps) {
    const videoRef  = useRef<HTMLVideoElement>(null)
    const [playing, setPlaying]  = useState(false)
    const [muted,   setMuted]    = useState(false)
    const [progress, setProgress] = useState(0)
    const [duration, setDuration] = useState(0)
    const [currentTime, setCurrentTime] = useState(0)

    const togglePlay = () => {
        if (!videoRef.current) return
        if (playing) {
            videoRef.current.pause()
        } else {
            videoRef.current.play()
        }
        setPlaying(!playing)
    }

    const toggleMute = () => {
        if (!videoRef.current) return
        videoRef.current.muted = !muted
        setMuted(!muted)
    }

    const handleTimeUpdate = () => {
        if (!videoRef.current) return
        const cur = videoRef.current.currentTime
        const dur = videoRef.current.duration || 1
        setCurrentTime(cur)
        setProgress((cur / dur) * 100)
    }

    const handleLoadedMetadata = () => {
        if (!videoRef.current) return
        setDuration(videoRef.current.duration)
    }

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!videoRef.current) return
        const val = parseFloat(e.target.value)
        const time = (val / 100) * (videoRef.current.duration || 0)
        videoRef.current.currentTime = time
        setProgress(val)
    }

    const handleEnded = () => setPlaying(false)

    const handleFullscreen = () => {
        if (videoRef.current?.requestFullscreen) {
            videoRef.current.requestFullscreen()
        }
    }

    const formatTime = (sec: number) => {
        if (isNaN(sec)) return '0:00'
        const m = Math.floor(sec / 60)
        const s = Math.floor(sec % 60)
        return `${m}:${s.toString().padStart(2, '0')}`
    }

    // ✅ CORRECTION : Utiliser scores.global au lieu de ai_interview_score
    const globalScore = interview.scores?.global ?? null
    const hasValidScore = globalScore != null

    const scoreColor = !hasValidScore
        ? 'text-slate-500'
        : globalScore >= 80 ? 'text-green-400'
            : globalScore >= 60 ? 'text-blue-400'
                : 'text-red-400'

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50
                       flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-slate-900 border border-slate-700 rounded-2xl
                           w-full max-w-3xl max-h-[95vh] overflow-y-auto shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* ── Header ─────────────────────────────────────────── */}
                <div className="flex items-center justify-between p-5
                                border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-cyan-600/20
                                        flex items-center justify-center">
                            <Video className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div>
                            <h2 className="text-white font-bold text-base">
                                Vidéo de l'entretien
                            </h2>
                            <p className="text-slate-400 text-xs">
                                {interview.application.full_name} · {interview.application.job_offer_title}
                            </p>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onClose}
                            className="text-slate-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <div className="p-5 space-y-5">

                    {/* ── Infos candidat ─────────────────────────────── */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            {
                                icon: <User className="w-3.5 h-3.5 text-purple-400" />,
                                label: 'Candidat',
                                value: interview.application.full_name,
                            },
                            {
                                icon: <Briefcase className="w-3.5 h-3.5 text-blue-400" />,
                                label: 'Poste',
                                value: interview.application.job_offer_title,
                            },
                            {
                                icon: <Clock className="w-3.5 h-3.5 text-green-400" />,
                                label: 'Durée entretien',
                                value: formatDuration(interview.started_at, interview.completed_at),
                            },
                            {
                                icon: <Video className="w-3.5 h-3.5 text-cyan-400" />,
                                label: 'Score final',
                                value: hasValidScore ? `${globalScore}/100` : '—',
                                valueClass: scoreColor,
                            },
                        ].map(item => (
                            <div key={item.label}
                                 className="bg-slate-800/60 rounded-xl p-3">
                                <div className="flex items-center gap-1.5 mb-1">
                                    {item.icon}
                                    <span className="text-xs text-slate-500">{item.label}</span>
                                </div>
                                <p className={`text-sm font-semibold truncate ${item.valueClass || 'text-white'}`}>
                                    {item.value}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* ── Lecteur vidéo ──────────────────────────────── */}
                    {interview.video_url ? (
                        <div className="rounded-xl overflow-hidden bg-black
                                        border border-slate-700 shadow-lg">
                            {/* Vidéo */}
                            <div className="relative group">
                                <video
                                    ref={videoRef}
                                    src={interview.video_url}
                                    className="w-full max-h-[380px] object-contain bg-black"
                                    onTimeUpdate={handleTimeUpdate}
                                    onLoadedMetadata={handleLoadedMetadata}
                                    onEnded={handleEnded}
                                    playsInline
                                />

                                {/* Overlay play/pause au clic */}
                                <div
                                    className="absolute inset-0 flex items-center justify-center
                                               cursor-pointer"
                                    onClick={togglePlay}
                                >
                                    {!playing && (
                                        <div className="w-16 h-16 rounded-full bg-white/10
                                                        backdrop-blur-sm flex items-center justify-center
                                                        border border-white/20 transition-all
                                                        hover:bg-white/20 hover:scale-105">
                                            <Play className="w-7 h-7 text-white ml-1" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Contrôles */}
                            <div className="px-4 py-3 bg-slate-900 space-y-2">
                                {/* Barre de progression */}
                                <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    step={0.1}
                                    value={progress}
                                    onChange={handleSeek}
                                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                                               bg-slate-700 accent-cyan-400"
                                />

                                <div className="flex items-center justify-between gap-3">
                                    {/* Gauche : Play + Mute + Temps */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={togglePlay}
                                            className="w-8 h-8 rounded-full bg-slate-700
                                                       flex items-center justify-center
                                                       hover:bg-slate-600 transition-colors"
                                        >
                                            {playing
                                                ? <Pause  className="w-4 h-4 text-white" />
                                                : <Play   className="w-4 h-4 text-white ml-0.5" />
                                            }
                                        </button>

                                        <button
                                            onClick={toggleMute}
                                            className="w-8 h-8 rounded-full bg-slate-700
                                                       flex items-center justify-center
                                                       hover:bg-slate-600 transition-colors"
                                        >
                                            {muted
                                                ? <VolumeX className="w-4 h-4 text-slate-400" />
                                                : <Volume2 className="w-4 h-4 text-white"    />
                                            }
                                        </button>

                                        <span className="text-xs text-slate-400 font-mono tabular-nums">
                                            {formatTime(currentTime)} / {formatTime(duration)}
                                        </span>
                                    </div>

                                    {/* Droite : Fullscreen + Télécharger */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handleFullscreen}
                                            className="w-8 h-8 rounded-full bg-slate-700
                                                       flex items-center justify-center
                                                       hover:bg-slate-600 transition-colors"
                                            title="Plein écran"
                                        >
                                            <Maximize2 className="w-4 h-4 text-white" />
                                        </button>

                                        <a
                                            href={interview.video_url}
                                            download={`entretien_${interview.application.full_name.replace(/\s+/g, '_')}.webm`}
                                            className="flex items-center gap-1.5 px-3 py-1.5
                                                       bg-slate-700 hover:bg-slate-600 transition-colors
                                                       rounded-lg text-xs text-slate-300"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                            Télécharger
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Pas de vidéo */
                        <div className="rounded-xl border border-slate-700 border-dashed
                                        bg-slate-800/30 p-12 flex flex-col items-center gap-3">
                            <Video className="w-12 h-12 text-slate-600" />
                            <p className="text-slate-400 font-medium">Aucune vidéo disponible</p>
                            <p className="text-slate-600 text-sm text-center">
                                La vidéo n'a pas été enregistrée ou n'a pas encore été uploadée.
                            </p>
                        </div>
                    )}

                    {/* ── Avertissements fraude ──────────────────────── */}
                    {interview.warnings_count > 0 && (
                        <div className="bg-orange-600/10 border border-orange-500/30
                                        rounded-xl p-4 flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-orange-300 font-semibold text-sm">
                                    {interview.warnings_count} avertissement{interview.warnings_count > 1 ? 's' : ''} détecté{interview.warnings_count > 1 ? 's' : ''}
                                </p>
                                <p className="text-orange-400/70 text-xs mt-0.5">
                                    Des comportements suspects ont été détectés pendant cet entretien.
                                    Vérifiez attentivement la vidéo.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ── Métadonnées ────────────────────────────────── */}
                    <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
                        <div>
                            <span className="text-slate-600">Commencé le : </span>
                            <span className="text-slate-400">{formatDate(interview.started_at)}</span>
                        </div>
                        <div>
                            <span className="text-slate-600">Terminé le : </span>
                            <span className="text-slate-400">{formatDate(interview.completed_at)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}