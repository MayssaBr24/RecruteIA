// pages/RHSpace.tsx
import React, { useState } from 'react'
import { Header } from '../components/Header'
import { Button } from '../../components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { Plus } from 'lucide-react'
import { useToast } from '../hooks/use-toast'
import { useRHData } from '../hooks/useRHData'
import api from '../lib/api'

// Components
import { KPICards } from '../components/rh/dashboard/KPICards'
import { OffersGrid } from '../components/rh/offers/OffersGrid'
import { CreateJobDialog } from '../components/rh/offers/CreateJobDialog'
import { ApplicationsTable } from '../components/rh/applications/ApplicationsTable'
import { InterviewCalendar } from '../components/rh/calendar/InterviewCalendar'

// --- INTERFACE CORRIGÉE ---
interface NewJobForm {
    title: string
    description: string
    requirements: string        // Utilise 'requirements' (Backend)
    experience_years: string
    education_level: string
    soft_skills: string
}

export default function RHSpace() {
    const { toast } = useToast()
    const { jobs, applications, loadingJobs, loadingApps, addJob } = useRHData()

    const [showNewJobDialog, setShowNewJobDialog] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [activeTab, setActiveTab] = useState('overview')

    // --- ÉTAT INITIAL CORRIGÉ ---
    const [newJob, setNewJob] = useState<NewJobForm>({
        title: '',
        description: '',
        requirements: '',          // <--- CORRECT ICI (au lieu de skills_required)
        experience_years: '0',
        education_level: 'BAC+5',
        soft_skills: ''
    })

    // Calculate KPIs
    const activeJobs = jobs.length
    const pendingApplications = applications.filter(app => app.status === 'pending' || !app.status).length
    const responseRate = applications.length > 0
        ? Math.round((applications.filter(app => app.status && app.status !== 'pending').length / applications.length) * 100)
        : 0
    const upcomingInterviews = applications.filter(app => app.status === 'interview_scheduled').length

    const handleCreateJob = async (e: React.FormEvent) => {
        e.preventDefault()

        // Validation sur le bon champ
        if (!newJob.title || !newJob.description || !newJob.requirements) {
            toast({
                title: 'Erreur',
                description: 'Veuillez remplir tous les champs obligatoires',
                variant: 'destructive',
            })
            return
        }

        try {
            setSubmitting(true)

            // --- CORRECTION URL ---
            // Utilise l'endpoint public qui gère le POST (voir views.py JobOfferListCreateView)
            const response = await api.post('/recruitment/jobs/', newJob)

            addJob(response.data)

            // Réinitialisation complète
            setNewJob({
                title: '',
                description: '',
                requirements: '',
                experience_years: '0',
                education_level: 'BAC+5',
                soft_skills: ''
            })
            setShowNewJobDialog(false)

            toast({
                title: 'Succès',
                description: 'Offre d\'emploi créée avec succès',
            })
        } catch (err: unknown) {
            console.error('Erreur:', err)
            toast({
                title: 'Erreur',
                description: err instanceof Error ? err.message : 'Erreur lors de la création',
                variant: 'destructive',
            })
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="min-h-screen bg-background">
            <Header />

            <main className="flex-1">
                <div className="px-4 md:px-8 py-8 max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                            Espace Recrutement
                        </h1>
                        <p className="text-muted-foreground">Gestion des offres et des talents</p>
                    </div>

                    {/* KPIs */}
                    <KPICards
                        activeJobs={activeJobs}
                        pendingApplications={pendingApplications}
                        responseRate={responseRate}
                        upcomingInterviews={upcomingInterviews}
                    />

                    {/* Tabs */}
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-8">
                        <TabsList className="grid w-full grid-cols-4 mb-8 h-14 bg-card border border-border/50">
                            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
                            <TabsTrigger value="offers">Mes Offres</TabsTrigger>
                            <TabsTrigger value="applications">Candidatures</TabsTrigger>
                            <TabsTrigger value="calendar">Planning</TabsTrigger>
                        </TabsList>

                        <TabsContent value="overview">
                            {/* À implémenter */}
                        </TabsContent>

                        <TabsContent value="offers">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h2 className="text-2xl font-semibold">Offres d'emploi publiées</h2>
                                    <p className="text-sm text-muted-foreground mt-1">Gérez vos offres actives</p>
                                </div>
                                <Button
                                    onClick={() => setShowNewJobDialog(true)}
                                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 gap-2 h-11"
                                >
                                    <Plus className="w-4 h-4" />
                                    Nouvelle offre
                                </Button>
                            </div>
                            <OffersGrid jobs={jobs} loading={loadingJobs} onCreateClick={() => setShowNewJobDialog(true)} />
                        </TabsContent>

                        <TabsContent value="applications">
                            <div className="mb-6">
                                <h2 className="text-2xl font-semibold">Candidatures reçues</h2>
                                <p className="text-sm text-muted-foreground mt-1">Gérez vos candidats</p>
                            </div>
                            <ApplicationsTable applications={applications} loading={loadingApps} />
                        </TabsContent>
                        <TabsContent value="calendar">
                            <section>
                                <h2 className="text-xl font-semibold mb-4">Aperçu du Calendrier</h2>
                                <InterviewCalendar />
                            </section>
                        </TabsContent>

                    </Tabs>
                </div>
            </main>

            <CreateJobDialog
                open={showNewJobDialog}
                onOpenChange={setShowNewJobDialog}
                newJob={newJob}
                setNewJob={setNewJob}
                onSubmit={handleCreateJob}
                submitting={submitting}
            />
        </div>
    )
}