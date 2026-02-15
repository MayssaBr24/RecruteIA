// src/pages/rh/CandidateDetailsPage.tsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { ArrowLeft, Download, Mail, MapPin, GraduationCap, Briefcase, Linkedin, Globe, Calendar, DollarSign, FileText, User } from 'lucide-react'
import { useToast } from '../../hooks/use-toast'
import api from "../lib/api.ts";

// Interface correspondant au Serializer Backend enrichi
interface CandidateProfile {
    id: number
    full_name: string
    email: string
    phone: string
    cv_file: string
    cover_letter_file: string
    applied_date: string
    status: string
    job_offer_title: string
    // Champs IA enrichis
    nationality: string
    university: string
    degree_level: string
    graduation_year: string
    experience_years: number
    linkedin_url: string
    portfolio_url: string
    current_location: string
    salary_expectation: number | null
    availability_date: string | null
}

export function CandidateDetailsPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { toast } = useToast()

    const [candidate, setCandidate] = useState<CandidateProfile | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchCandidate = async () => {
            try {
                setLoading(true)
                // Note: Assure-toi que ton Backend renvoie l'objet candidat complet avec l'offre associée
                const response = await api.get(`/recruitment/applications/${id}/`)
                setCandidate(response.data)
            } catch (err) {
                console.error('Erreur:', err)
                toast({ title: 'Erreur', description: 'Impossible de charger le profil du candidat', variant: 'destructive' })
                navigate('/rh')
            } finally {
                setLoading(false)
            }
        }

        if (id) fetchCandidate()
    }, [id, navigate, toast])

    if (loading) {
        return (
            <div className="min-h-screen bg-background">
                <Header />
                <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                        <div className="inline-block w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                        <p className="mt-4 text-muted-foreground">Chargement du profil...</p>
                    </div>
                </div>
            </div>
        )
    }

    if (!candidate) {
        return <div className="min-h-screen bg-background"><Header /><div className="p-8 text-center">Profil introuvable</div></div>
    }

    return (
        <div className="min-h-screen bg-background">
            <Header />
            <main className="flex-1 px-4 md:px-8 py-8 max-w-5xl mx-auto">
                {/* Bouton retour */}
                <Button
                    variant="ghost"
                    onClick={() => navigate('/rh')}
                    className="mb-6 gap-2"
                >
                    <ArrowLeft className="w-4 h-4" /> Retour aux candidatures
                </Button>

                {/* Carte En-tête */}
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white shadow-lg shadow-blue-500/20 mb-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center">
                                    <User className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold">{candidate.full_name}</h1>
                                    <p className="text-blue-100">{candidate.email} • {candidate.phone}</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-3 mt-4 md:mt-0">
                                <div className="flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
                                    <MapPin className="w-4 h-4 text-blue-100" />
                                    <span className="text-sm font-medium">{candidate.current_location || 'Non spécifié'}</span>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
                                    <Briefcase className="w-4 h-4 text-purple-100" />
                                    <span className="text-sm font-medium">{candidate.experience_years} ans d'exp.</span>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border-white/20">
                                    <Calendar className="w-4 h-4 text-green-100" />
                                    <span className="text-sm font-medium">
                                        {candidate.availability_date
                                            ? `Dispo. le ${new Date(candidate.availability_date).toLocaleDateString('fr-FR')}`
                                            : 'Disponibilité immédiate'}

                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col gap-3">
                            <Button variant="secondary" onClick={() => window.location.href = `mailto:${candidate.email}`} className="bg-white/10 hover:bg-white/20 text-white border-0">
                                <Mail className="w-4 h-4 mr-2" /> Contacter
                            </Button>
                            {candidate.linkedin_url && (
                                <Button variant="secondary" onClick={() => window.open(candidate.linkedin_url, '_blank')} className="bg-white/10 hover:bg-white/20 text-white border-0">
                                    <Linkedin className="w-4 h-4 mr-2" /> LinkedIn
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Grille Détails */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* COLONNE GAUCHE : Formation & Profil */}
                    <div className="space-y-6">
                        {/* Formation */}
                        <Card className="p-6 border-l-4 border-l-purple-600 bg-white">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <GraduationCap className="w-5 h-5 text-purple-600" /> Formation Académique
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-sm text-slate-500 font-bold uppercase">Université / École</p>
                                    <p className="text-base font-semibold text-slate-900">{candidate.university || 'Non renseigné'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500 font-bold uppercase">Diplôme</p>
                                    <p className="text-base font-semibold text-slate-900">{candidate.degree_level || 'Non renseigné'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500 font-bold uppercase">Année d'obtention</p>
                                    <p className="text-base font-semibold text-slate-900">{candidate.graduation_year || 'N/C'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500 font-bold uppercase">Nationalité</p>
                                    <p className="text-base font-semibold text-slate-900">{candidate.nationality || 'Non renseignée'}</p>
                                </div>
                            </div>
                        </Card>

                        {/* Expérience */}
                        <Card className="p-6 border-l-4 border-l-blue-600 bg-white">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <Briefcase className="w-5 h-5 text-blue-600" /> Expérience & Réseaux
                            </h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-500 font-bold uppercase">Années d'expérience</span>
                                    <span className="text-lg font-bold text-slate-900">{candidate.experience_years} ans</span>
                                </div>
                                {candidate.linkedin_url && (
                                    <a href={candidate.linkedin_url} target="_blank" className="text-blue-600 hover:underline flex items-center gap-2">
                                        <Linkedin className="w-4 h-4" />
                                        <span className="text-sm font-medium">Voir le profil LinkedIn</span>
                                    </a>
                                )}
                                {candidate.portfolio_url && (
                                    <a href={candidate.portfolio_url} target="_blank" className="text-blue-600 hover:underline flex items-center gap-2 mt-2">
                                        <Globe className="w-4 h-4" />
                                        <span className="text-sm font-medium">Voir le Portfolio / GitHub</span>
                                    </a>
                                )}
                            </div>
                        </Card>
                    </div>

                    {/* COLONNE DROITE : Fichiers & Logistique */}
                    <div className="space-y-6">
                        {/* Logistique */}
                        <Card className="p-6 border-l-4 border-l-green-600 bg-white">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <DollarSign className="w-5 h-5 text-green-600" /> Contraintes & Disponibilité
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-xs text-slate-500 font-bold uppercase">Prétention salariale</p>
                                    <p className="text-base font-semibold text-slate-900">
                                        {candidate.salary_expectation ? `${candidate.salary_expectation}€ / mois` : 'Non spécifiée'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 font-bold uppercase">Date de disponibilité</p>
                                    <p className="text-base font-semibold text-slate-900">
                                        {candidate.availability_date
                                            ? new Date(candidate.availability_date).toLocaleDateString('fr-FR')
                                            : 'Immédiate'
                                        }
                                    </p>
                                </div>
                            </div>
                        </Card>

                        {/* Fichiers */}
                        <Card className="p-6 border-l-4 border-l-orange-600 bg-orange-50/30">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
                                <FileText className="w-5 h-5 text-orange-600" /> Documents Candidature
                            </h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center text-red-600">
                                            <span className="font-bold">PDF</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-700">CV</p>
                                            <p className="text-xs text-slate-500">C'est le document clé pour l'analyse IA</p>
                                        </div>
                                    </div>
                                    {candidate.cv_file && (
                                        <Button
                                            size="sm"
                                            className="bg-white text-slate-700 hover:bg-slate-100"
                                            onClick={() => window.open(candidate.cv_file, '_blank')}
                                        >
                                            <Download className="w-4 h-4 mr-2" /> Télécharger
                                        </Button>
                                    )}
                                </div>

                                {candidate.cover_letter_file && (
                                    <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                                                <span className="font-bold">PDF</span>
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-700">Lettre de motivation</p>
                                                <p className="text-xs text-slate-500">Permet de juger la motivation</p>
                                            </div>
                                        </div>
                                        <Button
                                            size="sm"
                                            className="bg-white text-slate-700 hover:bg-slate-100"
                                            onClick={() => window.open(candidate.cover_letter_file, '_blank')}
                                        >
                                            <Download className="w-4 h-4 mr-2" /> Télécharger
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>

                {/* Pied de page avec boutons d'action RH */}
                <div className="mt-8 flex gap-4">
                    <Button variant="outline" onClick={() => navigate('/rh')}>
                        Retour à la liste
                    </Button>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => alert('Fonctionnalité à venir : Changer le statut, Noter le candidat...')}>
                        Évaluer le profil
                    </Button>
                </div>
            </main>
        </div>
    )
}