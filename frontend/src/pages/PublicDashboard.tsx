import { useEffect, useState } from 'react'
import { Header } from '../components/Header'
import { JobCard } from '../components/JobCard'
import api from '../lib/api'
import { Skeleton } from '../../components/ui/skeleton'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Badge } from '../../components/ui/badge'
import {
    Search,
    Briefcase,
    MapPin,
    Clock,
    Filter,
    ChevronRight,
    TrendingUp,
    Sparkles,
    Building2,
    GraduationCap
} from 'lucide-react'

interface Job {
    id: number
    title: string
    description: string
    created_at: string
    location?: string
    type?: string
    department?: string
    salary?: string
}

export function PublicDashboard() {
    const [jobs, setJobs] = useState<Job[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedFilter, setSelectedFilter] = useState('all')
    const [stats, setStats] = useState({
        totalJobs: 0,
        newThisWeek: 0,
        locations: 0
    })

    useEffect(() => {
        const fetchJobs = async () => {
            try {
                setLoading(true)
                const response = await api.get('/recruitment/jobs/')
                setJobs(response.data)

                const oneWeekAgo = new Date()
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

                setStats({
                    totalJobs: response.data.length,
                    newThisWeek: response.data.filter((job: Job) =>
                        new Date(job.created_at) > oneWeekAgo
                    ).length,
                    locations: new Set(response.data.map((job: Job) => job.location)).size
                })

                setError(null)
            } catch (err) {
                console.error('Erreur lors du chargement des offres:', err)
                setError('Erreur lors du chargement des offres d\'emploi')
            } finally {
                setLoading(false)
            }
        }

        fetchJobs()
    }, [])

    const filteredJobs = jobs.filter(job =>
        job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.location?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const filters = [
        { id: 'all', label: 'Toutes les offres', count: jobs.length },
        { id: 'recent', label: 'Récentes', count: stats.newThisWeek },
        { id: 'tech', label: 'Tech', count: jobs.filter(j => j.department === 'Tech').length },
        { id: 'marketing', label: 'Marketing', count: jobs.filter(j => j.department === 'Marketing').length }
    ]

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
            <Header showLoginButton={true} />

            {/* Hero Section Modernisée */}
            <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-950 dark:via-indigo-950 dark:to-purple-950">
                {/* Éléments décoratifs */}
                <div className="absolute inset-0">
                    <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-white/10 to-transparent" />
                    <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
                    <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-20" />
                </div>

                <div className="relative max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-24">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        {/* Contenu texte */}
                        <div className="space-y-6 text-white">
                            <Badge className="bg-white/20 text-white border-0 hover:bg-white/30 backdrop-blur-sm px-4 py-1.5 rounded-full text-sm font-medium inline-flex items-center gap-2">
                                <Sparkles className="w-4 h-4" />
                                Plus de {jobs.length} opportunités disponibles
                            </Badge>

                            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                                Découvrez votre
                                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-pink-200">
                                    prochain défi professionnel
                                </span>
                            </h1>

                            <p className="text-lg text-white/80 max-w-xl">
                                Explorez des milliers d'offres d'emploi exclusives et rejoignez les meilleures entreprises qui recrutent dans votre domaine.
                            </p>

                            {/* Statistiques */}
                            <div className="flex items-center gap-8 pt-4">
                                <div>
                                    <div className="text-3xl font-bold">{stats.totalJobs}</div>
                                    <div className="text-sm text-white/60">Offres actives</div>
                                </div>
                                <div className="w-px h-10 bg-white/20" />
                                <div>
                                    <div className="text-3xl font-bold">{stats.newThisWeek}</div>
                                    <div className="text-sm text-white/60">Nouvelles cette semaine</div>
                                </div>
                                <div className="w-px h-10 bg-white/20" />
                                <div>
                                    <div className="text-3xl font-bold">{stats.locations}</div>
                                    <div className="text-sm text-white/60">Villes</div>
                                </div>
                            </div>
                        </div>

                        {/* Formulaire de recherche rapide */}
                        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                            <h3 className="text-white text-lg font-semibold mb-4">Rechercher une offre</h3>
                            <div className="space-y-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
                                    <Input
                                        placeholder="Titre du poste, compétence, lieu..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10 h-12 bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl focus:border-white focus:ring-white/20"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <Button className="bg-white text-blue-600 hover:bg-white/90 h-12 rounded-xl font-semibold">
                                        Rechercher
                                    </Button>
                                    <Button variant="outline" className="border-white/30 text-white hover:bg-white/20 h-12 rounded-xl">
                                        <Filter className="w-4 h-4 mr-2" />
                                        Filtres
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Vague décorative */}
                <div className="absolute bottom-0 left-0 right-0">
                    <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
                        <path d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" fill="white" fillOpacity="0.95" className="dark:fill-slate-950 dark:fill-opacity-95"/>
                    </svg>
                </div>
            </section>

            {/* Section Filtres */}
            <section className="max-w-7xl mx-auto px-4 md:px-8 -mt-8 relative z-10">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-4">
                    <div className="flex flex-wrap items-center gap-3">
                        {filters.map((filter) => (
                            <button
                                key={filter.id}
                                onClick={() => setSelectedFilter(filter.id)}
                                className={`
                                    px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200
                                    ${selectedFilter === filter.id
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }
                                `}
                            >
                                {filter.label}
                                {filter.count > 0 && (
                                    <span className={`
                                        ml-2 px-2 py-0.5 rounded-full text-xs
                                        ${selectedFilter === filter.id
                                        ? 'bg-white/20 text-white'
                                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                                    }
                                    `}>
                                        {filter.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* Section principale des offres */}
            <section className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-20">
                {error && (
                    <div className="mb-8 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 flex items-center gap-3">
                        <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                            <Briefcase className="w-5 h-5" />
                        </div>
                        <span>{error}</span>
                    </div>
                )}

                {/* En-tête de section */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                            {searchTerm ? 'Résultats de recherche' : 'Offres recommandées'}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {filteredJobs.length} offre(s) disponible(s)
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="sm" className="gap-2">
                            <TrendingUp className="w-4 h-4" />
                            Plus récentes
                        </Button>
                        <Button variant="outline" size="sm" className="gap-2">
                            <MapPin className="w-4 h-4" />
                            Proches de moi
                        </Button>
                    </div>
                </div>

                {/* Grille des offres */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="space-y-4">
                                <Skeleton className="h-48 rounded-xl" />
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-4 w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredJobs.length > 0 ? (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredJobs.map((job, index) => (
                                <div
                                    key={job.id}
                                    className="animate-in fade-in slide-in-from-bottom-4 duration-700"
                                    style={{ animationDelay: `${index * 100}ms` }}
                                >
                                    <JobCard
                                        id={job.id}
                                        title={job.title}
                                        description={job.description}
                                        createdAt={job.created_at}
                                        location={job.location}
                                        type={job.type}
                                    />
                                </div>
                            ))}
                        </div>

                        {/* Bouton Voir plus */}
                        {filteredJobs.length > 6 && (
                            <div className="text-center mt-12">
                                <Button className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white h-12 px-8 rounded-xl font-semibold gap-2">
                                    Voir plus d'offres
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <Briefcase className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                            Aucune offre trouvée
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-6">
                            Essayez de modifier vos filtres ou revenez plus tard.
                        </p>
                        <Button
                            onClick={() => setSearchTerm('')}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 h-11 rounded-xl"
                        >
                            Réinitialiser la recherche
                        </Button>
                    </div>
                )}
            </section>

            {/* Section "Pourquoi nous rejoindre" */}
            <section className="bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 py-16">
                <div className="max-w-7xl mx-auto px-4 md:px-8">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
                            Pourquoi postuler chez nous ?
                        </h2>
                        <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                            Rejoignez des entreprises innovantes et donnez un nouvel élan à votre carrière.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            {
                                icon: Building2,
                                title: "Entreprises de renom",
                                description: "Collaborez avec les meilleures entreprises du marché"
                            },
                            {
                                icon: GraduationCap,
                                title: "Développement continu",
                                description: "Accédez à des formations et évoluez dans votre carrière"
                            },
                            {
                                icon: Clock,
                                title: "Processus rapide",
                                description: "Des réponses sous 48h pour toutes vos candidatures"
                            }
                        ].map((item, i) => (
                            <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-900 transition-colors">
                                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-4">
                                    <item.icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                                    {item.title}
                                </h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    {item.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    )
}