// Small pure helpers shared by the CLI and HTML renderers.

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))
}

export function relativeTime(from, to = Date.now()) {
  const then = new Date(from).getTime()
  if (Number.isNaN(then)) return ""
  const diff = to - then
  const abs = Math.abs(diff)
  const units = [
    ["year", 31536000000],
    ["month", 2592000000],
    ["week", 604800000],
    ["day", 86400000],
    ["hour", 3600000],
    ["minute", 60000],
  ]
  for (const [name, ms] of units) {
    const v = Math.floor(abs / ms)
    if (v >= 1) return diff >= 0 ? `${v} ${name}${v > 1 ? "s" : ""} ago` : `in ${v} ${name}${v > 1 ? "s" : ""}`
  }
  return diff >= 0 ? "just now" : "in a moment"
}

// Replace ISO timestamps inside a detail string with a relative phrase
// (e.g. "expired 2026-07-28T09:04:00.000Z" -> "expired 3 weeks ago").
export function formatDetail(detail) {
  if (!detail) return ""
  return detail.replace(/(\d{4}-\d{2}-\d{2}T[\d:.]+Z)/g, (iso) =>
    Number.isNaN(new Date(iso).getTime()) ? iso : relativeTime(iso),
  )
}

export function projectFindingCount(p) {
  return p.findings.reduce((s, f) => s + f.count, 0)
}

export function isGlobal(p) {
  return p.projectId === "global" || p.directory === "global"
}

// Global project first, then by finding count (most findings on top).
export function sortProjectsByFindings(projects) {
  return [...projects].sort((a, b) => {
    if (isGlobal(a) !== isGlobal(b)) return isGlobal(a) ? -1 : 1
    return projectFindingCount(b) - projectFindingCount(a)
  })
}
