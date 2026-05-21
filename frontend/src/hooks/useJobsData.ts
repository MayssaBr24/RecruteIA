import { useState, useEffect } from 'react';
import api from "../api/api.ts";
import {isJobActive, isNewThisWeek} from "../types/dateUtils.ts";

interface Job {
    id: number;
    title: string;
    description: string;
    created_at: string;
    location?: string;
    type?: string;
    department?: string;
    salary?: string;
    offer_deadline?: string;
    company?: string;
    company_name?: string;
}

interface Stats {
    totalJobs: number;
    newThisWeek: number;
    locations: number;
    companies: number;
}

export function useJobsData() {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<Stats>({
        totalJobs: 0,
        newThisWeek: 0,
        locations: 0,
        companies: 45,
    });

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const { data } = await api.get('/jobs/');
                setJobs(data);

                const activeJobs = data.filter(isJobActive);
                setStats({
                    totalJobs: activeJobs.length,
                    newThisWeek: activeJobs.filter((j: Job) => isNewThisWeek(j.created_at)).length,
                    locations: new Set(activeJobs.map((j: Job) => j.location).filter(Boolean)).size,
                    companies: new Set(activeJobs.map((j: Job) => j.company_name).filter(Boolean)).size, // ← vrai count
                });
                setError(null);
            } catch {
                setError('Erreur lors du chargement des offres');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    return { jobs, loading, error, stats };
}