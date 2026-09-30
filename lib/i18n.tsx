'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { LANGUAGES } from './languages'
import en from '@/messages/en.json'

type Messages = Record<string, string>
type I18nContextValue = {
  lang: string
  translationUnavailable: boolean
  setLang: (code: string) => Promise<void>
  t: (key: string) => string
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  translationUnavailable: false,
  setLang: async () => {},
  t: (key) => key,
})

export const useI18n = () => useContext(I18nContext)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState('en')
  const [messages, setMessages] = useState<Messages>(en)
  const [translationUnavailable, setTranslationUnavailable] = useState(false)

  async function setLang(code: string) {
    if (!LANGUAGES.some((language) => language.code === code)) return

    if (code === 'en') {
      setMessages(en)
      setLangState('en')
      setTranslationUnavailable(false)
      localStorage.setItem('lang', 'en')
      document.documentElement.lang = 'en'
      document.documentElement.dir = 'ltr'
      return
    }

    try {
      const response = await fetch(`/messages/${code}.json`)
      if (!response.ok) throw new Error('Translation catalog not found')

      const translatedMessages = (await response.json()) as Messages
      setMessages({ ...en, ...translatedMessages })
      setLangState(code)
      setTranslationUnavailable(false)
      localStorage.setItem('lang', code)
      document.documentElement.lang = code
      document.documentElement.dir = LANGUAGES.find((language) => language.code === code)?.rtl ? 'rtl' : 'ltr'
    } catch {
      setMessages(en)
      setLangState('en')
      setTranslationUnavailable(true)
      localStorage.setItem('lang', 'en')
      document.documentElement.lang = 'en'
      document.documentElement.dir = 'ltr'
    }
  }

  useEffect(() => {
    const savedLanguage = localStorage.getItem('lang')
    if (savedLanguage && savedLanguage !== 'en') {
      void Promise.resolve().then(() => setLang(savedLanguage))
    }
  }, [])

  return (
    <I18nContext.Provider value={{ lang, translationUnavailable, setLang, t: (key) => messages[key] ?? key }}>
      {children}
    </I18nContext.Provider>
  )
}