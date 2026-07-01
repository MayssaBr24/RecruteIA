
import { ReactNode } from 'react'
import { Badge } from '../../../../components/ui/badge'

interface PageHeaderProps {
    title: string
    subtitle?: string
    badge?: string
    badgeIcon?: ReactNode
    right?: ReactNode
    actions?: ReactNode
}

export function PageHeader({
                               title, subtitle, badge, badgeIcon, right, actions
                           }: PageHeaderProps) {
    return (
        <div className="flex items-start justify-between mb-2">
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-2xl font-bold text-white">{title}</h1>
                    {badge && (
                        <Badge className="bg-purple-600/20 text-purple-300
                                         border border-purple-500/30 text-xs">
                            {badgeIcon && (
                                <span className="mr-1">{badgeIcon}</span>
                            )}
                            {badge}
                        </Badge>
                    )}
                </div>
                {subtitle && (
                    <p className="text-slate-400 text-sm">{subtitle}</p>
                )}
            </div>
            <div className="flex items-center gap-3">
                {actions}
                {right}
            </div>
        </div>
    )
}