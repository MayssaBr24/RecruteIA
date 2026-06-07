// ─────────────────────────────────────────────────────────────────────────────
// hooks/useOtp.ts — Gestion envoi & vérification OTP
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { useToast } from '../../hooks/use-toast'
import api from "../api/api.ts";

interface UseOtpReturn {
    otpSent: boolean
    otpCode: string
    emailVerified: boolean
    emailVerifiedToken: string
    otpLoading: boolean
    setOtpCode: (code: string) => void
    resetVerification: () => void
    sendOTP: (email: string) => Promise<void>
    verifyOTP: (email: string) => Promise<void>
}

// ── Clé localStorage ───────────────────────────────────────────────────────────
const STORAGE_KEY = 'otp_verification'
const EXPIRY_MS   = 30 * 60 * 1000 // 30 minutes

interface StoredOtp {
    verified: boolean
    token: string
    email: string
    expiry: number
}

function loadStored(): StoredOtp | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return null
        const data = JSON.parse(raw) as StoredOtp
        if (Date.now() > data.expiry) {
            localStorage.removeItem(STORAGE_KEY)
            return null
        }
        return data
    } catch {
        return null
    }
}

function saveStored(email: string, token: string) {
    const data: StoredOtp = {
        verified: true,
        token,
        email,
        expiry: Date.now() + EXPIRY_MS,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function clearStored() {
    localStorage.removeItem(STORAGE_KEY)
}

// ─────────────────────────────────────────────────────────────────────────────

export function useOtp(): UseOtpReturn {
    const { toast } = useToast()

    // Rehydrate depuis localStorage au montage (survit au redirect OAuth)
    const stored = loadStored()

    const [otpSent,            setOtpSent]            = useState(false)
    const [otpCode,            setOtpCode]             = useState('')
    const [emailVerified,      setEmailVerified]       = useState<boolean>(stored?.verified ?? false)
    const [emailVerifiedToken, setEmailVerifiedToken]  = useState<string>(stored?.token ?? '')
    const [otpLoading,         setOtpLoading]          = useState(false)

    const resetVerification = () => {
        clearStored()
        setEmailVerified(false)
        setOtpSent(false)
        setOtpCode('')
        setEmailVerifiedToken('')
    }

    const sendOTP = async (email: string) => {
        if (!email.trim()) {
            toast({ title: 'Email manquant', variant: 'destructive' })
            return
        }
        setOtpLoading(true)
        try {
            await api.post('/send-otp/', { email: email.trim() })
            setOtpSent(true)
            toast({ title: 'Code envoyé !', description: `Vérifiez ${email}` })
        } catch (err: unknown) {
            const message = extractApiMessage(err)
            toast({ title: 'Erreur', description: message ?? 'Erreur envoi', variant: 'destructive' })
        } finally {
            setOtpLoading(false)
        }
    }

    const verifyOTP = async (email: string) => {
        setOtpLoading(true)
        try {
            const res = await api.post('/verify-otp/', {
                email: email.trim(),
                code: otpCode.trim(),
            })
            const token = (res.data as { verified_token: string }).verified_token
            setEmailVerified(true)
            setEmailVerifiedToken(token)
            saveStored(email.trim(), token) // ← persiste pour survivre au redirect
            toast({
                title: '✅ Email vérifié !',
                description: 'Vous pouvez compléter votre candidature.',
            })
        } catch (err: unknown) {
            const message = extractApiMessage(err)
            toast({ title: 'Code incorrect', description: message, variant: 'destructive' })
        } finally {
            setOtpLoading(false)
        }
    }

    return {
        otpSent,
        otpCode,
        emailVerified,
        emailVerifiedToken,
        otpLoading,
        setOtpCode,
        resetVerification,
        sendOTP,
        verifyOTP,
    }
}

// ── Helper local ───────────────────────────────────────────────────────────────

interface ApiErrorShape {
    response?: {
        data?: { error?: string; message?: string; detail?: string }
    }
}

function extractApiMessage(err: unknown): string | undefined {
    if (typeof err === 'object' && err !== null) {
        const shaped = err as ApiErrorShape
        return (
            shaped.response?.data?.error ??
            shaped.response?.data?.message ??
            shaped.response?.data?.detail
        )
    }
    return undefined
}