import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const adminAppName = 'civicpulse-report-admin'

function getFirebaseAdminAuth() {
  const existingApp = getApps().find((app) => app.name === adminAppName)
  if (existingApp) return getAuth(existingApp)

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin environment variables are missing.')
  }

  const app = initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
  }, adminAppName)

  return getAuth(app)
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { idToken, district_id, subcategory_id, description } = body as Record<string, unknown>
  if (
    typeof idToken !== 'string' || idToken.length > 10_000 ||
    !Number.isSafeInteger(district_id) || Number(district_id) <= 0 ||
    !Number.isSafeInteger(subcategory_id) || Number(subcategory_id) <= 0 ||
    typeof description !== 'string' || !description.trim() || description.length > 5_000
  ) {
    return NextResponse.json({ error: 'Check the report details and try again.' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey || !process.env.FIREBASE_PROJECT_ID ||
      !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    return NextResponse.json({ error: 'Report submission is not configured.' }, { status: 503 })
  }

  let verifiedPhone: string | undefined
  try {
    const decodedToken = await getFirebaseAdminAuth().verifyIdToken(idToken)
    verifiedPhone = decodedToken.phone_number
  } catch {
    return NextResponse.json({ error: 'Phone verification failed. Please verify again.' }, { status: 401 })
  }

  if (!verifiedPhone) {
    return NextResponse.json({ error: 'The verified account has no phone number.' }, { status: 401 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await supabase.from('citizen_requests').insert({
    district_id,
    subcategory_id,
    description: description.trim(),
    reporter_phone: verifiedPhone,
    status: 'submitted',
  })

  if (error) {
    return NextResponse.json({ error: 'Could not submit the report. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}