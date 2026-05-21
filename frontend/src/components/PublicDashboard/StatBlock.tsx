export function StatBlock({ value, label, gradient }: {
    value: string | number;
    label: string;
    gradient: string;
}) {
    return (
        <div className="text-center">
            <div className={`text-3xl font-extrabold tracking-tight bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>
                {value}
            </div>
            <div className="text-[10px] text-slate-500 mt-1.5 uppercase tracking-[0.16em]">
                {label}
            </div>
        </div>
    );
}