// Replaces both footers: the session footer shows only the context-window
// percentage and the session cost, and the home footer shows nothing.
// Registered from cli.json ("plugins"), so it runs locally in the TUI and
// stays active even against a remote server.
import { Plugin, usePlugin } from "@opencode/plugin/tui"

type AssistantMessage = {
  readonly type: string
  readonly tokens?: {
    readonly input: number
    readonly output: number
    readonly reasoning: number
    readonly cache?: { readonly read?: number; readonly write?: number }
  }
}

// The newest assistant message's usage describes the request that produced
// it: its input side (input + cache read + cache write) is the whole prompt
// as the provider counted it, and reasoning + output are the tokens it added
// to history. Their sum is what the session holds in the window right now.
function usedTokens(messages: readonly unknown[]): number | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i] as AssistantMessage | undefined
    if (message?.type !== "assistant" || !message.tokens) continue
    const t = message.tokens
    return t.input + t.output + t.reasoning + (t.cache?.read ?? 0) + (t.cache?.write ?? 0)
  }
  return undefined
}

function usd(value: number): string {
  if (!Number.isFinite(value)) return "—"
  if (value === 0) return "$0"
  const digits = value >= 1 ? 2 : value >= 0.01 ? 3 : 4
  return `$${value.toFixed(digits)}`
}

function Footer(props: { readonly sessionID?: string }) {
  const context = usePlugin()

  // Reads are reactive inside JSX: message list, selected model, model list
  // and cost all re-render the footer when the underlying stores update.
  const percentage = (): string => {
    if (!props.sessionID) return ""
    const messages = context.data.session.message.list(props.sessionID) ?? []
    const used = usedTokens(messages)
    const selected = context.ui.model.current()
    if (used === undefined || !selected) return ""
    const model = (context.data.location.model.list() ?? []).find(
      (m) => m.providerID === selected.providerID && m.modelID === selected.modelID,
    )
    const limit = model?.limit?.context
    if (!limit) return ""
    return `${Math.min(100, Math.round((used / limit) * 100))}%`
  }

  const cost = (): string => {
    if (!props.sessionID) return ""
    return usd(context.data.session.cost(props.sessionID))
  }

  return (
    <text fg={context.theme.text.base}>
      {percentage()} {cost()}
    </text>
  )
}

export default Plugin.define({
  id: "zed.minimal-footer",
  setup(context) {
    const claims = [
      // Session footer: agent, model, usage, TPS — replaced by two numbers.
      context.ui.slot({ replace: "prompt.footer", render: (input) => <Footer sessionID={input.sessionID} /> }),
      // Home footer (health indicators, version): removed entirely.
      context.ui.slot({ replace: "home.footer", render: () => <text></text> }),
    ]
    return () => {
      for (const claim of claims) claim()
    }
  },
})
