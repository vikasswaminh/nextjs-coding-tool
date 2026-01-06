import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Coding Tool - AI-Powered Code Editor',
  description: 'A web-based coding tool with AI assistance',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
