// Global false-positive exclusion rules.
//
// The scanner consults these rules for every detected finding and drops any
// match a rule rejects. This is the single place to silence known false
// positives (test emails, placeholder tokens, demo data, etc.).
//
// Add new rules freely — no other change is required. Each rule:
//
//   id         unique key (used in stats and the report)
//   label      human-readable description of what is being excluded
//   appliesTo  the finding label this rule targets, or "*" for ALL categories
//   test       (value, ctx) => true  when the finding should be EXCLUDED
//             - value: the cleaned finding value (e.g. the email address)
//             - ctx:   { label, raw, sessionId } for context-aware rules
//
// Example — exclude every email at a reserved example/test domain:
//
//   {
//     id: "email-reserved-domains",
//     label: "Reserved example/test email domains (RFC 2606)",
//     appliesTo: "Email Address",
//     test: (v) => RESERVED_EMAIL_DOMAIN.test(v),
//   }

// RFC 2606 reserved domains: example.com/.net/.org and the .example/.test/
// .invalid/.localhost TLDs, plus subdomains of any of those.
// RFC 2606 reserved domains only: example.com/.net/.org, plus any subdomain of
// the .test/.example/.invalid/.localhost TLDs. A bare "test.io" is NOT reserved.
const RESERVED_EMAIL_DOMAIN =
  /@(?:example\.(?:com|net|org)|[A-Za-z0-9._-]+\.(?:test|example|invalid|localhost))$/i

// npm package version specifiers (e.g. `virtua@0.49.1.patch` or a scoped
// package `ai-sdk%2Fxai@3.0.102.patch`) that the email pattern wrongly matches.
const NPM_PKG_PATCH = /^[\w.%-]+(?:%2F[\w.%-]+)*@\d[\w.-]*\.patch$/i

// Kotlin/Java qualified `this@` expressions, e.g. `this@MyClass.member`,
// which the email pattern wrongly matches. The `[a-z][A-Z]` check requires a
// CamelCase token so genuinely capitalized domains (e.g. `Gmail.com`) survive.
const CODE_THIS_EXPR = /^this@[^@]*[a-z][A-Z]/

// Fully-qualified code references like `n@kotlinx.serialization.Serializable`
// (often with a leading diff/line marker such as `n+@`/`n-@`). Real domain
// segments are lowercase; a 2+ segment domain ending in a PascalCase class
// name (e.g. `...Serializable`) is a code identifier, not an email.
const CODE_FQN = /@(?:[A-Za-z0-9_-]+\.){2,}[A-Z][a-z][A-Za-z0-9_-]*$/

// Public, non-sensitive commit-author identities from GitHub/GitLab, e.g.
// `123456+user@users.noreply.github.com`. These are not leaked credentials.
const NOREPLY_EMAIL = /@(?:users\.)?noreply\.(?:github|gitlab)\.com$/i

// Git SSH remote identifiers (e.g. `git@github.com`), the standard VCS username
// rather than a personal email address.
const GIT_SSH_EMAIL = /^git@(?:ssh\.)?(?:github|gitlab|bitbucket)\.(?:com|org)$/i

// Template/placeholder email local parts (e.g. `you@company.com`, where `you`
// is a pronoun placeholder rather than a real mailbox).
const EMAIL_LOCAL_PLACEHOLDER = /^(?:you|your|me|name|username|email|user|someone|firstname|lastname|placeholder|changeme|dummy|fake|test|demo|example|sample)(?:\d+)?$/i

// Reserved example/test hosts (RFC 2606): example.com/.net/.org, plus any host
// under the .test/.example/.invalid/.localhost TLDs (e.g. `db.test`, `localhost`).
// Does NOT match real hosts like `example.io` or `test.com`.
const RESERVED_HOST = /(?:^|\.)example\.(?:com|net|org)$|(?:^|\.)(?:test|example|invalid|localhost)$/

// Extract the host from a URL-style value (scheme://host...), tolerating a
// trailing escaped backslash and an embedded `user:pass@` credential prefix.
// Strips any port so `test.com:5432` still resolves to the reserved host.
function urlHostOf(value) {
  const m = value.match(/^[a-z][a-z0-9+.-]*:\/\/([^/\s"'()\\]+)/i)
  if (!m) return null
  const host = m[1].split("@").pop().split(":")[0]
  return host.toLowerCase()
}

// Bearer "tokens" that are just prose/heading words (e.g. "Bearer authentication"
// from docs). Real tokens are kept — only a small blocklist of dictionary words
// is excluded, so purely-alphabetic API tokens are not dropped.
const BEARER_PROSE = /^(?:authentication|authorization|authorisation|token|header|scheme|type|string|value|example|basic|oauth)$/i

// Example/tutorial connection strings whose embedded password is an unambiguous
// placeholder (e.g. `mongodb://admin:s3cret@10.0.0.1/...`). Real credentials
// with weak-but-real passwords (admin, test, demo, example) are kept on purpose.
const PLACEHOLDER_CREDS = /:(s3cret|secret|password|passwd|pwd|changeme|admin|test|demo|example|letmein|qwerty)@/i

// Secret-assignment findings whose right-hand side is a variable reference
// (an identifier with no digits, optionally dotted member access, e.g.
// `token = searchParams` or `apiKey = config.secret`), not a literal. Real
// unquoted literals almost always contain digits or token punctuation
// (e.g. `client_secret=aBcD1234EfGh5678IjKl`), so they are kept.
const GENERIC_ASSIGN_IDENT = /^[^=:]+[:=]\s*[A-Za-z_$][A-Za-z_$]*(?:\.[A-Za-z_$][A-Za-z_$]*)*$/

// "Credentials in URL" false positives that are actually JSON-LD / schema.org
// structured data (coincidentally matching the `://user:pass@` shape).
const CREDS_JSONLD = /schema\.org|@type|BreadcrumbList|itemListElement/i

export const EXCLUSION_RULES = [
  {
    id: "email-reserved-domains",
    label: "Reserved example/test email domains and template local parts (RFC 2606, you@company.com, ...)",
    appliesTo: "Email Address",
    test: (value) => {
      if (RESERVED_EMAIL_DOMAIN.test(value)) return true
      const local = value.split("@")[0]
      return !!local && EMAIL_LOCAL_PLACEHOLDER.test(local)
    },
  },
  {
    id: "email-npm-package-version",
    label: "npm package version specifiers (e.g. name@1.2.3.patch)",
    appliesTo: "Email Address",
    test: (value) => NPM_PKG_PATCH.test(value) || /%2F/i.test(value),
  },
  {
    id: "email-code-this-expr",
    label: "Kotlin/Java qualified `this@` expressions",
    appliesTo: "Email Address",
    test: (value) => CODE_THIS_EXPR.test(value),
  },
  {
    id: "email-code-fqn",
    label: "Fully-qualified code references (e.g. n@kotlinx.serialization.Serializable)",
    appliesTo: "Email Address",
    test: (value) => CODE_FQN.test(value),
  },
  {
    id: "email-noreply-github",
    label: "GitHub/GitLab public noreply commit identities",
    appliesTo: "Email Address",
    test: (value) => NOREPLY_EMAIL.test(value),
  },
  {
    id: "email-git-ssh",
    label: "Git SSH remote identifiers (e.g. git@github.com)",
    appliesTo: "Email Address",
    test: (value) => GIT_SSH_EMAIL.test(value),
  },
  {
    id: "url-reserved-host",
    label: "URLs/credentials pointing at reserved example/test hosts (RFC 2606)",
    appliesTo: "*",
    test: (value) => {
      const host = urlHostOf(value)
      return !!host && RESERVED_HOST.test(host)
    },
  },
  {
    id: "bearer-prose-word",
    label: "Bearer followed by a prose word, not an actual token",
    appliesTo: "Bearer Token",
    test: (value) => BEARER_PROSE.test(value),
  },
  {
    id: "url-placeholder-creds",
    label: "Connection strings/credentials using placeholder passwords (s3cret, secret, password, ...)",
    appliesTo: "*",
    test: (value) => PLACEHOLDER_CREDS.test(value),
  },
  {
    id: "generic-assign-identifier",
    label: "Secret assignments to a variable (e.g. token = searchParams)",
    appliesTo: "Generic Secret/Password Assignment",
    test: (value) => GENERIC_ASSIGN_IDENT.test(value),
  },
  {
    id: "creds-url-jsonld",
    label: "Structured data (schema.org / JSON-LD) mistaken for credentials",
    appliesTo: "Credentials in URL",
    test: (value) => CREDS_JSONLD.test(value),
  },
]

// Returns the id of the first matching exclusion rule, or null if the finding
// should be kept.
export function matchExclusion(label, value, ctx = {}) {
  for (const rule of EXCLUSION_RULES) {
    if (rule.appliesTo !== "*" && rule.appliesTo !== label) continue
    if (rule.test(value, { label, raw: value, ...ctx })) return rule.id
  }
  return null
}
