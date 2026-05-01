
import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../../../../components/ui/dialog'
import { Button } from '../../../../components/ui/button'
import { Label } from '../../../../components/ui/label'
import { Slider } from '../../../../components/ui/slider'
import { Scale, AlertCircle, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription } from '../../../../components/ui/alert'
import { WeightsConfig } from '../../../hooks/useRHData'

interface WeightsConfigDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    jobId: number
    jobTitle: string
    currentWeights: WeightsConfig
    onSave: (weights: WeightsConfig) => Promise<boolean>
}

export function WeightsConfigDialog({
    open,
    onOpenChange,

    jobTitle,
    currentWeights,
    onSave
}: WeightsConfigDialogProps) {

    const [weights, setWeights] = useState<WeightsConfig>(currentWeights)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    // Calculer la somme
    const total = weights.cv + weights.motivation + weights.softskills + weights.github
    const isValid = Math.abs(total - 1) < 0.01

    useEffect(() => {
        setWeights(currentWeights)
    }, [currentWeights])

    const handleWeightChange = (key: keyof WeightsConfig, value: number) => {
        setWeights(prev => ({ ...prev, [key]: value }))
        setError('')
    }

    const handleSave = async () => {
        if (!isValid) {
            setError(`La somme des poids doit être égale à 1 (actuellement: ${total.toFixed(2)})`)
            return
        }

        setSaving(true)
        const success = await onSave(weights)
        setSaving(false)

        if (success) {
            onOpenChange(false)
        }
    }

    const resetToDefault = () => {
        setWeights({
            cv: 0.50,
            motivation: 0.15,
            softskills: 0.10,
            github: 0.25
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md rounded-2xl">
                <DialogHeader>
                    <div className="mx-auto w-12 h-12 rounded-full bg-gradient-to-r from-purple-100 to-blue-100 flex items-center justify-center mb-4">
                        <Scale className="w-6 h-6 text-purple-600" />
                    </div>
                    <DialogTitle className="text-xl text-center">
                        Configuration des poids IA
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        Personnalisez l'importance de chaque critère pour l'offre "{jobTitle}"
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* CV */}
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <Label className="font-medium flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                                📄 CV
                            </Label>
                            <span className="text-sm font-semibold text-blue-600">
                                {(weights.cv * 100).toFixed(0)}%
                            </span>
                        </div>
                        <Slider
                            value={[weights.cv]}
                            min={0}
                            max={1}
                            step={0.05}
                            onValueChange={([value]) => handleWeightChange('cv', value)}
                            className="[&_[role=slider]]:bg-blue-600"
                        />
                    </div>

                    {/* Lettre de motivation */}
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <Label className="font-medium flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                                ✉️ Lettre motivation
                            </Label>
                            <span className="text-sm font-semibold text-purple-600">
                                {(weights.motivation * 100).toFixed(0)}%
                            </span>
                        </div>
                        <Slider
                            value={[weights.motivation]}
                            min={0}
                            max={1}
                            step={0.05}
                            onValueChange={([value]) => handleWeightChange('motivation', value)}
                            className="[&_[role=slider]]:bg-purple-600"
                        />
                    </div>

                    {/* Soft Skills */}
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <Label className="font-medium flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-600"></span>
                                🧠 Soft Skills
                            </Label>
                            <span className="text-sm font-semibold text-green-600">
                                {(weights.softskills * 100).toFixed(0)}%
                            </span>
                        </div>
                        <Slider
                            value={[weights.softskills]}
                            min={0}
                            max={1}
                            step={0.05}
                            onValueChange={([value]) => handleWeightChange('softskills', value)}
                            className="[&_[role=slider]]:bg-green-600"
                        />
                    </div>

                    {/* GitHub */}
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <Label className="font-medium flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-orange-600"></span>
                                💻 GitHub
                            </Label>
                            <span className="text-sm font-semibold text-orange-600">
                                {(weights.github * 100).toFixed(0)}%
                            </span>
                        </div>
                        <Slider
                            value={[weights.github]}
                            min={0}
                            max={1}
                            step={0.05}
                            onValueChange={([value]) => handleWeightChange('github', value)}
                            className="[&_[role=slider]]:bg-orange-600"
                        />
                    </div>

                    {/* Total et validation */}
                    <div className="pt-4 border-t">
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-medium">Total</span>
                            <span className={`text-lg font-bold ${isValid ? 'text-green-600' : 'text-red-600'}`}>
                                {(total * 100).toFixed(0)}%
                            </span>
                        </div>

                        {!isValid && (
                            <Alert variant="destructive" className="mt-2">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    {error || `La somme doit être 100% (actuellement ${(total * 100).toFixed(0)}%)`}
                                </AlertDescription>
                            </Alert>
                        )}

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={resetToDefault}
                            className="mt-4 w-full"
                        >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Réinitialiser aux valeurs par défaut
                        </Button>
                    </div>
                </div>

                <DialogFooter className="flex gap-3 sm:justify-center">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="rounded-xl px-8"
                    >
                        Annuler
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving || !isValid}
                        className="rounded-xl px-8 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    >
                        {saving ? 'Sauvegarde...' : 'Sauvegarder les poids'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}