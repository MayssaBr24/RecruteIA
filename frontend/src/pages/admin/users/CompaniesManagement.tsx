import { useEffect, useState } from 'react'
import {
    Building2, Plus, ToggleLeft, ToggleRight, Users,
    Mail, Globe, Crown, Briefcase, FileText,
    KeyRound, X, Check, ChevronDown, ChevronUp, Eye, EyeOff
} from 'lucide-react'
import api from "../../../api/api.ts"

interface AdminUser {
    id: number
    username: string
    email: string
    is_active: boolean
    last_login: string
}

interface Company {
    id: number
    name: string
    slug: string
    plan: string
    is_active: boolean
    email_domain: string
    users_count: number
    total_rh: number
    total_offers: number
    total_applications: number
    created_at: string
    admin_user: AdminUser | null
}

const PLAN_STYLES: Record<string, string> = {
    free: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    pro: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    enterprise: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
}

export function CompaniesManagement() {
    const [companies, setCompanies] = useState<Company[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [expandedId, setExpandedId] = useState<number | null>(null)
    const [resetModal, setResetModal] = useState<{ companyId: number, companyName: string } | null>(null)
    const [newPassword, setNewPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [resetLoading, setResetLoading] = useState(false)
    const [resetMsg, setResetMsg] = useState('')

    const [form, setForm] = useState({
        company_name: '', email_domain: '', plan: 'free',
        username: '', email: '', password: '',
        first_name: '', last_name: ''
    })

    useEffect(() => { fetchCompanies() }, [])

    const fetchCompanies = async () => {
        try {
            const res = await api.get('/admin/companies/')
            setCompanies(res.data)
        } finally {
            setLoading(false)
        }
    }

    const toggleCompany = async (id: number) => {
        await api.post(`/admin/companies/${id}/toggle/`)
        fetchCompanies()
    }

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        await api.post('/companies/register/', form)
        setShowForm(false)
        setForm({ company_name: '', email_domain: '', plan: 'free', username: '', email: '', password: '', first_name: '', last_name: '' })
        fetchCompanies()
    }

    const handleResetPassword = async () => {
        if (!resetModal) return
        setResetLoading(true)
        try {
            const res = await api.post(`/admin/companies/${resetModal.companyId}/reset-password/`, {
                new_password: newPassword
            })
            setResetMsg(res.data.message)
            setTimeout(() => {
                setResetModal(null)
                setNewPassword('')
                setResetMsg('')
            }, 2000)
        } catch (e: any) {
            setResetMsg(e.response?.data?.error || 'Erreur')
        } finally {
            setResetLoading(false)
        }
    }

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
    )

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-white" />
                        </div>
                        Entreprises
                    </h1>
                    <p className="text-gray-400 text-sm mt-1 ml-13">
                        {companies.length} entreprises · {companies.filter(c => c.is_active).length} actives
                    </p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:opacity-90 text-sm font-medium shadow-lg shadow-purple-500/20"
                >
                    <Plus className="w-4 h-4" />
                    Nouvelle entreprise
                </button>
            </div>

            {/* Stats globales */}
            <div className="grid grid-cols-4 gap-4">
                {[
                    { label: 'Total entreprises', value: companies.length, icon: Building2, color: 'from-purple-600 to-indigo-600' },
                    { label: 'Total RH', value: companies.reduce((a, c) => a + c.total_rh, 0), icon: Users, color: 'from-blue-600 to-cyan-600' },
                    { label: 'Total offres', value: companies.reduce((a, c) => a + c.total_offers, 0), icon: Briefcase, color: 'from-emerald-600 to-teal-600' },
                    { label: 'Total candidatures', value: companies.reduce((a, c) => a + c.total_applications, 0), icon: FileText, color: 'from-orange-600 to-amber-600' },
                ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center mb-3`}>
                            <Icon className="w-4 h-4 text-white" />
                        </div>
                        <div className="text-2xl font-bold text-white">{value}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{label}</div>
                    </div>
                ))}
            </div>

            {/* Formulaire création */}
            {showForm && (
                <form onSubmit={handleCreate} className="bg-gray-800/50 border border-purple-500/30 rounded-xl p-6 space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-white font-semibold">Créer une entreprise + Admin RH</h2>
                        <button type="button" onClick={() => setShowForm(false)}>
                            <X className="w-5 h-5 text-gray-400 hover:text-white" />
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        {[
                            { label: 'Nom entreprise *', key: 'company_name', required: true, placeholder: '' },
                            { label: 'Domaine email', key: 'email_domain', placeholder: 'ex: entreprise.com' },
                            { label: 'Username Admin *', key: 'username', required: true, placeholder: '' },
                            { label: 'Email Admin *', key: 'email', required: true, type: 'email', placeholder: '' },
                            { label: 'Mot de passe *', key: 'password', required: true, type: 'password', placeholder: '' },
                            { label: 'Prénom', key: 'first_name', placeholder: '' },
                            { label: 'Nom', key: 'last_name', placeholder: '' },
                        ].map(({ label, key, required, type, placeholder }) => (
                            <div key={key}>
                                <label className="text-gray-400 text-xs">{label}</label>
                                <input
                                    required={required}
                                    type={type || 'text'}
                                    value={form[key as keyof typeof form]}
                                    placeholder={placeholder}
                                    onChange={e => setForm({ ...form, [key]: e.target.value })}
                                    className="w-full mt-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:border-purple-500 outline-none"
                                />
                            </div>
                        ))}
                        <div>
                            <label className="text-gray-400 text-xs">Plan</label>
                            <select value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value })}
                                    className="w-full mt-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm">
                                <option value="free">Free</option>
                                <option value="pro">Pro</option>
                                <option value="enterprise">Enterprise</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 flex items-center gap-2">
                            <Check className="w-4 h-4" /> Créer
                        </button>
                        <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-600">
                            Annuler
                        </button>
                    </div>
                </form>
            )}

            {/* Liste companies */}
            <div className="space-y-3">
                {companies.map(company => (
                    <div key={company.id} className={`bg-gray-800/50 border rounded-xl overflow-hidden transition-all ${company.is_active ? 'border-gray-700' : 'border-red-500/30 opacity-60'}`}>
                        {/* Header card */}
                        <div className="p-5 flex items-center justify-between">
                            <div className="flex items-center gap-4 flex-1">
                                {/* Avatar */}
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                                    {company.name.slice(0, 2).toUpperCase()}
                                </div>

                                {/* Infos principales */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <h3 className="text-white font-semibold text-lg">{company.name}</h3>
                                        <span className={`text-xs px-2 py-0.5 rounded-full border ${PLAN_STYLES[company.plan]}`}>
                                            {company.plan.toUpperCase()}
                                        </span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${company.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                            {company.is_active ? '● Active' : '● Inactive'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                                        {company.email_domain && (
                                            <span className="flex items-center gap-1 text-xs text-gray-400">
                                                <Globe className="w-3 h-3" /> {company.email_domain}
                                            </span>
                                        )}
                                        <span className="flex items-center gap-1 text-xs text-gray-400">
                                            <Users className="w-3 h-3" /> {company.total_rh} RH
                                        </span>
                                        <span className="flex items-center gap-1 text-xs text-gray-400">
                                            <Briefcase className="w-3 h-3" /> {company.total_offers} offres
                                        </span>
                                        <span className="flex items-center gap-1 text-xs text-gray-400">
                                            <FileText className="w-3 h-3" /> {company.total_applications} candidatures
                                        </span>
                                    </div>
                                </div>

                                {/* Stats mini */}
                                <div className="hidden lg:flex items-center gap-6">
                                    {[
                                        { label: 'RH', value: company.total_rh, icon: Users },
                                        { label: 'Offres', value: company.total_offers, icon: Briefcase },
                                        { label: 'Candidatures', value: company.total_applications, icon: FileText },
                                    ].map(({ label, value,  }) => (
                                        <div key={label} className="text-center">
                                            <div className="text-white font-bold text-lg">{value}</div>
                                            <div className="text-gray-500 text-xs">{label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 ml-4">
                                <button
                                    onClick={() => setExpandedId(expandedId === company.id ? null : company.id)}
                                    className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
                                    title="Voir admin"
                                >
                                    {expandedId === company.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                                <button
                                    onClick={() => toggleCompany(company.id)}
                                    className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                                    title={company.is_active ? 'Désactiver' : 'Activer'}
                                >
                                    {company.is_active
                                        ? <ToggleRight className="w-5 h-5 text-green-400" />
                                        : <ToggleLeft className="w-5 h-5 text-gray-400" />
                                    }
                                </button>
                            </div>
                        </div>

                        {/* Section admin expandable */}
                        {expandedId === company.id && (
                            <div className="border-t border-gray-700 p-5 bg-gray-900/50">
                                <h4 className="text-gray-400 text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Crown className="w-3 h-3" /> Admin RH
                                </h4>
                                {company.admin_user ? (
                                    <div className="flex items-center justify-between flex-wrap gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold">
                                                {company.admin_user.username.slice(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="text-white font-medium">{company.admin_user.username}</div>
                                                <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                                                    <Mail className="w-3 h-3" />
                                                    {company.admin_user.email}
                                                </div>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${company.admin_user.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                        {company.admin_user.is_active ? 'Actif' : 'Inactif'}
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                        Dernière connexion : {company.admin_user.last_login}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setResetModal({ companyId: company.id, companyName: company.name })}
                                            className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg text-sm hover:bg-amber-500/20 transition-colors"
                                        >
                                            <KeyRound className="w-4 h-4" />
                                            Réinitialiser le mot de passe
                                        </button>
                                    </div>
                                ) : (
                                    <p className="text-gray-500 text-sm">Aucun admin trouvé pour cette entreprise</p>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Modal reset password */}
            {resetModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-white font-semibold flex items-center gap-2">
                                <KeyRound className="w-5 h-5 text-amber-400" />
                                Réinitialiser le mot de passe
                            </h3>
                            <button onClick={() => { setResetModal(null); setNewPassword(''); setResetMsg('') }}>
                                <X className="w-5 h-5 text-gray-400 hover:text-white" />
                            </button>
                        </div>
                        <p className="text-gray-400 text-sm mb-4">
                            Nouveau mot de passe pour l'admin de <span className="text-white font-medium">{resetModal.companyName}</span>
                        </p>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                placeholder="Nouveau mot de passe (8 min)"
                                className="w-full px-3 py-2 pr-10 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:border-purple-500 outline-none"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        {resetMsg && (
                            <p className={`text-sm mt-2 ${resetMsg.includes('réinitialisé') ? 'text-green-400' : 'text-red-400'}`}>
                                {resetMsg}
                            </p>
                        )}
                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={handleResetPassword}
                                disabled={!newPassword || newPassword.length < 8 || resetLoading}
                                className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                {resetLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                                Confirmer
                            </button>
                            <button
                                onClick={() => { setResetModal(null); setNewPassword(''); setResetMsg('') }}
                                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
                            >
                                Annuler
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}