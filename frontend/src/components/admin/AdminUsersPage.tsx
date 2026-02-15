// app/admin/users/page.tsx
'use client'

import React, { useState } from 'react'
import { AdminHeader } from '../layout/AdminHeader'
import { AdminSidebar } from '../layout/AdminSidebar'
import { Card } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select'
import { UsersTable } from './UsersTable'
import { UserPlus, Loader2, Shield, UserCog } from 'lucide-react'
import api from '../../lib/api'
import { useToast } from '../../hooks/use-toast'

interface AdminUsersPage {
    username: string
    email: string
    first_name: string
    last_name: string
    password: string
    role: 'ADMIN' | 'RH'
}

export default function AdminUsersPage() {
    const { toast } = useToast()
    const [submitting, setSubmitting] = useState(false)
    const [showSuccess, setShowSuccess] = useState(false)
    const [refreshKey, setRefreshKey] = useState(0)

    const [formData, setFormData] = useState<AdminUsersPage>({
        username: '',
        email: '',
        first_name: '',
        last_name: '',
        password: '',
        role: 'RH',
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.username || !formData.email || !formData.password || !formData.first_name || !formData.last_name) {
            toast({
                title: 'Erreur',
                description: 'Veuillez remplir tous les champs',
                variant: 'destructive',
            })
            return
        }

        try {
            setSubmitting(true)
            await api.post('/recruitment/admin/users/register/', formData)

            toast({
                title: 'Succès',
                description: `Utilisateur ${formData.username} créé avec succès`,
            })

            setShowSuccess(true)
            setFormData({
                username: '',
                email: '',
                first_name: '',
                last_name: '',
                password: '',
                role: 'RH',
            })
            setRefreshKey(prev => prev + 1)

            setTimeout(() => setShowSuccess(false), 5000)
        } catch (err: any) {
            console.error('Erreur:', err)
            const errorMessage = err.response?.data?.detail || 'Erreur lors de la création de l\'utilisateur'
            toast({
                title: 'Erreur',
                description: errorMessage,
                variant: 'destructive',
            })
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-blue-50/30 dark:from-gray-950 dark:via-gray-950 dark:to-blue-950/20">
            <AdminHeader />

            <div className="flex">
                <AdminSidebar />

                <main className="flex-1 p-6 lg:p-8 ml-64">
                    {/* En-tête */}
                    <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="flex items-center gap-3 mb-2">
                            <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                            <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                                Gestion des Utilisateurs
                            </h1>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 ml-2">
                            Créez et gérez les comptes RH et Administrateur
                        </p>
                    </div>

                    {/* Message de succès */}
                    {showSuccess && (
                        <Card className="mb-6 p-4 bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-400 animate-in fade-in">
                            <p className="font-medium flex items-center gap-2">
                                <UserPlus className="w-4 h-4" />
                                Utilisateur créé avec succès !
                            </p>
                        </Card>
                    )}

                    {/* Bloc B: Formulaire de création */}
                    <Card className="mb-8 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200/50 dark:border-gray-800/50 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-800">
                                <div className="p-2.5 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-xl">
                                    <UserCog className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                                        Créer un nouvel utilisateur
                                    </h2>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Remplissez le formulaire pour créer un compte RH ou Administrateur
                                    </p>
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="first_name" className="text-gray-700 dark:text-gray-300">
                                            Prénom <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="first_name"
                                            placeholder="Jean"
                                            value={formData.first_name}
                                            onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                            disabled={submitting}
                                            className="bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 focus:ring-2 focus:ring-blue-500/20"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="last_name" className="text-gray-700 dark:text-gray-300">
                                            Nom <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="last_name"
                                            placeholder="Dupont"
                                            value={formData.last_name}
                                            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                            disabled={submitting}
                                            className="bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 focus:ring-2 focus:ring-blue-500/20"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="username" className="text-gray-700 dark:text-gray-300">
                                            Nom d'utilisateur <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="username"
                                            placeholder="jean.dupont"
                                            value={formData.username}
                                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                            disabled={submitting}
                                            className="bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 focus:ring-2 focus:ring-blue-500/20"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="email" className="text-gray-700 dark:text-gray-300">
                                            Email <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="jean.dupont@exemple.com"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            disabled={submitting}
                                            className="bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 focus:ring-2 focus:ring-blue-500/20"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="password" className="text-gray-700 dark:text-gray-300">
                                            Mot de passe <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="password"
                                            type="password"
                                            placeholder="••••••••"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            disabled={submitting}
                                            className="bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 focus:ring-2 focus:ring-blue-500/20"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="role" className="text-gray-700 dark:text-gray-300">
                                            Rôle <span className="text-red-500">*</span>
                                        </Label>
                                        <Select
                                            value={formData.role}
                                            onValueChange={(value: string) => setFormData({ ...formData, role: value as 'ADMIN' | 'RH' })}
                                        >
                                            <SelectTrigger
                                                id="role"
                                                disabled={submitting}
                                                className="bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 focus:ring-2 focus:ring-blue-500/20"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="RH" className="flex items-center gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                                        Gestionnaire RH
                                                    </div>
                                                </SelectItem>
                                                <SelectItem value="ADMIN">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                                                        Administrateur
                                                    </div>
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <Button
                                        type="reset"
                                        variant="outline"
                                        className="flex-1 bg-transparent border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                                        disabled={submitting}
                                        onClick={() => setFormData({
                                            username: '',
                                            email: '',
                                            first_name: '',
                                            last_name: '',
                                            password: '',
                                            role: 'RH',
                                        })}
                                    >
                                        Réinitialiser
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={submitting}
                                        className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0 shadow-lg shadow-blue-500/25"
                                    >
                                        {submitting ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Création...
                                            </>
                                        ) : (
                                            <>
                                                <UserPlus className="w-4 h-4 mr-2" />
                                                Créer l'utilisateur
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </Card>

                    {/* Bloc B: Liste des utilisateurs */}
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
                        <UsersTable key={refreshKey} />
                    </div>
                </main>
            </div>
        </div>
    )
}