import type { ExtensionAPI } from '@mariozechner/pi-coding-agent'

export default function (pi: ExtensionAPI) {
  pi.on('tool_call', async (event) => {
    console.log(`[pi tool_call] ${event.toolName}`, event.input)

    const arr = []

    if (
      event.toolName === 'bash' &&
      typeof event.input?.command === 'string' &&
      event.input.command.includes('rm -rf')
    ) {
      return {
        block: true,
        reason: 'Blocked dangerous bash command containing rm -rf',
      }
    }
  })
}
