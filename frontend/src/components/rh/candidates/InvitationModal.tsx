import { useState } from 'react'
import { X, Calendar, Clock, User, Video } from 'lucide-react'

interface InvitationModalProps {
    isOpen: boolean
    onClose: () => void
    onSend: (data: {
        interview_date: string
        interview_time: string
        meeting_link: string
        interviewer_name: string
    }) => void
    candidateName: string
    isLoading: boolean
}

export function InvitationModal({ isOpen, onClose, onSend, candidateName, isLoading }: InvitationModalProps) {
    const [formData, setFormData] = useState({
        interview_date: '',
        interview_time: '',
        meeting_link: '',
        interviewer_name: ''
    })

    if (!isOpen) return null

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        onSend(formData)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-md mx-4 shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-700">
                    <h2 className="text-white font-bold text-lg">Inviter à l'entretien final</h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <p className="text-slate-300 text-sm mb-4">
                        Envoyer une invitation à <strong className="text-purple-400">{candidateName}</strong>
                    </p>

                    {/* Date */}
                    <div>
                        <label className="block text-slate-400 text-sm mb-2 flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Date de l'entretien
                        </label>
                        <input
                            type="date"
                            required
                            value={formData.interview_date}
                            onChange={(e) => setFormData({ ...formData, interview_date: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                        />
                    </div>

                    {/* Heure */}
                    <div>
                        <label className="block text-slate-400 text-sm mb-2 flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Heure
                        </label>
                        <input
                            type="time"
                            required
                            value={formData.interview_time}
                            onChange={(e) => setFormData({ ...formData, interview_time: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                        />
                    </div>

                    {/* Lien visio / Lieu */}
                    <div>
                        <label className="block text-slate-400 text-sm mb-2 flex items-center gap-2">
                            <Video className="w-4 h-4" />
                            Lien visioconférence ou adresse
                        </label>
                        <input
                            type="url"
                            required
                            placeholder="https://meet.google.com/... ou 123 Rue Example"
                            value={formData.meeting_link}
                            onChange={(e) => setFormData({ ...formData, meeting_link: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                        />
                    </div>

                    {/* Interviewer */}
                    <div>
                        <label className="block text-slate-400 text-sm mb-2 flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Nom de l'interviewer
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="Nom du recruteur"
                            value={formData.interviewer_name}
                            onChange={(e) => setFormData({ ...formData, interviewer_name: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                        />
                    </div>

                    {/* Boutons */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:shadow-lg transition-all disabled:opacity-50"
                        >
                            {isLoading ? 'Envoi...' : "Envoyer l'invitation"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}