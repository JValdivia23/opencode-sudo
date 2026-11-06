import { Rpc } from "@opencode/plugin/rpc"

export interface SudoRequest {
  readonly id: string
  readonly command: string
  readonly contextCommand: string
  readonly cwd: string
  readonly sessionID: string
  readonly prompt: string
  readonly user: string
  readonly host: string
  readonly createdAt: number
}

export interface SudoStatus {
  readonly policy: "on" | "ask" | "off"
  readonly pending: number
  readonly cached: boolean
  readonly expiresAt: number
  readonly tui: boolean
  readonly runtime: string
  readonly lastError: string
}

export function emptyRequest(): SudoRequest {
  return {
    id: "",
    command: "",
    contextCommand: "",
    cwd: "",
    sessionID: "",
    prompt: "",
    user: "",
    host: "",
    createdAt: 0,
  }
}

const requestSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    command: { type: "string" },
    contextCommand: { type: "string" },
    cwd: { type: "string" },
    sessionID: { type: "string" },
    prompt: { type: "string" },
    user: { type: "string" },
    host: { type: "string" },
    createdAt: { type: "number" },
  },
  required: [
    "id",
    "command",
    "contextCommand",
    "cwd",
    "sessionID",
    "prompt",
    "user",
    "host",
    "createdAt",
  ],
  additionalProperties: false,
} as const

const emptyInput = {
  type: "object",
  properties: {},
  additionalProperties: false,
} as const

const okOutput = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
  },
  required: ["ok"],
  additionalProperties: false,
} as const

export const SudoRpc = Rpc.define({
  id: "opencode-sudo",
  methods: {
    hello: {
      input: emptyInput,
      output: okOutput,
    },
    pending: {
      input: emptyInput,
      output: {
        type: "object",
        properties: {
          request: requestSchema,
        },
        required: ["request"],
        additionalProperties: false,
      },
    },
    unlock: {
      input: {
        type: "object",
        properties: {
          requestID: { type: "string" },
          password: { type: "string" },
        },
        required: ["requestID", "password"],
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: {
          ok: { type: "boolean" },
          reason: { type: "string" },
        },
        required: ["ok", "reason"],
        additionalProperties: false,
      },
    },
    cancel: {
      input: {
        type: "object",
        properties: {
          requestID: { type: "string" },
        },
        required: ["requestID"],
        additionalProperties: false,
      },
      output: okOutput,
    },
    lock: {
      input: emptyInput,
      output: okOutput,
    },
    status: {
      input: emptyInput,
      output: {
        type: "object",
        properties: {
          policy: { type: "string", enum: ["on", "ask", "off"] },
          pending: { type: "number" },
          cached: { type: "boolean" },
          expiresAt: { type: "number" },
          tui: { type: "boolean" },
          runtime: { type: "string" },
          lastError: { type: "string" },
        },
        required: ["policy", "pending", "cached", "expiresAt", "tui", "runtime", "lastError"],
        additionalProperties: false,
      },
    },
    setPolicy: {
      input: {
        type: "object",
        properties: {
          policy: { type: "string", enum: ["on", "ask", "off"] },
        },
        required: ["policy"],
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: {
          ok: { type: "boolean" },
          policy: { type: "string", enum: ["on", "ask", "off"] },
        },
        required: ["ok", "policy"],
        additionalProperties: false,
      },
    },
  },
  events: {
    need: {
      schema: {
        type: "object",
        properties: {
          request: requestSchema,
        },
        required: ["request"],
        additionalProperties: false,
      },
    },
  },
})
