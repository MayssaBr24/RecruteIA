import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { ArrowRight, Calendar } from 'lucide-react'

interface JobCardProps {
    id: number
    title: string
    description: string
    createdAt: string
}

export function JobCard({ id, title, description, createdAt }: JobCardProps) {
    const navigate = useNavigate()

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        })
    }

    const handleCardClick = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button')) {
            return
        }
        navigate(`/jobs/${id}`)
    }

    return (
        <Card
            className="group relative bg-white dark:bg-slate-900 border-0 shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden cursor-pointer"
            onClick={handleCardClick}
        >
            {/* Bordures animées */}
            <div className="absolute inset-0 border border-slate-200 dark:border-slate-800 group-hover:border-blue-200 dark:group-hover:border-blue-900 rounded-lg transition-colors duration-500" />

            {/* Effet de spotlight */}
            <div className="absolute -inset-px bg-gradient-to-r from-blue-500 to-purple-700 rounded-lg opacity-0 group-hover:opacity-10 transition-opacity duration-500 blur-xl" />

            <div className="relative p-6">
                {/* Titre avec ligne décorative */}
                <div className="mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {title}
                    </h3>

                    <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDate(createdAt)}
                        </span>
                    </div>
                </div>

                {/* Description */}
                <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                    {description}
                </p>

                {/* Bouton stylisé */}
                <div className="flex justify-end">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/jobs/${id}`)
                        }}
                        className="group/btn relative px-0 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-transparent hover:bg-transparent"
                    >
                        <span className="flex items-center gap-2 text-sm font-medium">
                            Découvrir le poste
                            <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                        </span>
                        <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 dark:bg-blue-400 group-hover/btn:w-full transition-all duration-300" />
                    </Button>
                </div>
            </div>

            {/* Accent visuel */}
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-bl-full group-hover:scale-150 transition-transform duration-500" />
        </Card>
    )
}