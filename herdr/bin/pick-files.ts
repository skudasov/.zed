#!/usr/bin/env bun
/**
 * pick-files — multi-select repo files with fzf and type them into the agent
 * in the pane you launched from as `@path` mentions, to scope its context.
 *
 * Runs inside the quick-actions overlay pane (real tty), like humanize. The
 * mentions are sent without Enter, so you finish the prompt yourself.
 * `@path` is the file-mention syntax of claude, opencode and codex alike.
 */
import { $ } from 'bun'

const cwd = process.argv[2] ?? process.cwd()

// Tracked plus untracked-but-not-ignored, so new files show up too.
const files = (await $`git -C ${cwd} ls-files --cached --others --exclude-standard`.nothrow().quiet().text()).trim()
if (!files) {
  console.error(`pick-files: no git files in ${cwd}`)
  process.exit(1)
}

const picked = (
  await $`fzf -m --preview='bat --color=always --style=numbers ${cwd}/{} 2>/dev/null || head -200 ${cwd}/{}' --prompt='files (tab to mark) > ' --height=100% --border < ${new Response(files)}`
    .cwd(cwd)
    .nothrow()
    .text()
).trim()
if (!picked) process.exit(1)

const mentions = picked.split('\n').map((f) => `@${f}`).join(' ') + ' '

const target = process.env.HERDR_PLUS_PANE_ID
if (!target) {
  console.log(mentions)
  process.exit(0)
}

await $`herdr pane send-text ${target} ${mentions}`.nothrow()
console.log(`pick-files: sent ${picked.split('\n').length} file(s) to the launching pane`)
