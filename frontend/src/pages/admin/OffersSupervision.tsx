import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table.tsx'
import { Archive, Eye, Loader2, Briefcase, Calendar, User } from 'lucide-react'
import { useAdminOffers } from '../../hooks/useAdminOffers'
import { Card } from "../../../components/ui/card.tsx"
import { Button } from "../../../components/ui/button.tsx"
import { Badge } from "../../../components/ui/badge.tsx"
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

export default function OffersSupervision() {
    const { offers, loading, filters, setFilters, archiveOffer } = useAdminOffers()

    const handleArchive = (offerId: number) => {
        if (window.confirm('Êtes-vous sûr de vouloir archiver cette offre ?')) {
            archiveOffer(offerId)
        }
    }
    const navigate = useNavigate()

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="w-full space-y-6"
        >
            {/* Page Header */}
            <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-gray-900 to-gray-800 border border-purple-900/30 p-6"
            >
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-700 flex items-center justify-center shadow-lg shadow-purple-900/30">
                        <Briefcase className="w-7 h-7 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
                            Supervision des Offres
                        </h1>
                        <p className="text-gray-400 mt-1">Toutes les offres d'emploi publiées sur la plateforme</p>
                    </div>
                </div>
            </motion.div>

            {/* Filters - Boutons gris */}
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
            >
                <Card className="p-5 bg-gray-900 border-gray-800 shadow-lg">
                    <div className="flex gap-3 flex-wrap">
                        <Button
                            variant={filters.is_active === '' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setFilters({ ...filters, is_active: '' })}
                            className={filters.is_active === ''
                                ? 'bg-gray-700 text-white hover:bg-gray-600'
                                : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-white'}
                        >
                            Toutes
                        </Button>
                        <Button
                            variant={filters.is_active === 'true' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setFilters({ ...filters, is_active: 'true' })}
                            className={filters.is_active === 'true'
                                ? 'bg-gray-700 text-white hover:bg-gray-600'
                                : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-white'}
                        >
                            Actives
                        </Button>
                        <Button
                            variant={filters.is_active === 'false' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setFilters({ ...filters, is_active: 'false' })}
                            className={filters.is_active === 'false'
                                ? 'bg-gray-700 text-white hover:bg-gray-600'
                                : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-white'}
                        >
                            Archivées
                        </Button>
                    </div>
                </Card>
            </motion.div>

            {/* Offers Table */}
            {loading ? (
                <Card className="p-12 flex justify-center bg-gray-900 border-gray-800">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                </Card>
            ) : (
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    <Card className="bg-gray-900 border-gray-800 overflow-hidden shadow-xl">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-gray-800 bg-gray-800/50">
                                    <TableHead className="font-semibold text-gray-300">Titre</TableHead>
                                    <TableHead className="font-semibold text-gray-300">RH</TableHead>
                                    <TableHead className="font-semibold text-gray-300">Candidatures</TableHead>
                                    <TableHead className="font-semibold text-gray-300">Statut</TableHead>
                                    <TableHead className="font-semibold text-gray-300">Date Création</TableHead>
                                    <TableHead className="text-right font-semibold text-gray-300">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {offers.length > 0 ? (
                                    offers.map((offer, index) => (
                                        <motion.tr
                                            key={offer.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            className="border-gray-800 hover:bg-gray-800/50 transition-colors"
                                        >
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium text-white">{offer.title}</p>
                                                    <p className="text-sm text-gray-400 line-clamp-1">
                                                        {offer.description}
                                                    </p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <User className="w-3 h-3 text-gray-500" />
                                                    <span className="text-sm text-gray-300">{offer.created_by_name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="border-gray-700 bg-gray-800 text-gray-300">
                                                    {offer.applications_count} candidature{offer.applications_count > 1 ? 's' : ''}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {offer.is_active ? (
                                                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                                        Active
                                                    </Badge>
                                                ) : (
                                                    <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
                                                        Archivée
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="w-3 h-3 text-gray-500" />
                                                    <span className="text-sm text-gray-400">
                                                        {new Date(offer.created_at).toLocaleDateString('fr-FR')}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-purple-400"
                                                        title="Voir détails"
                                                        onClick={() => navigate(`/admin/offers/${offer.id}`)}
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                    {offer.is_active && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0 bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-purple-400"
                                                            onClick={() => handleArchive(offer.id)}
                                                            title="Archiver"
                                                        >
                                                            <Archive className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </motion.tr>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                                            <Briefcase className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                                            Aucune offre trouvée
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </Card>
                </motion.div>
            )}
        </motion.div>
    )
}