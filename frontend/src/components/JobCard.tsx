// src/components/JobCard.tsx
// Design indigo + sky — cohérent avec PublicDashboard

import { useNavigate } from 'react-router-dom'
import { ArrowRight, MapPin, Clock, Globe, Zap, Star, Briefcase, Calendar } from 'lucide-react'

interface JobCardProps {
    id:                  number
    title:               string
    description:         string
    createdAt:           string
    location?:           string
    type?:               string
    offer_deadline?:     string
    department?:         string
    compatibilityScore?: number   // 0-100, optionnel
    company?:            string   // nom entreprise, optionnel
}

// ── Helpers ────────────────────────────────────

const getDaysLeft = (deadline: string) => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const end   = new Date(deadline); end.setHours(0, 0, 0, 0)
    return Math.ceil((end.getTime() - today.getTime()) / 864e5)
}

const isNew = (createdAt: string) =>
    new Date(createdAt) > new Date(Date.now() - 7 * 864e5)

const formatDate = (s: string) =>
    new Date(s).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'short', year: 'numeric',
    })

// ── Avatar entreprise ───────────────────────────
function CompanyAvatar({ name }: { name: string }) {
    const initials = name
        .split(' ')
        .map(w => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()

    const palettes = [
        'from-indigo-500 to-indigo-600',
        'from-sky-500 to-sky-600',
        'from-violet-500 to-purple-600',
        'from-indigo-400 to-sky-500',
        'from-blue-500 to-indigo-500',
    ]
    const idx = (initials.charCodeAt(0) + (initials.charCodeAt(1) || 0)) % palettes.length

    return (
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${palettes[idx]}
                         flex items-center justify-center text-white text-sm font-bold
                         flex-shrink-0 shadow-sm select-none`}>
            {initials}
        </div>
    )
}

// ── Badge deadline ──────────────────────────────
function DeadlineBadge({ deadline }: { deadline: string }) {
    const days = getDaysLeft(deadline)

    if (days < 0) return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full
                         text-[11px] font-medium bg-slate-100 text-slate-400 border border-slate-200">
            <Clock className="w-2.5 h-2.5" /> Clôturée
        </span>
    )
    if (days === 0) return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full
                         text-[11px] font-semibold bg-red-50 text-red-600 border border-red-200 animate-pulse">
            <Clock className="w-2.5 h-2.5" /> Dernier jour !
        </span>
    )
    if (days <= 3) return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full
                         text-[11px] font-semibold bg-orange-50 text-orange-600 border border-orange-200">
            <Zap className="w-2.5 h-2.5" /> {days}j restants !
        </span>
    )
    if (days <= 7) return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full
                         text-[11px] font-medium bg-amber-50 text-amber-600 border border-amber-200">
            <Clock className="w-2.5 h-2.5" /> {days}j restants
        </span>
    )
    return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full
                         text-[11px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-200">
            <Clock className="w-2.5 h-2.5" /> {days}j restants
        </span>
    )
}

// ── Badge type de contrat ───────────────────────
function TypeBadge({ type }: { type: string }) {
    const styles: Record<string, string> = {
        CDI:        'bg-gradient-to-r from-indigo-50 to-sky-50 text-indigo-600 border border-indigo-100',
        CDD:        'bg-amber-50 text-amber-700 border border-amber-200',
        Stage:      'bg-emerald-50 text-emerald-700 border border-emerald-200',
        Alternance: 'bg-violet-50 text-violet-700 border border-violet-200',
        Freelance:  'bg-rose-50 text-rose-700 border border-rose-200',
    }
    return (
        <span className={`px-3 py-1 rounded-full text-[11px] font-bold
                         ${styles[type] ?? 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
            {type}
        </span>
    )
}

// ── Barre de score IA ───────────────────────────
function ScoreBar({ score }: { score: number }) {
    const color =
        score >= 80 ? 'text-emerald-600' :
            score >= 60 ? 'text-indigo-600'  :
                'text-amber-600'

    return (
        <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap shrink-0">
                Compatibilité IA
            </span>
            <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-400
                               transition-all duration-700"
                    style={{ width: `${score}%` }}
                />
            </div>
            <span className={`text-[11px] font-bold whitespace-nowrap ${color}`}>
                {score}%
            </span>
        </div>
    )
}

// ═══════════════════════════════════════════════
// JOBCARD
// ═══════════════════════════════════════════════

export function JobCard({
                            id, title, description, createdAt, location, type,
                            offer_deadline, compatibilityScore, company = 'Entreprise',
                        }: JobCardProps) {
    const navigate = useNavigate()

    // Masquer les offres expirées depuis plus d'1 jour
    if (offer_deadline && getDaysLeft(offer_deadline) < -1) return null

    const fresh    = isNew(createdAt)
    const isRemote = (location ?? '').toLowerCase().includes('remote')
    const urgent   = offer_deadline
        ? getDaysLeft(offer_deadline) <= 3 && getDaysLeft(offer_deadline) >= 0
        : false

    return (
        <div
            onClick={() => navigate(`/jobs/${id}`)}
            className="group relative bg-white border border-slate-200 rounded-2xl
                       overflow-hidden cursor-pointer flex flex-col
                       transition-all duration-250
                       hover:border-indigo-300
                       hover:shadow-[0_16px_48px_rgba(99,102,241,0.12)]
                       hover:-translate-y-1"
        >
            {/* Barre accent top — apparaît au hover */}
            <div className="h-[3px] bg-gradient-to-r from-indigo-500 to-sky-400
                            opacity-0 group-hover:opacity-100 transition-opacity duration-250" />

            {/* Glow coin haut-droite */}
            <div className="absolute top-0 right-0 w-28 h-28 pointer-events-none
                            bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.06),transparent_70%)]
                            group-hover:bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.13),transparent_70%)]
                            transition-all duration-250" />

            <div className="relative p-5 flex flex-col flex-1">

                {/* ── Entreprise + localisation ── */}
                <div className="flex items-center gap-3 mb-4">
                    <CompanyAvatar name={company} />
                    <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold text-slate-700 truncate">
                            {company}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                            {isRemote
                                ? <><Globe className="w-2.5 h-2.5 shrink-0" /> Remote</>
                                : <><MapPin className="w-2.5 h-2.5 shrink-0" /> {location ?? 'Lieu non précisé'}</>
                            }
                        </div>
                    </div>
                    {/* Date de publication — discret */}
                    <div className="flex items-center gap-1 text-[11px] text-slate-300 shrink-0">
                        <Calendar className="w-2.5 h-2.5" />
                        {formatDate(createdAt)}
                    </div>
                </div>

                {/* ── Badges (Nouveau + deadline) ── */}
                {(fresh || offer_deadline) && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                        {fresh && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full
                                             text-[11px] font-semibold bg-blue-50 text-blue-600 border border-blue-200">
                                <Star className="w-2.5 h-2.5" /> Nouveau
                            </span>
                        )}
                        {offer_deadline && <DeadlineBadge deadline={offer_deadline} />}
                    </div>
                )}

                {/* ── Titre ── */}
                <h3 className="text-[15px] font-bold text-slate-900 leading-snug mb-3 pr-2
                               group-hover:text-indigo-600 transition-colors duration-200">
                    {title}
                </h3>

                {/* ── Description ── */}
                <p className="text-[13px] text-slate-500 leading-relaxed line-clamp-2 flex-1 mb-4">
                    {description}
                </p>

                {/* ── Score IA (si disponible) ── */}
                {compatibilityScore !== undefined && (
                    <ScoreBar score={compatibilityScore} />
                )}

                {/* ── Date limite texte (si proche) ── */}
                {offer_deadline
                    && getDaysLeft(offer_deadline) <= 7
                    && getDaysLeft(offer_deadline) >= 0
                    && (
                        <p className="text-[11px] text-slate-400 mb-1">
                            Date limite :{' '}
                            <span className={`font-semibold ${urgent ? 'text-orange-500' : 'text-slate-600'}`}>
                            {formatDate(offer_deadline)}
                        </span>
                        </p>
                    )}
            </div>

            {/* ── Séparateur ── */}
            <div className="h-px bg-slate-100 mx-5" />

            {/* ── Footer ── */}
            <div className="flex items-center justify-between px-5 py-3">
                {type
                    ? <TypeBadge type={type} />
                    : <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                        <Briefcase className="w-3 h-3" /> Non précisé
                      </span>
                }

                {/* Bouton CTA — glisse en apparaissant au hover */}
                <button
                    onClick={e => { e.stopPropagation(); navigate(`/jobs/${id}`) }}
                    className="flex items-center gap-1.5 h-8 px-4 rounded-lg
                               bg-gradient-to-r from-indigo-500 to-sky-500
                               text-white text-[12px] font-bold
                               opacity-0 translate-x-2
                               group-hover:opacity-100 group-hover:translate-x-0
                               transition-all duration-200
                               shadow-sm shadow-indigo-500/30"
                >
                    Postuler
                    <ArrowRight className="w-3 h-3" />
                </button>
            </div>
        </div>
    )
}