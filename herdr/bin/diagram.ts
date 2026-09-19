#!/usr/bin/env bun
/**
 * diagram — render a diagram and show it, as a real image, in a split below
 * the pane you (or an agent) called from.
 *
 * An agent cannot draw a picture into your terminal: its own stdout is captured
 * by the harness, so the graphics escape codes never reach Ghostty. herdr can.
 * This script compiles the source, then has herdr run timg in a sibling pane —
 * the terminal draws it, the agent only asks for it. Ghostty speaks the kitty
 * graphics protocol, so it is a real image at full resolution, not block art.
 *
 *   diagram.ts                 newest renderable file under the repo root
 *   diagram.ts arch.d2         compile with d2, then show
 *   diagram.ts out.svg         show directly (timg decodes svg/png/jpg/gif/pdf)
 *   diagram.ts arch.d2 --ascii print an ASCII diagram to stdout, no split
 *   diagram.ts --close         close the split
 *
 * The split is reused: one diagram pane per tab, re-rendered in place, so an
 * agent iterating on a .d2 file just calls this again after each edit and the
 * picture beside it updates. Focus never moves — you keep typing where you were.
 *
 * Install d2 and timg with `just install-diagrams`.
 */

import { $ } from "bun";
import { mkdir } from "node:fs/promises";
import { basename, extname, isAbsolute, join, resolve } from "node:path";
import { closePane, listPanes, renamePane, runInPane, splitPane } from "./herdr.ts";
import { repoRoot } from "./git.ts";

const PANE_LABEL = "diagram";
const CACHE = join(process.env.HOME!, ".cache", "herdr-diagrams");
/** Which pane holds the render, per tab. Pane labels are not in `pane list`. */
const STATE = join(CACHE, "panes.json");
/** Dark Mauve — d2's dark theme, so the render sits on Ghostty's dark background. */
const THEME = 200;
/** Ghostty's background, so a transparent PNG composites against it and not black. */
const BACKGROUND = "#303135";
/** What timg can decode on its own: GraphicsMagick, librsvg and poppler. */
const IMAGES = new Set([".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf", ".bmp", ".tiff"]);

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const [sourceArg] = args.filter((arg) => !arg.startsWith("--"));

const fail = (message: string): never => {
  console.error(`diagram: ${message}`);
  process.exit(1);
};

const panes = await listPanes();
const focused = panes.find((pane) => pane.focused) ?? fail("no focused pane to split");

const dir = focused.foreground_cwd ?? focused.cwd;
const root = (await repoRoot(dir)) ?? dir;

/** tab_id -> pane_id of the diagram split in that tab. */
type State = Record<string, string>;
const readState = async (): Promise<State> => ((await Bun.file(STATE).exists()) ? Bun.file(STATE).json() : {});

/**
 * The remembered split, if it is still open. Panes close without telling us, so
 * the state file is a hint to be checked and never a fact to be trusted.
 */
async function existingPane(): Promise<string | undefined> {
  const remembered = (await readState())[focused.tab_id];
  return panes.some((pane) => pane.pane_id === remembered) ? remembered : undefined;
}

async function rememberPane(paneId: string | undefined): Promise<void> {
  // Drop tabs whose pane is gone while we are here: closing a tab never tells
  // us, so without this the file only ever grows.
  const live = new Set(panes.map((pane) => pane.pane_id));
  const state = Object.fromEntries(Object.entries(await readState()).filter(([, id]) => live.has(id)));
  if (paneId) state[focused.tab_id] = paneId;
  else delete state[focused.tab_id];
  await mkdir(CACHE, { recursive: true });
  await Bun.write(STATE, JSON.stringify(state, null, 2));
}

if (flag("close")) {
  const pane = await existingPane();
  if (!pane) fail("no diagram split open in this tab");
  await closePane(pane!);
  await rememberPane(undefined);
  console.log(`diagram: closed split ${pane}`);
  process.exit(0);
}

/**
 * With no source, take the most recently modified diagram in the repo — the one
 * the agent just wrote. Tracked and untracked both, but nothing ignored: the
 * cache lives under ~/.cache, yet a repo may well render into its own build
 * directory, and picking that back up would render a render.
 */
async function newestSource(): Promise<string | undefined> {
  // Same two places a relative path is looked for, for the same reason.
  const roots = [...new Set([(await repoRoot(process.cwd())) ?? process.cwd(), root])];
  const found: { path: string; at: number }[] = [];
  for (const base of roots) {
    const listed = await $`git -C ${base} ls-files --cached --others --exclude-standard`.quiet().nothrow();
    const names =
      listed.exitCode === 0
        ? listed.text().split("\n")
        : // Not a repo: the caller's own directory is still worth a look.
          [...new Bun.Glob("*").scanSync(base)];
    const candidates = names
      .filter((path) => path.endsWith(".d2") || IMAGES.has(extname(path).toLowerCase()))
      .map((path) => join(base, path));
    for (const path of candidates) {
      found.push({ path, at: (await Bun.file(path).stat().catch(() => null))?.mtimeMs ?? 0 });
    }
  }
  return found.sort((a, b) => b.at - a.at)[0]?.path;
}

/**
 * A relative path means one of two different things: an agent calling this from
 * a shell means it relative to its own cwd, while the keybind runs detached and
 * only the focused pane says where you are. Try both, in that order.
 */
async function locate(path: string): Promise<string> {
  if (isAbsolute(path)) return path;
  for (const base of [process.cwd(), dir]) {
    const candidate = resolve(base, path);
    if (await Bun.file(candidate).exists()) return candidate;
  }
  return fail(`no such file: ${path} (looked in ${process.cwd()} and ${dir})`);
}

const source = sourceArg
  ? await locate(sourceArg)
  : ((await newestSource()) ?? fail(`no .d2 or image file under ${root}`));
const kind = extname(source).toLowerCase();

/**
 * d2 renders ASCII too, and that output is plain text — the one form an agent
 * can read back itself, so it doubles as the check that a diagram compiled.
 */
if (flag("ascii")) {
  if (kind !== ".d2") fail(`--ascii needs a .d2 source, got ${kind || "no extension"}`);
  // --stdout-format is what picks ascii; without it `-` writes SVG to stdout.
  await $`d2 --ascii-mode extended --stdout-format ascii ${source} -`.nothrow();
  process.exit(0);
}

/** Compile to PNG under the cache; images pass straight through to timg. */
async function render(): Promise<string> {
  if (IMAGES.has(kind)) return source;
  if (kind !== ".d2") fail(`don't know how to render ${kind || "a file with no extension"}`);
  await mkdir(CACHE, { recursive: true });
  // Named after the source path, so re-rendering overwrites rather than piles
  // up, and two same-named files in different repos keep separate renders.
  const out = join(CACHE, `${Bun.hash(source).toString(16)}.png`);
  const built = await $`d2 --theme ${THEME} --pad 40 ${source} ${out}`.quiet().nothrow();
  if (built.exitCode !== 0) fail(`d2 failed:\n${built.stderr.toString().trim()}`);
  return out;
}

const image = await render();
const show = `clear; timg -p kitty -C -b '${BACKGROUND}' --title ${JSON.stringify(image)}`;

const reused = await existingPane();
// A vertical split, stacking the picture under the work. Diagrams come out
// wider than they are tall, so full width is the dimension worth keeping.
const pane = reused ?? (await splitPane(focused.pane_id, "down", root));
if (!reused) {
  await renamePane(pane, PANE_LABEL);
  await rememberPane(pane);
}
await runInPane(pane, show);
console.log(`diagram: ${reused ? "re-rendered" : "rendered"} ${basename(source)} in split ${pane}`);
