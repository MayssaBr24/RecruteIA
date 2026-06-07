import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function RHLayout() {
    return (
        <div className="flex h-screen overflow-hidden bg-slate-900">

            <div className="relative z-20">
                <Sidebar />
            </div>

            <main className="flex-1 overflow-y-auto bg-slate-900 relative z-10">
                <div className="min-h-full">
                    <Outlet />
                </div>
            </main>
        </div>
    )
}