import { Plus, Users as UsersIcon } from 'lucide-react'
import { useAdminUsers } from '../../hooks/useAdminUsers'
import { useState } from "react"
import { Button } from "../../../components/ui/button.tsx"
import { UsersFilters } from "./users/UsersFilters.tsx"
import { UsersTable } from "./users/UsersTable.tsx"
import { CreateUserDialog } from "./users/CreateUserDialog"
import { motion } from 'framer-motion'

export default function UsersManagement() {
    const { users, loading, filters, setFilters, toggleUserActive, deleteUser } = useAdminUsers()
    const [isCreateUserOpen, setIsCreateUserOpen] = useState(false)
    const [selectedUser, setSelectedUser] = useState<number | null>(null)

    const handleViewDetails = (userId: number) => {
        setSelectedUser(userId)
        console.log('View details for user:', userId)
    }

    const handleDelete = (userId: number) => {
        if (window.confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
            deleteUser(userId)
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="w-full space-y-6"
        >
            {/* Page Header avec animation */}
            <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-gray-900/50 to-gray-800/50 backdrop-blur-sm border border-gray-800 p-6"
            >
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg">
                            <UsersIcon className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
                                Gestion des Utilisateurs
                            </h1>
                            <p className="text-gray-400 mt-1">Gérez les comptes Admin et RH de la plateforme</p>
                        </div>
                    </div>

                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <Button
                            onClick={() => setIsCreateUserOpen(true)}
                            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-500/20"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Nouvel Utilisateur
                        </Button>
                    </motion.div>
                </div>
            </motion.div>

            {/* Filters avec animation */}
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
            >
                <UsersFilters filters={filters} onFilterChange={setFilters} />
            </motion.div>

            {/* Users Table avec animation */}
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
            >
                <UsersTable
                    users={users}
                    loading={loading}
                    onToggleActive={toggleUserActive}
                    onDelete={handleDelete}
                    onViewDetails={handleViewDetails}
                />
            </motion.div>

            {/* Create User Dialog */}
            <CreateUserDialog
                open={isCreateUserOpen}
                onOpenChange={setIsCreateUserOpen}
                onUserCreated={() => {
                    setFilters({ ...filters })
                }}
            />
        </motion.div>
    )
}