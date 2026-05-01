import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table.tsx'
import { Download, Eye, Loader2, FileText, User, Mail, Phone, Briefcase, X, Filter, ChevronDown, Check } from 'lucide-react'
import { useAdminApplications } from '../../hooks/useAdminApplications'
import { Card } from "../../../components/ui/card.tsx"
import { Button } from "../../../components/ui/button.tsx"
import { Badge } from "../../../components/ui/badge.tsx"
import { Input } from "../../../components/ui/input.tsx"
import { motion, AnimatePresence } from 'framer-motion'
import { useMemo, useState, useEffect } from 'react'
import { cn } from '../../../lib/utils'

export default function ApplicationsSupervision() {
    const { applications, loading, filters, setFilters } = useAdminApplications()
    const [offerFilterOpen, setOfferFilterOpen] = useState(false)
    const [searchOffer, setSearchOffer] = useState('')

    // ✅ État local pour la sélection dans le menu (ne s'applique qu'au clic sur "Appliquer")
    const [localOfferIds, setLocalOfferIds] = useState<string[]>([])

    // Synchroniser l'état local avec les filtres actuels quand le menu s'ouvre
    useEffect(() => {
        if (offerFilterOpen) {
            setLocalOfferIds(filters.offer_ids || [])
        }
    }, [offerFilterOpen, filters.offer_ids])

    // Extraire les offres uniques
    const uniqueOffers = useMemo(() => {
        if (!applications) return [];
        const offersMap = new Map();
        applications.forEach(app => {
            if (app.job_offer && !offersMap.has(app.job_offer.toString())) {
                offersMap.set(app.job_offer.toString(), {
                    id: app.job_offer.toString(),
                    title: app.job_title
                })
            }
        })
        return Array.from(offersMap.values())
    }, [applications])

    // Filtrer les offres par recherche
    const filteredOffers = useMemo(() => {
        if (!searchOffer) return uniqueOffers
        return uniqueOffers.filter(offer =>
            offer.title.toLowerCase().includes(searchOffer.toLowerCase())
        )
    }, [uniqueOffers, searchOffer])

    // ✅ Basculer la sélection dans l'état LOCAL (sans fermer le menu)
    const toggleOfferLocal = (e: React.MouseEvent, offerId: string) => {
        e.stopPropagation()

        setLocalOfferIds(prev =>
            prev.includes(offerId)
                ? prev.filter(id => id !== offerId)
                : [...prev, offerId]
        )
    }

    // ✅ Appliquer les filtres au parent et fermer le menu
    const applyFilters = () => {
        setFilters({ ...filters, offer_ids: localOfferIds })
        setOfferFilterOpen(false)
    }

    // ✅ Tout désélectionner (localement)
    const clearAllLocalOffers = () => {
        setLocalOfferIds([])
        setSearchOffer('')
    }

    // ✅ Annuler (fermer sans appliquer)
    const cancelFilters = () => {
        setLocalOfferIds(filters.offer_ids || [])
        setOfferFilterOpen(false)
        setSearchOffer('')
    }

    const getStatusBadge = (status: string) => (
        <Badge
            variant="secondary"
            className={cn(
                "text-xs font-medium px-3 py-1",
                status === 'pending' && "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
                status === 'reviewed' && "bg-blue-500/20 text-blue-400 border-blue-500/30",
                status === 'accepted' && "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
                status === 'rejected' && "bg-red-500/20 text-red-400 border-red-500/30"
            )}
        >
            {status === 'pending' ? 'En attente' :
                status === 'reviewed' ? 'Examinée' :
                    status === 'accepted' ? 'Acceptée' :
                        status === 'rejected' ? 'Refusée' : status}
        </Badge>
    )

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="w-full space-y-6 p-4 md:p-0"
        >
            {/* Header */}
            <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="bg-gradient-to-r from-gray-900 to-slate-900 border border-gray-800/50 rounded-2xl p-8 shadow-2xl"
            >
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl">
                        <FileText className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-white">Supervision des Candidatures</h1>
                        <p className="text-gray-400 mt-1">Sélectionnez vos offres pour filtrer</p>
                    </div>
                </div>
            </motion.div>

            {/* ✅ FILTRE OFFRES - SÉLECTION MULTIPLE AVEC ÉTAT LOCAL */}
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
            >
                <Card className="bg-gray-900 border-gray-800 shadow-xl p-1">
                    <div className="p-6 space-y-4">
                        {/* Bouton principal du filtre */}
                        <Button
                            variant="outline"
                            className="h-14 w-full justify-between text-left font-semibold text-white border-gray-700 hover:bg-gray-800/50 bg-gray-800/30"
                            onClick={() => setOfferFilterOpen(!offerFilterOpen)}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center">
                                    <Filter className="w-5 h-5 text-white" />
                                </div>
                                <span>
                                    {filters.offer_ids?.length === 0
                                        ? 'Sélectionner des offres (0)'
                                        : `✅ ${filters.offer_ids.length} offre${filters.offer_ids.length > 1 ? 's' : ''} sélectionnée${filters.offer_ids.length > 1 ? 's' : ''}`
                                    }
                                </span>
                            </div>
                            <ChevronDown className={cn("w-5 h-5 text-white transition-transform duration-200", offerFilterOpen && "rotate-180")} />
                        </Button>

                        {/* ✅ LISTE DES OFFRES - SÉLECTION MULTIPLE AVEC ÉTAT LOCAL */}
                        <AnimatePresence>
                            {offerFilterOpen && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="space-y-3 overflow-hidden pt-4 border-t border-gray-800"
                                >
                                    {/* Recherche */}
                                    <Input
                                        placeholder="🔍 Rechercher une offre..."
                                        value={searchOffer}
                                        onChange={(e) => setSearchOffer(e.target.value)}
                                        className="h-12 bg-gray-800 border-gray-700 text-white placeholder-gray-400 focus:border-purple-500 focus:ring-purple-500"
                                    />

                                    {/* Aperçu des offres sélectionnées localement */}
                                    {localOfferIds.length > 0 && (
                                        <div className="flex flex-wrap gap-2 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                                            <span className="text-sm text-purple-400">Sélection locale :</span>
                                            {localOfferIds.map(id => {
                                                const offer = uniqueOffers.find(o => o.id === id)
                                                return offer ? (
                                                    <Badge key={id} className="bg-purple-600 text-white gap-1">
                                                        {offer.title}
                                                        <X
                                                            className="w-3 h-3 cursor-pointer hover:text-red-300"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                setLocalOfferIds(prev => prev.filter(i => i !== id))
                                                            }}
                                                        />
                                                    </Badge>
                                                ) : null
                                            })}
                                        </div>
                                    )}

                                    {/* Liste scrollable des offres */}
                                    <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
                                        {filteredOffers.length > 0 ? (
                                            filteredOffers.map((offer) => {
                                                const isSelected = localOfferIds.includes(offer.id)
                                                return (
                                                    <Button
                                                        key={offer.id}
                                                        variant="ghost"
                                                        className={cn(
                                                            "h-14 w-full justify-start text-left px-4 py-3 rounded-xl border-2 transition-all duration-200",
                                                            isSelected
                                                                ? "bg-gradient-to-r from-purple-600 to-indigo-600 border-purple-500 shadow-purple-500/25 text-white"
                                                                : "bg-gray-800 border-gray-700 text-white hover:bg-gray-700 hover:border-gray-600"
                                                        )}
                                                        onClick={(e) => toggleOfferLocal(e, offer.id)}
                                                    >
                                                        <div className="flex items-center justify-between w-full">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                                                                    <Briefcase className="w-5 h-5 text-white/80" />
                                                                </div>
                                                                <span className="font-medium text-left">{offer.title}</span>
                                                            </div>

                                                            {/* ✅ ICÔNE SÉLECTION */}
                                                            {isSelected ? (
                                                                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                                                                    <Check className="w-5 h-5 text-white" />
                                                                </div>
                                                            ) : (
                                                                <div className="w-8 h-8 border-2 border-white/20 rounded-lg" />
                                                            )}
                                                        </div>
                                                    </Button>
                                                )
                                            })
                                        ) : (
                                            <div className="text-center py-12 text-gray-400">
                                                <Filter className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                                                <p className="text-lg font-medium text-white">Aucune offre trouvée</p>
                                                <p className="text-sm">Essayez une recherche différente</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Boutons d'action */}
                                    <div className="flex gap-3 pt-4">
                                        <Button
                                            variant="outline"
                                            className="flex-1 h-12 border-gray-600 text-white hover:bg-gray-800 bg-gray-800/50"
                                            onClick={clearAllLocalOffers}
                                        >
                                            <X className="w-4 h-4 mr-2" />
                                            Tout désélectionner
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="flex-1 h-12 border-gray-600 text-white hover:bg-gray-800 bg-gray-800/50"
                                            onClick={cancelFilters}
                                        >
                                            Annuler
                                        </Button>
                                        <Button
                                            className="flex-1 h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-500/25"
                                            onClick={applyFilters}
                                        >
                                             Appliquer
                                        </Button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </Card>
            </motion.div>

            {/* Compteur */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center p-4 bg-gray-900/50 border border-gray-800 rounded-xl"
            >
                <span className="text-lg font-semibold text-white">
                    {applications.length} candidature{applications.length > 1 ? 's' : ''}
                    {filters.offer_ids?.length > 0 && (
                        <span className="ml-2 text-purple-400">
                            - {filters.offer_ids.length} offre{filters.offer_ids.length > 1 ? 's' : ''} filtrée{filters.offer_ids.length > 1 ? 's' : ''}
                        </span>
                    )}
                </span>
            </motion.div>

            {/* Table */}
            {loading ? (
                <Card className="p-20 flex justify-center bg-gray-900 border-gray-800">
                    <Loader2 className="w-12 h-12 animate-spin text-purple-500" />
                </Card>
            ) : (
                <Card className="bg-gray-900 border-gray-800 overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-800/50 border-gray-700">
                                    <TableHead className="text-white font-semibold">Candidat</TableHead>
                                    <TableHead className="text-white font-semibold">Contact</TableHead>
                                    <TableHead className="text-white font-semibold">Poste</TableHead>
                                    <TableHead className="text-white font-semibold">RH</TableHead>
                                    <TableHead className="text-white font-semibold">Statut</TableHead>
                                    <TableHead className="text-white font-semibold">Date</TableHead>
                                    <TableHead className="text-white font-semibold text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {applications.length > 0 ? (
                                    applications.map((app, index) => (
                                        <motion.tr
                                            key={app.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.02 }}
                                            className="border-gray-800 hover:bg-gray-800/70 transition-all"
                                        >
                                            <TableCell className="font-medium text-white">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                                                        <User className="w-6 h-6 text-white" />
                                                    </div>
                                                    {app.full_name}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-gray-300">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <Mail className="w-4 h-4 text-gray-500" />
                                                        <span>{app.email}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-sm text-gray-400">
                                                        <Phone className="w-4 h-4 text-gray-500" />
                                                        {app.phone}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-white font-medium">
                                                    <Briefcase className="w-4 h-4 text-purple-400" />
                                                    {app.job_title}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-gray-300">{app.rh_name}</TableCell>
                                            <TableCell>{getStatusBadge(app.status)}</TableCell>
                                            <TableCell className="text-gray-400">
                                                {new Date(app.created_at).toLocaleDateString('fr-FR')}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex gap-2 justify-end">
                                                    <Button variant="ghost" size="sm" className="h-10 w-10 p-0 hover:bg-gray-700 text-gray-300 hover:text-white">
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                    {app.cv_file && (
                                                        <a href={app.cv_file} target="_blank" rel="noopener noreferrer">
                                                            <Button variant="ghost" size="sm" className="h-10 w-10 p-0 hover:bg-gray-700 text-gray-300 hover:text-white">
                                                                <Download className="w-4 h-4" />
                                                            </Button>
                                                        </a>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </motion.tr>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center h-48 text-gray-400">
                                            <FileText className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                                            <div className="space-y-2">
                                                <h3 className="text-xl font-semibold text-white">Aucune candidature</h3>
                                                <p className="text-gray-500">Sélectionnez des offres pour voir les résultats</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            )}
        </motion.div>
    )
}