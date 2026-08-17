// Scan exported sessions, build a per-project analysis structure, and collect
// unique validatable tokens. Uses ripgrep when available (fast), else pure JS.
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { PATTERNS } from "./patterns.mjs"
import { matchExclusion } from "./filters.mjs"

// JWTs are validated (offline) by the JWT pattern below, so reuse its source
// to skip them from the unvalidated Bearer list and avoid double-reporting.
const JWT_RE = new RegExp(`^(?:${PATTERNS.find((p) => p.validate === "jwt").src})$`)

function hasRg() {
  return spawnSync("rg", ["--version"], { stdio: "ignore" }).status === 0
}

function rgScan(dir, src) {
  const out = spawnSync("rg", ["-No", "--color=never", "-g", "*.json", "-e", src, dir], {
    encoding: "utf8",
    maxBuffer: 200 * 1024 * 1024,
  })
  const lines = (out.stdout || "").split("\n").filter(Boolean)
  return lines.map((l) => {
    const i = l.indexOf(":")
    return { file: l.slice(0, i), match: l.slice(i + 1) }
  })
}

function jsScan(dir, src) {
  const re = new RegExp(src, "g")
  const out = []
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".json") || f === "_manifest.json") continue
    const raw = readFileSync(join(dir, f), "utf8")
    let m
    re.lastIndex = 0
    while ((m = re.exec(raw)) !== null) {
      out.push({ file: f, match: m[0] })
      if (m.index === re.lastIndex) re.lastIndex++
    }
  }
  return out
}

function safeRead(p) {
  try {
    return readFileSync(p, "utf8")
  } catch {
    return null
  }
}

// Find the URL closest to a matched secret within a window, so we can record
// where a token (e.g. a Bearer token) was actually used for manual validation.
function nearestUrl(raw, idx, len, window = 800) {
  const start = Math.max(0, idx - window)
  const end = Math.min(raw.length, idx + len + window)
  const slice = raw.slice(start, end)
  const urlRe = /https?:\/\/[^\s"',)\]}\\]*(?:\\\/[^\s"',)\]}\\]*)*/g
  const rel = idx - start
  let best = null
  let bestDist = Infinity
  let m
  while ((m = urlRe.exec(slice)) !== null) {
    const uStart = m.index
    const uEnd = m.index + m[0].length
    const dist = uStart <= rel ? rel - uEnd : uStart - (rel + len)
    if (dist >= 0 && dist < bestDist) {
      bestDist = dist
      best = m[0]
    }
  }
  return best ? best.replace(/\\\//g, "/") : best
}

export async function scan(dir, { includeNoisy = false, useRg = true } = {}) {
  const files = readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "_manifest.json" && f !== "analysis.json")
  const meta = {}
  const projects = new Map()

  for (const f of files) {
    const raw = readFileSync(join(dir, f), "utf8")
    const id = f.slice(0, -5)
    const pid = raw.match(/"projectID"\s*:\s*"([^"]*)"/)?.[1] || "unknown"
    const directory = raw.match(/"directory"\s*:\s*"([^"]*)"/)?.[1] || "unknown"
    const title = raw.match(/"title"\s*:\s*"([^"]*)"/)?.[1] || ""
    const updated = Number(raw.match(/"updated"\s*:\s*(\d+)/)?.[1] || 0)
    meta[id] = { pid, directory, title, updated }
    let p = projects.get(pid)
    if (!p) {
      p = { projectId: pid, directory, sessions: [], findings: new Map() }
      projects.set(pid, p)
    }
    if (!p.sessions.includes(id)) p.sessions.push(id)
  }

  const useRgNow = useRg && hasRg()
  const tokens = new Map()
  const detectedUnvalidated = new Map()
  const excluded = new Map()
  const rawCache = new Map()
  const getRaw = (id) => {
    if (!rawCache.has(id)) rawCache.set(id, safeRead(join(dir, `${id}.json`)))
    return rawCache.get(id)
  }

  for (const pat of PATTERNS) {
    if (pat.noisy && !includeNoisy) continue
    const matches = useRgNow ? rgScan(dir, pat.src) : jsScan(dir, pat.src)
    for (const { file, match } of matches) {
      const id = file.split("/").pop().replace(/\.json$/, "")
      const m = meta[id]
      const pid = m ? m.pid : "unknown"
      const p = projects.get(pid)
      if (!p) continue
      let value = match
      let usedAt = null
      if (pat.context) {
        const raw = getRaw(id)
        if (raw) {
          const idx = raw.indexOf(match)
          if (idx >= 0) usedAt = nearestUrl(raw, idx, match.length)
        }
        value = match.replace(/^Bearer\s+/i, "").trim()
      }

      const exId = matchExclusion(pat.label, value, { raw: match, sessionId: id })
      if (exId) {
        excluded.set(exId, (excluded.get(exId) || 0) + 1)
        continue
      }

      let cat = p.findings.get(pat.label)
      if (!cat) {
        cat = { category: pat.label, validate: pat.validate || null, count: 0, samples: [] }
        p.findings.set(pat.label, cat)
      }
      cat.count++
      if (cat.samples.length < 20) cat.samples.push({ value, sessionId: id, usedAt: usedAt || undefined })
      if (pat.validate) {
        const key = `${pat.validate}|${value}`
        if (!tokens.has(key)) tokens.set(key, { type: pat.validate, value, sessionId: id })
      } else if (pat.context) {
        // JWTs are already validated (offline) by the JWT pattern, so don't
        // also list them as unvalidated Bearer tokens.
        if (JWT_RE.test(value)) continue
        const key = `${pat.label}|${value}`
        if (!detectedUnvalidated.has(key)) {
          detectedUnvalidated.set(key, {
            label: pat.label,
            value,
            usedAt: usedAt || undefined,
            sessionId: id,
            directory: p.directory,
          })
        }
      }
    }
  }

  const projectsOut = [...projects.values()].map((p) => ({
    projectId: p.projectId,
    directory: p.directory,
    sessionCount: p.sessions.length,
    sessions: p.sessions,
    findings: [...p.findings.values()],
  }))
  return {
    dir,
    projectCount: projectsOut.length,
    sessionCount: files.length,
    projects: projectsOut,
    tokens: [...tokens.values()],
    detectedUnvalidated: [...detectedUnvalidated.values()],
    excluded: [...excluded.entries()].map(([id, count]) => ({ id, count })),
  }
}
