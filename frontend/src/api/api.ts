import axios from 'axios';

// Configuration de l'API
const API_BASE_URL ='http://localhost:8888/api/recruitment';

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token')  // ✅ 'access_token' pas 'auth_token'
        if (token) {
            config.headers.Authorization = `Bearer ${token}`
        }
        return config
    },
    (error) => Promise.reject(error)
)

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('access_token')
            localStorage.removeItem('refresh_token')
            localStorage.removeItem('user_role')
            localStorage.removeItem('user')
            window.location.href = '/login'  // ← garder ici, c'est voulu pour 401
        }
        return Promise.reject(error)
    }
)

export default api;
