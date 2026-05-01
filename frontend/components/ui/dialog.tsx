// components/ui/dialog.tsx
'use client'

import * as React from 'react'
import { X } from 'lucide-react'

interface DialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    children: React.ReactNode
    className?: string
}

interface DialogContentProps {
    children: React.ReactNode
    className?: string
}

interface DialogHeaderProps {
    children: React.ReactNode
    className?: string
}

export const Dialog: React.FC<DialogProps> = ({ open, children }) => {
    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {children}
        </div>
    )
}

export const DialogContent: React.FC<DialogContentProps> = ({ children, className = '' }) => {
    return (
        <>
            {/* Overlay */}
            <div
                className="fixed inset-0 bg-black/80 animate-in fade-in-0"
                onClick={() => {}}
            />

            {/* Dialog Content */}
            <div
                className={`relative z-50 w-full max-w-lg mx-4 bg-white dark:bg-gray-900 rounded-lg shadow-xl animate-in zoom-in-95 ${className}`}
            >
                {children}
            </div>
        </>
    )
}

export const DialogHeader: React.FC<DialogHeaderProps> = ({ children, className = '' }) => {
    return (
        <div className={`flex flex-col space-y-1.5 p-6 ${className}`}>
            {children}
        </div>
    )
}

export const DialogTitle: React.FC<{ children: React.ReactNode, className?: string }> = ({children}) => {
    return (
        <h2 className="text-lg font-semibold leading-none tracking-tight">
            {children}
        </h2>
    )
}

export const DialogDescription: React.FC<{ children: React.ReactNode, className?: string }> = ({children}) => {
    return (
        <p className="text-sm text-gray-500 dark:text-gray-400">
            {children}
        </p>
    )
}

export const DialogFooter: React.FC<{ children: React.ReactNode, className?: string }> = ({children}) => {
    return (
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 p-6 pt-0">
            {children}
        </div>
    )
}

export const DialogClose: React.FC<{
    onClick: () => void
    className?: string
}> = ({ onClick, className = '' }) => {
    return (
        <button
            onClick={onClick}
            className={`absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 ${className}`}
        >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
        </button>
    )
}