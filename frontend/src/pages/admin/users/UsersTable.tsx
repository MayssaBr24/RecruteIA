import { Eye, Power, Trash2, Loader2, UserCircle } from 'lucide-react'
import { AdminUser } from '../../../hooks/useAdminUsers'
import { Card } from "../../../../components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table"
import { Badge } from "../../../../components/ui/badge"
import { Button } from "../../../../components/ui/button"
import { motion } from 'framer-motion'

interface UsersTableProps {
    users: AdminUser[]
    loading: boolean
    onToggleActive: (userId: number) => void
    onDelete: (userId: number) => void
    onViewDetails: (userId: number) => void
}

export function UsersTable({ users, loading, onToggleActive, onDelete, onViewDetails }: UsersTableProps) {
    if (loading) {
        return (
            <Card className="p-12 flex justify-center bg-gray-900 border-gray-800">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </Card>
        )
    }

    if (users.length === 0) {
        return (
            <Card className="p-12 text-center bg-gray-900 border-gray-800">
                <UserCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">Aucun utilisateur trouvé</p>
            </Card>
        )
    }

    return (
        <Card className="bg-gray-900 border-gray-800 overflow-hidden shadow-xl">
            <Table>
                <TableHeader>
                    <TableRow className="border-gray-800 bg-gray-800/50">
                        <TableHead className="font-semibold text-gray-300">Utilisateur</TableHead>
                        <TableHead className="font-semibold text-gray-300">Email</TableHead>
                        <TableHead className="font-semibold text-gray-300">Statut</TableHead>
                        <TableHead className="font-semibold text-gray-300">Dernière Connexion</TableHead>
                        <TableHead className="text-right font-semibold text-gray-300">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {users.map((user, index) => (
                        <motion.tr
                            key={user.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="border-gray-800 hover:bg-gray-800/50 transition-colors"
                        >
                            <TableCell>
                                <div>
                                    <p className="font-medium text-white">{user.username}</p>
                                    {(user.first_name || user.last_name) && (
                                        <p className="text-sm text-gray-400">
                                            {user.first_name} {user.last_name}
                                        </p>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell className="text-sm text-gray-300">{user.email}</TableCell>
                            <TableCell>
                                {user.is_active ? (
                                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                        Actif
                                    </Badge>
                                ) : (
                                    <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
                                        Inactif
                                    </Badge>
                                )}
                            </TableCell>
                            <TableCell className="text-sm text-gray-400">
                                {user.last_login_formatted || 'Jamais connecté'}
                            </TableCell>
                            <TableCell>
                                <div className="flex justify-end gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-purple-400"
                                        onClick={() => onViewDetails(user.id)}
                                        title="Voir détails"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className={`h-8 w-8 p-0 bg-gray-800 ${
                                            user.is_active
                                                ? 'text-gray-400 hover:bg-gray-700 hover:text-orange-400'
                                                : 'text-gray-400 hover:bg-gray-700 hover:text-emerald-400'
                                        }`}
                                        onClick={() => onToggleActive(user.id)}
                                        title={user.is_active ? 'Désactiver' : 'Activer'}
                                    >
                                        <Power className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-red-400"
                                        onClick={() => onDelete(user.id)}
                                        title="Supprimer"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </TableCell>
                        </motion.tr>
                    ))}
                </TableBody>
            </Table>
        </Card>
    )
}