import type { ExtensionAPI } from '@mariozechner/pi-coding-agent'

export default function (pi: ExtensionAPI) {
  pi.registerCommand('hello', {
    description: 'Minimal example custom command',

    handler: async (args, ctx) => {
      ctx.ui.notify(`Hello ${args || 'world'}!`, 'info')
    },
  })
}
