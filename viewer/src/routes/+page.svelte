<script lang="ts">
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()

  let query = $state('')

  const filtered = $derived(
    query.trim()
      ? data.sessions.filter(s =>
          s.preview.toLowerCase().includes(query.toLowerCase()) ||
          s.project.toLowerCase().includes(query.toLowerCase())
        )
      : data.sessions
  )
</script>

<div class="max-w-3xl mx-auto px-4 py-6">
  <div class="sticky top-0 bg-zinc-950 pb-4 pt-2">
    <input
      bind:value={query}
      placeholder="Search sessions…"
      class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-zinc-100
             placeholder-zinc-500 focus:outline-none focus:border-zinc-500 text-sm"
    />
    <p class="text-xs text-zinc-600 mt-2">{filtered.length} / {data.sessions.length} sessions</p>
  </div>

  <div class="space-y-2">
    {#each filtered as session (session.id)}
      <a
        href="/{session.id}"
        class="block bg-zinc-900 border border-zinc-800 rounded-lg p-4
               hover:border-zinc-600 transition-colors"
      >
        <div class="flex items-center gap-2 mb-2 flex-wrap">
          <span class="text-xs font-mono bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
            {session.project}
          </span>
          <span class="text-xs text-zinc-600">{session.date}</span>
          <span class="text-xs font-mono text-zinc-700 ml-auto">{session.id.slice(0, 8)}…</span>
        </div>
        <p class="text-sm text-zinc-400 line-clamp-2 leading-relaxed">{session.preview}</p>
      </a>
    {/each}
  </div>
</div>
