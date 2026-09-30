'use client'

import { useState } from 'react'
import SiteHeader from '@/components/SiteHeader'
import { useI18n } from '@/lib/i18n'

type Report = {
  id: number
  district_id: number
  description: string
  reporter_phone: string | null
  status: string
  created_at: string
}

const statuses = ['submitted', 'under_review', 'prioritized', 'resolved'] as const

export default function AdminPage() {
  const { t } = useI18n()
  const [adminKey, setAdminKey] = useState('')
  const [reports, setReports] = useState<Report[] | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  async function loadReports(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/admin/status', {
        headers: { 'x-admin-key': adminKey },
        cache: 'no-store',
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(response.status === 401 ? t('admin.error.unauthorized') : result.error ?? t('admin.error.load'))
        return
      }

      setReports(result.data as Report[])
    } catch {
      setError(t('admin.error.load'))
    } finally {
      setIsLoading(false)
    }
  }

  async function updateStatus(id: number, status: string) {
    setError('')
    setUpdatingId(id)
    try {
      const response = await fetch('/api/admin/status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
        body: JSON.stringify({ id, status }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(response.status === 401 ? t('admin.error.unauthorized') : result.error ?? t('admin.error.update'))
        if (response.status === 401) setReports(null)
        return
      }

      setReports((current) => current?.map((report) => report.id === id ? { ...report, status } : report) ?? null)
    } catch {
      setError(t('admin.error.update'))
    } finally {
      setUpdatingId(null)
    }
  }

  function signOut() {
    setAdminKey('')
    setReports(null)
    setError('')
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <div className="mx-auto max-w-5xl px-6">
        <SiteHeader />
        {reports === null ? (
          <section className="mx-auto mt-20 max-w-sm">
            <h1 className="mb-5 text-2xl font-semibold">{t('admin.loginTitle')}</h1>
            <form onSubmit={loadReports}>
              <label htmlFor="admin-key" className="mb-2 block text-sm font-medium">
                {t('admin.keyLabel')}
              </label>
              <input
                id="admin-key"
                type="password"
                autoComplete="current-password"
                required
                value={adminKey}
                onChange={(event) => setAdminKey(event.target.value)}
                placeholder={t('admin.keyPlaceholder')}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[var(--fg)] placeholder:text-[var(--muted)]"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="mt-3 w-full rounded-md px-6 py-2.5 font-medium disabled:opacity-50"
                style={{ background: 'var(--btn)', color: 'var(--btn-fg)' }}
              >
                {isLoading ? t('admin.loading') : t('admin.open')}
              </button>
            </form>
            {error && <p role="alert" className="error-message mt-3 rounded-md border p-3 text-sm">{error}</p>}
          </section>
        ) : (
          <section className="py-10">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <h1 className="text-2xl font-semibold">{t('admin.reportsTitle')}</h1>
              <button type="button" onClick={signOut} className="text-sm text-[var(--muted)] underline">
                {t('admin.signOut')}
              </button>
            </div>
            {error && <p role="alert" className="error-message mb-4 rounded-md border p-3 text-sm">{error}</p>}
            {reports.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">{t('admin.empty')}</p>
            ) : (
              <div className="space-y-3">
                {reports.map((report) => (
                  <article
                    key={report.id}
                    className="card flex flex-wrap items-center justify-between gap-4 p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-medium">#{report.id} · {report.description}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {t('admin.district')} {report.district_id} · {report.reporter_phone ?? t('admin.noPhone')}
                      </p>
                      <time className="mt-1 block text-xs text-[var(--muted)]" dateTime={report.created_at}>
                        {new Date(report.created_at).toLocaleString()}
                      </time>
                    </div>
                    <label className="sr-only" htmlFor={`report-status-${report.id}`}>
                      {t('admin.statusFor')} {report.id}
                    </label>
                    <select
                      id={`report-status-${report.id}`}
                      value={report.status}
                      disabled={updatingId === report.id}
                      onChange={(event) => void updateStatus(report.id, event.target.value)}
                      className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--fg)] disabled:opacity-50"
                    >
                      {statuses.map((status) => (
                        <option key={status} value={status} className="text-black">
                          {t(`status.${status}`)}
                        </option>
                      ))}
                    </select>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  )
}