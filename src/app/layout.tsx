import type { Metadata } from 'next'
import './globals.css'
import { WorkspaceProvider } from '@/components/WorkspaceContext'
import { NavBar } from '@/components/NavBar'

export const metadata: Metadata = {
  title: 'Productboard Migration Tool',
  description: 'Migrate data between Productboard workspaces',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen" style={{ backgroundColor: '#FAFAFB' }}>
        <WorkspaceProvider>
          <NavBar />
          <div className="max-w-4xl mx-auto px-6 py-8">
            {children}
          </div>
        </WorkspaceProvider>
      </body>
    </html>
  )
}
