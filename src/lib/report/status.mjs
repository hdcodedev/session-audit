// Terminal color codes and the single source of truth for token-validation
// statuses. The `status` string written to analysis.json is also the CSS class
// used by the HTML report and the key rendered in the CLI summary.
//
//   valid       live-verified usable (service returned 200)
//   offline     JWT decoded, not yet expired, but NOT verified live
//   invalid     rejected by the service (e.g. 401)
//   expired     JWT past its exp claim
//   limited     accepted, but not enabled for the APIs we tested
//   unknown     JWT without an exp claim — cannot determine status
//   unsupported no validator exists for this token type
//   error       the check itself failed to run (network/timeout/unexpected)
export const C = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  grey: "\x1b[90m",
  bold: "\x1b[1m",
  reset: "\x1b[0m",
}

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

export const EMOJI = Object.fromEntries(Object.entries(STATUS).map(([k, v]) => [k, v.emoji]))
export const LABELS = Object.fromEntries(Object.entries(STATUS).map(([k, v]) => [k, v.label]))

// Terminal color for a status (used by the CLI summary only).
export function colorFor(status) {
  const c = STATUS[status]?.color
  if (c === "green") return C.green
  if (c === "red") return C.red
  if (c === "yellow") return C.yellow
  return C.grey
}
