// Dark "editorial briefing" theme for the HTML report. Wide content column with
// a restrained palette, a single danger accent, hairline rules and small
// color-coded status pills. Status colors preserved from the original scheme:
// valid = green (usable), invalid/expired = red, offline/limited/unknown =
// amber, unsupported/error = muted grey.
export const CSS = `
:root {
  color-scheme: dark;
  --bg: #0e1116;
  --surface: #161b22;
  --surface-2: #1b2230;
  --ink: #e6edf3;
  --ink-soft: #c9d1d9;
  --muted: #8b949e;
  --faint: #6e7681;
  --line: #21262d;
  --line-strong: #30363d;
  --accent: #f85149;
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  --serif: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif;
  --sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  /* status hues */
  --valid: #3fb950;
  --expired: #f85149;
  --offline: #d29922;
  --limited: #d29922;
  --unknown: #d29922;
  --invalid: #f85149;
  --unsupported: #8b949e;
  --error: #8b949e;
}

* { box-sizing: border-box; }

html { -webkit-text-size-adjust: 100%; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font: 15px/1.6 var(--sans);
  font-feature-settings: "kern" 1, "liga" 1;
}

.wrap {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 22px 70px;
}

/* ---- masthead -------------------------------------------------------- */
.masthead {
  border-bottom: 2px solid var(--ink);
  padding: 28px 0 14px;
  margin-bottom: 4px;
}
.masthead-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}
.masthead h1 {
  margin: 0;
  font: 600 30px/1.1 var(--serif);
  letter-spacing: -0.01em;
}
.masthead .kicker {
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 11px;
  font-weight: 700;
  color: var(--accent);
  margin-bottom: 8px;
}
.masthead .meta {
  margin-top: 10px;
  color: var(--muted);
  font-size: 12.5px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 18px;
}
.masthead .meta span b { color: var(--ink-soft); font-weight: 600; }

/* ---- secret warning callout ------------------------------------------ */
.callout {
  margin: 22px 0 4px;
  border-left: 3px solid var(--accent);
  background: rgba(248, 81, 73, 0.12);
  padding: 12px 16px;
  font-size: 13px;
  color: #f0a8a0;
  line-height: 1.55;
}
.callout b { color: #ffb3ac; }

/* ---- stat strip ------------------------------------------------------ */
.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--surface);
  margin: 22px 0 8px;
}
.stat {
  flex: 1 1 0;
  min-width: 96px;
  padding: 12px 16px;
  border-right: 1px solid var(--line);
}
.stat:last-child { border-right: 0; }
.stat .num { font: 600 22px/1 var(--serif); }
.stat .lbl {
  margin-top: 4px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 10.5px;
  color: var(--muted);
}

/* ---- status row ------------------------------------------------------ */
.statusline {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 10px;
  align-items: center;
  margin: 14px 0 4px;
  font-size: 12.5px;
  color: var(--muted);
}
.statusline .lead { text-transform: uppercase; letter-spacing: 0.1em; font-size: 10.5px; }

/* ---- pills ----------------------------------------------------------- */
.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
  padding: 2px 9px;
  border-radius: 999px;
  border: 1px solid currentColor;
  background: color-mix(in srgb, currentColor 14%, transparent);
  line-height: 1.5;
}
.pill .n { font-variant-numeric: tabular-nums; }
.pill.valid { color: var(--valid); }
.pill.expired { color: var(--expired); }
.pill.offline { color: var(--offline); }
.pill.limited { color: var(--limited); }
.pill.unknown { color: var(--unknown); }
.pill.invalid { color: var(--invalid); }
.pill.unsupported { color: var(--unsupported); }
.pill.error { color: var(--error); }

/* ---- sections -------------------------------------------------------- */
.section { margin: 30px 0 0; }
.section > h2 {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 0 0 2px;
  font: 600 18px/1.2 var(--serif);
  letter-spacing: -0.005em;
}
.section > h2 .cnt {
  font: 700 12px/1 var(--sans);
  color: var(--bg);
  background: var(--ink);
  border-radius: 999px;
  padding: 3px 9px;
  letter-spacing: 0.02em;
}
.section > .sub {
  margin: 0 0 12px;
  color: var(--ink-soft);
  font-size: 13px;
  max-width: 80ch;
}
.section > .sub code {
  font-family: var(--mono);
  font-size: 12px;
  background: var(--surface);
  padding: 1px 5px;
  border-radius: 3px;
}

/* ---- finding rows ---------------------------------------------------- */
.rows { border-top: 1px solid var(--line); }
.row {
  display: grid;
  grid-template-columns: 14% 12% 1fr auto;
  gap: 14px;
  align-items: baseline;
  padding: 8px 0;
  border-bottom: 1px solid var(--line);
}
.rowitem { border-bottom: 1px solid var(--line); }
.rowitem > .row { border-bottom: 0; padding-bottom: 4px; }
.row .proj { color: var(--muted); font-size: 12px; text-align: right; word-break: break-all; }
.row .type {
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 10.5px;
  color: var(--muted);
}
.row .val {
  font-family: var(--mono);
  font-size: 12.5px;
  color: var(--ink);
  word-break: break-all;
  min-width: 0;
}
.row .val.empty { color: var(--faint); font-style: italic; }
.row .extra { color: var(--muted); font-size: 12px; display: flex; gap: 10px; align-items: baseline; justify-content: flex-end; }
.row .used {
  color: var(--muted);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 260px;
}

/* status-tinted values */
.val.expired { color: var(--expired); }
.val.offline { color: var(--offline); }
.val.limited { color: var(--limited); }
.val.unknown { color: var(--unknown); }
.val.invalid { color: var(--invalid); }

/* ---- private keys ---------------------------------------------------- */
.keypreview { margin: 2px 0 6px; }
.keypreview > summary {
  cursor: pointer;
  color: var(--muted);
  font-size: 12px;
  padding: 2px 0 6px;
  list-style: none;
}
.keypreview > summary::-webkit-details-marker { display: none; }
.keypreview > summary::before { content: "▸ "; }
.keypreview[open] > summary::before { content: "▾ "; }
.keypem {
  margin: 0 0 8px;
  padding: 12px 14px;
  background: #0b0e13;
  border: 1px solid var(--line-strong);
  border-left: 3px solid var(--accent);
  border-radius: 4px;
  color: #ff9a8f;
  font: 12px/1.55 var(--mono);
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 320px;
  overflow: auto;
}

/* ---- copy button ----------------------------------------------------- */
.copy {
  cursor: pointer;
  background: var(--surface);
  color: var(--muted);
  border: 1px solid var(--line-strong);
  border-radius: 4px;
  padding: 1px 8px;
  font: 600 11.5px/1.6 var(--sans);
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.copy:hover { color: var(--ink); border-color: var(--faint); }
.copy.done { color: var(--valid); border-color: var(--valid); }

/* ---- legend ---------------------------------------------------------- */
.legend { margin-top: 38px; border-top: 1px solid var(--line-strong); padding-top: 16px; }
.legend h2 {
  font: 700 11px/1 var(--sans);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--muted);
  margin: 0 0 12px;
}
.legend ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 10px 26px;
}
.legend li { font-size: 12.5px; line-height: 1.5; color: var(--ink-soft); }
.legend li b { font-weight: 700; margin-right: 6px; }
.legend li b.valid { color: var(--valid); }
.legend li b.expired { color: var(--expired); }
.legend li b.offline { color: var(--offline); }
.legend li b.limited { color: var(--limited); }
.legend li b.unknown { color: var(--unknown); }
.legend li b.invalid { color: var(--invalid); }
.legend li b.unsupported { color: var(--unsupported); }
.legend li b.error { color: var(--error); }

/* ---- per-project findings -------------------------------------------- */
.projects { margin-top: 40px; }
.projects > h2 {
  font: 700 11px/1 var(--sans);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--muted);
  border-bottom: 2px solid var(--ink);
  padding-bottom: 8px;
  margin: 0 0 14px;
}
.proj { border-top: 1px solid var(--line); padding: 14px 0; }
.proj:first-of-type { border-top: 0; }
.proj > .name {
  font: 600 16px/1.3 var(--serif);
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 12px;
}
.proj > .name .pid { font: 400 12px/1.4 var(--mono); color: var(--faint); }
.proj > .name .fc { font-size: 11.5px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }

.cat { margin: 10px 0 0; }
.cat > summary {
  cursor: pointer;
  list-style: none;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  font-size: 13.5px;
  color: var(--ink);
}
.cat > summary::-webkit-details-marker { display: none; }
.cat > summary::before { content: "▸ "; color: var(--muted); font-size: 11px; }
.cat[open] > summary::before { content: "▾ "; }
.cat > summary .cnt {
  font: 700 11px/1 var(--sans);
  color: var(--bg);
  background: var(--muted);
  border-radius: 999px;
  padding: 2px 8px;
}
.cat[open] > summary .cnt { background: var(--accent); color: #fff; }

table { width: 100%; border-collapse: collapse; font-size: 13px; margin: 4px 0 6px; }
th, td { text-align: left; padding: 7px 10px 7px 0; border-top: 1px solid var(--line); vertical-align: top; }
th {
  color: var(--muted);
  font-weight: 600;
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-top: 0;
}
td.val { font-family: var(--mono); font-size: 12px; color: var(--ink); word-break: break-all; max-width: 46%; }
td.sid { color: var(--muted); font-family: var(--mono); font-size: 11.5px; white-space: nowrap; }
.detail { color: var(--muted); font-size: 12px; margin-left: 8px; }
.more { color: var(--muted); font-size: 12px; padding: 4px 0 8px; }
.empty { color: var(--faint); font-style: italic; padding: 6px 0; }

/* ---- footer ---------------------------------------------------------- */
.foot {
  margin-top: 44px;
  border-top: 1px solid var(--line-strong);
  padding-top: 14px;
  color: var(--faint);
  font-size: 11.5px;
}

@media (max-width: 720px) {
  .row { grid-template-columns: 1fr; gap: 2px; }
  .row .proj, .row .type { text-align: left; }
  .row .extra { justify-content: flex-start; }
  .row .used { max-width: none; }
}

/* ---- sensitive-value masking --------------------------------------- */
.maskbtn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin: 4px 0 0;
  cursor: pointer;
  background: rgba(248, 81, 73, 0.14);
  color: #ffb3ac;
  border: 1px solid var(--accent);
  border-radius: 6px;
  padding: 8px 15px;
  font: 700 13px/1.4 var(--sans);
  letter-spacing: 0.03em;
  white-space: nowrap;
  box-shadow: 0 0 0 0 rgba(248, 81, 73, 0.55);
  animation: maskPulse 2.4s ease-out infinite;
}
.maskbtn:hover { color: #fff; background: rgba(248, 81, 73, 0.24); border-color: #ff6a60; }
.maskbtn .ic {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.maskbtn .ic-eye-off { display: none; }
body:not(.masked) .maskbtn .ic-eye { display: none; }
body:not(.masked) .maskbtn .ic-eye-off { display: inline-block; }
@keyframes maskPulse {
  0% { box-shadow: 0 0 0 0 rgba(248, 81, 73, 0.55); }
  70% { box-shadow: 0 0 0 10px rgba(248, 81, 73, 0); }
  100% { box-shadow: 0 0 0 0 rgba(248, 81, 73, 0); }
}
@media (prefers-reduced-motion: reduce) {
  .maskbtn { animation: none; }
}

body.masked .row .proj,
body.masked .row .val,
body.masked .row .used,
body.masked .keypem,
body.masked td.val,
body.masked td.sid,
body.masked .detail,
body.masked .pid,
body.masked .proj > .name > span:first-child {
  filter: blur(9px);
  user-select: none;
}

@media print {
  body { background: #fff; color: #111; }
  .callout, .row, .proj, .cat { break-inside: avoid; }
  .copy { display: none; }
}
`
