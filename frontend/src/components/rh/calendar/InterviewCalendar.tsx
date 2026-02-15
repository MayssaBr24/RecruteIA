// components/rh/calendar/CombinedCalendar.tsx
import { useState } from 'react'
import { Card } from '../../../../components/ui/card'
import { Button } from '../../../../components/ui/button'
import { Input } from '../../../../components/ui/input'
import { Label } from '../../../../components/ui/label'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "../../../../components/ui/dialog"
import { useInterviewPlanning } from '../../../hooks/useInterviewPlanning'
import {
    format,
    isSameDay,
    parseISO,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    addDays,
    eachDayOfInterval,
    getDay
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { Clock, Plus, Trash2, CalendarRange, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react'

export function InterviewCalendar() {
    const {
        availabilities,
        exceptions,
        deleteAvailability,
        addAvailability,
        addException,
        deleteException
    } = useInterviewPlanning()

    const [selectedDate, setSelectedDate] = useState(new Date())
    const [showTimeForm, setShowTimeForm] = useState(false)
    const [isRecurring, setIsRecurring] = useState(false)
    const [newSlot, setNewSlot] = useState({ start_time: "09:00", end_time: "17:00" })

    // États pour le Modal de suppression
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [itemToDelete, setItemToDelete] = useState<any>(null)

    // --- LOGIQUE CALENDRIER ---
    const monthStart = startOfMonth(selectedDate)
    const monthEnd = endOfMonth(monthStart)
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate })

    const getDjangoDayNum = (date: Date) => {
        const jsDay = getDay(date);
        return jsDay === 0 ? 6 : jsDay - 1;
    }

    // Vérifier si le jour sélectionné est annulé (Exception)
    const currentException = exceptions?.find((ex: any) => isSameDay(parseISO(ex.date), selectedDate));

    // Filtrer les créneaux ACTIFS (Non annulés)
    const activeDayAvails = (availabilities as any[]).filter(a => {
        if (currentException) return false;
        const sameSpecific = a.specific_date && isSameDay(parseISO(a.specific_date), selectedDate);
        const sameRecurring = a.day_of_week === getDjangoDayNum(selectedDate) && !a.specific_date;
        return sameSpecific || sameRecurring;
    });

    // Créneaux MASQUÉS (À réactiver)
    const maskedRecurringAvails = (availabilities as any[]).filter(a =>
        !a.specific_date && a.day_of_week === getDjangoDayNum(selectedDate)
    );

    const handleAddSlot = async () => {
        try {
            const payload: any = {
                start_time: newSlot.start_time,
                end_time: newSlot.end_time,
                specific_date: isRecurring ? null : format(selectedDate, 'yyyy-MM-dd'),
                day_of_week: isRecurring ? getDjangoDayNum(selectedDate) : null
            };
            await addAvailability(payload);
            setShowTimeForm(false);
        } catch (error) { console.error(error); }
    }

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        if (itemToDelete.specific_date) {
            await deleteAvailability(itemToDelete.id);
        } else {
            await addException({ date: format(selectedDate, 'yyyy-MM-dd') });
        }
        setIsDeleteModalOpen(false);
        setItemToDelete(null);
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* CALENDRIER GAUCHE */}
                <Card className="lg:col-span-8 p-6 bg-white shadow-sm border-none">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold capitalize flex items-center gap-2">
                            <CalendarRange className="text-blue-600" />
                            {format(selectedDate, 'MMMM yyyy', { locale: fr })}
                        </h2>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setSelectedDate(addDays(selectedDate, -30))}>Précédent</Button>
                            <Button variant="outline" size="sm" onClick={() => setSelectedDate(addDays(selectedDate, 30))}>Suivant</Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-7 gap-px bg-slate-100 border rounded-xl overflow-hidden">
                        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
                            <div key={d} className="bg-slate-50 p-3 text-center text-[10px] font-black text-slate-400 uppercase">{d}</div>
                        ))}
                        {calendarDays.map((day, idx) => {
                            const isExcluded = exceptions?.some((ex: any) => isSameDay(parseISO(ex.date), day));
                            const hasAvail = !isExcluded && availabilities.some((a: any) =>
                                (a.specific_date && isSameDay(parseISO(a.specific_date), day)) ||
                                (a.day_of_week === getDjangoDayNum(day) && !a.specific_date)
                            );

                            return (
                                <div key={idx} onClick={() => setSelectedDate(day)}
                                     className={`min-h-[100px] p-2 bg-white border-t border-slate-50 cursor-pointer relative
                                     ${isSameDay(day, selectedDate) ? 'bg-blue-50/50 ring-2 ring-blue-500 ring-inset' : ''}
                                     ${!isSameDay(startOfMonth(day), monthStart) ? 'opacity-20' : ''}`}>
                                    <span className="text-xs font-bold">{format(day, 'd')}</span>
                                    <div className="mt-1 flex flex-col gap-1">
                                        {hasAvail && <div className="w-full h-1.5 bg-emerald-400 rounded-full" />}
                                        {isExcluded && <div className="w-full h-1.5 bg-red-200 rounded-full opacity-50" />}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </Card>

                {/* GESTION DROITE */}
                <Card className="lg:col-span-4 p-6 shadow-xl border-t-4 border-blue-600 bg-white">
                    <h3 className="font-extrabold text-xl text-slate-800 capitalize mb-6">
                        {format(selectedDate, 'EEEE dd MMMM', { locale: fr })}
                    </h3>

                    <div className="space-y-6">
                        {/* SECTION : RÉACTIVATION (Si le jour est annulé) */}
                        {currentException && (
                            <div className="space-y-3 p-4 bg-red-50/50 border border-red-100 rounded-2xl border-dashed">
                                <Label className="text-[10px] font-black text-red-500 uppercase flex items-center gap-2">
                                    <AlertCircle className="w-3 h-3" /> Journée suspendue
                                </Label>
                                {maskedRecurringAvails.map((a: any) => (
                                    <div key={a.id} className="flex items-center justify-between">
                                        <p className="text-sm font-bold text-slate-400 line-through">{a.start_time.slice(0,5)} — {a.end_time.slice(0,5)}</p>
                                        <Button
                                            size="sm"
                                            onClick={() => deleteException(currentException.id)}
                                            className="h-7 text-[10px] font-bold bg-white text-red-600 border border-red-200 hover:bg-red-600 hover:text-white rounded-lg shadow-sm"
                                        >
                                            <RefreshCw className="w-3 h-3 mr-1" /> Réactiver
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* SECTION : PLANNINGS ACTIFS */}
                        <div className="space-y-3">
                            <Label className="text-xs font-black text-slate-500 uppercase tracking-widest">
                                Plannings Actifs
                            </Label>
                            {activeDayAvails.length === 0 && !currentException ? (
                                <div className="p-8 border-2 border-dashed border-slate-100 rounded-2xl text-center">
                                    <p className="text-xs text-slate-400 italic">Aucun horaire défini</p>
                                </div>
                            ) : (
                                activeDayAvails.map((a: any) => (
                                    <div key={a.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:border-blue-300 shadow-sm transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-emerald-50 rounded-lg"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></div>
                                            <div>
                                                <p className="text-sm font-black text-slate-700">{a.start_time.slice(0,5)} — {a.end_time.slice(0,5)}</p>
                                                <span className={`text-[9px] font-black uppercase ${a.specific_date ? 'text-amber-500' : 'text-blue-500'}`}>
                                                    {a.specific_date ? 'Unique' : 'Récurrent'}
                                                </span>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => { setItemToDelete(a); setIsDeleteModalOpen(true); }}
                                            className="text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-full"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* AJOUTER */}
                        {!showTimeForm ? (
                            <Button className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg" onClick={() => setShowTimeForm(true)}>
                                <Plus className="w-5 h-5 mr-2" /> Ajouter un horaire
                            </Button>
                        ) : (
                            <div className="p-4 border-2 border-blue-100 bg-blue-50/30 rounded-2xl space-y-4">
                                <div className="flex gap-2 p-1 bg-slate-200/50 rounded-xl">
                                    <button onClick={() => setIsRecurring(false)} className={`flex-1 py-1 text-[10px] font-bold rounded ${!isRecurring ? 'bg-white shadow-sm' : ''}`}>Unique</button>
                                    <button onClick={() => setIsRecurring(true)} className={`flex-1 py-1 text-[10px] font-bold rounded ${isRecurring ? 'bg-white shadow-sm' : ''}`}>Récurrent</button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <Input type="time" value={newSlot.start_time} onChange={e => setNewSlot({...newSlot, start_time: e.target.value})} className="bg-white" />
                                    <Input type="time" value={newSlot.end_time} onChange={e => setNewSlot({...newSlot, end_time: e.target.value})} className="bg-white" />
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="ghost" className="flex-1 text-xs" onClick={() => setShowTimeForm(false)}>Annuler</Button>
                                    <Button className="flex-1 bg-blue-600" onClick={handleAddSlot}>Sauver</Button>
                                </div>
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            {/* MODAL DE SUPPRESSION */}
            <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
                <DialogContent className="rounded-3xl max-w-[400px]">
                    <DialogHeader className="flex flex-col items-center">
                        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4"><Trash2 className="w-6 h-6" /></div>
                        <DialogTitle className="text-xl font-bold">Confirmer</DialogTitle>
                        <DialogDescription className="text-center">
                            {itemToDelete?.specific_date
                                ? "Voulez-vous supprimer définitivement ce créneau unique ?"
                                : "Souhaitez-vous annuler ce créneau récurrent pour ce jour précis uniquement ?"
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="grid grid-cols-2 gap-3 mt-4">
                        <Button variant="outline" className="rounded-xl font-bold" onClick={() => setIsDeleteModalOpen(false)}>Annuler</Button>
                        <Button variant="destructive" className="rounded-xl font-bold bg-red-600" onClick={confirmDelete}>Confirmer</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}