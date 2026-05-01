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

// Intercepteur pour ajouter le token d'authentification
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('auth_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Intercepteur pour gérer les erreurs
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response) {
            switch (error.response.status) {
                case 401:
                    // Token expiré ou invalide
                    localStorage.removeItem('auth_token');
                    window.location.href = '/login';
                    break;
                case 403:
                    console.error('Accès refusé:', error.response.data);
                    break;
                case 404:
                    console.error('Ressource non trouvée:', error.response.data);
                    break;
                case 500:
                    console.error('Erreur serveur:', error.response.data);
                    break;
            }
        } else if (error.request) {
            console.error('Erreur de connexion:', error.message);
        }
        return Promise.reject(error);
    }
);

export default api;
