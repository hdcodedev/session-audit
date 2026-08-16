// Token validators. github/openai/google hit their APIs; jwt is decoded
// offline (expiry only). Returns { status, detail }.
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
    : { status: "valid", detail: `expires ${new Date(exp * 1000).toISOString()}` }
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
  if (type === "github") {
    const { status, body } = await fetchText("https://api.github.com/user", { Authorization: `Bearer ${value}`, Accept: "application/vnd.github+json" }, TIMEOUT)
    if (status === 200) {
      const login = JSON.parse(body).login
      return { status: "valid", detail: `user: ${login}` }
    }
    if (status === 401) return { status: "invalid", detail: "bad credentials" }
    return { status: "error", detail: `HTTP ${status}` }
  }
  if (type === "openai") {
    const { status } = await fetchText("https://api.openai.com/v1/models", { Authorization: `Bearer ${value}` }, TIMEOUT)
    if (status === 200) return { status: "valid", detail: "models accessible" }
    if (status === 401) return { status: "invalid", detail: "bad credentials" }
    return { status: "error", detail: `HTTP ${status}` }
  }
  if (type === "google") {
    const endpoints = [
      "https://generativelanguage.googleapis.com/v1beta/models?key=",
      "https://translation.googleapis.com/language/translate/v2?q=hi&target=es&format=text&key=",
      "https://maps.googleapis.com/maps/api/geocode/json?address=test&key=",
      "https://www.googleapis.com/youtube/v3/videos?part=snippet&id=dQw4w9WgXcQ&key=",
    ]
    for (const base of endpoints) {
      const { status, body } = await fetchText(base + value, {}, TIMEOUT)
      if (/api key not valid/i.test(body)) return { status: "invalid", detail: "API key not valid" }
      if (status === 200) return { status: "valid", detail: `accepted by ${base.split("?")[0].split("/")[3] || "api"}` }
    }
    return { status: "restricted", detail: "valid but not enabled for tested APIs" }
  }
  return { status: "unknown", detail: "no validator" }
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
