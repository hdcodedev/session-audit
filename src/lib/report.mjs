//   valid -> green, invalid/expired -> red, restricted/unknown -> yellow, error -> grey
import { curlCommand } from "./services.mjs"

export const C = {
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

const LABELS = {
  valid: "VALID",
  invalid: "INVALID",
  expired: "EXPIRED",
  restricted: "RESTRICTED",
  unknown: "UNKNOWN",
  error: "ERROR",
}

const STATUS_ORDER = ["valid", "invalid", "expired", "restricted", "unknown", "error"]

function projectFindingCount(p) {
  return p.findings.reduce((s, f) => s + f.count, 0)
}

function sortProjectsByFindings(projects) {
  return [...projects].sort((a, b) => projectFindingCount(b) - projectFindingCount(a))
}

function colorFor(status) {
  if (status === "valid") return C.green
  if (status === "invalid" || status === "expired") return C.red
  if (status === "restricted" || status === "unknown") return C.yellow
  return C.grey
}

export function computeSummary(analysis) {
  const counts = { valid: 0, invalid: 0, expired: 0, restricted: 0, unknown: 0, error: 0 }
  for (const t of analysis.tokens) {
    if (t.validation) counts[t.validation.status] = (counts[t.validation.status] || 0) + 1
  }
  const totalFindings = analysis.projects.reduce(
    (a, p) => a + p.findings.reduce((b, f) => b + f.count, 0),
    0,
  )
  return { counts, totalFindings }
}

export function renderSummaryText(analysis) {
  const { counts, totalFindings } = computeSummary(analysis)
  const lines = []
  lines.push("")
  lines.push(`${C.bold}Session Audit Report${C.reset}`)
  lines.push(`${C.grey}generated: ${new Date().toISOString()}${C.reset}`)
  lines.push("")
  lines.push(`${C.bold}Summary${C.reset}`)
  lines.push(`  projects : ${analysis.projects.length}`)
  lines.push(`  sessions : ${analysis.sessionCount}`)
  lines.push(`  findings : ${totalFindings}`)
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

export function renderHtml(analysis) {
  const { counts, totalFindings } = computeSummary(analysis)
  const validated = analysis.tokens.length
  const detected = analysis.detectedUnvalidated || []
  const sessionToProject = new Map()
  for (const p of analysis.projects) {
    for (const sid of p.sessions) sessionToProject.set(sid, p)
  }
  const validTokens = analysis.tokens
    .filter((t) => t.validation && t.validation.status === "valid")
    .map((t) => ({ ...t, project: sessionToProject.get(t.sessionId) }))
  const invalidTokens = analysis.tokens.filter((t) => t.validation && t.validation.status === "invalid")
  const expiredTokens = analysis.tokens.filter((t) => t.validation && t.validation.status === "expired")

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
            return `<div class="vrow"><span class="vproj">${esc(proj ? proj.directory : "unknown")}</span><span class="vtype">${esc(t.type)}</span>${valCell(t.value, cls)}${detail ? `<span class="vused">${esc(detail)}</span>` : ""}${copyBtn(curlCommand({ type: t.type, value: t.value, endpoint: t.validation?.endpoint }))}</div>`
          })
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
      return `<details class="proj" open><summary><span class="pname">${esc(p.directory)}</span><span class="pmeta">${esc(p.projectId)} · ${p.sessionCount} sessions · ${findingCount} findings</span></summary>${cats || '<div class="empty">No findings.</div>'}</details>`
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
  .valid { padding: 4px 28px 8px; }
  .valid h2, .detected h2, .invalid h2, .expired h2 { display: flex; align-items: center; gap: 10px; font-size: 15px; margin: 0 0 4px; }
  .sub { color: #8b949e; font-size: 12px; margin: 0 0 8px; }
  .valid .cnt { background: #3fb950; color: #0d1117; border-radius: 999px; padding: 1px 9px; font-size: 12px; font-weight: 700; }
  .vrow { display: flex; gap: 12px; align-items: baseline; padding: 5px 0; border-top: 1px solid #21262d; }
  .vtype { color: #8b949e; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; width: 10%; flex: 0 0 10%; }
  .vval { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #3fb950; word-break: break-all; flex: 1 1 auto; min-width: 0; }
  .vvalwrap { display: flex; gap: 8px; align-items: baseline; flex: 1 1 auto; min-width: 0; }
  .copy { flex: 0 0 auto; cursor: pointer; background: #21262d; color: #8b949e; border: 1px solid #30363d; border-radius: 6px; padding: 1px 7px; font-size: 13px; line-height: 1.4; }
  .copy:hover { color: #c9d1d9; border-color: #6e7681; }
  .copy.done { color: #3fb950; border-color: #3fb950; }
  .vproj { color: #8b949e; font-size: 12px; width: 10%; flex: 0 0 10%; word-break: break-all; text-align: right; }
  .valid { color: #3fb950; } .invalid { color: #f85149; } .expired { color: #f85149; }
  .restricted { color: #d29922; } .unknown { color: #d29922; } .error { color: #8b949e; } .none { color: #6e7681; }
  .detected { padding: 4px 28px 8px; }
  .detected h2 { font-size: 15px; margin: 0 0 8px; display: flex; align-items: center; gap: 10px; color: #d29922; }
  .detected .cnt { background: #d29922; color: #0d1117; border-radius: 999px; padding: 1px 9px; font-size: 12px; font-weight: 700; }
  .vused { color: #8b949e; font-size: 12px; margin-left: 10px; word-break: break-all; }
  .invalid, .expired { padding: 4px 28px 8px; }
  .invalid .cnt, .expired .cnt { background: #f85149; color: #0d1117; border-radius: 999px; padding: 1px 9px; font-size: 12px; font-weight: 700; }
  .invalid .vval, .expired .vval { color: #f85149; }
  main { padding: 0 28px 40px; }
  details.proj { background: #161b22; border: 1px solid #30363d; border-radius: 10px; margin: 10px 0; overflow: hidden; }
  details.proj > summary { cursor: pointer; padding: 12px 16px; display: flex; align-items: baseline; gap: 12px; }
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
  <span class="valid">[VALID] <b>${counts.valid}</b></span>
  <span class="invalid">[INVALID] <b>${counts.invalid}</b></span>
  <span class="expired">[EXPIRED] <b>${counts.expired}</b></span>
  <span class="restricted">[RESTRICTED] <b>${counts.restricted}</b></span>
  <span class="unknown">[UNKNOWN] <b>${counts.unknown}</b></span>
  <span class="error">[ERROR] <b>${counts.error}</b></span>
</section>
 <section class="valid">
  <h2>Valid Tokens <span class="cnt">${validTokens.length}</span></h2>
  <p class="sub">Tokens confirmed usable: API keys (GitHub/OpenAI/Google) returned 200 from their service, while JWTs only decoded and have not yet expired — an offline check, <b>not</b> verified live. Treat all of these as priority leaks to rotate.</p>
  ${validTokens.length
    ? validTokens
        .map(
          (t) =>
            `<div class="vrow"><span class="vproj">${esc(t.project ? t.project.directory : "unknown")}</span><span class="vtype">${esc(t.type)}</span>${valCell(t.value)}${copyBtn(curlCommand({ type: t.type, value: t.value, endpoint: t.validation?.endpoint }))}</div>`,
        )
        .join("")
    : '<div class="empty">None of the validated tokens are valid.</div>'}
 </section>
  <section class="detected">
  <h2>Detected Tokens (not validated) <span class="cnt">${detected.length}</span></h2>
  <p class="sub">Bearer tokens found in sessions but not auto-validated. The URL shows where each was used — check manually with <code>Authorization: Bearer &lt;token&gt;</code>. These are <b>not</b> counted in the [INVALID]/[EXPIRED] top cards above.</p>
  ${detected.length
    ? detected
        .map(
          (t) =>
            `<div class="vrow"><span class="vproj">${esc(t.directory || "unknown")}</span><span class="vtype">${esc(t.label)}</span>${valCell(t.value)}${t.usedAt ? `<span class="vused">@ ${esc(t.usedAt)}</span>` : ""}${copyBtn(curlCommand({ type: t.label, value: t.value, usedAt: t.usedAt }))}</div>`,
        )
        .join("")
    : '<div class="empty">No unvalidated tokens detected.</div>'}
  </section>
  <section class="invalid">
   <h2>Invalid Tokens <span class="cnt">${invalidTokens.length}</span></h2>
   <p class="sub">Validated tokens rejected by their service (HTTP error code shown, e.g. 401). These are confirmed leaks — rotate them. Use the <b>⧉ curl</b> button to re-run the exact check yourself.</p>
   ${tokenRows(invalidTokens, "invalid")}
  </section>
  <section class="expired">
   <h2>Expired Tokens <span class="cnt">${expiredTokens.length}</span></h2>
   <p class="sub">Validated tokens that have expired (JWTs decoded offline, or API keys no longer accepted). Still treat as leaks.</p>
   ${tokenRows(expiredTokens, "expired")}
  </section>
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
