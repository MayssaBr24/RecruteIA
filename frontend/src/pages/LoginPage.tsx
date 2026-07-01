import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Header } from '../components/Header'
import { Loader2, AlertCircle, LogIn, User, Lock } from 'lucide-react'
import api from '../lib/api'
import { setTokens } from '../lib/auth'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../hooks/use-toast'

interface LoginFormData { username: string; password: string }
interface LoginResponse {
    access: string; refresh: string
    user: { id: number; username: string; email: string; first_name: string; last_name: string; role: string; groups: string[] }
}
interface ApiError {
    response?: { data?: { detail?: string }; status?: number }
    message?: string
}

// --- Canvas neural network background ---
function NeuralCanvas() {
    const ref = useRef<HTMLCanvasElement>(null)
    useEffect(() => {
        const canvas = ref.current!
        const ctx = canvas.getContext('2d')!
        let animId: number
        let nodes: { x:number; y:number; vx:number; vy:number; r:number; pulse:number }[] = []
        const mouse = { x: -999, y: -999 }

        function resize() {
            canvas.width = canvas.offsetWidth
            canvas.height = canvas.offsetHeight
            init()
        }
        function init() {
            const count = Math.floor((canvas.width * canvas.height) / 14000)
            nodes = Array.from({ length: count }, () => ({
                x: Math.random() * canvas.width, y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
                r: Math.random() * 2 + 1.5, pulse: Math.random() * Math.PI * 2,
            }))
        }
        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            nodes.forEach(n => {
                n.x += n.vx; n.y += n.vy; n.pulse += 0.02
                if (n.x < 0 || n.x > canvas.width) n.vx *= -1
                if (n.y < 0 || n.y > canvas.height) n.vy *= -1
                const dx = mouse.x - n.x, dy = mouse.y - n.y
                if (Math.sqrt(dx*dx+dy*dy) < 120) { n.x -= dx*0.003; n.y -= dy*0.003 }
            })
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i+1; j < nodes.length; j++) {
                    const a = nodes[i], b = nodes[j]
                    const d = Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2)
                    if (d < 130) {
                        const alpha = (1 - d/130) * 0.35
                        const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y)
                        g.addColorStop(0, `rgba(20,184,166,${alpha})`)
                        g.addColorStop(0.5, `rgba(56,189,248,${alpha*0.7})`)
                        g.addColorStop(1, `rgba(20,184,166,${alpha})`)
                        ctx.strokeStyle = g; ctx.lineWidth = 0.8
                        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
                    }
                }
            }
            nodes.forEach(n => {
                const glow = 0.6 + 0.4 * Math.sin(n.pulse)
                ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI*2)
                ctx.fillStyle = `rgba(20,184,166,${glow * 0.9})`; ctx.fill()
                ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 2.5, 0, Math.PI*2)
                ctx.fillStyle = `rgba(20,184,166,${glow * 0.1})`; ctx.fill()
            })
            animId = requestAnimationFrame(draw)
        }
        const ro = new ResizeObserver(resize)
        ro.observe(canvas)
        resize()
        draw()
        const onMove = (e: MouseEvent) => {
            const r = canvas.getBoundingClientRect()
            mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top
        }
        window.addEventListener('mousemove', onMove)
        return () => { cancelAnimationFrame(animId); ro.disconnect(); window.removeEventListener('mousemove', onMove) }
    }, [])
    return <canvas ref={ref} className="absolute inset-0 w-full h-full" />
}

// --- Typing effect ---
const PHRASES = ["Le bon profil, au bon moment.", "Recrutement intelligent, résultats rapides.", "Connectez talent et opportunité."]
function TypingSubtitle() {
    const [text, setText] = useState('')
    const [idx, setIdx] = useState(0)
    const [del, setDel] = useState(false)
    const [ci, setCi] = useState(0)
    useEffect(() => {
        const phrase = PHRASES[idx]
        const delay = del ? 40 : (ci === phrase.length ? 2000 : 70)
        const timer = setTimeout(() => {
            if (!del) {
                if (ci < phrase.length) { setText(phrase.slice(0, ci+1)); setCi(ci+1) }
                else setDel(true)
            } else {
                if (ci > 0) { setText(phrase.slice(0, ci-1)); setCi(ci-1) }
                else { setDel(false); setIdx((idx+1) % PHRASES.length) }
            }
        }, delay)
        return () => clearTimeout(timer)
    }, [text, del, ci, idx])
    return (
        <p className="text-sm text-slate-400 flex items-center justify-center gap-1 h-5">
            {text}
            <span className="inline-block w-0.5 h-3.5 bg-teal-400 animate-pulse ml-0.5" />
        </p>
    )
}

// --- Main LoginPage ---
export function LoginPage() {
    const navigate = useNavigate()
    const { setUserRole: updateUserRole } = useAuth()
    const { toast } = useToast()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [formData, setFormData] = useState<LoginFormData>({ username: '', password: '' })
    const [focused, setFocused] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setLoading(true)
        try {
            const res = await api.post<LoginResponse>(import.meta.env.VITE_API_BASE_URL + '/api/token/', formData)
            const { access, refresh, user } = res.data
            if (!user?.role) throw new Error('Réponse du serveur incomplète.')

            setTokens(access, refresh)
            updateUserRole(user.role)
            localStorage.setItem('user', JSON.stringify(user))  // ← ligne séparée

            toast({ title: 'Connexion réussie', description: `Bienvenue ${user.first_name || user.username}` })
            console.log('🚀 About to navigate:', {
                role: user.role,
                tokenInStorage: localStorage.getItem('access_token')?.slice(0, 20),
                roleInStorage: localStorage.getItem('user_role'),
            })
            if (user.role === 'SUPERADMIN') navigate('/admin', { replace: true })
            else if (user.role === 'ADMIN') navigate('/admin', { replace: true })
            else if (user.role === 'RH') navigate('/rh', { replace: true })
            else navigate('/', { replace: true })
            // LoginPage handleSubmit — juste après la réponse API
            console.log('✅ API Response:', res.data)
            console.log('👤 User role from API:', user.role)
            console.log('💾 localStorage après setTokens:', {
                access: localStorage.getItem('access_token'),
                role: localStorage.getItem('user_role'),
            })

        } catch (err) {
            const e = err as ApiError
            const msg = e.response?.data?.detail || 'Identifiants invalides'
            setError(msg)
            toast({ title: 'Erreur de connexion', description: msg, variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0a0f1e] via-[#0d1628] to-[#0a1520] overflow-hidden relative flex flex-col">
            <NeuralCanvas />

            <Header showLoginButton={false} />

            <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
                <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">

                    {/* Glassmorphism card */}
                    <div className="bg-slate-900/70 backdrop-blur-2xl border border-teal-500/20 rounded-2xl p-8 shadow-[0_0_60px_rgba(20,184,166,0.08),0_20px_60px_rgba(0,0,0,0.5)]">

                        {/* AI badge */}
                        <div className="flex justify-center mb-6">
              <span className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-500/30 rounded-full px-3 py-1 text-xs text-teal-400">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                Propulsé par l'IA
              </span>
                        </div>

                        {/* Logo */}
                        <div className="flex justify-center mb-4">
                            <div className="relative">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-sky-500 flex items-center justify-center shadow-lg">
                                    <LogIn className="w-8 h-8 text-white" />
                                </div>
                                <div className="absolute -inset-1 rounded-[20px] border border-teal-400/30 animate-spin" style={{ animationDuration: '8s' }} />
                            </div>
                        </div>

                        {/* Title */}
                        <h1 className="text-3xl font-bold text-center bg-gradient-to-r from-teal-400 via-sky-400 to-teal-400 bg-[length:200%] bg-clip-text text-transparent animate-[shimmer_3s_linear_infinite] mb-1">
                            RecrutAI
                        </h1>
                        <div className="flex justify-center mb-8"><TypingSubtitle /></div>

                        {/* Error */}
                        {error && (
                            <div className="mb-5 flex gap-3 items-start bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm animate-in shake duration-300">
                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {[
                                { id: 'username', label: "Nom d'utilisateur", type: 'text', placeholder: 'ex: rh_test', icon: User },
                                { id: 'password', label: 'Mot de passe', type: 'password', placeholder: '••••••••', icon: Lock },
                            ].map(({ id, label, type, placeholder, icon: Icon }) => (
                                <div key={id} className="space-y-1.5">
                                    <Label htmlFor={id} className="text-slate-400 text-xs">{label}</Label>
                                    <div className="relative">
                                        <Icon className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${focused===id ? 'text-teal-400' : 'text-slate-500'}`} />
                                        <Input
                                            id={id} type={type} placeholder={placeholder} required disabled={loading}
                                            value={formData[id as keyof LoginFormData]}
                                            onChange={e => setFormData({ ...formData, [id]: e.target.value })}
                                            onFocus={() => setFocused(id)} onBlur={() => setFocused(null)}
                                            className="h-11 pl-10 bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-600 rounded-xl focus:border-teal-500/60 focus:ring-2 focus:ring-teal-500/10 transition-all"
                                        />
                                        {focused === id && (
                                            <div className="absolute -bottom-px left-[10%] w-[80%] h-px bg-gradient-to-r from-transparent via-teal-400 to-transparent" />
                                        )}
                                    </div>
                                </div>
                            ))}

                            <Button type="submit" disabled={loading} size="lg"
                                    className="relative w-full h-12 mt-2 bg-gradient-to-r from-teal-500 to-sky-500 hover:from-teal-600 hover:to-sky-600 text-white border-0 rounded-xl font-semibold overflow-hidden group transition-all hover:shadow-[0_8px_30px_rgba(20,184,166,0.4)]"
                            >
                                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                {loading ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Connexion...</>
                                ) : (
                                    <>Se connecter <LogIn className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" /></>
                                )}
                            </Button>
                        </form>

                        <p className="text-center text-xs text-slate-600 mt-6 pt-4 border-t border-slate-800">
                            © 2026 RecrutAI — Le bon profil, au bon moment
                        </p>
                    </div>
                </div>
            </main>

            <style>{`
        @keyframes shimmer { to { background-position: 200% center; } }
        @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }
      `}</style>
        </div>
    )
}