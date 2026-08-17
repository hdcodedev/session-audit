//   valid -> green, invalid/expired -> red, offline/limited/unknown -> yellow, unsupported/error -> grey
import { curlCommand } from "./services.mjs"

export const C = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  grey: "\x1b[90m",
  bold: "\x1b[1m",
  reset: "\x1b[0m",
}

// Single source of truth for token validation statuses: how they appear in the
// HTML report and the CLI summary, and their terminal color. The `status`
// string is also the value written to analysis.json.
//
//   valid       live-verified usable (service returned 200)
//   offline     JWT decoded, not yet expired, but NOT verified live
//   invalid     rejected by the service (e.g. 401)
//   expired     JWT past its exp claim
//   limited     accepted, but not enabled for the APIs we tested
//   unknown     JWT without an exp claim — cannot determine status
//   unsupported no validator exists for this token type
//   error       the check itself failed to run (network/timeout/unexpected)
export const STATUS = {
  valid: { emoji: "🟢", label: "VERIFIED", color: "green", desc: "Confirmed usable now — the service returned 200 for this key. This is an active leak: rotate it immediately." },
  offline: { emoji: "🔶", label: "OFFLINE", color: "yellow", desc: "JWT decoded and not yet expired, but NOT verified live against the issuer. May already be revoked." },
  invalid: { emoji: "🔴", label: "INVALID", color: "red", desc: "Rejected by its service (e.g. 401). Not usable, so no active risk." },
  expired: { emoji: "🔴", label: "EXPIRED", color: "red", desc: "No longer accepted (JWT past exp, or API key expired). Still treat as a leak." },
  limited: { emoji: "🟡", label: "LIMITED", color: "yellow", desc: "Accepted by the key-check endpoint but not enabled for the APIs we tested." },
  unknown: { emoji: "🟡", label: "UNKNOWN", color: "yellow", desc: "JWT without an exp claim — status cannot be determined. Review manually." },
  unsupported: { emoji: "⚪", label: "UNSUPPORTED", color: "grey", desc: "No validator exists for this token type in the tool." },
  error: { emoji: "⚪", label: "ERROR", color: "grey", desc: "The check failed to run (network/timeout/unexpected). Not assessed — re-run the audit." },
}

// Most security-relevant first.
export const STATUS_ORDER = ["valid", "invalid", "expired", "offline", "limited", "unknown", "unsupported", "error"]

const EMOJI = Object.fromEntries(Object.entries(STATUS).map(([k, v]) => [k, v.emoji]))
const LABELS = Object.fromEntries(Object.entries(STATUS).map(([k, v]) => [k, v.label]))

function projectFindingCount(p) {
  return p.findings.reduce((s, f) => s + f.count, 0)
}

function sortProjectsByFindings(projects) {
  return [...projects].sort((a, b) => projectFindingCount(b) - projectFindingCount(a))
}

function colorFor(status) {
  const c = STATUS[status]?.color
  if (c === "green") return C.green
  if (c === "red") return C.red
  if (c === "yellow") return C.yellow
  return C.grey
}

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
  return { counts, totalFindings, excluded }
}

export function renderSummaryText(analysis) {
  const { counts, totalFindings, excluded } = computeSummary(analysis)
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

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))
}

function relativeTime(from, to = Date.now()) {
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

function formatDetail(detail) {
  if (!detail) return ""
  return detail.replace(/(\d{4}-\d{2}-\d{2}T[\d:.]+Z)/g, (iso) => {
    if (Number.isNaN(new Date(iso).getTime())) return iso
    const date = iso.slice(0, 16).replace("T", " ")
    return `${date} (${relativeTime(iso)})`
  })
}

export function renderHtml(analysis) {
  const { counts, totalFindings } = computeSummary(analysis)
  const validated = analysis.tokens.length
  const detected = analysis.detectedUnvalidated || []
  const sessionToProject = new Map()
  for (const p of analysis.projects) {
    for (const sid of p.sessions) sessionToProject.set(sid, p)
  }
  const withProject = (t) => ({ ...t, project: sessionToProject.get(t.sessionId) })
  const byStatus = (s) => analysis.tokens.filter((t) => t.validation && t.validation.status === s)
  const verifiedTokens = byStatus("valid").map(withProject)
  const offlineTokens = byStatus("offline").map(withProject)
  const invalidTokens = byStatus("invalid")
  const expiredTokens = byStatus("expired")
  const limitedTokens = byStatus("limited")
  const unknownTokens = byStatus("unknown")
  const unsupportedTokens = byStatus("unsupported")
  const errorTokens = byStatus("error")

  const copyBtn = (cmd) =>
    cmd
      ? `<button class="copy" type="button" data-copy="${esc(cmd)}" title="Copy curl command" aria-label="Copy curl command">⧉ curl</button>`
      : ""

  const valCell = (val, cls = "") => `<span class="vvalwrap"><code class="vval ${cls}">${esc(val)}</code></span>`

  const tokenRows = (toks, cls) =>
    toks.length
      ? toks
          .map((t) => {
            const proj = sessionToProject.get(t.sessionId)
            const detail = t.validation ? t.validation.detail || "" : ""
            return `<div class="vrow"><span class="vproj">${esc(proj ? proj.directory : "unknown")}</span><span class="vtype">${esc(t.type)}</span>${valCell(t.value, t.validation?.status || cls)}${detail ? `<span class="vused">${esc(formatDetail(detail))}</span>` : ""}${copyBtn(curlCommand({ type: t.type, value: t.value, endpoint: t.validation?.endpoint }))}</div>`
          })
          .join("")
       : '<div class="empty">None.</div>'

  const simpleRows = (toks, cls) =>
    toks.length
      ? toks
          .map((t) => `<div class="vrow"><span class="vproj">${esc(t.project ? t.project.directory : "unknown")}</span><span class="vtype">${esc(t.type)}</span>${valCell(t.value, cls)}${copyBtn(curlCommand({ type: t.type, value: t.value, endpoint: t.validation?.endpoint }))}</div>`)
          .join("")
      : '<div class="empty">None.</div>'

  const sorted = sortProjectsByFindings(analysis.projects)

  const projectsHtml = sorted
    .map((p) => {
      const findingCount = p.findings.reduce((s, f) => s + f.count, 0)
      const cats = [...p.findings]
        .sort((a, b) => b.count - a.count)
        .map((f) => {
          const rows = f.samples
             .map((s) => {
               const val = s.value.length > 70 ? s.value.slice(0, 67) + "..." : s.value
               const v = s.validation
               const badgeHtml = v
                 ? `<span class="badge ${v.status}">${EMOJI[v.status] || "•"} ${esc(v.status)}</span>`
                 : `<span class="badge none">•</span>`
               const detail = v ? esc(v.detail || "") : ""
               const usedAtTxt = s.usedAt ? ` · used at ${esc(s.usedAt)}` : ""
               return `<tr><td class="val">${esc(val)}</td><td>${badgeHtml} <span class="detail">${detail}${usedAtTxt}</span></td><td class="sid">${esc(s.sessionId)}</td></tr>`
             })
            .join("")
          const more = f.count > f.samples.length ? `<div class="more">+ ${f.count - f.samples.length} more not shown</div>` : ""
          return `<details class="cat"><summary>${esc(f.category)} <span class="cnt">${f.count}</span></summary><table><thead><tr><th>Value</th><th>Validation</th><th>Session</th></tr></thead><tbody>${rows}</tbody></table>${more}</details>`
        })
        .join("")
      return `<details class="proj"><summary><span class="pname">${esc(p.directory)}</span><span class="pmeta">${esc(p.projectId)} · ${p.sessionCount} sessions · ${findingCount} findings</span></summary>${cats || '<div class="empty">No findings.</div>'}</details>`
    })
    .join("")

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Session Audit Report</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: #0d1117; color: #c9d1d9; font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
  header { padding: 24px 28px 8px; }
  h1 { margin: 0 0 4px; font-size: 20px; }
  .gen { color: #8b949e; font-size: 12px; }
  .cards { display: flex; flex-wrap: wrap; gap: 14px; padding: 12px 28px 4px; }
  .card { background: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 12px 18px; min-width: 110px; }
  .card .num { font-size: 24px; font-weight: 700; }
  .card .lbl { color: #8b949e; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
  .tokbar { display: flex; gap: 18px; flex-wrap: wrap; padding: 4px 28px 18px; color: #8b949e; font-size: 13px; }
  .tokbar b { color: #c9d1d9; }
  .sec { padding: 4px 28px 8px; }
  .sec h2 { display: flex; align-items: center; gap: 10px; font-size: 15px; margin: 0 0 4px; }
  .sub { color: #8b949e; font-size: 12px; margin: 0 0 8px; }
  .sec .cnt { background: #30363d; color: #0d1117; border-radius: 999px; padding: 1px 9px; font-size: 12px; font-weight: 700; }
  .vrow { display: flex; gap: 12px; align-items: baseline; padding: 5px 0; border-top: 1px solid #21262d; }
  .vtype { color: #8b949e; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; width: 10%; flex: 0 0 10%; }
  .vval { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #3fb950; word-break: break-all; flex: 1 1 auto; min-width: 0; }
  .vvalwrap { display: flex; gap: 8px; align-items: baseline; flex: 1 1 auto; min-width: 0; }
  .copy { flex: 0 0 auto; cursor: pointer; background: #21262d; color: #8b949e; border: 1px solid #30363d; border-radius: 6px; padding: 1px 7px; font-size: 13px; line-height: 1.4; }
  .copy:hover { color: #c9d1d9; border-color: #6e7681; }
  .copy.done { color: #3fb950; border-color: #3fb950; }
  .vproj { color: #8b949e; font-size: 12px; width: 10%; flex: 0 0 10%; word-break: break-all; text-align: right; }
  .vused { color: #8b949e; font-size: 12px; margin-left: 10px; width: 28%; flex: 0 0 28%; word-break: break-word; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* per-status color groups (apply to tokbar chips, section headings, badges, values) */
  .valid { color: #3fb950; } .valid .cnt { background: #3fb950; color: #0d1117; }
  .invalid { color: #f85149; } .invalid .cnt, .expired .cnt { background: #f85149; color: #0d1117; } .invalid .vval, .expired .vval { color: #f85149; }
  .expired { color: #f85149; }
  .offline { color: #d29922; } .offline .cnt { background: #d29922; color: #0d1117; } .offline .vval { color: #d29922; }
  .limited { color: #d29922; } .limited .cnt { background: #d29922; color: #0d1117; } .limited .vval { color: #d29922; }
  .unknown { color: #d29922; } .unknown .cnt { background: #d29922; color: #0d1117; } .unknown .vval { color: #d29922; }
  .unsupported { color: #8b949e; } .unsupported .cnt { background: #8b949e; color: #0d1117; }
  .error { color: #8b949e; } .error .cnt { background: #8b949e; color: #0d1117; }
  .none { color: #6e7681; }
  .legend { padding: 6px 28px 14px; }
  .legend h2 { font-size: 13px; margin: 0 0 6px; color: #8b949e; text-transform: uppercase; letter-spacing: .04em; }
  .legend ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 4px 22px; }
  .legend li { font-size: 12px; line-height: 1.45; color: #c9d1d9; }
  .legend li b { font-weight: 700; }
  main { padding: 0 28px 40px; }
  details.proj { background: #13171d; border: 1px solid #30363d; border-radius: 10px; margin: 10px 0; overflow: hidden; }
  details.proj > summary { cursor: pointer; padding: 12px 16px; display: flex; align-items: baseline; gap: 12px; background: #1b2230; }
  details.proj[open] > summary { background: #1b2230; border-bottom: 1px solid #30363d; }
  details.proj > summary::-webkit-details-marker { color: #8b949e; }
  .pname { font-weight: 700; font-size: 15px; word-break: break-all; }
  .pmeta { color: #8b949e; font-size: 12px; }
  details.cat { border-top: 1px solid #21262d; }
  details.cat > summary { cursor: pointer; padding: 10px 16px 10px 28px; display: flex; align-items: center; gap: 10px; }
  details.cat > summary::-webkit-details-marker { color: #8b949e; }
  .cnt { background: #30363d; border-radius: 999px; padding: 1px 9px; font-size: 12px; color: #c9d1d9; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 6px 16px; border-top: 1px solid #21262d; vertical-align: top; }
  th { color: #8b949e; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
  td.val { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; word-break: break-all; max-width: 50%; }
  td.sid { color: #8b949e; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
  .detail { color: #8b949e; font-size: 12px; }
  .more { color: #8b949e; padding: 8px 16px 12px 28px; font-size: 12px; }
  .badge { font-size: 12px; font-weight: 600; white-space: nowrap; }
  .empty { padding: 10px 16px 14px 28px; color: #8b949e; }
</style>
</head>
<body>
<header>
  <h1>Session Audit Report</h1>
  <div class="gen">generated: ${esc(new Date().toISOString())}</div>
</header>
<section class="cards">
  <div class="card"><div class="num">${analysis.projects.length}</div><div class="lbl">Projects</div></div>
  <div class="card"><div class="num">${analysis.sessionCount}</div><div class="lbl">Sessions</div></div>
  <div class="card"><div class="num">${totalFindings}</div><div class="lbl">Findings</div></div>
  <div class="card"><div class="num">${validated}</div><div class="lbl">Tokens checked</div></div>
  <div class="card"><div class="num">${detected.length}</div><div class="lbl">Unvalidated</div></div>
</section>
<section class="tokbar">
  ${STATUS_ORDER.filter((k) => counts[k]).map((k) => `<span class="${k}">[${LABELS[k]}] <b>${counts[k]}</b></span>`).join("")}
</section>
<section class="legend">
  <h2>What the statuses mean</h2>
  <ul>
    ${STATUS_ORDER.map((k) => `<li><b class="${k}">${STATUS[k].emoji} ${STATUS[k].label}</b> — ${esc(STATUS[k].desc)}</li>`).join("")}
  </ul>
</section>
${[
  {
    cls: "valid",
    title: "Verified Tokens",
    count: verifiedTokens.length,
    sub: "Confirmed usable right now: the service returned <b>200</b> for these keys (GitHub/OpenAI/Google). Highest-priority leaks — rotate immediately.",
    body: simpleRows(verifiedTokens),
  },
  {
    cls: "offline",
    title: "Offline-Decoded JWTs",
    count: offlineTokens.length,
    sub: "JWTs decoded locally and not yet past their <code>exp</code>, but <b>not</b> verified live against the issuer. They may already be revoked — confirm before trusting. Treat as likely leaks.",
    body: simpleRows(offlineTokens, "offline"),
  },
  {
    cls: "invalid",
    title: "Invalid Tokens",
    count: invalidTokens.length,
    sub: "Rejected by their service (HTTP status shown, e.g. 401). Not usable, so no active risk. Use the <b>⧉ curl</b> button to re-run the exact check yourself.",
    body: tokenRows(invalidTokens, "invalid"),
  },
  {
    cls: "expired",
    title: "Expired Tokens",
    count: expiredTokens.length,
    sub: "No longer accepted (JWTs decoded offline, or API keys rejected as expired). Still treat as leaks.",
    body: tokenRows(expiredTokens, "expired"),
  },
  {
    cls: "limited",
    title: "Limited-Validity Tokens",
    count: limitedTokens.length,
    sub: "Accepted by the key-check endpoint but <b>not enabled</b> for the specific APIs tested. Still usable — verify which scopes are allowed.",
    body: tokenRows(limitedTokens, "limited"),
  },
  {
    cls: "unknown",
    title: "Unknown-Status Tokens",
    count: unknownTokens.length + unsupportedTokens.length,
    sub: "Could not determine a live status: JWTs without an <code>exp</code> claim, or token types this tool has no validator for. Manual review needed.",
    body: tokenRows([...unknownTokens, ...unsupportedTokens], "unknown"),
  },
  {
    cls: "error",
    title: "Validation Errors",
    count: errorTokens.length,
    sub: "The check itself failed to run (network error, timeout, or unexpected HTTP status). These tokens were <b>not</b> assessed — re-run the audit.",
    body: tokenRows(errorTokens, "error"),
  },
  {
    cls: "unvalidated",
    title: "Unvalidated Tokens",
    count: detected.length,
    sub: "Secrets found in sessions but not auto-validated. The URL shows where each was used — check manually with <code>Authorization: Bearer &lt;token&gt;</code>. These are <b>not</b> counted in the status chips above.",
    body: detected.length
      ? detected
          .map(
            (t) =>
              `<div class="vrow"><span class="vproj">${esc(t.directory || "unknown")}</span><span class="vtype">${esc(t.label)}</span>${valCell(t.value)}${t.usedAt ? `<span class="vused">@ ${esc(t.usedAt)}</span>` : ""}${copyBtn(curlCommand({ type: t.label, value: t.value, usedAt: t.usedAt }))}</div>`,
          )
          .join("")
      : '<div class="empty">No unvalidated tokens detected.</div>',
  },
]
  .filter((s) => s.count > 0)
  .map(
    (s) => `
 <section class="sec ${s.cls}">
  <h2>${esc(s.title)} <span class="cnt">${s.count}</span></h2>
  <p class="sub">${s.sub}</p>
  ${s.body}
 </section>`,
  )
  .join("")}
<main>
${projectsHtml}
</main>
<script>
document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".copy");
  if (!btn) return;
  const text = btn.getAttribute("data-copy") || "";
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch {}
    document.body.removeChild(ta);
  }
  const old = btn.textContent;
  btn.textContent = "✓";
  btn.classList.add("done");
  setTimeout(() => { btn.textContent = old; btn.classList.remove("done"); }, 1200);
});
</script>
</body>
</html>`
}

export function summarizeTokens(tokens) {
  return tokens.map((t) => ({ type: t.type, value: t.value, validation: t.validation }))
}
