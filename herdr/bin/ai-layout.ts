#!/usr/bin/env bun
/**
 * ai-layout — create (or focus) an agent workspace for a repo: two tabs.
 *
 *   plan   long-lived: architecture, decisions, no code edits
 *   impl   disposable: does the edits, restarted often
 */

import { basename } from "node:path";
import { createTab, createWorkspace, findWorkspace, focusedDir, focusWorkspace, renameTab, runInPane } from "./herdr.ts";
import { repoRoot } from "./git.ts";

const [agent = "claude", dirArg] = process.argv.slice(2);
const tabNames = (process.env.AI_LAYOUT_TABS ?? "plan impl").split(/\s+/).filter(Boolean);

const dir = dirArg ?? (await focusedDir()) ?? process.cwd();
// Prefer the repo root so every tab starts at the same place.
const root = (await repoRoot(dir)) ?? dir;
const label = `${basename(agent)}:${basename(root)}`;

const existing = await findWorkspace(label);
if (existing) {
  await focusWorkspace(existing);
  console.log(`ai-layout: focused existing workspace ${label} (${existing})`);
  process.exit(0);
}

// A new workspace already comes with one tab, so the first name renames that
// one and the rest are created.
const workspace = await createWorkspace(label, root);
await renameTab(workspace.tabId, tabNames[0]!);

for (const [index, name] of tabNames.entries()) {
  const { paneId } = index === 0 ? workspace : await createTab(workspace.workspaceId, name, root);
  await runInPane(paneId, agent);
}

await focusWorkspace(workspace.workspaceId);
console.log(`ai-layout: created ${label} (${workspace.workspaceId}) at ${root}`);
