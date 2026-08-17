// Secret/token detection catalog. `validate` is the validator key used by
// validate.mjs (null = detected but not server-validated by this tool).
export const PATTERNS = [
  { label: "AWS Access Key ID", src: "AKIA[0-9A-Z]{16}", validate: null },
  { label: "AWS Secret Access Key", src: "(?:secretAccessKey|aws_secret_access_key)[\"']?\\s*[:=]\\s*[\"']?[A-Za-z0-9/+=]{32,}[\"']?", validate: null },
  { label: "Private Key Block", src: "-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP |ENCRYPTED )?PRIVATE KEY-----", validate: null },
  { label: "PGP Private Key Block", src: "-----BEGIN PGP PRIVATE KEY BLOCK-----", validate: null },
  { label: "Google API Key", src: "AIza[0-9A-Za-z_\\-]{35}", validate: "google" },
  { label: "Slack Token", src: "xox[baprs]-[0-9A-Za-z\\-]{10,}", validate: null },
  { label: "Stripe Key", src: "sk_(live|test)_[0-9a-zA-Z]{16,}|pk_(live|test)_[0-9a-zA-Z]{16,}", validate: null },
  { label: "GitHub Token", src: "gh[pousr]_[0-9A-Za-z]{36,}|github_pat_[0-9A-Za-z_]{50,}", validate: "github" },
  { label: "GitLab Token", src: "glpat-[0-9a-zA-Z_\\-]{20,}", validate: null },
  { label: "OpenAI API Key", src: "sk-[0-9a-zA-Z]{20,}", validate: "openai" },
  { label: "Anthropic API Key", src: "sk-ant-[0-9A-Za-z\\-]{20,}", validate: null },
  { label: "NPM Token", src: "npm_[0-9A-Za-z]{36,}", validate: null },
  { label: "JWT", src: "eyJ[A-Za-z0-9_\\-]{8,}\\.eyJ[A-Za-z0-9_\\-]{8,}\\.[A-Za-z0-9_\\-]{8,}", validate: "jwt" },
  { label: "Bearer Token", src: "Bearer\\s+[A-Za-z0-9._\\-]{12,}", validate: null, context: true },
  { label: "Credentials in URL", src: "://[^\\s:/]+:[^\\s@/]+@", validate: null },
  { label: "DB/Service Connection String", src: "(?:postgres(?:ql)?|mysql|mongodb(?:\\+srv)?|redis|amqp|ftp)://[^\\s\"'\\)\\]]+", validate: null },
  { label: "Generic Secret/Password Assignment", src: "(?:api[_-]?key|apikey|access[_-]?key|client[_-]?secret|private[_-]?key|secret|token|password|passwd|pwd|auth[_-]?token)[\"']?\\s*[:=]\\s*[\"']?[A-Za-z0-9+/=_\\-]{12,}[\"']?", validate: null },
  { label: "Email Address", src: "[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,}", validate: null },
  { label: "URL Reference", src: "https?://[^\\s\"'\\)\\]]+", validate: null, noisy: true },
  { label: "Sensitive Keyword Context", src: "(?:secret|password|passwd|pwd|token|api[_-]?key|access[_-]?key|client[_-]?secret|private[_-]?key|auth(?:entication)?|credential)\\b.{0,100}", validate: null, noisy: true },
]
