

import React, { createContext, useContext, useState } from 'react'
import { isAuthenticated, getUserRole, clearTokens } from '../lib/auth'
interface AuthContextType {
    isAuthenticated: boolean
    userRole: string | null
    logout: () => void
    setUserRole: (role: string) => void
    updateUserRole: (role: string) => void  // ← AJOUTER

}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    // ⭐ Initialiser directement avec les valeurs depuis localStorage
    const [isAuth, setIsAuth] = useState(() => isAuthenticated())
    const [userRole, setRole] = useState<string | null>(() => getUserRole())

    const logout = () => {
        clearTokens()
        setIsAuth(false)
        setRole(null)
        window.location.href = '/'
    }

    const updateUserRole = (role: string) => {
        localStorage.setItem('user_role', role)
        setRole(role)
        setIsAuth(true) // ⭐ Mettre à jour isAuth aussi
    }

    return (
        <AuthContext.Provider
            value={{
                isAuthenticated: isAuth,
                userRole,
                logout,
                setUserRole: updateUserRole,
                updateUserRole  // ← AJOUTER

            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

// ⭐ Export nommé du hook (évite l'erreur react-refresh)
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within AuthProvider')
    }
    return context
}