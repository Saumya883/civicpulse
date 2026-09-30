// app/report/page.tsx
'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth'
import { getFirebaseAuth } from '@/lib/firebase'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/lib/i18n'
import { prepareSpeechModel, transcribeAudio, type SpeechModelName } from '@/lib/speech'
import SiteHeader from '@/components/SiteHeader'

type District = { id: number; name: string; state: string }
type Subcategory = { id: number; name: string }
type VoicePhase = 'idle' | 'loading' | 'recording' | 'transcribing'

const whisperLanguages: Record<string, string> = {
  as: 'assamese', bn: 'bengali', gu: 'gujarati', hi: 'hindi', kn: 'kannada',
  ml: 'malayalam', mr: 'marathi', ne: 'nepali', pa: 'punjabi', sa: 'sanskrit',
  sd: 'sindhi', ta: 'tamil', te: 'telugu', ur: 'urdu',
}

export default function ReportPage() {
  const { lang, t } = useI18n()
  const [districts, setDistricts] = useState<District[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])

  const [districtId, setDistrictId] = useState('')
  const [subcategoryId, setSubcategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [phone, setPhone] = useState('')
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null)
  const [otp, setOtp] = useState('')
  const [idToken, setIdToken] = useState<string | null>(null)
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isLocalRecording, setIsLocalRecording] = useState(false)
  const [voicePhase, setVoicePhase] = useState<VoicePhase>('idle')
  const [voiceModelStatus, setVoiceModelStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [voiceModelProgress, setVoiceModelProgress] = useState<number | null>(null)
  const [voiceModel, setVoiceModel] = useState<SpeechModelName>('small')
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const localChunksRef = useRef<Float32Array[]>([])

  useEffect(() => () => {
    if (processorRef.current) processorRef.current.onaudioprocess = null
    processorRef.current?.disconnect()
    audioSourceRef.current?.disconnect()
    gainRef.current?.disconnect()
    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    if (audioContextRef.current?.state !== 'closed') void audioContextRef.current?.close()
    recaptchaRef.current?.clear()
  }, [])

  useEffect(() => {
    async function loadOptions() {
      const { data: districtData, error: districtErr } = await supabase
        .from('districts')
        .select('id, name, state')
        .order('name')

      const { data: subcatData, error: subcatErr } = await supabase
        .from('subcategories')
        .select('id, name')
        .order('name')

      if (districtErr) setError(`${t('form.loadDistrictsError')}: ${districtErr.message}`)
      if (subcatErr) setError(`${t('form.loadCategoriesError')}: ${subcatErr.message}`)

      if (districtData) setDistricts(districtData)
      if (subcatData) setSubcategories(subcatData)
    }
    loadOptions()
  }, [t])

  useEffect(() => {
    let mounted = true
    void prepareSpeechModel({
      onProgress: (progress) => {
        if (mounted) setVoiceModelProgress(progress)
      },
      onFallback: () => {
        if (mounted) {
          setVoiceModel('tiny')
          setVoiceModelProgress(null)
        }
      },
    }).then((model) => {
      if (!mounted) return
      setVoiceModel(model)
      setVoiceModelProgress(100)
      setVoiceModelStatus('ready')
      setVoiceError(null)
    }).catch((modelError: unknown) => {
      console.error('Could not load local speech model', modelError)
      if (!mounted) return
      setVoiceModelStatus('failed')
      setVoiceError(t('form.voiceModelUnavailable'))
    })

    return () => {
      mounted = false
    }
  }, [t])

  useEffect(() => {
    if (voiceModelStatus !== 'loading') return

    const timeout = window.setTimeout(() => {
      setVoiceModelStatus('failed')
      setVoiceError(t('form.voiceModelUnavailable'))
    }, 90_000)

    return () => window.clearTimeout(timeout)
  }, [t, voiceModelProgress, voiceModelStatus])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!districtId || !subcategoryId || !description || !phone) {
      setError(t('form.required'))
      return
    }

    if (!idToken) {
      setError(t('form.otpRequired'))
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          district_id: Number(districtId),
          subcategory_id: Number(subcategoryId),
          description,
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(`${t('form.submissionError')}: ${result.error ?? t('form.requestError')}`)
        if (response.status === 401) setIdToken(null)
        return
      }
    } catch {
      setError(`${t('form.submissionError')}: ${t('form.requestError')}`)
      return
    } finally {
      setSubmitting(false)
    }

    setSuccess(true)
    setDistrictId('')
    setSubcategoryId('')
    setDescription('')
    setPhone('')
    setConfirmation(null)
    setOtp('')
    setIdToken(null)
  }

  function normalizeIndianPhone(value: string) {
    const compactNumber = value.trim().replace(/[\s()-]/g, '')
    const nationalNumber = compactNumber.startsWith('+91')
      ? compactNumber.slice(3)
      : compactNumber.startsWith('91') && compactNumber.length === 12
        ? compactNumber.slice(2)
        : compactNumber

    return /^[6-9]\d{9}$/.test(nationalNumber) ? `+91${nationalNumber}` : null
  }

  async function sendOtp() {
    setError(null)
    const e164Phone = normalizeIndianPhone(phone)
    if (!e164Phone) {
      setError(t('form.phoneInvalid'))
      return
    }

    setIsSendingOtp(true)
    try {
      const firebaseAuth = getFirebaseAuth()
      const verifier = recaptchaRef.current ?? new RecaptchaVerifier(firebaseAuth, 'recaptcha-container', {
        size: 'invisible',
      })
      recaptchaRef.current = verifier
      setConfirmation(await signInWithPhoneNumber(firebaseAuth, e164Phone, verifier))
      setOtp('')
    } catch (otpError) {
      console.error('Could not send Firebase OTP', otpError)
      recaptchaRef.current?.clear()
      recaptchaRef.current = null
      const firebaseError = otpError as { code?: unknown; message?: unknown }
      const detail = typeof firebaseError.code === 'string'
        ? firebaseError.code
        : typeof firebaseError.message === 'string'
          ? firebaseError.message
          : t('form.requestError')
      setError(`${t('form.otpSendError')}: ${detail}`)
    } finally {
      setIsSendingOtp(false)
    }
  }

  async function verifyOtp() {
    if (!confirmation || !/^\d{6}$/.test(otp.trim())) {
      setError(t('form.otpVerifyError'))
      return
    }

    setError(null)
    setIsVerifyingOtp(true)
    try {
      const credential = await confirmation.confirm(otp.trim())
      setIdToken(await credential.user.getIdToken())
    } catch {
      setError(t('form.otpVerifyError'))
    } finally {
      setIsVerifyingOtp(false)
    }
  }

  function changePhoneNumber() {
    setConfirmation(null)
    setOtp('')
    setIdToken(null)
    setError(null)
    recaptchaRef.current?.clear()
    recaptchaRef.current = null
  }

  async function stopLocalVoiceInput() {
    const audioContext = audioContextRef.current
    const chunks = localChunksRef.current
    if (processorRef.current) processorRef.current.onaudioprocess = null
    processorRef.current?.disconnect()
    audioSourceRef.current?.disconnect()
    gainRef.current?.disconnect()
    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    processorRef.current = null
    audioSourceRef.current = null
    gainRef.current = null
    localStreamRef.current = null
    localChunksRef.current = []
    audioContextRef.current = null
    setIsListening(false)
    setIsLocalRecording(false)
    setVoicePhase('transcribing')

    try {
      if (!audioContext || chunks.length === 0) {
        setVoiceError(t('form.voiceNoSpeech'))
        return
      }

      const sampleCount = chunks.reduce((total, chunk) => total + chunk.length, 0)
      const recording = audioContext.createBuffer(1, sampleCount, audioContext.sampleRate)
      const recordingSamples = recording.getChannelData(0)
      let offset = 0
      for (const chunk of chunks) {
        recordingSamples.set(chunk, offset)
        offset += chunk.length
      }

      await audioContext.close()
      const targetSampleRate = 16_000
      const frameCount = Math.ceil(recording.duration * targetSampleRate)
      const offlineContext = new OfflineAudioContext(1, frameCount, targetSampleRate)
      const source = offlineContext.createBufferSource()
      source.buffer = recording
      source.connect(offlineContext.destination)
      source.start()
      const audioSamples = (await offlineContext.startRendering()).getChannelData(0)
      const transcript = await transcribeAudio(audioSamples, whisperLanguages[lang])
      if (transcript) {
        setDescription((current) => current ? `${current.trimEnd()} ${transcript}` : transcript)
      } else {
        setVoiceError(t('form.voiceNoSpeech'))
      }
    } catch (transcriptionError) {
      console.error('Local speech transcription failed', transcriptionError)
      setVoiceError(t('form.voiceModelError'))
    } finally {
      if (audioContext?.state !== 'closed') await audioContext?.close()
      setVoicePhase('idle')
    }
  }

  async function startLocalVoiceInput() {
    setVoiceError(null)
    setVoicePhase('loading')

    if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === 'undefined') {
      setIsListening(false)
      setVoicePhase('idle')
      setVoiceError(t('form.voiceUnsupported'))
      return
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setIsListening(false)
      setVoicePhase('idle')
      setVoiceError(t('form.voicePermission'))
      return
    }

    let audioContext: AudioContext
    try {
      audioContext = new AudioContext()
      if (audioContext.state === 'suspended') await audioContext.resume()
    } catch {
      stream.getTracks().forEach((track) => track.stop())
      setIsListening(false)
      setVoicePhase('idle')
      setVoiceError(t('form.voiceAudioCapture'))
      return
    }

    localStreamRef.current = stream
    audioContextRef.current = audioContext
    localChunksRef.current = []
    const source = audioContext.createMediaStreamSource(stream)
    const processor = audioContext.createScriptProcessor(4096, 1, 1)
    const gain = audioContext.createGain()
    gain.gain.value = 0
    processor.onaudioprocess = (event) => {
      localChunksRef.current.push(new Float32Array(event.inputBuffer.getChannelData(0)))
    }
    source.connect(processor)
    processor.connect(gain)
    gain.connect(audioContext.destination)
    audioSourceRef.current = source
    processorRef.current = processor
    gainRef.current = gain

    try {
      setIsListening(true)
      setIsLocalRecording(true)
      setVoicePhase('recording')
    } catch {
      processor.disconnect()
      source.disconnect()
      gain.disconnect()
      void audioContext.close()
      stream.getTracks().forEach((track) => track.stop())
      audioContextRef.current = null
      processorRef.current = null
      audioSourceRef.current = null
      gainRef.current = null
      localStreamRef.current = null
      setIsListening(false)
      setIsLocalRecording(false)
      setVoicePhase('idle')
      setVoiceError(t('form.voiceAudioCapture'))
    }
  }

  function toggleVoiceInput() {
    if (isLocalRecording) {
      void stopLocalVoiceInput()
      return
    }
    void startLocalVoiceInput()
  }

  if (success) {
    return (
      <main className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
        <div className="mx-auto max-w-5xl px-6">
          <SiteHeader />
          <section className="mx-auto mt-20 max-w-md text-center">
            <div className="card p-8">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-2xl" style={{ background: 'var(--card5)' }}>
                ✓
              </div>
              <h1 className="text-2xl font-semibold text-[var(--fg)]">{t('form.thanks')}</h1>
              <p className="mt-2 text-[var(--muted)]">{t('success.body')}</p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  href="/"
                  className="rounded-md border px-6 py-2.5 font-medium text-[var(--fg)]"
                  style={{ borderColor: 'var(--border)' }}
                >
                  {t('success.home')}
                </Link>
                <button
                  type="button"
                  onClick={() => setSuccess(false)}
                  className="rounded-md px-6 py-2.5 font-medium"
                  style={{ background: 'var(--btn)', color: 'var(--btn-fg)' }}
                >
                  {t('success.another')}
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <div className="mx-auto max-w-5xl px-6">
        <SiteHeader />
        <section className="mx-auto max-w-md py-8">
      <h1 className="mb-6 text-2xl font-semibold text-[var(--fg)]">{t('form.title')}</h1>

      {error && (
        <div role="alert" className="error-message mb-4 rounded-md border p-3 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--fg)]">
            {t('form.district')}
          </label>
          <select
            value={districtId}
            onChange={(e) => setDistrictId(e.target.value)}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--fg)]"
          >
            <option value="">{t('form.districtPlaceholder')}</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}, {d.state}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--fg)]">
            {t('form.category')}
          </label>
          <select
            value={subcategoryId}
            onChange={(e) => setSubcategoryId(e.target.value)}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--fg)]"
          >
            <option value="">{t('form.categoryPlaceholder')}</option>
            {subcategories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--fg)]">
            {t('form.description')}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--fg)] placeholder:text-[var(--muted)]"
            placeholder={t('form.descriptionPlaceholder')}
          />
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={toggleVoiceInput}
              disabled={voicePhase === 'transcribing' || (voiceModelStatus !== 'ready' && !isListening)}
              aria-pressed={isListening}
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--fg)] hover:bg-[var(--card1)]"
            >
              {voicePhase === 'transcribing'
                ? t('form.voiceTranscribing')
                : isListening
                  ? t('form.voiceStop')
                  : voiceModelStatus === 'loading'
                    ? voiceModelProgress === null
                      ? t('form.voiceModelLoading')
                      : `${t('form.voiceModelDownloading')} ${voiceModelProgress}%`
                    : voiceModelStatus === 'failed'
                      ? t('form.voiceModelError')
                      : t('form.voiceStart')}
            </button>
            {voiceModelStatus === 'ready' && voiceModel === 'tiny' && !isListening && (
              <span role="status" className="text-sm text-[var(--muted)]">{t('form.voiceModelFallback')}</span>
            )}
            {voicePhase !== 'idle' && (
              <span role="status" className="text-sm text-[var(--muted)]">
                {voicePhase === 'loading'
                  ? t('form.voiceLocalLoading')
                  : voicePhase === 'transcribing'
                    ? t('form.voiceTranscribing')
                    : isLocalRecording ? t('form.voiceLocalListening') : t('form.voiceListening')}
              </span>
            )}
          </div>
          {voiceError && <p role="alert" className="error-message mt-2 text-sm">{voiceError}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--fg)]">
            {t('form.phone')}
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value)
              setConfirmation(null)
              setIdToken(null)
            }}
            disabled={Boolean(confirmation) || Boolean(idToken) || isSendingOtp}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--fg)] placeholder:text-[var(--muted)] disabled:opacity-70"
            placeholder={t('form.phonePlaceholder')}
          />
          <p className="mt-1 text-xs text-[var(--muted)]">{t('form.phoneHint')}</p>
          <div id="recaptcha-container" />
          {!confirmation && !idToken && (
            <button
              type="button"
              onClick={sendOtp}
              disabled={isSendingOtp}
              className="mt-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--fg)] hover:bg-[var(--card1)] disabled:opacity-50"
            >
              {isSendingOtp ? t('form.sendingOtp') : t('form.sendOtp')}
            </button>
          )}
          {confirmation && !idToken && (
            <div className="mt-3 space-y-2">
              <p role="status" className="text-sm text-[var(--muted)]">{t('form.otpSent')}</p>
              <label className="block text-sm font-medium text-[var(--fg)]" htmlFor="report-otp">
                {t('form.otpLabel')}
              </label>
              <input
                id="report-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))}
                placeholder={t('form.otpPlaceholder')}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--fg)] placeholder:text-[var(--muted)]"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={verifyOtp}
                  disabled={isVerifyingOtp || otp.length !== 6}
                  className="rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50"
                  style={{ background: 'var(--btn)', color: 'var(--btn-fg)' }}
                >
                  {isVerifyingOtp ? t('form.verifyingOtp') : t('form.verifyOtp')}
                </button>
                <button type="button" onClick={changePhoneNumber} className="text-sm text-[var(--muted)] underline">
                  {t('form.changePhone')}
                </button>
              </div>
            </div>
          )}
          {idToken && (
            <p role="status" className="mt-2 text-sm font-medium text-[var(--dot5)]">
              {t('form.verifiedPhone')}
              <button type="button" onClick={changePhoneNumber} className="ml-3 text-[var(--muted)] underline">
                {t('form.changePhone')}
              </button>
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md px-4 py-2 font-medium disabled:opacity-50"
          style={{ background: 'var(--btn)', color: 'var(--btn-fg)' }}
        >
          {submitting ? t('form.submitting') : t('form.submit')}
        </button>
      </form>
        </section>
      </div>
    </main>
  )
}