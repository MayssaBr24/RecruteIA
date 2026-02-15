// pages/JobDetailsPage.tsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'
import {
    Loader2,
    ArrowLeft,
    MapPin,
    FileText,
    GraduationCap,
    Award,
    Building2,
    Users,
    Sparkles  // ← NOUVEAU
} from 'lucide-react'
import api from '../lib/api'
import { useToast } from '../hooks/use-toast'

interface Job {
    id: number
    title: string
    description: string
    requirements: string
    experience_years: number
    education_level: string
    soft_skills: string
    location: string
    contract_type: string
    applied_date: string
    created_by_name?: string
}

export function JobDetailsPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { toast } = useToast()

    const [job, setJob] = useState<Job | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchJob = async () => {
            try {
                setLoading(true)
                const response = await api.get(`/recruitment/jobs/${id}/`)
                setJob(response.data)
            } catch (err) {
                toast({ title: 'Erreur', description: 'Offre non trouvée', variant: 'destructive' })
            } finally {
                setLoading(false)
            }
        }
        if (id) fetchJob()
    }, [id, toast])

    if (loading) {
        return (
            <div className="min-h-screen bg-background">
                <Header />
                <div className="flex justify-center pt-20">
                    <Loader2 className="animate-spin w-8 h-8 text-primary" />
                </div>
            </div>
        )
    }

    if (!job) {
        return (
            <div className="min-h-screen bg-background">
                <Header />
                <div className="p-8 text-center">Offre introuvable</div>
            </div>
        )
    }

    // Helper pour les listes
    const formatList = (str: string) => str ? str.split(',').map(s => s.trim()).filter(s => s) : []

    return (
        <div className="min-h-screen bg-background">
            <Header />
            <main className="flex-1 px-4 md:px-8 py-8 max-w-5xl mx-auto">

                {/* Retour */}
                <Button variant="ghost" onClick={() => navigate('/')} className="mb-6 gap-2">
                    <ArrowLeft className="w-4 h-4" /> Retour aux offres
                </Button>

                {/* EN-TÊTE : Titre + Logistique */}
                <Card className="p-8 mb-6 border-l-4 border-l-blue-600 bg-white shadow-sm">
                    <div className="flex flex-col md:flex-row justify-between gap-6">
                        <div className="space-y-4">
                            <h1 className="text-4xl font-bold text-slate-900">{job.title}</h1>
                            <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                                <div className="flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-blue-500" />
                                    <span className="font-medium">{job.location || 'Non spécifié'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Building2 className="w-4 h-4 text-purple-500" />
                                    <span className="font-medium">{job.contract_type || 'CDI'}</span>
                                </div>
                            </div>
                        </div>

                        {/* BOUTON POSTULER AMÉLIORÉ AVEC BADGE IA */}
                        <div className="flex flex-col gap-2">
                            <Button
                                onClick={() => navigate(`/apply/${id}`)}
                                size="lg"
                                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white w-full md:w-auto shadow-lg shadow-blue-500/20 transition-all hover:scale-105"
                            >
                                <Sparkles className="w-5 h-5 mr-2" />
                                Postuler maintenant
                                <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs font-semibold">
                                    Analyse IA
                                </span>
                            </Button>
                            <p className="text-xs text-slate-500 text-center px-2">
                                ✨ Votre CV sera analysé instantanément
                            </p>
                        </div>
                    </div>
                </Card>

                {/* CORPS : Grille 2 Colonnes */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* GAUCHE : Description (2/3) */}
                    <div className="lg:col-span-2 space-y-6">
                        <Card className="p-6 bg-white">
                            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-800">
                                <FileText className="w-5 h-5 text-blue-600" /> Description détaillée
                            </h2>
                            <div className="prose prose-slate max-w-none text-slate-700 whitespace-pre-line leading-relaxed">
                                {job.description}
                            </div>
                        </Card>
                    </div>

                    {/* DROITE : Critères (1/3) */}
                    <div className="space-y-6">

                        {/* Expérience & Diplôme */}
                        <Card className="p-6 bg-white">
                            <h3 className="font-bold mb-4 text-slate-800 flex items-center gap-2">
                                <GraduationCap className="w-5 h-5 text-purple-600" /> Profil Recherché
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-xs text-slate-500 font-bold uppercase">Expérience requise</p>
                                    <p className="text-lg font-semibold text-slate-900">
                                        {job.experience_years > 0 ? `${job.experience_years} ans` : 'Junior / Débutant accepté'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 font-bold uppercase">Niveau d'études</p>
                                    <p className="text-lg font-semibold text-slate-900">{job.education_level || 'Non spécifié'}</p>
                                </div>
                            </div>
                        </Card>

                        {/* Compétences Techniques */}
                        <Card className="p-6 bg-blue-50/30 border-blue-100">
                            <h3 className="font-bold mb-3 text-slate-800 flex items-center gap-2">
                                <Award className="w-5 h-5 text-blue-600" /> Hard Skills
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {formatList(job.requirements).length > 0 ? (
                                    formatList(job.requirements).map((skill, i) => (
                                        <Badge
                                            key={i}
                                            variant="secondary"
                                            className="bg-white text-blue-700 border-blue-200 shadow-sm font-medium"
                                        >
                                            {skill}
                                        </Badge>
                                    ))
                                ) : (
                                    <p className="text-sm text-slate-500">Non spécifié</p>
                                )}
                            </div>
                        </Card>

                        {/* Soft Skills */}
                        <Card className="p-6 bg-purple-50/30 border-purple-100">
                            <h3 className="font-bold mb-3 text-slate-800 flex items-center gap-2">
                                <Users className="w-5 h-5 text-purple-600" /> Soft Skills
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {formatList(job.soft_skills).length > 0 ? (
                                    formatList(job.soft_skills).map((skill, i) => (
                                        <Badge
                                            key={i}
                                            variant="outline"
                                            className="bg-white text-purple-700 border-purple-200 font-medium"
                                        >
                                            {skill}
                                        </Badge>
                                    ))
                                ) : (
                                    <p className="text-sm text-slate-500">Non spécifié</p>
                                )}
                            </div>
                        </Card>

                    </div>
                </div>

            </main>
        </div>
    )
}