// ─────────────────────────────────────────────────────────────────────────────
// constants.ts — Valeurs par défaut & helpers de cache localStorage
// ─────────────────────────────────────────────────────────────────────────────

import type {
    FormDataState,
    OAuthStatus,
    VerifiedProfiles,
} from './types'

// ── Clés localStorage ─────────────────────────────────────────────────────────

export const FORM_CACHE_KEY  = (id: string) => `application_form_${id}`
export const OAUTH_CACHE_KEY = (id: string) => `application_oauth_${id}`
export const GITHUB_DATA_KEY = (id: string) => `github_data_${id}`

// ── Valeur par défaut du formulaire ──────────────────────────────────────────

export const DEFAULT_FORM: FormDataState = {
    full_name: '',
    email: '',
    phone: '',
    nationality: '',
    university: '',
    degree_level: '',
    graduation_year: '',
    current_position: '',
    experience_years: '',
    linkedin_url: '',
    github_url: '',
    current_location: '',
    salary_expectation: '',
    availability_date: '',
    cv_file: null,
    cover_letter_file: null,
    professional_links: [{ platform: '', url: '' }],
    certifications: [],
    recommendation_letters: [],
    github_data: null,
}

// ── Helpers localStorage ──────────────────────────────────────────────────────

type CacheableForm = Omit<FormDataState, 'cv_file' | 'cover_letter_file'>

export function loadFormCache(id: string): Partial<CacheableForm> {
    try {
        const raw = localStorage.getItem(FORM_CACHE_KEY(id))
        return raw ? (JSON.parse(raw) as Partial<CacheableForm>) : {}
    } catch {
        return {}
    }
}

export function saveFormCache(id: string, data: FormDataState): void {
    try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { cv_file, cover_letter_file, ...rest } = data
        localStorage.setItem(FORM_CACHE_KEY(id), JSON.stringify(rest))
    } catch {
        /* ignore */
    }
}

interface OAuthCache {
    status: OAuthStatus
    profiles: VerifiedProfiles
}

export function loadOAuthCache(id: string): OAuthCache {
    try {
        const raw = localStorage.getItem(OAUTH_CACHE_KEY(id))
        if (raw) return JSON.parse(raw) as OAuthCache
    } catch {
        /* ignore */
    }
    return {
        status: { linkedin: 'idle', github: 'idle' },
        profiles: { linkedin_url: '', github_url: '' },
    }
}

export function saveOAuthCache(
    id: string,
    status: OAuthStatus,
    profiles: VerifiedProfiles,
): void {
    try {
        localStorage.setItem(OAUTH_CACHE_KEY(id), JSON.stringify({ status, profiles }))
    } catch {
        /* ignore */
    }
}

export function loadGithubData(id: string): Record<string, unknown> | null {
    try {
        const raw = localStorage.getItem(GITHUB_DATA_KEY(id))
        return raw ? (JSON.parse(raw) as Record<string, unknown>) : null
    } catch {
        return null
    }
}

export function saveGithubData(id: string, data: Record<string, unknown>): void {
    try {
        localStorage.setItem(GITHUB_DATA_KEY(id), JSON.stringify(data))
    } catch {
        /* ignore */
    }
}

export function clearAllCache(id: string): void {
    localStorage.removeItem(FORM_CACHE_KEY(id))
    localStorage.removeItem(OAUTH_CACHE_KEY(id))
    localStorage.removeItem(GITHUB_DATA_KEY(id))
}

// ── Utilitaires ───────────────────────────────────────────────────────────────

export const generateId = (): string =>
    Math.random().toString(36).substring(2, 9)

