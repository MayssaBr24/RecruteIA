import { Briefcase, Clock, Zap, Target, Globe } from 'lucide-react';

export const FILTERS = [
    { id: 'all', label: 'Toutes', icon: Briefcase },
    { id: 'recent', label: 'Récentes', icon: Clock },
    { id: 'tech', label: 'Tech', icon: Zap },
    { id: 'marketing', label: 'Marketing', icon: Target },
    { id: 'remote', label: 'Remote', icon: Globe },
] as const;

export type FilterId = typeof FILTERS[number]['id'];