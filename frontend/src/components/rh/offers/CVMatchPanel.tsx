// src/components/rh/offers/CVMatchPanel.tsx

import { useState } from 'react'
import {
    X, Search, Star, Loader2,
    Mail, Phone, ExternalLink, ChevronRight
} from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import api from '../../../lib/api'

// ==============================================
// TYPES
// ==============================================

interface MatchCandidate {
    id: number
    match_score: number
    matching_skills: string[]
    missing_skills: string[]
    summary: string
    candidate: {
        id: number
        full_name: string
        email: string
        phone: string
        experience_years: number
        degree_level: string
        university: string
        current_location: string
        linkedin_url: string
        portfolio_url: string
        ai_score: number
        ai_strengths: string[]
        previous_offer: string
        applied_date: string
    }
}

interface MatchStats {
    total: number
    strong_matches: number
    good_matches: number
    weak_matches: number
}

interface CVMatchPanelProps {
    title: string
    requirements: string
    softSkills: string
    experienceYears: string
    educationLevel: string
    onClose: () => void
}

// ==============================================
// CARTE CANDIDAT
// ==============================================

function CandidateCard({ match }: { match: MatchCandidate }) {
    const [expanded, setExpanded] = useState(false)
    const c = match.candidate

    const scoreColor =
        match.match_score >= 80 ? 'text-green-400' :
            match.match_score >= 60 ? 'text-blue-400' : 'text-yellow-400'

    const scoreBg =
        match.match_score >= 80
            ? 'bg-green-500/10 border-green-500/30' :
            match.match_score >= 60
                ? 'bg-blue-500/10 border-blue-500/30' :
                'bg-yellow-500/10 border-yellow-500/30'

    const initials = c.full_name
        .split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

    return (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4
                        hover:border-slate-600 transition-all">

            {/* Header */}
            <div className="flex items-start gap-3">

                {/* Avatar */}
                <div className="w-10 h-10 rounded-full shrink-0
                                bg-gradient-to-br from-purple-500 to-blue-500
                                flex items-center justify-center
                                text-white text-sm font-bold">
                    {initials}
                </div>

                {/* Infos */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-white font-semibold text-sm truncate">
                            {c.full_name}
                        </p>
                        {/* Score */}
                        <div className={`flex items-center gap-1 px-2.5 py-0.5
                                        rounded-full border text-xs font-bold
                                        shrink-0 ${scoreBg} ${scoreColor}`}>
                            <Star className="w-3 h-3" />
                            {match.match_score}%
                        </div>
                    </div>
                    <p className="text-slate-400 text-xs mt-0.5">
                        {c.degree_level}
                        {c.experience_years > 0 && ` · ${c.experience_years} ans`}
                        {c.current_location && ` · ${c.current_location}`}
                    </p>
                    <p className="text-slate-500 text-xs italic mt-0.5 truncate">
                        Ancienne candidature : {c.previous_offer}
                    </p>
                </div>
            </div>

            {/* Résumé IA */}
            {match.summary && (
                <p className="text-slate-400 text-xs mt-3 leading-relaxed">
                    {match.summary}
                </p>
            )}

            {/* Compétences */}
            <div className="mt-3 flex flex-wrap gap-1.5">
                {match.matching_skills.slice(0, 5).map(skill => (
                    <span key={skill}
                          className="px-2 py-0.5 bg-green-500/10 text-green-400
                                   border border-green-500/20 rounded-full text-xs">
                        ✓ {skill}
                    </span>
                ))}
                {match.missing_skills.slice(0, 3).map(skill => (
                    <span key={skill}
                          className="px-2 py-0.5 bg-red-500/10 text-red-400
                                   border border-red-500/20 rounded-full text-xs">
                        ✗ {skill}
                    </span>
                ))}
            </div>

            {/* Toggle contact */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="mt-3 flex items-center gap-1 text-xs
                           text-purple-400 hover:text-purple-300 transition-colors"
            >
                {expanded ? 'Masquer' : 'Voir le contact'}
                <ChevronRight className={`w-3 h-3 transition-transform
                    ${expanded ? 'rotate-90' : ''}`} />
            </button>

            {/* Contact expandé */}
            {expanded && (
                <div className="mt-3 pt-3 border-t border-slate-700 space-y-2">

                    {/* Email */}
                    <a href={`mailto:${c.email}`}
                       className="flex items-center gap-2 text-xs
                                   text-slate-400 hover:text-white transition-colors">
                        <Mail className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className="truncate">{c.email}</span>
                    </a>

                    {/* Téléphone */}
                    {c.phone && (
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                            <Phone className="w-3.5 h-3.5 text-green-400 shrink-0" />
                            <span>{c.phone}</span>
                        </div>
                    )}

                    {/* Liens */}
                    <div className="flex gap-3 pt-1">
                        {c.linkedin_url && (
                            <a href={c.linkedin_url} target="_blank"
                               rel="noopener noreferrer"
                               className="flex items-center gap-1 text-xs
                                           text-blue-400 hover:text-blue-300">
                                <ExternalLink className="w-3 h-3" />
                                LinkedIn
                            </a>
                        )}
                        {c.portfolio_url && (
                            <a href={c.portfolio_url} target="_blank"
                               rel="noopener noreferrer"
                               className="flex items-center gap-1 text-xs
                                           text-purple-400 hover:text-purple-300">
                                <ExternalLink className="w-3 h-3" />
                                Portfolio
                            </a>
                        )}
                    </div>

                    {/* Score IA précédent */}
                    <div className="flex items-center justify-between
                                    bg-slate-900/60 rounded-lg px-3 py-2 mt-1">
                        <span className="text-xs text-slate-500">
                            Score IA (candidature précédente)
                        </span>
                        <span className={`text-sm font-bold ${
                            c.ai_score >= 80 ? 'text-green-400' :
                                c.ai_score >= 60 ? 'text-blue-400' : 'text-yellow-400'
                        }`}>
                            {c.ai_score}/100
                        </span>
                    </div>

                    {/* Forces */}
                    {c.ai_strengths.length > 0 && (
                        <div>
                            <p className="text-xs text-slate-600 mb-1.5">Forces identifiées</p>
                            <div className="flex flex-wrap gap-1">
                                {c.ai_strengths.slice(0, 3).map(s => (
                                    <span key={s}
                                          className="text-xs px-2 py-0.5 bg-purple-500/10
                                                   text-purple-300 border border-purple-500/20
                                                   rounded-full">
                                        {s}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ==============================================
// PANEL PRINCIPAL
// ==============================================

export function CVMatchPanel({
                                 title, requirements, softSkills,
                                 experienceYears, educationLevel, onClose
                             }: CVMatchPanelProps) {

    const [loading, setLoading]     = useState(false)
    const [matches, setMatches]     = useState<MatchCandidate[]>([])
    const [stats, setStats]         = useState<MatchStats | null>(null)
    const [searched, setSearched]   = useState(false)
    const [filterMin, setFilterMin] = useState(0)

    const handleSearch = async () => {
        setLoading(true)
        try {
            const response = await api.post('/recruitment/rh/cv-match-preview/', {
                title,
                requirements,
                soft_skills:      softSkills,
                experience_years: parseInt(experienceYears) || 0,
                education_level:  educationLevel,
            })
            setMatches(response.data.matches || [])
            setStats(response.data.stats || null)
            setSearched(true)
        } catch (err) {
            console.error('Erreur CV match:', err)
        } finally {
            setLoading(false)
        }
    }

    const filtered = matches.filter(m => m.match_score >= filterMin)

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50
                       flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-slate-900 border border-slate-700 rounded-2xl
                           w-full max-w-2xl max-h-[88vh] flex flex-col
                           shadow-2xl shadow-black/50"
                onClick={e => e.stopPropagation()}
            >

                {/* ── Header ── */}
                <div className="flex items-center justify-between px-6 py-4
                                border-b border-slate-800 shrink-0">
                    <div>
                        <h2 className="text-white font-bold flex items-center gap-2">
                            <Search className="w-5 h-5 text-purple-400" />
                            Matching anciens CVs
                        </h2>
                        <p className="text-slate-400 text-xs mt-0.5">
                            Recherche pour : <span className="text-white">{title}</span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg bg-slate-800 flex items-center
                                   justify-center text-slate-400 hover:text-white
                                   hover:bg-slate-700 transition-all"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* ── Contenu ── */}
                <div className="flex-1 overflow-y-auto">

                    {/* État initial */}
                    {!searched && !loading && (
                        <div className="flex flex-col items-center justify-center
                                        py-16 px-8 text-center">
                            <div className="w-20 h-20 rounded-2xl bg-purple-600/10
                                            border border-purple-500/20
                                            flex items-center justify-center mb-5">
                                <Search className="w-10 h-10 text-purple-400" />
                            </div>
                            <h3 className="text-white font-semibold mb-2">
                                Recherche IA dans les anciens CVs
                            </h3>
                            <p className="text-slate-400 text-sm mb-8 max-w-sm leading-relaxed">
                                L'IA va analyser tous les candidats précédents
                                et identifier ceux qui correspondent le mieux
                                à votre offre.
                            </p>
                            <Button
                                onClick={handleSearch}
                                className="bg-purple-600 hover:bg-purple-700
                                           text-white px-8 h-11 rounded-xl font-medium"
                            >
                                <Search className="w-4 h-4 mr-2" />
                                Lancer l'analyse IA
                            </Button>
                        </div>
                    )}

                    {/* Chargement */}
                    {loading && (
                        <div className="flex flex-col items-center justify-center
                                        py-16 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-purple-600/10
                                            flex items-center justify-center mb-4">
                                <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                            </div>
                            <p className="text-white font-medium">Analyse IA en cours</p>
                            <p className="text-slate-400 text-sm mt-1">
                                Comparaison avec tous les anciens candidats...
                            </p>
                        </div>
                    )}

                    {/* Résultats */}
                    {searched && !loading && (
                        <div className="p-5 space-y-4">

                            {/* Stats */}
                            {stats && (
                                <div className="grid grid-cols-4 gap-3">
                                    {[
                                        {
                                            label: 'Trouvés',
                                            value: stats.total,
                                            color: 'text-white',
                                            bg: 'bg-slate-800'
                                        },
                                        {
                                            label: 'Excellent',
                                            value: stats.strong_matches,
                                            color: 'text-green-400',
                                            bg: 'bg-green-500/10'
                                        },
                                        {
                                            label: 'Bon',
                                            value: stats.good_matches,
                                            color: 'text-blue-400',
                                            bg: 'bg-blue-500/10'
                                        },
                                        {
                                            label: 'Partiel',
                                            value: stats.weak_matches,
                                            color: 'text-yellow-400',
                                            bg: 'bg-yellow-500/10'
                                        },
                                    ].map(s => (
                                        <div key={s.label}
                                             className={`${s.bg} rounded-xl p-3 text-center
                                                        border border-slate-700`}>
                                            <p className={`text-2xl font-bold ${s.color}`}>
                                                {s.value}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                {s.label}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Filtres */}
                            {matches.length > 0 && (
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs text-slate-500 shrink-0">
                                        Filtrer :
                                    </span>
                                    {[
                                        { min: 0,  label: 'Tous' },
                                        { min: 80, label: '≥80% Excellent' },
                                        { min: 60, label: '≥60% Bon' },
                                        { min: 30, label: '≥30% Partiel' },
                                    ].map(f => (
                                        <button
                                            key={f.min}
                                            onClick={() => setFilterMin(f.min)}
                                            className={`px-3 py-1 rounded-full text-xs
                                                       font-medium transition-all ${
                                                filterMin === f.min
                                                    ? 'bg-purple-600 text-white'
                                                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                            }`}
                                        >
                                            {f.label}
                                        </button>
                                    ))}
                                    <span className="text-xs text-slate-600 ml-auto">
                                        {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
                                    </span>
                                </div>
                            )}

                            {/* Liste candidats */}
                            {filtered.length === 0 ? (
                                <div className="text-center py-10">
                                    <p className="text-slate-400 mb-1">
                                        Aucun candidat correspondant
                                    </p>
                                    <p className="text-slate-500 text-sm">
                                        Essayez de réduire le filtre ou enrichissez l'offre
                                    </p>
                                    <button
                                        onClick={handleSearch}
                                        className="mt-4 text-xs text-purple-400
                                                   hover:text-purple-300 flex items-center
                                                   gap-1 mx-auto"
                                    >
                                        <Search className="w-3 h-3" />
                                        Relancer l'analyse
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {filtered.map(match => (
                                        <CandidateCard key={match.id} match={match} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}