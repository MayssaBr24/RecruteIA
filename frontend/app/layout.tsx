import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'

import './globals.css'
Geist({ subsets: ['latin'] });
Geist_Mono({ subsets: ['latin'] });
// eslint-disable-next-line react-refresh/only-export-components
export const metadata: Metadata = {
  title: 'mayssa App',
  description: 'Created with mayssa',
  generator: 'mayssa.app',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
