// Inspect a captured private-key PEM/block and extract what we can without
// exposing the secret itself: algorithm, size/curve, SHA-256 fingerprint of
// the public key, and whether the key is encrypted (passphrase-protected).
//
// PGP blocks and malformed/truncated keys can't be parsed by Node's crypto, so
// we degrade gracefully and report what we know from the armor header.
import { createPrivateKey, createPublicKey, createHash } from "node:crypto"

// Single source of truth for the supported private-key type prefixes, shared
// with the scanner and the exclusion rules so adding a type only happens once.
export const KEY_TYPE_ALTS = "(?:RSA|EC|OPENSSH|DSA|PGP|ENCRYPTED)"
export const KEY_TYPES = `(?:${KEY_TYPE_ALTS} )?`

const HEADER_RE = new RegExp(`-----BEGIN (${KEY_TYPE_ALTS} )?PRIVATE KEY(?: BLOCK)?-----`)

function keyType(pem) {
  const m = String(pem).match(HEADER_RE)
  return m ? (m[1] ? `${m[1].trim()} PRIVATE KEY` : "PRIVATE KEY") : "PRIVATE KEY"
}

export function inspectPrivateKey(pem) {
  const type = keyType(pem)
  const info = { type, encrypted: false, bits: null, curve: null, fingerprint: null, note: null }

  if (/PGP/i.test(type)) {
    info.note = "PGP key — Node crypto can't parse it. Inspect with `gpg --show-keys` / `gpg --list-packets`."
    return info
  }

  try {
    const key = createPrivateKey(pem)
    const det = key.asymmetricKeyDetails || {}
    info.bits = det.modulusLength || null
    info.curve = det.namedCurve || null
    try {
      const spki = createPublicKey(key).export({ type: "spki", format: "der" })
      info.fingerprint = "SHA256:" + createHash("sha256").update(spki).digest("base64")
    } catch {
      // public key export failed — leave fingerprint null
    }
  } catch (e) {
    const msg = (e && e.message) || ""
    if (/encrypted|passphrase|DEK|bad decrypt/i.test(msg)) {
      info.encrypted = true
      info.note = "Encrypted private key — a passphrase is required to use or inspect it."
    } else {
      info.note = "Unparseable key: " + msg.split("\n")[0]
    }
  }
  return info
}

// Human-readable summary line for the report (e.g. "2048-bit RSA · SHA256:…").
export function describeKey(info) {
  if (!info) return ""
  const parts = []
  if (info.encrypted) parts.push("encrypted")
  if (info.curve) parts.push(`${info.curve} (EC)`)
  else if (info.bits) parts.push(`${info.bits}-bit`)
  if (info.fingerprint) parts.push(info.fingerprint)
  if (info.note && !info.encrypted) parts.push(info.note)
  return parts.join(" · ")
}
