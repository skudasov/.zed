#!/usr/bin/env bun
/**
 * humanize — send a humanizer request to the agent in the pane you launched
 * from, for a file in the repo or for whatever is on the clipboard.
 *
 * The humanizer skill (github.com/blader/humanizer, installed into every
 * harness by `just install-skills`) is plain markdown with a description, so
 * plain-language prompts trigger it in claude and opencode alike. Nothing here
 * is harness-specific — no `/humanizer`, no plugin command.
 *
 * Runs inside the quick-actions overlay pane (real tty), so fzf gets an
 * interactive picker, and hands the prompt to HERDR_PLUS_PANE_ID the same way
 * skill-snippet does: send-text, then shift+enter to submit.
 */
import { $ } from 'bun'

const [mode = 'file', dirArg] = process.argv.slice(2)
const cwd = dirArg ?? process.cwd()

/** The prose files a rewrite makes sense for — tracked, so no node_modules. */
const proseGlobs = ['*.md', '*.mdx', '*.markdown', '*.txt', '*.rst', '*.adoc']

async function pickFile(): Promise<string | undefined> {
  const tracked = (await $`git -C ${cwd} ls-files -- ${proseGlobs}`.nothrow().quiet().text()).trim()
  if (!tracked) {
    console.error(`humanize: no tracked prose files in ${cwd}`)
    return undefined
  }
  const picked = (
    await $`fzf --preview='head -200 ${cwd}/{}' --prompt='humanize > ' --height=100% --border < ${new Response(tracked)}`
      .nothrow()
      .text()
  ).trim()
  return picked || undefined
}

let prompt: string

if (mode === 'clipboard') {
  const text = (await $`pbpaste`.nothrow().quiet().text()).trim()
  if (!text) {
    console.error('humanize: clipboard is empty')
    process.exit(1)
  }
  prompt = [
    'Use the humanizer skill to rewrite the text below so it reads like a person wrote it.',
    'Keep every fact, invent nothing, and print the result — do not touch any file.',
    '',
    text,
  ].join('\n')
} else {
  const file = await pickFile()
  if (!file) process.exit(1)
  prompt = [
    `Use the humanizer skill to rewrite the prose in ${file}.`,
    'Keep every fact and invent nothing. Leave code, data, frontmatter and link targets alone.',
    'Edit the file in place, then show me the diff.',
  ].join('\n')
}

// herdr-plus hands the launching pane's id to the action's environment.
const target = process.env.HERDR_PLUS_PANE_ID

if (!target) {
  console.log(prompt)
  process.exit(0)
}

await $`herdr pane send-text ${target} ${prompt}`.nothrow()
await $`herdr pane send-keys ${target} shift+enter`.nothrow()
console.log(`humanize: sent the ${mode} request to the launching pane`)
