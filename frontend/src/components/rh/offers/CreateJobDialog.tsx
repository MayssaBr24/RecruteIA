// components/rh/offers/CreateJobDialog.tsx
import React, { useState } from 'react'
import { Button } from '../../../../components/ui/button'
import { Input } from '../../../../components/ui/input'
import { Textarea } from '../../../../components/ui/textarea'
import { Label } from '../../../../components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '../../../../components/ui/select' // <--- Assure-toi d'avoir ce composant shadcn
import {
    Loader2,
    X,
    PlusCircle,
    Briefcase,
    FileText,
    Tags,
    GraduationCap,
    Users,
    Award,
    Building2,
    MapPin
} from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '../../../../components/ui/dialog'

interface NewJobForm {
    location: string;
    contract_type: string;
    title: string
    description: string
    requirements: string        // <--- Nouveau nom (Backend)
    experience_years: string    // <--- Nouveau
    education_level: string     // <--- Nouveau
    soft_skills: string         // <--- Nouveau
}

interface CreateJobDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    newJob: NewJobForm
    setNewJob: (job: NewJobForm) => void
    onSubmit: (e: React.FormEvent) => Promise<void>
    submitting: boolean
}

export function CreateJobDialog({
                                    open,
                                    onOpenChange,
                                    newJob,
                                    setNewJob,
                                    onSubmit,
                                    submitting
                                }: CreateJobDialogProps) {

    // Helper pour gérer les tags visuels
    const [skillTags, setSkillTags] = useState<string[]>([])
    const [softSkillTags, setSoftSkillTags] = useState<string[]>([])

    // Mise à jour sécurisée des tags (Correction du bug split)
    React.useEffect(() => {
        // Vérifie que la chaîne existe avant de faire split
        const reqString = newJob.requirements || "";
        const softString = newJob.soft_skills || "";

        setSkillTags(reqString.split(',').map(s => s.trim()).filter(s => s))
        setSoftSkillTags(softString.split(',').map(s => s.trim()).filter(s => s))
    }, [newJob.requirements, newJob.soft_skills])
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-background border-0 max-w-3xl p-0 overflow-hidden shadow-2xl shadow-purple-500/10 animate-in zoom-in-95 duration-300">

                {/* Gradient Header */}
                <div className="relative bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-500 p-8">
                    <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
                    <div className="relative z-10">
                        <DialogHeader>
                            <div className="space-y-1 text-left">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-xl">
                                            <PlusCircle className="w-8 h-8 text-white" />
                                        </div>
                                        <div>
                                            <DialogTitle>
                                                <span className="text-2xl font-bold text-white">
                                                    Créer une nouvelle offre
                                                </span>
                                            </DialogTitle>
                                            <DialogDescription>
                                                <span className="block text-white/80 text-base">
                                                    Définissez les critères précis pour un matching IA optimal
                                                </span>
                                            </DialogDescription>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => onOpenChange(false)}
                                        className="p-2 rounded-full hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
                                    >
                                        <X className="h-6 w-6 text-white" />
                                        <span className="sr-only">Fermer</span>
                                    </button>
                                </div>
                            </div>
                        </DialogHeader>
                    </div>
                </div>

                {/* Form Content */}
                <form onSubmit={onSubmit} className="p-8 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">

                    {/* 1. TITRE */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Briefcase className="w-5 h-5 text-purple-600" />
                            <Label htmlFor="job_title" className="text-base font-semibold">Titre du poste *</Label>
                        </div>
                        <Input
                            id="job_title"
                            placeholder="Ex: Ingénieur Data Scientist Senior"
                            value={newJob.title}
                            onChange={(e) => setNewJob({ ...newJob, title: e.target.value })}
                            required
                            className="h-12 rounded-xl"
                        />
                    </div>

                    {/* 2. DESCRIPTION */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-600" />
                            <Label htmlFor="description" className="text-base font-semibold">Description détaillée *</Label>
                        </div>
                        <Textarea
                            id="description"
                            placeholder="Missions quotidiennes, contexte du projet, équipe..."
                            value={newJob.description}
                            onChange={(e) => setNewJob({ ...newJob, description: e.target.value })}
                            required
                            rows={4}
                            className="rounded-xl resize-none"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* 3. EXPÉRIENCE */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Users className="w-5 h-5 text-orange-600" />
                                <Label htmlFor="experience" className="text-base font-semibold">Expérience requise (Années) *</Label>
                            </div>
                            <Select onValueChange={(val) => setNewJob({ ...newJob, experience_years: val })} defaultValue="0">
                                <SelectTrigger className="h-12 rounded-xl">
                                    <SelectValue placeholder="Sélectionner..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0">Débutant / Junior</SelectItem>
                                    <SelectItem value="1">1 an</SelectItem>
                                    <SelectItem value="2">2 ans</SelectItem>
                                    <SelectItem value="3">3 ans</SelectItem>
                                    <SelectItem value="5">5 ans (Senior)</SelectItem>
                                    <SelectItem value="10">10 ans+ (Expert)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* 4. DIPLÔME */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <GraduationCap className="w-5 h-5 text-indigo-600" />
                                <Label htmlFor="education" className="text-base font-semibold">Niveau d'études *</Label>
                            </div>
                            <Select onValueChange={(val) => setNewJob({ ...newJob, education_level: val })} defaultValue="BAC+5">
                                <SelectTrigger className="h-12 rounded-xl">
                                    <SelectValue placeholder="Sélectionner..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="BAC">Baccalauréat</SelectItem>
                                    <SelectItem value="BAC+2">BAC+2 (DUT/BTS)</SelectItem>
                                    <SelectItem value="BAC+3">Licence (BAC+3)</SelectItem>
                                    <SelectItem value="BAC+5">Master / Ingénieur (BAC+5)</SelectItem>
                                    <SelectItem value="PHD">Doctorat</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* 5. COMPÉTENCES TECHNIQUES (CRUCIAL POUR L'IA) */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Tags className="w-5 h-5 text-green-600" />
                            <Label htmlFor="requirements" className="text-base font-semibold">Compétences Techniques (Hard Skills) *</Label>
                        </div>
                        <Textarea
                            id="requirements"
                            placeholder="Python, Django, React, PostgreSQL, Docker... (séparés par des virgules)"
                            value={newJob.requirements}
                            onChange={(e) => setNewJob({ ...newJob, requirements: e.target.value })}
                            required
                            className="min-h-[80px] rounded-xl"
                        />
                        {/* Preview Tags */}
                        {skillTags.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-2">
                                {skillTags.map((skill, i) => (
                                    <span key={i} className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold border border-green-200">
                                        {skill}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 6. SOFT SKILLS */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Award className="w-5 h-5 text-pink-600" />
                            <Label htmlFor="soft_skills" className="text-base font-semibold">Soft Skills</Label>
                        </div>
                        <Textarea
                            id="soft_skills"
                            placeholder="Esprit d'équipe, Communication, Gestion de projet, Autonomie..."
                            value={newJob.soft_skills}
                            onChange={(e) => setNewJob({ ...newJob, soft_skills: e.target.value })}
                            className="min-h-[80px] rounded-xl"
                        />
                        {softSkillTags.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-2">
                                {softSkillTags.map((skill, i) => (
                                    <span key={i} className="px-3 py-1 bg-pink-100 text-pink-700 rounded-full text-xs font-semibold border border-pink-200">
                                        {skill}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Stats Footer */}
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900">
                            <p className="text-xs text-muted-foreground font-bold uppercase">Compétences</p>
                            <p className="text-lg font-bold text-green-600">{skillTags.length}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900">
                            <p className="text-xs text-muted-foreground font-bold uppercase">Soft Skills</p>
                            <p className="text-lg font-bold text-pink-600">{softSkillTags.length}</p>
                        </div>
                    </div>

                    {/* --- AJOUTER CE BLOC --- */}
                    {/* Localisation & Contrat */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-blue-600" />
                                <Label htmlFor="location" className="text-base font-semibold">Lieu de travail *</Label>
                            </div>
                            <Input
                                id="location"
                                placeholder="Ex: Tunis, Paris, Télétravail"
                                value={newJob.location || ""}
                                onChange={(e) => setNewJob({ ...newJob, location: e.target.value })}
                                required
                                className="h-12 rounded-xl"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Building2 className="w-5 h-5 text-purple-600" />
                                <Label htmlFor="contract_type" className="text-base font-semibold">Type de contrat *</Label>
                            </div>
                            <Select onValueChange={(val) => setNewJob({ ...newJob, contract_type: val })} defaultValue="CDI">
                                <SelectTrigger className="h-12 rounded-xl">
                                    <SelectValue placeholder="Sélectionner..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="CDI">CDI</SelectItem>
                                    <SelectItem value="CDD">CDD</SelectItem>
                                    <SelectItem value="Freelance">Freelance</SelectItem>
                                    <SelectItem value="Stage">Stage</SelectItem>
                                    <SelectItem value="Alternance">Alternance</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-4 pt-6">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="flex-1 h-12 rounded-xl font-bold"
                        >
                            Annuler
                        </Button>
                        <Button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 h-12 bg-gradient-to-r from-purple-600 to-blue-600 hover:scale-[1.02] active:scale-[0.98] transition-all text-white rounded-xl font-bold shadow-lg"
                        >
                            {submitting ? (
                                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Publication...</>
                            ) : (
                                "Publier l'offre"
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}