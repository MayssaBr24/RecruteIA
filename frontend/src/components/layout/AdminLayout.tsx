import {AdminSidebar} from "../../pages/admin/AdminSidebar.tsx";
import {AnimatePresence} from "framer-motion";
import {Outlet} from "react-router-dom";
import { Header } from '../../components/Header'

// Dans AdminLayout.tsx
export function AdminLayout() {
    return (
        <div className="flex flex-col h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black">
            <Header showLoginButton={false} />

            <div className="flex flex-1 overflow-hidden">
                {/* La sidebar n'est plus fixe, elle prend sa place naturellement */}
                <AdminSidebar />

                {/* Le main prend tout l'espace restant */}
                <main className="flex-1 overflow-y-auto p-6">
                    {/* Retirez max-w-7xl et mx-auto pour utiliser tout l'espace disponible */}
                    <div className="w-full">
                        <AnimatePresence mode="wait">
                            <Outlet />
                        </AnimatePresence>
                    </div>
                </main>
            </div>
        </div>
    )
}