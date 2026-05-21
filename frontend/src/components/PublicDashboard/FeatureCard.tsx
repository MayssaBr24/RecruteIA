export function FeatureCard({ icon: Icon, title, desc, gradient }: {
    icon: React.ElementType;
    title: string;
    desc: string;
    gradient: string;
}) {
    return (
        <div className="group bg-white rounded-2xl border border-slate-100 p-7
                        hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-50/80
                        transition-all duration-300">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-r ${gradient}
                             flex items-center justify-center mb-5
                             group-hover:scale-110 transition-transform duration-300`}>
                <Icon className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">{title}</h3>
            <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
        </div>
    );
}