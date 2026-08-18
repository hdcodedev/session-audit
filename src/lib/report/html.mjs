// HTML report renderer. Builds a light "editorial briefing" document from the
// analysis object. Presentation lives in styles.mjs; this file only assembles
// semantic markup and the per-section data groupings.
import { curlCommand } from "../services.mjs"
import { describeKey } from "../keys.mjs"
import { STATUS, STATUS_ORDER, EMOJI, LABELS } from "./status.mjs"
import { esc, formatDetail, sortProjectsByFindings } from "./util.mjs"
import { computeSummary } from "./summary-core.mjs"
import { CSS } from "./styles.mjs"

// ---- shared row/material builders -------------------------------------------

function copyBtn(cmd) {
  return cmd
    ? `<button class="copy" type="button" data-copy="${esc(cmd)}" title="Copy curl command" aria-label="Copy curl command">⧉ curl</button>`
    : ""
}

function copyKeyBtn(pem) {
  return pem
    ? `<button class="copy" type="button" data-copy="${esc(pem)}" title="Copy private key" aria-label="Copy private key">⧉ key</button>`
    : ""
}

function valCell(val, cls = "") {
  return `<span class="val ${cls}">${esc(val)}</span>`
}

// Validation detail text. The status pill already names the status (e.g.
// "expired"), so drop the redundant leading status word and keep just the
// human-readable part ("4 weeks ago" instead of "expired 4 weeks ago").
function formatValidationDetail(detail, status) {
  if (!detail) return ""
  let out = formatDetail(detail)
  const s = String(status || "").toLowerCase()
  if (s && out.toLowerCase().startsWith(s + " ")) out = out.slice(s.length + 1)
  return out
}

// Unvalidated top-level rows (Bearer tokens, OAuth refresh tokens, ...).
function unvalidatedRows(toks) {
  if (!toks.length) return '<div class="empty">None.</div>'
  return toks
    .map(
      (t) =>
        `<div class="row"><span class="proj">${esc(t.directory || "unknown")}</span><span class="type">${esc(t.label)}</span>${valCell(t.value)}<span class="extra">${t.usedAt ? `<span class="used">@ ${esc(t.usedAt)}</span>` : ""}${copyBtn(curlCommand({ type: t.label, value: t.value, usedAt: t.usedAt }))}</span></div>`,
    )
    .join("")
}

function tokenRows(toks, cls, sessionToProject) {
  if (!toks.length) return '<div class="empty">None.</div>'
  return toks
    .map((t) => {
      const proj = sessionToProject.get(t.sessionId)
      const detail = t.validation ? t.validation.detail || "" : ""
      return `<div class="row"><span class="proj">${esc(proj ? proj.directory : "unknown")}</span><span class="type">${esc(t.type)}</span>${valCell(t.value, t.validation?.status || cls)}<span class="extra">${detail ? `<span class="used">${esc(formatValidationDetail(detail, t.validation?.status))}</span>` : ""}${copyBtn(curlCommand({ type: t.type, value: t.value, endpoint: t.validation?.endpoint }))}</span></div>`
    })
    .join("")
}

function simpleRows(toks, cls) {
  if (!toks.length) return '<div class="empty">None.</div>'
  return toks
    .map(
      (t) =>
        `<div class="row"><span class="proj">${esc(t.project ? t.project.directory : "unknown")}</span><span class="type">${esc(t.type)}</span>${valCell(t.value, cls)}${copyBtn(curlCommand({ type: t.type, value: t.value, endpoint: t.validation?.endpoint }))}</span></div>`,
    )
    .join("")
}

// Private keys: a clean row (project · type · inspected info · session) with
// the copy button at the end, plus a collapsible "view full key" block.
function privateKeyRows(toks) {
  if (!toks.length) return '<div class="empty">None.</div>'
  return toks
    .map((t) => {
      const info = t.keyInfo || {}
      const descriptor = describeKey(info) || esc(t.category)
      const full = t.value || ""
      const headerOnly = !/-----END/i.test(full)
      const preview = headerOnly
        ? `${esc(full)}\n\n(only the BEGIN header was found in the session — the rest of the block is not present in the captured text)`
        : esc(full)
      return `<div class="rowitem"><div class="row"><span class="proj">${esc(t.directory || "unknown")}</span><span class="type">${esc(t.category)}</span>${valCell(descriptor)}<span class="extra"><span class="used">session ${esc(t.sessionId)}</span>${copyKeyBtn(full)}</span></div><details class="keypreview"><summary>view full key</summary><pre class="keypem">${preview}</pre></details></div>`
    })
    .join("")
}

function section({ cls, title, count, sub, body }) {
  return `
<section class="section ${cls}">
  <h2>${esc(title)} <span class="cnt">${count}</span></h2>
  <p class="sub">${sub}</p>
  <div class="rows">${body}</div>
</section>`
}

// ---- per-project findings table --------------------------------------------

function projectsHtml(projects) {
  const sorted = sortProjectsByFindings(projects)
  return sorted
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
                ? `<span class="pill ${v.status}"><span class="n">${EMOJI[v.status] || "•"} ${esc(v.status)}</span></span>`
                : `<span class="pill"><span class="n">• untested</span></span>`
              const detail = v ? v.detail || "" : ""
              const usedAtTxt = s.usedAt ? ` · used at ${esc(s.usedAt)}` : ""
              return `<tr><td class="val">${esc(val)}</td><td>${badgeHtml} <span class="detail">${esc(formatValidationDetail(detail, v?.status))}${usedAtTxt}</span></td><td class="sid">${esc(s.sessionId)}</td></tr>`
            })
            .join("")
          const more = f.count > f.samples.length ? `<div class="more">+ ${f.count - f.samples.length} more not shown</div>` : ""
          return `<details class="cat"><summary>${esc(f.category)} <span class="cnt">${f.count}</span></summary><table><thead><tr><th>Value</th><th>Validation</th><th>Session</th></tr></thead><tbody>${rows}</tbody></table>${more}</details>`
        })
        .join("")
      return `<article class="proj"><div class="name"><span>${esc(p.directory)}</span><span class="pid">${esc(p.projectId)}</span><span class="fc">${p.sessionCount} sessions · ${findingCount} findings</span></div>${cats || '<div class="empty">No findings.</div>'}</article>`
    })
    .join("")
}

// ---- top-level render -------------------------------------------------------

export function renderHtml(analysis) {
  const { counts, totalFindings, privateKeys } = computeSummary(analysis)
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

  const refreshTokens = detected.filter((t) => t.label === "OAuth Refresh Token")
  const otherUnvalidated = detected.filter((t) => t.label !== "OAuth Refresh Token")

  const privateKeyItems = []
  for (const p of analysis.projects) {
    for (const f of p.findings) {
      if (!/PRIVATE KEY/i.test(f.category)) continue
      for (const s of f.samples) {
        privateKeyItems.push({
          category: f.category,
          value: s.value,
          sessionId: s.sessionId,
          directory: p.directory,
          keyInfo: s.keyInfo,
        })
      }
    }
  }

  const statusPills = STATUS_ORDER.filter((k) => counts[k])
    .map((k) => `<span class="pill ${k}"><span class="n">${EMOJI[k]} ${LABELS[k]}</span> <span class="n">${counts[k]}</span></span>`)
    .join("")

  const legend = STATUS_ORDER.map(
    (k) => `<li><b class="${k}">${STATUS[k].emoji} ${STATUS[k].label}</b> — ${esc(STATUS[k].desc)}</li>`,
  ).join("")

  const sections = [
    {
      cls: "privkey",
      title: "Private Keys",
      count: privateKeys,
      sub: "Private key material found in sessions (RSA/EC/OpenSSH/PGP/etc.). High-severity leaks: anyone with the key can impersonate an identity or decrypt data. Rotate and remove immediately. The inspected type/size is shown per row; use <b>⧉ key</b> to copy the full block, or expand <b>view full key</b>.",
      body: privateKeyRows(privateKeyItems),
    },
    {
      cls: "refresh",
      title: "OAuth Refresh Tokens",
      count: refreshTokens.length,
      sub: "Long-lived OAuth <b>refresh tokens</b> captured from session tool output. They grant persistent access to user accounts and are high-severity leaks — rotate or revoke at the provider even if a session reports them expired. The URL shows where each was used; use <b>⧉ curl</b> to test it.",
      body: unvalidatedRows(refreshTokens),
    },
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
      body: tokenRows(invalidTokens, "invalid", sessionToProject),
    },
    {
      cls: "expired",
      title: "Expired Tokens",
      count: expiredTokens.length,
      sub: "No longer accepted (JWTs decoded offline, or API keys rejected as expired). Still treat as leaks.",
      body: tokenRows(expiredTokens, "expired", sessionToProject),
    },
    {
      cls: "limited",
      title: "Limited-Validity Tokens",
      count: limitedTokens.length,
      sub: "Accepted by the key-check endpoint but <b>not enabled</b> for the specific APIs tested. Still usable — verify which scopes are allowed.",
      body: tokenRows(limitedTokens, "limited", sessionToProject),
    },
    {
      cls: "unknown",
      title: "Unknown-Status Tokens",
      count: unknownTokens.length + unsupportedTokens.length,
      sub: "Could not determine a live status: JWTs without an <code>exp</code> claim, or token types this tool has no validator for. Manual review needed.",
      body: tokenRows([...unknownTokens, ...unsupportedTokens], "unknown", sessionToProject),
    },
    {
      cls: "error",
      title: "Validation Errors",
      count: errorTokens.length,
      sub: "The check itself failed to run (network error, timeout, or unexpected HTTP status). These tokens were <b>not</b> assessed — re-run the audit.",
      body: tokenRows(errorTokens, "error", sessionToProject),
    },
    {
      cls: "unvalidated",
      title: "Unvalidated Tokens",
      count: otherUnvalidated.length,
      sub: "Secrets found in sessions but not auto-validated (e.g. Bearer tokens). The URL shows where each was used — check manually with <code>Authorization: Bearer &lt;token&gt;</code>. These are <b>not</b> counted in the status pills above. OAuth refresh tokens are listed in their own section above.",
      body: unvalidatedRows(otherUnvalidated),
    },
  ]
    .filter((s) => s.count > 0)
    .map(section)
    .join("")

  const genIso = new Date().toISOString()

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Session Audit Report</title>
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
  <header class="masthead">
    <div class="kicker">Confidential · Security Briefing</div>
    <h1>Session Audit Report</h1>
    <div class="meta">
      <span><b>Generated</b> ${esc(genIso)}</span>
      <span><b>Projects</b> ${analysis.projects.length}</span>
      <span><b>Sessions</b> ${analysis.sessionCount}</span>
      <span><b>Findings</b> ${totalFindings}</span>
    </div>
  </header>

  <div class="callout">⚠ This report contains live secret material (tokens, and full private-key blocks in the <b>Private Keys</b> section). Do not commit, paste into tickets, or share it. Rotate any leaked credentials, then delete this file.</div>

  <div class="stats">
    <div class="stat"><div class="num">${analysis.projects.length}</div><div class="lbl">Projects</div></div>
    <div class="stat"><div class="num">${analysis.sessionCount}</div><div class="lbl">Sessions</div></div>
    <div class="stat"><div class="num">${totalFindings}</div><div class="lbl">Findings</div></div>
    <div class="stat"><div class="num">${validated}</div><div class="lbl">Tokens checked</div></div>
    <div class="stat"><div class="num">${detected.length}</div><div class="lbl">Unvalidated</div></div>
    <div class="stat"><div class="num">${privateKeys}</div><div class="lbl">Private keys</div></div>
  </div>

  ${statusPills ? `<div class="statusline"><span class="lead">Token status</span>${statusPills}</div>` : ""}

  <section class="legend">
    <h2>What the statuses mean</h2>
    <ul>${legend}</ul>
  </section>

  ${sections}

  <section class="projects">
    <h2>Findings by project</h2>
    ${projectsHtml(analysis.projects)}
  </section>

  <footer class="foot">Generated by session-audit · ${esc(genIso)} · Handle as sensitive: contains secret material.</footer>
</div>
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
