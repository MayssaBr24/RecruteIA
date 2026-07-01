import axios from 'axios'
import {ReportData} from "../types/types.ts";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL + '/api/recruitment'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
})

// Intercepteur pour ajouter automatiquement le token JWT
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Intercepteur pour gérer les erreurs 401 (token expiré)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const refreshToken = localStorage.getItem('refresh_token')
        if (!refreshToken) {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          window.location.href = '/login'
          return Promise.reject(error)
        }

        const response = await axios.post(import.meta.env.VITE_API_BASE_URL + '/api/token/refresh/', {
          refresh: refreshToken,
        })

        const { access: newAccessToken } = response.data
        localStorage.setItem('access_token', newAccessToken)

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
        return api(originalRequest)
      } catch (refreshError) {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)
/**
 * Fetches the full interview report for the given token.
 * Reads the JWT access token from localStorage.
 * Throws an Error with an HTTP status message on failure.
 */
export async function fetchReport(token: string): Promise<ReportData> {
    const url = `${import.meta.env.VITE_API_BASE_URL}/api/recruitment/ai-interview/${token}/report/`

    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token') ?? ''}`,
            'ngrok-skip-browser-warning': 'true',
        },
    })

    if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`HTTP ${res.status}: ${errorText}`)
    }

    return res.json() as Promise<ReportData>
}
export default api
