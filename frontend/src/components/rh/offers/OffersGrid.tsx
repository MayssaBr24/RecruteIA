// components/rh/offers/OffersGrid.tsx
import { Card } from '../../../../components/ui/card'
import { Button } from '../../../../components/ui/button'
import { Badge } from '../../../../components/ui/badge'
import { Loader2, Briefcase, Eye, Edit, Archive, Plus } from 'lucide-react'
import { JobOffer } from '../../../hooks/useRHData'

interface OffersGridProps {
    jobs: JobOffer[]
    loading: boolean
    onCreateClick: () => void
}

export function OffersGrid({ jobs, loading, onCreateClick }: OffersGridProps) {
    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        )
    }

    if (jobs.length === 0) {
        return (
            <Card className="p-12 text-center bg-gradient-to-br from-card to-card/50">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-950/50 dark:to-purple-950/50 flex items-center justify-center mx-auto mb-4">
                    <Briefcase className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Aucune offre publiée</h3>
                <p className="text-muted-foreground mb-6">Commencez par créer votre première offre d'emploi</p>
                <Button
                    onClick={onCreateClick}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Créer une offre
                </Button>
            </Card>
        )
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jobs.map((job) => (
                <Card
                    key={job.id}
                    className="group relative overflow-hidden bg-gradient-to-br from-card to-card/50 border-border/60 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/5 to-primary/10 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div className="relative p-6 space-y-4">
                        <div className="flex items-start justify-between">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                                <Briefcase className="w-6 h-6 text-white" />
                            </div>
                            <Badge variant="outline" className="bg-primary/10">
                                {job.applications_count || 0} candidat{(job.applications_count || 0) !== 1 ? 's' : ''}
                            </Badge>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors line-clamp-1">
                                {job.title}
                            </h3>
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                                {job.description}
                            </p>


                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-border/30">
                            <p className="text-xs text-muted-foreground">
                                {new Date(job.created_at).toLocaleDateString('fr-FR')}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 hover:text-primary"
                                    title="Voir les détails"
                                >
                                    <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 hover:text-primary"
                                    title="Modifier"
                                >
                                    <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                    title="Archiver"
                                >
                                    <Archive className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    )
}