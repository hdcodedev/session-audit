// Kilo Cloud API client: list + export sessions using the user's Kilo token.
import { mkdirSync, writeFileSync } from "node:fs"
const API = "https://api.kilo.ai"
const INGEST = "https://ingest.kilosessions.ai"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function auth(token) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
}

async function withRetry(fn, { retries = 10, base = 2000, max = 60000 } = {}) {
  let attempt = 0
  for (;;) {
    try {
      return await fn()
    } catch (err) {
      if (attempt >= retries || err.noRetry) throw err
      const backoff = Math.min(max, base * 2 ** attempt)
      const jitter = Math.random() * backoff * 0.2
      const delay = Math.round(backoff + jitter)
      await new Promise((r) => setTimeout(r, delay))
      attempt++
    }
  }
}

function noRetry(err) {
  return Object.assign(err, { noRetry: true })
}

async function pool(items, limit, worker) {
  const out = []
  let i = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++
      out[idx] = await worker(items[idx], idx)
    }
  })
  await Promise.all(runners)
  return out
}

async function listOnce(token, cursor) {
  const query = {}
  if (cursor) query.cursor = cursor
  const params = new URLSearchParams({ batch: "1", input: JSON.stringify({ "0": query }) })
  const res = await fetch(`${API}/api/trpc/cliSessionsV2.list?${params}`, { headers: auth(token) })
  if (res.status >= 500 || res.status === 429) throw new Error(`list failed: ${res.status}`)
  if (!res.ok) throw noRetry(new Error(`list failed: ${res.status}`))
  const json = await res.json()
  const data = Array.isArray(json) ? json[0]?.result?.data : null
  const result = data?.json ?? data
  const sessions = (result?.cliSessions ?? []).map((s) => ({
    id: s.session_id,
    title: s.title ?? null,
    updated: s.updated_at ?? null,
  }))
  return { sessions, next: result?.nextCursor ?? null }
}

export async function listSessions(token) {
  const out = []
  let cursor
  do {
    const { sessions, next } = await withRetry(() => listOnce(token, cursor))
    out.push(...sessions)
    cursor = next || undefined
  } while (cursor)
  return out
}

function exportUrl(id) {
  return UUID.test(id) ? `${INGEST}/session/${id}` : `${INGEST}/api/session/${id}/export`
}

export async function exportSession(token, id, timeout = 30000) {
  return withRetry(async () => {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeout)
    try {
      const res = await fetch(exportUrl(id), { headers: auth(token), signal: ctrl.signal })
      if (res.status === 404) return null
      if (res.status >= 500 || res.status === 429) throw new Error(`export ${id} failed: ${res.status}`)
      if (!res.ok) throw noRetry(new Error(`export ${id} failed: ${res.status}`))
      return await res.json()
    } finally {
      clearTimeout(t)
    }
  })
}

export async function download(token, dir, onProgress) {
  mkdirSync(dir, { recursive: true })

  const sessions = await listSessions(token)

  const concurrency = 8
  let done = 0
  await pool(sessions, concurrency, async (s) => {
    const data = await exportSession(token, s.id).catch(() => null)
    if (data) writeFileSync(`${dir}/${s.id}.json`, JSON.stringify(data))
    done++
    onProgress?.(done, sessions.length, s.id)
  })

  writeFileSync(`${dir}/_manifest.json`, JSON.stringify(sessions, null, 2))
  return { dir, count: sessions.length }
}
