'use client'

import { LANGUAGES } from '@/lib/languages'
import { useI18n } from '@/lib/i18n'

export default function LanguageSwitcher() {
  const { lang, setLang, translationUnavailable, t } = useI18n()

  return (
    <div>
      <select
        id="language-switcher"
        aria-label="Language"
        value={lang}
        onChange={(event) => void setLang(event.target.value)}
        className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--fg)]"
      >
        {LANGUAGES.map((language) => (
          <option key={language.code} value={language.code} className="text-black">
            {language.native}
          </option>
        ))}
      </select>
      {translationUnavailable && (
        <p role="status" className="absolute right-6 mt-2 max-w-64 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--fg)] shadow-lg">
          {t('language.unavailable')}
        </p>
      )}
    </div>
  )
}