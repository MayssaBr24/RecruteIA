
import { useState, useEffect, useRef, useCallback } from 'react'

export function useTimer(initialSeconds: number, onExpire?: () => void) {
    const [seconds, setSeconds] = useState(initialSeconds)
    const [running, setRunning] = useState(false)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const onExpireRef = useRef(onExpire)
    onExpireRef.current = onExpire

    const start = useCallback(() => setRunning(true), [])
    const pause = useCallback(() => setRunning(false), [])
    const reset = useCallback((s = initialSeconds) => {
        setSeconds(s)
        setRunning(false)
    }, [initialSeconds])

    useEffect(() => {
        if (!running) {
            if (intervalRef.current) clearInterval(intervalRef.current)
            return
        }
        intervalRef.current = setInterval(() => {
            setSeconds(prev => {
                if (prev <= 1) {
                    clearInterval(intervalRef.current!)
                    setRunning(false)
                    onExpireRef.current?.()
                    return 0
                }
                return prev - 1
            })
        }, 1000)
        return () => clearInterval(intervalRef.current!)
    }, [running])

    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    const formatted = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    const pct = initialSeconds > 0 ? (seconds / initialSeconds) * 100 : 0
    const isUrgent = seconds <= 120 // rouge < 2 min

    return { seconds, minutes, formatted, pct, isUrgent, running, start, pause, reset }
}