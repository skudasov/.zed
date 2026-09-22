#!/usr/bin/env bun
/**
 * diagram-new — a live diagram workbench in its own tab.
 *
 *   ┌───────────────────────────────┐
 *   │ the diagram                   │  three quarters, redrawn on every save
 *   ├───────────────────────────────┤
 *   │ nvim diagram.d2               │  LazyVim, saving itself as you type
 *   └───────────────────────────────┘
 *
 * A .d2 buffer writes itself — the autocmds in herdr/nvim/lua/config/ save it
 * when you leave insert mode and after four hundred milliseconds of not typing.
 * The preview watches the file, so the picture keeps up without a :w. Only .d2
 * buffers do this; the rest of your editing is untouched.
 *
 * The preview is timg on a d2 render — about two hundred milliseconds from save
 * to picture. `--browser` swaps it for d2's own watch server shown in
 * terminal-browser (github.com/zenbu-labs/terminal-browser), which costs a
 * whole Chromium but gives you panning, tooltips and links.
 *
 * Both files are made in the directory you launched from, so a diagram lands in
 * the repo you were looking at rather than somewhere central. Every launch
 * starts from scratch: this is a scratchpad, so last time's source and render
 * both go. Worth keeping means renaming it before the next launch.
 *
 * This is the human's way in; an agent draws with diagram.ts instead.
 * Install the binaries with `just install-diagrams`.
 */

import { $ } from "bun";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { createTab, listPanes, renamePane, runInPane, splitPane } from "./herdr.ts";

const TAB = "diagram";
const SOURCE = "diagram.d2";
const OUTPUT = "diagram.svg";
const PREVIEW = join(process.env.HOME!, ".config", "herdr", "bin", "diagram.ts");
/** Where d2's watch server listens under --browser. Taken? The next free port wins. */
const PORT = 65109;
/** Dark Mauve — d2's dark theme, to match the terminal it is being drawn in. */
const THEME = 200;
/** What the preview keeps when the editor is split off below it. */
const EDITOR_SHARE = 0.75;

/**
 * What a fresh workbench starts with. Architecture, state machines and the
 * rest are all plain nodes and edges, so there is nothing to choose between
 * them — only a sequence diagram needs a line at the top, and it is here
 * commented out for the times you want one.
 */
const STARTER = `direction: right
# shape: sequence_diagram

# Type. The buffer saves itself, and the pane above redraws.
user: User { shape: person }
api: API
db: Store { shape: cylinder }

user -> api: request
api -> db: query
`;

const fail = (message: string): never => {
  console.error(`diagram-new: ${message}`);
  process.exit(1);
};

const browser = process.argv.includes("--browser");
const [dirArg] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));

const focused = (await listPanes()).find((pane) => pane.focused) ?? fail("no focused pane to take a directory from");
// The directory you are looking at, not the repo root: a scratch diagram
// belongs where you are, and the quick action hands us the same thing.
const dir = dirArg || focused.foreground_cwd || focused.cwd;

for (const binary of ["d2", "timg", "nvim", ...(browser ? ["terminal-browser", "curl"] : [])]) {
  const found = await $`command -v ${binary}`.quiet().nothrow();
  if (found.exitCode !== 0) fail(`${binary} is not on PATH — see \`just install-diagrams\``);
}

const source = join(dir, SOURCE);
const output = join(dir, OUTPUT);

// A fresh start every launch. Opening the workbench means drawing something
// new, so last time's source and its render both go; anything worth keeping
// gets renamed before the next launch, not after.
await rm(source, { force: true });
await rm(output, { force: true });
await Bun.write(source, STARTER);

/** The first port from PORT up that nothing is listening on. */
async function freePort(): Promise<number> {
  for (let port = PORT; port < PORT + 20; port++) {
    try {
      Bun.listen({ hostname: "127.0.0.1", port, socket: { data() {} } }).stop(true);
      return port;
    } catch {
      continue;
    }
  }
  return fail(`no free port in ${PORT}..${PORT + 20}`);
}

/**
 * d2's watch server, shown in a browser that lives in the pane. The server is a
 * background job of that pane, so closing the pane takes it down; `--browser 0`
 * stops d2 opening a real browser over the one we are about to put there, and
 * the wait loop is because the server needs a moment to bind. The terminal
 * browser gets every chrome-stripping flag it has: each toolbar, overlay and
 * border is pixels it would otherwise encode into the terminal on every frame.
 */
async function browserPreview(): Promise<{ command: string; note: string }> {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}/`;
  const chrome = "--app-mode --app-name=diagram --no-toolbar --no-shortcuts --no-context-menu --no-overlays --no-frame";
  return {
    command:
      `d2 --watch --host 127.0.0.1 --port ${port} --browser 0 --theme ${THEME} ${SOURCE} ${OUTPUT} >/dev/null 2>&1 &` +
      ` until curl -sf -o /dev/null ${url}; do sleep 0.2; done;` +
      ` terminal-browser open ${chrome} ${url}; kill %1 2>/dev/null`,
    note: `watching on ${url}`,
  };
}

const preview = browser
  ? await browserPreview()
  : // timg on diagram.svg, rewritten from the source on every save. Those two
    // files are the whole workbench — nothing is cached anywhere else.
    { command: `${PREVIEW} --watch ${SOURCE}`, note: `${output} redrawn on save` };

const tab = await createTab(focused.workspace_id, TAB, dir, true);
await renamePane(tab.paneId, "preview");
await runInPane(tab.paneId, preview.command);

// The editor keeps a quarter; the diagram is the thing being looked at, and a
// d2 source is short lines. herdr's ratio is the share the split pane keeps.
const editor = await splitPane(tab.paneId, "down", dir, EDITOR_SHARE, true);
await renamePane(editor, "source");
await runInPane(editor, `nvim ${SOURCE}`);

console.log(`diagram-new: ${source}, ${preview.note} (tab ${tab.tabId})`);
