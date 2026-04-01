import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Productboard Migration Tool',
  description: 'Migrate data between Productboard workspaces',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        <div className="max-w-3xl mx-auto py-10 px-4">{children}</div>
      </body>
    </html>
  )
}
