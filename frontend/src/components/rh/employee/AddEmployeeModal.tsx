import { useState } from 'react'
import { Plus, X, Loader2 } from 'lucide-react'

import {useToast} from "../../../hooks/use-toast.ts";
import api from "../../../api/api.ts";
import {AddEmployeeForm, Employee} from "../../../types/types.ts";

export function AddEmployeeModal({
                                     onClose,
                                     onAdded,
                                 }: {
    onClose: () => void
    onAdded: (e: Employee) => void
}) {
    const { toast } = useToast()
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState<AddEmployeeForm>({
        full_name: '',
        email: '',
        phone: '',
        position_title: '',
        department: '',
        start_date: '',
        salary: '',
        employee_id: '',
        nationality: '',
        current_location: '',
    })

    const handleSubmit = async () => {
        if (!form.full_name || !form.email || !form.position_title) {
            toast({
                title: 'Champs requis',
                description: 'Nom, email et poste sont obligatoires.',
                variant: 'destructive',
            })
            return
        }
        setLoading(true)
        try {
            const res = await api.post('/recruitment/rh/employees/add-manual/', {
                ...form,
                salary_expectation: form.salary || null,
            })
            onAdded(res.data)
            toast({ title: '✅ Employé ajouté', description: form.full_name })
            onClose()
        } catch {
            toast({
                title: 'Erreur',
                description: "Impossible d'ajouter",
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    const Field = ({
                       label,
                       fkey,
                       type = 'text',
                       required = false,
                   }: {
        label: string
        fkey: keyof AddEmployeeForm
        type?: string
        required?: boolean
    }) => (
        <div>
            <label className="text-xs text-slate-500 mb-1 block">
                {label}
                {required && <span className="text-red-400 ml-0.5">*</span>}
            </label>
            <input
                type={type}
                value={form[fkey]}
                onChange={(e) => setForm((prev) => ({ ...prev, [fkey]: e.target.value }))}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
            />
        </div>
    )

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="w-full max-w-xl my-4 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/50">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                            <Plus className="w-5 h-5 text-violet-400" />
                        </div>
                        <div>
                            <h2 className="text-white font-semibold text-sm">Ajouter un employé manuellement</h2>
                            <p className="text-slate-500 text-xs">Recrutement hors plateforme</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
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
                        <button
                            onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-medium"
                        >
                            Annuler
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            Ajouter
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}