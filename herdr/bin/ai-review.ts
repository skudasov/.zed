#!/usr/bin/env bun
/**
 * ai-review — open a fresh review agent in a "review:<repo>" workspace.
 *
 *   ai-review.ts diff [agent] [dir]   review this branch: merge-base(default)..HEAD
 *   ai-review.ts pr   [agent] [dir]   pick one of the repo's open PRs, review it
 *
 * agent defaults to claude; dir defaults to the focused pane's cwd, then cwd.
 */
import { $ } from 'bun'
import { basename } from 'node:path'
import {
  createTab,
  createWorkspace,
  findWorkspace,
  focusedDir,
  focusWorkspace,
  renameTab,
  runInPane,
  waitForIdleAgent,
} from './herdr.ts'
import type { NewTab } from './herdr.ts'
import { repoRoot, reviewBase } from './git.ts'

const INSTRUCTIONS = 'Review for correctness only. Do not read, grep, or review test files (*_test.go) or documentation (*.md). Report correctness bugs first, then simplifications. Do not edit any files. For any issues or bugs found also write down permalinks to GitHub.'

interface PullRequest {
  number: number
  title: string
  author: { login: string }
  headRefName: string
}

function exit(message: string): never {
  console.error(`ai-review: ${message}`)
  process.exit(1)
}

/** Find or create the repo's review workspace, and add one named tab to it. */
async function reviewTab(root: string, tabName: string): Promise<NewTab> {
  const label = `review:${basename(root)}`
  const existing = await findWorkspace(label)
  if (existing) return createTab(existing, tabName, root)

  // A new workspace arrives with a numbered tab; name it after the review.
  const created = await createWorkspace(label, root)
  await renameTab(created.tabId, tabName)
  return created
}

/** Hand the pane's agent its prompt, once it has finished booting. */
async function promptWhenReady(paneId: string, prompt: string): Promise<void> {
  if (!(await waitForIdleAgent(paneId))) await Bun.sleep(5_000)
  await runInPane(paneId, prompt)
}

// --- modes -------------------------------------------------------------------

async function reviewDiff(agent: string, dir: string): Promise<void> {
  const root = (await repoRoot(dir)) ?? exit(`not a git repo: ${dir}`)
  const base = (await reviewBase(root)) ?? exit('nothing to review')

  const { workspaceId, paneId } = await reviewTab(root, 'diff')
  await focusWorkspace(workspaceId)
  await runInPane(paneId, agent)
  await promptWhenReady(
    paneId,
    `Review the changes on this branch. Start by running: git diff ${base}...HEAD. ${INSTRUCTIONS}`,
  )
  console.log(`ai-review: reviewing ${base}...HEAD in review:${basename(root)} (${paneId})`)
}

async function reviewPullRequest(agent: string, dir: string): Promise<void> {
  const root = (await repoRoot(dir)) ?? exit(`not a git repo: ${dir}`)

  const { workspaceId, tabId, paneId } = await reviewTab(root, 'pr')
  await focusWorkspace(workspaceId)
  // The fzf picker needs a tty, so it runs in the pane we just made; from there
  // it renames the tab, starts the agent, and prompts it.
  await runInPane(paneId, `${import.meta.path} __pick ${agent} ${paneId} ${tabId} ${root}`)
  console.log(`ai-review: pick a PR in review:${basename(root)} (${paneId})`)
}

/** Runs inside the review pane, where there is a tty. */
async function pickAndReview(
  agent: string,
  paneId: string,
  tabId: string,
  root: string,
): Promise<void> {
  const pulls: PullRequest[] = await $`gh pr list --limit 50 --json number,title,author,headRefName`
    .cwd(root)
    .quiet()
    .json()
  if (pulls.length === 0) exit('no open PRs')

  const tab = '\t'
  const rows = pulls.map((pr) => [pr.number, pr.title, pr.author.login, pr.headRefName].join(tab))
  // fzf paints its UI on /dev/tty and writes the chosen row to stdout.
  const choice =
    await $`fzf --delimiter=${tab} --with-nth=1,2,3 --prompt=${'review PR > '} --height=100% --border < ${new Response(rows.join('\n'))}`
      .nothrow()
      .text()

  const pr = pulls.find((candidate) => candidate.number === Number(choice.split('\t')[0]))
  if (!pr) exit('no PR selected')

  // The tab carries the PR number and title, so the sidebar says what is under
  // review — the same name whichever agent is running it.
  await renameTab(tabId, `#${pr.number} ${pr.title}`.slice(0, 48))

  // This process owns the pane, so the agent has to replace it rather than be
  // typed at: sending "claude" here would land in our own stdin. The prompt is
  // armed first and delivered while the agent boots.
  const prompt = promptWhenReady(
    paneId,
    `Review pull request #${pr.number} of this repo. Start by running: gh pr diff ${pr.number}. ${INSTRUCTIONS}`,
  )
  // Bun's $ pipes stdio; an agent TUI needs the pane's real tty, so spawn it raw.
  const running = Bun.spawn([agent], { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' })
  await Promise.all([running.exited, prompt])
}

const [mode = 'diff', ...rest] = process.argv.slice(2)

if (mode === '__pick') {
  const [agent, paneId, tabId, root] = rest as [string, string, string, string]
  await pickAndReview(agent, paneId, tabId, root)
} else {
  const [agent = 'claude', dirArg] = rest
  const dir = dirArg ?? (await focusedDir()) ?? process.cwd()
  if (mode === 'diff') {
    await reviewDiff(agent, dir)
  } else if (mode === 'pr') {
    await reviewPullRequest(agent, dir)
  } else {
    exit(`unknown mode: ${mode} (want diff or pr)`)
  }
}
