// src/pages/PublicDashboard.tsx
// Design indigo + sky — réseau neuronal dense dans le hero, fond blanc pour le contenu

import { useEffect, useState, useRef } from 'react'
import { Header } from '../components/Header'
import { JobCard } from '../components/JobCard'
import api from '../lib/api'
import { Skeleton } from '../../components/ui/skeleton'
import {
    Search, Briefcase, Clock, TrendingUp, Sparkles,
    Building2, Award, Users, BrainCircuit, CheckCircle,
    MapPin, Target, ChevronRight, Rocket,
    Zap, Shield, Globe, ArrowRight, Compass, Star,
} from 'lucide-react'

interface Job {
    id: number; title: string; description: string; created_at: string
    location?: string; type?: string; department?: string
    salary?: string; offer_deadline?: string; company?: string
}

// ── Helper partagé ─────────────────────────────
const getDaysLeft = (deadline: string) => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const end   = new Date(deadline); end.setHours(0, 0, 0, 0)
    return Math.ceil((end.getTime() - today.getTime()) / 864e5)
}

// ── Icône Bell (évite conflit d'import) ────────
function BellIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
    )
}

// ═══════════════════════════════════════════════
// CANVAS — Réseau neuronal (hero uniquement)
// ═══════════════════════════════════════════════
function NeuralNetworkHero() {
    const canvasRef   = useRef<HTMLCanvasElement>(null)
    const mouseRef    = useRef({ x: -999, y: -999 })
    const nodesRef    = useRef<Array<{
        x: number; y: number; vx: number; vy: number
        r: number; pulse: number; color: string
    }>>([])
    const animationRef = useRef<number | undefined>(undefined)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const colors = ['#6366f1', '#0ea5e9', '#4f46e5', '#0284c7', '#818cf8', '#38bdf8']

        function resize() {
            if (!canvas) return
            canvas.width  = canvas.offsetWidth
            canvas.height = canvas.offsetHeight
            initNodes()
        }

        function initNodes() {
            if (!canvas) return
            const count = Math.floor((canvas.width * canvas.height) / 4500)
            nodesRef.current = Array.from({ length: count }, () => ({
                x:     Math.random() * canvas.width,
                y:     Math.random() * canvas.height,
                vx:    (Math.random() - 0.5) * 0.38,
                vy:    (Math.random() - 0.5) * 0.38,
                r:     Math.random() * 2.2 + 1.2,
                pulse: Math.random() * Math.PI * 2,
                color: colors[Math.floor(Math.random() * colors.length)],
            }))
        }

        function animate() {
            if (!canvas || !ctx) return
            ctx.clearRect(0, 0, canvas.width, canvas.height)

            nodesRef.current.forEach(n => {
                n.x    += n.vx
                n.y    += n.vy
                n.pulse += 0.022
                if (n.x < 0 || n.x > canvas.width)  n.vx *= -1
                if (n.y < 0 || n.y > canvas.height)  n.vy *= -1
                const dx = mouseRef.current.x - n.x
                const dy = mouseRef.current.y - n.y
                const d  = Math.sqrt(dx * dx + dy * dy)
                if (d < 150) {
                    const force = (150 - d) / 150 * 0.45
                    n.x -= (dx / d) * force
                    n.y -= (dy / d) * force
                }
            })

            // Connexions
            for (let i = 0; i < nodesRef.current.length; i++) {
                for (let j = i + 1; j < nodesRef.current.length; j++) {
                    const a  = nodesRef.current[i]
                    const b  = nodesRef.current[j]
                    const dx = a.x - b.x
                    const dy = a.y - b.y
                    const d  = Math.sqrt(dx * dx + dy * dy)
                    if (d < 140) {
                        const alpha = (1 - d / 140) * 0.45
                        const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y)
                        g.addColorStop(0, `rgba(99,102,241,${alpha})`)
                        g.addColorStop(1, `rgba(14,165,233,${alpha})`)
                        ctx.strokeStyle = g
                        ctx.lineWidth   = 0.65
                        ctx.beginPath()
                        ctx.moveTo(a.x, a.y)
                        ctx.lineTo(b.x, b.y)
                        ctx.stroke()
                    }
                }
            }

            // Nœuds
            nodesRef.current.forEach(n => {
                const glow = 0.5 + 0.5 * Math.sin(n.pulse)
                const r    = n.r + n.r * 0.18 * Math.sin(n.pulse)

                // Halo externe
                ctx.beginPath()
                ctx.arc(n.x, n.y, r * 2.4, 0, Math.PI * 2)
                ctx.fillStyle = `rgba(99,102,241,${glow * 0.1})`
                ctx.fill()

                // Corps
                ctx.beginPath()
                ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
                ctx.fillStyle = n.color
                ctx.fill()

                // Reflet
                ctx.beginPath()
                ctx.arc(n.x - r * 0.2, n.y - r * 0.2, r * 0.28, 0, Math.PI * 2)
                ctx.fillStyle = `rgba(255,255,255,${0.28 + glow * 0.28})`
                ctx.fill()
            })

            animationRef.current = requestAnimationFrame(animate)
        }

        const ro = new ResizeObserver(resize)
        ro.observe(canvas)

        const onMove = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect()
            mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
        }
        const onLeave = () => { mouseRef.current = { x: -999, y: -999 } }

        window.addEventListener('mousemove', onMove)
        canvas.addEventListener('mouseleave', onLeave)
        resize()
        animate()

        return () => {
            ro.disconnect()
            window.removeEventListener('mousemove', onMove)
            canvas.removeEventListener('mouseleave', onLeave)
            if (animationRef.current) cancelAnimationFrame(animationRef.current)
        }
    }, [])

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ pointerEvents: 'none' }}
        />
    )
}

// ── StatBlock hero ──────────────────────────────
function StatBlock({ value, label, gradient }: {
    value: string | number; label: string; gradient: string
}) {
    return (
        <div className="text-center">
            <div className={`text-3xl font-extrabold tracking-tight
                             bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>
                {value}
            </div>
            <div className="text-[10px] text-slate-500 mt-1.5 uppercase tracking-[0.16em]">
                {label}
            </div>
        </div>
    )
}

// ── FilterChip ──────────────────────────────────
function FilterChip({ active, label, count, icon: Icon, onClick }: {
    active: boolean; label: string; count: number
    icon: React.ElementType; onClick: () => void
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                        transition-all duration-200 border ${
                active
                    ? 'bg-gradient-to-r from-indigo-600 to-sky-600 text-white border-indigo-500 shadow-md shadow-indigo-500/20'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
            }`}
        >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
                    active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}>{count}</span>
            )}
        </button>
    )
}

// ── FeatureCard ─────────────────────────────────
function FeatureCard({ icon: Icon, title, desc, gradient }: {
    icon: React.ElementType; title: string; desc: string; gradient: string
}) {
    return (
        <div className="group bg-white rounded-2xl border border-slate-100 p-7
                        hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-50/80
                        transition-all duration-300">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-r ${gradient}
                             flex items-center justify-center mb-5
                             group-hover:scale-110 transition-transform duration-300`}>
                <Icon className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">{title}</h3>
            <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
        </div>
    )
}

// ── CardSkeleton ────────────────────────────────
function CardSkeleton() {
    return (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
            <div className="flex gap-3 items-center">
                <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                </div>
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
            <div className="flex justify-between pt-1">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════
// PAGE PRINCIPALE
// ═══════════════════════════════════════════════

export function PublicDashboard() {
    const [jobs, setJobs]             = useState<Job[]>([])
    const [loading, setLoading]       = useState(true)
    const [error, setError]           = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [heroSearch, setHeroSearch] = useState('')
    const [filter, setFilter]         = useState('all')
    const [stats, setStats]           = useState({
        totalJobs: 0, newThisWeek: 0, locations: 0, companies: 45,
    })

    useEffect(() => {
        ;(async () => {
            try {
                setLoading(true)
                const { data } = await api.get('/recruitment/jobs/')
                setJobs(data)
                const cutoff = new Date(Date.now() - 7 * 864e5)

                // Ne compter que les offres actives (non expirées)
                const active = data.filter((j: Job) =>
                    !j.offer_deadline || getDaysLeft(j.offer_deadline) >= 0
                )
                setStats({
                    totalJobs:   active.length,
                    newThisWeek: active.filter((j: Job) => new Date(j.created_at) > cutoff).length,
                    locations:   new Set(active.map((j: Job) => j.location).filter(Boolean)).size,
                    companies:   45,
                })
                setError(null)
            } catch {
                setError('Erreur lors du chargement des offres')
            } finally {
                setLoading(false)
            }
        })()
    }, [])

    const doSearch = () => {
        setSearchTerm(heroSearch)
        document.getElementById('offres')?.scrollIntoView({ behavior: 'smooth' })
    }

    // ── Filtre : uniquement les offres disponibles ──
    const filteredJobs = jobs.filter(job => {
        // Exclure TOUTES les offres expirées (deadline dépassée)
        if (job.offer_deadline && getDaysLeft(job.offer_deadline) < 0) return false

        const q      = searchTerm.toLowerCase()
        const matchQ = !q
            || job.title.toLowerCase().includes(q)
            || job.description.toLowerCase().includes(q)
            || (job.location ?? '').toLowerCase().includes(q)
            || (job.company ?? '').toLowerCase().includes(q)

        const matchF =
            filter === 'all'         ? true
                : filter === 'recent'    ? new Date(job.created_at) > new Date(Date.now() - 7 * 864e5)
                    : filter === 'tech'      ? job.department === 'Tech'
                        : filter === 'remote'    ? (job.location ?? '').toLowerCase().includes('remote')
                            : filter === 'marketing' ? job.department === 'Marketing'
                                : true

        return matchQ && matchF
    })

    const filters = [
        { id: 'all',       label: 'Toutes',    count: filteredJobs.length,                                                     icon: Briefcase },
        { id: 'recent',    label: 'Récentes',  count: stats.newThisWeek,                                                       icon: Clock     },
        { id: 'tech',      label: 'Tech',      count: jobs.filter(j => j.department === 'Tech').length,                        icon: Zap       },
        { id: 'marketing', label: 'Marketing', count: jobs.filter(j => j.department === 'Marketing').length,                   icon: Target    },
        { id: 'remote',    label: 'Remote',    count: jobs.filter(j => (j.location ?? '').toLowerCase().includes('remote')).length, icon: Globe },
    ]

    // 3 premières offres pour la section "À la une"
    const featuredJobs = filteredJobs.slice(0, 3)

    return (
        <div className="min-h-screen bg-slate-50">

            <Header showLoginButton />

            {/* ══════════════════════════════════════
                HERO — fond sombre + réseau neuronal
                ══════════════════════════════════════ */}
            <section className="relative overflow-hidden bg-[#0c1222]">

                <NeuralNetworkHero />

                {/* Glows ambiants */}
                <div className="absolute -top-40 -left-40 w-[600px] h-[600px]
                                bg-indigo-600/20 rounded-full blur-[140px] pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-[500px] h-[500px]
                                bg-sky-600/15 rounded-full blur-[120px] pointer-events-none" />

                <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 pt-20 pb-28">
                    <div className="grid lg:grid-cols-[1fr_380px] gap-14 items-center">

                        {/* ── Col gauche : texte ── */}
                        <div className="space-y-8">

                            {/* Badge IA */}
                            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full
                                            bg-indigo-500/10 border border-indigo-500/25 w-fit">
                                <BrainCircuit className="w-4 h-4 text-indigo-400" />
                                <span className="text-indigo-300 text-sm font-medium">
                                    Recrutement augmenté par l'IA
                                </span>
                            </div>

                            {/* Titre */}
                            <div>
                                <h1 className="text-5xl md:text-[3.6rem] font-extrabold
                                               leading-[1.08] tracking-tight">
                                    <span className="text-white">Votre prochaine</span>
                                    <span className="block text-transparent bg-clip-text
                                                     bg-gradient-to-r from-indigo-400 via-sky-300 to-indigo-400">
                                        opportunité
                                    </span>
                                    <span className="text-white">vous attend.</span>
                                </h1>
                                <p className="mt-5 text-lg text-slate-400 max-w-lg leading-relaxed">
                                    Postulez en quelques minutes. Notre IA analyse votre profil
                                    et vous connecte aux offres les plus pertinentes.
                                </p>
                            </div>

                            {/* Barre de recherche hero */}
                            <div className="flex gap-2 max-w-xl">
                                <div className="relative flex-1">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2
                                                       w-4 h-4 text-slate-500 pointer-events-none" />
                                    <input
                                        type="text"
                                        placeholder="Titre, compétence, ville..."
                                        value={heroSearch}
                                        onChange={e => setHeroSearch(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && doSearch()}
                                        className="w-full h-12 pl-11 pr-4 rounded-xl text-sm
                                                   bg-slate-800/50 border border-slate-700 text-white
                                                   placeholder:text-slate-500 focus:outline-none
                                                   focus:border-indigo-500 transition-colors"
                                    />
                                </div>
                                <button
                                    onClick={doSearch}
                                    className="h-12 px-5 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600
                                               hover:from-indigo-700 hover:to-sky-700 text-white text-sm
                                               font-semibold transition-all duration-300 flex items-center
                                               gap-2 shrink-0 shadow-lg shadow-indigo-500/20"
                                >
                                    <Search className="w-4 h-4" />
                                    Chercher
                                </button>
                            </div>

                            {/* Tags populaires */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[11px] text-slate-500 uppercase tracking-wider">
                                    Populaire :
                                </span>
                                {['React', 'Python', 'CDI', 'Remote', 'Data'].map(tag => (
                                    <button
                                        key={tag}
                                        onClick={() => { setHeroSearch(tag); setSearchTerm(tag) }}
                                        className="px-3 py-1 text-xs text-slate-400 border border-slate-700
                                                   rounded-full hover:border-indigo-500 hover:text-indigo-400
                                                   transition-colors"
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>

                            {/* Social proof */}
                            <div className="flex items-center gap-4">
                                <div className="flex -space-x-2.5">
                                    {[
                                        ['S', 'from-indigo-500 to-indigo-600'],
                                        ['A', 'from-sky-500 to-sky-600'],
                                        ['F', 'from-indigo-400 to-sky-500'],
                                        ['M', 'from-sky-400 to-indigo-500'],
                                    ].map(([letter, g], i) => (
                                        <div
                                            key={i}
                                            className={`w-8 h-8 rounded-full bg-gradient-to-br ${g}
                                                        border-2 border-[#0c1222] flex items-center
                                                        justify-center text-white text-[10px] font-bold`}
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

                        {/* ── Col droite : panel stats + features ── */}
                        <div className="space-y-4">

                            {/* Stats 2×2 */}
                            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl
                                            p-6 backdrop-blur-sm">
                                <div className="grid grid-cols-2 gap-6">
                                    <StatBlock
                                        value={`${stats.totalJobs}+`}
                                        label="Offres actives"
                                        gradient="from-indigo-400 to-sky-400"
                                    />
                                    <StatBlock
                                        value={`${stats.companies}+`}
                                        label="Entreprises"
                                        gradient="from-emerald-400 to-teal-400"
                                    />
                                    <StatBlock
                                        value={stats.locations || '—'}
                                        label="Villes"
                                        gradient="from-amber-400 to-orange-400"
                                    />
                                    <StatBlock
                                        value={`${stats.newThisWeek}+`}
                                        label="Cette semaine"
                                        gradient="from-pink-400 to-rose-400"
                                    />
                                </div>
                            </div>

                            {/* Features list */}
                            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl
                                            p-6 backdrop-blur-sm space-y-3.5">
                                {[
                                    { Icon: BrainCircuit, color: 'text-indigo-400', text: 'Analyse IA de votre CV en 30 s' },
                                    { Icon: CheckCircle,  color: 'text-emerald-400', text: 'Entretien IA disponible 24h/24' },
                                    { Icon: TrendingUp,   color: 'text-sky-400',     text: 'Score de compatibilité par offre' },
                                    { Icon: Clock,        color: 'text-amber-400',   text: 'Réponse garantie sous 48h' },
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

                {/* Fondu hero → contenu */}
                <div className="absolute bottom-0 left-0 right-0 h-20
                                bg-gradient-to-t from-slate-50 to-transparent pointer-events-none" />
            </section>

            {/* ══════════════════════════════════════
                BARRE FILTRES — sticky
                ══════════════════════════════════════ */}
            <div
                id="offres"
                className="sticky top-0 z-30 bg-white/95 backdrop-blur-md
                           border-b border-slate-200 shadow-sm"
            >
                <div className="max-w-7xl mx-auto px-6 md:px-10 py-3
                                flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                        {filters.map(f => (
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
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2
                                           w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Affiner..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 h-9 rounded-xl bg-slate-50 border border-slate-200
                                       text-slate-800 text-sm focus:outline-none focus:border-indigo-400
                                       transition-colors w-44 placeholder:text-slate-400"
                        />
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════
                OFFRES À LA UNE
                ══════════════════════════════════════ */}
            {!loading && featuredJobs.length > 0 && (
                <section className="max-w-7xl mx-auto px-6 md:px-10 pt-12 pb-4">
                    <div className="flex items-end justify-between mb-6">
                        <div>
                            <p className="text-xs text-indigo-600 font-semibold
                                          uppercase tracking-widest mb-1">
                                À la une
                            </p>
                            <h2 className="text-xl font-bold text-slate-900">
                                Opportunités recommandées
                            </h2>
                        </div>
                        <button
                            className="flex items-center gap-1.5 text-sm text-slate-400
                                       hover:text-indigo-600 transition-colors font-medium"
                            onClick={() => setFilter('all')}
                        >
                            Voir tout <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {featuredJobs.map((job, i) => (
                            <div
                                key={job.id}
                                style={{ animationDelay: `${i * 60}ms` }}
                                className="animate-in fade-in slide-in-from-bottom-3
                                           duration-500 fill-mode-forwards"
                            >
                                <JobCard
                                    id={job.id}
                                    title={job.title}
                                    description={job.description}
                                    createdAt={job.created_at}
                                    location={job.location}
                                    type={job.type}
                                    offer_deadline={job.offer_deadline}
                                    company={job.company}
                                />
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ══════════════════════════════════════
                TOUTES LES OFFRES
                ══════════════════════════════════════ */}
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
                            { icon: MapPin,     label: 'Proches'  },
                        ].map(({ icon: Icon, label }) => (
                            <button
                                key={label}
                                className="flex items-center gap-1.5 h-9 px-4 rounded-xl border
                                           border-slate-200 text-slate-600 text-sm
                                           hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                            >
                                <Icon className="w-3.5 h-3.5" />
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Erreur */}
                {error && (
                    <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-red-50
                                    border border-red-200 rounded-xl text-red-600 text-sm">
                        <Briefcase className="w-4 h-4 shrink-0" />
                        {error}
                    </div>
                )}

                {/* Chargement */}
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
                                    className="animate-in fade-in slide-in-from-bottom-3
                                               duration-500 fill-mode-forwards"
                                >
                                    <JobCard
                                        id={job.id}
                                        title={job.title}
                                        description={job.description}
                                        createdAt={job.created_at}
                                        location={job.location}
                                        type={job.type}
                                        offer_deadline={job.offer_deadline}
                                        company={job.company}
                                    />
                                </div>
                            ))}
                        </div>

                        {/* Charger plus */}
                        {filteredJobs.length > 9 && (
                            <div className="text-center mt-10">
                                <button className="h-11 px-8 rounded-xl
                                                   bg-gradient-to-r from-indigo-600 to-sky-600
                                                   hover:from-indigo-700 hover:to-sky-700
                                                   text-white text-sm font-semibold transition-all duration-300
                                                   flex items-center gap-2 mx-auto
                                                   shadow-lg shadow-indigo-500/20">
                                    Charger plus
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </>

                ) : (
                    /* Aucun résultat */
                    <div className="flex flex-col items-center justify-center py-24
                                    border-2 border-dashed border-slate-200 rounded-2xl bg-white">
                        <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100
                                        flex items-center justify-center mb-5">
                            <Compass className="w-8 h-8 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-700 mb-1">
                            Aucune offre trouvée
                        </h3>
                        <p className="text-slate-400 text-sm mb-6">
                            Essayez d'autres mots-clés ou réinitialisez les filtres
                        </p>
                        <button
                            onClick={() => { setSearchTerm(''); setHeroSearch(''); setFilter('all') }}
                            className="px-5 py-2.5 rounded-xl
                                       bg-gradient-to-r from-indigo-600 to-sky-600
                                       hover:from-indigo-700 hover:to-sky-700
                                       text-white text-sm font-medium transition-all duration-300
                                       shadow-lg shadow-indigo-500/20"
                        >
                            Réinitialiser les filtres
                        </button>
                    </div>
                )}
            </section>

            {/* ══════════════════════════════════════
                BANDE STATS — fond sombre
                ══════════════════════════════════════ */}
            <section className="bg-[#0c1222] border-y border-slate-800/60 py-14 my-6">
                <div className="max-w-7xl mx-auto px-6 md:px-10">
                    <div className="grid grid-cols-2 md:grid-cols-4
                                    divide-x divide-y md:divide-y-0 divide-slate-800">
                        {[
                            { Icon: Users,     value: '2 000+',            label: 'Candidats placés'        },
                            { Icon: Building2, value: `${stats.companies}+`, label: 'Entreprises partenaires' },
                            { Icon: Award,     value: '95%',               label: 'Taux de satisfaction'    },
                            { Icon: Clock,     value: '48h',               label: 'Délai de réponse'        },
                        ].map(({ Icon, value, label }, i) => (
                            <div key={i} className="text-center px-6 py-10">
                                <Icon className="w-5 h-5 text-indigo-400 mx-auto mb-4" />
                                <div className="text-3xl font-bold text-white mb-1">{value}</div>
                                <div className="text-[11px] text-slate-500 uppercase tracking-wider">
                                    {label}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════
                POURQUOI NOUS
                ══════════════════════════════════════ */}
            <section className="max-w-7xl mx-auto px-6 md:px-10 py-14">
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full
                                    bg-indigo-50 border border-indigo-100 mb-5 mx-auto w-fit">
                        <Sparkles className="w-4 h-4 text-indigo-500" />
                        <span className="text-indigo-600 text-sm font-semibold">
                            Pourquoi nous choisir
                        </span>
                    </div>
                    <h2 className="text-3xl font-bold text-slate-900 mb-3">
                        Une expérience candidat{' '}
                        <span className="text-transparent bg-clip-text
                                         bg-gradient-to-r from-indigo-600 to-sky-600">
                            différente
                        </span>
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

            {/* ══════════════════════════════════════
                CTA FINAL
                ══════════════════════════════════════ */}
            <section className="max-w-7xl mx-auto px-6 md:px-10 pb-20">
                <div className="relative overflow-hidden rounded-3xl bg-[#0c1222]
                                border border-slate-800 px-8 py-16 text-center">

                    {/* Glow central */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48
                                    bg-indigo-600/12 rounded-full blur-3xl pointer-events-none" />
                    {/* Grille subtile */}
                    <div
                        className="absolute inset-0 pointer-events-none opacity-[0.03]"
                        style={{
                            backgroundImage: `
                                linear-gradient(rgba(99,102,241,1) 1px, transparent 1px),
                                linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)`,
                            backgroundSize: '48px 48px',
                        }}
                    />

                    <div className="relative">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full
                                        bg-indigo-500/10 border border-indigo-500/25 mb-6 w-fit mx-auto">
                            <Rocket className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="text-indigo-300 text-xs font-medium">Rejoignez-nous</span>
                        </div>

                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                            Prêt à postuler ?
                        </h2>
                        <p className="text-slate-400 mb-8 max-w-md mx-auto text-sm leading-relaxed">
                            Des centaines d'offres vous attendent. Créez votre profil en 2 minutes
                            et laissez l'IA faire le matching.
                        </p>

                        <div className="flex flex-wrap justify-center gap-3">
                            <button
                                onClick={() => document.getElementById('offres')?.scrollIntoView({ behavior: 'smooth' })}
                                className="h-11 px-6 rounded-xl
                                           bg-gradient-to-r from-indigo-600 to-sky-600
                                           hover:from-indigo-700 hover:to-sky-700
                                           text-white text-sm font-semibold transition-all duration-300
                                           flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                            >
                                <Search className="w-4 h-4" />
                                Explorer les offres
                            </button>
                            <button className="h-11 px-6 rounded-xl border border-slate-700
                                               bg-white/5 hover:bg-white/10 text-white text-sm
                                               font-semibold transition-colors flex items-center gap-2">
                                <BellIcon className="w-4 h-4" />
                                Créer une alerte
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}