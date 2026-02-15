export const setTokens = (access: string, refresh: string): void => {
    localStorage.setItem('access_token', access)
    localStorage.setItem('refresh_token', refresh)
}

export const getAccessToken = (): string | null => {
    return localStorage.getItem('access_token')
}

export const getRefreshToken = (): string | null => {
    return localStorage.getItem('refresh_token')
}

export const setUserRole = (role: string): void => {
    localStorage.setItem('user_role', role)
}

export const getUserRole = (): string | null => {
    return localStorage.getItem('user_role')
}

export const isAuthenticated = (): boolean => {
    const token = getAccessToken()
    return !!token
}

export const clearTokens = (): void => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user_role')
    localStorage.removeItem('user')
}

// ⭐ Fonction utilitaire pour obtenir l'objet user complet
export const getUser = (): Record<string, unknown> | null => {
    const userStr = localStorage.getItem('user')
    if (!userStr) return null

    try {
        return JSON.parse(userStr)
    } catch {
        return null
    }
}