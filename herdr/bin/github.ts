import { $ } from 'bun'
import { homedir } from 'node:os'

/**
 * The PR inbox: open PRs grouped by how they involve me, with CI check counts,
 * fetched in a single GraphQL call.
 */

export type Group = 'review' | 'team' | 'mine' | 'involved' | 'other'

export interface CheckCounts {
  pass: number
  fail: number
  pending: number
}

export interface PullRequest {
  group: Group
  number: number
  title: string
  url: string
  repo: string
  author: string
  isDraft: boolean
  reviewDecision: string | null
  mergeable: string
  updatedAt: string
  checks: CheckCounts
  failedChecks: string[]
}

export interface Inbox {
  pulls: PullRequest[]
  /** Some results were withheld because the gh token lacks SSO for their org. */
  samlBlocked: boolean
}

/** ~/.config/herdr/review.toml — which repos the inbox watches. */
export interface ReviewConfig {
  repos: string[]
  orgs: string[]
  showOthers: boolean
  limit: number
  cloneRoots: string[]
}

const expandHome = (path: string) => path.replace(/^~(?=\/|$)/, homedir())

export const DEFAULT_CONFIG: ReviewConfig = {
  repos: [],
  orgs: [],
  showOthers: true,
  limit: 30,
  cloneRoots: [expandHome('~/Projects')],
}

/** Undefined when the file is missing, so the caller can say so. */
export async function loadReviewConfig(
  path = process.env.REVIEW_CONFIG ?? `${homedir()}/.config/herdr/review.toml`,
): Promise<ReviewConfig | undefined> {
  const file = Bun.file(path)
  if (!(await file.exists())) return undefined
  const raw = Bun.TOML.parse(await file.text()) as Record<string, any>
  return {
    repos: raw.repos ?? DEFAULT_CONFIG.repos,
    orgs: raw.orgs ?? DEFAULT_CONFIG.orgs,
    showOthers: raw.show_others ?? DEFAULT_CONFIG.showOthers,
    limit: raw.limit ?? DEFAULT_CONFIG.limit,
    cloneRoots: raw.clone_roots?.map(expandHome) ?? DEFAULT_CONFIG.cloneRoots,
  }
}

/** Most urgent first; a PR lands in the first group whose search finds it. */
const GROUPS: [Group, string][] = [
  ['review', 'user-review-requested:@me'],
  ['team', 'review-requested:@me'],
  ['mine', 'author:@me'],
  ['involved', 'involves:@me'],
  ['other', ''],
]

const BASE = 'is:pr is:open archived:false sort:updated-desc'
// GitHub rejects longer search queries, so long repo lists are split up.
const MAX_QUERY = 256

// Check run and status context states, folded into three buckets.
const PASS = new Set(['SUCCESS', 'NEUTRAL', 'SKIPPED', 'COMPLETED'])
const FAIL = new Set(['FAILURE', 'ERROR', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED', 'STARTUP_FAILURE'])

const FRAGMENT = `fragment pr on PullRequest {
  number title url isDraft reviewDecision mergeable updatedAt
  repository { nameWithOwner }
  author { login }
  commits(last: 1) { nodes { commit { statusCheckRollup { contexts(first: 100) {
    checkRunCountsByState { state count }
    statusContextCountsByState { state count }
    nodes { ... on CheckRun { name conclusion } ... on StatusContext { context state } }
  } } } } }
}`

/** Packs scope qualifiers (repo:x, org:y) into as few queries as fit the budget. */
function chunk(scope: string[], budget: number): string[] {
  if (scope.length === 0) return ['']
  const chunks: string[] = []
  let current = ''
  for (const qualifier of scope) {
    const next = current ? `${current} ${qualifier}` : qualifier
    if (current && next.length > budget) {
      chunks.push(current)
      current = qualifier
    } else {
      current = next
    }
  }
  chunks.push(current)
  return chunks
}

function toPullRequest(group: Group, node: any): PullRequest {
  const contexts = node.commits?.nodes?.[0]?.commit?.statusCheckRollup?.contexts
  const checks: CheckCounts = { pass: 0, fail: 0, pending: 0 }
  const counts = [...(contexts?.checkRunCountsByState ?? []), ...(contexts?.statusContextCountsByState ?? [])]
  for (const { state, count } of counts) {
    checks[PASS.has(state) ? 'pass' : FAIL.has(state) ? 'fail' : 'pending'] += count
  }

  return {
    group,
    number: node.number,
    title: node.title,
    url: node.url,
    repo: node.repository.nameWithOwner,
    author: node.author?.login ?? 'ghost',
    isDraft: node.isDraft,
    reviewDecision: node.reviewDecision,
    mergeable: node.mergeable,
    updatedAt: node.updatedAt,
    checks,
    failedChecks: (contexts?.nodes ?? [])
      .filter((check: any) => FAIL.has(check.conclusion ?? check.state))
      .map((check: any) => check.name ?? check.context),
  }
}

/**
 * Open PRs within `scope` (search qualifiers such as `repo:owner/name`; empty
 * means all of GitHub), grouped and ordered by GROUPS, newest first within a group.
 */
export async function fetchInbox(scope: string[], { showOthers = true, limit = 30 } = {}): Promise<Inbox> {
  const longestGroup = Math.max(...GROUPS.map(([, qualifier]) => qualifier.length))
  const chunks = chunk(scope, MAX_QUERY - BASE.length - longestGroup - 2)
  // "other" is everything else in scope — unscoped, that would be all of GitHub.
  const groups = GROUPS.filter(([group]) => group !== 'other' || (showOthers && scope.length > 0))

  const searches = groups.flatMap(([group, qualifier], g) =>
    chunks.map((scoped, c) => ({
      group,
      alias: `g${g}_${c}`,
      query: [BASE, qualifier, scoped].filter(Boolean).join(' '),
    })),
  )
  const first = Math.min(limit, 100)
  const query = `{
${searches.map((s) => `${s.alias}: search(query: ${JSON.stringify(s.query)}, type: ISSUE, first: ${first}) { nodes { ...pr } }`).join('\n')}
}
${FRAGMENT}`

  // gh exits non-zero when any node errors (e.g. SAML), yet still prints the rest.
  const out = await $`gh api graphql -f query=${query}`.quiet().nothrow()
  const body = JSON.parse(out.stdout.toString() || '{}')
  if (!body.data) throw new Error(`gh api graphql failed: ${out.stderr.toString().trim() || JSON.stringify(body)}`)

  const seen = new Set<string>()
  const pulls: PullRequest[] = []
  for (const search of searches) {
    for (const node of body.data[search.alias]?.nodes ?? []) {
      if (!node?.url || seen.has(node.url)) continue
      seen.add(node.url)
      pulls.push(toPullRequest(search.group, node))
    }
  }

  const rank = (pr: PullRequest) => groups.findIndex(([group]) => group === pr.group)
  pulls.sort((a, b) => rank(a) - rank(b) || b.updatedAt.localeCompare(a.updatedAt))

  const samlBlocked = (body.errors ?? []).some((error: any) => error.extensions?.saml_failure)
  return { pulls, samlBlocked }
}
