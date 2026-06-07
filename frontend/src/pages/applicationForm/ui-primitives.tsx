
import React from 'react'
import { Upload, CheckCircle2 } from 'lucide-react'
import { Label } from '../../../components/ui/label'
import { useToast } from '../../hooks/use-toast'

// ── SectionHeader ─────────────────────────────────────────────────────────────

interface SectionHeaderProps {
    icon: React.ElementType
    gradient: string
    title: string
    subtitle: string
}

export function SectionHeader({ icon: Icon, gradient, title, subtitle }: SectionHeaderProps) {
    return (
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
            <div
                className={`w-9 h-9 rounded-xl bg-gradient-to-r ${gradient}
                    flex items-center justify-center flex-shrink-0`}
            >
                <Icon className="w-4 h-4 text-white" />
            </div>
            <div>
                <div className="text-[15px] font-bold text-slate-900">{title}</div>
                <div className="text-xs text-slate-400 mt-0.5">{subtitle}</div>
            </div>
        </div>
    )
}

// ── Field ─────────────────────────────────────────────────────────────────────

interface FieldProps {
    label: string
    required?: boolean
    hint?: string
    children: React.ReactNode
}

export function Field({ label, required, hint, children }: FieldProps) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-500 tracking-wide uppercase">
                {label} {required && <span className="text-indigo-500">★</span>}
            </Label>
            {children}
            {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
        </div>
    )
}

// ── ScoreBar ──────────────────────────────────────────────────────────────────

interface ScoreBarProps {
    label: string
    value: number | undefined
    max?: number
    color: string
}

export function ScoreBar({ label, value, max = 100, color }: ScoreBarProps) {
    if (value === undefined || value === null) return null
    const pct = Math.round((value / max) * 100)
    return (
        <div className="space-y-1">
            <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">{label}</span>
                <span className="text-xs font-bold text-slate-700">
          {Math.round(value)}
                    <span className="text-slate-400">/{max}</span>
        </span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-700 ${color}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    )
}

// ── FileZone ──────────────────────────────────────────────────────────────────

interface FileZoneProps {
    file: File | null
    onChange: (f: File | null) => void
    label: string
    accept: string
    maxMb: number
    required?: boolean
}

export function FileZone({ file, onChange, label, accept, maxMb, required }: FileZoneProps) {
    const { toast } = useToast()

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0] ?? null
        if (!f) return
        if (!f.name.toLowerCase().endsWith('.pdf')) {
            toast({
                title: 'Format invalide',
                description: 'Seuls les PDF sont acceptés',
                variant: 'destructive',
            })
            e.target.value = ''
            return
        }
        if (f.size > maxMb * 1024 * 1024) {
            toast({
                title: 'Fichier trop volumineux',
                description: `Max ${maxMb} MB`,
                variant: 'destructive',
            })
            e.target.value = ''
            return
        }
        onChange(f)
    }

    return (
        <div>
            <Label className="text-xs font-semibold text-slate-500 tracking-wide uppercase mb-1.5 block">
                {label} {required && <span className="text-indigo-500">★</span>}
            </Label>
            <label
                className={`flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2
                    border-dashed cursor-pointer transition-all ${
                    file
                        ? 'border-emerald-300 bg-emerald-50'
                        : 'border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/30'
                }`}
            >
                <input type="file" accept={accept} onChange={handleChange} className="hidden" />
                {file ? (
                    <>
                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                        <span className="text-sm font-semibold text-emerald-700 text-center break-all">
              {file.name}
            </span>
                        <span className="text-xs text-emerald-500">Cliquer pour changer</span>
                    </>
                ) : (
                    <>
                        <Upload className="w-6 h-6 text-slate-400" />
                        <span className="text-sm font-semibold text-slate-600">Glissez ou cliquez</span>
                        <span className="text-xs text-slate-400">PDF · max {maxMb} MB</span>
                    </>
                )}
            </label>
        </div>
    )
}