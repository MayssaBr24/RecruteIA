
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    ArrowLeft, Download, Mail, Phone, MapPin, Calendar,
    GraduationCap, DollarSign, Linkedin, Github,
    BrainCircuit, Award, TrendingUp, TrendingDown, Minus,
    Video, FileText, Clock, Send
} from 'lucide-react'
import { useCandidate } from '../../../hooks/useCandidate'
import { InvitationModal } from './InvitationModal'
import { useToast } from '../../../hooks/use-toast'

export function CandidateDetailView() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { toast } = useToast()

    const { loading, candidate, fetchCandidate, createInvitation, sendInvitation } = useCandidate()
    const [showInvitationModal, setShowInvitationModal] = useState(false)
    const [sendingInvitation, setSendingInvitation] = useState(false)

    useEffect(() => {
        if (id) {
            fetchCandidate(Number(id))
        }
    }, [id, fetchCandidate])

    const handleSendInvitation = async (invitationData: any) => {
        setSendingInvitation(true)
        try {
            // Créer l'invitation
            const invitation = await createInvitation(Number(id), invitationData)

            // Envoyer l'invitation
            await sendInvitation(invitation.id)

            toast({
                title: 'Succès',
                description: `L'invitation a été envoyée à ${candidate?.full_name}`,
            })

            setShowInvitationModal(false)
            // Recharger les données pour voir la nouvelle invitation
            await fetchCandidate(Number(id))

        } catch (error) {
            console.error('Erreur envoi invitation:', error)
            toast({
                title: 'Erreur',
                description: "Impossible d'envoyer l'invitation",
                variant: 'destructive'
            })
        } finally {
            setSendingInvitation(false)
        }
    }

    if (loading && !candidate) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
        )
    }

    if (!candidate) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-400">Candidat non trouvé</p>
                <button
                    onClick={() => navigate('/rh/applications')}
                    className="mt-4 text-purple-400 hover:text-purple-300"
                >
                    Retour aux candidatures
                </button>
            </div>
        )
    }

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-emerald-400'
        if (score >= 60) return 'text-blue-400'
        if (score >= 40) return 'text-amber-400'
        return 'text-red-400'
    }

    const getScoreLabel = (score: number) => {
        if (score >= 80) return { label: 'Excellent', icon: <TrendingUp className="w-4 h-4" />, color: 'emerald' }
        if (score >= 60) return { label: 'Bon', icon: <TrendingUp className="w-4 h-4" />, color: 'blue' }
        if (score >= 40) return { label: 'Moyen', icon: <Minus className="w-4 h-4" />, color: 'amber' }
        return { label: 'Faible', icon: <TrendingDown className="w-4 h-4" />, color: 'red' }
    }

    const interviewScore = candidate.ai_interview?.ai_interview_score || 0
    const scoreInfo = getScoreLabel(interviewScore)

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => navigate('/rh/applications')}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                    Retour
                </button>

                <button
                    onClick={() => setShowInvitationModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl text-white font-medium hover:shadow-lg transition-all"
                >
                    <Send className="w-4 h-4" />
                    Inviter à l'entretien final
                </button>
            </div>

            {/* En-tête candidat */}
            <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-2xl p-6 border border-purple-500/20">
                <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold text-white mb-2">{candidate.full_name}</h1>
                        <p className="text-purple-400 mb-4">{candidate.job_offer_title}</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="flex items-center gap-2 text-slate-300">
                                <Mail className="w-4 h-4 text-slate-400" />
                                {candidate.email}
                            </div>
                            <div className="flex items-center gap-2 text-slate-300">
                                <Phone className="w-4 h-4 text-slate-400" />
                                {candidate.phone || 'Non renseigné'}
                            </div>
                            <div className="flex items-center gap-2 text-slate-300">
                                <MapPin className="w-4 h-4 text-slate-400" />
                                {candidate.current_location || 'Non renseigné'}
                            </div>
                            <div className="flex items-center gap-2 text-slate-300">
                                <Calendar className="w-4 h-4 text-slate-400" />
                                Candidature le {new Date(candidate.applied_date).toLocaleDateString('fr-FR')}
                            </div>
                        </div>
                    </div>

                    {/* Score entretien */}
                    <div className="text-center">
                        <div className={`w-32 h-32 rounded-full ring-4 ring-${scoreInfo.color}-500/30 bg-slate-800 flex flex-col items-center justify-center mx-auto`}>
                            <span className={`text-3xl font-bold ${getScoreColor(interviewScore)}`}>{interviewScore}</span>
                            <span className="text-slate-400 text-xs">/100</span>
                        </div>
                        <div className={`flex items-center justify-center gap-1 mt-2 text-${scoreInfo.color}-400`}>
                            {scoreInfo.icon}
                            <span className="text-sm font-medium">{scoreInfo.label}</span>
                        </div>
                        <p className="text-slate-400 text-xs mt-1">Score entretien IA</p>
                    </div>
                </div>
            </div>

            {/* Grille des informations */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Colonne gauche - Infos personnelles */}
                <div className="space-y-6">
                    {/* Informations personnelles */}
                    <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
                        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                            <GraduationCap className="w-5 h-5 text-purple-400" />
                            Formation & Parcours
                        </h3>
                        <div className="space-y-3">
                            <div>
                                <p className="text-slate-400 text-xs">Diplôme</p>
                                <p className="text-white">{candidate.degree_level || 'Non renseigné'}</p>
                            </div>
                            <div>
                                <p className="text-slate-400 text-xs">Établissement</p>
                                <p className="text-white">{candidate.university || 'Non renseigné'}</p>
                            </div>
                            <div>
                                <p className="text-slate-400 text-xs">Année d'obtention</p>
                                <p className="text-white">{candidate.graduation_year || 'Non renseigné'}</p>
                            </div>
                            <div>
                                <p className="text-slate-400 text-xs">Expérience</p>
                                <p className="text-white">{candidate.experience_years} ans</p>
                            </div>
                        </div>
                    </div>

                    {/* Prétentions */}
                    <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
                        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-purple-400" />
                            Prétentions & Disponibilité
                        </h3>
                        <div className="space-y-3">
                            <div>
                                <p className="text-slate-400 text-xs">Salaire souhaité</p>
                                <p className="text-white">{candidate.salary_expectation ? `${candidate.salary_expectation} €/mois` : 'Non renseigné'}</p>
                            </div>
                            <div>
                                <p className="text-slate-400 text-xs">Disponible à partir du</p>
                                <p className="text-white">{candidate.availability_date ? new Date(candidate.availability_date).toLocaleDateString('fr-FR') : 'Non renseigné'}</p>
                            </div>
                            <div>
                                <p className="text-slate-400 text-xs">Nationalité</p>
                                <p className="text-white">{candidate.nationality || 'Non renseigné'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Liens sociaux */}
                    {(candidate.linkedin_url || candidate.github_url) && (
                        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
                            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                                🔗 Profils en ligne
                            </h3>
                            <div className="space-y-2">
                                {candidate.linkedin_url && (
                                    <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer"
                                       className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors">
                                        <Linkedin className="w-4 h-4" />
                                        LinkedIn
                                    </a>
                                )}
                                {candidate.github_url && (
                                    <a href={candidate.github_url} target="_blank" rel="noopener noreferrer"
                                       className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors">
                                        <Github className="w-4 h-4" />
                                        GitHub
                                    </a>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Documents */}
                    <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
                        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-purple-400" />
                            Documents
                        </h3>
                        <div className="space-y-2">
                            <a href={candidate.cv_file} target="_blank" rel="noopener noreferrer"
                               className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors">
                                <Download className="w-4 h-4" />
                                CV
                            </a>
                            {candidate.cover_letter_file && (
                                <a href={candidate.cover_letter_file} target="_blank" rel="noopener noreferrer"
                                   className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors">
                                    <Download className="w-4 h-4" />
                                    Lettre de motivation
                                </a>
                            )}
                        </div>
                    </div>
                </div>

                {/* Colonne centrale - Analyse IA CV */}
                <div className="space-y-6">
                    {/* Score IA CV */}
                    <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
                        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                            <BrainCircuit className="w-5 h-5 text-purple-400" />
                            Analyse IA du CV
                        </h3>

                        <div className="mb-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-slate-400">Score CV</span>
                                <span className={`font-bold ${getScoreColor(candidate.ai_score)}`}>{candidate.ai_score}/100</span>
                            </div>
                            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                <div className={`h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all`}
                                     style={{ width: `${candidate.ai_score}%` }} />
                            </div>
                        </div>

                        <div className="space-y-3">
                            {candidate.ai_strengths && candidate.ai_strengths.length > 0 && (
                                <div>
                                    <p className="text-emerald-400 text-sm font-medium mb-2">✅ Points forts</p>
                                    <ul className="space-y-1">
                                        {candidate.ai_strengths.map((s, i) => (
                                            <li key={i} className="text-slate-300 text-sm">• {s}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {candidate.ai_weaknesses && candidate.ai_weaknesses.length > 0 && (
                                <div>
                                    <p className="text-amber-400 text-sm font-medium mb-2">⚠️ Points à améliorer</p>
                                    <ul className="space-y-1">
                                        {candidate.ai_weaknesses.map((w, i) => (
                                            <li key={i} className="text-slate-300 text-sm">• {w}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {candidate.ai_missing_skills && candidate.ai_missing_skills.length > 0 && (
                                <div>
                                    <p className="text-red-400 text-sm font-medium mb-2">❌ Compétences manquantes</p>
                                    <ul className="space-y-1">
                                        {candidate.ai_missing_skills.map((s, i) => (
                                            <li key={i} className="text-slate-300 text-sm">• {s}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        {candidate.ai_recommendations && (
                            <div className="mt-4 p-3 bg-purple-900/20 rounded-lg">
                                <p className="text-purple-300 text-sm">{candidate.ai_recommendations}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Colonne droite - Entretien IA */}
                <div className="space-y-6">
                    {candidate.ai_interview && (
                        <>
                            {/* Résultats entretien */}
                            <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
                                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                                    <Award className="w-5 h-5 text-purple-400" />
                                    Résultats détaillés
                                </h3>

                                <div className="space-y-3">
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-slate-400">Communication</span>
                                            <span className="text-white">{candidate.ai_interview.communication_score || 0}%</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-500 rounded-full"
                                                 style={{ width: `${candidate.ai_interview.communication_score || 0}%` }} />
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-slate-400">Clarification</span>
                                            <span className="text-white">{candidate.ai_interview.clarification_score || 0}%</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                            <div className="h-full bg-cyan-500 rounded-full"
                                                 style={{ width: `${candidate.ai_interview.clarification_score || 0}%` }} />
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-slate-400">Technique (QCM)</span>
                                            <span className="text-white">{candidate.ai_interview.qcm_score || 0}%</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                            <div className="h-full bg-amber-500 rounded-full"
                                                 style={{ width: `${candidate.ai_interview.qcm_score || 0}%` }} />
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-slate-400">Coding</span>
                                            <span className="text-white">{candidate.ai_interview.coding_score || 0}%</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                            <div className="h-full bg-red-500 rounded-full"
                                                 style={{ width: `${candidate.ai_interview.coding_score || 0}%` }} />
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 p-3 bg-slate-900/50 rounded-lg">
                                    <p className="text-slate-300 text-sm">{candidate.ai_interview.ai_interview_feedback || 'Pas de feedback disponible'}</p>
                                </div>

                                <div className="mt-3 flex items-center justify-between text-sm">
                                    <span className="text-slate-400">Durée totale</span>
                                    <span className="text-white">{candidate.ai_interview.duration_minutes || 0} minutes</span>
                                </div>
                            </div>

                            {/* Vidéo */}
                            {candidate.ai_interview.video_recording && (
                                <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
                                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                                        <Video className="w-5 h-5 text-purple-400" />
                                        Enregistrement vidéo
                                    </h3>
                                    <video
                                        src={candidate.ai_interview.video_recording}
                                        controls
                                        className="w-full rounded-lg"
                                    />
                                </div>
                            )}
                        </>
                    )}

                    {!candidate.ai_interview && (
                        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700 text-center">
                            <BrainCircuit className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                            <p className="text-slate-400">Aucun entretien IA réalisé</p>
                            <p className="text-slate-500 text-sm mt-1">Le candidat n'a pas encore passé l'entretien</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Historique des invitations */}
            {candidate.interview_invitations && candidate.interview_invitations.length > 0 && (
                <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-purple-400" />
                        Historique des invitations
                    </h3>
                    <div className="space-y-3">
                        {candidate.interview_invitations.map(inv => (
                            <div key={inv.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                                <div>
                                    <p className="text-white text-sm">
                                        {new Date(inv.interview_date).toLocaleDateString('fr-FR')} à {inv.interview_time}
                                    </p>
                                    <p className="text-slate-400 text-xs">Interviewer: {inv.interviewer_name}</p>
                                    {inv.meeting_link && (
                                        <a href={inv.meeting_link} target="_blank" rel="noopener noreferrer"
                                           className="text-purple-400 text-xs hover:underline">
                                            Lien de visio
                                        </a>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {inv.status === 'pending' && <span className="text-slate-400 text-xs">En attente</span>}
                                    {inv.status === 'sent' && <span className="text-amber-400 text-xs">Envoyée</span>}
                                    {inv.status === 'accepted' && <span className="text-emerald-400 text-xs">Acceptée</span>}
                                    {inv.status === 'declined' && <span className="text-red-400 text-xs">Refusée</span>}
                                    {inv.status === 'cancelled' && <span className="text-slate-400 text-xs">Annulée</span>}
                                    {inv.sent_at && (
                                        <span className="text-slate-500 text-xs">
                                            {new Date(inv.sent_at).toLocaleDateString('fr-FR')}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Modal d'invitation */}
            <InvitationModal
                isOpen={showInvitationModal}
                onClose={() => setShowInvitationModal(false)}
                onSend={handleSendInvitation}
                candidateName={candidate.full_name}
                isLoading={sendingInvitation}
            />
        </div>
    )
}