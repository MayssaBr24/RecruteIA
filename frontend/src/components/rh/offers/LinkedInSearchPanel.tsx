import React, { useState } from 'react'
import {
    Linkedin, Search, X, Loader2, ExternalLink,
    MapPin, Briefcase, Building2,
    AlertCircle, Users, RefreshCw, Mail, Star
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface LinkedInProfile {
    url:        string
    prenom:     string
    nom:        string
    titre:      string
    entreprise: string
    summary:    string
    email:      string | null
    score:      number
    location:   string
}

interface RawLinkedInProfile {
    url:        string
    prenom?:     string
    nom?:        string
    titre?:      string
    entreprise?: string
    summary?:    string
    email?:      string | null
    score?:      number
    location?:   string
}

interface ApiResponse {
    profiles: RawLinkedInProfile[]
}

interface LinkedInSearchPanelProps {
    jobTitle:     string
    location:     string
    requirements: string
    onClose:      () => void
    onImport:     (profiles: LinkedInProfile[]) => void
}

const N8N_WEBHOOK_URL = 'http://localhost:8888/api/recruitment/linkedin/search/'

// ─── Composant principal ──────────────────────────────────────────────────────

export function LinkedInSearchPanel({
                                        jobTitle, location, requirements, onClose, onImport
                                    }: LinkedInSearchPanelProps) {
    const [loading,  setLoading]  = useState(false)
    const [profiles, setProfiles] = useState<LinkedInProfile[]>([])
    const [error,    setError]    = useState<string | null>(null)
    const [searched, setSearched] = useState(false)

    const industry = requirements.split(',')[0]?.trim() || jobTitle

    const handleSearch = async () => {
        setLoading(true)
        setError(null)
        setProfiles([])
        setSearched(false)

        try {
            const response = await fetch(N8N_WEBHOOK_URL, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    JobTitle:        jobTitle,
                    CompanyIndustry: industry,
                    Location:        location,
                }),
            })

            if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`)

            const data = await response.json() as ApiResponse
            const profileList: LinkedInProfile[] = (data.profiles || [])
                .filter((p: RawLinkedInProfile) => p?.url)
                .map((p: RawLinkedInProfile) => ({
                    url:        p.url        || '',
                    prenom:     p.prenom     || '',
                    nom:        p.nom        || '',
                    titre:      p.titre      || '',
                    entreprise: p.entreprise || '',
                    summary:    p.summary    || '',
                    email:      p.email      ?? null,
                    score:      p.score      ?? 0,
                    location:   p.location   || '',
                }))

            setProfiles(profileList)
            setSearched(true)
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la recherche'
            setError(errorMessage)
            setSearched(true)
        } finally {
            setLoading(false)
        }
    }

    const handleImport = () => {
        if (profiles.length > 0) {
            onImport(profiles)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>

            <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col
                            bg-slate-900 border border-slate-700 rounded-2xl
                            shadow-2xl shadow-blue-900/20 overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4
                                border-b border-slate-700 bg-slate-800/60">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-9 h-9
                                        rounded-xl bg-blue-600/20 border border-blue-500/30">
                            <Linkedin className="w-4 h-4 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-white font-semibold text-sm">Sourcing LinkedIn</h2>
                            <p className="text-slate-500 text-xs">Recherche de profils via SerpAPI</p>
                        </div>
                    </div>
                    <button onClick={onClose}
                            className="flex items-center justify-center w-8 h-8 rounded-lg
                                       text-slate-500 hover:text-white hover:bg-slate-700 transition-all">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Paramètres */}
                <div className="px-6 py-4 border-b border-slate-700/50 bg-slate-800/30">
                    <div className="grid grid-cols-3 gap-3 mb-4">
                        <SearchParam icon={<Briefcase className="w-3.5 h-3.5" />}
                                     label="Poste" value={jobTitle} color="purple" />
                        <SearchParam icon={<Building2 className="w-3.5 h-3.5" />}
                                     label="Domaine" value={industry} color="blue" />
                        <SearchParam icon={<MapPin className="w-3.5 h-3.5" />}
                                     label="Lieu" value={location || '—'} color="green" />
                    </div>
                    <button onClick={handleSearch}
                            disabled={loading || !jobTitle || !location}
                            className="w-full flex items-center justify-center gap-2
                                       h-11 rounded-xl font-semibold text-sm transition-all
                                       disabled:opacity-40 disabled:cursor-not-allowed
                                       bg-gradient-to-r from-blue-600 to-blue-500
                                       hover:from-blue-500 hover:to-blue-400
                                       text-white shadow-lg shadow-blue-900/30">
                        {loading ? (
                            <><Loader2 className="w-4 h-4 animate-spin" />Recherche en cours...</>
                        ) : searched ? (
                            <><RefreshCw className="w-4 h-4" />Relancer la recherche</>
                        ) : (
                            <><Search className="w-4 h-4" />Lancer la recherche LinkedIn</>
                        )}
                    </button>
                </div>

                {/* Résultats */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">

                    {!searched && !loading && (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-blue-500/10
                                            border border-blue-500/20 flex items-center justify-center mb-4">
                                <Linkedin className="w-6 h-6 text-blue-400" />
                            </div>
                            <p className="text-slate-400 text-sm">Cliquez sur "Lancer la recherche"</p>
                            <p className="text-slate-500 text-xs mt-1">pour trouver des profils LinkedIn</p>
                        </div>
                    )}

                    {error && (
                        <div className="flex items-start gap-3 p-4 rounded-xl
                                        bg-red-500/10 border border-red-500/20">
                            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-red-400 text-sm font-medium">Erreur de connexion</p>
                                <p className="text-red-500/70 text-xs mt-1">{error}</p>
                            </div>
                        </div>
                    )}

                    {searched && !error && profiles.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                            <Users className="w-10 h-10 text-slate-600 mb-3" />
                            <p className="text-slate-400 text-sm">Aucun profil trouvé</p>
                        </div>
                    )}

                    {profiles.length > 0 && (
                        <>
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs text-slate-500">
                                    {profiles.length} profil{profiles.length > 1 ? 's' : ''} trouvé{profiles.length > 1 ? 's' : ''}
                                </span>
                            </div>

                            {profiles.map((profile, i) => (
                                <ProfileCard key={i} profile={profile} />
                            ))}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-700 bg-slate-800/40 flex justify-end gap-3">
                    <button onClick={onClose}
                            className="px-4 py-2 rounded-xl text-sm text-slate-400
                                       hover:text-white hover:bg-slate-700 transition-all">
                        Fermer
                    </button>
                    {profiles.length > 0 && (
                        <button onClick={handleImport}
                                className="px-4 py-2 rounded-xl text-sm font-medium
                                          bg-gradient-to-r from-blue-600 to-blue-500
                                          hover:from-blue-500 hover:to-blue-400
                                          text-white transition-all shadow-lg shadow-blue-900/30">
                            Importer {profiles.length} profil{profiles.length > 1 ? 's' : ''}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

// ─── Score badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
    const color =
        score >= 70 ? 'text-green-400 bg-green-500/10 border-green-500/30' :
            score >= 40 ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' :
                'text-slate-400 bg-slate-700/40 border-slate-600/30'

    return (
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-xs font-semibold ${color}`}>
            <Star className="w-3 h-3" />
            {score}
        </div>
    )
}

// ─── ProfileCard ──────────────────────────────────────────────────────────────

function ProfileCard({ profile }: { profile: LinkedInProfile }) {
    const slugName = profile.url
        .replace(/https?:\/\/[a-z]+\.linkedin\.com\/in\//i, '')
        .replace(/\/$/, '')
        .replace(/-/g, ' ')

    const fullName = [profile.prenom, profile.nom].filter(Boolean).join(' ') || slugName
    const initials = [profile.prenom?.[0], profile.nom?.[0]].filter(Boolean).join('').toUpperCase() || '?'

    return (
        <div className="flex items-start gap-3 p-4 rounded-xl border
                        bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-all duration-150">

            {/* Avatar initiales */}
            <div className="shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br
                            from-blue-600/30 to-purple-600/30 border border-slate-600
                            flex items-center justify-center mt-0.5">
                <span className="text-xs font-bold text-slate-300">{initials}</span>
            </div>

            {/* Infos */}
            <div className="flex-1 min-w-0">

                {/* Nom + Score */}
                <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white text-sm font-semibold capitalize">
                        {fullName}
                    </p>
                    <ScoreBadge score={profile.score} />
                </div>

                {/* Titre @ Entreprise */}
                {(profile.titre || profile.entreprise) && (
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                        {profile.titre && (
                            <span className="text-blue-400 text-xs">{profile.titre}</span>
                        )}
                        {profile.titre && profile.entreprise && (
                            <span className="text-slate-600 text-xs">chez</span>
                        )}
                        {profile.entreprise && (
                            <span className="text-slate-400 text-xs">{profile.entreprise}</span>
                        )}
                    </div>
                )}

                {/* Location */}
                {profile.location && (
                    <div className="flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        <span className="text-slate-500 text-xs">{profile.location}</span>
                    </div>
                )}

                {/* Email */}
                {profile.email && (
                    <div className="flex items-center gap-1 mt-1">
                        <Mail className="w-3 h-3 text-green-400" />
                        <span className="text-green-400 text-xs">{profile.email}</span>
                    </div>
                )}

                {/* Summary complète, sans troncature */}
                {profile.summary && (
                    <p className="text-slate-400 text-xs mt-2 leading-relaxed whitespace-pre-wrap break-words">
                        {profile.summary}
                    </p>
                )}

                {/* URL */}
                <p className="text-blue-500/40 text-xs mt-1 font-mono break-all">{profile.url}</p>
            </div>

            {/* Lien externe */}
            <a href={profile.url} target="_blank" rel="noopener noreferrer"
               className="shrink-0 flex items-center justify-center w-7 h-7
                          rounded-lg text-slate-600 hover:text-blue-400
                          hover:bg-blue-500/10 transition-all mt-0.5">
                <ExternalLink className="w-3.5 h-3.5" />
            </a>
        </div>
    )
}

// ─── SearchParam ──────────────────────────────────────────────────────────────

function SearchParam({ icon, label, value, color }: {
    icon:  React.ReactNode
    label: string
    value: string
    color: 'purple' | 'blue' | 'green'
}) {
    const colors = {
        purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
        blue:   'text-blue-400   bg-blue-500/10   border-blue-500/20',
        green:  'text-green-400  bg-green-500/10  border-green-500/20',
    }
    return (
        <div className={`flex flex-col gap-1 p-3 rounded-xl border ${colors[color]}`}>
            <div className="flex items-center gap-1.5 opacity-70">
                {icon}
                <span className="text-xs">{label}</span>
            </div>
            <span className="text-white text-xs font-medium break-words" title={value}>{value}</span>
        </div>
    )
}