#!/usr/bin/env bun
/**
 * skill-snippet — pick one of the markdown snippets in
 * ~/.config/herdr/skill-snippets/ and insert it into the pane you launched
 * from.
 *
 * Runs inside the quick-actions overlay pane (which has a real tty), so fzf
 * gets an interactive picker. On selection the snippet is copied to the system
 * clipboard, typed into the launching pane (HERDR_PLUS_PANE_ID) via send-text —
 * herdr cannot synthesize a real cmd+v keystroke, it would send a literal "v" —
 * and submitted with shift+enter.
 */
import { $ } from 'bun'

const dir = process.env.SKILL_SNIPPETS_DIR ?? `${process.env.HOME}/.config/herdr/skill-snippets`

const files = (await $`find ${dir} -maxdepth 1 -name '*.md' -type f`.nothrow().quiet().text())
  .trim()
  .split('\n')
  .filter(Boolean)
  .sort()

if (files.length === 0) {
  console.error(`skill-snippet: no .md snippets in ${dir}`)
  process.exit(1)
}

const picked = (
  await $`fzf --preview='cat {}' --prompt='skill snippet > ' --height=100% --border < ${new Response(files.join('\n'))}`
    .nothrow()
    .text()
).trim()

if (!picked) process.exit(0)

// The system clipboard gets the snippet too, so a manual cmd+v anywhere works.
const copy = Bun.spawn(['pbcopy'], { stdin: Bun.file(picked) })
await copy.exited

// herdr-plus hands the launching pane's id to the action's environment.
const target = process.env.HERDR_PLUS_PANE_ID

if (target) {
  await $`herdr pane send-text ${target} ${await Bun.file(picked).text()}`.nothrow()
  await $`herdr pane send-keys ${target} shift+enter`.nothrow()
  console.log(`skill-snippet: inserted ${picked.split('/').pop()}`)
} else {
  console.log(`skill-snippet: copied ${picked.split('/').pop()}`)
}