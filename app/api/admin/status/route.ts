import { timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const allowedStatuses = ['submitted', 'under_review', 'prioritized', 'resolved'] as const

function isAuthorized(request: Request) {
  const expectedKey = process.env.ADMIN_KEY
  const providedKey = request.headers.get('x-admin-key')
  if (!expectedKey || !providedKey) return false

  const expected = Buffer.from(expectedKey)
  const provided = Buffer.from(providedKey)
  return expected.length === provided.length && timingSafeEqual(expected, provided)
}

function getDatabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) return null

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function GET(request: Request) {
  if (!process.env.ADMIN_KEY) {
    return jsonResponse({ error: 'Admin access is not configured.' }, 503)
  }
  if (!isAuthorized(request)) return jsonResponse({ error: 'Unauthorized.' }, 401)

  const database = getDatabase()
  if (!database) return jsonResponse({ error: 'Report access is not configured.' }, 503)

  try {
    const { data, error } = await database
      .from('citizen_requests')
      .select('id, district_id, description, reporter_phone, status, created_at')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) return jsonResponse({ error: 'Could not load reports.' }, 500)
    return jsonResponse({ data: data ?? [] })
  } catch {
    return jsonResponse({ error: 'Could not load reports.' }, 500)
  }
}

export async function PATCH(request: Request) {
  if (!process.env.ADMIN_KEY) {
    return jsonResponse({ error: 'Admin access is not configured.' }, 503)
  }
  if (!isAuthorized(request)) return jsonResponse({ error: 'Unauthorized.' }, 401)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid request.' }, 400)
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonResponse({ error: 'Invalid request.' }, 400)
  }

  const { id, status } = body as Record<string, unknown>
  if (
    typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0 ||
    typeof status !== 'string' || !allowedStatuses.includes(status as typeof allowedStatuses[number])
  ) {
    return jsonResponse({ error: 'Invalid report ID or status.' }, 400)
  }

  const database = getDatabase()
  if (!database) return jsonResponse({ error: 'Report access is not configured.' }, 503)

  try {
    const { data, error } = await database
      .from('citizen_requests')
      .update({ status })
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (error) return jsonResponse({ error: 'Could not update report status.' }, 500)
    if (!data) return jsonResponse({ error: 'Report not found.' }, 404)
    return jsonResponse({ ok: true })
  } catch {
    return jsonResponse({ error: 'Could not update report status.' }, 500)
  }
}