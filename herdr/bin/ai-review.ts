#!/usr/bin/env bun
/**
 * ai-review — open a fresh review agent in a "review:<repo>" workspace.
 *
 *   ai-review.ts diff  [agent] [dir]   review this branch: merge-base(default)..HEAD
 *   ai-review.ts inbox [agent] [dir]   pick a PR from the repos in review.toml, review it
 *
 * PRs are grouped — review asked of me, of my team, mine, involving me, the
 * rest — and show draft, CI and conflict status. After the PR comes a prompt
 * template from ~/.config/herdr/review-prompts/. Both pickers are fzf, so run
 * this where there is a tty, like the quick-actions overlay.
 *
 * agent defaults to claude; dir defaults to the focused pane's cwd, then cwd.
 */
import { $ } from 'bun'
import { mkdir, readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
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
import { originRepo, repoRoot, reviewBase } from './git.ts'
import { DEFAULT_CONFIG, fetchInbox, loadReviewConfig } from './github.ts'
import type { Group, PullRequest, ReviewConfig } from './github.ts'

const INSTRUCTIONS = 'Review for correctness only. Do not read, grep, or review test files (*_test.go) or documentation (*.md). Report correctness bugs first, then simplifications. Do not edit any files. For any issues or bugs found also write down permalinks to GitHub.'

const PROMPTS_DIR = process.env.REVIEW_PROMPTS_DIR ?? join(homedir(), '.config/herdr/review-prompts')
// Used when the prompts dir is empty or missing.
const FALLBACK_PROMPT = `Review pull request {{ref}}. Start by running: gh pr diff {{number}} -R {{repo}}. ${INSTRUCTIONS}`

const TAB = '\t'

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

/** fzf paints its UI on /dev/tty and prints the chosen line; empty when cancelled. */
const fzf = async (lines: string[], ...args: string[]): Promise<string> =>
  (await $`fzf ${args} < ${new Response(lines.join('\n'))}`.nothrow().text()).trim()

// --- PR picker ---------------------------------------------------------------

const paint = (code: number, text: string) => (code ? `\x1b[${code}m${text}\x1b[0m` : text)

const GROUP_LABELS: Record<Group, [string, number]> = {
  review: ['REVIEW', 31],
  team: ['TEAM', 35],
  mine: ['MINE', 34],
  involved: ['INVOLVED', 36],
  other: ['OTHER', 2],
}

const DECISIONS: Record<string, [string, number]> = {
  APPROVED: ['APPROVED', 32],
  CHANGES_REQUESTED: ['CHANGES', 31],
  REVIEW_REQUIRED: ['REVIEW', 33],
}

function age(iso: string): string {
  const minutes = (Date.now() - Date.parse(iso)) / 60_000
  for (const [unit, size] of [['w', 10_080], ['d', 1_440], ['h', 60]] as const) {
    if (minutes >= size) return `${Math.floor(minutes / size)}${unit}`
  }
  return `${Math.max(1, Math.floor(minutes))}m`
}

/** One aligned, colored picker row. Cells are padded before painting. */
function row(pr: PullRequest, refWidth: number, authorWidth: number): string {
  const [group, groupColor] = GROUP_LABELS[pr.group]
  const { pass, fail, pending } = pr.checks
  const checks =
    pass + fail + pending === 0
      ? '–'
      : [`✓${pass}`, fail && `✗${fail}`, pending && `●${pending}`].filter(Boolean).join(' ')
  const [decision, decisionColor] = DECISIONS[pr.reviewDecision ?? ''] ?? ['', 0]

  return [
    paint(groupColor, group.padEnd(8)),
    `${pr.repo}#${pr.number}`.padEnd(refWidth),
    paint(2, (pr.isDraft ? 'DRAFT' : '').padEnd(5)),
    paint(fail ? 31 : pending ? 33 : 32, checks.padEnd(12)),
    paint(decisionColor, decision.padEnd(8)),
    paint(31, (pr.mergeable === 'CONFLICTING' ? 'CONFLICT' : '').padEnd(8)),
    age(pr.updatedAt).padStart(4),
    paint(36, pr.author.padEnd(authorWidth)),
    pr.title.replaceAll(TAB, ' '),
  ].join(' ')
}

async function pickPullRequest(pulls: PullRequest[], notes: string[]): Promise<PullRequest | undefined> {
  const refWidth = Math.max(...pulls.map((pr) => `${pr.repo}#${pr.number}`.length))
  const authorWidth = Math.max(...pulls.map((pr) => pr.author.length))
  // Hidden columns: index (to find the PR again) and url (for the preview).
  const lines = pulls.map((pr, index) => [index, pr.url, row(pr, refWidth, authorWidth)].join(TAB))
  const header = [
    'REVIEW asked of me · TEAM asked of my team · MINE · INVOLVED · OTHER   ✓ pass ✗ fail ● pending',
    ...notes,
  ].join('\n')
  const gh = 'GH_PAGER=cat GH_FORCE_TTY=$FZF_PREVIEW_COLUMNS gh'

  const choice = await fzf(
    lines,
    '--ansi',
    `--delimiter=${TAB}`,
    '--with-nth=3',
    '--no-sort',
    '--prompt=review PR > ',
    `--header=${header}`,
    '--height=100%',
    '--border',
    `--preview=${gh} pr view {2}; echo; ${gh} pr checks {2}`,
    '--preview-window=down,55%,wrap',
  )
  return choice ? pulls[Number(choice.split(TAB)[0])] : undefined
}

// --- prompt templates --------------------------------------------------------

/** The chosen template's text; the fallback when there are none, undefined when cancelled. */
async function pickPrompt(): Promise<string | undefined> {
  const names = (await readdir(PROMPTS_DIR).catch(() => [] as string[])).filter((name) => name.endsWith('.md'))
  if (names.length === 0) return FALLBACK_PROMPT

  // default.md leads, so Enter straight away picks it.
  names.sort((a, b) => Number(b === 'default.md') - Number(a === 'default.md') || a.localeCompare(b))
  const paths = names.map((name) => join(PROMPTS_DIR, name))
  const picked =
    paths.length === 1
      ? paths[0]
      : await fzf(paths, '--delimiter=/', '--with-nth=-1', '--prompt=prompt > ', '--preview=cat {}', '--height=100%', '--border')
  return picked ? Bun.file(picked).text() : undefined
}

function renderPrompt(template: string, pr: PullRequest): string {
  const vars: Record<string, string> = {
    ref: `${pr.repo}#${pr.number}`,
    number: String(pr.number),
    repo: pr.repo,
    title: pr.title,
    url: pr.url,
    draft: pr.isDraft ? 'yes' : 'no',
    failedChecks: pr.failedChecks.join(', ') || 'none',
  }
  // herdr pane run types the text and presses Enter, so a newline would submit early.
  return template
    .replace(/\{\{(\w+)\}\}/g, (placeholder, key) => vars[key] ?? placeholder)
    .replace(/\s*\n\s*/g, ' ')
    .trim()
}

// --- launching ---------------------------------------------------------------

/** A local clone of the repo if there is one, else a scratch dir — the diff comes from gh either way. */
async function reviewDir(repo: string, launchDir: string, cloneRoots: string[]): Promise<string> {
  const name = repo.split('/')[1]!
  for (const dir of [launchDir, ...cloneRoots.map((root) => join(root, name))]) {
    const root = await repoRoot(dir)
    if (root && (await originRepo(root))?.toLowerCase() === repo.toLowerCase()) return root
  }
  const scratch = join(homedir(), '.herdr/reviews', repo)
  await mkdir(scratch, { recursive: true })
  return scratch
}

async function pickAndReview(
  agent: string,
  dir: string,
  scope: string[],
  config: ReviewConfig,
  notes: string[] = [],
): Promise<void> {
  const inbox = await fetchInbox(scope, config).catch((error: Error) => exit(error.message))
  if (inbox.samlBlocked) {
    notes.push('Some PRs hidden by SAML SSO: authorize the gh token for that org at github.com/settings/tokens')
  }
  if (inbox.pulls.length === 0) exit(['no open PRs', ...notes].join('\n  '))

  const pr = (await pickPullRequest(inbox.pulls, notes)) ?? exit('no PR selected')
  const template = (await pickPrompt()) ?? exit('no prompt selected')
  const cwd = await reviewDir(pr.repo, dir, config.cloneRoots)

  // The tab carries the PR number and title, so the sidebar says what is under
  // review — the same name whichever agent is running it.
  const { workspaceId, paneId } = await reviewTab(cwd, `#${pr.number} ${pr.title}`.slice(0, 48))
  await focusWorkspace(workspaceId)
  await runInPane(paneId, agent)
  await promptWhenReady(paneId, renderPrompt(template, pr))
  console.log(`ai-review: reviewing ${pr.repo}#${pr.number} in review:${basename(cwd)} (${paneId})`)
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

async function reviewInbox(agent: string, dir: string): Promise<void> {
  const loaded = await loadReviewConfig()
  const config = loaded ?? DEFAULT_CONFIG
  const scope = [...config.repos.map((repo) => `repo:${repo}`), ...config.orgs.map((org) => `org:${org}`)]
  const notes = loaded ? [] : ['No ~/.config/herdr/review.toml: showing all of GitHub']
  if (loaded && scope.length === 0) notes.push('review.toml lists no repos or orgs: showing all of GitHub')
  await pickAndReview(agent, dir, scope, config, notes)
}

const [mode = 'diff', agent = 'claude', dirArg] = process.argv.slice(2)
const dir = dirArg ?? (await focusedDir()) ?? process.cwd()

if (mode === 'diff') {
  await reviewDiff(agent, dir)
} else if (mode === 'inbox') {
  await reviewInbox(agent, dir)
} else {
  exit(`unknown mode: ${mode} (want diff or inbox)`)
}
