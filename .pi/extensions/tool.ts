import type { ExtensionAPI } from '@mariozechner/pi-coding-agent'
import { Type } from '@sinclair/typebox'

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: 'echo_text',
    label: 'Echo Text',
    description: 'Return the input text unchanged',
    parameters: Type.Object({
      text: Type.String({ description: 'Text to echo back' }),
    }),
    async execute(_toolCallId, params) {
      return {
        content: [{ type: 'text', text: `Echo: ${params.text}` }],
        details: { echoed: params.text },
      }
    },
  })
}
