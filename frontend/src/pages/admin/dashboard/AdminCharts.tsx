import {
     Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area
} from 'recharts'
import { TrendingUp, BarChart3, RefreshCw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from "../../../../components/ui/card.tsx";

interface ChartsProps {
    charts: {
        applications_trend: Array<{ month: string; count: number }>
        offers_by_rh: Array<{ created_by__username: string; count: number }>
        applications_by_status: Array<{ status: string; count: number }>
        interviews_by_status: Array<{ status: string; count: number }>
    }
}

// Modern Gradient Color Palette
const COLOR_GRADIENTS = [
    { start: '#6366F1', end: '#818CF8' },  // Indigo
    { start: '#8B5CF6', end: '#A78BFA' },  // Purple
    { start: '#EC4899', end: '#F472B6' },  // Pink
    { start: '#06B6D4', end: '#22D3EE' },  // Cyan
    { start: '#10B981', end: '#34D399' },  // Emerald
    { start: '#F59E0B', end: '#FBBF24' },  // Amber
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

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-xl p-4 shadow-2xl"
            >
                <p className="text-slate-400 text-xs mb-2">{label}</p>
                <p className="text-2xl font-bold text-white">
                    {payload[0].value}
                </p>
                <p className="text-slate-500 text-xs mt-1">total</p>
            </motion.div>
        )
    }
    return null
}

export function AdminCharts({ charts }: ChartsProps) {
    const hasData = (data: any[]) => data && data.length > 0

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key="charts"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
                {/* Applications Trend - Enhanced Area Chart */}
                {hasData(charts.applications_trend) && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        whileHover={{ scale: 1.02 }}
                        className="transform transition-all duration-300"
                    >
                        <Card className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800 hover:border-indigo-500/50 transition-all duration-500 shadow-xl">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-full blur-3xl" />
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wider">
                                            Évolution des Candidatures
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-1">Tendance mensuelle</p>
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                                        <TrendingUp className="w-3 h-3 text-indigo-400" />
                                        <span className="text-xs text-indigo-400 font-medium">+23%</span>
                                    </div>
                                </div>
                                <div className="h-80">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={charts.applications_trend}>
                                            <defs>
                                                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#6366F1" stopOpacity={0.4} />
                                                    <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                                                    <stop offset="0%" stopColor="#6366F1" />
                                                    <stop offset="100%" stopColor="#A78BFA" />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.5} />
                                            <XAxis
                                                dataKey="month"
                                                stroke="#64748B"
                                                fontSize={11}
                                                tick={{ fill: '#94A3B8' }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <YAxis
                                                stroke="#64748B"
                                                fontSize={11}
                                                tick={{ fill: '#94A3B8' }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Area
                                                type="monotone"
                                                dataKey="count"
                                                stroke="url(#lineGradient)"
                                                strokeWidth={3}
                                                fill="url(#areaGradient)"
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="count"
                                                stroke="url(#lineGradient)"
                                                strokeWidth={2}
                                                dot={{ fill: '#6366F1', r: 4, strokeWidth: 2, stroke: '#1E293B' }}
                                                activeDot={{ r: 6, fill: '#A78BFA' }}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                )}

                {/* Offers by RH - Enhanced Bar Chart */}
                {hasData(charts.offers_by_rh) && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        whileHover={{ scale: 1.02 }}
                        className="transform transition-all duration-300"
                    >
                        <Card className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800 hover:border-indigo-500/50 transition-all duration-500 shadow-xl">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-purple-500/5 to-pink-500/5 rounded-full blur-3xl" />
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wider">
                                            Offres par RH
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-1">Distribution des offres</p>
                                    </div>
                                    <RefreshCw className="w-4 h-4 text-slate-500" />
                                </div>
                                <div className="h-80">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={charts.offers_by_rh} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} opacity={0.5} />
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
                                                width={100}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Bar
                                                dataKey="count"
                                                radius={[0, 8, 8, 0]}
                                                maxBarSize={32}
                                            >
                                                {charts.offers_by_rh.map((_, index) => (
                                                    <Cell
                                                        key={`cell-${index}`}
                                                        fill={`url(#barGradient${index})`}
                                                    />
                                                ))}
                                            </Bar>
                                            <defs>
                                                {charts.offers_by_rh.map((_, index) => (
                                                    <linearGradient
                                                        key={`grad-${index}`}
                                                        id={`barGradient${index}`}
                                                        x1="0"
                                                        y1="0"
                                                        x2="1"
                                                        y2="0"
                                                    >
                                                        <stop
                                                            offset="0%"
                                                            stopColor={COLOR_GRADIENTS[index % COLOR_GRADIENTS.length].start}
                                                        />
                                                        <stop
                                                            offset="100%"
                                                            stopColor={COLOR_GRADIENTS[index % COLOR_GRADIENTS.length].end}
                                                        />
                                                    </linearGradient>
                                                ))}
                                            </defs>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                )}

                {/* Donut Charts Section */}
                <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Applications by Status */}
                    {hasData(charts.applications_by_status) && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            whileHover={{ scale: 1.02 }}
                        >
                            <Card className="bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800 hover:border-indigo-500/50 transition-all duration-500 shadow-xl">
                                <div className="p-6">
                                    <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wider mb-6">
                                        Candidatures par Statut
                                    </h3>
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
                                                    paddingAngle={3}
                                                    dataKey="count"
                                                    labelLine={false}
                                                >
                                                    {charts.applications_by_status.map((_entry, index) => (
                                                        <Cell
                                                            key={`cell-${index}`}
                                                            fill={COLOR_GRADIENTS[index % COLOR_GRADIENTS.length].start}
                                                        />
                                                    ))}
                                                </Pie>
                                                <Tooltip content={<CustomTooltip />} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="flex flex-wrap justify-center gap-4 mt-4 pt-4 border-t border-slate-800">
                                        {charts.applications_by_status.map((item, index) => (
                                            <div key={item.status} className="flex items-center gap-2">
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{
                                                        background: `linear-gradient(135deg, ${COLOR_GRADIENTS[index % COLOR_GRADIENTS.length].start}, ${COLOR_GRADIENTS[index % COLOR_GRADIENTS.length].end})`
                                                    }}
                                                />
                                                <span className="text-xs text-slate-400">
                                                    {STATUS_LABELS[item.status] || item.status}
                                                </span>
                                                <span className="text-xs font-semibold text-white">
                                                    {item.count}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    )}

                    {/* Interviews by Status */}
                    {hasData(charts.interviews_by_status) && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5, delay: 0.3 }}
                            whileHover={{ scale: 1.02 }}
                        >
                            <Card className="bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800 hover:border-indigo-500/50 transition-all duration-500 shadow-xl">
                                <div className="p-6">
                                    <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wider mb-6">
                                        Entretiens par Statut
                                    </h3>
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
                                                    paddingAngle={3}
                                                    dataKey="count"
                                                    labelLine={false}
                                                >
                                                    {charts.interviews_by_status.map((_entry, index) => (
                                                        <Cell
                                                            key={`cell-${index}`}
                                                            fill={`url(${COLOR_GRADIENTS[(index + 2) % COLOR_GRADIENTS.length].start})`}
                                                        />
                                                    ))}
                                                </Pie>
                                                <Tooltip content={<CustomTooltip />} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="flex flex-wrap justify-center gap-4 mt-4 pt-4 border-t border-slate-800">
                                        {charts.interviews_by_status.map((item, index) => (
                                            <div key={item.status} className="flex items-center gap-2">
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{
                                                        background: `linear-gradient(135deg, ${COLOR_GRADIENTS[(index + 2) % COLOR_GRADIENTS.length].start}, ${COLOR_GRADIENTS[(index + 2) % COLOR_GRADIENTS.length].end})`
                                                    }}
                                                />
                                                <span className="text-xs text-slate-400">
                                                    {STATUS_LABELS[item.status] || item.status}
                                                </span>
                                                <span className="text-xs font-semibold text-white">
                                                    {item.count}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    )}
                </div>

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
                            <Card className="p-12 text-center bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 rounded-full blur-3xl" />
                                    <div className="relative">
                                        <BarChart3 className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                                        <h3 className="text-lg font-semibold text-slate-300 mb-2">
                                            Données en cours de collecte
                                        </h3>
                                        <p className="text-sm text-slate-500">
                                            Les graphiques apparaîtront automatiquement une fois les données disponibles
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    )}
            </motion.div>
        </AnimatePresence>
    )
}