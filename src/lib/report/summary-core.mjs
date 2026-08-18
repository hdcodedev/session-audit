// Aggregates raw analysis into the counts shown in the CLI summary and the
// HTML header cards. Kept dependency-free so both renderers can import it.
import { STATUS_ORDER } from "./status.mjs"

export function computeSummary(analysis) {
  const counts = Object.fromEntries(STATUS_ORDER.map((k) => [k, 0]))
  for (const t of analysis.tokens) {
    if (t.validation) counts[t.validation.status] = (counts[t.validation.status] || 0) + 1
  }
  const totalFindings = analysis.projects.reduce(
    (a, p) => a + p.findings.reduce((b, f) => b + f.count, 0),
    0,
  )
  const excluded = (analysis.excluded || []).reduce((a, e) => a + e.count, 0)
  const privateKeys = analysis.projects.reduce(
    (a, p) => a + p.findings.filter((f) => /PRIVATE KEY/i.test(f.category)).reduce((b, f) => b + f.count, 0),
    0,
  )
  return { counts, totalFindings, excluded, privateKeys }
}
