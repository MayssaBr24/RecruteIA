
export function FilterChip({ active, label, count, icon: Icon, onClick }: {
    active: boolean;
    label: string;
    count: number;
    icon: React.ElementType;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                        transition-all duration-200 border ${
                active
                    ? 'bg-gradient-to-r from-indigo-600 to-sky-600 text-white border-indigo-500 shadow-md shadow-indigo-500/20'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
            }`}
        >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
                    active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}>{count}</span>
            )}
        </button>
    );
}