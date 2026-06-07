
import { Plus, X, Award, FileText } from 'lucide-react'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { useToast } from '../../hooks/use-toast'
import {CertificateData} from "../../types/types.ts";
import {generateId} from "../../types/constants.ts";


interface CertificationUploaderProps {
    certifications: CertificateData[]
    onChange: (certs: CertificateData[]) => void
}

export function CertificationUploader({ certifications, onChange }: CertificationUploaderProps) {
    const { toast } = useToast()

    const addCert = () => {
        onChange([
            ...certifications,
            {
                id: generateId(),
                name: '',
                issuing_organization: '',
                credential_url: '',
                file: null,
            },
        ])
    }

    const removeCert = (id: string) => {
        onChange(certifications.filter((c) => c.id !== id))
    }

    const updateCert = (id: string, field: keyof CertificateData, value: string | File | null) => {
        onChange(certifications.map((cert) => (cert.id === id ? { ...cert, [field]: value } : cert)))
    }

    const handleFileChange = (id: string, file: File | null) => {
        if (!file) return
        if (file.size > 5 * 1024 * 1024) {
            toast({ title: 'Fichier trop volumineux', description: 'Max 5 MB', variant: 'destructive' })
            return
        }
        onChange(certifications.map((cert) => (cert.id === id ? { ...cert, file } : cert)))
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <Label className="text-xs font-bold text-slate-500 uppercase">Certifications</Label>
                <button
                    type="button"
                    onClick={addCert}
                    className="flex items-center gap-1 text-xs text-indigo-600 font-bold hover:underline"
                >
                    <Plus className="w-3 h-3" />
                    Ajouter certification
                </button>
            </div>

            {certifications.map((cert) => (
                <div
                    key={cert.id}
                    className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3"
                >
                    <div className="flex items-start gap-3">
                        <div className="flex-1 space-y-2">
                            <Input
                                placeholder="Nom du certificat (ex: AWS Solutions Architect)"
                                value={cert.name}
                                onChange={(e) => updateCert(cert.id, 'name', e.target.value)}
                                className="h-9 bg-white"
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <Input
                                    placeholder="Organisme émetteur"
                                    value={cert.issuing_organization}
                                    onChange={(e) => updateCert(cert.id, 'issuing_organization', e.target.value)}
                                    className="h-9 bg-white"
                                />
                                <Input
                                    type="url"
                                    placeholder="URL credential (optionnel)"
                                    value={cert.credential_url}
                                    onChange={(e) => updateCert(cert.id, 'credential_url', e.target.value)}
                                    className="h-9 bg-white"
                                />
                            </div>

                            <div>
                                <input
                                    type="file"
                                    id={`cert-file-${cert.id}`}
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    className="hidden"
                                    onChange={(e) => {
                                        const f = e.target.files?.[0] ?? null
                                        handleFileChange(cert.id, f)
                                        e.target.value = ''
                                    }}
                                />
                                <label
                                    htmlFor={`cert-file-${cert.id}`}
                                    className="flex items-center gap-2 p-3 border-2 border-dashed border-slate-300
                             rounded-lg cursor-pointer hover:border-indigo-400 transition-colors"
                                >
                                    <FileText className="w-4 h-4 text-slate-400" />
                                    <span className="text-xs text-slate-500 flex-1 truncate">
                    {cert.file ? cert.file.name : 'Fichier (PDF/Image, max 5MB)'}
                  </span>
                                </label>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => removeCert(cert.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ))}

            {certifications.length === 0 && (
                <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <Award className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm text-slate-400">
                        Aucune certification ajoutée.
                        <br />
                        Cliquez sur &quot;+ Ajouter certification&quot;.
                    </p>
                </div>
            )}
        </div>
    )
}