// Aggregation + CLI text rendering for the audit summary.
import { C, STATUS_ORDER, LABELS, colorFor } from "./status.mjs"
import { computeSummary } from "./summary-core.mjs"

export { computeSummary }

export function renderSummaryText(analysis) {
  const { counts, totalFindings, excluded, privateKeys } = computeSummary(analysis)
  const lines = []
  lines.push("")
  lines.push(`${C.bold}Session Audit Report${C.reset}`)
  lines.push(`${C.grey}generated: ${new Date().toISOString()}${C.reset}`)
  lines.push("")
  lines.push(`${C.bold}Summary${C.reset}`)
  lines.push(`  projects : ${analysis.projects.length}`)
  lines.push(`  sessions : ${analysis.sessionCount}`)
  lines.push(`  findings : ${totalFindings}`)
  lines.push(`  excluded : ${excluded}`)
  lines.push(`  private keys: ${privateKeys}`)
  lines.push(`  tokens validated:`)
  let any = false
  for (const k of STATUS_ORDER) {
    if (!counts[k]) continue
    any = true
    lines.push(`    ${colorFor(k)}[${LABELS[k]}]${C.reset} ${counts[k]}`)
  }
  if (!any) lines.push(`    ${C.grey}[NONE]${C.reset}`)
  lines.push("")
  return lines.join("\n")
}
