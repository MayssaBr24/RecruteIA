
import { useState, useEffect, useCallback } from 'react'
import { Card }   from '../../../../components/ui/card'
import { Badge }  from '../../../../components/ui/badge'
import { Input }  from '../../../../components/ui/input'
import { Button } from '../../../../components/ui/button'
import {
    Dialog, DialogContent, DialogDescription,
    DialogFooter, DialogHeader, DialogTitle,
} from '../../../../components/ui/dialog'
import {
    format, isSameDay, parseISO, isSameMonth,
    startOfMonth, endOfMonth, startOfWeek, endOfWeek,
    addMonths, subMonths, eachDayOfInterval, getDay, isToday,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import {
    ChevronLeft, ChevronRight, Plus, Trash2, RefreshCw,
    Clock, BrainCircuit, AlertCircle, CheckCircle2,
    CalendarDays, StickyNote, Bell, TrendingUp,
    TrendingDown, Users, Briefcase, Minus, X,
    AlertTriangle, Info, Zap,
} from 'lucide-react'
import {
    useInterviewPlanning,
    Availability, Exception,
} from '../../../hooks/useInterviewPlanning'
import api from '../../../lib/api'

// ══════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════

type NoteLevel = 'info' | 'warning' | 'urgent'

interface RHNote {
    id:                  number
    date:                string
    content:             string
    level:               NoteLevel
    notify_at:           string | null
    linked_offer_title:  string | null
}

interface Notification {
    type:    string
    level:   'info' | 'warning' | 'success' | 'urgent'
    title:   string
    message: string
    date:    string
}

interface WeekStats {
    new_applications:   number
    interviews_done:    number
    avg_score:          number
    active_offers:      number
    conversion_rate:    number
    trend_pct:          number
}

interface OfferTimeline {
    id:         number
    title:      string
    contract:   string | null
    department: string | null
    deadline:   string | null
    days_left:  number | null
    is_expired: boolean
    stats: {
        total:       number
        screened:    number
        interviewed: number
        hired:       number
    }
    progress: number
    stage:    string
}

interface AIInterviewCalendar {
    id:             number
    candidate_name: string
    job_title:      string
    scheduled_date: string
    scheduled_time: string | null
    status:         string
    score:          number | null
}

type EventType = 'availability' | 'interview_ai' | 'note'

interface DayEvent {
    id:        string
    type:      EventType
    label:     string
    time?:     string
    dotColor:  string
    bgColor:   string
    textColor: string
    avail?:    Availability
    interview?: AIInterviewCalendar
    note?:     RHNote
}

interface DeleteTarget {
    type:  'availability'
    avail: Availability
}

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════

const getDjangoDayNum = (d: Date): number => {
    const jsDay = getDay(d)
    return jsDay === 0 ? 6 : jsDay - 1
}

const NOTE_CFG: Record<NoteLevel, { bg: string; text: string; border: string; emoji: string }> = {
    info:    { bg: 'bg-blue-500/10',  text: 'text-blue-400',  border: 'border-blue-500/30',  emoji: '💬' },
    warning: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', emoji: '⚠️' },
    urgent:  { bg: 'bg-red-500/10',   text: 'text-red-400',   border: 'border-red-500/30',   emoji: '🔴' },
}

const STAGE_CFG: Record<string, { label: string; color: string }> = {
    published:    { label: 'Publiée',      color: 'bg-slate-500'  },
    applications: { label: 'Candidatures', color: 'bg-blue-500'   },
    screening:    { label: 'Présélection', color: 'bg-purple-500' },
    interviews:   { label: 'Entretiens',   color: 'bg-amber-500'  },
    hired:        { label: 'Recruté ✓',    color: 'bg-emerald-500'},
}

const NOTIF_CFG: Record<string, { bg: string; text: string; border: string }> = {
    warning: { bg: 'bg-amber-500/10',  text: 'text-amber-300',  border: 'border-amber-500/20'  },
    info:    { bg: 'bg-blue-500/10',   text: 'text-blue-300',   border: 'border-blue-500/20'   },
    success: { bg: 'bg-emerald-500/10',text: 'text-emerald-300',border: 'border-emerald-500/20'},
    urgent:  { bg: 'bg-red-500/10',    text: 'text-red-300',    border: 'border-red-500/20'    },
}

// ══════════════════════════════════════════════
// STAT CARD
// ══════════════════════════════════════════════

function StatCard({
                      label, value, trend, icon: Icon, color,
                  }: {
    label:  string
    value:  string | number
    trend?: number
    icon:   React.ElementType
    color:  string
}) {
    return (
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500">{label}</span>
                <div className={`w-7 h-7 rounded-lg ${color} flex items-center justify-center`}>
                    <Icon className="w-3.5 h-3.5 text-white" />
                </div>
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
            {trend !== undefined && (
                <div className="flex items-center gap-1 mt-1">
                    {trend > 0  && <TrendingUp   className="w-3 h-3 text-emerald-400" />}
                    {trend < 0  && <TrendingDown className="w-3 h-3 text-red-400" />}
                    {trend === 0 && <Minus        className="w-3 h-3 text-slate-500" />}
                    <span className={`text-xs font-medium ${
                        trend > 0 ? 'text-emerald-400' : trend < 0 ? 'text-red-400' : 'text-slate-500'
                    }`}>
                        {trend === 0 ? 'Stable' : `${trend > 0 ? '+' : ''}${trend}% vs sem. préc.`}
                    </span>
                </div>
            )}
        </div>
    )
}

// ══════════════════════════════════════════════
// OFFER TIMELINE CARD
// ══════════════════════════════════════════════

function OfferTimelineCard({ offer }: { offer: OfferTimeline }) {
    const stage = STAGE_CFG[offer.stage] ?? STAGE_CFG['published']
    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4
                        hover:border-slate-600 transition-all">
            <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-semibold truncate">{offer.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {offer.contract && (
                            <span className="text-xs text-slate-500">{offer.contract}</span>
                        )}
                        <Badge className={`text-xs px-2 py-0 ${stage.color} text-white border-0`}>
                            {stage.label}
                        </Badge>
                    </div>
                </div>
                {offer.days_left !== null && (
                    <span className={`text-xs shrink-0 px-2 py-1 rounded-full font-medium ${
                        offer.is_expired
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : offer.days_left <= 3
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-slate-700/50 text-slate-400'
                    }`}>
                        {offer.is_expired ? 'Expirée' : `J-${offer.days_left}`}
                    </span>
                )}
            </div>

            {/* Barre progression */}
            <div className="w-full bg-slate-700 rounded-full h-1.5 mb-3">
                <div className={`h-1.5 rounded-full transition-all ${stage.color}`}
                     style={{ width: `${offer.progress}%` }} />
            </div>

            {/* Funnel stats */}
            <div className="grid grid-cols-4 gap-1 text-center">
                {[
                    { label: 'Candidats',  value: offer.stats.total       },
                    { label: 'Présélec.',  value: offer.stats.screened    },
                    { label: 'Entretiens', value: offer.stats.interviewed },
                    { label: 'Recrutés',   value: offer.stats.hired       },
                ].map(s => (
                    <div key={s.label}
                         className="bg-slate-900/40 rounded-lg py-2">
                        <p className="text-white font-bold text-sm">{s.value}</p>
                        <p className="text-slate-500 text-xs">{s.label}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ══════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ══════════════════════════════════════════════

export function InterviewCalendar() {
    const {
        availabilities, exceptions,
        addAvailability, deleteAvailability,
        addException, deleteException,
    } = useInterviewPlanning()

    // ── State ──────────────────────────────────
    const [currentMonth, setCurrentMonth]    = useState(new Date())
    const [selectedDate, setSelectedDate]    = useState(new Date())
    const [activeTab, setActiveTab]          = useState<'calendar' | 'timeline'>('calendar')
    const [showSlotForm, setShowSlotForm]    = useState(false)
    const [showNoteForm, setShowNoteForm]    = useState(false)
    const [isRecurring, setIsRecurring]      = useState(false)
    const [slotError, setSlotError]          = useState('')
    const [newSlot, setNewSlot]              = useState({ start_time: '09:00', end_time: '17:00' })
    const [newNote, setNewNote]              = useState({ content: '', level: 'info' as NoteLevel, notify_at: '' })
    const [notes, setNotes]                  = useState<RHNote[]>([])
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [weekStats, setWeekStats]          = useState<WeekStats | null>(null)
    const [timeline, setTimeline]            = useState<OfferTimeline[]>([])
    const [aiInterviews, setAiInterviews]    = useState<AIInterviewCalendar[]>([])
    const [deleteModal, setDeleteModal]      = useState<{ open: boolean; target: DeleteTarget | null }>({
        open: false, target: null,
    })

    // ── Chargement ─────────────────────────────
    const loadData = useCallback(async () => {
        try {
            const [calRes, notifRes, statsRes, timelineRes] = await Promise.all([
                api.get('/recruitment/rh/calendar/'),
                api.get('/recruitment/rh/notifications/'),
                api.get('/recruitment/rh/week-stats/'),
                api.get('/recruitment/rh/offer-timeline/'),
            ])
            setNotes(calRes.data.notes ?? [])
            setAiInterviews(calRes.data.ai_interviews ?? [])
            setNotifications(notifRes.data ?? [])
            setWeekStats(statsRes.data)
            setTimeline(timelineRes.data ?? [])
        } catch (err) {
            console.error('Erreur chargement calendrier:', err)
        }
    }, [])

    useEffect(() => { loadData() }, [loadData])

    // ── Calendrier ─────────────────────────────
    const monthStart   = startOfMonth(currentMonth)
    const monthEnd     = endOfMonth(currentMonth)
    const calStart     = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calEnd       = endOfWeek(monthEnd, { weekStartsOn: 1 })
    const calendarDays = eachDayOfInterval({ start: calStart, end: calEnd })

    const getEventsForDay = (day: Date): DayEvent[] => {
        const events: DayEvent[] = []
        const dayStr   = format(day, 'yyyy-MM-dd')
        const excluded = exceptions.some(
            (ex: Exception) => isSameDay(parseISO(ex.date), day)
        )

        if (!excluded) {
            availabilities.forEach((a: Availability) => {
                const matchS = !!a.specific_date && isSameDay(parseISO(a.specific_date), day)
                const matchR = a.day_of_week === getDjangoDayNum(day) && !a.specific_date
                if (matchS || matchR) {
                    events.push({
                        id:        `avail-${a.id}`,
                        type:      'availability',
                        label:     `${a.start_time.slice(0,5)} – ${a.end_time.slice(0,5)}`,
                        time:      a.start_time.slice(0,5),
                        dotColor:  'bg-emerald-400',
                        bgColor:   'bg-emerald-500/10',
                        textColor: 'text-emerald-400',
                        avail:     a,
                    })
                }
            })
        }

        aiInterviews.forEach(iv => {
            if (iv.scheduled_date === dayStr) {
                events.push({
                    id:        `iv-${iv.id}`,
                    type:      'interview_ai',
                    label:     iv.candidate_name,
                    time:      iv.scheduled_time?.slice(0,5),
                    dotColor:  'bg-purple-400',
                    bgColor:   'bg-purple-500/10',
                    textColor: 'text-purple-400',
                    interview: iv,
                })
            }
        })

        notes.forEach(n => {
            if (n.date === dayStr) {
                events.push({
                    id:        `note-${n.id}`,
                    type:      'note',
                    label:     n.content.slice(0, 25),
                    dotColor:  'bg-blue-400',
                    bgColor:   'bg-blue-500/10',
                    textColor: 'text-blue-400',
                    note:      n,
                })
            }
        })

        return events
    }

    // ── Données jour sélectionné ───────────────
    const selectedDateStr      = format(selectedDate, 'yyyy-MM-dd')
    const selectedEvents       = getEventsForDay(selectedDate)
    const currentException     = exceptions.find(
        (ex: Exception) => isSameDay(parseISO(ex.date), selectedDate)
    ) as Exception | undefined
    const selectedAvails       = selectedEvents.filter(e => e.type === 'availability')
    const selectedAIInterviews = selectedEvents.filter(e => e.type === 'interview_ai')
    const selectedNotes        = selectedEvents.filter(e => e.type === 'note')

    // ── Handlers ──────────────────────────────
    const handleAddSlot = async () => {
        setSlotError('')
        if (newSlot.start_time >= newSlot.end_time) {
            setSlotError("L'heure de fin doit être après le début")
            return
        }
        try {
            await addAvailability({
                start_time:    newSlot.start_time,
                end_time:      newSlot.end_time,
                specific_date: isRecurring ? null : selectedDateStr,
                day_of_week:   isRecurring ? getDjangoDayNum(selectedDate) : null,
            })
            // Fix bug récurrent : supprimer l'exception si on crée un créneau unique
            if (!isRecurring && currentException) {
                await deleteException(currentException.id)
            }
            setShowSlotForm(false)
            setNewSlot({ start_time: '09:00', end_time: '17:00' })
        } catch (err) {
            setSlotError("Erreur lors de l'ajout")
            console.error(err)
        }
    }

    const handleAddNote = async () => {
        if (!newNote.content.trim()) return
        try {
            await api.post('/recruitment/rh/notes/', {
                date:      selectedDateStr,
                content:   newNote.content,
                level:     newNote.level,
                notify_at: newNote.notify_at || null,
            })
            await loadData()
            setShowNoteForm(false)
            setNewNote({ content: '', level: 'info', notify_at: '' })
        } catch (err) { console.error(err) }
    }

    const handleDeleteNote = async (noteId: number) => {
        try {
            await api.delete(`/recruitment/rh/notes/${noteId}/`)
            setNotes(prev => prev.filter(n => n.id !== noteId))
        } catch (err) { console.error(err) }
    }

    const handleConfirmDelete = async () => {
        const { target } = deleteModal
        if (!target) return
        try {
            if (target.avail.specific_date) {
                await deleteAvailability(target.avail.id)
            } else {
                await addException({ date: selectedDateStr })
            }
        } catch (err) { console.error(err) }
        finally { setDeleteModal({ open: false, target: null }) }
    }

    const handleReactivate = async () => {
        if (!currentException) return
        try { await deleteException(currentException.id) }
        catch (err) { console.error(err) }
    }

    // ══════════════════════════════════════════
    // RENDER
    // ══════════════════════════════════════════

    return (
        <div className="space-y-6">

            {/* Stats semaine */}
            {weekStats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <StatCard label="Candidatures"    value={weekStats.new_applications}  trend={weekStats.trend_pct} icon={Users}        color="bg-purple-600" />
                    <StatCard label="Entretiens IA"   value={weekStats.interviews_done}   icon={BrainCircuit}                              color="bg-blue-600"   />
                    <StatCard label="Score IA moyen"  value={`${weekStats.avg_score}/100`} icon={TrendingUp}                              color="bg-indigo-600" />
                    <StatCard label="Offres actives"  value={weekStats.active_offers}     icon={Briefcase}                                 color="bg-slate-600"  />
                    <StatCard label="Taux conversion" value={`${weekStats.conversion_rate}%`} icon={CheckCircle2}                          color="bg-emerald-600"/>
                </div>
            )}

            {/* Alertes */}
            {notifications.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-amber-400" />
                        <h3 className="text-white font-semibold text-sm">Alertes</h3>
                        <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs">
                            {notifications.length}
                        </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {notifications.map((notif, i) => {
                            const cfg = NOTIF_CFG[notif.level] ?? NOTIF_CFG['info']
                            return (
                                <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${cfg.bg} ${cfg.border}`}>
                                    <div className={`mt-0.5 shrink-0 ${cfg.text}`}>
                                        {notif.level === 'warning' && <AlertTriangle className="w-4 h-4" />}
                                        {notif.level === 'info'    && <Info          className="w-4 h-4" />}
                                        {notif.level === 'success' && <CheckCircle2  className="w-4 h-4" />}
                                        {notif.level === 'urgent'  && <Zap           className="w-4 h-4" />}
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`text-sm font-semibold ${cfg.text}`}>{notif.title}</p>
                                        <p className="text-slate-400 text-xs mt-0.5">{notif.message}</p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Grille principale */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* ── Gauche : Calendrier / Timeline ── */}
                <div className="lg:col-span-8 space-y-4">

                    {/* Onglets */}
                    <div className="flex gap-1 p-1 bg-slate-800 rounded-xl w-fit">
                        {([
                            { key: 'calendar',  label: 'Calendrier',      icon: CalendarDays },
                            { key: 'timeline',  label: 'Timeline offres', icon: TrendingUp   },
                        ] as const).map(tab => (
                            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm
                                           font-medium transition-all ${
                                        activeTab === tab.key
                                            ? 'bg-purple-600 text-white'
                                            : 'text-slate-400 hover:text-white'
                                    }`}>
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Vue calendrier */}
                    {activeTab === 'calendar' && (
                        <Card className="bg-slate-800/50 border-slate-700 overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between p-5 border-b border-slate-700">
                                <div className="flex items-center gap-3">
                                    <CalendarDays className="w-5 h-5 text-purple-400" />
                                    <h2 className="text-white font-bold text-lg capitalize">
                                        {format(currentMonth, 'MMMM yyyy', { locale: fr })}
                                    </h2>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                                            className="w-8 h-8 rounded-lg bg-slate-700 flex items-center
                                                   justify-center text-slate-400 hover:text-white
                                                   hover:bg-slate-600 transition-all">
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => { setCurrentMonth(new Date()); setSelectedDate(new Date()) }}
                                            className="px-3 h-8 rounded-lg bg-slate-700 text-slate-300
                                                   hover:text-white hover:bg-slate-600 text-xs font-medium">
                                        Aujourd'hui
                                    </button>
                                    <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                                            className="w-8 h-8 rounded-lg bg-slate-700 flex items-center
                                                   justify-center text-slate-400 hover:text-white
                                                   hover:bg-slate-600 transition-all">
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Légende */}
                            <div className="flex gap-4 px-5 py-2 border-b border-slate-800 flex-wrap">
                                {[
                                    { dot: 'bg-emerald-400', label: 'Disponibilité' },
                                    { dot: 'bg-purple-400',  label: 'Entretien IA'  },
                                    { dot: 'bg-blue-400',    label: 'Note'          },
                                    { dot: 'bg-red-400',     label: 'Suspendu'      },
                                ].map(l => (
                                    <div key={l.label} className="flex items-center gap-1.5">
                                        <div className={`w-2 h-2 rounded-full ${l.dot}`} />
                                        <span className="text-xs text-slate-500">{l.label}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="p-4">
                                <div className="grid grid-cols-7 mb-2">
                                    {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d => (
                                        <div key={d} className="text-center text-xs font-semibold text-slate-500 uppercase py-2">{d}</div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-1">
                                    {calendarDays.map((day, idx) => {
                                        const evts       = getEventsForDay(day)
                                        const isSelected = isSameDay(day, selectedDate)
                                        const inMonth    = isSameMonth(day, currentMonth)
                                        const todayDay   = isToday(day)
                                        const excluded   = exceptions.some(
                                            (ex: Exception) => isSameDay(parseISO(ex.date), day)
                                        )
                                        return (
                                            <button key={idx} onClick={() => setSelectedDate(day)}
                                                    className={`relative min-h-[70px] p-2 rounded-xl flex flex-col
                                                           items-start transition-all text-left
                                                           ${!inMonth ? 'opacity-20 pointer-events-none' : ''}
                                                           ${isSelected
                                                        ? 'bg-purple-600/20 border border-purple-500/50'
                                                        : 'hover:bg-slate-700/50 border border-transparent'
                                                    }`}>
                                                <span className={`w-7 h-7 flex items-center justify-center
                                                                  rounded-full text-sm font-semibold
                                                                  ${todayDay ? 'bg-purple-600 text-white'
                                                    : isSelected ? 'text-purple-300' : 'text-slate-300'}`}>
                                                    {format(day, 'd')}
                                                </span>
                                                <div className="flex gap-1 mt-1 flex-wrap">
                                                    {excluded && <div className="w-1.5 h-1.5 rounded-full bg-red-400" />}
                                                    {!excluded && evts.some(e => e.type === 'availability') && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                                                    {evts.some(e => e.type === 'interview_ai') && <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />}
                                                    {evts.some(e => e.type === 'note')         && <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                                                </div>
                                                {evts.slice(0, 1).map(ev => (
                                                    <div key={ev.id}
                                                         className={`w-full mt-1 px-1.5 py-0.5 rounded text-xs truncate ${ev.bgColor} ${ev.textColor}`}>
                                                        {ev.time && `${ev.time} `}
                                                        {ev.type === 'interview_ai' ? '🤖' : ev.type === 'note' ? '📝' : ''}
                                                    </div>
                                                ))}
                                                {evts.length > 1 && <span className="text-xs text-slate-500">+{evts.length - 1}</span>}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Vue timeline */}
                    {activeTab === 'timeline' && (
                        <div className="space-y-3">
                            {timeline.length === 0 ? (
                                <Card className="bg-slate-800/50 border-slate-700 p-12 text-center">
                                    <Briefcase className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                                    <p className="text-slate-400">Aucune offre active</p>
                                </Card>
                            ) : (
                                timeline.map(offer => <OfferTimelineCard key={offer.id} offer={offer} />)
                            )}
                        </div>
                    )}
                </div>

                {/* ── Droite : Panneau jour ── */}
                <div className="lg:col-span-4 space-y-4">

                    {/* Header jour */}
                    <Card className="bg-slate-800/50 border-slate-700 p-5">
                        <h3 className="text-white font-bold text-sm capitalize">
                            {format(selectedDate, 'EEEE dd MMMM yyyy', { locale: fr })}
                        </h3>
                        {isToday(selectedDate) && (
                            <Badge className="mt-2 bg-purple-600/20 text-purple-300 border border-purple-500/30 text-xs">
                                Aujourd'hui
                            </Badge>
                        )}
                        <div className="flex flex-wrap gap-2 mt-3">
                            {selectedAvails.length > 0 && (
                                <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
                                    {selectedAvails.length} dispo.
                                </span>
                            )}
                            {selectedAIInterviews.length > 0 && (
                                <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-1 rounded-full border border-purple-500/20">
                                    {selectedAIInterviews.length} entretien{selectedAIInterviews.length > 1 ? 's' : ''} IA
                                </span>
                            )}
                            {selectedNotes.length > 0 && (
                                <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-1 rounded-full border border-blue-500/20">
                                    {selectedNotes.length} note{selectedNotes.length > 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                    </Card>

                    {/* Jour suspendu */}
                    {currentException && (
                        <Card className="bg-red-500/10 border border-red-500/30 p-4">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                                    <div>
                                        <p className="text-red-300 text-sm font-medium">Journée suspendue</p>
                                        <p className="text-red-400/60 text-xs">Disponibilités masquées</p>
                                    </div>
                                </div>
                                <button onClick={handleReactivate}
                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/20
                                               border border-red-500/30 text-red-300 hover:bg-red-500/30
                                               text-xs font-medium shrink-0 transition-all">
                                    <RefreshCw className="w-3 h-3" /> Réactiver
                                </button>
                            </div>
                        </Card>
                    )}

                    {/* Entretiens IA */}
                    {selectedAIInterviews.length > 0 && (
                        <Card className="bg-slate-800/50 border-slate-700 p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <BrainCircuit className="w-4 h-4 text-purple-400" />
                                <h4 className="text-white font-semibold text-sm">Entretiens IA</h4>
                            </div>
                            <div className="space-y-2">
                                {selectedAIInterviews.map(ev => (
                                    <div key={ev.id}
                                         className="flex items-center gap-3 p-3 bg-purple-500/10
                                                   border border-purple-500/20 rounded-xl">
                                        <BrainCircuit className="w-4 h-4 text-purple-400 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white text-sm font-medium truncate">
                                                {ev.interview?.candidate_name ?? 'Candidat'}
                                            </p>
                                            <p className="text-purple-400 text-xs truncate">
                                                {ev.interview?.job_title ?? ''}
                                            </p>
                                        </div>
                                        {ev.time && (
                                            <span className="text-purple-300 text-xs font-medium shrink-0">
                                                {ev.time}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}

                    {/* Disponibilités */}
                    <Card className="bg-slate-800/50 border-slate-700 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-emerald-400" />
                                <h4 className="text-white font-semibold text-sm">Disponibilités</h4>
                            </div>
                            {!showSlotForm && (
                                <button onClick={() => { setShowSlotForm(true); setSlotError('') }}
                                        className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                                    <Plus className="w-3.5 h-3.5" /> Ajouter
                                </button>
                            )}
                        </div>

                        {!currentException && selectedAvails.length === 0 && !showSlotForm && (
                            <div className="text-center py-5 border-2 border-dashed border-slate-700 rounded-xl">
                                <Clock className="w-5 h-5 text-slate-600 mx-auto mb-1" />
                                <p className="text-slate-500 text-xs">Aucune disponibilité</p>
                            </div>
                        )}

                        {!currentException && (
                            <div className="space-y-2 mb-2">
                                {selectedAvails.map(ev => (
                                    <div key={ev.id}
                                         className="flex items-center justify-between p-3 bg-emerald-500/10
                                                   border border-emerald-500/20 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                            <div>
                                                <p className="text-white text-sm">{ev.label}</p>
                                                <span className={`text-xs ${ev.avail?.specific_date ? 'text-amber-400' : 'text-blue-400'}`}>
                                                    {ev.avail?.specific_date ? '📅 Unique' : '🔄 Récurrent'}
                                                </span>
                                            </div>
                                        </div>
                                        {ev.avail && (
                                            <button
                                                onClick={() => setDeleteModal({ open: true, target: { type: 'availability', avail: ev.avail! } })}
                                                className="w-7 h-7 flex items-center justify-center rounded-lg
                                                           text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {showSlotForm && (
                            <div className="border border-slate-600 bg-slate-900/50 rounded-xl p-4 space-y-3">
                                <div className="flex gap-1 p-1 bg-slate-800 rounded-lg">
                                    {([
                                        { val: false, label: '📅 Unique'     },
                                        { val: true,  label: '🔄 Récurrent'  },
                                    ] as const).map(opt => (
                                        <button key={String(opt.val)} onClick={() => setIsRecurring(opt.val)}
                                                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${
                                                    isRecurring === opt.val ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                                                }`}>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs text-slate-400 mb-1 block">Début</label>
                                        <Input type="time" value={newSlot.start_time}
                                               onChange={e => setNewSlot({ ...newSlot, start_time: e.target.value })}
                                               className="bg-slate-800 border-slate-600 text-white h-9 rounded-lg" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-400 mb-1 block">Fin</label>
                                        <Input type="time" value={newSlot.end_time}
                                               onChange={e => setNewSlot({ ...newSlot, end_time: e.target.value })}
                                               className="bg-slate-800 border-slate-600 text-white h-9 rounded-lg" />
                                    </div>
                                </div>
                                {slotError && (
                                    <p className="text-red-400 text-xs flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" /> {slotError}
                                    </p>
                                )}
                                <div className="flex gap-2">
                                    <button onClick={() => { setShowSlotForm(false); setSlotError('') }}
                                            className="flex-1 py-2 rounded-lg border border-slate-700 text-slate-400
                                                   hover:text-white text-sm transition-all">
                                        Annuler
                                    </button>
                                    <button onClick={handleAddSlot}
                                            className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-700
                                                   text-white text-sm font-medium">
                                        Sauvegarder
                                    </button>
                                </div>
                            </div>
                        )}
                    </Card>

                    {/* Notes */}
                    <Card className="bg-slate-800/50 border-slate-700 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <StickyNote className="w-4 h-4 text-blue-400" />
                                <h4 className="text-white font-semibold text-sm">Notes</h4>
                            </div>
                            {!showNoteForm && (
                                <button onClick={() => setShowNoteForm(true)}
                                        className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                                    <Plus className="w-3.5 h-3.5" /> Ajouter
                                </button>
                            )}
                        </div>

                        {selectedNotes.length > 0 && (
                            <div className="space-y-2 mb-3">
                                {selectedNotes.map(ev => {
                                    const note = ev.note!
                                    const cfg  = NOTE_CFG[note.level]
                                    return (
                                        <div key={ev.id} className={`p-3 rounded-xl border ${cfg.bg} ${cfg.border}`}>
                                            <div className="flex items-start justify-between gap-2">
                                                <p className={`text-sm ${cfg.text} flex-1`}>
                                                    {cfg.emoji} {note.content}
                                                </p>
                                                <button onClick={() => handleDeleteNote(note.id)}
                                                        className="text-slate-500 hover:text-red-400 transition-colors shrink-0">
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                            {note.linked_offer_title && (
                                                <p className="text-xs text-slate-500 mt-1">📎 {note.linked_offer_title}</p>
                                            )}
                                            {note.notify_at && (
                                                <p className="text-xs text-amber-400/70 mt-1">
                                                    🔔 {new Date(note.notify_at).toLocaleString('fr-FR')}
                                                </p>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {!showNoteForm && selectedNotes.length === 0 && (
                            <div className="text-center py-5 border-2 border-dashed border-slate-700 rounded-xl">
                                <StickyNote className="w-5 h-5 text-slate-600 mx-auto mb-1" />
                                <p className="text-slate-500 text-xs">Aucune note pour ce jour</p>
                            </div>
                        )}

                        {showNoteForm && (
                            <div className="border border-slate-600 bg-slate-900/50 rounded-xl p-4 space-y-3">
                                <div className="flex gap-1 p-1 bg-slate-800 rounded-lg">
                                    {([
                                        { val: 'info',    label: '💬 Info'      },
                                        { val: 'warning', label: '⚠️ Attention' },
                                        { val: 'urgent',  label: '🔴 Urgent'    },
                                    ] as const).map(opt => (
                                        <button key={opt.val} onClick={() => setNewNote({ ...newNote, level: opt.val })}
                                                className={`flex-1 py-1 rounded-md text-xs font-medium transition-all ${
                                                    newNote.level === opt.val ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                                                }`}>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                                <textarea value={newNote.content}
                                          onChange={e => setNewNote({ ...newNote, content: e.target.value })}
                                          placeholder="Votre note..."
                                          rows={3}
                                          className="w-full bg-slate-800 border border-slate-600 text-white text-sm
                                               rounded-xl p-3 resize-none placeholder:text-slate-500
                                               focus:outline-none focus:border-purple-500 transition-colors" />
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">🔔 Rappel (optionnel)</label>
                                    <Input type="datetime-local" value={newNote.notify_at}
                                           onChange={e => setNewNote({ ...newNote, notify_at: e.target.value })}
                                           className="bg-slate-800 border-slate-600 text-white h-9 rounded-lg text-sm" />
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => { setShowNoteForm(false); setNewNote({ content: '', level: 'info', notify_at: '' }) }}
                                            className="flex-1 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white text-sm">
                                        Annuler
                                    </button>
                                    <button onClick={handleAddNote}
                                            className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
                                        Sauvegarder
                                    </button>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            </div>

            {/* Modal suppression */}
            <Dialog open={deleteModal.open} onOpenChange={open => setDeleteModal({ open, target: null })}>
                <DialogContent className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm">
                    <DialogHeader>
                        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20
                                        flex items-center justify-center mx-auto mb-3">
                            <Trash2 className="w-5 h-5 text-red-400" />
                        </div>
                        <DialogTitle className="text-white text-center">Supprimer</DialogTitle>
                        <DialogDescription className="text-slate-400 text-center text-sm">
                            {deleteModal.target?.avail.specific_date
                                ? 'Supprimer définitivement ce créneau unique ?'
                                : 'Annuler ce créneau récurrent pour ce jour uniquement ?'
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex gap-3 mt-2">
                        <Button variant="outline" onClick={() => setDeleteModal({ open: false, target: null })}
                                className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800 rounded-xl">
                            Annuler
                        </Button>
                        <Button onClick={handleConfirmDelete}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl">
                            Confirmer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}