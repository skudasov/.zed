import { $ } from "bun";

/** Read-only git helpers. Each takes the directory to run in. */

const git = async (dir: string, ...args: string[]): Promise<string | undefined> => {
  const out = await $`git -C ${dir} ${args}`.quiet().nothrow();
  return out.exitCode === 0 ? out.text().trim() || undefined : undefined;
};

/** The repo containing `dir`, or undefined when `dir` is not in a git repo. */
export const repoRoot = (dir: string) => git(dir, "rev-parse", "--show-toplevel");

/** `owner/repo` of the origin remote, when it lives on GitHub. */
export async function originRepo(dir: string): Promise<string | undefined> {
  const url = await git(dir, "remote", "get-url", "origin");
  return url?.match(/github\.com[:/](.+?)(?:\.git)?\/?$/)?.[1];
}

/**
 * The files this branch added or changed, relative to the repo root.
 * Deletions are filtered out: a scanner handed a path that is gone just errors.
 */
export async function changedFiles(root: string, base: string): Promise<string[]> {
  const out = await git(root, "diff", "--name-only", "--diff-filter=ACMR", `${base}...HEAD`);
  return out ? out.split("\n") : [];
}

/**
 * Where this branch left the default branch — the base of everything you wrote.
 * On the default branch itself there is no such point, so review the last commit.
 */
export async function reviewBase(root: string): Promise<string | undefined> {
  const base = await mergeBaseWithDefaultBranch(root);
  const isBranchPoint = base && base !== (await git(root, "rev-parse", "HEAD"));
  return git(root, "rev-parse", "--short", isBranchPoint ? base : "HEAD~1");
}

/**
 * `origin/HEAD` is the honest answer for the default branch, but it only exists
 * if the clone set it, so fall back to the usual names.
 */
async function mergeBaseWithDefaultBranch(root: string): Promise<string | undefined> {
  const symbolic = await git(root, "symbolic-ref", "--quiet", "refs/remotes/origin/HEAD");
  const candidates = symbolic
    ? [symbolic.replace(/^refs\/remotes\//, "")]
    : ["origin/main", "origin/master", "main", "master"];

  for (const ref of candidates) {
    const base = await git(root, "merge-base", "HEAD", ref);
    if (base) return base;
  }
}
