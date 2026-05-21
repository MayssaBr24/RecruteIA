import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { motion } from 'framer-motion'
import { Activity as ActivityIcon } from 'lucide-react'
import {Activity} from "../../../hooks/useAdminDashboard.ts";
import {Card} from "../../../../components/ui/card.tsx";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "../../../../components/ui/table.tsx";

interface RecentActivityTableProps {
    activities: Activity[]
}

const getActivityColor = (type: string) => {
    const colors: Record<string, string> = {
        login: 'bg-green-900/30 text-green-400 border border-green-800',
        logout: 'bg-orange-900/30 text-orange-400 border border-orange-800',
        view_dashboard: 'bg-blue-900/30 text-blue-400 border border-blue-800',
        create_offer: 'bg-indigo-900/30 text-indigo-400 border border-indigo-800',
        review_application: 'bg-purple-900/30 text-purple-400 border border-purple-800',
        schedule_interview: 'bg-cyan-900/30 text-cyan-400 border border-cyan-800',
        update: 'bg-yellow-900/30 text-yellow-400 border border-yellow-800',
        delete: 'bg-red-900/30 text-red-400 border border-red-800',
    }
    return colors[type] || 'bg-slate-800 text-slate-300 border border-slate-700'
}

const getActivityLabel = (type: string) => {
    const labels: Record<string, string> = {
        login: 'Connexion',
        logout: 'Déconnexion',
        view_dashboard: 'Consultation dashboard',
        create_offer: 'Création offre',
        review_application: 'Examen candidature',
        schedule_interview: 'Planification entretien',
        update: 'Modification',
        delete: 'Suppression',
    }
    return labels[type] || type
}

export function RecentActivityTable({ activities }: RecentActivityTableProps) {
    const rowVariants = {
        hidden: { opacity: 0, x: -20 },
        visible: { opacity: 1, x: 0 }
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            <Card className="bg-slate-900 border border-slate-800 shadow-lg overflow-hidden">
                <div className="p-6 border-b border-slate-800 bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                            <ActivityIcon className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-100">Activité Récente</h3>
                            <p className="text-xs text-slate-500 mt-1">Dernières actions sur la plateforme</p>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-slate-800 bg-slate-900/30">
                                <TableHead className="font-semibold text-slate-300 text-xs md:text-sm">Utilisateur</TableHead>
                                <TableHead className="font-semibold text-slate-300 text-xs md:text-sm">Type</TableHead>
                                <TableHead className="font-semibold text-slate-300 text-xs md:text-sm hidden md:table-cell">Description</TableHead>
                                <TableHead className="font-semibold text-slate-300 text-xs md:text-sm hidden lg:table-cell">IP</TableHead>
                                <TableHead className="font-semibold text-slate-300 text-xs md:text-sm">Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {activities.length > 0 ? (
                                activities.map((activity, index) => (
                                    <motion.tr
                                        key={activity.id}
                                        variants={rowVariants}
                                        initial="hidden"
                                        animate="visible"
                                        transition={{ delay: index * 0.05 }}
                                        className="border-slate-800 hover:bg-slate-800/40 transition-colors duration-200"
                                    >
                                        <TableCell className="font-medium text-slate-200 text-sm md:text-base">
                                            {activity.username}
                                        </TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${getActivityColor(activity.activity_type)} whitespace-nowrap`}>
                                                {getActivityLabel(activity.activity_type)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="max-w-[150px] md:max-w-xs truncate text-xs md:text-sm text-slate-400 hidden md:table-cell">
                                            {activity.description}
                                        </TableCell>
                                        <TableCell className="text-xs md:text-sm text-slate-500 hidden lg:table-cell">
                                            {activity.ip_address || '-'}
                                        </TableCell>
                                        <TableCell className="text-xs md:text-sm text-slate-500 whitespace-nowrap">
                                            {activity.created_at ? (
                                                formatDistanceToNow(new Date(activity.created_at), {
                                                    addSuffix: true,
                                                    locale: fr
                                                })
                                            ) : '-'}
                                        </TableCell>
                                    </motion.tr>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-slate-500 py-12">
                                        <motion.div
                                            animate={{ y: [0, -5, 0] }}
                                            transition={{ duration: 2, repeat: Infinity }}
                                        >
                                            <ActivityIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                            <p className="text-sm md:text-base">Aucune activité récente</p>
                                        </motion.div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>
        </motion.div>
    )
}
