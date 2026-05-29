
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button }   from '../../../components/ui/button'
import { Input }    from '../../../components/ui/input'
import { Textarea } from '../../../components/ui/textarea'
import { Label }    from '../../../components/ui/label'
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue
} from '../../../components/ui/select'
import {
    Briefcase, FileText, Tags, GraduationCap, Users,
    Award, Building2, MapPin, Sliders, Calendar,
    Loader2, ArrowLeft, Search, Linkedin,
} from 'lucide-react'
import { useToast }      from '../../hooks/use-toast'
import { useRHData, NewJobForm } from '../../hooks/useRHData'
import { CVMatchPanel }  from '../../components/rh/offers/CVMatchPanel'
import api from '../../lib/api'
import {LinkedInSearchPanel} from "../../components/rh/offers/LinkedInSearchPanel.tsx";
// ==============================================
// CONFIG POIDS
// ==============================================

const WEIGHT_FIELDS = [
    { key: 'weight_cv',         label: 'CV',                  color: 'text-purple-400', barColor: 'bg-purple-500',  defaultVal: '0.50' },
    { key: 'weight_motivation', label: 'Lettre motivation',   color: 'text-blue-400',   barColor: 'bg-blue-500',    defaultVal: '0.15' },
    { key: 'weight_softskills', label: 'Soft Skills',         color: 'text-cyan-400',   barColor: 'bg-cyan-500',    defaultVal: '0.10' },
    { key: 'weight_github',     label: 'GitHub / Portfolio',  color: 'text-indigo-400', barColor: 'bg-indigo-500',  defaultVal: '0.25' },
] as const


// ==============================================
// COMPOSANT PRINCIPAL
// ==============================================

export function CreateJobPage() {
    const navigate  = useNavigate()
    const { toast } = useToast()
    const { addJob } = useRHData()

    const [submitting, setSubmitting] = useState(false)
    const [showCVMatch, setShowCVMatch] = useState(false)
    const [showLinkedIn, setShowLinkedIn] = useState(false)
    const [form, setForm] = useState<NewJobForm>({
        title: '',
        description: '',
        requirements: '',
        experience_years: '0',
        education_level: 'BAC+5',
        soft_skills: '',
        location: '',
        contract_type: 'CDI',
        weight_cv: '0.50',
        weight_motivation: '0.15',
        weight_softskills: '0.10',
        weight_github: '0.25',
        offer_deadline: '',
        agents_needed: '1',
        interview_type: 'AI',
        salary_min: '',
        salary_max: '',
        salary_currency: 'EUR',
    })

    const skillTags = (form.requirements || '')
        .split(',').map(s => s.trim()).filter(Boolean)

    const softSkillTags = (form.soft_skills || '')
        .split(',').map(s => s.trim()).filter(Boolean)

    const totalWeights = WEIGHT_FIELDS.reduce((acc, { key, defaultVal }) =>
        acc + parseFloat(form[key] || defaultVal), 0
    )
    const isWeightValid = Math.abs(totalWeights - 1) <= 0.01

    const canSearch = !!(form.title.trim() && form.requirements.trim())

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!form.title || !form.description || !form.requirements) {
            toast({ title: 'Champs manquants', description: 'Remplissez les champs obligatoires', variant: 'destructive' })
            return
        }
        if (!isWeightValid) {
            toast({ title: 'Poids invalides', description: 'La somme des poids doit être 1.00', variant: 'destructive' })
            return
        }

        try {
            setSubmitting(true)
            const response = await api.post('/recruitment/jobs/', {
                ...form,
                weight_cv:         parseFloat(form.weight_cv),
                weight_motivation: parseFloat(form.weight_motivation),
                weight_softskills: parseFloat(form.weight_softskills),
                weight_github:     parseFloat(form.weight_github),
                agents_needed:     parseInt(form.agents_needed),
                experience_years:  parseInt(form.experience_years),
            })
            addJob(response.data)
            toast({ title: '✅ Offre publiée', description: 'L\'offre a été créée avec succès' })
            navigate('/rh/offers')
        } catch {
            toast({ title: 'Erreur', description: 'Erreur lors de la création', variant: 'destructive' })
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="min-h-screen p-6">

            {/* Header page */}
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => navigate('/rh/offers')}
                    className="flex items-center justify-center w-10 h-10
                               rounded-xl bg-slate-800 border border-slate-700
                               text-slate-400 hover:text-white hover:bg-slate-700
                               transition-all"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-white">
                        Nouvelle offre d'emploi
                    </h1>
                    <p className="text-slate-400 text-sm mt-0.5">
                        Définissez les critères pour un matching IA optimal
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                    {/* ── Colonne principale (2/3) ── */}
                    <div className="xl:col-span-2 space-y-6">

                        {/* Titre */}
                        <Section icon={<Briefcase className="w-5 h-5 text-purple-400" />}
                                 title="Titre du poste *">
                            <Input
                                placeholder="Ex: Ingénieur Full Stack Senior"
                                value={form.title}
                                onChange={e => setForm({ ...form, title: e.target.value })}
                                required
                                className="bg-slate-800 border-slate-700 text-white
                                           placeholder:text-slate-500 h-12 rounded-xl
                                           focus:border-purple-500 focus:ring-purple-500/20"
                            />
                        </Section>

                        {/* Description */}
                        <Section icon={<FileText className="w-5 h-5 text-blue-400" />}
                                 title="Description détaillée *">
                            <Textarea
                                placeholder="Missions, contexte du projet, équipe, environnement technique..."
                                value={form.description}
                                onChange={e => setForm({ ...form, description: e.target.value })}
                                required rows={5}
                                className="bg-slate-800 border-slate-700 text-white
                                           placeholder:text-slate-500 rounded-xl
                                           focus:border-purple-500 resize-none"
                            />
                        </Section>

                        {/* Compétences techniques */}
                        <Section icon={<Tags className="w-5 h-5 text-green-400" />}
                                 title="Compétences techniques *">
                            <Textarea
                                placeholder="Python, Django, React, PostgreSQL, Docker..."
                                value={form.requirements}
                                onChange={e => setForm({ ...form, requirements: e.target.value })}
                                required
                                className="bg-slate-800 border-slate-700 text-white
                                           placeholder:text-slate-500 rounded-xl
                                           focus:border-purple-500 min-h-[80px]"
                            />
                            {skillTags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {skillTags.map((s, i) => (
                                        <span key={i}
                                              className="px-3 py-1 bg-green-500/10 text-green-400
                                                       border border-green-500/20 rounded-full
                                                       text-xs font-medium">
                                            {s}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </Section>

                        {/* Soft skills */}
                        <Section icon={<Award className="w-5 h-5 text-pink-400" />}
                                 title="Soft Skills">
                            <Textarea
                                placeholder="Esprit d'équipe, Communication, Autonomie, Leadership..."
                                value={form.soft_skills}
                                onChange={e => setForm({ ...form, soft_skills: e.target.value })}
                                className="bg-slate-800 border-slate-700 text-white
                                           placeholder:text-slate-500 rounded-xl
                                           focus:border-purple-500 min-h-[80px]"
                            />
                            {softSkillTags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {softSkillTags.map((s, i) => (
                                        <span key={i}
                                              className="px-3 py-1 bg-pink-500/10 text-pink-400
                                                       border border-pink-500/20 rounded-full
                                                       text-xs font-medium">
                                            {s}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </Section>

                        {/* Expérience + Diplôme */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Section icon={<Users className="w-5 h-5 text-orange-400" />}
                                     title="Expérience requise">
                                <Select
                                    onValueChange={val => setForm({ ...form, experience_years: val })}
                                    defaultValue="0"
                                >
                                    <SelectTrigger className="bg-slate-800 border-slate-700
                                                              text-white h-12 rounded-xl">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-800 border-slate-700">
                                        <SelectItem value="0">Débutant / Junior</SelectItem>
                                        <SelectItem value="1">1 an</SelectItem>
                                        <SelectItem value="2">2 ans</SelectItem>
                                        <SelectItem value="3">3 ans</SelectItem>
                                        <SelectItem value="5">5 ans (Senior)</SelectItem>
                                        <SelectItem value="10">10 ans+ (Expert)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Section>

                            <Section icon={<GraduationCap className="w-5 h-5 text-indigo-400" />}
                                     title="Niveau d'études">
                                <Select
                                    onValueChange={val => setForm({ ...form, education_level: val })}
                                    defaultValue="BAC+5"
                                >
                                    <SelectTrigger className="bg-slate-800 border-slate-700
                                                              text-white h-12 rounded-xl">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-800 border-slate-700">
                                        <SelectItem value="BAC">Baccalauréat</SelectItem>
                                        <SelectItem value="BAC+2">BAC+2</SelectItem>
                                        <SelectItem value="BAC+3">Licence</SelectItem>
                                        <SelectItem value="BAC+5">Master / Ingénieur</SelectItem>
                                        <SelectItem value="PHD">Doctorat</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Section>
                        </div>

                        {/* Lieu + Contrat + Salaire */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Section icon={<MapPin className="w-5 h-5 text-blue-400" />}
                                     title="Lieu de travail *">
                                <Input
                                    placeholder="Tunis, Paris, Télétravail..."
                                    value={form.location || ''}
                                    onChange={e => setForm({ ...form, location: e.target.value })}
                                    required
                                    className="bg-slate-800 border-slate-700 text-white
                       placeholder:text-slate-500 h-12 rounded-xl
                       focus:border-purple-500"
                                />
                            </Section>

                            <Section icon={<Building2 className="w-5 h-5 text-purple-400" />}
                                     title="Type de contrat *">
                                <Select
                                    onValueChange={val => setForm({ ...form, contract_type: val })}
                                    defaultValue="CDI"
                                >
                                    <SelectTrigger className="bg-slate-800 border-slate-700
                                      text-white h-12 rounded-xl">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-800 border-slate-700">
                                        <SelectItem value="CDI">CDI</SelectItem>
                                        <SelectItem value="CDD">CDD</SelectItem>
                                        <SelectItem value="Freelance">Freelance</SelectItem>
                                        <SelectItem value="Stage">Stage</SelectItem>
                                        <SelectItem value="Alternance">Alternance</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Section>
                        </div>

                        {/* Section Salaire - à ajouter après Lieu/Contrat */}
                        <Section icon={<span className="text-yellow-400">€</span>}
                                 title="Fourchette salariale">
                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-2">
                                    <Label className="text-slate-400 text-xs">Minimum</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        step="1000"
                                        placeholder="35 000"
                                        value={form.salary_min || ''}
                                        onChange={e => setForm({ ...form, salary_min: e.target.value })}
                                        className="bg-slate-800 border-slate-700 text-white
                           h-10 rounded-xl focus:border-purple-500"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-slate-400 text-xs">Maximum</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        step="1000"
                                        placeholder="50 000"
                                        value={form.salary_max || ''}
                                        onChange={e => setForm({ ...form, salary_max: e.target.value })}
                                        className="bg-slate-800 border-slate-700 text-white
                           h-10 rounded-xl focus:border-purple-500"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-slate-400 text-xs">Devise</Label>
                                    <Select
                                        onValueChange={val => setForm({ ...form, salary_currency: val })}
                                        defaultValue="EUR"
                                    >
                                        <SelectTrigger className="bg-slate-800 border-slate-700
                                          text-white h-10 rounded-xl">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-800 border-slate-700">
                                            <SelectItem value="EUR">€ EUR</SelectItem>
                                            <SelectItem value="USD">$ USD</SelectItem>
                                            <SelectItem value="GBP">£ GBP</SelectItem>
                                            <SelectItem value="TND">DT TND</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </Section>

                        {/* Date + Postes + Entretien */}
                        <Section icon={<Calendar className="w-5 h-5 text-blue-400" />}
                                 title="Paramètres de sélection">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-slate-400 text-sm">
                                        Date limite *
                                    </Label>
                                    <Input
                                        type="date"
                                        value={form.offer_deadline || ''}
                                        onChange={e => setForm({ ...form, offer_deadline: e.target.value })}
                                        min={new Date().toISOString().split('T')[0]}
                                        required
                                        className="bg-slate-800 border-slate-700 text-white
                                                   h-12 rounded-xl focus:border-purple-500"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-slate-400 text-sm">
                                        Nombre de postes *
                                    </Label>
                                    <Input
                                        type="number" min="1" max="20"
                                        value={form.agents_needed || '1'}
                                        onChange={e => setForm({ ...form, agents_needed: e.target.value })}
                                        required
                                        className="bg-slate-800 border-slate-700 text-white
                                                   h-12 rounded-xl text-center font-bold
                                                   focus:border-purple-500"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-slate-400 text-sm">
                                        Type d'entretien *
                                    </Label>
                                    <Select
                                        onValueChange={val => setForm({
                                            ...form, interview_type: val as 'RH' | 'AI'
                                        })}
                                        defaultValue="AI"
                                    >
                                        <SelectTrigger className="bg-slate-800 border-slate-700
                                                                  text-white h-12 rounded-xl">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-800 border-slate-700">
                                            <SelectItem value="AI">🤖 Agent IA</SelectItem>
                                            <SelectItem value="RH">👤 RH humain</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </Section>

                        {/* Poids IA */}
                        <Section icon={<Sliders className="w-5 h-5 text-purple-400" />}
                                 title="Poids d'analyse IA"
                                 badge={
                                     <span className={`text-xs font-semibold px-2 py-0.5
                                                       rounded-full ${
                                         isWeightValid
                                             ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                             : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                     }`}>
                                         {totalWeights.toFixed(2)} / 1.00
                                     </span>
                                 }>
                            {!isWeightValid && (
                                <p className="text-xs text-red-400 bg-red-500/10
                                              border border-red-500/20 rounded-lg p-3 mb-3">
                                    ⚠️ La somme des poids doit être égale à 1.00
                                </p>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                {WEIGHT_FIELDS.map(({ key, label, color, defaultVal }) => (
                                    <div key={key} className="space-y-2">
                                        <Label className={`text-sm font-medium ${color}`}>
                                            {label}
                                        </Label>
                                        <div className="flex items-center gap-3">
                                            <Input
                                                type="number" min="0" max="1" step="0.05"
                                                value={form[key] || defaultVal}
                                                onChange={e => setForm({ ...form, [key]: e.target.value })}
                                                className="bg-slate-800 border-slate-700 text-white
                                                           h-10 rounded-xl text-center font-bold
                                                           focus:border-purple-500"
                                            />
                                            <span className="text-sm text-slate-400 w-10 shrink-0">
                                                {Math.round(parseFloat(form[key] || defaultVal) * 100)}%
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Barre proportionnelle */}
                            <div className="flex gap-1 h-2 rounded-full overflow-hidden mt-4">
                                {WEIGHT_FIELDS.map(({ key, barColor, defaultVal }) => (
                                    <div key={key}
                                         className={`${barColor} h-full transition-all duration-300`}
                                         style={{ flex: parseFloat(form[key] || defaultVal) }}
                                    />
                                ))}
                            </div>

                            {/* Légende */}
                            <div className="flex flex-wrap gap-3 mt-2">
                                {WEIGHT_FIELDS.map(({ key, barColor, label, defaultVal }) => (
                                    <div key={key} className="flex items-center gap-1.5">
                                        <div className={`w-2 h-2 rounded-full ${barColor}`} />
                                        <span className="text-xs text-slate-500">
                                            {label} ({Math.round(parseFloat(form[key] || defaultVal) * 100)}%)
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </Section>
                    </div>

                    {/* ── Colonne droite (1/3) ── */}
                    <div className="space-y-6">

                        {/* Résumé offre */}
                        <div className="bg-slate-800/50 border border-slate-700
                                        rounded-2xl p-5 sticky top-6">
                            <h3 className="text-white font-semibold mb-4 text-sm">
                                Résumé de l'offre
                            </h3>

                            <div className="space-y-3">
                                <InfoRow label="Titre"
                                         value={form.title || '—'}
                                         highlight={!!form.title} />
                                <InfoRow label="Lieu"
                                         value={form.location || '—'}
                                         highlight={!!form.location} />
                                <InfoRow label="Contrat"
                                         value={form.contract_type} highlight />
                                <InfoRow label="Salaire"
                                         value={form.salary_min && form.salary_max
                                             ? `${Number(form.salary_min).toLocaleString()} - ${Number(form.salary_max).toLocaleString()} ${form.salary_currency || 'EUR'}`
                                             : form.salary_min
                                                 ? `À partir de ${Number(form.salary_min).toLocaleString()} ${form.salary_currency || 'EUR'}`
                                                 : form.salary_max
                                                     ? `Jusqu'à ${Number(form.salary_max).toLocaleString()} ${form.salary_currency || 'EUR'}`
                                                     : 'Non spécifié'}
                                         highlight={!!(form.salary_min || form.salary_max)} />
                                <InfoRow label="Compétences"
                                         value={skillTags.length > 0 ? `${skillTags.length} définie(s)` : '—'}
                                         highlight={skillTags.length > 0} />
                                <InfoRow label="Entretien"
                                         value={form.interview_type === 'AI' ? '🤖 Agent IA' : '👤 RH humain'}
                                         highlight />
                                <InfoRow label="Deadline"
                                         value={form.offer_deadline
                                             ? new Date(form.offer_deadline).toLocaleDateString('fr-FR')
                                             : '—'}
                                         highlight={!!form.offer_deadline} />
                            </div>

                            {/* Bouton CV Match */}
                            <div className="mt-6 pt-4 border-t border-slate-700">
                                <p className="text-xs text-slate-500 mb-3">
                                    Avant de publier, vérifiez si des anciens
                                    candidats correspondent déjà à ce profil.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setShowCVMatch(true)}
                                    disabled={!canSearch}
                                    className={`w-full flex items-center justify-center
                                               gap-2 px-4 py-3 rounded-xl text-sm
                                               font-medium transition-all border ${
                                        canSearch
                                            ? 'bg-purple-500/10 border-purple-500/30 text-purple-300 hover:bg-purple-500/20 hover:text-purple-200'
                                            : 'bg-slate-700/30 border-slate-700 text-slate-600 cursor-not-allowed'
                                    }`}
                                >
                                    <Search className="w-4 h-4" />
                                    {canSearch
                                        ? 'Chercher dans les anciens CVs'
                                        : 'Remplissez titre + compétences'}
                                </button>
                                {!canSearch && (
                                    <p className="text-xs text-slate-600 text-center mt-2">
                                        Remplissez le titre et les compétences pour activer
                                    </p>
                                )}
                            </div>
                            {/* Bouton LinkedIn Sourcing */}
                            <div className="mt-3">
                                <button
                                    type="button"
                                    onClick={() => setShowLinkedIn(true)}
                                    disabled={!canSearch || !form.location}
                                    className={`w-full flex items-center justify-center
                   gap-2 px-4 py-3 rounded-xl text-sm
                   font-medium transition-all border ${
                                        canSearch && form.location
                                            ? 'bg-blue-500/10 border-blue-500/30 text-blue-300 hover:bg-blue-500/20 hover:text-blue-200'
                                            : 'bg-slate-700/30 border-slate-700 text-slate-600 cursor-not-allowed'
                                    }`}
                                >
                                    <Linkedin className="w-4 h-4" />
                                    Rechercher depuis LinkedIn
                                </button>
                                {(!canSearch || !form.location) && (
                                    <p className="text-xs text-slate-600 text-center mt-2">
                                        Remplissez titre, compétences et lieu pour activer
                                    </p>
                                )}
                            </div>

                            {/* Boutons action */}
                            <div className="mt-4 space-y-3">
                                <Button
                                    type="submit"
                                    disabled={submitting || !isWeightValid}
                                    className="w-full h-12 bg-gradient-to-r from-purple-600
                                               to-blue-600 hover:from-purple-700 hover:to-blue-700
                                               text-white rounded-xl font-bold shadow-lg
                                               shadow-purple-900/30 disabled:opacity-50
                                               transition-all"
                                >
                                    {submitting ? (
                                        <><Loader2 className="w-4 h-4 animate-spin mr-2" />
                                            Publication...</>
                                    ) : 'Publier l\'offre'}
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => navigate('/rh/offers')}
                                    className="w-full h-10 text-slate-400 hover:text-white
                                               hover:bg-slate-800 rounded-xl"
                                >
                                    Annuler
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </form>

            {/* Modal CV Match */}
            {showCVMatch && (
                <CVMatchPanel
                    title={form.title}
                    requirements={form.requirements}
                    softSkills={form.soft_skills}
                    experienceYears={form.experience_years}
                    educationLevel={form.education_level}
                    onClose={() => setShowCVMatch(false)}
                />
            )}
            {showLinkedIn && (
                <LinkedInSearchPanel
                    jobTitle={form.title}
                    location={form.location || ''}
                    requirements={form.requirements}
                    onClose={() => setShowLinkedIn(false)}
                    onImport={(profiles) => {
                        console.log('Profils importés:', profiles)
                        // Étape 2 : ici on enrichira les profils
                    }}
                />
            )}
        </div>
    )
}

// ==============================================
// SOUS-COMPOSANTS
// ==============================================

function Section({
                     icon, title, badge, children
                 }: {
    icon: React.ReactNode
    title: string
    badge?: React.ReactNode
    children: React.ReactNode
}) {
    return (
        <div className="bg-slate-800/50 border border-slate-700
                        rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {icon}
                    <h3 className="text-white font-semibold text-sm">{title}</h3>
                </div>
                {badge}
            </div>
            {children}
        </div>
    )
}

function InfoRow({
                     label, value, highlight
                 }: {
    label: string
    value: string
    highlight?: boolean
}) {
    return (
        <div className="flex items-center justify-between py-1.5
                        border-b border-slate-700/50 last:border-0">
            <span className="text-xs text-slate-500">{label}</span>
            <span className={`text-xs font-medium max-w-[60%] text-right truncate ${
                highlight ? 'text-white' : 'text-slate-600'
            }`}>
                {value}
            </span>
        </div>
    )
}