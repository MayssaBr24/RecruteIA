import { Activity } from '../../../hooks/useAdminDashboard'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Card } from "../../../../components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table"
import { motion } from 'framer-motion'
import { Activity as ActivityIcon } from 'lucide-react'

interface RecentActivityTableProps {
    activities: Activity[]
}

const getActivityColor = (type: string) => {
    const colors: Record<string, string> = {
        'login': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        'create_offer': 'bg-green-500/20 text-green-400 border-green-500/30',
        'review_application': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
        'schedule_interview': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        'update': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        'delete': 'bg-red-500/20 text-red-400 border-red-500/30',
    }
    return colors[type] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
}

const getActivityLabel = (type: string) => {
    const labels: Record<string, string> = {
        'login': 'Connexion',
        'create_offer': 'Création offre',
        'review_application': 'Examen candidature',
        'schedule_interview': 'Planification entretien',
        'update': 'Modification',
        'delete': 'Suppression',
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
            <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-800 shadow-xl overflow-hidden">
                <div className="p-4 md:p-6 border-b border-gray-800">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-center">
                            <ActivityIcon className="w-4 h-4 md:w-5 md:h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg md:text-xl font-semibold text-white">Activité Récente</h3>
                            <p className="text-xs md:text-sm text-gray-400 mt-0.5 md:mt-1">Dernières actions sur la plateforme</p>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-gray-800 bg-gray-900/50">
                                <TableHead className="font-semibold text-gray-300 text-xs md:text-sm">Utilisateur</TableHead>
                                <TableHead className="font-semibold text-gray-300 text-xs md:text-sm">Type</TableHead>
                                <TableHead className="font-semibold text-gray-300 text-xs md:text-sm hidden md:table-cell">Description</TableHead>
                                <TableHead className="font-semibold text-gray-300 text-xs md:text-sm hidden lg:table-cell">IP</TableHead>
                                <TableHead className="font-semibold text-gray-300 text-xs md:text-sm">Date</TableHead>
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
                                        className="border-gray-800 hover:bg-gray-800/50 transition-colors duration-200"
                                    >
                                        <TableCell className="font-medium text-white text-sm md:text-base">
                                            {activity.username}
                                        </TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getActivityColor(activity.activity_type)} whitespace-nowrap`}>
                                                {getActivityLabel(activity.activity_type)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="max-w-[150px] md:max-w-xs truncate text-xs md:text-sm text-gray-300 hidden md:table-cell">
                                            {activity.description}
                                        </TableCell>
                                        <TableCell className="text-xs md:text-sm text-gray-400 hidden lg:table-cell">
                                            {activity.ip_address || '-'}
                                        </TableCell>
                                        <TableCell className="text-xs md:text-sm text-gray-400 whitespace-nowrap">
                                            {formatDistanceToNow(new Date(activity.timestamp), {
                                                addSuffix: true,
                                                locale: fr
                                            })}
                                        </TableCell>
                                    </motion.tr>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                                        <motion.div
                                            animate={{ y: [0, -5, 0] }}
                                            transition={{ duration: 2, repeat: Infinity }}
                                        >
                                            <ActivityIcon className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-3 opacity-30" />
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