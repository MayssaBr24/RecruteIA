import React from 'react'
import { Navigate } from 'react-router-dom'
import { getAccessToken, getUserRole } from '../lib/auth'

interface ProtectedRouteProps {
    children: React.ReactNode
    requiredRole?: string | string[]  // ← accepte string ou tableau
}

// ProtectedRoute.tsx
export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
    const isAuth = !!getAccessToken()
    const userRole = getUserRole()

    console.log('🔒 ProtectedRoute:', {
        path: window.location.pathname,
        isAuth,
        userRole,
        requiredRole
    })

    if (!isAuth) {
        console.log('❌ → /login')
        return <Navigate to="/login" replace />
    }

    if (requiredRole) {
        const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
        if (!allowedRoles.includes(userRole ?? '')) {
            console.log('❌ Rôle refusé → /', { userRole, allowedRoles })
            return <Navigate to="/" replace />
        }
    }

    return <>{children}</>
}