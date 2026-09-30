'use client'

import Link from 'next/link'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import ThemeToggle from '@/components/ThemeToggle'

export default function SiteHeader() {
  return (
    <header className="flex items-center justify-between border-b border-[var(--border)] py-5">
      <Link href="/" aria-label="CivicPulse home" className="text-lg font-semibold">
        Civic<span style={{ color: 'var(--dot1)' }}>Pulse</span>
      </Link>
      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </header>
  )
}