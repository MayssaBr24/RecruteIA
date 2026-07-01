import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card }   from '../../../../components/ui/card'
import { Button } from '../../../../components/ui/button'
import { Badge }  from '../../../../components/ui/badge'
import {
    Dialog, DialogContent, DialogDescription,
    DialogFooter, DialogHeader, DialogTitle,
} from '../../../../components/ui/dialog'
import { useToast } from '../../../hooks/use-toast'
import {
    Loader2, Briefcase, Eye, Archive,
    Plus, Calendar, MapPin, Users, Search
} from 'lucide-react'
import { JobOffer, WeightsConfig } from '../../../hooks/useRHData'
import { CVMatchPanel } from './CVMatchPanel'
import api from '../../../lib/api'

// ==============================================
// TYPES
// ==============================================

interface OffersGridProps {
    jobs: JobOffer[]
    loading: boolean
    onCreateClick: () => void
    onJobUpdate?: () => void
    onUpdateWeights?: (jobId: number, weights: WeightsConfig) => Promise<boolean>
}

// ==============================================
// COMPOSANT
// ==============================================

export function OffersGrid({
                               jobs, loading, onJobUpdate
                           }: OffersGridProps) {

    // ✅ Tous les hooks INSIDE le composant
    const { toast }    = useToast()
    const navigate     = useNavigate()

    const [deletingId, setDeletingId]         = useState<number | null>(null)
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const [jobToDelete, setJobToDelete]       = useState<JobOffer | null>(null)
    const [cvMatchJob, setCvMatchJob]         = useState<JobOffer | null>(null)

    // ── Handlers ──────────────────────────────

    const handleDeleteClick = (job: JobOffer, e: React.MouseEvent) => {
        e.stopPropagation()
        setJobToDelete(job)
        setShowDeleteDialog(true)
    }

    const handleConfirmDelete = async () => {
        if (!jobToDelete) return
        try {
            setDeletingId(jobToDelete.id)
            await api.delete(`/rh/jobs/${jobToDelete.id}/`)
            onJobUpdate?.()
            toast({
                title: 'Offre archivée',
                description: `"${jobToDelete.title}" a été archivée.`,
            })
        } catch {
            toast({
                title: 'Erreur',
                description: "Impossible d'archiver l'offre.",
                variant: 'destructive',
            })
        } finally {
            setDeletingId(null)
            setShowDeleteDialog(false)
            setJobToDelete(null)
        }
    }

    const formatDate = (dateString: string) =>
        new Date(dateString).toLocaleDateString('fr-FR', {
            day: 'numeric', month: 'short', year: 'numeric'
        })

    const isExpired = (deadline: string) =>
        new Date(deadline) < new Date()

    // ── Loading ───────────────────────────────

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24">
                <Loader2 className="w-10 h-10 animate-spin text-purple-400" />
                <p className="mt-4 text-sm text-slate-400">
                    Chargement des offres...
                </p>
            </div>
        )
    }

    // ── Empty state ───────────────────────────

    if (jobs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24
                            border-2 border-dashed border-slate-700 rounded-2xl">
                <div className="w-20 h-20 rounded-2xl bg-purple-600/10
                                border border-purple-500/20
                                flex items-center justify-center mb-5">
                    <Briefcase className="w-10 h-10 text-purple-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                    Aucune offre publiée
                </h3>
                <p className="text-slate-400 text-sm mb-6 max-w-sm text-center">
                    Créez votre première offre pour attirer les meilleurs talents.
                </p>
                <Button
                    onClick={() => navigate('/rh/offers/create')}
                    className="bg-purple-600 hover:bg-purple-700 text-white
                               px-6 h-11 rounded-xl"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Créer une offre
                </Button>
            </div>
        )
    }

    // ── Grid ──────────────────────────────────

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {jobs.map(job => (
                    <Card key={job.id}
                          className="group relative overflow-hidden
                                   bg-slate-800/50 border border-slate-700
                                   hover:border-purple-500/50
                                   hover:shadow-xl hover:shadow-purple-900/20
                                   transition-all duration-300">

                        {/* Barre top au hover */}
                        <div className="absolute top-0 left-0 right-0 h-0.5
                                        bg-gradient-to-r from-purple-500 to-blue-500
                                        scale-x-0 group-hover:scale-x-100
                                        transition-transform duration-500 origin-left" />

                        <div className="p-5 space-y-4">

                            {/* Header */}
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-12 h-12 rounded-xl shrink-0
                                                    bg-gradient-to-br from-purple-600 to-blue-600
                                                    flex items-center justify-center
                                                    shadow-lg shadow-purple-900/30
                                                    group-hover:scale-110 transition-transform">
                                        <Briefcase className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-white font-semibold
                                                       text-base leading-tight
                                                       truncate group-hover:text-purple-300
                                                       transition-colors">
                                            {job.title}
                                        </h3>
                                        <p className="text-slate-500 text-xs mt-0.5">
                                            {formatDate(job.created_at)}
                                        </p>
                                    </div>
                                </div>

                                {/* Badge candidatures */}
                                <Badge className="bg-purple-600/20 text-purple-300
                                                  border border-purple-500/30 shrink-0
                                                  flex items-center gap-1 px-2.5 py-1">
                                    <Users className="w-3 h-3" />
                                    {job.applications_count || 0}
                                </Badge>
                            </div>

                            {/* Description */}
                            <p className="text-slate-400 text-sm line-clamp-2
                                          leading-relaxed min-h-[40px]">
                                {job.description}
                            </p>

                            {/* Infos */}
                            <div className="flex flex-wrap gap-2">
                                {job.location && (
                                    <span className="flex items-center gap-1 text-xs
                                                     text-slate-400 bg-slate-700/50
                                                     px-2.5 py-1 rounded-full">
                                        <MapPin className="w-3 h-3 text-blue-400" />
                                        {job.location}
                                    </span>
                                )}
                                {job.contract_type && (
                                    <span className="flex items-center gap-1 text-xs
                                                     text-slate-400 bg-slate-700/50
                                                     px-2.5 py-1 rounded-full">
                                        <Briefcase className="w-3 h-3 text-purple-400" />
                                        {job.contract_type}
                                    </span>
                                )}
                                {job.offer_deadline && (
                                    <span className={`flex items-center gap-1 text-xs
                                                      px-2.5 py-1 rounded-full ${
                                        isExpired(job.offer_deadline)
                                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                            : 'bg-green-500/10 text-green-400 border border-green-500/20'
                                    }`}>
                                        <Calendar className="w-3 h-3" />
                                        {new Date(job.offer_deadline)
                                            .toLocaleDateString('fr-FR')}
                                    </span>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-between
                                            pt-4 border-t border-slate-700">
                                <span className="text-xs text-slate-600">
                                    {job.department || ''}
                                </span>
                                <div className="flex gap-1">

                                    {/* Voir */}
                                    <ActionBtn
                                        title="Voir les détails"
                                        hoverClass="hover:bg-blue-500/10 hover:text-blue-400"
                                        onClick={() => navigate(`/rh/offers/${job.id}`)}
                                    >
                                        <Eye className="w-4 h-4" />
                                    </ActionBtn>



                                    {/* CV Match */}
                                    <ActionBtn
                                        title="Chercher dans les anciens CVs"
                                        onClick={e => {
                                            e.stopPropagation()
                                            setCvMatchJob(job)
                                        }}
                                        hoverClass="hover:bg-green-500/10 hover:text-green-400"
                                    >
                                        <Search className="w-4 h-4" />
                                    </ActionBtn>

                                    {/* Archiver */}
                                    <ActionBtn
                                        title="Archiver"
                                        onClick={e => handleDeleteClick(job, e)}
                                        disabled={deletingId === job.id}
                                        hoverClass="hover:bg-red-500/10 hover:text-red-400"
                                    >
                                        {deletingId === job.id
                                            ? <Loader2 className="w-4 h-4 animate-spin" />
                                            : <Archive className="w-4 h-4" />
                                        }
                                    </ActionBtn>
                                </div>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* ── Dialog suppression ── */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800
                              border border-gray-700/50
                              rounded-2xl shadow-2xl shadow-black/50
                              max-w-md backdrop-blur-sm">

                    {/* Effet de glow au survol */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-red-500/0 via-red-500/5 to-red-500/0
                        opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                    <DialogHeader>
                        {/* Animation de l'icône */}
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-500/20 to-red-600/10
                            border border-red-500/30
                            flex items-center justify-center mx-auto mb-4
                            shadow-lg shadow-red-500/20
                            animate-in zoom-in duration-300">
                            <Archive className="w-7 h-7 text-red-400 drop-shadow-lg" />
                        </div>

                        <DialogTitle className="text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-300
                                   text-center text-xl font-semibold tracking-tight">
                            Archiver l'offre
                        </DialogTitle>

                        <DialogDescription className="text-gray-400 text-center text-sm mt-2">
                            <span className="font-medium text-gray-300">"{jobToDelete?.title}"</span>
                            <br />
                            <span className="text-gray-500">Cette action est réversible</span>
                        </DialogDescription>
                    </DialogHeader>

                    <DialogFooter className="flex gap-3 justify-center mt-6">
                        <Button variant="outline"
                                onClick={() => setShowDeleteDialog(false)}
                                className="flex-1 border-gray-700 bg-gray-800/50 text-gray-300
                               hover:bg-gray-800 hover:border-gray-600
                               rounded-xl px-6 py-2.5
                               transition-all duration-200
                               focus:ring-2 focus:ring-gray-600 focus:ring-offset-2 focus:ring-offset-gray-900">
                            Annuler
                        </Button>

                        <Button
                            onClick={handleConfirmDelete}
                            disabled={deletingId === jobToDelete?.id}
                            className="flex-1 bg-gradient-to-r from-red-600 to-red-700
                           hover:from-red-500 hover:to-red-600
                           text-white font-medium
                           rounded-xl px-6 py-2.5
                           transition-all duration-200
                           shadow-lg shadow-red-600/30
                           hover:shadow-red-600/40
                           focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-900
                           disabled:opacity-50 disabled:cursor-not-allowed">
                            {deletingId === jobToDelete?.id ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Archivage...</>
                            ) : 'Confirmer l\'archivage'}
                        </Button>
                    </DialogFooter>

                    {/* Effet de fermeture en croix personnalisé */}
                    <button
                        onClick={() => setShowDeleteDialog(false)}
                        className="absolute right-4 top-4 rounded-full p-1
                       text-gray-500 hover:text-gray-300
                       hover:bg-gray-800 transition-all duration-200
                       focus:outline-none focus:ring-2 focus:ring-gray-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </DialogContent>
            </Dialog>
            {/* ── CV Match Panel ── */}
            {cvMatchJob && (
                <CVMatchPanel
                    title={cvMatchJob.title}
                    requirements={cvMatchJob.requirements || ''}
                    softSkills={cvMatchJob.soft_skills || ''}
                    experienceYears={String(cvMatchJob.experience_years || 0)}
                    educationLevel={cvMatchJob.education_level || ''}
                    onClose={() => setCvMatchJob(null)}
                />
            )}
        </>
    )
}

// ==============================================
// SOUS-COMPOSANT BOUTON ACTION
// ==============================================

function ActionBtn({
                       children, title, onClick, disabled, hoverClass
                   }: {
    children: React.ReactNode
    title: string
    onClick?: (e: React.MouseEvent) => void
    disabled?: boolean
    hoverClass: string
}) {
    return (
        <button
            title={title}
            onClick={onClick}
            disabled={disabled}
            className={`w-8 h-8 flex items-center justify-center rounded-lg
                        text-slate-500 transition-all disabled:opacity-40
                        disabled:cursor-not-allowed ${hoverClass}`}
        >
            {children}
        </button>
    )
}