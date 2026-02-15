'use client'

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Header } from '../components/Header'
import { Loader2, AlertCircle } from 'lucide-react'
import api from '../lib/api'
import { setTokens, setUserRole } from '../lib/auth'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../hooks/use-toast'

interface LoginFormData {
    username: string
    password: string
}

// ⭐ Interface pour la réponse de l'API
interface LoginResponse {
    access: string
    refresh: string
    user: {
        id: number
        username: string
        email: string
        first_name: string
        last_name: string
        role: string
        groups: string[]
    }
}

// ⭐ Type pour les erreurs axios
interface ApiError {
    response?: {
        data?: {
            detail?: string
        }
        status?: number
    }
    message?: string
}

export function LoginPage() {
    const navigate = useNavigate()
    const { setUserRole: updateUserRole } = useAuth()
    const { toast } = useToast()

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [formData, setFormData] = useState<LoginFormData>({
        username: '',
        password: '',
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setLoading(true)

        try {
            console.log('🔄 Tentative de connexion pour:', formData.username)

            // ⭐ Typer la réponse correctement
            const response = await api.post<LoginResponse>('/token/', {
                username: formData.username,
                password: formData.password,
            })

            console.log('✅ Réponse reçue:', response.data)

            const { access, refresh, user } = response.data

            // ⭐ Vérifier que l'objet user existe
            if (!user || !user.role) {
                console.error('❌ Erreur: Pas de données utilisateur dans la réponse')
                throw new Error('Réponse du serveur incomplète. Contactez l\'administrateur.')
            }

            console.log('👤 Utilisateur:', user)
            console.log('🔑 Rôle détecté:', user.role)

            // Stocker les tokens
            setTokens(access, refresh)

            // Stocker le rôle
            setUserRole(user.role)
            updateUserRole(user.role)

            // Stocker les infos utilisateur complètes (optionnel)
            localStorage.setItem('user', JSON.stringify(user))

            toast({
                title: 'Connexion réussie',
                description: `Bienvenue ${user.first_name || user.username}`,
            })

            // ⭐ Redirection basée sur le rôle depuis l'API
            console.log('🔀 Redirection selon le rôle:', user.role)

            switch (user.role) {
                case 'RH':
                    navigate('/rh', { replace: true })
                    break
                case 'ADMIN':
                    navigate('/admin', { replace: true })
                    break
                default:
                    navigate('/', { replace: true })
            }
        } catch (err) {
            // ⭐ Typage correct de l'erreur
            const apiError = err as ApiError
            console.error('❌ Erreur de connexion:', apiError)

            let errorMessage = 'Identifiants invalides'

            if (apiError.response?.data?.detail) {
                errorMessage = apiError.response.data.detail
            } else if (apiError.message?.includes('Network Error')) {
                errorMessage = 'Impossible de se connecter au serveur. Vérifiez que le backend est lancé.'
            } else if (apiError.message) {
                errorMessage = apiError.message
            }

            setError(errorMessage)
            toast({
                title: 'Erreur de connexion',
                description: errorMessage,
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
            <Header showLoginButton={false} />

            <main className="flex-1 flex items-center justify-center px-4 py-12 min-h-[calc(100vh-64px)]">
                <Card className="w-full max-w-md bg-gradient-to-br from-card to-card/50 border-border/60 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="space-y-6">
                        {/* Header */}
                        <div className="text-center space-y-2">
                            <div className="flex justify-center mb-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                                    <span className="text-white font-bold text-xl">HR</span>
                                </div>
                            </div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                RecrutAI
                            </h1>
                            <p className="text-muted-foreground">Connectez-vous à votre compte</p>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="flex gap-3 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
                                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <p>{error}</p>
                            </div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="username">Nom d'utilisateur</Label>
                                <Input
                                    id="username"
                                    placeholder="rh_test"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    disabled={loading}
                                    required
                                    className="bg-background/50"
                                    autoComplete="username"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password">Mot de passe</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    disabled={loading}
                                    required
                                    className="bg-background/50"
                                    autoComplete="current-password"
                                />
                            </div>

                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 mt-6"
                                size="lg"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Connexion en cours...
                                    </>
                                ) : (
                                    'Se connecter'
                                )}
                            </Button>
                        </form>

                        {/* Footer */}
                        <div className="pt-4 space-y-2 text-center text-sm border-t border-border/40">
                            <p className="text-muted-foreground">
                                Comptes de test disponibles :
                            </p>
                            <div className="flex flex-col gap-1 text-xs">
                                <p className="font-mono bg-muted/50 px-2 py-1 rounded">
                                    👔 <strong>RH:</strong> rh_test / test123456
                                </p>
                                <p className="font-mono bg-muted/50 px-2 py-1 rounded">
                                    👑 <strong>Admin:</strong> admin / admin123456
                                </p>
                            </div>
                        </div>
                    </div>
                </Card>
            </main>
        </div>
    )
}