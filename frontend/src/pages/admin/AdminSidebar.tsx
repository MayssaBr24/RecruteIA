import { Link, useLocation } from 'react-router-dom'
import {
    LayoutDashboard,
    Users,
    Briefcase,
    FileText,
    LogOut,
    ChevronRight,
    Activity,
    Menu,
    X, UserCheck
} from 'lucide-react'
import { cn } from "../../../lib/utils"
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'

const menuItems = [
    {
        title: 'Dashboard',
        icon: LayoutDashboard,
        path: '/admin',
    },
    {
        title: 'Utilisateurs',
        icon: Users,
        path: '/admin/users',
    },
    {
        title: 'Offres d\'Emploi',
        icon: Briefcase,
        path: '/admin/offers',
    },
    {
        title: 'Candidatures',
        icon: FileText,
        path: '/admin/applications',
    },
    {   title: 'Employés',
        icon: UserCheck,
        path: '/admin/employees',

    },

]

export function AdminSidebar() {
    const location = useLocation()
    const [isHovered, setIsHovered] = useState<string | null>(null)
    const [isMobileOpen, setIsMobileOpen] = useState(false)
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768)
            if (window.innerWidth >= 768) {
                setIsMobileOpen(false)
            }
        }
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    const sidebarVariants = {
        hidden: { x: -100, opacity: 0 },
        visible: {
            x: 0,
            opacity: 1,
            transition: {
                type: "spring",
                stiffness: 100,
                damping: 20,
                staggerChildren: 0.05
            }
        }
    }


    const itemVariants = {
        hidden: { x: -20, opacity: 0 },
        visible: { x: 0, opacity: 1 }
    }

    const SidebarContent = () => (
        <>
            {/* Navigation Menu */}
            <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
                {menuItems.map((item, index) => {
                    const Icon = item.icon
                    const isActive = location.pathname === item.path
                    const isItemHovered = isHovered === item.path

                    return (
                        <motion.div
                            key={item.path}
                            variants={itemVariants}
                            custom={index}
                            onMouseEnter={() => setIsHovered(item.path)}
                            onMouseLeave={() => setIsHovered(null)}
                        >
                            <Link
                                to={item.path}
                                onClick={() => isMobile && setIsMobileOpen(false)}
                                className={cn(
                                    "relative flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group overflow-hidden",
                                    isActive
                                        ? "bg-gradient-to-r from-purple-600/20 to-indigo-600/20 text-purple-400 border border-purple-500/30"
                                        : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                                )}
                            >
                                {/* Animation de fond au survol */}
                                {!isActive && (
                                    <motion.div
                                        className="absolute inset-0 bg-gradient-to-r from-purple-600/0 via-purple-600/10 to-purple-600/0"
                                        initial={{ x: "-100%" }}
                                        animate={{ x: isItemHovered ? "100%" : "-100%" }}
                                        transition={{ duration: 0.5 }}
                                    />
                                )}

                                {/* Active indicator */}
                                {isActive && (
                                    <motion.div
                                        layoutId="activeIndicator"
                                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-purple-500 to-indigo-500 rounded-r-full shadow-lg shadow-purple-500/50"
                                        initial={{ scaleY: 0 }}
                                        animate={{ scaleY: 1 }}
                                        transition={{ duration: 0.3 }}
                                    />
                                )}

                                {/* Icon avec animation */}
                                <motion.div
                                    whileHover={{ scale: 1.1, rotate: 5 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="relative z-10"
                                >
                                    <Icon className={cn(
                                        "w-5 h-5 transition-all duration-300",
                                        isActive && "text-purple-400 drop-shadow-[0_0_5px_rgba(168,85,247,0.5)]"
                                    )} />
                                </motion.div>

                                {/* Label */}
                                <span className={cn(
                                    "font-medium text-sm relative z-10",
                                    isActive && "text-purple-400"
                                )}>{item.title}</span>

                                {/* Chevron pour l'élément actif */}
                                {isActive && (
                                    <motion.div
                                        initial={{ x: -10, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        className="ml-auto relative z-10"
                                    >
                                        <ChevronRight className="w-4 h-4 text-purple-400" />
                                    </motion.div>
                                )}

                                {/* Effet de brillance au survol */}
                                {isItemHovered && !isActive && (
                                    <motion.div
                                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                                        initial={{ x: "-100%" }}
                                        animate={{ x: "100%" }}
                                        transition={{ duration: 0.6 }}
                                    />
                                )}
                            </Link>
                        </motion.div>
                    )
                })}
            </nav>

            {/* Quick Stats Section - Sticky to bottom */}
            <motion.div
                variants={itemVariants}
                className="p-4 border-t border-gray-800 mt-auto"
            >
                <div className="space-y-4">


                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 gap-2">
                        <motion.div
                            whileHover={{ scale: 1.05, y: -2 }}
                            className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-3 text-center border border-gray-700 hover:border-purple-500/50 transition-all duration-300"
                        >
                            <p className="text-xl md:text-2xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">24</p>
                            <p className="text-xs text-gray-400">Utilisateurs</p>
                        </motion.div>
                        <motion.div
                            whileHover={{ scale: 1.05, y: -2 }}
                            className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-3 text-center border border-gray-700 hover:border-purple-500/50 transition-all duration-300"
                        >
                            <p className="text-xl md:text-2xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">12</p>
                            <p className="text-xs text-gray-400">Offres actives</p>
                        </motion.div>
                    </div>

                    {/* Session Info */}
                    <div className="bg-gradient-to-r from-gray-800/50 to-gray-900/50 rounded-lg p-3 border border-gray-700 backdrop-blur-sm">
                        <div className="flex items-center gap-2 text-gray-400 text-xs">
                            <Activity className="w-3 h-3 text-purple-400" />
                            <span>Session active</span>
                            <span className="ml-auto text-purple-400 font-medium">Admin</span>
                        </div>
                    </div>

                    {/* Logout Button */}
                    <motion.button
                        whileHover={{ scale: 1.02, x: 5 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:text-white hover:bg-gradient-to-r hover:from-red-600/20 hover:to-red-600/10 transition-all duration-200 group border border-transparent hover:border-red-500/30"
                    >
                        <LogOut className="w-5 h-5 group-hover:rotate-180 transition-transform duration-300 group-hover:text-red-400" />
                        <span className="font-medium text-sm group-hover:text-red-400">Déconnexion</span>
                    </motion.button>
                </div>
            </motion.div>

            {/* Version Info */}
            <motion.div
                variants={itemVariants}
                className="p-4 text-center border-t border-gray-800 bg-gray-900/50"
            >
                <p className="text-xs text-gray-500">Version 2.0.0</p>
                <p className="text-xs text-gray-600 mt-1">© 2024 RH Platform</p>
            </motion.div>
        </>
    )

    return (
        <>
            {/* Mobile Menu Button */}
            {isMobile && (
                <motion.button
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => setIsMobileOpen(!isMobileOpen)}
                    className="fixed left-4 top-20 z-50 p-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 shadow-lg md:hidden"
                >
                    {isMobileOpen ? (
                        <X className="w-5 h-5 text-white" />
                    ) : (
                        <Menu className="w-5 h-5 text-white" />
                    )}
                </motion.button>
            )}

            {/* Overlay for mobile */}
            <AnimatePresence>
                {isMobile && isMobileOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsMobileOpen(false)}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar */}
            <AnimatePresence>
                {(!isMobile || isMobileOpen) && (
                    // Dans AdminSidebar.tsx, modifiez le bloc <motion.aside>
                    <motion.aside
                        initial="visible"
                        animate="visible"
                        variants={sidebarVariants}
                        className={cn(
                            "h-full bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 border-r border-gray-800 shadow-2xl flex flex-col z-50",
                            isMobile ? "fixed w-72" : "w-64" // Fixed seulement sur mobile
                        )}
                    >
                        <SidebarContent />
                    </motion.aside>
                )}
            </AnimatePresence>

            {/* Desktop version always visible */}
            {!isMobile && (
                <motion.aside
                    initial="hidden"
                    animate="visible"
                    variants={sidebarVariants}
                    className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 border-r border-gray-800 shadow-2xl flex flex-col"
                >
                    <SidebarContent />
                </motion.aside>
            )}
        </>
    )
}