// Token validators. github/openai/google hit their APIs; jwt is decoded
// offline (expiry only). Returns { status, detail, endpoint }.
import { SERVICES } from "./services.mjs"

const TIMEOUT = 10000

function b64urlDecode(s) {
  let t = s.replace(/-/g, "+").replace(/_/g, "/")
  const pad = t.length % 4 ? "=".repeat(4 - (t.length % 4)) : ""
  return Buffer.from(t + pad, "base64").toString("utf8")
}

function decodeJwtPayload(token) {
  const seg = token.split(".")
  if (seg.length < 2) throw new Error("not a JWT")
  return JSON.parse(b64urlDecode(seg[1]))
}

function validateJwt(token) {
  const payload = decodeJwtPayload(token)
  const exp = payload.exp
  if (!exp) return { status: "unknown", detail: "no exp claim" }
  return exp * 1000 < Date.now()
    ? { status: "expired", detail: `expired ${new Date(exp * 1000).toISOString()}` }
    : { status: "offline", detail: `expires ${new Date(exp * 1000).toISOString()} (not verified live)` }
}

async function fetchText(url, headers, timeout) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal })
    const body = await res.text()
    return { status: res.status, body }
  } finally {
    clearTimeout(t)
  }
}

async function validateHttp(type, value) {
  const svc = SERVICES[type]
  if (type === "github") {
    const endpoint = svc.endpoint
    const { status, body } = await fetchText(endpoint, { Authorization: `Bearer ${value}`, Accept: "application/vnd.github+json" }, TIMEOUT)
    if (status === 200) {
      const login = JSON.parse(body).login
      return { status: "valid", detail: `user: ${login}`, endpoint }
    }
    if (status === 401) return { status: "invalid", detail: "401", endpoint }
    return { status: "error", detail: String(status), endpoint }
  }
  if (type === "openai") {
    const endpoint = svc.endpoint
    const { status } = await fetchText(endpoint, { Authorization: `Bearer ${value}` }, TIMEOUT)
    if (status === 200) return { status: "valid", detail: "models accessible", endpoint }
    if (status === 401) return { status: "invalid", detail: "401", endpoint }
    return { status: "error", detail: String(status), endpoint }
  }
  if (type === "google") {
    for (const tpl of svc.endpoints) {
      const url = tpl.replace("{key}", value)
      const { status, body } = await fetchText(url, {}, TIMEOUT)
      let err
      try {
        const j = JSON.parse(body)
        if (j.error) err = j.error
      } catch {
        /* non-JSON error body */
      }
      const msg = err?.message || ""
      if (err && /api key not valid|api key .* invalid|key is (invalid|expired)/i.test(msg)) {
        const code = err.code || status
        return { status: "invalid", detail: String(code), endpoint: url }
      }
      if (status === 200) return { status: "valid", detail: `accepted by ${url.split("?")[0].split("/")[3] || "api"}`, endpoint: url }
    }
    return { status: "limited", detail: "valid but not enabled for tested APIs", endpoint: svc.endpoints[0].replace("{key}", value) }
  }
  return { status: "unsupported", detail: "no validator for this token type" }
}

export async function validateToken(type, value) {
  try {
    if (type === "jwt") return validateJwt(value)
    return await validateHttp(type, value)
  } catch (e) {
    return { status: "error", detail: String(e?.message || e) }
  }
}

export async function validateAll(tokens, { concurrency = 8 } = {}) {
  const results = new Map()
  let i = 0
  async function worker() {
    while (i < tokens.length) {
      const tok = tokens[i++]
      const key = `${tok.type}|${tok.value}`
      if (results.has(key)) {
        tok.validation = results.get(key)
        continue
      }
      const v = await validateToken(tok.type, tok.value)
      results.set(key, v)
      tok.validation = v
    }
  }
  const n = Math.min(concurrency, tokens.length || 1)
  await Promise.all(Array.from({ length: n }, worker))
  return tokens
}
