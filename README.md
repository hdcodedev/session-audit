# session-audit

Cleanup tool for Kilo cloud-session exports. Downloads your cloud sessions,
scans for leaked secrets, validates any tokens it recognizes, and prints a
per-project report grouped by findings.

## Prereqs

- Node.js >= 18 (built-in `fetch`)
- `ripgrep` (`rg`) for fast scanning — install with `brew install ripgrep`

## Quick start

Interactive (downloads + analyzes + validates):

```bash
node src/index.mjs --token <KILO_TOKEN>
```

If you already downloaded sessions somewhere:

```bash
node src/index.mjs --scan-only ~/kilo-cloud-export
```

Skip live validation (offline scan + report only):

```bash
node src/index.mjs --scan-only ~/kilo-cloud-export --no-validate
```

## What it does

1. **download** — lists all cloud sessions via the Kilo tRPC API and exports
   each session JSON into a local folder (`./sessions` by default).
2. **scan** — scans every session for secrets/tokens (GitHub, OpenAI, Google
   API keys, JWT, AWS, DB connection strings, emails, etc.) grouped by
   project (`info.projectID` + `info.directory`).
3. **validate** — checks unique tokens:
   - GitHub / OpenAI / Google API keys: live API call
   - JWT: offline `exp` expiry decode
4. **report** — prints a per-project report showing the validation status of
   any recognized tokens.

Outputs are also written to the data folder:
- `analysis.json` — full machine-readable analysis
- `report.txt` — the terminal report

## Safety

- **⚠️** The Kilo token used to download sessions has full access to
  your data. **Rotate (revoke and regenerate) it immediately after exporting
  sessions.**
- Exported session files contain **full unmasked** conversation data.
- The report and `analysis.json` also contain secrets by default.
- After you finish reviewing, delete the data folder and the generated
  `analysis.json` / `report.txt`.
