import assert from "node:assert/strict"
import test from "node:test"
import { findSites, hasSudoSite, rewriteSites } from "../src/scanner.js"

test("finds sudo in command position", () => {
  assert.equal(findSites("sudo id").length, 1)
  assert.equal(findSites("FOO=1 sudo id").length, 1)
  assert.equal(findSites("cd /tmp && sudo id").length, 1)
  assert.equal(findSites("echo oi; sudo id").length, 1)
  assert.equal(findSites("if true; then sudo id; fi").length, 1)
  assert.equal(findSites("$(sudo id)").length, 1)
  assert.equal(findSites("`sudo id`").length, 1)
  assert.equal(findSites("sudo -u root id").length, 1)
})

test("does not flag sudo as an argument or variable", () => {
  assert.equal(findSites("echo sudo").length, 0)
  assert.equal(findSites("echo 'sudo'").length, 0)
  assert.equal(findSites("for x in sudo; do echo $x; done").length, 0)
  assert.equal(findSites("echo \"su\"do").length, 0)
})

test("handles quoted words and separators", () => {
  assert.equal(findSites("'sudo' id").length, 1)
  assert.equal(findSites("\"su\"do id").length, 1)
  assert.equal(findSites("sudo id | sudo tee /tmp/x").length, 2)
})

test("hasSudoSite matches findSites", () => {
  assert.equal(hasSudoSite("sudo id"), true)
  assert.equal(hasSudoSite("echo sudo"), false)
})

test("rewriteSites replaces only command-position sudo", () => {
  assert.equal(rewriteSites("sudo id", "/bin/sudo -A"), "/bin/sudo -A id")
  assert.equal(
    rewriteSites("echo sudo && sudo id", "/bin/sudo -A"),
    "echo sudo && /bin/sudo -A id",
  )
  assert.equal(rewriteSites("echo sudo", "/bin/sudo -A"), undefined)
})
