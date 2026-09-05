import { $, type ShellPromise } from "bun";

/**
 * The bits of the herdr CLI these scripts use.
 *
 * Every herdr subcommand answers with `{ id, result }`; commands that only act
 * (rename, focus, run) answer with nothing at all.
 */

export interface Pane {
  pane_id: string;
  tab_id: string;
  workspace_id: string;
  cwd: string;
  foreground_cwd?: string;
  focused: boolean;
  agent_status: "idle" | "working" | "blocked" | "done" | "unknown";
}

/** A freshly made workspace or tab: the ids you need to fill it. */
export interface NewTab {
  workspaceId: string;
  tabId: string;
  paneId: string;
}

/** Runs a herdr command and hands back its `result` — quiet, so no JSON on screen. */
const result = async (cmd: ShellPromise): Promise<any> => (await cmd.quiet().json()).result;

export const listPanes = async (): Promise<Pane[]> => (await result($`herdr pane list`)).panes;

/** The directory the focused pane is sitting in — the repo you launched from. */
export async function focusedDir(): Promise<string | undefined> {
  const focused = (await listPanes()).find((pane) => pane.focused);
  return focused?.foreground_cwd ?? focused?.cwd;
}

export async function findWorkspace(label: string): Promise<string | undefined> {
  const { workspaces } = await result($`herdr workspace list`);
  return workspaces.find((ws: { label: string }) => ws.label === label)?.workspace_id;
}

export async function createWorkspace(label: string, cwd: string): Promise<NewTab> {
  const made = await result($`herdr workspace create --cwd ${cwd} --label ${label} --no-focus`);
  return { workspaceId: made.workspace.workspace_id, tabId: made.tab.tab_id, paneId: made.root_pane.pane_id };
}

export async function createTab(workspaceId: string, label: string, cwd: string): Promise<NewTab> {
  const made = await result($`herdr tab create --workspace ${workspaceId} --cwd ${cwd} --label ${label} --no-focus`);
  return { workspaceId, tabId: made.tab.tab_id, paneId: made.root_pane.pane_id };
}

export const renameTab = (tabId: string, label: string) => $`herdr tab rename ${tabId} ${label}`.quiet();

export const focusWorkspace = (workspaceId: string) => $`herdr workspace focus ${workspaceId}`.quiet();

/** Types the text into the pane and presses Enter — a shell command, or an agent prompt. */
export const runInPane = (paneId: string, text: string) => $`herdr pane run ${paneId} ${text}`.quiet();

/**
 * Waits for herdr to see an idle agent in the pane. False on timeout, or if no
 * agent was ever detected: callers fall back to a plain delay, since a prompt
 * sent slightly early beats no prompt at all.
 */
export async function waitForIdleAgent(paneId: string, timeoutMs = 60_000): Promise<boolean> {
  const wait = await $`herdr agent wait ${paneId} --status idle --timeout ${timeoutMs}`.quiet().nothrow();
  return wait.exitCode === 0;
}
