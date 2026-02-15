
import { useState, useEffect } from 'react'
import {Link, useNavigate} from 'react-router-dom' // <--- CORRECTION 1
import { Button } from '../../../components/ui/button'
import { Bell, Search, Moon, Sun, LogOut } from 'lucide-react'
// 'next-themes' supprimé, on utilise un état local simple

export function AdminHeader() {
    // Gestion manuelle du thème pour Vite/React
    const [theme, setTheme] = useState<'light' | 'dark'>('light')

    // Charger le thème depuis localStorage au démarrage
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null
        if (savedTheme) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setTheme(savedTheme)
            document.documentElement.classList.toggle('dark', savedTheme === 'dark')
        }
    }, [])

    // Fonction pour basculer le thème
    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark'
        setTheme(newTheme)
        localStorage.setItem('theme', newTheme)
        document.documentElement.classList.toggle('dark', newTheme === 'dark')
    }
    const navigate = useNavigate(); // Assure-toi d'avoir importé useNavigate de react-router-dom

    const handleLogout = () => {
        // 1. Supprimer le token du localStorage (ou sessionStorage selon ton cas)
        localStorage.removeItem('token');
        localStorage.removeItem('user'); // Si tu stockes aussi les infos user

        // 2. Rediriger vers la page de login
        navigate('/');

        // 3. Optionnel : recharger la page pour vider les états globaux
        window.location.reload();
    };

    return (
        <header className="sticky top-0 z-50 w-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50">
            <div className="px-4 md:px-6 h-16 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {/* Utilisation de 'to' au lieu de 'href' */}
                    <Link to="/admin" className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-lg">A</span>
                        </div>
                        <span className="font-bold text-lg bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent hidden md:block">
                            Admin Portal
                        </span>
                    </Link>

                    <div className="hidden md:flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-1.5">
                        <Search className="w-4 h-4 text-gray-500" />
                        <input
                            type="search"
                            placeholder="Rechercher..."
                            className="bg-transparent border-0 focus:ring-0 text-sm w-64 px-2 text-gray-900 dark:text-gray-100 placeholder-gray-500"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="relative">
                        <Bell className="w-5 h-5" />
                        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleTheme} // <--- CORRECTION 2
                    >
                        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleLogout} // <--- On ajoute l'appel ici
                        title="Se déconnecter"
                    >
                        <LogOut className="w-5 h-5" />
                    </Button>
                </div>
            </div>
        </header>
    )
}
