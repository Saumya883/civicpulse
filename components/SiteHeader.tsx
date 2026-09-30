'use client'

import Link from 'next/link'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import ThemeToggle from '@/components/ThemeToggle'
import { useI18n } from '@/lib/i18n'

export default function SiteHeader() {
  const { t } = useI18n()

  return (
    <header className="flex items-center justify-between border-b border-[var(--border)] py-5">
      <Link href="/" aria-label="CivicPulse home" className="text-lg font-semibold">
        Civic<span style={{ color: 'var(--dot1)' }}>Pulse</span>
      </Link>
      <div className="flex items-center gap-2">
        <Link href="/admin" className="mr-1 whitespace-nowrap text-xs font-medium text-[var(--muted)] underline underline-offset-4 hover:text-[var(--fg)] sm:text-sm">
          {t('admin.loginTitle')}
        </Link>
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </header>
  )
}