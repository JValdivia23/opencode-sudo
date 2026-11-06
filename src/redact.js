export const REDACTED = "[REDACTED]"

/**
 * A short password is still a secret, but replacing every occurrence of a
 * one-character password would destroy normal output. The askpass cache is
 * only used for redaction after a successful unlock, so this threshold is a
 * pragmatic safety net, not the primary control.
 *
 * @param {string} text
 * @param {string} secret
 */
export function redactText(text, secret) {
  if (typeof text !== "string") return text
  if (typeof secret !== "string" || secret.length < 4) return text
  return text.split(secret).join(REDACTED)
}

/**
 * Walk a tool result or prompt payload and replace the cached password in all
 * string values. Mutates plain objects/arrays in place, which matches how the
 * plugin hook exposes `event.result`.
 *
 * @param {unknown} value
 * @param {string} secret
 * @param {number} [depth]
 * @returns {unknown}
 */
export function redactValue(value, secret, depth = 0) {
  if (typeof value === "string") return redactText(value, secret)
  if (value === null || typeof value !== "object" || depth > 24) return value
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      value[index] = redactValue(value[index], secret, depth + 1)
    }
    return value
  }
  for (const key of Object.keys(value)) {
    try {
      /** @type {Record<string, unknown>} */ (value)[key] = redactValue(
        /** @type {Record<string, unknown>} */ (value)[key],
        secret,
        depth + 1,
      )
    } catch {
      // ignore read-only properties
    }
  }
  return value
}
