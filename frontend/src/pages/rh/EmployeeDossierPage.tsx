import { useState, useRef } from 'react'
import {
    ArrowLeft, Save, Loader2, Upload, X, CheckCircle,
    FileText, CreditCard, Building, GraduationCap,
    Briefcase, Calendar, DollarSign, User, Phone, Mail, MapPin,
    Eye, AlertCircle,
} from 'lucide-react'
import { useToast } from '../../hooks/use-toast'
import api from '../../lib/api'
import {Employee} from "../../types/types.ts";

// ── FileUploadZone ───────────────────────────────────────────────────────────
function FileUploadZone({
                            label,
                            hint,
                            value,
                            onChange,
                            currentUrl,
                            accept = '.pdf,.jpg,.jpeg,.png',
                        }: {
    label: string
    hint?: string
    value: File | null
    onChange: (f: File | null) => void
    currentUrl?: string | null
    accept?: string
}) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [dragOver, setDragOver] = useState(false)

    const preview = value ? URL.createObjectURL(value) : null
    const isImage = value?.type.startsWith('image/') || (currentUrl && /\.(jpg|jpeg|png|webp)$/i.test(currentUrl))

    return (
        <div className="space-y-2">
            <label className="text-xs text-slate-400 font-medium block">{label}</label>

            {/* Drop zone */}
            <div
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                    e.preventDefault()
                    setDragOver(false)
                    const file = e.dataTransfer.files[0]
                    if (file) onChange(file)
                }}
                className={`relative border-2 border-dashed rounded-xl cursor-pointer transition-all overflow-hidden
          ${dragOver
                    ? 'border-violet-400 bg-violet-500/10'
                    : value || currentUrl
                        ? 'border-violet-500/40 bg-violet-500/5'
                        : 'border-slate-600 hover:border-violet-500/50 bg-slate-800/50'
                }`}
            >
                {/* Preview image */}
                {(preview || (currentUrl && isImage)) && (
                    <div className="relative">
                        <img
                            src={preview || currentUrl!}
                            alt={label}
                            className="w-full h-36 object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-all">
                            <span className="text-white text-xs bg-black/60 px-3 py-1.5 rounded-lg">Remplacer</span>
                        </div>
                    </div>
                )}

                {/* PDF or no preview */}
                {!preview && !(currentUrl && isImage) && (
                    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                        {currentUrl ? (
                            <>
                                <CheckCircle className="w-8 h-8 text-violet-400 mb-2" />
                                <p className="text-violet-400 text-xs font-medium">Fichier déjà uploadé</p>
                                <p className="text-slate-500 text-xs mt-0.5">Cliquer pour remplacer</p>
                            </>
                        ) : (
                            <>
                                <Upload className={`w-7 h-7 mb-2 ${dragOver ? 'text-violet-400' : 'text-slate-500'}`} />
                                <p className="text-slate-400 text-xs font-medium">Glisser ou cliquer pour uploader</p>
                                {hint && <p className="text-slate-600 text-xs mt-0.5">{hint}</p>}
                            </>
                        )}
                    </div>
                )}

                {/* PDF name tag */}
                {value && !value.type.startsWith('image/') && (
                    <div className="p-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-violet-400 shrink-0" />
                        <span className="text-slate-300 text-xs truncate">{value.name}</span>
                    </div>
                )}
            </div>

            {/* File actions */}
            <div className="flex items-center justify-between">
                {value && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onChange(null) }}
                        className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                    >
                        <X className="w-3 h-3" /> Supprimer
                    </button>
                )}
                {currentUrl && !value && (
                    <a
                        href={currentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                        <Eye className="w-3 h-3" /> Voir le fichier actuel
                    </a>
                )}
            </div>

            <input
                ref={inputRef}
                type="file"
                accept={accept}
                className="hidden"
                onChange={(e) => onChange(e.target.files?.[0] ?? null)}
            />
        </div>
    )
}

// ── Section wrapper ──────────────────────────────────────────────────────────
function Section({
                     icon: Icon,
                     title,
                     color = 'text-violet-400',
                     children,
                 }: {
    icon: React.ElementType
    title: string
    color?: string
    children: React.ReactNode
}) {
    return (
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-6">
            <h2 className="text-white font-semibold text-sm flex items-center gap-2 mb-5">
                <Icon className={`w-4 h-4 ${color}`} />
                {title}
            </h2>
            {children}
        </div>
    )
}

// ── Input field ──────────────────────────────────────────────────────────────
function InputField({
                        label,
                        value,
                        onChange,
                        type = 'text',
                        placeholder = '',
                        required = false,
                        readOnly = false,
                    }: {
    label: string
    value: string
    onChange?: (v: string) => void
    type?: string
    placeholder?: string
    required?: boolean
    readOnly?: boolean
}) {
    return (
        <div>
            <label className="text-xs text-slate-400 mb-1.5 block font-medium">
                {label}
                {required && <span className="text-red-400 ml-0.5">*</span>}
            </label>
            <input
                type={type}
                value={value}
                readOnly={readOnly}
                placeholder={placeholder}
                onChange={(e) => onChange?.(e.target.value)}
                className={`w-full px-3 py-2.5 rounded-xl text-white text-sm focus:outline-none transition-colors
          ${readOnly
                    ? 'bg-slate-900/50 border border-slate-700 text-slate-400 cursor-default'
                    : 'bg-slate-900 border border-slate-700 focus:border-violet-500'
                }`}
            />
        </div>
    )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export function EmployeeDossierPage({
                                        employee,
                                        onBack,
                                        onSaved,
                                    }: {
    employee: Employee
    onBack: () => void
    onSaved: (updated: Employee) => void
}) {
    const { toast } = useToast()
    const [saving, setSaving] = useState(false)

    // Infos RH
    const [employeeId, setEmployeeId] = useState(employee.employee_id || '')
    const [positionTitle, setPositionTitle] = useState(employee.position_title || '')
    const [department, setDepartment] = useState(employee.department || '')
    const [startDate, setStartDate] = useState(employee.start_date || '')

    // CIN
    const [cinNumber, setCinNumber] = useState(employee.cin_number || '')
    const [cinFile, setCinFile] = useState<File | null>(null)

    // RIB
    const [ribNumber, setRibNumber] = useState(employee.rib_number || '')
    const [ribFile, setRibFile] = useState<File | null>(null)

    // Autres docs
    const [contractFile, setContractFile] = useState<File | null>(null)
    const [photoFile, setPhotoFile] = useState<File | null>(null)
    const [diplomasFile, setDiplomasFile] = useState<File | null>(null)
    const [criminalFile, setCriminalFile] = useState<File | null>(null)
    const [medicalFile, setMedicalFile] = useState<File | null>(null)

    // Progression docs obligatoires
    const docsOk = [
        employee.contract_file || contractFile,
        employee.cin_file || cinFile,
        employee.rib_file || ribFile,
        employee.photo_file || photoFile,
    ].filter(Boolean).length

    const handleSave = async () => {
        setSaving(true)
        try {
            // 1. Sauvegarder les infos RH textuelles
            const infoRes = await api.patch(`/recruitment/rh/employees/${employee.id}/`, {
                employee_id: employeeId,
                position_title: positionTitle,
                department,
                start_date: startDate || null,
                cin_number: cinNumber || null,
                rib_number: ribNumber || null,
            })

            // 2. Uploader les fichiers s'il y en a
            const filesToUpload = [
                { key: 'contract_file', file: contractFile },
                { key: 'cin_file', file: cinFile },
                { key: 'rib_file', file: ribFile },
                { key: 'photo_file', file: photoFile },
                { key: 'diplomas_file', file: diplomasFile },
                { key: 'criminal_record_file', file: criminalFile },
                { key: 'medical_file', file: medicalFile },
            ].filter((f) => f.file !== null)

            let updatedEmployee = infoRes.data as Employee

            if (filesToUpload.length > 0) {
                const form = new FormData()
                filesToUpload.forEach(({ key, file }) => form.append(key, file!))
                const docRes = await api.patch(
                    `/recruitment/rh/employees/${employee.id}/documents/`,
                    form,
                    { headers: { 'Content-Type': 'multipart/form-data' } }
                )
                updatedEmployee = { ...updatedEmployee, ...docRes.data }
            }

            toast({ title: '✅ Dossier sauvegardé', description: employee.full_name })
            onSaved(updatedEmployee)
        } catch (err: any) {
            const msg = err?.response?.data
                ? JSON.stringify(err.response.data).slice(0, 100)
                : 'Erreur inconnue'
            toast({ title: 'Erreur', description: msg, variant: 'destructive' })
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="min-h-screen bg-slate-950 p-6 md:p-8">
            <div className="max-w-4xl mx-auto space-y-6">

                {/* ── Header ── */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 hover:border-violet-500/40 flex items-center justify-center text-slate-400 hover:text-white transition-all"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-xl font-bold text-white flex items-center gap-2">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-violet-900/30">
                                {employee.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            {employee.full_name}
                        </h1>
                        <p className="text-slate-500 text-xs mt-0.5">
                            {employee.position_title || employee.job_offer_title} · Compléter le dossier
                        </p>
                    </div>

                    {/* Doc progress badge */}
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium
            ${docsOk === 4
                        ? 'bg-violet-500/10 border-violet-500/30 text-violet-400'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    }`}>
                        {docsOk === 4
                            ? <CheckCircle className="w-4 h-4" />
                            : <AlertCircle className="w-4 h-4" />}
                        {docsOk}/4 documents
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold disabled:opacity-50 transition-all shadow-lg shadow-violet-900/30"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Enregistrer
                    </button>
                </div>

                {/* ── Informations de base (lecture seule) ── */}
                <Section icon={User} title="Informations personnelles" color="text-blue-400">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <InputField label="Nom complet" value={employee.full_name} readOnly />
                        <InputField label="Email" value={employee.email} readOnly />
                        <InputField label="Téléphone" value={employee.phone || '—'} readOnly />
                        <InputField label="Nationalité" value={employee.nationality || '—'} readOnly />
                        <InputField label="Localisation" value={employee.current_location || '—'} readOnly />
                        <InputField
                            label="Salaire attendu"
                            value={employee.salary_expectation ? `${employee.salary_expectation} TND` : '—'}
                            readOnly
                        />
                    </div>
                </Section>

                {/* ── Informations RH (éditables) ── */}
                <Section icon={Building} title="Informations RH" color="text-purple-400">
                    <div className="grid grid-cols-2 gap-3">
                        <InputField
                            label="ID Employé"
                            value={employeeId}
                            onChange={setEmployeeId}
                            placeholder="EMP-001"
                        />
                        <InputField
                            label="Intitulé du poste"
                            value={positionTitle}
                            onChange={setPositionTitle}
                            required
                        />
                        <InputField
                            label="Département"
                            value={department}
                            onChange={setDepartment}
                            placeholder="ex: Ingénierie"
                        />
                        <InputField
                            label="Date de début"
                            value={startDate}
                            onChange={setStartDate}
                            type="date"
                        />
                    </div>
                </Section>

                {/* ── CIN ── */}
                <Section icon={CreditCard} title="Carte d'identité nationale (CIN)" color="text-blue-400">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <InputField
                                label="Numéro CIN"
                                value={cinNumber}
                                onChange={setCinNumber}
                                placeholder="Ex: 12345678"
                                required
                            />
                            <p className="text-slate-500 text-xs">
                                Entrez le numéro exact figurant sur la carte d'identité nationale.
                            </p>
                            {employee.cin_number && (
                                <div className="flex items-center gap-2 text-xs text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-lg px-3 py-2">
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    Numéro enregistré : <strong>{employee.cin_number}</strong>
                                </div>
                            )}
                        </div>
                        <FileUploadZone
                            label="Copie CIN (recto/verso)"
                            hint="JPG, PNG ou PDF · max 5 Mo"
                            value={cinFile}
                            onChange={setCinFile}
                            currentUrl={employee.cin_file}
                            accept=".pdf,.jpg,.jpeg,.png"
                        />
                    </div>
                </Section>

                {/* ── RIB ── */}
                <Section icon={Building} title="Relevé d'Identité Bancaire (RIB)" color="text-emerald-400">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <InputField
                                label="Numéro RIB / IBAN"
                                value={ribNumber}
                                onChange={setRibNumber}
                                placeholder="Ex: TN59 1000 1234 5678 9012 3456"
                                required
                            />
                            <p className="text-slate-500 text-xs">
                                Entrez le RIB ou IBAN complet figurant sur le relevé bancaire.
                            </p>
                            {employee.rib_number && (
                                <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    RIB enregistré : <strong>{employee.rib_number}</strong>
                                </div>
                            )}
                        </div>
                        <FileUploadZone
                            label="Document RIB bancaire"
                            hint="JPG, PNG ou PDF · max 5 Mo"
                            value={ribFile}
                            onChange={setRibFile}
                            currentUrl={employee.rib_file}
                            accept=".pdf,.jpg,.jpeg,.png"
                        />
                    </div>
                </Section>

                {/* ── Documents obligatoires ── */}
                <Section icon={FileText} title="Documents obligatoires" color="text-amber-400">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FileUploadZone
                            label="Contrat de travail (PDF)"
                            hint="PDF obligatoire"
                            value={contractFile}
                            onChange={setContractFile}
                            currentUrl={employee.contract_file}
                            accept=".pdf"
                        />
                        <FileUploadZone
                            label="Photo d'identité"
                            hint="JPG ou PNG · fond blanc recommandé"
                            value={photoFile}
                            onChange={setPhotoFile}
                            currentUrl={employee.photo_file}
                            accept=".jpg,.jpeg,.png"
                        />
                    </div>
                </Section>

                {/* ── Documents optionnels ── */}
                <Section icon={GraduationCap} title="Documents optionnels" color="text-slate-400">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FileUploadZone
                            label="Diplômes / Attestations"
                            hint="PDF ou image"
                            value={diplomasFile}
                            onChange={setDiplomasFile}
                            currentUrl={null}
                        />
                        <FileUploadZone
                            label="Casier judiciaire"
                            hint="PDF ou image"
                            value={criminalFile}
                            onChange={setCriminalFile}
                            currentUrl={null}
                        />
                        <FileUploadZone
                            label="Visite médicale"
                            hint="PDF ou image"
                            value={medicalFile}
                            onChange={setMedicalFile}
                            currentUrl={null}
                        />
                    </div>
                </Section>

                {/* ── Contact info recap ── */}
                <Section icon={Mail} title="Contact & Recrutement" color="text-sky-400">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {[
                            { label: 'Email', value: employee.email, icon: Mail },
                            { label: 'Téléphone', value: employee.phone || '—', icon: Phone },
                            { label: 'Localisation', value: employee.current_location || '—', icon: MapPin },
                            { label: 'Poste candidaté', value: employee.job_offer_title || '—', icon: Briefcase },
                            {
                                label: 'Date de recrutement',
                                value: employee.hired_at ? new Date(employee.hired_at).toLocaleDateString('fr-FR') : '—',
                                icon: Calendar,
                            },
                            {
                                label: 'Salaire attendu',
                                value: employee.salary_expectation ? `${employee.salary_expectation} TND/mois` : '—',
                                icon: DollarSign,
                            },
                        ].map(({ label, value }) => (
                            <div key={label} className="bg-slate-900/50 border border-slate-700/60 rounded-xl p-3">
                                <p className="text-slate-500 text-xs mb-0.5">{label}</p>
                                <p className="text-white text-sm font-medium truncate">{value}</p>
                            </div>
                        ))}
                    </div>
                </Section>

                {/* ── Save button bottom ── */}
                <div className="flex justify-end pb-6">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-8 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold disabled:opacity-50 transition-all shadow-xl shadow-violet-900/40 text-sm"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Enregistrer le dossier
                    </button>
                </div>

            </div>
        </div>
    )
}