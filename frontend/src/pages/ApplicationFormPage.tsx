// src/pages/ApplicationFormPage.tsx
import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import {
    Loader2,
    ArrowLeft,
    Upload,
    GraduationCap,
    Briefcase,
    Linkedin,
    Globe,
    DollarSign,
    Calendar,
    Sparkles,
    CheckCircle2,
    TrendingUp,
    FileText,
    AlertCircle
} from 'lucide-react'
import api from '../lib/api'
import { useToast } from '../hooks/use-toast'

interface AIAnalysisResult {
    status: 'completed' | 'pending' | 'error'
    score?: number
    message: string
    next_steps?: string
}

export function ApplicationFormPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { toast } = useToast()

    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null)
    const [jobTitle, setJobTitle] = useState('')

    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        phone: '',
        nationality: '',
        university: '',
        degree_level: '',
        graduation_year: '',
        experience_years: '0',
        linkedin_url: '',
        portfolio_url: '',
        current_location: '',
        salary_expectation: '',
        availability_date: '',
        cv_file: null as File | null,
        cover_letter_file: null as File | null,
    })

    useEffect(() => {
        const fetchJobTitle = async () => {
            if (!id) {
                toast({ title: 'Erreur', description: 'ID offre manquant', variant: 'destructive' })
                navigate('/')
                return
            }

            try {
                const response = await api.get(`/recruitment/jobs/${id}/`)
                setJobTitle(response.data.title)
                setLoading(false)
            } catch (err) {
                console.error('Erreur chargement offre:', err)
                toast({ title: 'Erreur', description: 'Offre introuvable', variant: 'destructive' })
                navigate('/')
            }
        }
        fetchJobTitle()
    }, [id, navigate, toast])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'cv_file' | 'cover_letter_file') => {
        const file = e.target.files?.[0] || null

        if (file) {
            // Validation PDF
            if (!file.name.toLowerCase().endsWith('.pdf')) {
                toast({
                    title: 'Format invalide',
                    description: 'Seuls les fichiers PDF sont acceptés',
                    variant: 'destructive'
                })
                e.target.value = ''
                return
            }

            // Validation taille
            const maxSize = field === 'cv_file' ? 5 : 3 // 5MB pour CV, 3MB pour lettre
            if (file.size > maxSize * 1024 * 1024) {
                toast({
                    title: 'Fichier trop volumineux',
                    description: `Le fichier ne doit pas dépasser ${maxSize} MB`,
                    variant: 'destructive'
                })
                e.target.value = ''
                return
            }
        }

        setFormData({ ...formData, [field]: file })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // Validation ID offre
        if (!id) {
            toast({
                title: 'Erreur',
                description: 'ID de l\'offre manquant',
                variant: 'destructive'
            })
            return
        }

        // Validation champs obligatoires
        if (!formData.full_name?.trim() || !formData.email?.trim() || !formData.phone?.trim()) {
            toast({
                title: 'Champs manquants',
                description: 'Nom, email et téléphone sont obligatoires',
                variant: 'destructive'
            })
            return
        }

        if (!formData.cv_file) {
            toast({
                title: 'CV manquant',
                description: 'Le CV est obligatoire',
                variant: 'destructive'
            })
            return
        }

        try {
            setSubmitting(true)

            const data = new FormData()

            // Champs obligatoires
            data.append('job_offer', id)
            data.append('full_name', formData.full_name.trim())
            data.append('email', formData.email.trim())
            data.append('phone', formData.phone.trim())
            data.append('cv_file', formData.cv_file)

            // Champs optionnels (seulement si remplis)
            if (formData.cover_letter_file) {
                data.append('cover_letter_file', formData.cover_letter_file)
            }
            if (formData.nationality?.trim()) {
                data.append('nationality', formData.nationality.trim())
            }
            if (formData.university?.trim()) {
                data.append('university', formData.university.trim())
            }
            if (formData.degree_level?.trim()) {
                data.append('degree_level', formData.degree_level.trim())
            }
            if (formData.graduation_year?.trim()) {
                data.append('graduation_year', formData.graduation_year.trim())
            }
            if (formData.experience_years) {
                data.append('experience_years', formData.experience_years)
            }
            if (formData.linkedin_url?.trim()) {
                data.append('linkedin_url', formData.linkedin_url.trim())
            }
            if (formData.portfolio_url?.trim()) {
                data.append('portfolio_url', formData.portfolio_url.trim())
            }
            if (formData.current_location?.trim()) {
                data.append('current_location', formData.current_location.trim())
            }
            if (formData.salary_expectation?.trim()) {
                data.append('salary_expectation', formData.salary_expectation.trim())
            }
            if (formData.availability_date?.trim()) {
                data.append('availability_date', formData.availability_date.trim())
            }

            // 🔍 DEBUG (à supprimer en production)
            console.log('📤 Envoi des données:')
            for (let pair of data.entries()) {
                console.log(pair[0], pair[1] instanceof File ? pair[1].name : pair[1])
            }

            // Envoi avec analyse IA
            const response = await api.post('/recruitment/applications/', data, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })

            console.log('✅ Réponse reçue:', response.data)

            // Récupérer le résultat de l'analyse IA
            const aiResult = response.data.ai_analysis

            setAiAnalysis(aiResult)
            setSubmitted(true)

            toast({
                title: 'Candidature envoyée !',
                description: 'Votre CV a été analysé par notre IA'
            })

        } catch (err: any) {
            console.error('❌ Erreur complète:', err.response?.data)

            let errorMsg = 'Une erreur est survenue lors de l\'envoi'

            if (err.response?.data) {
                // Si c'est un objet d'erreurs de validation Django
                if (typeof err.response.data === 'object' && !err.response.data.message) {
                    const errors = Object.entries(err.response.data)
                        .map(([field, messages]: [string, any]) => {
                            const msgArray = Array.isArray(messages) ? messages : [messages]
                            return `${field}: ${msgArray.join(', ')}`
                        })
                        .join('\n')
                    errorMsg = errors
                } else {
                    errorMsg = err.response.data.message ||
                        err.response.data.detail ||
                        JSON.stringify(err.response.data)
                }
            }

            toast({
                title: 'Erreur',
                description: errorMsg,
                variant: 'destructive'
            })
        } finally {
            setSubmitting(false)
        }
    }

    // Vue de succès avec résultats IA
    if (submitted && aiAnalysis) {
        return (
            <div className="min-h-screen bg-background">
                <Header />
                <main className="flex-1 px-4 md:px-8 py-8 max-w-3xl mx-auto">

                    <Card className="p-8 text-center bg-gradient-to-br from-white to-blue-50 border-2 border-blue-100">

                        {/* Icône de succès */}
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/30">
                            <CheckCircle2 className="w-12 h-12 text-white" />
                        </div>

                        <h1 className="text-3xl font-bold mb-4 text-slate-900">
                            Candidature envoyée avec succès !
                        </h1>

                        {/* Analyse IA */}
                        {aiAnalysis.status === 'completed' && aiAnalysis.score !== undefined && (
                            <div className="my-8">
                                <div className="flex items-center justify-center gap-2 mb-4">
                                    <Sparkles className="w-5 h-5 text-purple-500" />
                                    <h2 className="text-xl font-semibold text-slate-800">
                                        Analyse IA de votre profil
                                    </h2>
                                </div>

                                {/* Score visuel circulaire */}
                                <div className="relative w-32 h-32 mx-auto mb-6">
                                    <svg className="transform -rotate-90 w-32 h-32">
                                        <circle
                                            cx="64"
                                            cy="64"
                                            r="56"
                                            stroke="#e5e7eb"
                                            strokeWidth="12"
                                            fill="none"
                                        />
                                        <circle
                                            cx="64"
                                            cy="64"
                                            r="56"
                                            stroke={
                                                aiAnalysis.score >= 80 ? '#10b981' :
                                                    aiAnalysis.score >= 50 ? '#3b82f6' :
                                                        '#ef4444'
                                            }
                                            strokeWidth="12"
                                            fill="none"
                                            strokeDasharray={`${aiAnalysis.score * 3.51} 351.86`}
                                            strokeLinecap="round"
                                            className="transition-all duration-1000 ease-out"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="text-center">
                                            <div className="text-3xl font-bold text-slate-900">
                                                {aiAnalysis.score}
                                            </div>
                                            <div className="text-xs text-slate-500">/ 100</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Badge de décision */}
                                <div className="flex justify-center mb-4">
                                    {aiAnalysis.score >= 80 ? (
                                        <div className="px-4 py-2 bg-green-100 text-green-700 rounded-full font-semibold flex items-center gap-2">
                                            <TrendingUp className="w-4 h-4" />
                                            Profil Excellent
                                        </div>
                                    ) : aiAnalysis.score >= 50 ? (
                                        <div className="px-4 py-2 bg-blue-100 text-blue-700 rounded-full font-semibold flex items-center gap-2">
                                            <FileText className="w-4 h-4" />
                                            Profil Prometteur
                                        </div>
                                    ) : (
                                        <div className="px-4 py-2 bg-orange-100 text-orange-700 rounded-full font-semibold flex items-center gap-2">
                                            <AlertCircle className="w-4 h-4" />
                                            Profil À Examiner
                                        </div>
                                    )}
                                </div>

                                {/* Message personnalisé */}
                                <Alert className="bg-blue-50 border-blue-200 text-left">
                                    <Sparkles className="h-4 w-4 text-blue-600" />
                                    <AlertDescription className="text-slate-700">
                                        {aiAnalysis.message}
                                    </AlertDescription>
                                </Alert>

                                {/* Prochaines étapes */}
                                {aiAnalysis.next_steps && (
                                    <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
                                        <p className="text-sm font-medium text-slate-800">
                                            📩 {aiAnalysis.next_steps}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Analyse en attente ou erreur */}
                        {aiAnalysis.status !== 'completed' && (
                            <Alert className="bg-yellow-50 border-yellow-200 mt-6">
                                <AlertCircle className="h-4 w-4 text-yellow-600" />
                                <AlertDescription className="text-slate-700">
                                    {aiAnalysis.message}
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row gap-4 mt-8 justify-center">
                            <Button
                                variant="outline"
                                onClick={() => navigate('/')}
                            >
                                Retour aux offres
                            </Button>
                            <Button
                                onClick={() => {
                                    setSubmitted(false)
                                    setAiAnalysis(null)
                                    setFormData({
                                        full_name: '',
                                        email: '',
                                        phone: '',
                                        nationality: '',
                                        university: '',
                                        degree_level: '',
                                        graduation_year: '',
                                        experience_years: '0',
                                        linkedin_url: '',
                                        portfolio_url: '',
                                        current_location: '',
                                        salary_expectation: '',
                                        availability_date: '',
                                        cv_file: null,
                                        cover_letter_file: null,
                                    })
                                }}
                                className="bg-gradient-to-r from-blue-600 to-purple-600"
                            >
                                Postuler à une autre offre
                            </Button>
                        </div>

                    </Card>
                </main>
            </div>
        )
    }

    // Formulaire de candidature
    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background">
            <Header />
            <main className="flex-1 max-w-3xl mx-auto px-4 py-8">
                <Button variant="ghost" onClick={() => navigate(`/jobs/${id}`)} className="mb-6">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Retour à l'offre
                </Button>

                <Card className="p-8 border-t-4 border-t-blue-600">
                    <div className="mb-8 border-b pb-4">
                        <h1 className="text-2xl font-bold mb-2">Candidature pour : {jobTitle}</h1>
                        <p className="text-muted-foreground text-sm">
                            Remplissez les informations ci-dessous. Les champs marqués * sont obligatoires.
                        </p>
                    </div>

                    {/* Alerte IA */}
                    <Alert className="mb-6 bg-blue-50 border-blue-200">
                        <Sparkles className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-slate-700">
                            <strong>Analyse IA automatique :</strong> Votre CV sera analysé instantanément
                            par notre intelligence artificielle pour évaluer l'adéquation avec le poste.
                        </AlertDescription>
                    </Alert>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Section Informations Personnelles */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Briefcase className="w-5 h-5" /> Informations Personnelles
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Nom complet *</Label>
                                    <Input
                                        value={formData.full_name}
                                        onChange={e => setFormData({...formData, full_name: e.target.value})}
                                        placeholder="Ex: Jean Dupont"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Email *</Label>
                                    <Input
                                        type="email"
                                        value={formData.email}
                                        onChange={e => setFormData({...formData, email: e.target.value})}
                                        placeholder="jean.dupont@example.com"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Téléphone *</Label>
                                    <Input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={e => setFormData({...formData, phone: e.target.value})}
                                        placeholder="+33 6 12 34 56 78"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Nationalité</Label>
                                    <Input
                                        placeholder="Ex: Française, Tunisienne..."
                                        value={formData.nationality}
                                        onChange={e => setFormData({...formData, nationality: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label>Ville actuelle</Label>
                                    <Input
                                        placeholder="Ex: Paris, France"
                                        value={formData.current_location}
                                        onChange={e => setFormData({...formData, current_location: e.target.value})}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section Académique */}
                        <div className="space-y-4 pt-4 border-t">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <GraduationCap className="w-5 h-5" /> Formation
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Université / École</Label>
                                    <Input
                                        placeholder="Ex: Université Paris Dauphine"
                                        value={formData.university}
                                        onChange={e => setFormData({...formData, university: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Diplôme obtenu</Label>
                                    <Input
                                        placeholder="Ex: Master Informatique"
                                        value={formData.degree_level}
                                        onChange={e => setFormData({...formData, degree_level: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Année d'obtention</Label>
                                    <Input
                                        type="number"
                                        placeholder="2023"
                                        value={formData.graduation_year}
                                        onChange={e => setFormData({...formData, graduation_year: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Années d'expérience</Label>
                                    <Select
                                        onValueChange={(val) => setFormData({...formData, experience_years: val})}
                                        defaultValue="0"
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="0">Junior (0-2 ans)</SelectItem>
                                            <SelectItem value="3">Confirmé (3-5 ans)</SelectItem>
                                            <SelectItem value="6">Senior (6+ ans)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        {/* Section Professionnelle */}
                        <div className="space-y-4 pt-4 border-t">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Globe className="w-5 h-5" /> Réseaux & Portfolio
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <Linkedin className="w-4 h-4"/> LinkedIn
                                    </Label>
                                    <Input
                                        type="url"
                                        placeholder="https://linkedin.com/in/..."
                                        value={formData.linkedin_url}
                                        onChange={e => setFormData({...formData, linkedin_url: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <Globe className="w-4 h-4"/> Portfolio / GitHub
                                    </Label>
                                    <Input
                                        type="url"
                                        placeholder="Lien vers vos travaux"
                                        value={formData.portfolio_url}
                                        onChange={e => setFormData({...formData, portfolio_url: e.target.value})}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section Documents & Contraintes */}
                        <div className="space-y-4 pt-4 border-t">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Upload className="w-5 h-5" /> Documents & Disponibilité
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>CV (PDF) *</Label>
                                    <Input
                                        type="file"
                                        accept=".pdf"
                                        onChange={e => handleFileChange(e, 'cv_file')}
                                        required
                                        className="cursor-pointer"
                                    />
                                    {formData.cv_file && (
                                        <p className="text-xs text-green-600 flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3" />
                                            {formData.cv_file.name}
                                        </p>
                                    )}
                                    <p className="text-xs text-slate-500">Format PDF • Max 5 MB</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Lettre de motivation (PDF)</Label>
                                    <Input
                                        type="file"
                                        accept=".pdf"
                                        onChange={e => handleFileChange(e, 'cover_letter_file')}
                                        className="cursor-pointer"
                                    />
                                    {formData.cover_letter_file && (
                                        <p className="text-xs text-green-600 flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3" />
                                            {formData.cover_letter_file.name}
                                        </p>
                                    )}
                                    <p className="text-xs text-slate-500">Optionnel • Max 3 MB</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <DollarSign className="w-4 h-4"/> Prétention salariale (€/mois)
                                    </Label>
                                    <Input
                                        type="number"
                                        placeholder="Ex: 3500"
                                        value={formData.salary_expectation}
                                        onChange={e => setFormData({...formData, salary_expectation: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4"/> Date de disponibilité
                                    </Label>
                                    <Input
                                        type="date"
                                        value={formData.availability_date}
                                        onChange={e => setFormData({...formData, availability_date: e.target.value})}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 flex gap-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => navigate(-1)}
                                className="flex-1"
                            >
                                Annuler
                            </Button>
                            <Button
                                type="submit"
                                disabled={submitting}
                                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        Analyse en cours...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4 mr-2" />
                                        Envoyer ma candidature
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </Card>
            </main>
        </div>
    )
}