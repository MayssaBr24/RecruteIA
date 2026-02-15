

import { useEffect, useState } from 'react'
import { Card } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '../../../components/ui/table'
import {
    MoreHorizontal,
    Shield,
    UserCog,
    Mail,
    Calendar,
    Search,
    Filter
} from 'lucide-react'
import api from '../../lib/api'

interface User {
    id: number
    username: string
    email: string
    first_name: string
    last_name: string
    role: 'ADMIN' | 'RH'
    date_joined: string
    is_active: boolean
}

export function UsersTable() {
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        fetchUsers()
    }, [])

    const fetchUsers = async () => {
        try {
            const response = await api.get('/recruitment/admin/users/')
            setUsers(response.data)
        } catch (error) {
            console.error('Erreur chargement utilisateurs:', error)
        } finally {
            setLoading(false)
        }
    }

    const filteredUsers = users.filter(user =>
        user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (loading) {
        return (
            <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200/50 dark:border-gray-800/50 p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-1/4"></div>
                    <div className="space-y-3">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800/50 rounded"></div>
                        ))}
                    </div>
                </div>
            </Card>
        )
    }

    return (
        <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200/50 dark:border-gray-800/50 overflow-hidden">
            <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                            <UserCog className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                Utilisateurs RH & Admin
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Liste des comptes créés ({filteredUsers.length})
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Rechercher..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 text-sm bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none"
                            />
                        </div>
                        <Button variant="outline" size="sm" className="gap-2">
                            <Filter className="w-4 h-4" />
                            Filtres
                        </Button>
                    </div>
                </div>

                <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                    <Table>
                        <TableHeader className="bg-gray-50/50 dark:bg-gray-800/50">
                            <TableRow>
                                <TableHead className="font-semibold">Utilisateur</TableHead>
                                <TableHead className="font-semibold">Contact</TableHead>
                                <TableHead className="font-semibold">Rôle</TableHead>
                                <TableHead className="font-semibold">Date d'inscription</TableHead>
                                <TableHead className="font-semibold">Statut</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredUsers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                        Aucun utilisateur trouvé
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredUsers.map((user) => (
                                    <TableRow key={user.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                            {user.first_name?.[0]}{user.last_name?.[0]}
                          </span>
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900 dark:text-gray-100">
                                                        {user.first_name} {user.last_name}
                                                    </p>
                                                    <p className="text-xs text-gray-500">@{user.username}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Mail className="w-4 h-4 text-gray-500" />
                                                <span className="text-sm text-gray-600 dark:text-gray-400">{user.email}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          user.role === 'ADMIN'
                              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                      }`}>
                        {user.role === 'ADMIN' ? (
                            <Shield className="w-3 h-3" />
                        ) : (
                            <UserCog className="w-3 h-3" />
                        )}
                          {user.role === 'ADMIN' ? 'Administrateur' : 'RH'}
                      </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-4 h-4 text-gray-500" />
                                                <span className="text-sm text-gray-600 dark:text-gray-400">
                          {new Date(user.date_joined).toLocaleDateString('fr-FR')}
                        </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                          user.is_active
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                            user.is_active ? 'bg-green-500' : 'bg-red-500'
                        }`}></span>
                          {user.is_active ? 'Actif' : 'Inactif'}
                      </span>
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <MoreHorizontal className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </Card>
    )
}