
export function LoadingScreen() {
    return (
        <div className="flex flex-col items-center gap-6 text-center">
            <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border border-white/10" />
                <div className="absolute inset-0 rounded-full border border-t-amber-400/60 animate-spin"
                     style={{ borderTopColor:'rgba(251,191,36,0.6)', borderRightColor:'transparent', borderBottomColor:'transparent', borderLeftColor:'transparent' }} />
            </div>
            <div className="flex flex-col gap-2">
                <p className="text-lg font-light" style={{ color:'rgba(255,255,255,0.7)' }}>Préparation de votre entretien…</p>
                <p className="text-sm" style={{ color:'rgba(255,255,255,0.3)' }}>Quelques secondes</p>
            </div>
        </div>
    )
}

interface ErrorProps { message: string; onRetry?: () => void }

export function ErrorScreen({ message, onRetry }: ErrorProps) {
    return (
        <div className="flex flex-col items-center gap-6 text-center max-w-md">
            <div className="w-16 h-16 rounded-full flex items-center justify-center"
                 style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
            </div>
            <div className="flex flex-col gap-2">
                <h2 className="text-xl font-light" style={{ color:'rgba(255,255,255,0.85)' }}>Une erreur est survenue</h2>
                <p className="text-sm" style={{ color:'rgba(255,255,255,0.4)' }}>{message}</p>
            </div>
            {onRetry && (
                <button onClick={onRetry}
                        className="px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                        style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', color:'rgba(255,255,255,0.7)' }}>
                    Réessayer
                </button>
            )}
        </div>
    )
}

interface FraudProps { message: string }

export function FraudScreen({ message }: FraudProps) {
    return (
        <div className="flex flex-col items-center gap-6 text-center max-w-md">
            <div className="w-16 h-16 rounded-full flex items-center justify-center"
                 style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
            </div>
            <div className="flex flex-col gap-3">
                <h2 className="text-2xl font-light" style={{ color:'rgba(255,255,255,0.85)' }}>Entretien interrompu</h2>
                <p className="text-sm leading-relaxed" style={{ color:'rgba(255,255,255,0.45)' }}>{message}</p>
                <p className="text-xs" style={{ color:'rgba(255,255,255,0.25)' }}>
                    L'équipe RH a été notifiée. Contactez le recruteur pour plus d'informations.
                </p>
            </div>
        </div>
    )
}
// StatusScreens.tsx - À la toute fin
const StatusScreens = {
    LoadingScreen,
    ErrorScreen,
    FraudScreen
};

export default StatusScreens;