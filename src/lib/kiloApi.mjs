// Kilo Cloud API client: list + export sessions using the user's Kilo token.
import { mkdirSync, writeFileSync } from "node:fs"
const API = "https://api.kilo.ai"
const INGEST = "https://ingest.kilosessions.ai"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function auth(token) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
}

async function listOnce(token, cursor) {
  const query = {}
  if (cursor) query.cursor = cursor
  const params = new URLSearchParams({ batch: "1", input: JSON.stringify({ "0": query }) })
  const res = await fetch(`${API}/api/trpc/cliSessionsV2.list?${params}`, { headers: auth(token) })
  if (!res.ok) throw new Error(`list failed: ${res.status}`)
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
    const { sessions, next } = await listOnce(token, cursor)
    out.push(...sessions)
    cursor = next || undefined
  } while (cursor)
  return out
}

function exportUrl(id) {
  return UUID.test(id) ? `${INGEST}/session/${id}` : `${INGEST}/api/session/${id}/export`
}

export async function exportSession(token, id, timeout = 30000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(exportUrl(id), { headers: auth(token), signal: ctrl.signal })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`export ${id} failed: ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

export async function download(token, dir, onProgress) {
  mkdirSync(dir, { recursive: true })
  const sessions = await listSessions(token)
  let done = 0
  for (const s of sessions) {
    const data = await exportSession(token, s.id).catch(() => null)
    if (data) writeFileSync(`${dir}/${s.id}.json`, JSON.stringify(data))
    done++
    onProgress?.(done, sessions.length, s.id)
  }
  writeFileSync(`${dir}/_manifest.json`, JSON.stringify(sessions, null, 2))
  return { dir, count: sessions.length }
}
