// components/rh/applications/ApplicationsTable.tsx
import { useNavigate } from 'react-router-dom'
import { Card } from '../../../../components/ui/card'
import { Badge } from '../../../../components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/table'
import { Download, Calendar, Eye, Loader2 } from 'lucide-react'
import {Button} from "react-day-picker";

interface Application {
    id: number
    full_name: string
    email: string
    phone: string
    job_offer_title: string
    status: string
    created_at: string
    cv_file: string
    cover_letter_file: string
}

interface ApplicationsTableProps {
    applications: Application[]
    loading: boolean
}

export function ApplicationsTable({ applications, loading }: ApplicationsTableProps) {
    const navigate = useNavigate()

    const handleViewProfile = (appId: number) => {
        navigate(`/rh/applications/${appId}`)
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'interview_scheduled':
                return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Entretien planifié</Badge>
            case 'rejected':
                return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Refusé</Badge>
            case 'accepted':
                return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Accepté</Badge>
            default:
                return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">En attente</Badge>
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        )
    }

    if (applications.length === 0) {
        return (
            <Card className="p-12 text-center bg-gradient-to-br from-card to-card/50">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-950/50 dark:to-blue-950/50 flex items-center justify-center mx-auto mb-4">
                    <Download className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Aucune candidature</h3>
                <p className="text-muted-foreground">Les candidatures apparaîtront ici une fois soumises</p>
            </Card>
        )
    }

    return (
        <Card className="bg-gradient-to-br from-card to-card/50 border-border/60 overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow className="border-border/40 bg-muted/30">
                        <TableHead className="font-semibold">Candidat</TableHead>
                        <TableHead className="font-semibold">Poste</TableHead>
                        <TableHead className="font-semibold">Contact</TableHead>
                        <TableHead className="font-semibold">Date</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {applications.map((app) => (
                        <TableRow key={app.id} className="border-border/40 hover:bg-slate-50 transition-colors">
                            <TableCell className="font-medium">{app.full_name}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                                {app.job_offer_title}
                            </TableCell>
                            <TableCell>
                                <div className="text-sm">
                                    <div className="text-slate-900">{app.email}</div>
                                    <div className="text-slate-500 text-xs">{app.phone}</div>
                                </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                                {new Date(app.created_at).toLocaleDateString('fr-FR')}
                            </TableCell>
                            <TableCell>
                                {getStatusBadge(app.status)}
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                    {/* Bouton Détails (Le plus important) */}
                                    <Button
                                        className="h-8 bg-white text-blue-600 border-blue-200 hover:bg-blue-50 shadow-sm"
                                        onClick={() => handleViewProfile(app.id)}
                                    >
                                        <Eye className="w-4 h-4 mr-1" />
                                        Détails
                                    </Button>

                                    {/* Télécharger CV */}
                                    {app.cv_file && (
                                        <a
                                            href={app.cv_file}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex"
                                        >
                                            <Button
                                                className="h-8 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 shadow-sm"
                                                title="Télécharger CV"
                                            >
                                                <Download className="w-4 h-4" />
                                                CV
                                            </Button>
                                        </a>
                                    )}

                                    {/* Planifier */}
                                    <Button
                                        className="h-8 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 shadow-sm"
                                        title="Planifier un entretien"
                                    >
                                        <Calendar className="w-4 h-4" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Card>
    )
}