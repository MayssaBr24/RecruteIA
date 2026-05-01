
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Table, TableBody, TableCell,
    TableHead, TableHeader, TableRow,
} from '../../../../components/ui/table'
import {
    Eye, Loader2, User, Mail, Phone,
    Briefcase, Calendar, Award, TrendingUp,
    TrendingDown, Search, Filter, ChevronDown, UserCheck,
} from 'lucide-react'
import { Application } from '../../../hooks/useRHData'

// ══════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════

type DecisionFilter = 'ALL' | 'VALIDATED' | 'TO_REVIEW' | 'REJECTED' | 'PENDING' | 'HIRED'

interface ApplicationsTableProps {
    applications: Application[]
    loading:      boolean
    onRefresh?:   () => void
}

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════

const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '—'
    try {
        const d = new Date(dateString)
        if (isNaN(d.getTime())) return '—'
        return new Intl.DateTimeFormat('fr-FR', {
            day: '2-digit', month: 'short', year: 'numeric',
        }).format(d)
    } catch {
        return '—'
    }
}

const DECISION_CONFIG: Record<string, {
    bg: string; text: string; border: string; label: string; icon: React.ElementType
}> = {
    VALIDATED: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'Présélectionné', icon: Award       },
    TO_REVIEW: { bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-amber-500/30',   label: 'À examiner',  icon: TrendingUp  },
    REJECTED:  { bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-red-500/30',     label: 'Refusé',      icon: TrendingDown},
    PENDING:   { bg: 'bg-slate-500/10',   text: 'text-slate-400',   border: 'border-slate-500/30',   label: 'En attente',  icon: Calendar    },
    HIRED: {
        bg: 'bg-emerald-600/15', text: 'text-emerald-300',
        border: 'border-emerald-500/40', label: 'Recruté', icon: UserCheck
    },
}


const SCORE_CONFIG = (s: number) => {
    if (s >= 80) return { color: 'text-emerald-400', ring: 'ring-emerald-500/40', label: 'Excellent' }
    if (s >= 60) return { color: 'text-blue-400',    ring: 'ring-blue-500/40',    label: 'Bon'       }
    if (s >= 40) return { color: 'text-amber-400',   ring: 'ring-amber-500/40',   label: 'Moyen'     }
    return              { color: 'text-red-400',     ring: 'ring-red-500/40',     label: 'Faible'    }
}

function Initials({ name }: { name: string }) {
    const i = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    return (
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-blue-600
                        flex items-center justify-center text-white text-xs font-bold shrink-0">
            {i}
        </div>
    )
}

// Composant pour la carte mobile
function MobileApplicationCard({ app, onView }: { app: Application; onView: (id: number) => void }) {
    const score = app.ai_score ?? 0
    const sc = SCORE_CONFIG(score)
    const dec = DECISION_CONFIG[app.ai_decision ?? 'PENDING']
    const DecIcon = dec.icon

    return (
        <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-4 space-y-3">
            {/* En-tête avec nom et score */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Initials name={app.full_name} />
                    <div>
                        <p className="text-white font-medium">{app.full_name}</p>
                        <div className="flex items-center gap-2 mt-1">
                            <div className={`w-6 h-6 rounded-full ring-2 ${sc.ring} bg-slate-900/60 flex items-center justify-center`}>
                                <span className={`text-xs font-bold ${sc.color}`}>{score}</span>
                            </div>
                            <span className={`text-xs ${sc.color}`}>{sc.label}</span>
                        </div>
                    </div>
                </div>
                <button
                    onClick={() => onView(app.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                >
                    <Eye className="w-4 h-4" />
                </button>
            </div>

            {/* Informations poste */}
            <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                    <Briefcase className="w-4 h-4 text-purple-400 shrink-0" />
                    <span className="flex-1">{app.job_offer_title}</span>
                </div>

                <div className="flex items-center gap-2 text-sm text-slate-300">
                    <Mail className="w-4 h-4 text-blue-400 shrink-0" />
                    <span className="flex-1 truncate">{app.email}</span>
                </div>

                <div className="flex items-center gap-2 text-sm text-slate-300">
                    <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{app.phone}</span>
                </div>
            </div>

            {/* Footer avec date et statut */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
                <span className="text-slate-400 text-xs">
                    {formatDate(app.applied_date)}
                </span>
                <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${dec.bg} ${dec.text} ${dec.border}`}>
                    <DecIcon className="w-3 h-3" />
                    {dec.label}
                </span>
            </div>
        </div>
    )
}

// ══════════════════════════════════════════════
// COMPOSANT PRINCIPAL RESPONSIVE
// ══════════════════════════════════════════════

export function ApplicationsTable({
                                      applications, loading,
                                  }: ApplicationsTableProps) {
    const navigate = useNavigate()
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState<DecisionFilter>('ALL')
    const [mobileFilterOpen, setMobileFilterOpen] = useState(false)

    // Filtrage + tri
    const filtered = applications
        .filter(app => {
            const matchSearch = search === '' ||
                app.full_name.toLowerCase().includes(search.toLowerCase()) ||
                (app.job_offer_title ?? '').toLowerCase().includes(search.toLowerCase())

            // Si filtre ALL : on exclut les recrutés (ils sont dans la page Employés)
            if (filter === 'ALL') {
                return matchSearch && app.status !== 'hired'
            }
            const matchFilter = filter === 'HIRED'
                ? app.status === 'hired'
                : (app.ai_decision ?? 'PENDING') === filter
            return matchSearch
                && matchFilter
        })

    // Stats footer
    const stats = {
        validated: applications.filter(a => a.ai_decision === 'VALIDATED' && a.status !== 'hired').length,
        toReview:  applications.filter(a => a.ai_decision === 'TO_REVIEW'  && a.status !== 'hired').length,
        rejected:  applications.filter(a => a.ai_decision === 'REJECTED'   && a.status !== 'hired').length,
        hired:     applications.filter(a => a.status === 'hired').length,
    }

    // États vides / chargement
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24
                            bg-slate-800/50 border border-slate-700 rounded-2xl">
                <Loader2 className="w-10 h-10 animate-spin text-purple-400 mb-4" />
                <p className="text-slate-400 text-sm">Chargement des candidatures...</p>
            </div>
        )
    }

    if (applications.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24
                            border-2 border-dashed border-slate-700 rounded-2xl">
                <div className="w-16 h-16 rounded-2xl bg-purple-600/10 border border-purple-500/20
                                flex items-center justify-center mb-4">
                    <User className="w-8 h-8 text-purple-400" />
                </div>
                <p className="text-white font-semibold mb-1">Aucune candidature</p>
                <p className="text-slate-400 text-sm">
                    Les candidatures apparaîtront ici après les premières postulations.
                </p>
            </div>
        )
    }

    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">

            {/* Toolbar responsive */}
            <div className="p-4 border-b border-slate-700">
                {/* Barre de recherche - toujours visible */}
                <div className="relative w-full mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Rechercher un candidat..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-900/50 border border-slate-700
                                   text-white text-sm rounded-xl placeholder:text-slate-500
                                   focus:outline-none focus:border-purple-500 transition-colors"
                    />
                </div>

                {/* Filtres - version desktop (cachée sur mobile) */}
                <div className="hidden md:flex items-center gap-1 flex-wrap">
                    <Filter className="w-3.5 h-3.5 text-slate-500 mr-1" />
                    {([
                        { key: 'ALL', label: `Tous (${applications.length})` },
                        { key: 'VALIDATED', label: `Présélectionnés (${stats.validated})` },
                        { key: 'TO_REVIEW', label: `À examiner (${stats.toReview})` },
                        { key: 'REJECTED', label: `Refusés (${stats.rejected})` },
                        { key: 'HIRED', label: `Recrutés (${stats.hired})` },

                    ] as { key: DecisionFilter; label: string }[]).map(f => (
                        <button key={f.key} onClick={() => setFilter(f.key)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    filter === f.key
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700'
                                }`}>
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* Filtres - version mobile (dropdown) */}
                <div className="md:hidden">
                    <button
                        onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
                        className="w-full flex items-center justify-between px-3 py-2 bg-slate-700/50 rounded-xl text-slate-300 text-sm"
                    >
                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4" />
                            <span>Filtrer par statut</span>
                        </div>
                        <ChevronDown className={`w-4 h-4 transition-transform ${mobileFilterOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {mobileFilterOpen && (
                        <div className="mt-2 p-2 bg-slate-700/30 rounded-xl space-y-1">
                            {([
                                { key: 'ALL', label: `Tous (${applications.length})` },
                                { key: 'VALIDATED', label: `Présélectionnés (${stats.validated})` },
                                { key: 'TO_REVIEW', label: `À examiner (${stats.toReview})` },
                                { key: 'REJECTED', label: `Refusés (${stats.rejected})` },
                            ] as { key: DecisionFilter; label: string }[]).map(f => (
                                <button
                                    key={f.key}
                                    onClick={() => {
                                        setFilter(f.key)
                                        setMobileFilterOpen(false)
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                                        filter === f.key
                                            ? 'bg-purple-600 text-white'
                                            : 'text-slate-300 hover:bg-slate-600'
                                    }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Vue Desktop - Tableau (md et plus) */}
            <div className="hidden md:block overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="border-b border-slate-700 hover:bg-transparent">
                            {['Score IA', 'Candidat', 'Poste', 'Contact', 'Date', 'Statut', 'Actions'].map(h => (
                                <TableHead key={h}
                                           className="text-slate-400 text-xs font-semibold uppercase
                                               tracking-wider py-3 bg-slate-900/30">
                                    {h}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                                    Aucun résultat pour cette recherche
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map(app => {
                                const score = app.ai_score ?? 0
                                const sc = SCORE_CONFIG(score)
                                const dec = DECISION_CONFIG[app.ai_decision ?? 'PENDING']
                                const DecIcon = dec.icon

                                return (
                                    <TableRow key={app.id}
                                              className="border-b border-slate-700/50
                                                   hover:bg-slate-700/20 transition-all group">
                                        {/* Score */}
                                        <TableCell className="py-4">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-10 h-10 rounded-full ring-2 ${sc.ring}
                                                                bg-slate-900/60 flex items-center
                                                                justify-center shrink-0`}>
                                                    <span className={`text-sm font-bold ${sc.color}`}>
                                                        {score}
                                                    </span>
                                                </div>
                                                <span className={`text-xs hidden lg:inline ${sc.color}`}>
                                                    {sc.label}
                                                </span>
                                            </div>
                                        </TableCell>

                                        {/* Candidat */}
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Initials name={app.full_name} />
                                                <div>
                                                    <p className="text-white text-sm font-medium">
                                                        {app.full_name}
                                                    </p>
                                                </div>
                                            </div>
                                        </TableCell>

                                        {/* Poste */}
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 text-slate-400 text-sm">
                                                <Briefcase className="w-3.5 h-3.5 shrink-0 text-purple-400" />
                                                <span className="truncate max-w-[140px]">
                                                    {app.job_offer_title}
                                                </span>
                                            </div>
                                        </TableCell>

                                        {/* Contact */}
                                        <TableCell>
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-1 text-xs text-slate-400">
                                                    <Mail className="w-3 h-3 text-blue-400 shrink-0" />
                                                    <span className="truncate max-w-[160px]">{app.email}</span>
                                                </div>
                                                <div className="flex items-center gap-1 text-xs text-slate-400">
                                                    <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                                                    {app.phone}
                                                </div>
                                            </div>
                                        </TableCell>

                                        {/* Date */}
                                        <TableCell>
                                            <span className="text-slate-400 text-xs whitespace-nowrap">
                                                {formatDate(app.applied_date)}
                                            </span>
                                        </TableCell>

                                        {/* Statut */}
                                        <TableCell>
                                            <span className={`inline-flex items-center gap-1.5 text-xs
                                                             px-2.5 py-1 rounded-full border font-medium
                                                             ${dec.bg} ${dec.text} ${dec.border}`}>
                                                <DecIcon className="w-3 h-3" />
                                                {dec.label}
                                            </span>
                                        </TableCell>

                                        {/* Actions */}
                                        <TableCell>
                                            <button
                                                onClick={() => navigate(`/rh/applications/${app.id}`)}
                                                className="w-8 h-8 flex items-center justify-center
                                                           rounded-lg text-slate-500 hover:text-blue-400
                                                           hover:bg-blue-500/10 transition-all"
                                                title="Voir le profil">
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Vue Mobile - Cartes (moins de md) */}
            <div className="md:hidden">
                <div className="p-4 space-y-3">
                    {filtered.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            Aucun résultat pour cette recherche
                        </div>
                    ) : (
                        filtered.map(app => (
                            <MobileApplicationCard
                                key={app.id}
                                app={app}
                                onView={(id) => navigate(`/rh/applications/${id}`)}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* Footer stats responsive */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3
                            border-t border-slate-700 bg-slate-900/30">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                    {[
                        { dot: 'bg-emerald-400', label: `Présélectionnés : ${stats.validated}` },
                        { dot: 'bg-amber-400',   label: `À examiner : ${stats.toReview}` },
                        { dot: 'bg-red-400',     label: `Refusés : ${stats.rejected}` },
                    ].map(s => (
                        <span key={s.label} className="flex items-center gap-1.5 text-slate-400">
                            <div className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                            {s.label}
                        </span>
                    ))}
                </div>
                <span className="text-xs text-slate-500">
                    {filtered.length} / {applications.length} candidatures
                </span>
            </div>
        </div>
    )
}