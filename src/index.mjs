// Interactive CLI: token -> download -> scan -> validate -> emoji report.
//   node src/index.mjs --token <TOKEN>
//   node src/index.mjs                 # prompts for token
//   node src/index.mjs --scan-only <DIR>  # analyze an existing export
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { createInterface } from "node:readline"
import { download, listSessions, deleteAllCloudSessions } from "./lib/kiloApi.mjs"
import { scan } from "./lib/scan.mjs"
import { validateAll } from "./lib/validate.mjs"
import { renderHtml, renderSummaryText, C } from "./lib/report.mjs"

function ask(text) {
  return new Promise((res) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    rl.question(text, (a) => {
      rl.close()
      res(a.trim())
    })
  })
}

function parseArgs(argv) {
  const a = { all: false, noValidate: false }
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i]
    if (x === "--token") a.token = argv[++i]
    else if (x === "--dir") a.dir = argv[++i]
    else if (x === "--scan-only") a.scanOnly = argv[++i]
    else if (x === "--all") a.all = true
    else if (x === "--no-validate") a.noValidate = true
    else if (x === "--delete-cloud") a.deleteCloud = true
    else if (x === "--help") a.help = true
  }
  return a
}

function enrich(analysis) {
  const map = new Map()
  for (const t of analysis.tokens) map.set(`${t.type}|${t.value}`, t.validation)
  for (const p of analysis.projects) {
    for (const f of p.findings) {
      if (!f.validate) continue
      for (const s of f.samples) s.validation = map.get(`${f.validate}|${s.value}`)
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log("Usage: node src/index.mjs [--token TOKEN] [--scan-only DIR] [--dir DIR] [--all] [--no-validate] [--delete-cloud]")
    return
  }

  if (args.deleteCloud) {
    const token = args.token || (await ask("Kilo token: "))
    if (!token) {
      console.error("No token provided.")
      process.exit(1)
    }
    console.log("Listing cloud sessions ...")
    const sessions = await listSessions(token)
    if (sessions.length === 0) {
      console.log("No cloud sessions found.")
      return
    }
    console.log("")
    console.log(`${C.bold}⚠️  This will PERMANENTLY delete ${sessions.length} cloud sessions.${C.reset}`)
    console.log("Local session files are NOT affected and will be kept as reference.")
    const confirm = await ask('Type "yes" to continue: ')
    if (confirm.toLowerCase() !== "yes") {
      console.log("Aborted. No cloud sessions were deleted.")
      return
    }
    console.log(`Deleting ${sessions.length} cloud sessions (with rate limiting) ...`)
    const { deleted, failed } = await deleteAllCloudSessions(token, sessions, {
      onProgress: (d, n) => {
        if (d % 10 === 0 || d === n) console.log(`  deleted ${d}/${n}`)
      },
    })
    console.log(`Done. Deleted ${deleted}, failed ${failed}.`)
    console.log("Local session files were kept as reference.")
    return
  }

  let dir
  if (args.scanOnly) {
    dir = args.scanOnly
    console.log(`Scanning existing export: ${dir}`)
  } else {
    const token = args.token || (await ask("Kilo token: "))
    if (!token) {
      console.error("No token provided.")
      process.exit(1)
    }
    dir = args.dir || "./sessions"
    console.log(`Downloading cloud sessions into ${dir} ...`)
    const { count } = await download(token, dir, (d, n) => {
      if (d % 25 === 0) console.log(`  downloaded ${d}/${n}`)
    })
    console.log(`Downloaded ${count} sessions.`)
  }

  console.log("Scanning for secrets ...")
  const analysis = await scan(dir, { includeNoisy: args.all })
  if (analysis.sessionCount === 0) {
    console.log("No sessions found to analyze.")
    return
  }

  if (!args.noValidate && analysis.tokens.length) {
    console.log(`Validating ${analysis.tokens.length} unique tokens (concurrency 8) ...`)
    await validateAll(analysis.tokens, { concurrency: 8 })
    enrich(analysis)
  }

  const html = renderHtml(analysis)

  writeFileSync(join(dir, "analysis.json"), JSON.stringify(analysis, null, 2))
  writeFileSync(join(dir, "report.html"), html)

  console.log(renderSummaryText(analysis))
  console.log("")
  console.log(`${C.bold}▶ FULL REPORT:${C.reset} ${C.green}${join(dir, "report.html")}${C.reset}`)
  console.log(`${C.bold}  open in a browser to review all findings${C.reset}`)
  console.log(`${C.grey}  raw data: ${join(dir, "analysis.json")}${C.reset}`)
}

main().catch((e) => {
  console.error("Fatal:", e?.message || e)
  process.exit(1)
})
