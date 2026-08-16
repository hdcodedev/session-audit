//   valid -> green, invalid/expired -> red, restricted/unknown -> yellow, error -> grey
const C = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  grey: "\x1b[90m",
  bold: "\x1b[1m",
  reset: "\x1b[0m",
}

const EMOJI = {
  valid: "✅",
  invalid: "🔴",
  expired: "🔴",
  restricted: "🟡",
  unknown: "🟡",
  error: "⚪",
}

function colorFor(status) {
  if (status === "valid") return C.green
  if (status === "invalid" || status === "expired") return C.red
  if (status === "restricted" || status === "unknown") return C.yellow
  return C.grey
}

function badge(validation) {
  if (!validation) return `${C.grey}•${C.reset}`
  const e = EMOJI[validation.status] || "•"
  return `${colorFor(validation.status)}${e}${C.reset}`
}

function statusLine(validation) {
  if (!validation) return ""
  return ` ${badge(validation)} ${colorFor(validation.status)}${validation.status}${C.reset} (${validation.detail})`
}

export function render(analysis) {
  const lines = []
  const { projects, tokens } = analysis

  const counts = { valid: 0, invalid: 0, expired: 0, restricted: 0, unknown: 0, error: 0 }
  for (const t of tokens) {
    if (t.validation) counts[t.validation.status] = (counts[t.validation.status] || 0) + 1
  }
  const totalFindings = projects.reduce(
    (a, p) => a + p.findings.reduce((b, f) => b + f.count, 0),
    0,
  )

  lines.push("")
  lines.push(`${C.bold}☢  KILO CLOUD SESSION LEAK REPORT${C.reset}`)
  lines.push(`${C.grey}generated: ${new Date().toISOString()}${C.reset}`)
  lines.push("")
  lines.push(`${C.bold}Summary${C.reset}`)
  lines.push(`  projects : ${projects.length}`)
  lines.push(`  sessions : ${analysis.sessionCount}`)
  lines.push(`  findings : ${totalFindings}`)
  lines.push(`  tokens validated: ${C.green}✅ ${counts.valid}${C.reset}  ${C.red}🔴 ${counts.invalid + counts.expired}${C.reset}  ${C.yellow}🟡 ${counts.restricted + counts.unknown}${C.reset}  ${C.grey}⚪ ${counts.error}${C.reset}`)
  lines.push("")

  const sorted = [...projects].sort(
    (a, b) => b.findings.reduce((s, f) => s + f.count, 0) - a.findings.reduce((s, f) => s + f.count, 0),
  )

  for (const p of sorted) {
    lines.push(`${C.bold}📁 ${p.directory}${C.reset}  ${C.grey}(${p.projectId}, ${p.sessionCount} sessions)${C.reset}`)
    for (const f of [...p.findings].sort((a, b) => b.count - a.count)) {
      lines.push(`  ${C.bold}## ${f.category}${C.reset} (${f.count})`)
      for (const s of f.samples) {
        const val = s.value.length > 70 ? s.value.slice(0, 67) + "..." : s.value
        lines.push(`     ${badge(s.validation)}${val}${statusLine(s.validation)}  ${C.grey}[${s.sessionId}]${C.reset}`)
      }
    }
    lines.push("")
  }
  return lines.join("\n")
}

export function summarizeTokens(tokens) {
  return tokens.map((t) => ({ type: t.type, value: t.value, validation: t.validation }))
}
