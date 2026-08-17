# session-audit
> **⚠️ Security warning:** This tool handles highly sensitive data. Read the [Safety](#safety) section before running it.

## Background

`session-audit` was created following a [security incident](https://www.metabase.com/blog/security-update-6-aug-2026) involving exposed Kilo cloud sessions. Cloud sessions contain the full, unmasked conversation history, which may include sensitive information such as API keys, access tokens, passwords, environment variables, and other credentials.

If your sessions were affected, any credential contained in them should be considered compromised, as the session data was publicly exposed.

The recommended response is to:

1. Download a copy of your cloud sessions.
2. Scan them for sensitive information.
3. Identify which credentials were exposed.
4. Rotate or revoke all exposed credentials.
5. Remove the affected cloud sessions and clean up any local copies.

`session-audit` automates this process by downloading, scanning, and analyzing your cloud sessions, helping you identify exposed credentials and determine what needs to be rotated or revoked.

See [Safety](#safety) for important information before using the tool.

<img width="1670" height="932" alt="Screenshot 2026-08-17 at 12 13 34" src="https://github.com/user-attachments/assets/597c9b89-af1d-4b8d-93a1-3fe43e28085d" />

## Table of contents

* [Prerequisites](#prerequisites)
* [Quick start](#quick-start)
  * [Download and audit your cloud sessions](#download-and-audit-your-cloud-sessions)
  * [Scan an existing export](#scan-an-existing-export)
  * [Offline scan](#offline-scan)
  * [Delete all cloud sessions](#delete-all-cloud-sessions)
* [How it works](#how-it-works)
  * [1. Download](#1-download)
  * [2. Scan](#2-scan)
  * [3. Validate](#3-validate)
  * [4. Report](#4-report)
* [Output](#output)
* [Safety](#safety)
* [Recommended workflow](#recommended-workflow)
* [Important limitations](#important-limitations)
* [Reference](#reference)

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

### Delete all cloud sessions

After auditing, you can permanently delete **all** of your cloud-synced sessions directly from the Kilo cloud. The exported local session files (`./sessions`) are **never touched** — they are kept as a local reference/backup of what was deleted.

```bash
node src/index.mjs --delete-cloud --token <KILO_TOKEN>
```

Deletion is one request per session (the Kilo Cloud API only supports single-session deletion) and is rate-limited to avoid abusing the API:

* up to 4 concurrent deletes
* a short delay after every request
* a longer pause after every 25 deletions

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
| `VERIFIED` | Confirmed usable right now — the service returned `200` for the key (GitHub/OpenAI/Google). This is an active leak: **rotate it immediately**. |
| `OFFLINE` | JWT decoded locally and not yet expired, but **not** verified live against the issuer. May already be revoked. |
| `INVALID` | Rejected by its service (e.g. `401`). Not usable, so no active risk. |
| `EXPIRED` | No longer accepted (JWT past `exp`, or API key rejected as expired). |
| `LIMITED` | Accepted by the key-check endpoint but not enabled for the APIs we tested. |
| `UNKNOWN` | JWT without an `exp` claim — status cannot be determined. |
| `UNSUPPORTED` | No validator exists for this token type in the tool. |
| `ERROR` | The check failed to run (network error, timeout, or unexpected HTTP status) — the token was not assessed. |

`OFFLINE`, `UNKNOWN`, `UNSUPPORTED`, and `ERROR` tokens are **not** confirmed as live leaks; review them manually.

## Reference

* [Metabase security update — August 6, 2026](https://www.metabase.com/blog/security-update-6-aug-2026)
