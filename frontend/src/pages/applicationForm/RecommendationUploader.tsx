
import { Plus, X, Mail } from 'lucide-react'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { useToast } from '../../hooks/use-toast'
import {RecommendationData} from "../../types/types.ts";
import {generateId} from "../../types/constants.ts";

interface RecommendationUploaderProps {
    recommendations: RecommendationData[]
    onChange: (recs: RecommendationData[]) => void
}

const RELATIONSHIP_OPTIONS = [
    { value: 'manager',   label: 'Ancien Manager' },
    { value: 'colleague', label: 'Collègue' },
    { value: 'professor', label: 'Professeur' },
    { value: 'client',    label: 'Client' },
    { value: 'mentor',    label: 'Mentor' },
    { value: 'other',     label: 'Autre' },
] as const

export function RecommendationUploader({ recommendations, onChange }: RecommendationUploaderProps) {
    const { toast } = useToast()

    const addRec = () => {
        onChange([
            ...recommendations,
            {
                id: generateId(),
                recommender_name: '',
                recommender_position: '',
                recommender_company: '',
                relationship: 'manager',
                file: null,
            },
        ])
    }

    const removeRec = (id: string) => {
        onChange(recommendations.filter((r) => r.id !== id))
    }

    const updateRec = (id: string, field: keyof RecommendationData, value: string | File | null) => {
        onChange(recommendations.map((rec) => (rec.id === id ? { ...rec, [field]: value } : rec)))
    }

    const handleFileChange = (id: string, file: File | null) => {
        if (!file) return
        if (file.size > 3 * 1024 * 1024) {
            toast({ title: 'Fichier trop volumineux', description: 'Max 3 MB', variant: 'destructive' })
            return
        }
        if (!file.name.toLowerCase().endsWith('.pdf')) {
            toast({
                title: 'Format invalide',
                description: 'Seuls les PDF sont acceptés',
                variant: 'destructive',
            })
            return
        }
        onChange(recommendations.map((rec) => (rec.id === id ? { ...rec, file } : rec)))
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <Label className="text-xs font-bold text-slate-500 uppercase">
                    Lettres de recommandation
                </Label>
                <button
                    type="button"
                    onClick={addRec}
                    className="flex items-center gap-1 text-xs text-indigo-600 font-bold hover:underline"
                >
                    <Plus className="w-3 h-3" />
                    Ajouter recommandation
                </button>
            </div>

            {recommendations.map((rec) => (
                <div
                    key={rec.id}
                    className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3"
                >
                    <div className="flex items-start gap-3">
                        <div className="flex-1 space-y-2">
                            <Input
                                placeholder="Nom du recommandeur"
                                value={rec.recommender_name}
                                onChange={(e) => updateRec(rec.id, 'recommender_name', e.target.value)}
                                className="h-9 bg-white"
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <Input
                                    placeholder="Poste du recommandeur"
                                    value={rec.recommender_position}
                                    onChange={(e) => updateRec(rec.id, 'recommender_position', e.target.value)}
                                    className="h-9 bg-white"
                                />
                                <Input
                                    placeholder="Entreprise"
                                    value={rec.recommender_company}
                                    onChange={(e) => updateRec(rec.id, 'recommender_company', e.target.value)}
                                    className="h-9 bg-white"
                                />
                            </div>

                            <select
                                value={rec.relationship}
                                onChange={(e) => updateRec(rec.id, 'relationship', e.target.value)}
                                className="h-9 px-3 bg-white border border-slate-200 rounded-xl text-sm w-full"
                            >
                                {RELATIONSHIP_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>

                            <div>
                                <input
                                    type="file"
                                    id={`rec-file-${rec.id}`}
                                    accept=".pdf"
                                    className="hidden"
                                    onChange={(e) => {
                                        const f = e.target.files?.[0] ?? null
                                        handleFileChange(rec.id, f)
                                        e.target.value = ''
                                    }}
                                />
                                <label
                                    htmlFor={`rec-file-${rec.id}`}
                                    className="flex items-center gap-2 p-3 border-2 border-dashed border-slate-300
                             rounded-lg cursor-pointer hover:border-indigo-400 transition-colors"
                                >
                                    <Mail className="w-4 h-4 text-slate-400" />
                                    <span className="text-xs text-slate-500 flex-1 truncate">
                    {rec.file ? rec.file.name : 'Lettre (PDF, max 3MB)'}
                  </span>
                                </label>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => removeRec(rec.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ))}

            {recommendations.length === 0 && (
                <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <Mail className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm text-slate-400">
                        Aucune recommandation ajoutée.
                        <br />
                        Cliquez sur &quot;+ Ajouter recommandation&quot;.
                    </p>
                </div>
            )}
        </div>
    )
}