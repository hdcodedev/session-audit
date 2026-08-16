// Scan exported sessions, build a per-project analysis structure, and collect
// unique validatable tokens. Uses ripgrep when available (fast), else pure JS.
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { PATTERNS } from "./patterns.mjs"

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

  for (const pat of PATTERNS) {
    if (pat.noisy && !includeNoisy) continue
    const matches = useRgNow ? rgScan(dir, pat.src) : jsScan(dir, pat.src)
    for (const { file, match } of matches) {
      const id = file.split("/").pop().replace(/\.json$/, "")
      const m = meta[id]
      const pid = m ? m.pid : "unknown"
      const p = projects.get(pid)
      if (!p) continue
      let cat = p.findings.get(pat.label)
      if (!cat) {
        cat = { category: pat.label, validate: pat.validate || null, count: 0, samples: [] }
        p.findings.set(pat.label, cat)
      }
      cat.count++
      if (cat.samples.length < 20) cat.samples.push({ value: match, sessionId: id })
      if (pat.validate) {
        const key = `${pat.validate}|${match}`
        if (!tokens.has(key)) tokens.set(key, { type: pat.validate, value: match, sessionId: id })
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
  return { dir, projectCount: projectsOut.length, sessionCount: files.length, projects: projectsOut, tokens: [...tokens.values()] }
}
