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

export async function createTab(workspaceId: string, label: string, cwd: string, focus = false): Promise<NewTab> {
  const flag = focus ? "--focus" : "--no-focus";
  const made = await result($`herdr tab create --workspace ${workspaceId} --cwd ${cwd} --label ${label} ${flag}`);
  return { workspaceId, tabId: made.tab.tab_id, paneId: made.root_pane.pane_id };
}

export const renameTab = (tabId: string, label: string) => $`herdr tab rename ${tabId} ${label}`.quiet();

export const renamePane = (paneId: string, label: string) => $`herdr pane rename ${paneId} ${label}`.quiet();

/**
 * Splits a pane and hands back the new one. It does not take focus by default:
 * a split made for something to look at should not steal the cursor from
 * whatever you were typing into. Pass `focus` when the split is to be typed in.
 */
export async function splitPane(
  paneId: string,
  direction: "right" | "down",
  cwd: string,
  ratio = 0.5,
  focus = false,
): Promise<string> {
  const flag = focus ? "--focus" : "--no-focus";
  const made = await result(
    $`herdr pane split --pane ${paneId} --direction ${direction} --ratio ${ratio} --cwd ${cwd} ${flag}`,
  );
  return made.pane.pane_id;
}

export const closePane = (paneId: string) => $`herdr pane close ${paneId}`.quiet().nothrow();

/** One pane's place in its tab, in character cells. */
export interface PaneRect {
  pane_id: string;
  rect: { x: number; y: number; width: number; height: number };
}

/** The tab a pane lives in: its total size, and every pane's rectangle in it. */
export interface Layout {
  tab_id: string;
  area: { width: number; height: number };
  panes: PaneRect[];
}

export const paneLayout = async (paneId: string): Promise<Layout> =>
  (await result($`herdr pane layout --pane ${paneId}`)).layout;

/**
 * Moves the split edge. `amount` is a fraction of the whole tab, and the
 * direction is the way the edge travels: "up" grows the lower pane.
 */
export const resizePane = (paneId: string, direction: "up" | "down" | "left" | "right", amount: number) =>
  $`herdr pane resize --pane ${paneId} --direction ${direction} --amount ${amount}`.quiet().nothrow();

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

export interface Tab {
  tab_id: string;
  workspace_id: string;
  label: string;
  focused: boolean;
}

export const listTabs = async (workspaceId?: string): Promise<Tab[]> =>
  (await result(workspaceId ? $`herdr tab list --workspace ${workspaceId}` : $`herdr tab list`)).tabs;

export const focusTab = (tabId: string) => $`herdr tab focus ${tabId}`.quiet();
