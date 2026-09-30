'use client'

export default function ThemeToggle() {
  function toggleTheme() {
    const root = document.documentElement
    const nextTheme = root.dataset.theme === 'dark' ? 'light' : 'dark'
    root.dataset.theme = nextTheme
    try {
      localStorage.setItem('theme', nextTheme)
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle color theme"
      title="Toggle color theme"
      className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)]"
    >
      <span className="theme-toggle__light" aria-hidden="true">☾</span>
      <span className="theme-toggle__dark" aria-hidden="true">☼</span>
    </button>
  )
}