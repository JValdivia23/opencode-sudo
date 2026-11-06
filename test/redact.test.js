import assert from "node:assert/strict"
import test from "node:test"
import { REDACTED, redactText, redactValue } from "../src/redact.js"

test("redactText replaces the secret", () => {
  assert.equal(redactText("senha abc123 fim", "abc123"), `senha ${REDACTED} fim`)
  assert.equal(redactText("abc123", "abc123"), REDACTED)
})

test("redactText ignores short and empty secrets", () => {
  assert.equal(redactText("abc", "abc"), "abc")
  assert.equal(redactText("abc", ""), "abc")
  assert.equal(redactText("abc", undefined), "abc")
})

test("redactValue walks objects and arrays", () => {
  const value = {
    text: "senha abc123",
    nested: { list: ["abc123", 1, true] },
    count: 2,
  }
  const result = redactValue(value, "abc123")
  assert.equal(result.text, `senha ${REDACTED}`)
  assert.equal(result.nested.list[0], REDACTED)
  assert.equal(result.nested.list[1], 1)
  assert.equal(result.count, 2)
})
