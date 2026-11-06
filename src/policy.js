import fs from "node:fs"
import os from "node:os"
import path from "node:path"

/**
 * @typedef {"on" | "ask" | "off"} Policy
 */

/** @type {readonly Policy[]} */
export const Policies = ["on", "ask", "off"]

/** @type {Policy} */
export const DEFAULT_POLICY = "on"

/**
 * Shared state file used by the server, the TUI command, and (optionally) a
 * small CLI helper. It contains one word and is not a secret.
 *
 * @param {NodeJS.ProcessEnv} [env]
 */
export function policyFile(env = process.env) {
  const base = env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config")
  return path.join(base, "opencode", "sudo-policy")
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string | undefined}
 */
export function readPolicyFile(env = process.env) {
  try {
    return fs.readFileSync(policyFile(env), "utf8")
  } catch {
    return undefined
  }
}

/**
 * @param {Policy} policy
 * @param {NodeJS.ProcessEnv} [env]
 */
export function writePolicyFile(policy, env = process.env) {
  const file = policyFile(env)
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
  fs.writeFileSync(file, policy + "\n")
  return file
}

/**
 * Resolve the effective policy. Precedence: OPENCODE_SUDO_POLICY env, the live
 * state file, the plugin option, then the default.
 *
 * @param {unknown} option
 * @param {NodeJS.ProcessEnv} [env]
 * @param {string | undefined} [file]
 * @returns {Policy}
 */
export function resolvePolicy(option, env = process.env, file = readPolicyFile(env)) {
  for (const candidate of [env.OPENCODE_SUDO_POLICY, file, option]) {
    if (typeof candidate !== "string") continue
    const value = candidate.trim()
    if (Policies.includes(/** @type {Policy} */ (value))) return /** @type {Policy} */ (value)
  }
  return DEFAULT_POLICY
}

/** @type {Map<string, string>} */
const binaryCache = new Map()

/**
 * Resolve a binary on PATH once per process, falling back to the bare name.
 *
 * @param {string} binary
 * @param {NodeJS.ProcessEnv} [env]
 */
export function which(binary, env = process.env) {
  const cached = binaryCache.get(binary)
  if (cached) return cached
  let resolved = binary
  for (const dir of (env.PATH ?? "").split(":")) {
    if (!dir) continue
    const candidate = path.join(dir, binary)
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        resolved = candidate
        break
      }
    } catch {
      // ignore unreadable PATH entries
    }
  }
  binaryCache.set(binary, resolved)
  return resolved
}
