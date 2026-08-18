// Public API for the report package. Import from here, e.g.
//   import { renderHtml, renderSummaryText, C } from "./lib/report/index.mjs"
export { C, STATUS, STATUS_ORDER, EMOJI, LABELS, colorFor } from "./status.mjs"
export { computeSummary, renderSummaryText } from "./summary.mjs"
export { renderHtml, summarizeTokens } from "./html.mjs"
