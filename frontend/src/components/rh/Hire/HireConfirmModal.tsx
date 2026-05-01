import { useState } from 'react'
import { X, CheckCircle, Loader2, AlertTriangle } from 'lucide-react'

interface Props {
    candidateName: string
    onConfirm: () => Promise<void>
    onClose: () => void
}

export function HireConfirmModal({ candidateName, onConfirm, onClose }: Props) {
    const [step, setStep] = useState<1 | 2>(1)
    const [typed, setTyped] = useState('')
    const [loading, setLoading] = useState(false)

    const CONFIRM_WORD = 'RECRUTER'
    const isValid = typed.trim().toUpperCase() === CONFIRM_WORD

    const handleFinalConfirm = async () => {
        if (!isValid) return
        setLoading(true)
        await onConfirm()
        setLoading(false)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20
                                        flex items-center justify-center">
                            <CheckCircle className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-white font-semibold text-sm">Confirmer le recrutement</h2>
                            <p className="text-slate-500 text-xs">Action irréversible</p>
                        </div>
                    </div>
                    <button onClick={onClose}
                            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700
                                       flex items-center justify-center text-slate-400 hover:text-white transition-all">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {/* Step 1 */}
                    {step === 1 && (
                        <>
                            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-amber-400 font-medium text-sm mb-1">
                                            Vous êtes sur le point de recruter :
                                        </p>
                                        <p className="text-white font-bold">{candidateName}</p>
                                        <p className="text-slate-400 text-xs mt-2">
                                            Ce candidat sera retiré de la liste des entretiens qualifiés
                                            et transféré vers la page <span className="text-emerald-400 font-medium">Employés</span>.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={onClose}
                                        className="flex-1 py-2.5 rounded-xl border border-slate-700
                                                   text-slate-300 hover:bg-slate-800 text-sm font-medium transition-all">
                                    Annuler
                                </button>
                                <button onClick={() => setStep(2)}
                                        className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700
                                                   text-white text-sm font-medium transition-all">
                                    Continuer
                                </button>
                            </div>
                        </>
                    )}

                    {/* Step 2 */}
                    {step === 2 && (
                        <>
                            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                                <p className="text-slate-300 text-sm mb-3">
                                    Pour confirmer, tapez <span className="text-emerald-400 font-bold font-mono">RECRUTER</span> ci-dessous :
                                </p>
                                <input
                                    type="text"
                                    value={typed}
                                    onChange={e => setTyped(e.target.value)}
                                    placeholder="RECRUTER"
                                    autoFocus
                                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700
                                               rounded-xl text-white font-mono text-center tracking-widest
                                               placeholder:text-slate-600 focus:outline-none
                                               focus:border-emerald-500 transition-colors"
                                />
                                {typed && !isValid && (
                                    <p className="text-red-400 text-xs mt-2 text-center">
                                        Tapez exactement "RECRUTER"
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => { setStep(1); setTyped('') }}
                                        className="flex-1 py-2.5 rounded-xl border border-slate-700
                                                   text-slate-300 hover:bg-slate-800 text-sm font-medium transition-all">
                                    Retour
                                </button>
                                <button onClick={handleFinalConfirm}
                                        disabled={!isValid || loading}
                                        className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700
                                                   text-white text-sm font-medium transition-all
                                                   disabled:opacity-40 disabled:cursor-not-allowed
                                                   flex items-center justify-center gap-2">
                                    {loading
                                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Traitement...</>
                                        : <><CheckCircle className="w-4 h-4" /> Confirmer le recrutement</>
                                    }
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}