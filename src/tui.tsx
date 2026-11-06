/** @jsxImportSource @opentui/solid */
import { Show, createSignal, onCleanup, onMount } from "solid-js"
import { Plugin } from "@opencode/plugin/tui"
import type { Context } from "@opencode/plugin/tui/context"
import { SudoRpc, type SudoRequest, type SudoStatus } from "./rpc.js"

const DEFAULT_TIMEOUT = 120

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const data = (error as Record<string, unknown>).data
    if (data && typeof data === "object") {
      const message = (data as Record<string, unknown>).message
      if (typeof message === "string" && message) return message
    }
    const message = (error as Record<string, unknown>).message
    if (typeof message === "string" && message) return message
  }
  if (error instanceof Error && error.message) return error.message
  return String(error)
}

function mask(value: string) {
  return "•".repeat(Array.from(value).length)
}

function formatTime(timestamp: number) {
  try {
    return new Date(timestamp).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return "?"
  }
}

function sessionLabel(ctx: Context, sessionID: string) {
  if (!sessionID) return "sessão desconhecida"
  try {
    const session = ctx.data.session.get(sessionID)
    const title = (session as { title?: unknown } | undefined)?.title
    return typeof title === "string" && title ? title : sessionID
  } catch {
    return sessionID
  }
}

function statusMessage(status: SudoStatus) {
  const lines = [
    `política: ${status.policy}`,
    `TUI: ${status.tui ? "conectado" : "desconectado"}`,
    `cache: ${
      status.cached && status.expiresAt > 0
        ? `desbloqueado até ${formatTime(status.expiresAt)}`
        : "bloqueado"
    }`,
    `pedidos pendentes: ${status.pending}`,
    `instância: ${status.runtime.split("/").pop() ?? status.runtime}`,
  ]
  if (status.lastError) lines.push(`último erro: ${status.lastError}`)
  return lines.join("\n")
}

function SudoDialog(props: {
  ctx: Context
  request: SudoRequest
  onDone: () => void
  onCancel: (reason?: string) => void
}) {
  const [value, setValue] = createSignal("")
  const [error, setError] = createSignal<string | undefined>(undefined)
  const [busy, setBusy] = createSignal(false)
  let disposed = false

  const timeout = Number((props.ctx.options as Record<string, unknown>).timeout ?? DEFAULT_TIMEOUT)
  const timer = setTimeout(
    () => {
      if (!busy()) props.onCancel("Tempo esgotado.")
    },
    (Math.max(5, Number.isFinite(timeout) ? timeout : DEFAULT_TIMEOUT) + 2) * 1000,
  )

  async function submit() {
    if (busy() || disposed) return
    const password = value()
    if (!password) {
      setError("Digite a senha.")
      return
    }
    setBusy(true)
    setError(undefined)
    try {
      const result = (await props.ctx.client.rpc(SudoRpc).unlock({
        requestID: props.request.id,
        password,
      })) as { ok: boolean; reason: string }
      if (disposed) return
      if (result.ok) {
        props.onDone()
        return
      }
      if (result.reason === "invalid") {
        setError("Senha incorreta. Tente novamente.")
        setValue("")
        return
      }
      if (result.reason === "empty") {
        setError("Digite a senha.")
        return
      }
      if (result.reason === "expired") {
        props.onCancel("A solicitação expirou.")
        return
      }
      setError(result.reason ? `Falha ao autorizar: ${result.reason}` : "Falha ao autorizar.")
    } catch (cause) {
      if (!disposed) setError(errorMessage(cause))
    } finally {
      if (!disposed) setBusy(false)
    }
  }

  onMount(() => {
    const keyHandler = (key: {
      name: string
      sequence?: string
      ctrl?: boolean
      meta?: boolean
      option?: boolean
      super?: boolean
      eventType?: string
      preventDefault?: () => void
      stopPropagation?: () => void
    }) => {
      if (key.eventType === "release") return
      if (busy()) {
        key.preventDefault?.()
        key.stopPropagation?.()
        return
      }
      if (key.name === "escape" || (key.ctrl && key.name === "c")) {
        key.preventDefault?.()
        key.stopPropagation?.()
        props.onCancel("Cancelado pelo usuário.")
        return
      }
      if (key.name === "return" || key.name === "enter") {
        key.preventDefault?.()
        key.stopPropagation?.()
        void submit()
        return
      }
      if (key.name === "backspace" || key.name === "delete") {
        key.preventDefault?.()
        key.stopPropagation?.()
        setValue((current) => current.slice(0, -1))
        return
      }
      if (key.name === "tab") {
        key.preventDefault?.()
        key.stopPropagation?.()
        return
      }
      if (key.ctrl && key.name === "u") {
        key.preventDefault?.()
        key.stopPropagation?.()
        setValue("")
        return
      }
      if (key.ctrl || key.meta || key.option || key.super) return
      const sequence = key.sequence
      if (typeof sequence !== "string" || Array.from(sequence).length !== 1) return
      const code = sequence.codePointAt(0) ?? 0
      if (code < 32 || code === 127) return
      key.preventDefault?.()
      key.stopPropagation?.()
      setValue((current) => current + sequence)
    }

    const pasteHandler = (event: {
      bytes?: Uint8Array
      preventDefault?: () => void
      stopPropagation?: () => void
    }) => {
      if (busy() || !event.bytes) return
      try {
        const text = new TextDecoder().decode(event.bytes).replace(/[\r\n\t]/g, "")
        if (!text) return
        event.preventDefault?.()
        event.stopPropagation?.()
        setValue((current) => current + text)
      } catch {
        // ignore malformed paste data
      }
    }

    props.ctx.renderer.keyInput.on("keypress", keyHandler)
    props.ctx.renderer.keyInput.on("paste", pasteHandler)
    onCleanup(() => {
      disposed = true
      clearTimeout(timer)
      props.ctx.renderer.keyInput.off("keypress", keyHandler)
      props.ctx.renderer.keyInput.off("paste", pasteHandler)
    })
  })

  const theme = props.ctx.theme

  return (
    <box flexDirection="column" paddingLeft={2} paddingRight={2} gap={1}>
      <text fg={theme.text.base}>
        <b>Autenticação sudo</b>
      </text>
      <text fg={theme.text.muted}>O OpenCode quer executar como root:</text>

      <box paddingLeft={1} paddingRight={1} marginTop={1}>
        <text fg={theme.text.base}>
          <b>{props.request.command}</b>
        </text>
      </box>

      <Show
        when={props.request.contextCommand && props.request.contextCommand !== props.request.command}
      >
        <text fg={theme.text.faint}>Contexto: {props.request.contextCommand}</text>
      </Show>

      <text fg={theme.text.muted}>Local: {props.request.cwd || "—"}</text>
      <text fg={theme.text.muted}>
        Sessão: {sessionLabel(props.ctx, props.request.sessionID)} · {props.request.user}@
        {props.request.host}
      </text>

      <box flexDirection="row" gap={1} marginTop={1}>
        <text fg={theme.text.base}>{props.request.prompt || "Senha:"}</text>
        <Show when={value()} fallback={<text fg={theme.text.faint}>digite a senha</text>}>
          <text fg={theme.text.base}>{mask(value())}</text>
        </Show>
        <text fg={theme.text.base}>▏</text>
      </box>

      <Show when={error()}>
        <text fg={theme.text.feedback.error.base}>{error()}</text>
      </Show>

      <Show when={busy()}>
        <text fg={theme.text.muted}>verificando...</text>
      </Show>

      <text fg={theme.text.faint}>enter autorizar   esc cancelar</text>
    </box>
  )
}

export default Plugin.define({
  id: "opencode-sudo",
  setup(ctx) {
    let open = false
    let polling = false
    let disposed = false
    let interval: ReturnType<typeof setInterval> | undefined
    let heartbeat: ReturnType<typeof setInterval> | undefined
    let unsubscribe: (() => void) | undefined

    const client = () => ctx.client.rpc(SudoRpc)

    const showDialog = (request: SudoRequest) => {
      if (disposed || open) return
      open = true
      let settled = false

      const close = (action: "done" | "cancel", reason?: string) => {
        if (settled) return
        settled = true
        open = false
        try {
          ctx.ui.dialog.clear()
        } catch {
          // the dialog may already be gone
        }
        if (action === "cancel") {
          try {
            void client()
              .cancel({ requestID: request.id })
              .catch(() => {})
          } catch {
            // client may be unavailable during shutdown
          }
        }
        if (!disposed) void poll()
        if (reason) {
          ctx.ui.toast.show({
            message: reason,
            variant: action === "cancel" ? "warning" : "success",
          })
        }
      }

      ctx.ui.dialog.set({ size: "large", centered: true })
      try {
        ctx.ui.dialog.show(
          () => (
            <SudoDialog
              ctx={ctx}
              request={request}
              onDone={() => close("done")}
              onCancel={(reason) => close("cancel", reason)}
            />
          ),
          () => {
            if (!settled) close("cancel", "Autenticação sudo cancelada.")
          },
        )
      } catch (cause) {
        open = false
        settled = true
        ctx.ui.toast.show({ message: errorMessage(cause), variant: "error" })
        try {
          void client()
            .cancel({ requestID: request.id })
            .catch(() => {})
        } catch {
          // ignore
        }
        return
      }

      const notify = (ctx.options as Record<string, unknown>).notify !== false
      if (notify) {
        void ctx.attention
          .notify({
            title: "sudo",
            message: request.command,
            notification: { when: "blurred" },
            sound: { name: "permission", when: "blurred" },
          })
          .catch(() => {})
      }
    }

    const poll = async () => {
      if (disposed || open || polling) return
      polling = true
      try {
        const result = (await client().pending({})) as { request: SudoRequest }
        if (disposed || open) return
        if (result.request && result.request.id) showDialog(result.request)
      } catch {
        // the server may still be starting; the interval retries
      } finally {
        polling = false
      }
    }

    const beat = async () => {
      if (disposed) return
      try {
        await client().hello({})
      } catch {
        // the server may still be starting
      }
    }

    heartbeat = setInterval(() => {
      void beat()
    }, 2000)
    void beat()

    try {
      unsubscribe = client().events.on("need", () => {
        if (!disposed && !open) void poll()
      })
    } catch {
      // polling is the fallback
    }

    interval = setInterval(() => {
      if (!disposed && !open) void poll()
    }, 1000)
    void poll()

    ctx.keymap.layer(() => ({
      mode: "global",
      commands: [
        {
          id: "opencode-sudo.command",
          title: "Sudo",
          description: "Status, política e bloqueio do sudo",
          group: "Sudo",
          palette: true,
          bind: false,
          slash: { name: "sudo", arguments: true },
          run: async (input) => {
            const arg = (input ?? "").trim().toLowerCase()
            try {
              if (!arg || arg === "status") {
                const status = (await client().status({})) as SudoStatus
                await ctx.ui.dialog.alert({ title: "Sudo", message: statusMessage(status) })
                return
              }
              if (arg === "on" || arg === "ask" || arg === "off") {
                const result = (await client().setPolicy({ policy: arg })) as {
                  ok: boolean
                  policy: string
                }
                ctx.ui.toast.show({
                  message: `sudo: ${result.policy}`,
                  variant: result.ok ? "success" : "error",
                })
                return
              }
              if (arg === "lock") {
                await client().lock({})
                ctx.ui.toast.show({ message: "sudo bloqueado", variant: "success" })
                return
              }
              ctx.ui.toast.show({
                message: "uso: /sudo on|ask|off|lock|status",
                variant: "info",
              })
            } catch (cause) {
              ctx.ui.toast.show({ message: errorMessage(cause), variant: "error" })
            }
          },
        },
      ],
    }))

    return () => {
      disposed = true
      if (interval) clearInterval(interval)
      if (heartbeat) clearInterval(heartbeat)
      try {
        unsubscribe?.()
      } catch {
        // ignore
      }
    }
  },
})
