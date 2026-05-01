import { useEffect } from 'react'
import { useTimer } from '../../hooks/useTimer'
import type { QCMQuestion } from '../../types/interview'

interface Props {
    questions: QCMQuestion[]
    answers: Record<string, number>
    timeLimitSeconds: number
    submitting: boolean
    onSelect: (qIdx: number, optIdx: number) => void
    onSubmit: () => void
}

const OPTION_LABELS = ['A', 'B', 'C', 'D']
const DIFF_COLORS: Record<string, { bg: string; border: string; text: string }> = {
    easy:   { bg:'rgba(34,197,94,0.07)',  border:'rgba(34,197,94,0.18)',  text:'rgba(34,197,94,0.7)'  },
    medium: { bg:'rgba(251,191,36,0.07)', border:'rgba(251,191,36,0.18)', text:'rgba(251,191,36,0.7)' },
    hard:   { bg:'rgba(239,68,68,0.07)',  border:'rgba(239,68,68,0.18)',  text:'rgba(239,68,68,0.7)'  },
}

export function QCMView({ questions, answers, timeLimitSeconds, submitting, onSelect, onSubmit }: Props) {
    const timer = useTimer(timeLimitSeconds, onSubmit)
    useEffect(() => { timer.start() }, [])

    const answeredCount = Object.keys(answers).length
    const allAnswered   = answeredCount === questions.length

    return (
        <div className="w-full max-w-2xl mx-auto flex flex-col gap-6">

            {/* En-tête QCM */}
            <div className="flex items-center justify-between">
                <div>
          <span className="text-xs font-medium tracking-widest uppercase px-3 py-1 rounded-full"
                style={{ background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.2)', color:'rgba(251,191,36,0.7)' }}>
            QCM Technique
          </span>
                </div>
                <div className="flex items-center gap-4">
          <span className="text-xs" style={{ color:'rgba(255,255,255,0.3)' }}>
            {answeredCount} / {questions.length} répondues
          </span>
                    {/* Timer */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                         style={{
                             background: timer.isUrgent ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)',
                             border: timer.isUrgent ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.08)',
                         }}>
                        <ClockIcon urgent={timer.isUrgent} />
                        <span className="text-sm font-mono font-medium" style={{ color: timer.isUrgent ? '#f87171' : 'rgba(255,255,255,0.7)', letterSpacing:'0.05em' }}>
              {timer.formatted}
            </span>
                    </div>
                </div>
            </div>

            {/* Barre de progression timer */}
            <div className="h-0.5 rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full transition-all duration-1000"
                     style={{
                         width: `${timer.pct}%`,
                         background: timer.isUrgent ? 'rgba(239,68,68,0.7)' : 'rgba(251,191,36,0.5)',
                     }} />
            </div>

            {/* Liste des questions */}
            <div className="flex flex-col gap-5">
                {questions.map((q, qi) => {
                    const selected = answers[String(qi)]
                    const diff = DIFF_COLORS[q.difficulty] || DIFF_COLORS.medium
                    return (
                        <div key={qi} className="rounded-2xl p-6 flex flex-col gap-4"
                             style={{ background:'rgba(255,255,255,0.03)', border:`1px solid ${selected !== undefined ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.07)'}` }}>

                            {/* En-tête question */}
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium"
                        style={{ background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.4)' }}>
                    {qi + 1}
                  </span>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {q.domain && (
                                        <span className="text-xs px-2 py-0.5 rounded" style={{ background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.3)' }}>
                      {q.domain}
                    </span>
                                    )}
                                    <span className="text-xs px-2 py-0.5 rounded capitalize" style={{ background: diff.bg, border:`1px solid ${diff.border}`, color: diff.text }}>
                    {q.difficulty}
                  </span>
                                </div>
                            </div>

                            <p className="text-base leading-relaxed" style={{ color:'rgba(255,255,255,0.88)' }}>
                                {q.question}
                            </p>

                            {/* Options */}
                            <div className="flex flex-col gap-2">
                                {q.options.map((opt, oi) => {
                                    const isSelected = selected === oi
                                    return (
                                        <button key={oi} onClick={() => onSelect(qi, oi)} disabled={submitting}
                                                className="flex items-center gap-4 px-4 py-3 rounded-xl text-left transition-all duration-150 w-full"
                                                style={{
                                                    background: isSelected ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.03)',
                                                    border: isSelected ? '1px solid rgba(251,191,36,0.35)' : '1px solid rgba(255,255,255,0.06)',
                                                    cursor: submitting ? 'not-allowed' : 'pointer',
                                                }}>
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 transition-all duration-150"
                            style={{
                                background: isSelected ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.06)',
                                border: isSelected ? '1px solid rgba(251,191,36,0.5)' : '1px solid rgba(255,255,255,0.1)',
                                color: isSelected ? '#fbbf24' : 'rgba(255,255,255,0.35)',
                            }}>
                        {OPTION_LABELS[oi]}
                      </span>
                                            <span className="text-sm leading-relaxed" style={{ color: isSelected ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.65)' }}>
                        {opt}
                      </span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Bouton soumission */}
            <div className="flex flex-col items-center gap-3 pb-8">
                {!allAnswered && (
                    <p className="text-xs" style={{ color:'rgba(255,255,255,0.3)' }}>
                        {questions.length - answeredCount} question{questions.length - answeredCount > 1 ? 's' : ''} sans réponse
                    </p>
                )}
                <button
                    onClick={onSubmit}
                    disabled={submitting}
                    className="flex items-center gap-3 px-8 py-3 rounded-xl text-sm font-medium transition-all duration-200"
                    style={{
                        background: submitting ? 'rgba(255,255,255,0.04)' : 'rgba(251,191,36,0.15)',
                        border: submitting ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(251,191,36,0.35)',
                        color: submitting ? 'rgba(255,255,255,0.2)' : '#fbbf24',
                        cursor: submitting ? 'not-allowed' : 'pointer',
                    }}>
                    {submitting
                        ? <><span className="w-4 h-4 rounded-full border border-amber-400/40 border-t-amber-400 animate-spin" /> Envoi en cours…</>
                        : <><CheckIcon /> Terminer le QCM</>}
                </button>
            </div>
        </div>
    )
}

function ClockIcon({ urgent }: { urgent: boolean }) {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={urgent ? '#f87171' : 'rgba(255,255,255,0.4)'} strokeWidth="1.8" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
    )
}
function CheckIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
        </svg>
    )
}