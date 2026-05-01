import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { BarChart3 } from 'lucide-react'
import { Card } from "../../../../components/ui/card"
import { motion } from 'framer-motion'

interface ChartsProps {
    charts: {
        applications_trend: Array<{ month: string; count: number }>
        offers_by_rh: Array<{ created_by__username: string; count: number }>
        applications_by_status: Array<{ status: string; count: number }>
        interviews_by_status: Array<{ status: string; count: number }>
    }
}

// Electric Cyan minimal palette
const CYAN = '#06B6D4'
const CYAN_LIGHT = '#22D3EE'
const CYAN_DIM = '#0891B2'
const COLORS = [CYAN, CYAN_LIGHT, CYAN_DIM, '#67E8F9', '#0E7490', '#155E75', '#164E63']

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
                    <Card className="p-6 bg-gray-950/50 border border-gray-800/50 rounded-2xl">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="w-1 h-6 bg-cyan-500 rounded-full" />
                            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                                Évolution des Candidatures
                            </h3>
                        </div>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={charts.applications_trend}>
                                    <defs>
                                        <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor={CYAN} />
                                            <stop offset="100%" stopColor={CYAN_LIGHT} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="1 2" stroke="#1f2937" vertical={false} />
                                    <XAxis
                                        dataKey="month"
                                        stroke="#6b7280"
                                        fontSize={11}
                                        tick={{ fill: '#9ca3af' }}
                                        axisLine={{ stroke: '#374151' }}
                                        tickLine={false}
                                        interval={0}
                                        angle={-45}
                                        textAnchor="end"
                                        height={50}
                                    />
                                    <YAxis
                                        stroke="#6b7280"
                                        fontSize={11}
                                        tick={{ fill: '#9ca3af' }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#0f172a',
                                            border: '1px solid #1e293b',
                                            borderRadius: '8px',
                                            fontSize: '12px'
                                        }}
                                        labelStyle={{ color: '#64748b' }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="count"
                                        stroke="url(#lineGradient)"
                                        strokeWidth={2}
                                        dot={{ fill: CYAN, r: 3, strokeWidth: 0 }}
                                        activeDot={{ r: 5, fill: CYAN_LIGHT, strokeWidth: 0 }}
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
                    <Card className="p-6 bg-gray-950/50 border border-gray-800/50 rounded-2xl">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="w-1 h-6 bg-cyan-500 rounded-full" />
                            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                                Offres par RH
                            </h3>
                        </div>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={charts.offers_by_rh} layout="vertical">
                                    <CartesianGrid strokeDasharray="1 2" stroke="#1f2937" horizontal={false} />
                                    <XAxis
                                        type="number"
                                        stroke="#6b7280"
                                        fontSize={11}
                                        tick={{ fill: '#9ca3af' }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="created_by__username"
                                        stroke="#6b7280"
                                        fontSize={11}
                                        tick={{ fill: '#9ca3af' }}
                                        width={90}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#0f172a',
                                            border: '1px solid #1e293b',
                                            borderRadius: '8px',
                                            fontSize: '12px'
                                        }}
                                        labelStyle={{ color: '#64748b' }}
                                    />
                                    <Bar
                                        dataKey="count"
                                        fill={CYAN}
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
                    <Card className="p-6 bg-gray-950/50 border border-gray-800/50 rounded-2xl">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="w-1 h-6 bg-cyan-500 rounded-full" />
                            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
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
                                        {charts.applications_by_status.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#0f172a',
                                            border: '1px solid #1e293b',
                                            borderRadius: '8px',
                                            fontSize: '12px'
                                        }}
                                        labelStyle={{ color: '#64748b' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        {/* Minimal Legend */}
                        <div className="flex flex-wrap justify-center gap-4 mt-2">
                            {charts.applications_by_status.slice(0, 4).map((item, index) => (
                                <div key={item.status} className="flex items-center gap-2">
                                    <div
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                    />
                                    <span className="text-xs text-gray-500">
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
                    <Card className="p-6 bg-gray-950/50 border border-gray-800/50 rounded-2xl">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="w-1 h-6 bg-cyan-500 rounded-full" />
                            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
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
                                        {charts.interviews_by_status.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#0f172a',
                                            border: '1px solid #1e293b',
                                            borderRadius: '8px',
                                            fontSize: '12px'
                                        }}
                                        labelStyle={{ color: '#64748b' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        {/* Minimal Legend */}
                        <div className="flex flex-wrap justify-center gap-4 mt-2">
                            {charts.interviews_by_status.slice(0, 4).map((item, index) => (
                                <div key={item.status} className="flex items-center gap-2">
                                    <div
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                    />
                                    <span className="text-xs text-gray-500">
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
                        <Card className="p-12 text-center bg-gray-950/50 border border-gray-800/50 rounded-2xl">
                            <BarChart3 className="w-10 h-10 text-gray-700 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-500 mb-2">
                                Pas encore de données
                            </h3>
                            <p className="text-sm text-gray-600">
                                Les graphiques apparaîtront une fois les données disponibles
                            </p>
                        </Card>
                    </motion.div>
                )}
        </div>
    )
}
