import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { BarChart3 } from 'lucide-react'
import { motion } from 'framer-motion'
import {Card} from "../../../../components/ui/card.tsx";

interface ChartsProps {
    charts: {
        applications_trend: Array<{ month: string; count: number }>
        offers_by_rh: Array<{ created_by__username: string; count: number }>
        applications_by_status: Array<{ status: string; count: number }>
        interviews_by_status: Array<{ status: string; count: number }>
    }
}

// Unified Indigo palette
const INDIGO_PALETTE = [
    '#4F46E5', // indigo-600
    '#6366F1', // indigo-500
    '#818CF8', // indigo-400
    '#A5B4FC', // indigo-300
    '#C7D2FE', // indigo-200
    '#E0E7FF', // indigo-100
    '#312E81', // indigo-900
]

const STATUS_LABELS: Record<string, string> = {
    'pending': 'En attente',
    'reviewed': 'Examinée',
    'accepted': 'Acceptée',
    'refused': 'Refusée',
    'confirmed': 'Confirmé',
    'cancelled': 'Annulé',
    'completed': 'Terminé'
}

export function AdminCharts({ charts }: ChartsProps) {
    const hasData = (data: any[]) => data && data.length > 0

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Applications Trend - Line Chart */}
            {hasData(charts.applications_trend) && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <Card className="p-6 bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all duration-300">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-1 h-6 bg-indigo-500 rounded-full" />
                            <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wide">
                                Évolution Candidatures
                            </h3>
                        </div>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={charts.applications_trend}>
                                    <defs>
                                        <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor="#4F46E5" />
                                            <stop offset="100%" stopColor="#818CF8" />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="2 4" stroke="#334155" vertical={false} />
                                    <XAxis
                                        dataKey="month"
                                        stroke="#64748B"
                                        fontSize={11}
                                        tick={{ fill: '#94A3B8' }}
                                        axisLine={{ stroke: '#475569' }}
                                        tickLine={false}
                                        interval={0}
                                        angle={-45}
                                        textAnchor="end"
                                        height={50}
                                    />
                                    <YAxis
                                        stroke="#64748B"
                                        fontSize={11}
                                        tick={{ fill: '#94A3B8' }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#1E293B',
                                            border: '1px solid #475569',
                                            borderRadius: '8px',
                                            fontSize: '12px'
                                        }}
                                        labelStyle={{ color: '#CBD5E1' }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="count"
                                        stroke="url(#lineGradient)"
                                        strokeWidth={2.5}
                                        dot={{ fill: '#4F46E5', r: 3, strokeWidth: 0 }}
                                        activeDot={{ r: 5, fill: '#818CF8' }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </motion.div>
            )}

            {/* Offers by RH - Horizontal Bar */}
            {hasData(charts.offers_by_rh) && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                >
                    <Card className="p-6 bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all duration-300">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-1 h-6 bg-indigo-500 rounded-full" />
                            <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wide">
                                Offres par RH
                            </h3>
                        </div>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={charts.offers_by_rh} layout="vertical">
                                    <CartesianGrid strokeDasharray="2 4" stroke="#334155" horizontal={false} />
                                    <XAxis
                                        type="number"
                                        stroke="#64748B"
                                        fontSize={11}
                                        tick={{ fill: '#94A3B8' }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="created_by__username"
                                        stroke="#64748B"
                                        fontSize={11}
                                        tick={{ fill: '#94A3B8' }}
                                        width={90}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#1E293B',
                                            border: '1px solid #475569',
                                            borderRadius: '8px',
                                            fontSize: '12px'
                                        }}
                                        labelStyle={{ color: '#CBD5E1' }}
                                    />
                                    <Bar
                                        dataKey="count"
                                        fill="#4F46E5"
                                        radius={[0, 4, 4, 0]}
                                        maxBarSize={24}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </motion.div>
            )}

            {/* Applications by Status - Donut Chart */}
            {hasData(charts.applications_by_status) && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                >
                    <Card className="p-6 bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all duration-300">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-1 h-6 bg-indigo-500 rounded-full" />
                            <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wide">
                                Candidatures par Statut
                            </h3>
                        </div>
                        <div className="flex items-center justify-center h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={charts.applications_by_status.map(item => ({
                                            ...item,
                                            name: STATUS_LABELS[item.status] || item.status
                                        }))}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={2}
                                        dataKey="count"
                                    >
                                        {charts.applications_by_status.map((_entry, index) => (
                                            <Cell key={`cell-${index}`} fill={INDIGO_PALETTE[index % INDIGO_PALETTE.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#1E293B',
                                            border: '1px solid #475569',
                                            borderRadius: '8px',
                                            fontSize: '12px'
                                        }}
                                        labelStyle={{ color: '#CBD5E1' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        {/* Minimal Legend */}
                        <div className="flex flex-wrap justify-center gap-3 mt-4">
                            {charts.applications_by_status.slice(0, 4).map((item, index) => (
                                <div key={item.status} className="flex items-center gap-2">
                                    <div
                                        className="w-2.5 h-2.5 rounded-full"
                                        style={{ backgroundColor: INDIGO_PALETTE[index % INDIGO_PALETTE.length] }}
                                    />
                                    <span className="text-xs text-slate-400">
                                        {STATUS_LABELS[item.status] || item.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </Card>
                </motion.div>
            )}

            {/* Interviews by Status - Donut Chart */}
            {hasData(charts.interviews_by_status) && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                >
                    <Card className="p-6 bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all duration-300">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-1 h-6 bg-indigo-500 rounded-full" />
                            <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wide">
                                Entretiens par Statut
                            </h3>
                        </div>
                        <div className="flex items-center justify-center h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={charts.interviews_by_status.map(item => ({
                                            ...item,
                                            name: STATUS_LABELS[item.status] || item.status
                                        }))}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={2}
                                        dataKey="count"
                                    >
                                        {charts.interviews_by_status.map((_entry, index) => (
                                            <Cell key={`cell-${index}`} fill={INDIGO_PALETTE[index % INDIGO_PALETTE.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#1E293B',
                                            border: '1px solid #475569',
                                            borderRadius: '8px',
                                            fontSize: '12px'
                                        }}
                                        labelStyle={{ color: '#CBD5E1' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        {/* Minimal Legend */}
                        <div className="flex flex-wrap justify-center gap-3 mt-4">
                            {charts.interviews_by_status.slice(0, 4).map((item, index) => (
                                <div key={item.status} className="flex items-center gap-2">
                                    <div
                                        className="w-2.5 h-2.5 rounded-full"
                                        style={{ backgroundColor: INDIGO_PALETTE[index % INDIGO_PALETTE.length] }}
                                    />
                                    <span className="text-xs text-slate-400">
                                        {STATUS_LABELS[item.status] || item.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </Card>
                </motion.div>
            )}

            {/* Empty State */}
            {!hasData(charts.applications_trend) &&
                !hasData(charts.offers_by_rh) &&
                !hasData(charts.applications_by_status) &&
                !hasData(charts.interviews_by_status) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="col-span-1 lg:col-span-2"
                    >
                        <Card className="p-12 text-center bg-slate-900 border border-slate-800">
                            <BarChart3 className="w-10 h-10 text-slate-700 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-slate-300 mb-2">
                                Pas encore de données
                            </h3>
                            <p className="text-sm text-slate-500">
                                Les graphiques apparaîtront une fois les données disponibles
                            </p>
                        </Card>
                    </motion.div>
                )}
        </div>
    )
}
