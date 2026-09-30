'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/lib/i18n'
import SiteHeader from '@/components/SiteHeader'

export default function Home() {
  const { t } = useI18n()
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [statsError, setStatsError] = useState(false)

  useEffect(() => {
    async function loadCounts() {
      const { data, error } = await supabase.rpc('request_stats')
      setIsLoading(false)
      if (error) {
        console.error('stats error', error)
        setStatsError(true)
        return
      }

      const nextCounts: Record<string, number> = {}
      data?.forEach((row: { status: string; total: number | string }) => {
        nextCounts[row.status] = Number(row.total)
      })
      setCounts(nextCounts)
    }

    void loadCounts()
  }, [])

  const total = Object.values(counts).reduce((sum, count) => sum + count, 0)
  const cards = [
    { label: t('stats.total'), value: total, n: 1, kind: 'stat-total' },
    { label: t('status.submitted'), value: counts.submitted ?? 0, n: 2, kind: 'stat-submitted' },
    { label: t('status.under_review'), value: counts.under_review ?? 0, n: 3, kind: 'stat-review' },
    { label: t('status.prioritized'), value: counts.prioritized ?? 0, n: 4, kind: 'stat-prioritized' },
    { label: t('status.resolved'), value: counts.resolved ?? 0, n: 5, kind: 'stat-resolved' },
  ]

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <div className="mx-auto max-w-5xl px-6">
        <SiteHeader />

        <section className="pb-12 pt-14">
        <h1 className="dashboard-title max-w-3xl text-4xl leading-tight sm:text-6xl">{t('home.title')}</h1>
        <p className="mt-5 max-w-xl text-lg text-[var(--muted)]">{t('home.subtitle')}</p>
        <Link
          href="/report"
          className="mt-9 inline-block rounded-md px-8 py-3 font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          style={{ background: 'var(--btn)', color: 'var(--btn-fg)' }}
        >
          {t('home.cta')} <span aria-hidden="true">→</span>
        </Link>
      </section>

        <section aria-label={t('stats.total')} className="grid grid-cols-2 gap-4 pb-20 md:grid-cols-5">
          {cards.map((card) => (
            <div
              key={card.n}
              className={`card stat-card ${card.kind} p-5 transition hover:-translate-y-1`}
            >
              <span className="stat-card__dot mb-4 block h-2 w-2 rounded-full" />
              <div className="stat-card__value dashboard-title">{card.value}</div>
              <div className="stat-card__label mt-1">{card.label}</div>
            </div>
          ))}
        </section>

        {(statsError || isLoading) && (
          <p role={statsError ? 'alert' : 'status'} className="pb-8 text-sm text-[var(--muted)]">
            {statsError ? t('home.statsError') : t('home.loading')}
          </p>
        )}
      </div>
    </main>
  )
}
