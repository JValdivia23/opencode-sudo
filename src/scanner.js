/**
 * Finds `sudo` words that sit in command position.
 *
 * This is a small shell-word parser, not a full shell grammar. It is adapted
 * from fitzypopper/opencode-sudo-plugin (MIT) and keeps the same practical
 * coverage: start of string, after separators/subshells/keywords/assignments,
 * outside quotes. It is deliberately conservative: a missed sudo still goes
 * through the shim at runtime and fails closed when the policy is off.
 */

/**
 * @typedef {{ start: number, end: number }} Site
 */

const KEYWORDS = new Set([
  "if",
  "then",
  "else",
  "elif",
  "while",
  "until",
  "do",
  "case",
  "time",
  "coproc",
  "!",
  "{",
  "}",
  "done",
  "fi",
  "esac",
])

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/

/** @param {string} ch */
function isSpace(ch) {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r"
}

/** @param {string} ch */
function isSeparator(ch) {
  return ch === ";" || ch === "&" || ch === "|"
}

/** @param {string} ch */
function isTerminator(ch) {
  return isSpace(ch) || isSeparator(ch) || ch === "<" || ch === ">" || ch === "(" || ch === ")"
}

/**
 * Reads one shell word starting at `start`, concatenating quoted segments so a
 * word like `"su"do` or `'sudo'` resolves to its unquoted value.
 *
 * @param {string} text
 * @param {number} start
 */
function readWord(text, start) {
  let i = start
  let value = ""
  while (i < text.length) {
    const ch = text[i]
    if (ch === "'" || ch === '"') {
      i++
      while (i < text.length && text[i] !== ch) {
        if (ch === '"' && text[i] === "\\" && i + 1 < text.length) i++
        if (i < text.length) value += text[i]
        i++
      }
      i++
      continue
    }
    if (ch === "\\" && i + 1 < text.length) {
      i++
      value += text[i]
      i++
      continue
    }
    if (isTerminator(ch)) break
    value += ch
    i++
  }
  return { end: i, value }
}

/**
 * Finds every `sudo` that sits in command position.
 *
 * @param {string} command
 * @returns {Site[]}
 */
export function findSites(command) {
  /** @type {Site[]} */
  const sites = []
  let expectCommand = true
  let i = 0
  while (i < command.length) {
    const ch = command[i]
    if (isSeparator(ch) || ch === "\n" || ch === "`" || ch === "(") {
      expectCommand = true
      i++
      continue
    }
    if (ch === ")") {
      expectCommand = false
      i++
      continue
    }
    if (ch === "<" || ch === ">") {
      i++
      continue
    }
    if (isSpace(ch)) {
      i++
      continue
    }
    const word = readWord(command, i)
    if (expectCommand && word.value === "sudo") sites.push({ start: i, end: word.end })
    // An assignment prefix (`FOO=1 sudo x`) leaves the real command to come.
    if (!ASSIGNMENT.test(word.value)) expectCommand = KEYWORDS.has(word.value)
    i = word.end
  }
  return sites
}

/**
 * @param {string} command
 * @returns {boolean}
 */
export function hasSudoSite(command) {
  return findSites(command).length > 0
}

/**
 * Replaces every command-position `sudo` with `wrapper`. Kept for tests and
 * for future command rewriting; the plugin itself prefers a PATH shim.
 *
 * @param {string} command
 * @param {string} wrapper
 * @returns {string | undefined}
 */
export function rewriteSites(command, wrapper) {
  const sites = findSites(command)
  if (sites.length === 0) return undefined
  let out = ""
  let last = 0
  for (const site of sites) {
    out += command.slice(last, site.start) + wrapper
    last = site.end
  }
  return out + command.slice(last)
}
