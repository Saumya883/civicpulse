import { GoogleGenAI } from '@google/genai'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const messagesDir = path.join(root, 'messages')
const outputDir = path.join(root, 'public', 'messages')
const apiKey = process.env.GEMINI_API_KEY
const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash'
const only = process.env.LANGS
  ? process.env.LANGS.split(',').map((code) => code.trim().toLowerCase()).filter(Boolean)
  : null

if (!apiKey) {
  console.error('GEMINI_API_KEY is not set')
  process.exit(1)
}

const ai = new GoogleGenAI({ apiKey })
const en = JSON.parse(fs.readFileSync(path.join(messagesDir, 'en.json'), 'utf8'))
fs.mkdirSync(outputDir, { recursive: true })
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const langs = {
  hi: 'Hindi', pa: 'Punjabi (Gurmukhi)', ta: 'Tamil', bn: 'Bengali',
  te: 'Telugu', mr: 'Marathi', gu: 'Gujarati', kn: 'Kannada', ml: 'Malayalam',
  or: 'Odia', as: 'Assamese', ur: 'Urdu', ne: 'Nepali', sa: 'Sanskrit',
  kok: 'Konkani (Devanagari)', mai: 'Maithili', doi: 'Dogri (Devanagari)',
  brx: 'Bodo (Devanagari)', ks: 'Kashmiri (Perso-Arabic)', mni: 'Manipuri (Meitei Mayek)',
  sat: 'Santali (Ol Chiki)', sd: 'Sindhi (Perso-Arabic)',
}
const unknownLanguages = only?.filter((code) => !(code in langs)) ?? []
if (unknownLanguages.length) {
  console.error('Unknown language codes:', unknownLanguages.join(', '))
  process.exit(1)
}

const sourceKeys = Object.keys(en).sort()
const failedLanguages = []
let quotaExhausted = false
let authenticationFailed = false

for (const [code, name] of Object.entries(langs)) {
  if (only && !only.includes(code)) continue

  const outputPath = path.join(outputDir, `${code}.json`)
  if (fs.existsSync(outputPath)) {
    try {
      const existingMessages = JSON.parse(fs.readFileSync(outputPath, 'utf8'))
      const existingKeys = Object.keys(existingMessages).sort()
      if (
        JSON.stringify(sourceKeys) === JSON.stringify(existingKeys) &&
        Object.values(existingMessages).every((value) => typeof value === 'string')
      ) {
        console.log('skip', code)
        continue
      }
      console.log('update', code, '(message keys changed)')
    } catch {
      console.log('update', code, '(invalid JSON)')
    }
  }

  let translated = false
  for (let attempt = 1; attempt <= 3 && !translated; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: `Translate the VALUES of this JSON into ${name}. Keep keys unchanged. Use simple words a village resident would understand. Return only JSON.\n${JSON.stringify(en)}`,
        config: { responseMimeType: 'application/json' },
      })

      const text = (response.text ?? '').replace(/```(?:json)?/gi, '').trim()
      const messages = JSON.parse(text)
      const translatedKeys = Object.keys(messages).sort()
      if (
        !messages || typeof messages !== 'object' || Array.isArray(messages) ||
        JSON.stringify(sourceKeys) !== JSON.stringify(translatedKeys) ||
        Object.values(messages).some((value) => typeof value !== 'string')
      ) {
        throw new Error('Translation JSON must contain the same string keys as en.json.')
      }

      fs.writeFileSync(outputPath, `${JSON.stringify(messages, null, 2)}\n`)
      console.log('done', code)
      translated = true
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const errorCode = typeof error === 'object' && error !== null && 'status' in error
        ? error.status
        : undefined
      const statusInMessage = message.match(/"code"\s*:\s*(\d{3})/)?.[1]
      const status = typeof errorCode === 'number' ? errorCode : Number(statusInMessage)
      const isQuotaError = errorCode === 429 || /\b429\b|RESOURCE_EXHAUSTED/i.test(message)
      console.log(`fail ${code} (attempt ${attempt}):`, message.slice(0, 120))

      if (status === 401 || status === 403) {
        console.error('Gemini rejected the API key. Check GEMINI_API_KEY and replace it if it was revoked.')
        authenticationFailed = true
        break
      }

      if (isQuotaError && attempt === 3) {
        console.log('Quota exhausted. Stopping. Wait, or enable billing, then re-run.')
        quotaExhausted = true
        break
      }

      if (attempt < 3) await sleep(isQuotaError ? 45_000 : attempt * 10_000)
    }
  }

  if (quotaExhausted || authenticationFailed) break
  if (!translated) failedLanguages.push(code)
  await sleep(8_000)
}

console.log('finished')
if (quotaExhausted || authenticationFailed || failedLanguages.length) {
  if (failedLanguages.length) {
  console.error('Failed languages:', failedLanguages.join(', '))
  }
  process.exitCode = 1
}