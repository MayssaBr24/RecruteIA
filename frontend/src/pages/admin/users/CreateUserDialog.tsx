import React, { useState } from 'react'
import { Button } from "../../../../components/ui/button"
import { Input } from "../../../../components/ui/input"
import { Label } from "../../../../components/ui/label"
import { Loader2, X, UserPlus, Mail, Lock, User, Shield, Sparkles } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "../../../../components/ui/dialog"
import api from '../../../lib/api'
import { useToast } from '../../../hooks/use-toast'
import { motion, AnimatePresence } from 'framer-motion'

interface CreateUserDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onUserCreated?: () => void
}

export function CreateUserDialog({ open, onOpenChange, onUserCreated }: CreateUserDialogProps) {
    const { toast } = useToast()
    const [submitting, setSubmitting] = useState(false)
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        role: 'RH',
        phone: ''
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.username || !formData.email || !formData.password || !formData.role) {
            toast({
                title: 'Erreur',
                description: 'Veuillez remplir tous les champs obligatoires',
                variant: 'destructive',
            })
            return
        }

        try {
            setSubmitting(true)
            await api.post('/admin/users/create/', formData)

            toast({
                title: 'Succès',
                description: 'Utilisateur créé avec succès',
            })

            setFormData({
                username: '',
                email: '',
                password: '',
                first_name: '',
                last_name: '',
                role: 'RH',
                phone: ''
            })

            onOpenChange(false)
            onUserCreated?.()

        } catch (error: any) {
            console.error('Erreur:', error)
            toast({
                title: 'Erreur',
                description: error.response?.data?.detail || 'Impossible de créer l\'utilisateur',
                variant: 'destructive',
            })
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-gradient-to-br from-gray-900 to-gray-950 border-gray-800 max-w-2xl p-0 overflow-hidden shadow-2xl shadow-blue-500/20">
                <AnimatePresence>
                    {open && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                        >
                            {/* Gradient Header - Blue/Violet */}
                            <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 p-8">
                                <div
                                    className="absolute inset-0 opacity-20"
                                    style={{
                                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                                        backgroundRepeat: 'repeat'
                                    }}
                                />
                                <div className="relative z-10">
                                    <DialogHeader className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <motion.div
                                                    animate={{ rotate: 360 }}
                                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                                    className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30"
                                                >
                                                    <UserPlus className="w-6 h-6 text-white" />
                                                </motion.div>
                                                <div>
                                                    <DialogTitle className="text-2xl font-bold text-white">
                                                        Créer un Utilisateur
                                                    </DialogTitle>
                                                    <DialogDescription className="text-white/90">
                                                        Ajouter un nouveau compte Admin ou RH
                                                    </DialogDescription>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => onOpenChange(false)}
                                                className="rounded-full p-2 hover:bg-white/20 transition-colors"
                                            >
                                                <X className="h-5 w-5 text-white" />
                                            </button>
                                        </div>
                                    </DialogHeader>
                                </div>
                            </div>

                            {/* Form Content */}
                            <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                                {/* Role Selection */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                            <Shield className="w-4 h-4 text-blue-400" />
                                        </div>
                                        <Label className="text-base font-semibold text-white">
                                            Rôle
                                        </Label>
                                    </div>

                                    <div className="h-12 px-4 bg-gray-800/50 border border-gray-700 rounded-lg flex items-center text-white">
                                        RH - Recruteur
                                    </div>

                                    <p className="text-xs text-gray-400">
                                        Les RH peuvent gérer les offres d'emploi, les candidatures et le suivi du recrutement.
                                    </p>
                                </div>

                                {/* Username & Email */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                                <User className="w-4 h-4 text-blue-400" />
                                            </div>
                                            <Label className="text-base font-semibold text-white">
                                                Nom d'utilisateur *
                                            </Label>
                                        </div>
                                        <Input
                                            value={formData.username}
                                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                            required
                                            className="h-12 bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg"
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                                                <Mail className="w-4 h-4 text-indigo-400" />
                                            </div>
                                            <Label className="text-base font-semibold text-white">
                                                Email *
                                            </Label>
                                        </div>
                                        <Input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            required
                                            className="h-12 bg-gray-800/50 border-gray-700 text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-lg"
                                        />
                                    </div>
                                </div>

                                {/* First Name & Last Name */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <Label className="text-base font-semibold text-white">
                                            Prénom
                                        </Label>
                                        <Input
                                            value={formData.first_name}
                                            onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                            className="h-12 bg-gray-800/50 border-gray-700 text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 rounded-lg"
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="text-base font-semibold text-white">
                                            Nom
                                        </Label>
                                        <Input
                                            value={formData.last_name}
                                            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                            className="h-12 bg-gray-800/50 border-gray-700 text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 rounded-lg"
                                        />
                                    </div>
                                </div>

                                {/* Password & Phone */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                                <Lock className="w-4 h-4 text-purple-400" />
                                            </div>
                                            <Label className="text-base font-semibold text-white">
                                                Mot de passe *
                                            </Label>
                                        </div>
                                        <Input
                                            type="password"
                                            placeholder="••••••••"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            required
                                            className="h-12 bg-gray-800/50 border-gray-700 text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 rounded-lg"
                                        />
                                        <p className="text-xs text-gray-400">
                                            Minimum 8 caractères recommandé
                                        </p>
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="text-base font-semibold text-white">
                                            Téléphone
                                        </Label>
                                        <Input
                                            type="tel"
                                            placeholder="+216 12 345 678"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            className="h-12 bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg"
                                        />
                                    </div>
                                </div>

                                {/* Summary Card - Blue/Violet */}
                                <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 p-4 rounded-lg border border-blue-500/30">
                                    <div className="flex gap-3">
                                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                                            <Sparkles className="w-3 h-3 text-blue-400" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-blue-300">
                                                Récapitulatif
                                            </p>
                                            <p className="text-xs text-blue-400/80 mt-1">
                                                {formData.role === 'RH' ?
                                                    'Ce compte aura accès au module de recrutement (offres, candidatures, entretiens)' :
                                                    'Ce compte aura un accès administrateur complet à toute la plateforme'
                                                }
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-4 pt-6 border-t border-gray-800">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => onOpenChange(false)}
                                        className="flex-1 h-12 border-gray-700 text-gray-300 hover:bg-gray-800 rounded-lg font-medium"
                                    >
                                        Annuler
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={submitting}
                                        className="flex-1 h-12 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-blue-500/20 rounded-lg font-semibold"
                                    >
                                        {submitting ? (
                                            <>
                                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                                Création...
                                            </>
                                        ) : (
                                            <>
                                                <UserPlus className="w-5 h-5 mr-2" />
                                                Créer l'utilisateur
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>
            </DialogContent>
        </Dialog>
    )
}