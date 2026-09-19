#!/usr/bin/env bun
/**
 * zoe — open (or focus) a zoetrope tab for the repo you launched from.
 *
 * zoetrope (github.com/furkankly/zoetrope, binary `zoe`) draws the Claude Code
 * or Codex session of a project as a live flow graph: agents, subagents and
 * their tool calls. Pointed at the repo root, it follows whichever session is
 * running there — so the agent works in one tab and you watch it in this one.
 *
 * The tab is reused: one "zoe" tab per workspace. If zoetrope was quit in it,
 * the tab is a plain shell and focusing it just puts you back at the prompt.
 *
 * Install zoetrope with `just install-zoetrope`.
 */

import { createTab, focusTab, listPanes, listTabs, runInPane } from "./herdr.ts";
import { repoRoot } from "./git.ts";

const TAB = "zoe";

const dirArg = process.argv[2];
const focused = (await listPanes()).find((pane) => pane.focused);
if (!focused) {
  console.error("zoe: no focused pane to take a workspace from");
  process.exit(1);
}

const dir = dirArg ?? focused.foreground_cwd ?? focused.cwd;
// zoe resolves a directory to that project's session, so the repo root keeps
// every tab of the workspace pointing at the same session.
const root = (await repoRoot(dir)) ?? dir;

const existing = (await listTabs(focused.workspace_id)).find((tab) => tab.label === TAB);
if (existing) {
  await focusTab(existing.tab_id);
  console.log(`zoe: focused existing tab (${existing.tab_id})`);
  process.exit(0);
}

const tab = await createTab(focused.workspace_id, TAB, root, true);
await runInPane(tab.paneId, `zoe '${root}'`);
console.log(`zoe: opened tab ${tab.tabId} at ${root}`);
