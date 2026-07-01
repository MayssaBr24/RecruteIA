import axios from 'axios'
import type {
    StartResponse, AnswerPayload, QCMAnswerPayload,
    AnswerResponse, FinalizeResponse, WarningType,
    WarningResponse, AudioResponse,
} from '../types/interview'



const BASE = import.meta.env.VITE_API_BASE_URL
const api  = axios.create({ baseURL: BASE, headers: { 'ngrok-skip-browser-warning': 'true' } })

const PREFIX = '/api/recruitment'


export const interviewApi = {

    start: async (token: string): Promise<StartResponse> => {
        const { data } = await api.get(`${PREFIX}/ai-interview/${token}/start/`)
        return data
    },


    answer: async (
        token: string,
        payload: AnswerPayload | QCMAnswerPayload
    ): Promise<AnswerResponse> => {
        const { data } = await api.post(`${PREFIX}/ai-interview/${token}/answer/`, payload)
        return data
    },

    finalize: async (token: string): Promise<FinalizeResponse> => {
        const { data } = await api.post(`${PREFIX}/ai-interview/${token}/finalize/`)
        return data
    },

    warning: async (
        token: string,
        warningType: WarningType,
        details = ''
    ): Promise<WarningResponse> => {
        try {
            const { data } = await api.post(`${PREFIX}/ai-interview/${token}/warning/`, {
                warning_type: warningType,
                details,
            })
            return data
        } catch {
            return { warning_count: 0, fraud_score: 0, terminated: false }
        }
    },

    // ── Audio : transcription Whisper + analyse vocale ───────────────
    audio: async (
        token: string,
        audioBlob: Blob,
        currentQuestion: string = '',
        filename = 'audio.webm'
    ): Promise<AudioResponse> => {
        const form = new FormData()
        form.append('audio', audioBlob, filename)
        form.append('current_question', currentQuestion)
        const { data } = await api.post(
            `${PREFIX}/ai-interview/${token}/audio/`,
            form,
            { headers: { 'Content-Type': 'multipart/form-data' } }
        )
        return data
    },

      uploadVideo: async (token: string, videoBlob: Blob): Promise<void> => {
        const form = new FormData()
        form.append('video', videoBlob, 'interview.webm')
        await api.post(
            `${PREFIX}/ai-interview/${token}/video/`,
            form,
            { headers: { 'Content-Type': 'multipart/form-data' } }
        )
    },

}