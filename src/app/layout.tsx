import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Productboard Migration Tool',
  description: 'Migrate data between Productboard workspaces',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen" style={{ backgroundColor: '#F5F4F6' }}>
        {/* Top nav bar */}
        <header style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e8e5ed' }}>
          <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-3">
            {/* Productboard-style logo mark */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect width="24" height="24" rx="6" fill="#6B2FA0"/>
              <path d="M7 7h5a3 3 0 0 1 0 6H7V7z" fill="white"/>
              <path d="M7 13h6a4 4 0 0 1 0 4H7v-4z" fill="white" opacity="0.6"/>
            </svg>
            <span style={{ color: '#1a1523', fontWeight: 600, fontSize: '15px', letterSpacing: '-0.01em' }}>
              Migration Tool
            </span>
          </div>
        </header>

        {/* Page content */}
        <div className="max-w-4xl mx-auto px-6 py-8">
          {children}
        </div>
      </body>
    </html>
  )
}
