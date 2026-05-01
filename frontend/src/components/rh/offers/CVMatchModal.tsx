// src/components/rh/offers/CVMatchModal.tsx

import { useState } from 'react'
import {
    X, Search, Star, Loader2, Mail,
    Phone, ExternalLink, ChevronRight
} from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import api from '../../../lib/api'

// ==============================================
// TYPES
// ==============================================

interface CVMatchCandidate {
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
        ai_decision: string
        ai_strengths: string[]
        previous_offer: string
        applied_date: string
    }
}

interface CVMatchStats {
    total: number
    strong_matches: number
    good_matches: number
    weak_matches: number
}

// ==============================================
// CARTE CANDIDAT
// ==============================================

function CVMatchCard({ match }: { match: CVMatchCandidate }) {
    const [expanded, setExpanded] = useState(false)
    const c = match.candidate

    const scoreColor =
        match.match_score >= 80 ? 'text-green-400' :
            match.match_score >= 60 ? 'text-blue-400' : 'text-yellow-400'

    const scoreBg =
        match.match_score >= 80 ? 'bg-green-500/10 border-green-500/30' :
            match.match_score >= 60 ? 'bg-blue-500/10 border-blue-500/30' :
                'bg-yellow-500/10 border-yellow-500/30'

    return (
        <div className="border rounded-xl p-4 bg-slate-800/50
                        border-slate-700 hover:border-slate-600 transition-all">

            {/* Header */}
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br
                                from-purple-500 to-blue-500 flex items-center
                                justify-center text-white font-bold text-sm shrink-0">
                    {c.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-white font-semibold truncate">
                            {c.full_name}
                        </p>
                        <div className={`flex items-center gap-1 px-3 py-1
                                        rounded-full border text-sm font-bold
                                        shrink-0 ${scoreBg} ${scoreColor}`}>
                            <Star className="w-3 h-3" />
                            {match.match_score}%
                        </div>
                    </div>
                    <p className="text-slate-400 text-xs mt-0.5 truncate">
                        {c.degree_level} · {c.experience_years} ans · {c.current_location}
                    </p>
                    <p className="text-slate-500 text-xs italic truncate">
                        Ancien poste : {c.previous_offer}
                    </p>
                </div>
            </div>

            {/* Résumé */}
            <p className="text-slate-400 text-xs mt-3 leading-relaxed">
                {match.summary}
            </p>

            {/* Compétences communes */}
            {match.matching_skills.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                    {match.matching_skills.slice(0, 4).map(skill => (
                        <span key={skill}
                              className="px-2 py-0.5 bg-green-500/10 text-green-400
                                       border border-green-500/20 rounded-full text-xs">
                            ✓ {skill}
                        </span>
                    ))}
                    {match.matching_skills.length > 4 && (
                        <span className="text-xs text-slate-500">
                            +{match.matching_skills.length - 4}
                        </span>
                    )}
                </div>
            )}

            {/* Compétences manquantes */}
            {match.missing_skills.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                    {match.missing_skills.slice(0, 3).map(skill => (
                        <span key={skill}
                              className="px-2 py-0.5 bg-red-500/10 text-red-400
                                       border border-red-500/20 rounded-full text-xs">
                            ✗ {skill}
                        </span>
                    ))}
                </div>
            )}

            {/* Toggle détails */}
            <button onClick={() => setExpanded(!expanded)}
                    className="mt-3 text-xs text-purple-400 hover:text-purple-300
                           flex items-center gap-1 transition-colors">
                {expanded ? 'Moins de détails' : 'Voir les détails'}
                <ChevronRight className={`w-3 h-3 transition-transform
                    ${expanded ? 'rotate-90' : ''}`} />
            </button>

            {/* Détails */}
            {expanded && (
                <div className="mt-3 pt-3 border-t border-slate-700 space-y-3">

                    {/* Contact */}
                    <div className="grid grid-cols-2 gap-2">
                        <a href={`mailto:${c.email}`}
                           className="flex items-center gap-2 text-xs
                                       text-slate-400 hover:text-white transition-colors">
                            <Mail className="w-3 h-3 text-blue-400 shrink-0" />
                            <span className="truncate">{c.email}</span>
                        </a>
                        {c.phone && (
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                <Phone className="w-3 h-3 text-green-400 shrink-0" />
                                <span>{c.phone}</span>
                            </div>
                        )}
                    </div>

                    {/* Liens */}
                    <div className="flex gap-3">
                        {c.linkedin_url && (
                            <a href={c.linkedin_url} target="_blank"
                               rel="noopener noreferrer"
                               className="flex items-center gap-1 text-xs
                                           text-blue-400 hover:text-blue-300">
                                <ExternalLink className="w-3 h-3" /> LinkedIn
                            </a>
                        )}
                        {c.portfolio_url && (
                            <a href={c.portfolio_url} target="_blank"
                               rel="noopener noreferrer"
                               className="flex items-center gap-1 text-xs
                                           text-purple-400 hover:text-purple-300">
                                <ExternalLink className="w-3 h-3" /> Portfolio
                            </a>
                        )}
                    </div>

                    {/* Score IA précédent */}
                    <div className="flex items-center justify-between
                                    bg-slate-900/50 rounded-lg px-3 py-2">
                        <span className="text-xs text-slate-400">
                            Score IA précédent
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
                            <p className="text-xs text-slate-500 mb-1">Forces</p>
                            <div className="flex flex-wrap gap-1">
                                {c.ai_strengths.slice(0, 3).map(s => (
                                    <span key={s}
                                          className="text-xs px-2 py-0.5 bg-purple-500/10
                                                   text-purple-300 rounded-full border
                                                   border-purple-500/20">
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
// MODAL PRINCIPAL
// ==============================================

interface CVMatchModalProps {
    offerId: number
    offerTitle: string
    onClose: () => void
}

export function CVMatchModal({ offerId, offerTitle, onClose }: CVMatchModalProps) {
    const [loading, setLoading]     = useState(false)
    const [results, setResults]     = useState<CVMatchCandidate[]>([])
    const [stats, setStats]         = useState<CVMatchStats | null>(null)
    const [searched, setSearched]   = useState(false)
    const [filterMin, setFilterMin] = useState(0)

    const handleSearch = async () => {
        setLoading(true)
        try {
            const response = await api.post(
                `/recruitment/rh/cv-match/${offerId}/`
            )
            setResults(response.data.matches)
            setStats(response.data.stats)
            setSearched(true)
        } catch (err) {
            console.error('Erreur CV match:', err)
        } finally {
            setLoading(false)
        }
    }

    const filtered = results.filter(r => r.match_score >= filterMin)

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]
                        flex items-center justify-center p-4"
             onClick={onClose}>
            <div className="bg-slate-900 border border-slate-700 rounded-2xl
                            w-full max-w-2xl max-h-[85vh] flex flex-col"
                 onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between p-5
                                border-b border-slate-800 shrink-0">
                    <div>
                        <h3 className="text-white font-bold flex items-center gap-2">
                            <Search className="w-5 h-5 text-purple-400" />
                            Matching anciens CVs
                        </h3>
                        <p className="text-slate-400 text-xs mt-0.5">
                            {offerTitle}
                        </p>
                    </div>
                    <button onClick={onClose}
                            className="text-slate-400 hover:text-white transition-colors p-1">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Contenu */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">

                    {/* État initial */}
                    {!searched && !loading && (
                        <div className="text-center py-10">
                            <div className="w-16 h-16 rounded-full bg-purple-600/20
                                            flex items-center justify-center mx-auto mb-4">
                                <Search className="w-8 h-8 text-purple-400" />
                            </div>
                            <p className="text-slate-300 font-medium mb-2">
                                Recherche IA dans les anciens CVs
                            </p>
                            <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">
                                L'IA analyse tous les anciens candidats et trouve
                                ceux qui correspondent à cette offre.
                            </p>
                            <Button onClick={handleSearch}
                                    className="bg-purple-600 hover:bg-purple-700 text-white px-8">
                                <Search className="w-4 h-4 mr-2" />
                                Lancer la recherche
                            </Button>
                        </div>
                    )}

                    {/* Chargement */}
                    {loading && (
                        <div className="text-center py-10">
                            <Loader2 className="w-10 h-10 animate-spin
                                               text-purple-400 mx-auto mb-3" />
                            <p className="text-slate-400">Analyse IA en cours...</p>
                            <p className="text-slate-500 text-xs mt-1">
                                Cela peut prendre quelques secondes
                            </p>
                        </div>
                    )}

                    {/* Résultats */}
                    {searched && !loading && (
                        <>
                            {/* Stats */}
                            {stats && (
                                <div className="grid grid-cols-4 gap-3">
                                    {[
                                        { label: 'Total',  value: stats.total,          color: 'text-white' },
                                        { label: '≥80%',   value: stats.strong_matches, color: 'text-green-400' },
                                        { label: '60-79%', value: stats.good_matches,   color: 'text-blue-400' },
                                        { label: '30-59%', value: stats.weak_matches,   color: 'text-yellow-400' },
                                    ].map(s => (
                                        <div key={s.label}
                                             className="bg-slate-800 rounded-lg p-3 text-center">
                                            <p className={`text-xl font-bold ${s.color}`}>
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
                            {results.length > 0 && (
                                <div className="flex items-center gap-3 flex-wrap">
                                    <span className="text-xs text-slate-400 shrink-0">
                                        Filtrer :
                                    </span>
                                    <div className="flex gap-2 flex-wrap">
                                        {[0, 30, 60, 80].map(min => (
                                            <button key={min}
                                                    onClick={() => setFilterMin(min)}
                                                    className={`px-3 py-1 rounded-full text-xs
                                                           font-medium transition-all ${
                                                        filterMin === min
                                                            ? 'bg-purple-600 text-white'
                                                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                                    }`}>
                                                {min === 0 ? 'Tous' : `≥${min}%`}
                                            </button>
                                        ))}
                                    </div>
                                    <span className="text-xs text-slate-500 ml-auto">
                                        {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
                                    </span>
                                </div>
                            )}

                            {/* Liste */}
                            {filtered.length === 0 ? (
                                <div className="text-center py-8">
                                    <p className="text-slate-400">
                                        Aucun candidat correspondant
                                    </p>
                                    <p className="text-slate-500 text-sm mt-1">
                                        Essayez de réduire le filtre
                                    </p>
                                    <button onClick={handleSearch}
                                            className="mt-4 text-xs text-purple-400
                                                   hover:text-purple-300 flex items-center
                                                   gap-1 mx-auto">
                                        <Search className="w-3 h-3" />
                                        Relancer l'analyse
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {filtered.map(match => (
                                        <CVMatchCard key={match.id} match={match} />
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}