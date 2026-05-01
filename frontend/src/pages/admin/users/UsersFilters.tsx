import { Search, X } from 'lucide-react'
import { Card } from "../../../../components/ui/card"
import { Input } from "../../../../components/ui/input"
import { Button } from "../../../../components/ui/button"
import { motion } from 'framer-motion'

interface UsersFiltersProps {
    filters: {
        role: string
        is_active: string
        search: string
    }
    onFilterChange: (filters: any) => void
}

export function UsersFilters({ filters, onFilterChange }: UsersFiltersProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            <Card className="p-5 bg-gray-900 border-gray-800 shadow-lg">
                <div className="flex flex-wrap gap-4 items-center">
                    {/* Search */}
                    <div className="flex-1 min-w-[250px]">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <Input
                                placeholder="Rechercher par nom, email..."
                                value={filters.search}
                                onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
                                className="pl-10 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                            />
                        </div>
                    </div>

                    {/* Role Filter */}
                    <div className="flex gap-2">
                        <Button
                            variant={filters.role === '' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => onFilterChange({ ...filters, role: '' })}
                            className={filters.role === ''
                                ? 'bg-gray-700 text-white hover:bg-gray-600'
                                : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-white'}
                        >
                            Tous
                        </Button>
                        <Button
                            variant={filters.role === 'ADMIN' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => onFilterChange({ ...filters, role: 'ADMIN' })}
                            className={filters.role === 'ADMIN'
                                ? 'bg-gray-700 text-white hover:bg-gray-600'
                                : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-white'}
                        >
                            Admins
                        </Button>
                        <Button
                            variant={filters.role === 'RH' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => onFilterChange({ ...filters, role: 'RH' })}
                            className={filters.role === 'RH'
                                ? 'bg-gray-700 text-white hover:bg-gray-600'
                                : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-white'}
                        >
                            RH
                        </Button>
                    </div>

                    {/* Active Filter */}
                    <div className="flex gap-2">
                        <Button
                            variant={filters.is_active === '' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => onFilterChange({ ...filters, is_active: '' })}
                            className={filters.is_active === ''
                                ? 'bg-gray-700 text-white hover:bg-gray-600'
                                : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-white'}
                        >
                            Tous
                        </Button>
                        <Button
                            variant={filters.is_active === 'true' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => onFilterChange({ ...filters, is_active: 'true' })}
                            className={filters.is_active === 'true'
                                ? 'bg-gray-700 text-white hover:bg-gray-600'
                                : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-white'}
                        >
                            Actifs
                        </Button>
                        <Button
                            variant={filters.is_active === 'false' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => onFilterChange({ ...filters, is_active: 'false' })}
                            className={filters.is_active === 'false'
                                ? 'bg-gray-700 text-white hover:bg-gray-600'
                                : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-white'}
                        >
                            Inactifs
                        </Button>
                    </div>

                    {/* Reset */}
                    {(filters.role || filters.is_active || filters.search) && (
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                        >
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onFilterChange({ role: '', is_active: '', search: '' })}
                                className="text-gray-400 hover:text-white hover:bg-gray-800"
                            >
                                <X className="w-4 h-4 mr-2" />
                                Réinitialiser
                            </Button>
                        </motion.div>
                    )}
                </div>
            </Card>
        </motion.div>
    )
}