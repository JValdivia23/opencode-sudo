import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import {
  Policies,
  policyFile,
  readPolicyFile,
  resolvePolicy,
  writePolicyFile,
} from "../src/policy.js"

const isolated = {
  XDG_CONFIG_HOME: path.join(os.tmpdir(), `opencode-sudo-test-${process.pid}-${Date.now()}`),
}

test("defaults to on", () => {
  assert.deepEqual(Policies, ["on", "ask", "off"])
  assert.equal(resolvePolicy(undefined, isolated), "on")
  assert.equal(resolvePolicy("nope", isolated), "on")
})

test("env has precedence over file and option", () => {
  assert.equal(
    resolvePolicy("off", { ...isolated, OPENCODE_SUDO_POLICY: "ask" }, "on"),
    "ask",
  )
  assert.equal(resolvePolicy("off", { ...isolated, OPENCODE_SUDO_POLICY: " " }, "on"), "on")
})

test("file has precedence over option", () => {
  assert.equal(resolvePolicy("off", isolated, "ask"), "ask")
})

test("option is used when env and file are absent", () => {
  assert.equal(resolvePolicy("ask", isolated), "ask")
  assert.equal(resolvePolicy("off", isolated), "off")
})

test("state file roundtrip", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "opencode-sudo-policy-"))
  const env = { XDG_CONFIG_HOME: base }
  try {
    assert.equal(policyFile(env), path.join(base, "opencode", "sudo-policy"))
    assert.equal(readPolicyFile(env), undefined)
    writePolicyFile("ask", env)
    assert.equal(readPolicyFile(env), "ask\n")
    assert.equal(resolvePolicy(undefined, env), "ask")
    writePolicyFile("off", env)
    assert.equal(resolvePolicy("on", env), "off")
  } finally {
    fs.rmSync(base, { recursive: true, force: true })
  }
})
