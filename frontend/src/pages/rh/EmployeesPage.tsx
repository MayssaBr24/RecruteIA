import { useEffect, useState } from 'react'
import {
    Users, Search, Plus, Eye, Upload, FileText,
    Phone, Mail, MapPin, Briefcase, Calendar,
    GraduationCap, DollarSign, CreditCard, Building,
    Download, Loader2, X, CheckCircle, AlertCircle,
    UserCheck, Filter, ChevronDown,
} from 'lucide-react'
import { useToast } from '../../hooks/use-toast'
import { CandidateDrawer } from '../../components/rh/recruitment/CandidateDrawer'
import api from "../../lib/api.ts";

// ══════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════

interface Employee {
    id: number
    full_name: string
    email: string
    phone: string
    current_location: string
    nationality: string
    university: string
    degree_level: string
    graduation_year: string
    experience_years: number
    job_offer_title: string
    hired_at: string
    salary_expectation: number | null
    linkedin_url: string
    cv_file: string
    // Documents RH
    contract_file: string | null
    cin_file: string | null
    rib_file: string | null
    photo_file: string | null
    start_date: string | null
    department: string | null
    position_title: string | null
    employee_id: string | null
    // IA
    ai_score: number | null
    ai_decision: string | null
    ai_summary: string | null
    ai_strengths: string[] | null
    ai_weaknesses: string[] | null
    ai_missing_skills: string[] | null
    ai_recommendations: string | null
    ai_interview_score: number
    ai_analysis: any
    status: string
    // champs drawer
    applied_date: string
    availability_date: string | null
    job_title: string
    job_location: string
    job_contract_type: string
    cover_letter_url: string
    cv_file_url: string
    github_url: string
    communication_score: number
    clarification_score: number
    qcm_score: number
    coding_score: number | null
    interview_duration: number | null
    warnings_count: number
    has_video: boolean
    video_url: string | null
    completed_at: string | null
    invitation_status: string | null
    ai_interview_feedback: string | null
}

interface AddEmployeeForm {
    full_name: string
    email: string
    phone: string
    position_title: string
    department: string
    start_date: string
    salary: string
    employee_id: string
    nationality: string
    current_location: string
}

// ══════════════════════════════════════════
// SOUS-COMPOSANTS
// ══════════════════════════════════════════

function StatCard({ icon: Icon, label, value, color }: {
    icon: React.ElementType; label: string; value: number | string; color: string
}) {
    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5">
            <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mb-3`}>
                <Icon className="w-5 h-5 text-white" />
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-slate-400 text-sm mt-0.5">{label}</p>
        </div>
    )
}

function UploadDocButton({
                             label, icon: Icon, color, employeeId, field, currentUrl, onUploaded
                         }: {
    label: string; icon: React.ElementType; color: string
    employeeId: number; field: string; currentUrl: string | null
    onUploaded: (field: string, url: string) => void
}) {
    const [uploading, setUploading] = useState(false)
    const { toast } = useToast()

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const form = new FormData()
        form.append(field, file)
        setUploading(true)
        try {
            const res = await api.patch(`/recruitment/rh/employees/${employeeId}/documents/`, form, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })
            onUploaded(field, res.data[field])
            toast({ title: '✅ Document uploadé', description: label })
        } catch {
            toast({ title: 'Erreur', description: 'Upload échoué', variant: 'destructive' })
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className={`border rounded-xl p-3 ${currentUrl
            ? 'border-emerald-500/30 bg-emerald-500/5'
            : 'border-slate-700 bg-slate-800/50'}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${color}`} />
                    <span className="text-slate-300 text-xs font-medium">{label}</span>
                    {currentUrl && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <div className="flex items-center gap-2">
                    {currentUrl && (
                        <a href={currentUrl} target="_blank" rel="noopener noreferrer"
                           className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                            <Download className="w-3 h-3" /> Voir
                        </a>
                    )}
                    <label className={`cursor-pointer text-xs px-2.5 py-1 rounded-lg
                                       ${currentUrl
                        ? 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    } transition-all flex items-center gap-1`}>
                        {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                        {currentUrl ? 'Remplacer' : 'Uploader'}
                        <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                               onChange={handleUpload} />
                    </label>
                </div>
            </div>
        </div>
    )
}

function EmployeeCard({ employee, onView, onSelectDoc }: {
    employee: Employee
    onView: (e: Employee) => void
    onSelectDoc: (e: Employee) => void
}) {
    const docsCount = [
        employee.contract_file, employee.cin_file,
        employee.rib_file, employee.photo_file
    ].filter(Boolean).length

    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5
                        hover:border-emerald-500/40 transition-all">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600
                                    flex items-center justify-center text-white font-bold text-lg">
                        {employee.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <p className="text-white font-semibold">{employee.full_name}</p>
                        <p className="text-emerald-400 text-xs">
                            {employee.position_title || employee.job_offer_title}
                        </p>
                        {employee.department && (
                            <p className="text-slate-500 text-xs">{employee.department}</p>
                        )}
                    </div>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/10
                                 text-emerald-400 border border-emerald-500/20">
                    Employé
                </span>
            </div>

            <div className="space-y-1.5 mb-4">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Mail className="w-3.5 h-3.5 text-blue-400" />
                    <span className="truncate">{employee.email}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{employee.phone || '—'}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Calendar className="w-3.5 h-3.5 text-purple-400" />
                    <span>Recruté le {employee.hired_at
                        ? new Date(employee.hired_at).toLocaleDateString('fr-FR') : '—'}</span>
                </div>
                {employee.start_date && (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Briefcase className="w-3.5 h-3.5 text-amber-400" />
                        <span>Début le {new Date(employee.start_date).toLocaleDateString('fr-FR')}</span>
                    </div>
                )}
            </div>

            {/* Progression documents */}
            <div className="mb-4">
                <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-500">Documents</span>
                    <span className={`font-medium ${docsCount === 4 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {docsCount}/4
                    </span>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${
                        docsCount === 4 ? 'bg-emerald-500' : 'bg-amber-500'
                    }`} style={{ width: `${(docsCount / 4) * 100}%` }} />
                </div>
                {docsCount < 4 && (
                    <p className="text-amber-400 text-xs mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Dossier incomplet
                    </p>
                )}
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-700">
                <button onClick={() => onView(employee)}
                        className="flex-1 py-2 rounded-xl bg-slate-700 hover:bg-slate-600
                                   text-slate-300 text-xs flex items-center justify-center gap-1.5
                                   transition-all">
                    <Eye className="w-3.5 h-3.5" /> Profil complet
                </button>
                <button onClick={() => onSelectDoc(employee)}
                        className="flex-1 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30
                                   text-emerald-400 border border-emerald-500/30 text-xs
                                   flex items-center justify-center gap-1.5 transition-all">
                    <FileText className="w-3.5 h-3.5" /> Documents
                </button>
            </div>
        </div>
    )
}

// Modal documents employé
function DocumentsModal({ employee, onClose, onUpdate }: {
    employee: Employee
    onClose: () => void
    onUpdate: (id: number, field: string, url: string) => void
}) {
    const [emp, setEmp] = useState(employee)
    const [editInfo, setEditInfo] = useState(false)
    const [form, setForm] = useState({
        start_date: emp.start_date || '',
        department: emp.department || '',
        position_title: emp.position_title || '',
        employee_id: emp.employee_id || '',
    })
    const { toast } = useToast()

    const handleSaveInfo = async () => {
        try {
            await api.patch(`/recruitment/rh/employees/${emp.id}/`, form)
            setEmp(prev => ({ ...prev, ...form }))
            setEditInfo(false)
            toast({ title: '✅ Informations mises à jour' })
        } catch {
            toast({ title: 'Erreur', description: 'Impossible de sauvegarder', variant: 'destructive' })
        }
    }

    const handleUploaded = (field: string, url: string) => {
        setEmp(prev => ({ ...prev, [field]: url }))
        onUpdate(emp.id, field, url)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center
                        bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="w-full max-w-2xl my-4 bg-slate-900 border border-slate-700 rounded-2xl">
                <div className="flex items-center justify-between p-5 border-b border-slate-700">
                    <div>
                        <h2 className="text-white font-semibold">{emp.full_name}</h2>
                        <p className="text-slate-400 text-xs mt-0.5">Dossier employé</p>
                    </div>
                    <button onClick={onClose}
                            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700
                                       flex items-center justify-center text-slate-400">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    {/* Informations RH */}
                    <section>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-white font-medium text-sm flex items-center gap-2">
                                <Building className="w-4 h-4 text-purple-400" />
                                Informations RH
                            </h3>
                            <button onClick={() => setEditInfo(!editInfo)}
                                    className="text-xs text-purple-400 hover:text-purple-300">
                                {editInfo ? 'Annuler' : 'Modifier'}
                            </button>
                        </div>

                        {editInfo ? (
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { key: 'employee_id', label: "ID Employé", icon: UserCheck },
                                    { key: 'position_title', label: "Intitulé du poste", icon: Briefcase },
                                    { key: 'department', label: "Département", icon: Building },
                                    { key: 'start_date', label: "Date de début", icon: Calendar, type: 'date' },
                                ].map(({ key, label, type }) => (
                                    <div key={key}>
                                        <label className="text-xs text-slate-500 mb-1 block">{label}</label>
                                        <input
                                            type={type || 'text'}
                                            value={(form as any)[key]}
                                            onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700
                                                       rounded-lg text-white text-sm focus:outline-none
                                                       focus:border-purple-500"
                                        />
                                    </div>
                                ))}
                                <div className="col-span-2">
                                    <button onClick={handleSaveInfo}
                                            className="w-full py-2 rounded-lg bg-purple-600 hover:bg-purple-700
                                                       text-white text-sm font-medium transition-all">
                                        Enregistrer
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { label: 'ID Employé', value: emp.employee_id, icon: UserCheck },
                                    { label: 'Poste', value: emp.position_title || emp.job_offer_title, icon: Briefcase },
                                    { label: 'Département', value: emp.department, icon: Building },
                                    { label: 'Date de début', value: emp.start_date
                                            ? new Date(emp.start_date).toLocaleDateString('fr-FR') : null, icon: Calendar },
                                    { label: 'Date recrutement', value: emp.hired_at
                                            ? new Date(emp.hired_at).toLocaleDateString('fr-FR') : null, icon: Calendar },
                                    { label: 'Salaire attendu', value: emp.salary_expectation
                                            ? `${emp.salary_expectation} TND/mois` : null, icon: DollarSign },
                                ].map(({ label, value}) => (
                                    <div key={label} className="bg-slate-800/50 border border-slate-700
                                                                rounded-lg p-3">
                                        <p className="text-slate-500 text-xs mb-0.5">{label}</p>
                                        <p className="text-white text-sm font-medium">{value || '—'}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Documents obligatoires */}
                    <section>
                        <h3 className="text-white font-medium text-sm flex items-center gap-2 mb-3">
                            <FileText className="w-4 h-4 text-amber-400" />
                            Documents obligatoires
                        </h3>
                        <div className="space-y-2">
                            <UploadDocButton label="Contrat de travail (PDF)"
                                             icon={FileText} color="text-purple-400"
                                             employeeId={emp.id} field="contract_file"
                                             currentUrl={emp.contract_file} onUploaded={handleUploaded} />
                            <UploadDocButton label="Copie CIN (recto/verso)"
                                             icon={CreditCard} color="text-blue-400"
                                             employeeId={emp.id} field="cin_file"
                                             currentUrl={emp.cin_file} onUploaded={handleUploaded} />
                            <UploadDocButton label="RIB Bancaire"
                                             icon={Building} color="text-emerald-400"
                                             employeeId={emp.id} field="rib_file"
                                             currentUrl={emp.rib_file} onUploaded={handleUploaded} />
                            <UploadDocButton label="Photo d'identité"
                                             icon={UserCheck} color="text-amber-400"
                                             employeeId={emp.id} field="photo_file"
                                             currentUrl={emp.photo_file} onUploaded={handleUploaded} />
                        </div>
                    </section>

                    {/* Documents optionnels */}
                    <section>
                        <h3 className="text-white font-medium text-sm flex items-center gap-2 mb-3">
                            <FileText className="w-4 h-4 text-slate-400" />
                            Documents optionnels
                        </h3>
                        <div className="space-y-2">
                            <UploadDocButton label="Diplômes / Attestations"
                                             icon={GraduationCap} color="text-teal-400"
                                             employeeId={emp.id} field="diplomas_file"
                                             currentUrl={null} onUploaded={handleUploaded} />
                            <UploadDocButton label="Casier judiciaire"
                                             icon={FileText} color="text-red-400"
                                             employeeId={emp.id} field="criminal_record_file"
                                             currentUrl={null} onUploaded={handleUploaded} />
                            <UploadDocButton label="Visite médicale"
                                             icon={FileText} color="text-cyan-400"
                                             employeeId={emp.id} field="medical_file"
                                             currentUrl={null} onUploaded={handleUploaded} />
                        </div>
                    </section>

                    {/* Contacts */}
                    <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                        <h3 className="text-white font-medium text-sm mb-3">Contact</h3>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-slate-300">
                                <Mail className="w-4 h-4 text-blue-400" /> {emp.email}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-300">
                                <Phone className="w-4 h-4 text-emerald-400" /> {emp.phone || '—'}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-300">
                                <MapPin className="w-4 h-4 text-purple-400" />
                                {emp.current_location || '—'}
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    )
}

// Modal ajout manuel employé
function AddEmployeeModal({ onClose, onAdded }: {
    onClose: () => void
    onAdded: (e: Employee) => void
}) {
    const { toast } = useToast()
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState<AddEmployeeForm>({
        full_name: '', email: '', phone: '', position_title: '',
        department: '', start_date: '', salary: '',
        employee_id: '', nationality: '', current_location: '',
    })

    const handleSubmit = async () => {
        if (!form.full_name || !form.email || !form.position_title) {
            toast({ title: 'Champs requis', description: 'Nom, email et poste sont obligatoires.', variant: 'destructive' })
            return
        }
        setLoading(true)
        try {
            const res = await api.post('/recruitment/rh/employees/add-manual/', {
                ...form, salary_expectation: form.salary || null,
            })
            onAdded(res.data)
            toast({ title: '✅ Employé ajouté', description: form.full_name })
            onClose()
        } catch {
            toast({ title: 'Erreur', description: 'Impossible d\'ajouter', variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }

    const Field = ({ label, fkey, type = 'text', required = false }: {
        label: string; fkey: keyof AddEmployeeForm; type?: string; required?: boolean
    }) => (
        <div>
            <label className="text-xs text-slate-500 mb-1 block">
                {label}{required && <span className="text-red-400 ml-0.5">*</span>}
            </label>
            <input type={type} value={form[fkey]}
                   onChange={e => setForm(prev => ({ ...prev, [fkey]: e.target.value }))}
                   className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl
                              text-white text-sm focus:outline-none focus:border-purple-500 transition-colors" />
        </div>
    )

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center
                        bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="w-full max-w-xl my-4 bg-slate-900 border border-slate-700 rounded-2xl">
                <div className="flex items-center justify-between p-5 border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20
                                        flex items-center justify-center">
                            <Plus className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-white font-semibold text-sm">Ajouter un employé manuellement</h2>
                            <p className="text-slate-500 text-xs">Recrutement hors plateforme</p>
                        </div>
                    </div>
                    <button onClick={onClose}
                            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700
                                       flex items-center justify-center text-slate-400">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5">
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <Field label="Nom complet" fkey="full_name" required />
                        <Field label="Email" fkey="email" type="email" required />
                        <Field label="Téléphone" fkey="phone" />
                        <Field label="Nationalité" fkey="nationality" />
                        <Field label="Localisation" fkey="current_location" />
                        <Field label="ID Employé" fkey="employee_id" />
                        <Field label="Intitulé du poste" fkey="position_title" required />
                        <Field label="Département" fkey="department" />
                        <Field label="Date de début" fkey="start_date" type="date" />
                        <Field label="Salaire (TND/mois)" fkey="salary" type="number" />
                    </div>

                    <div className="flex gap-3">
                        <button onClick={onClose}
                                className="flex-1 py-2.5 rounded-xl border border-slate-700
                                           text-slate-300 hover:bg-slate-800 text-sm font-medium">
                            Annuler
                        </button>
                        <button onClick={handleSubmit} disabled={loading}
                                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700
                                           text-white text-sm font-medium flex items-center
                                           justify-center gap-2 disabled:opacity-50">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            Ajouter
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ══════════════════════════════════════════
// PAGE PRINCIPALE
// ══════════════════════════════════════════

export function EmployeesPage() {
    const { toast } = useToast()
    const [employees, setEmployees] = useState<Employee[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filterDept, setFilterDept] = useState('ALL')
    const [filterDocs, setFilterDocs] = useState<'ALL' | 'COMPLETE' | 'INCOMPLETE'>('ALL')
    const [filterOpen, setFilterOpen] = useState(false)

    const [selectedDrawer, setSelectedDrawer] = useState<Employee | null>(null)
    const [selectedDocs, setSelectedDocs] = useState<Employee | null>(null)
    const [showAddModal, setShowAddModal] = useState(false)

    useEffect(() => {
        const load = async () => {
            try {
                const res = await api.get('/recruitment/rh/employees/')
                setEmployees(res.data)
            } catch {
                toast({ title: 'Erreur', description: 'Impossible de charger les employés', variant: 'destructive' })
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    const departments = ['ALL', ...Array.from(new Set(
        employees.map(e => e.department).filter(Boolean)
    )) as string[]]

    const filtered = employees.filter(e => {
        const matchSearch = search === '' ||
            e.full_name.toLowerCase().includes(search.toLowerCase()) ||
            e.email.toLowerCase().includes(search.toLowerCase()) ||
            (e.department || '').toLowerCase().includes(search.toLowerCase())
        const matchDept = filterDept === 'ALL' || e.department === filterDept
        const docsCount = [e.contract_file, e.cin_file, e.rib_file, e.photo_file].filter(Boolean).length
        const matchDocs = filterDocs === 'ALL'
            || (filterDocs === 'COMPLETE' && docsCount === 4)
            || (filterDocs === 'INCOMPLETE' && docsCount < 4)
        return matchSearch && matchDept && matchDocs
    })

    const stats = {
        total: employees.length,
        complete: employees.filter(e =>
            [e.contract_file, e.cin_file, e.rib_file, e.photo_file].filter(Boolean).length === 4
        ).length,
        incomplete: employees.filter(e =>
            [e.contract_file, e.cin_file, e.rib_file, e.photo_file].filter(Boolean).length < 4
        ).length,
        thisMonth: employees.filter(e => {
            if (!e.hired_at) return false
            const d = new Date(e.hired_at)
            const now = new Date()
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
        }).length,
    }

    const handleDocUpdate = (id: number, field: string, url: string) => {
        setEmployees(prev => prev.map(e => e.id === id ? { ...e, [field]: url } : e))
    }

    if (loading) return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-400" />
        </div>
    )

    return (
        /* On passe sur un fond plus profond #0b0e14 et on augmente le padding à p-8 ou p-10 */
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4
                        hover:border-slate-600 transition-all">
            <div className="max-w-[1650px] mx-auto space-y-10">           {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30
                                            flex items-center justify-center">
                                <Users className="w-5 h-5 text-emerald-400" />
                            </div>
                            Employés
                        </h1>
                        <p className="text-slate-400 text-sm mt-1">
                            Gestion des employés recrutés et de leurs dossiers
                        </p>
                    </div>
                    <button onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl
                                       bg-emerald-600 hover:bg-emerald-700 text-white
                                       text-sm font-medium transition-all">
                        <Plus className="w-4 h-4" /> Ajouter manuellement
                    </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard icon={Users} label="Total employés" value={stats.total} color="bg-emerald-600" />
                    <StatCard icon={CheckCircle} label="Dossiers complets" value={stats.complete} color="bg-blue-600" />
                    <StatCard icon={AlertCircle} label="Dossiers incomplets" value={stats.incomplete} color="bg-amber-600" />
                    <StatCard icon={Calendar} label="Recrutés ce mois" value={stats.thisMonth} color="bg-purple-600" />
                </div>

                {/* Filters */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
                    <div className="flex flex-col md:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input type="text" placeholder="Rechercher un employé..."
                                   value={search} onChange={e => setSearch(e.target.value)}
                                   className="w-full pl-9 pr-4 py-2 bg-slate-900/50 border border-slate-700
                                              text-white text-sm rounded-xl placeholder:text-slate-500
                                              focus:outline-none focus:border-emerald-500 transition-colors" />
                        </div>

                        {/* Filtre département */}
                        <div className="relative">
                            <button onClick={() => setFilterOpen(!filterOpen)}
                                    className="flex items-center gap-2 px-3 py-2 bg-slate-700/50 rounded-xl
                                               text-slate-300 text-sm border border-slate-600">
                                <Filter className="w-4 h-4" />
                                {filterDept === 'ALL' ? 'Département' : filterDept}
                                <ChevronDown className={`w-4 h-4 transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {filterOpen && (
                                <div className="absolute top-full mt-1 right-0 bg-slate-800 border border-slate-700
                                                rounded-xl p-2 z-20 min-w-[150px]">
                                    {departments.map(d => (
                                        <button key={d} onClick={() => { setFilterDept(d); setFilterOpen(false) }}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all
                                                           ${filterDept === d
                                                    ? 'bg-emerald-600 text-white'
                                                    : 'text-slate-300 hover:bg-slate-700'}`}>
                                            {d === 'ALL' ? 'Tous les départements' : d}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Filtre documents */}
                        <div className="flex gap-1">
                            {(['ALL', 'COMPLETE', 'INCOMPLETE'] as const).map(f => (
                                <button key={f} onClick={() => setFilterDocs(f)}
                                        className={`px-3 py-2 rounded-xl text-xs font-medium transition-all
                                                   ${filterDocs === f
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-slate-700/50 text-slate-400 hover:text-white'}`}>
                                    {f === 'ALL' ? 'Tous' : f === 'COMPLETE' ? 'Complets' : 'Incomplets'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Grille employés */}
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24
                                    border-2 border-dashed border-slate-700 rounded-2xl">
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
                        {filtered.map(emp => (
                            <EmployeeCard
                                key={emp.id}
                                employee={emp}
                                onView={e => setSelectedDrawer(e)}
                                onSelectDoc={e => setSelectedDocs(e)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* CandidateDrawer réutilisé */}
            {selectedDrawer && (
                <CandidateDrawer
                    candidate={selectedDrawer as any}
                    onClose={() => setSelectedDrawer(null)}
                    onInvite={() => {}}
                />
            )}

            {/* Modal Documents */}
            {selectedDocs && (
                <DocumentsModal
                    employee={selectedDocs}
                    onClose={() => setSelectedDocs(null)}
                    onUpdate={handleDocUpdate}
                />
            )}

            {/* Modal Ajout manuel */}
            {showAddModal && (
                <AddEmployeeModal
                    onClose={() => setShowAddModal(false)}
                    onAdded={e => setEmployees(prev => [e, ...prev])}
                />
            )}
        </div>
    )
}