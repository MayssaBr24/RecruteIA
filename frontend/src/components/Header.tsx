'use client'

import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button } from '../../components/ui/button'
import { Menu, X, Sparkles } from 'lucide-react'
import { useState } from 'react'

interface HeaderProps {
    showLoginButton?: boolean
}

export function Header({ showLoginButton = true }: HeaderProps) {
    const navigate = useNavigate()
    const { isAuthenticated, userRole, logout } = useAuth()
    const [isOpen, setIsOpen] = useState(false)

    return (
        <header className="sticky top-0 z-50 w-full border-b border-gradient-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20 backdrop-blur-xl bg-background/80 supports-[backdrop-filter]:bg-background/50 shadow-lg shadow-purple-500/5">
            <div className="flex items-center justify-between h-16 px-4 md:px-8 max-w-7xl mx-auto">
                {/* Logo avec animation */}
                <div
                    className="flex items-center gap-3 cursor-pointer group"
                    onClick={() => navigate('/')}
                >
                    <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 via-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/50 group-hover:shadow-xl group-hover:shadow-purple-500/60 transition-all duration-300 transform group-hover:scale-110">
                        <Sparkles className="w-5 h-5 text-white animate-pulse" />
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-600 bg-clip-text text-transparent group-hover:from-cyan-400 group-hover:via-purple-500 group-hover:to-pink-500 transition-all duration-300 whitespace-nowrap">
                            RecrutAI
                        </h1>
                        <span className="text-xs text-purple-400 font-medium">Intelligent Recruitment</span>
                    </div>
                </div>

                {/* Navigation Desktop */}
                <div className="hidden md:flex items-center gap-2">
                    {isAuthenticated ? (
                        <>
                            {userRole === 'RH' && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => navigate('/rh')}
                                    className="text-foreground/70 hover:text-foreground hover:bg-purple-500/10 transition-all duration-200 relative group"
                                >
                                    Espace RH
                                    <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-cyan-500 to-purple-600 group-hover:w-full transition-all duration-300" />
                                </Button>
                            )}
                            {userRole === 'ADMIN' && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => navigate('/admin')}
                                    className="text-foreground/70 hover:text-foreground hover:bg-purple-500/10 transition-all duration-200 relative group"
                                >
                                    Espace Admin
                                    <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-cyan-500 to-purple-600 group-hover:w-full transition-all duration-300" />
                                </Button>
                            )}
                            <div className="w-px h-6 bg-gradient-to-b from-transparent via-purple-500/50 to-transparent mx-2" />
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    logout()
                                    navigate('/login', { replace: true })
                                }}
                                className="border-purple-500/30 text-foreground hover:bg-destructive/10 hover:border-destructive/50 transition-all duration-200"
                            >
                                Déconnexion
                            </Button>
                        </>
                    ) : showLoginButton ? (
                        <Button
                            size="sm"
                            onClick={() => navigate('/login')}
                            className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white border-0 font-semibold shadow-lg shadow-purple-500/40 hover:shadow-xl hover:shadow-purple-500/60 transition-all duration-300 transform hover:scale-105"
                        >
                            Connexion
                        </Button>
                    ) : null}
                </div>

                {/* Menu Mobile */}
                <div className="md:hidden flex items-center gap-2">
                    {showLoginButton && !isAuthenticated && (
                        <Button
                            size="sm"
                            onClick={() => navigate('/login')}
                            className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white border-0 text-xs"
                        >
                            Connexion
                        </Button>
                    )}
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="p-2 hover:bg-purple-500/10 rounded-lg transition-colors"
                    >
                        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            {isOpen && (
                <div className="md:hidden border-t border-purple-500/20 bg-background/95 backdrop-blur-xl animate-in slide-in-from-top-2 duration-300">
                    <div className="px-4 py-3 space-y-2">
                        {isAuthenticated ? (
                            <>
                                {userRole === 'RH' && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            navigate('/rh')
                                            setIsOpen(false)
                                        }}
                                        className="w-full justify-start text-foreground/70 hover:text-foreground hover:bg-purple-500/10"
                                    >
                                        Espace RH
                                    </Button>
                                )}
                                {userRole === 'ADMIN' && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            navigate('/admin')
                                            setIsOpen(false)
                                        }}
                                        className="w-full justify-start text-foreground/70 hover:text-foreground hover:bg-purple-500/10"
                                    >
                                        Espace Admin
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        logout()
                                        navigate('/login', { replace: true })
                                        setIsOpen(false)
                                    }}
                                    className="w-full justify-start border-purple-500/30"
                                >
                                    Déconnexion
                                </Button>
                            </>
                        ) : null}
                    </div>
                </div>
            )}
        </header>
    )
}
