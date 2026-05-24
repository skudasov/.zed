<script lang="ts">
  import type { PageData } from './$types'
  import type { ContentBlock, TextBlock, ToolUseBlock, ToolResultBlock } from '$lib/sessions'

  let { data }: { data: PageData } = $props()

  function toolResultText(content: ToolResultBlock['content']): string {
    if (typeof content === 'string') return content
    return content.map(b => b.text ?? '').join('\n')
  }
</script>

<div class="max-w-3xl mx-auto px-4 py-6">
  <div class="flex items-center gap-3 mb-6">
    <a href="/" class="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">← back</a>
    <span class="text-xs font-mono text-zinc-700 truncate">{data.session.id}</span>
    <span class="text-xs bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded ml-auto">{data.session.project}</span>
  </div>

  <div class="space-y-3">
    {#each data.session.messages as msg (msg.timestamp + msg.role)}
      <div class="flex gap-3">
        <!-- avatar -->
        <div class="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center
                    text-xs font-bold mt-0.5
                    {msg.role === 'user'
                      ? 'bg-zinc-700 text-zinc-300 border border-zinc-600'
                      : 'bg-zinc-800 text-zinc-500 border border-zinc-700'}">
          {msg.role === 'user' ? 'U' : 'A'}
        </div>

        <!-- bubble -->
        <div class="flex-1 min-w-0 rounded-lg px-4 py-3
                    {msg.role === 'user'
                      ? 'bg-zinc-800/60 border border-zinc-700'
                      : 'bg-zinc-900 border border-zinc-800'}">

          <div class="text-xs text-zinc-600 uppercase tracking-widest mb-2">{msg.role}</div>

          {#if typeof msg.content === 'string'}
            <pre class="text-sm text-zinc-300 whitespace-pre-wrap break-words font-sans">{msg.content}</pre>

          {:else}
            {#each msg.content as block}
              {#if block.type === 'text'}
                <pre class="text-sm text-zinc-300 whitespace-pre-wrap break-words font-sans">{(block as TextBlock).text}</pre>

              {:else if block.type === 'tool_use'}
                <details class="mt-2 group">
                  <summary class="text-xs text-zinc-600 cursor-pointer hover:text-zinc-400 list-none flex items-center gap-1.5">
                    <span class="text-zinc-700 group-open:rotate-90 transition-transform inline-block">▶</span>
                    tool_use: <code class="text-zinc-500">{(block as ToolUseBlock).name}</code>
                  </summary>
                  <pre class="text-xs text-zinc-500 mt-2 bg-zinc-950 border border-zinc-800 p-3 rounded
                              overflow-auto max-h-52 whitespace-pre-wrap break-words">{JSON.stringify((block as ToolUseBlock).input, null, 2)}</pre>
                </details>

              {:else if block.type === 'tool_result'}
                <details class="mt-2 group">
                  <summary class="text-xs text-zinc-600 cursor-pointer hover:text-zinc-400 list-none flex items-center gap-1.5">
                    <span class="text-zinc-700 group-open:rotate-90 transition-transform inline-block">▶</span>
                    tool_result
                  </summary>
                  <pre class="text-xs text-zinc-500 mt-2 bg-zinc-950 border border-zinc-800 p-3 rounded
                              overflow-auto max-h-52 whitespace-pre-wrap break-words">{toolResultText((block as ToolResultBlock).content)}</pre>
                </details>

              {:else}
                <details class="mt-2 group">
                  <summary class="text-xs text-zinc-600 cursor-pointer hover:text-zinc-400 list-none flex items-center gap-1.5">
                    <span class="text-zinc-700 group-open:rotate-90 transition-transform inline-block">▶</span>
                    {(block as ContentBlock).type}
                  </summary>
                  <pre class="text-xs text-zinc-500 mt-2 bg-zinc-950 border border-zinc-800 p-3 rounded
                              overflow-auto max-h-52 whitespace-pre-wrap break-words">{JSON.stringify(block, null, 2)}</pre>
                </details>
              {/if}
            {/each}
          {/if}

        </div>
      </div>
    {/each}
  </div>
</div>
