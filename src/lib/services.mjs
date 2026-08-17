// Single source of truth for how each token type is validated and how to
// reproduce that check with curl. Imported by both validate.mjs (endpoint
// selection) and report.mjs (the copy-as-curl button) so the logic is never
// duplicated.
//
// `auth` controls how the secret is sent:
//   "header" -> Authorization: Bearer <token> header (GitHub, OpenAI)
//   "key"    -> key already embedded in the URL query (?key=<token>) (Google)

export const SERVICES = {
  github: {
    label: "GitHub",
    auth: "header",
    endpoint: "https://api.github.com/user",
  },
  openai: {
    label: "OpenAI",
    auth: "header",
    endpoint: "https://api.openai.com/v1/models",
  },
  google: {
    label: "Google",
    auth: "key",
    // Candidate endpoints tried in order; {key} is replaced with the API key.
    endpoints: [
      "https://generativelanguage.googleapis.com/v1beta/models?key={key}",
      "https://translation.googleapis.com/language/translate/v2?q=hi&target=es&format=text&key={key}",
      "https://maps.googleapis.com/maps/api/geocode/json?address=test&key={key}",
      "https://www.googleapis.com/youtube/v3/videos?part=snippet&id=dQw4w9WgXcQ&key={key}",
    ],
  },
}

export function curlCommand({ type, value, endpoint, usedAt } = {}) {
  const svc = SERVICES[type]
  if (endpoint && svc?.auth === "header") {
    return `curl -s -H "Authorization: Bearer ${value}" "${endpoint}"`
  }
  if (endpoint) {
    // key-based (Google) or any endpoint that already embeds the secret
    return `curl -s "${endpoint}"`
  }
  if (usedAt) {
    return `curl -s -H "Authorization: Bearer ${value}" "${usedAt}"`
  }
  return null
}
