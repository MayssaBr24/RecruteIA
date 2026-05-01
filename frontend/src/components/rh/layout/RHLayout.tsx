// src/components/rh/layout/RHLayout.tsx

import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function RHLayout() {
    return (
        <div className="flex h-screen overflow-hidden
                        bg-gradient-to-br from-slate-950
                        via-slate-900 to-indigo-950">
            <Sidebar />
            <main className="flex-1 overflow-y-auto">
                <Outlet />
            </main>
        </div>
    )
}