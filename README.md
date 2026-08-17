# session-audit

Audit and clean up Kilo cloud-session exports.

`session-audit` downloads your cloud sessions, scans the exported conversation data for leaked secrets, optionally validates recognized tokens against their live APIs, and generates a per-project security report.

> **⚠️ Security warning:** This tool handles highly sensitive data. Read the [Safety](#safety) section before running it.
<img width="1647" height="672" alt="Screenshot 2026-08-17 at 11 50 55" src="https://github.com/user-attachments/assets/edc273c2-0a71-411b-a645-341b3813245d" />
<img width="1669" height="521" alt="Screenshot 2026-08-17 at 11 51 04" src="https://github.com/user-attachments/assets/2fa8b9ce-db9b-4aed-90a7-5a0016c855d3" />

## Prerequisites

* Node.js **18+** (uses the built-in `fetch` API)
* [`ripgrep`](https://github.com/BurntSushi/ripgrep) (`rg`) for fast secret scanning

Install `ripgrep` on macOS with:

```bash
brew install ripgrep
```

## Quick start

### Download and audit your cloud sessions

Provide your Kilo token to download and analyze your sessions:

```bash
node src/index.mjs --token <KILO_TOKEN>
```

By default, sessions are downloaded into `./sessions`.

### Scan an existing export

If you have already downloaded your sessions:

```bash
node src/index.mjs --scan-only ~/sessions
```

### Offline scan

Skip live token validation and perform only local scanning and reporting:

```bash
node src/index.mjs --scan-only ~/sessions --no-validate
```

## How it works

The audit runs through four stages:

### 1. Download

Lists your cloud sessions through the Kilo tRPC API and exports each session as JSON into a local directory.

### 2. Scan

Scans the exported session data for potentially leaked secrets and sensitive tokens, including:

* GitHub tokens
* OpenAI API keys
* Google API keys
* JWTs
* AWS credentials
* Database connection strings
* Email addresses
* Other recognized secret patterns

Findings are grouped by project using:

* `info.projectID`
* `info.directory`

### 3. Validate

Recognized tokens can optionally be checked against their respective services:

| Token type      | Validation               |
| --------------- | ------------------------ |
| GitHub          | Live API request         |
| OpenAI          | Live API request         |
| Google API keys | Live API request         |
| JWT             | Local `exp`/expiry check |

Use `--no-validate` if you want to keep the audit completely offline.

### 4. Report

The tool produces a per-project report showing detected secrets and, where applicable, their validation status.

## Output

The analysis data is written to the data directory:

```text
analysis.json
report.html
```
## Safety

### 🔴 Treat the Kilo token as compromised after export

The Kilo token used for downloading sessions provides access to your cloud-session data.

**Immediately revoke and regenerate the token after the export is complete.**

Do not reuse the token elsewhere.

### 🔴 Exported sessions contain sensitive data

The exported JSON files contain your **full, unmasked conversation history**. They may include:

* API keys
* Access tokens
* Passwords
* Environment variables
* Private URLs
* Source code
* Personal information
* Other credentials accidentally included in conversations

Store the export securely and do not commit it to Git.

### 🔴 Analysis output may contain secrets

`analysis.json` and `report.html` can contain detected secret values.

Before sharing either file, inspect it carefully and redact sensitive values.

### 🧹 Clean up after the audit

Once you have finished reviewing the results, securely remove the exported session data and generated reports.

For example:

```bash
rm -rf ./sessions
rm -f ./analysis.json ./report.html
```

Adjust the paths to match your actual data directory.

## Recommended workflow

For the safest workflow:

1. Create or obtain a temporary Kilo token.
2. Run the export and audit.
3. Review the findings.
4. Immediately revoke the Kilo token.
5. Rotate any credentials discovered in the sessions.
6. Remove the exported session data.
7. Remove `analysis.json` and `report.html`.
8. If you need to share findings, create a sanitized copy with secrets removed.

## Important limitations

A secret scanner cannot guarantee that every credential will be detected.

False positives are also possible. A value matching a secret pattern does not necessarily mean that it is a valid or compromised credential.

Live validation only confirms what the target service reports at the time of the check. It should not be treated as a complete security assessment.

For JWTs, validation is performed locally by inspecting the token's expiration information; this does **not** verify that the JWT is currently accepted by its issuer.

### Token validation statuses

The report and CLI summary use these status labels:

| Status | Meaning |
| --- | --- |
| `VERIFIED` | Confirmed usable right now — the service returned `200` for the key (GitHub/OpenAI/Google). |
| `OFFLINE` | JWT decoded locally and not yet expired, but **not** verified live against the issuer. May already be revoked. |
| `INVALID` | Rejected by its service (e.g. `401`). Confirmed leak. |
| `EXPIRED` | No longer accepted (JWT past `exp`, or API key rejected as expired). |
| `LIMITED` | Accepted by the key-check endpoint but not enabled for the APIs we tested. |
| `UNKNOWN` | JWT without an `exp` claim — status cannot be determined. |
| `UNSUPPORTED` | No validator exists for this token type in the tool. |
| `ERROR` | The check failed to run (network error, timeout, or unexpected HTTP status) — the token was not assessed. |

`OFFLINE`, `UNKNOWN`, `UNSUPPORTED`, and `ERROR` tokens are **not** confirmed as live leaks; review them manually.

## Reference

* [Metabase security update — August 6, 2026](https://www.metabase.com/blog/security-update-6-aug-2026)
