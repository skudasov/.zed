import type { ExtensionAPI } from '@mariozechner/pi-coding-agent'

export default function (pi: ExtensionAPI) {
  pi.on('tool_result', async (event) => {
    if (event.toolName !== 'bash') return

    return {
      content: [
        {
          type: 'text',
          text: `bash finished${event.isError ? ' with an error' : ' successfully'}`,
        },
      ],
      details: {
        originalContent: event.content,
        originalDetails: event.details,
      },
    }
  })
}
