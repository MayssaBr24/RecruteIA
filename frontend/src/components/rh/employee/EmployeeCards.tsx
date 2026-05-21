import {
     Mail, Phone, Calendar, Briefcase,
    Eye, FileText, AlertCircle,
} from 'lucide-react'
import {Employee} from "../../../types/types.ts";

// ── StatCard ──────────────────────────────
export function StatCard({
                             icon: Icon, label, value, color,
                         }: {
    icon: React.ElementType
    label: string
    value: number | string
    color: string
}) {
    return (
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 hover:border-violet-500/30 transition-all">
            <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mb-3`}>
                <Icon className="w-5 h-5 text-white" />
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-slate-400 text-sm mt-0.5">{label}</p>
        </div>
    )
}

// ── EmployeeCard ──────────────────────────
export function EmployeeCard({
                                 employee,
                                 onView,
                                 onDossier,
                             }: {
    employee: Employee
    onView: (e: Employee) => void
    onDossier: (e: Employee) => void
}) {
    const docsCount = [
        employee.contract_file,
        employee.cin_file,
        employee.rib_file,
        employee.photo_file,
    ].filter(Boolean).length

    const initials = employee.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()

    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5 hover:border-violet-500/40 transition-all group">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-violet-900/30">
                        {initials}
                    </div>
                    <div>
                        <p className="text-white font-semibold">{employee.full_name}</p>
                        <p className="text-violet-400 text-xs">
                            {employee.position_title || employee.job_offer_title}
                        </p>
                        {employee.department && (
                            <p className="text-slate-500 text-xs">{employee.department}</p>
                        )}
                    </div>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
          Employé
        </span>
            </div>

            {/* Infos */}
            <div className="space-y-1.5 mb-4">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Mail className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="truncate">{employee.email}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Phone className="w-3.5 h-3.5 text-violet-400" />
                    <span>{employee.phone || '—'}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Calendar className="w-3.5 h-3.5 text-purple-400" />
                    <span>
            Recruté le{' '}
                        {employee.hired_at
                            ? new Date(employee.hired_at).toLocaleDateString('fr-FR')
                            : '—'}
          </span>
                </div>
                {employee.start_date && (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Briefcase className="w-3.5 h-3.5 text-amber-400" />
                        <span>
              Début le {new Date(employee.start_date).toLocaleDateString('fr-FR')}
            </span>
                    </div>
                )}
            </div>

            {/* Progression documents */}
            <div className="mb-4">
                <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-500">Documents</span>
                    <span className={`font-medium ${docsCount === 4 ? 'text-violet-400' : 'text-amber-400'}`}>
            {docsCount}/4
          </span>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all ${docsCount === 4 ? 'bg-violet-500' : 'bg-amber-500'}`}
                        style={{ width: `${(docsCount / 4) * 100}%` }}
                    />
                </div>
                {docsCount < 4 && (
                    <p className="text-amber-400 text-xs mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Dossier incomplet
                    </p>
                )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-3 border-t border-slate-700">
                <button
                    onClick={() => onView(employee)}
                    className="flex-1 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs flex items-center justify-center gap-1.5 transition-all"
                >
                    <Eye className="w-3.5 h-3.5" /> Profil complet
                </button>
                <button
                    onClick={() => onDossier(employee)}
                    className="flex-1 py-2 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 border border-violet-500/30 text-xs flex items-center justify-center gap-1.5 transition-all"
                >
                    <FileText className="w-3.5 h-3.5" /> Dossier
                </button>
            </div>
        </div>
    )
}