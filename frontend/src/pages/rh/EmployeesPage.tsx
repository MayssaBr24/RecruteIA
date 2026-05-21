import { useEffect, useState } from 'react'
import {
    Users, Search, Plus, Loader2,
    CheckCircle, AlertCircle, Calendar, Filter, ChevronDown,
} from 'lucide-react'
import { useToast } from '../../hooks/use-toast'
import { CandidateDrawer } from '../../components/rh/recruitment/CandidateDrawer'
import api from '../../lib/api'

import { EmployeeDossierPage } from './EmployeeDossierPage'
import {Employee} from "../../types/types.ts";
import {EmployeeCard, StatCard} from "../../components/rh/employee/EmployeeCards.tsx";
import {AddEmployeeModal} from "../../components/rh/employee/AddEmployeeModal.tsx";

// ══════════════════════════════════════════
// PAGE PRINCIPALE
// ══════════════════════════════════════════

export function EmployeesPage() {
    const { toast } = useToast()
    const [employees, setEmployees] = useState<Employee[]>([])
    const [loading, setLoading] = useState(true)

    // Filters
    const [search, setSearch] = useState('')
    const [filterDept, setFilterDept] = useState('ALL')
    const [filterDocs, setFilterDocs] = useState<'ALL' | 'COMPLETE' | 'INCOMPLETE'>('ALL')
    const [filterOpen, setFilterOpen] = useState(false)

    // Views
    const [selectedDrawer, setSelectedDrawer] = useState<Employee | null>(null)
    const [dossierEmployee, setDossierEmployee] = useState<Employee | null>(null)
    const [showAddModal, setShowAddModal] = useState(false)

    // ── Load ──────────────────────────────────
    useEffect(() => {
        const load = async () => {
            try {
                const res = await api.get('/recruitment/rh/employees/')
                setEmployees(res.data)
            } catch {
                toast({
                    title: 'Erreur',
                    description: 'Impossible de charger les employés',
                    variant: 'destructive',
                })
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    // ── If dossier page is open, render it full-page ──
    if (dossierEmployee) {
        return (
            <EmployeeDossierPage
                employee={dossierEmployee}
                onBack={() => setDossierEmployee(null)}
                onSaved={(updated) => {
                    setEmployees((prev) =>
                        prev.map((e) => (e.id === updated.id ? updated : e))
                    )
                    setDossierEmployee(updated) // stay on page with updated data
                    toast({ title: '✅ Dossier mis à jour', description: updated.full_name })
                }}
            />
        )
    }

    // ── Derived data ──────────────────────────
    const departments = [
        'ALL',
        ...Array.from(new Set(employees.map((e) => e.department).filter(Boolean))) as string[],
    ]

    const filtered = employees.filter((e) => {
        const matchSearch =
            search === '' ||
            e.full_name.toLowerCase().includes(search.toLowerCase()) ||
            e.email.toLowerCase().includes(search.toLowerCase()) ||
            (e.department || '').toLowerCase().includes(search.toLowerCase())
        const matchDept = filterDept === 'ALL' || e.department === filterDept
        const docsCount = [e.contract_file, e.cin_file, e.rib_file, e.photo_file].filter(Boolean).length
        const matchDocs =
            filterDocs === 'ALL' ||
            (filterDocs === 'COMPLETE' && docsCount === 4) ||
            (filterDocs === 'INCOMPLETE' && docsCount < 4)
        return matchSearch && matchDept && matchDocs
    })

    const stats = {
        total: employees.length,
        complete: employees.filter(
            (e) => [e.contract_file, e.cin_file, e.rib_file, e.photo_file].filter(Boolean).length === 4
        ).length,
        incomplete: employees.filter(
            (e) => [e.contract_file, e.cin_file, e.rib_file, e.photo_file].filter(Boolean).length < 4
        ).length,
        thisMonth: employees.filter((e) => {
            if (!e.hired_at) return false
            const d = new Date(e.hired_at)
            const now = new Date()
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
        }).length,
    }

    // ── Loading ───────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-violet-400" />
            </div>
        )
    }

    // ── Main render ───────────────────────────
    return (
        <div className="bg-slate-900 min-h-screen p-6 md:p-8">
            <div className="max-w-[1650px] mx-auto space-y-8">

                {/* ── Header ── */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
                                <Users className="w-5 h-5 text-violet-400" />
                            </div>
                            Employés
                        </h1>
                        <p className="text-slate-400 text-sm mt-1">
                            Gestion des employés recrutés et de leurs dossiers
                        </p>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-all shadow-lg shadow-violet-900/30"
                    >
                        <Plus className="w-4 h-4" /> Ajouter manuellement
                    </button>
                </div>

                {/* ── Stats ── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard icon={Users}        label="Total employés"      value={stats.total}      color="bg-violet-600" />
                    <StatCard icon={CheckCircle}  label="Dossiers complets"   value={stats.complete}   color="bg-blue-600" />
                    <StatCard icon={AlertCircle}  label="Dossiers incomplets" value={stats.incomplete} color="bg-amber-600" />
                    <StatCard icon={Calendar}     label="Recrutés ce mois"    value={stats.thisMonth}  color="bg-purple-600" />
                </div>

                {/* ── Filters ── */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
                    <div className="flex flex-col md:flex-row gap-3">
                        {/* Search */}
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Rechercher un employé..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-900/50 border border-slate-700 text-white text-sm rounded-xl placeholder:text-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
                            />
                        </div>

                        {/* Département */}
                        <div className="relative">
                            <button
                                onClick={() => setFilterOpen(!filterOpen)}
                                className="flex items-center gap-2 px-3 py-2 bg-slate-700/50 rounded-xl text-slate-300 text-sm border border-slate-600"
                            >
                                <Filter className="w-4 h-4" />
                                {filterDept === 'ALL' ? 'Département' : filterDept}
                                <ChevronDown className={`w-4 h-4 transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {filterOpen && (
                                <div className="absolute top-full mt-1 right-0 bg-slate-800 border border-slate-700 rounded-xl p-2 z-20 min-w-[160px] shadow-xl">
                                    {departments.map((d) => (
                                        <button
                                            key={d}
                                            onClick={() => { setFilterDept(d); setFilterOpen(false) }}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all
                        ${filterDept === d ? 'bg-violet-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
                                        >
                                            {d === 'ALL' ? 'Tous les départements' : d}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Docs filter */}
                        <div className="flex gap-1">
                            {(['ALL', 'COMPLETE', 'INCOMPLETE'] as const).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setFilterDocs(f)}
                                    className={`px-3 py-2 rounded-xl text-xs font-medium transition-all
                    ${filterDocs === f
                                        ? 'bg-violet-600 text-white'
                                        : 'bg-slate-700/50 text-slate-400 hover:text-white'
                                    }`}
                                >
                                    {f === 'ALL' ? 'Tous' : f === 'COMPLETE' ? 'Complets' : 'Incomplets'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Grid ── */}
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-slate-700 rounded-2xl">
                        <Users className="w-16 h-16 text-slate-600 mb-4" />
                        <p className="text-white font-semibold mb-1">Aucun employé</p>
                        <p className="text-slate-400 text-sm">
                            {employees.length === 0
                                ? 'Les employés recrutés apparaîtront ici.'
                                : 'Aucun résultat pour cette recherche.'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filtered.map((emp) => (
                            <EmployeeCard
                                key={emp.id}
                                employee={emp}
                                onView={(e) => setSelectedDrawer(e)}
                                onDossier={(e) => setDossierEmployee(e)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* ── CandidateDrawer ── */}
            {selectedDrawer && (
                <CandidateDrawer
                    candidate={selectedDrawer as any}
                    onClose={() => setSelectedDrawer(null)}
                    onInvite={() => {}}
                />
            )}

            {/* ── Add Employee Modal ── */}
            {showAddModal && (
                <AddEmployeeModal
                    onClose={() => setShowAddModal(false)}
                    onAdded={(e) => setEmployees((prev) => [e, ...prev])}
                />
            )}
        </div>
    )
}