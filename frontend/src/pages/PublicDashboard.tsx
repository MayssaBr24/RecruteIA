import { useState } from 'react';

import {
    Search, Briefcase, TrendingUp, Sparkles,
    Building2, Award, Users, BrainCircuit, CheckCircle,
    MapPin, ChevronRight, Rocket,
    Shield, ArrowRight, Compass, Star, Clock, Zap, BellIcon
} from 'lucide-react';
import {FilterId, FILTERS} from "../types/filters.ts";
import {useJobsData} from "../hooks/useJobsData.ts";
import {isJobActive, isNewThisWeek} from "../types/dateUtils.ts";
import {Header} from "../components/Header.tsx";
import {NeuralNetworkHero} from "../components/PublicDashboard/NeuralNetworkHero.tsx";
import {StatBlock} from "../components/PublicDashboard/StatBlock.tsx";
import {FilterChip} from "../components/PublicDashboard/FilterChip.tsx";
import {JobCard} from "../components/JobCard.tsx";
import {CardSkeleton} from "../components/PublicDashboard/CardSkeleton.tsx";
import {FeatureCard} from "../components/PublicDashboard/FeatureCard.tsx";



export function PublicDashboard() {
    const { jobs, loading, error, stats } = useJobsData();
    const [searchTerm, setSearchTerm] = useState('');
    const [heroSearch, setHeroSearch] = useState('');
    const [filter, setFilter] = useState<FilterId>('all');

    const doSearch = () => {
        setSearchTerm(heroSearch);
        document.getElementById('offres')?.scrollIntoView({ behavior: 'smooth' });
    };

    const filteredJobs = jobs.filter(job => {
        if (!isJobActive(job)) return false;

        const q = searchTerm.toLowerCase();
        const matchQ = !q
            || job.title.toLowerCase().includes(q)
            || job.description.toLowerCase().includes(q)
            || (job.location ?? '').toLowerCase().includes(q)
            || (job.company_name ?? '').toLowerCase().includes(q);

        const matchF = filter === 'all' ? true
            : filter === 'recent' ? isNewThisWeek(job.created_at)
                : filter === 'tech' ? job.department === 'Tech'
                    : filter === 'remote' ? (job.location ?? '').toLowerCase().includes('remote')
                        : filter === 'marketing' ? job.department === 'Marketing'
                            : true;

        return matchQ && matchF;
    });

    const featuredJobs = filteredJobs.slice(0, 3);

    const filtersWithCounts = FILTERS.map(f => ({
        ...f,
        count: f.id === 'all' ? filteredJobs.length
            : f.id === 'recent' ? stats.newThisWeek
                : f.id === 'tech' ? jobs.filter(j => j.department === 'Tech').length
                    : f.id === 'marketing' ? jobs.filter(j => j.department === 'Marketing').length
                        : jobs.filter(j => (j.location ?? '').toLowerCase().includes('remote')).length
    }));

    return (
        <div className="min-h-screen bg-slate-50">
            <Header showLoginButton />

            {/* Hero Section */}
            <section className="relative overflow-hidden bg-[#0c1222]">
                <NeuralNetworkHero />
                <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[140px] pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-sky-600/15 rounded-full blur-[120px] pointer-events-none" />

                <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 pt-20 pb-28">
                    <div className="grid lg:grid-cols-[1fr_380px] gap-14 items-center">
                        {/* Left column */}
                        <div className="space-y-8">
                            {/* Badge IA */}
                            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/25 w-fit">
                                <BrainCircuit className="w-4 h-4 text-indigo-400" />
                                <span className="text-indigo-300 text-sm font-medium">Recrutement augmenté par l'IA</span>
                            </div>

                            {/* Titre */}
                            <div>
                                <h1 className="text-5xl md:text-[3.6rem] font-extrabold leading-[1.08] tracking-tight">
                                    <span className="text-white">Votre prochaine</span>
                                    <span className="block text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-300 to-indigo-400">opportunité</span>
                                    <span className="text-white">vous attend.</span>
                                </h1>
                                <p className="mt-5 text-lg text-slate-400 max-w-lg leading-relaxed">
                                    Postulez en quelques minutes. Notre IA analyse votre profil
                                    et vous connecte aux offres les plus pertinentes.
                                </p>
                            </div>

                            {/* Search Bar */}
                            <div className="flex gap-2 max-w-xl">
                                <div className="relative flex-1">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        type="text"
                                        placeholder="Titre, compétence, ville..."
                                        value={heroSearch}
                                        onChange={e => setHeroSearch(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && doSearch()}
                                        className="w-full h-12 pl-11 pr-4 rounded-xl text-sm bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                                    />
                                </div>
                                <button
                                    onClick={doSearch}
                                    className="h-12 px-5 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white text-sm font-semibold transition-all duration-300 flex items-center gap-2 shrink-0 shadow-lg shadow-indigo-500/20"
                                >
                                    <Search className="w-4 h-4" />
                                    Chercher
                                </button>
                            </div>

                            {/* Popular Tags */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[11px] text-slate-500 uppercase tracking-wider">Populaire :</span>
                                {['React', 'Python', 'CDI', 'Remote', 'Data'].map(tag => (
                                    <button
                                        key={tag}
                                        onClick={() => { setHeroSearch(tag); setSearchTerm(tag); }}
                                        className="px-3 py-1 text-xs text-slate-400 border border-slate-700 rounded-full hover:border-indigo-500 hover:text-indigo-400 transition-colors"
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>

                            {/* Social Proof */}
                            <div className="flex items-center gap-4">
                                <div className="flex -space-x-2.5">
                                    {[
                                        ['S', 'from-indigo-500 to-indigo-600'],
                                        ['A', 'from-sky-500 to-sky-600'],
                                        ['F', 'from-indigo-400 to-sky-500'],
                                        ['M', 'from-sky-400 to-indigo-500']
                                    ].map(([letter, g], i) => (
                                        <div
                                            key={i}
                                            className={`w-8 h-8 rounded-full bg-gradient-to-br ${g} border-2 border-[#0c1222] flex items-center justify-center text-white text-[10px] font-bold`}
                                        >
                                            {letter}
                                        </div>
                                    ))}
                                </div>
                                <div>
                                    <div className="flex gap-0.5">
                                        {[...Array(5)].map((_, i) => (
                                            <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                                        ))}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        <span className="text-white font-semibold">2 000+</span> candidats placés
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Right column - Stats & Features */}
                        <div className="space-y-4">
                            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm">
                                <div className="grid grid-cols-2 gap-6">
                                    <StatBlock value={`${stats.totalJobs}+`} label="Offres actives" gradient="from-indigo-400 to-sky-400" />
                                    <StatBlock value={`${stats.companies}+`} label="Entreprises" gradient="from-emerald-400 to-teal-400" />
                                    <StatBlock value={stats.locations || '—'} label="Villes" gradient="from-amber-400 to-orange-400" />
                                    <StatBlock value={`${stats.newThisWeek}+`} label="Cette semaine" gradient="from-pink-400 to-rose-400" />
                                </div>
                            </div>
                            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm space-y-3.5">
                                {[
                                    { Icon: BrainCircuit, color: 'text-indigo-400', text: 'Analyse IA de votre CV en 30 s' },
                                    { Icon: CheckCircle, color: 'text-emerald-400', text: 'Entretien IA disponible 24h/24' },
                                    { Icon: TrendingUp, color: 'text-sky-400', text: 'Score de compatibilité par offre' },
                                    { Icon: Clock, color: 'text-amber-400', text: 'Réponse garantie sous 48h' },
                                ].map(({ Icon, color, text }, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <Icon className={`w-4 h-4 shrink-0 ${color}`} />
                                        <span className="text-slate-300 text-sm">{text}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-slate-50 to-transparent pointer-events-none" />
            </section>

            {/* Filters Bar */}
            <div id="offres" className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 md:px-10 py-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                        {filtersWithCounts.map(f => (
                            <FilterChip
                                key={f.id}
                                active={filter === f.id}
                                label={f.label}
                                count={f.count}
                                icon={f.icon}
                                onClick={() => setFilter(f.id)}
                            />
                        ))}
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Affiner..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 h-9 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm focus:outline-none focus:border-indigo-400 transition-colors w-44 placeholder:text-slate-400"
                        />
                    </div>
                </div>
            </div>

            {/* Featured Jobs */}
            {!loading && featuredJobs.length > 0 && (
                <section className="max-w-7xl mx-auto px-6 md:px-10 pt-12 pb-4">
                    <div className="flex items-end justify-between mb-6">
                        <div>
                            <p className="text-xs text-indigo-600 font-semibold uppercase tracking-widest mb-1">À la une</p>
                            <h2 className="text-xl font-bold text-slate-900">Opportunités recommandées</h2>
                        </div>
                        <button
                            onClick={() => setFilter('all')}
                            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-indigo-600 transition-colors font-medium"
                        >
                            Voir tout <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {featuredJobs.map((job, i) => (
                            <div
                                key={job.id}
                                style={{ animationDelay: `${i * 60}ms` }}
                                className="animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-forwards"
                            >
                                <JobCard {...job} company={job.company_name || 'Entreprise'} />                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* All Jobs Section */}
            <section className="max-w-7xl mx-auto px-6 md:px-10 py-10">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">
                            {searchTerm ? `Résultats pour "${searchTerm}"` : 'Toutes les offres'}
                        </h2>
                        <p className="text-sm text-slate-400 mt-0.5">
                            {filteredJobs.length} opportunité{filteredJobs.length > 1 ? 's' : ''} disponible{filteredJobs.length > 1 ? 's' : ''}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {[
                            { icon: TrendingUp, label: 'Récentes' },
                            { icon: MapPin, label: 'Proches' },
                        ].map(({ icon: Icon, label }) => (
                            <button
                                key={label}
                                className="flex items-center gap-1.5 h-9 px-4 rounded-xl border border-slate-200 text-slate-600 text-sm hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                            >
                                <Icon className="w-3.5 h-3.5" />
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                        <Briefcase className="w-4 h-4 shrink-0" />
                        {error}
                    </div>
                )}

                {/* Loading */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
                    </div>
                ) : filteredJobs.length > 0 ? (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {filteredJobs.map((job, i) => (
                                <div
                                    key={job.id}
                                    style={{ animationDelay: `${i * 35}ms` }}
                                    className="animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-forwards"
                                >
                                    <JobCard  {...job} company={job.company_name || 'Entreprise'} />                                </div>
                            ))}
                        </div>

                        {/* Load More */}
                        {filteredJobs.length > 9 && (
                            <div className="text-center mt-10">
                                <button className="h-11 px-8 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white text-sm font-semibold transition-all duration-300 flex items-center gap-2 mx-auto shadow-lg shadow-indigo-500/20">
                                    Charger plus
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    /* No Results */
                    <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
                        <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-5">
                            <Compass className="w-8 h-8 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-700 mb-1">Aucune offre trouvée</h3>
                        <p className="text-slate-400 text-sm mb-6">Essayez d'autres mots-clés ou réinitialisez les filtres</p>
                        <button
                            onClick={() => { setSearchTerm(''); setHeroSearch(''); setFilter('all'); }}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white text-sm font-medium transition-all duration-300 shadow-lg shadow-indigo-500/20"
                        >
                            Réinitialiser les filtres
                        </button>
                    </div>
                )}
            </section>

            {/* Stats Banner */}
            <section className="bg-[#0c1222] border-y border-slate-800/60 py-14 my-6">
                <div className="max-w-7xl mx-auto px-6 md:px-10">
                    <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-slate-800">
                        {[
                            { Icon: Users, value: '2 000+', label: 'Candidats placés' },
                            { Icon: Building2, value: `${stats.companies}+`, label: 'Entreprises partenaires' },
                            { Icon: Award, value: '95%', label: 'Taux de satisfaction' },
                            { Icon: Clock, value: '48h', label: 'Délai de réponse' },
                        ].map(({ Icon, value, label }, i) => (
                            <div key={i} className="text-center px-6 py-10">
                                <Icon className="w-5 h-5 text-indigo-400 mx-auto mb-4" />
                                <div className="text-3xl font-bold text-white mb-1">{value}</div>
                                <div className="text-[11px] text-slate-500 uppercase tracking-wider">{label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Why Us Section */}
            <section className="max-w-7xl mx-auto px-6 md:px-10 py-14">
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-100 mb-5 mx-auto w-fit">
                        <Sparkles className="w-4 h-4 text-indigo-500" />
                        <span className="text-indigo-600 text-sm font-semibold">Pourquoi nous choisir</span>
                    </div>
                    <h2 className="text-3xl font-bold text-slate-900 mb-3">
                        Une expérience candidat{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-sky-600">différente</span>
                    </h2>
                    <p className="text-slate-500 max-w-lg mx-auto text-sm leading-relaxed">
                        IA et accompagnement humain pour un recrutement plus juste et rapide.
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FeatureCard
                        icon={BrainCircuit}
                        title="Analyse IA de votre CV"
                        desc="Notre IA évalue votre profil en 30 secondes et calcule un score de compatibilité pour chaque offre."
                        gradient="from-indigo-500 to-indigo-600"
                    />
                    <FeatureCard
                        icon={Shield}
                        title="Processus transparent"
                        desc="Suivez l'avancement en temps réel. Chaque candidature reçoit une réponse garantie."
                        gradient="from-sky-500 to-sky-600"
                    />
                    <FeatureCard
                        icon={Zap}
                        title="Entretien IA 24h/24"
                        desc="Passez l'entretien quand vous le souhaitez. L'IA génère un rapport détaillé pour le recruteur."
                        gradient="from-indigo-500 to-sky-500"
                    />
                </div>
            </section>

            {/* CTA Final */}
            <section className="max-w-7xl mx-auto px-6 md:px-10 pb-20">
                <div className="relative overflow-hidden rounded-3xl bg-[#0c1222] border border-slate-800 px-8 py-16 text-center">
                    {/* Glow central */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-indigo-600/12 rounded-full blur-3xl pointer-events-none" />

                    {/* Grille subtile */}
                    <div
                        className="absolute inset-0 pointer-events-none opacity-[0.03]"
                        style={{
                            backgroundImage: `linear-gradient(rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)`,
                            backgroundSize: '48px 48px',
                        }}
                    />

                    <div className="relative">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 mb-6 w-fit mx-auto">
                            <Rocket className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="text-indigo-300 text-xs font-medium">Rejoignez-nous</span>
                        </div>

                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Prêt à postuler ?</h2>
                        <p className="text-slate-400 mb-8 max-w-md mx-auto text-sm leading-relaxed">
                            Des centaines d'offres vous attendent. Créez votre profil en 2 minutes
                            et laissez l'IA faire le matching.
                        </p>

                        <div className="flex flex-wrap justify-center gap-3">
                            <button
                                onClick={() => document.getElementById('offres')?.scrollIntoView({ behavior: 'smooth' })}
                                className="h-11 px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white text-sm font-semibold transition-all duration-300 flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                            >
                                <Search className="w-4 h-4" />
                                Explorer les offres
                            </button>
                            <button className="h-11 px-6 rounded-xl border border-slate-700 bg-white/5 hover:bg-white/10 text-white text-sm font-semibold transition-colors flex items-center gap-2">
                                <BellIcon className="w-4 h-4" />
                                Créer une alerte
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}