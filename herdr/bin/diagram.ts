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
 *   diagram.ts arch.d2 --watch redraw in THIS pane on every save, into arch.svg
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
import {
  closePane,
  listPanes,
  paneLayout,
  renamePane,
  resizePane,
  runInPane,
  splitPane,
  type Pane,
} from "./herdr.ts";
import { repoRoot } from "./git.ts";

const PANE_LABEL = "diagram";
const CACHE = join(process.env.HOME!, ".cache", "herdr-diagrams");
/** Which pane holds the render, per tab. Pane labels are not in `pane list`. */
const STATE = join(CACHE, "panes.json");
/** Dark Mauve, the base the gruvbox overrides below are applied on top of. */
const THEME = 200;
/** Breathing room around the diagram, in pixels. */
const PAD = 20;
/** The canvas colour, for timg to composite any transparency against. */
const BACKGROUND = "#282828";
/**
 * herdr is themed gruvbox, so its diagrams are too. d2 has no theme file, only
 * eighteen named slots, and this maps them onto the palette:
 *
 *   N1..N7  text through to canvas      B1  shape borders and every connection
 *   B2..B6  emphasis, then fills        AA/AB  the accents d2 gives stores,
 *                                              queues and clouds
 *
 * B1 is the neutral yellow rather than the bright one on purpose: it draws both
 * the borders and the arrows, so on a graph of any size the bright one stops
 * being an accent and becomes the whole picture.
 *
 * It is appended to the source rather than written into it — the file you edit
 * stays a plain diagram, and a d2 error still points at the right line, because
 * everything added comes after the last line of yours.
 */
const GRUVBOX = `
vars: {
  d2-config: {
    theme-overrides: {
      N1: "#fbf1c7"; N2: "#ebdbb2"; N3: "#d5c4a1"; N4: "#a89984"
      N5: "#665c54"; N6: "#3c3836"; N7: "#282828"
      B1: "#d79921"; B2: "#fabd2f"; B3: "#83a598"
      B4: "#458588"; B5: "#504945"; B6: "#3c3836"
      AA2: "#fe8019"; AA4: "#af3a03"; AA5: "#504945"
      AB4: "#b8bb26"; AB5: "#689d6a"
    }
  }
}
`;

/** Does the source set this key for itself in `vars.d2-config`? */
const sets = (text: string, key: string) => new RegExp(`^\\s*${key}\\s*:`, "m").test(text);

/**
 * A source and the flags it did not already decide for itself. d2's command
 * line beats `vars.d2-config`, so a key the diagram pins has to be left off
 * the command line — `layout-engine: elk` in a source is a decision about that
 * diagram, not a default to improve on.
 *
 * A text match, not a parse: d2-config is the only place these keys mean
 * anything, and a shape called `pad` costs a flag rather than a wrong render.
 */
function compile(text: string): { input: Blob; flags: string[] } {
  const colours = sets(text, "theme-id") || sets(text, "theme-overrides");
  return {
    // The palette is appended rather than written in, so the file you edit
    // stays a plain diagram and d2's errors still point at the right line.
    input: new Blob([text, colours ? "" : GRUVBOX]),
    flags: [
      ...(sets(text, "layout-engine") ? [] : ["--layout", ENGINE]),
      ...(sets(text, "theme-id") ? [] : ["--theme", String(THEME)]),
      ...(sets(text, "pad") ? [] : ["--pad", String(PAD)]),
    ],
  };
}

/** d2 calls the diagram `-` when it reads stdin; the file has a name, so use it. */
const nameErrors = (stderr: string) => stderr.replaceAll("-:", `${basename(source)}:`).trim();
/** The most of the tab the diagram may take. */
const MAX_SHARE = 0.75;
/** Never so short that a diagram is pointless, even if it would fit. */
const MIN_ROWS = 10;
/** Rows left to whatever else shares the tab when --watch sizes its own pane. */
const MIN_NEIGHBOUR_ROWS = 8;
/** Resize only when the pane is wrong by more than this; a row either way is not worth a redraw. */
const RESIZE_SLACK = 2;
/** A terminal cell is about twice as tall as it is wide — JetBrains Mono, here. */
const CELL_ASPECT = 2;
/** One row of the split goes to timg's filename title. */
const TITLE_ROWS = 1;
/** How often --watch looks at the source. Cheap: one stat, no subprocess. */
const POLL_MS = 250;
/**
 * The layout engine, unless the source pins its own. tala is d2's native one
 * and routes edges best on the graphs that get drawn here; dagre and elk are
 * the alternatives, set with `layout-engine` in the diagram itself.
 *
 * This used to be a contest between all three, judged on which filled the pane
 * — worth it back when the pane was a fixed box. The pane is now sized to the
 * diagram, so the shape of the render no longer costs anything.
 */
const ENGINE = "tala";
/** What timg can decode on its own: GraphicsMagick, librsvg and poppler. */
const IMAGES = new Set([".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf", ".bmp", ".tiff"]);

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const [sourceArg] = args.filter((arg) => !arg.startsWith("--"));

const fail = (message: string): never => {
  console.error(`diagram: ${message}`);
  process.exit(1);
};

/**
 * herdr is only consulted when a pane has to be found or made. --watch already
 * runs inside the pane it draws in, and --ascii draws nowhere, so neither pays
 * for the round trip — or fails when there is no herdr to ask.
 */
let panesCache: Pane[] | undefined;
const allPanes = async () => (panesCache ??= await listPanes());
const focusedPane = async () => (await allPanes()).find((pane) => pane.focused) ?? fail("no focused pane to split");

/** Where relative paths are resolved from, and where the newest source is looked for. */
const dir = flag("watch") || flag("ascii") ? process.cwd() : (await focusedPane()).foreground_cwd ?? (await focusedPane()).cwd;

/** tab_id -> pane_id of the diagram split in that tab. */
type State = Record<string, string>;
const readState = async (): Promise<State> => ((await Bun.file(STATE).exists()) ? Bun.file(STATE).json() : {});

/**
 * The remembered split, if it is still open. Panes close without telling us, so
 * the state file is a hint to be checked and never a fact to be trusted.
 */
async function existingPane(): Promise<string | undefined> {
  const remembered = (await readState())[(await focusedPane()).tab_id];
  return (await allPanes()).some((pane) => pane.pane_id === remembered) ? remembered : undefined;
}

async function rememberPane(paneId: string | undefined): Promise<void> {
  // Drop tabs whose pane is gone while we are here: closing a tab never tells
  // us, so without this the file only ever grows.
  const live = new Set((await allPanes()).map((pane) => pane.pane_id));
  const state = Object.fromEntries(Object.entries(await readState()).filter(([, id]) => live.has(id)));
  const tab = (await focusedPane()).tab_id;
  if (paneId) state[tab] = paneId;
  else delete state[tab];
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
  const roots = [...new Set([(await repoRoot(process.cwd())) ?? process.cwd(), (await repoRoot(dir)) ?? dir])];
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
  : ((await newestSource()) ?? fail(`no .d2 or image file under ${dir}`));
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

/** A PNG's pixel size, straight out of the IHDR header. Undefined for anything else. */
async function pngSize(path: string): Promise<{ width: number; height: number } | undefined> {
  const header = new DataView(await Bun.file(path).slice(0, 24).arrayBuffer());
  if (header.byteLength < 24 || header.getUint32(0) !== 0x89504e47) return undefined;
  return { width: header.getUint32(16), height: header.getUint32(20) };
}

/**
 * How many cells an image of this aspect covers when scaled to fit a pane of
 * `cols` by `rows`. This is the thing worth maximizing: the diagram is only as
 * big as the screen it actually covers, and an image whose shape does not match
 * its pane leaves the rest blank whatever else is done to it.
 */
function coverage(aspect: number, cols: number, rows: number) {
  const scale = Math.min(cols / aspect, rows * CELL_ASPECT);
  return { cells: (aspect * scale * scale) / CELL_ASPECT, rows: Math.ceil(scale / CELL_ASPECT) };
}

/**
 * Compile to PNG under the cache; images pass straight through to timg.
 */
async function render(): Promise<string> {
  if (IMAGES.has(kind)) return source;
  if (kind !== ".d2") fail(`don't know how to render ${kind || "a file with no extension"}`);
  await mkdir(CACHE, { recursive: true });
  // Named after the source path, so re-rendering overwrites rather than piles
  // up, and two same-named files in different repos keep separate renders.
  const out = `${join(CACHE, Bun.hash(source).toString(16))}.png`;
  const { input, flags } = compile(await Bun.file(source).text());
  const built = await $`d2 ${flags} - ${out} < ${input}`.quiet().nothrow();
  if (built.exitCode !== 0) throw new Error(nameErrors(built.stderr.toString()) || "d2 failed");
  return out;
}

/**
 * -W scales to the pane's full width and lets the height do what it likes,
 * which is what makes a diagram fill the terminal instead of sitting in the
 * middle of it: without it timg fits inside width *and* height, so a diagram
 * even slightly taller than its pane is scaled down until both fit and the
 * sides go blank. It is only safe once the pane is as tall as the image at
 * full width — both callers below size the pane first, and both fall back to
 * fitting inside the box when the pane could not be made tall enough.
 */
const timg = (image: string, fitWidth: boolean, extra: string[] = []) =>
  `clear; timg -p kitty -C -U ${fitWidth ? "-W " : ""}-b '${BACKGROUND}' ${extra.join(" ")} --title ${JSON.stringify(image)}`;

/** The rows a diagram of this aspect wants when drawn at full width, title included. */
const wantedRows = (aspect: number, cols: number, ceiling: number) =>
  Math.min(ceiling, Math.max(MIN_ROWS, coverage(aspect, cols, ceiling - TITLE_ROWS).rows + TITLE_ROWS));

/**
 * Give a pane exactly the rows its diagram needs at full width. The picture is
 * the thing being looked at, but it is not the only thing in the tab, so
 * whatever shares it keeps MIN_NEIGHBOUR_ROWS and the diagram takes at most
 * MAX_SHARE. Answers whether the pane ended up tall enough for -W.
 */
async function fitPane(paneId: string, aspect: number, cols: number): Promise<boolean> {
  const layout = await paneLayout(paneId).catch(() => undefined);
  const rect = layout?.panes.find((pane) => pane.pane_id === paneId)?.rect;
  if (!layout || !rect) return false;
  const tabRows = layout.area.height;
  const shared = tabRows - rect.height;
  const ceiling = shared === 0 ? tabRows : Math.min(Math.floor(tabRows * MAX_SHARE), tabRows - MIN_NEIGHBOUR_ROWS);
  const wanted = wantedRows(aspect, cols, ceiling);
  // Which way the split edge travels to make *this* pane bigger: down when the
  // pane is the top one, up when something sits above it.
  const grow = rect.y === 0 ? "down" : "up";
  const shrink = grow === "down" ? "up" : "down";
  const delta = wanted - rect.height;
  if (Math.abs(delta) >= RESIZE_SLACK) {
    await resizePane(paneId, delta > 0 ? grow : shrink, Math.abs(delta) / tabRows);
  }
  // Clamped short of what the diagram wanted — fit it inside the box instead,
  // or -W would push the bottom of it off the pane.
  return wanted >= wantedRows(aspect, cols, Number.MAX_SAFE_INTEGER);
}

/**
 * The same render as render(), but to an .svg beside the source. Nothing else
 * is written: the workbench is two files, the diagram and its picture. The
 * aspect comes back with it, because the pane is then sized to match.
 */
async function renderBeside(): Promise<{ out: string; aspect: number }> {
  const out = source.replace(/\.d2$/, ".svg");
  const { input, flags } = compile(await Bun.file(source).text());
  const built = await $`d2 ${flags} --stdout-format svg - - < ${input}`.quiet().nothrow();
  // d2 sizes the root <svg> with a viewBox rather than width and height.
  const box = built.stdout.toString().match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  if (!box) throw new Error(nameErrors(built.stderr.toString()) || "d2 failed");
  await Bun.write(out, built.stdout);
  return { out, aspect: Number(box[1]) / Number(box[2]) };
}

/**
 * --watch draws in the pane it was started in, and redraws on every save. It is
 * the cheap half of the workbench: a d2 render and a timg draw are together
 * about two hundred milliseconds, where a browser on d2's own watch server pays
 * for a whole Chromium. The tradeoff is that a picture is all you get — no
 * panning, no tooltips, no links.
 */
if (flag("watch")) {
  if (kind !== ".d2") fail(`--watch needs a .d2 source, got ${kind || "no extension"}`);
  const mtime = async () => (await Bun.file(source).stat().catch(() => null))?.mtimeMs ?? 0;
  // herdr sets this in every pane it runs. Without it the pane cannot resize
  // itself, and the diagram just fits inside whatever box it was given.
  const selfPane = process.env.HERDR_PANE_ID;
  let last = -1;
  let redraw = true;
  // A resized pane needs the layout picked again, not just the image rescaled.
  process.stdout.on("resize", () => (redraw = true));

  for (;;) {
    const now = await mtime();
    if (now !== last || redraw) {
      last = now;
      redraw = false;
      const cols = process.stdout.columns ?? 80;
      console.clear();
      // Deleted rather than changed: say so and stop drawing. Leaving the last
      // picture up would be a drawing of a file that is not there any more.
      if (!(await Bun.file(source).exists())) {
        console.error(`waiting for ${basename(source)} — it is not there`);
      } else {
        try {
          const { out, aspect } = await renderBeside();
          const fitWidth = selfPane ? await fitPane(selfPane, aspect, cols) : false;
          await $`sh -c ${timg(out, fitWidth)}`.nothrow();
        } catch (error) {
          console.error(`${basename(source)} does not compile:\n\n${error instanceof Error ? error.message : error}`);
        }
      }
    }
    await Bun.sleep(POLL_MS);
  }
}

const focused = await focusedPane();
const layout = await paneLayout(focused.pane_id);
const { width: cols, height: tabRows } = layout.area;
const maxRows = Math.max(MIN_ROWS, Math.floor(tabRows * MAX_SHARE) - TITLE_ROWS);

const image = await render().catch((error) => fail(`d2 failed:\n${error.message}`));

/**
 * The split is exactly as tall as the image drawn at full width, capped at
 * three quarters of the tab. Taller than that and the extra rows are blank —
 * the image is already as wide as the tab, so nothing makes it grow further.
 */
const size = await pngSize(image);
const aspect = size ? size.width / size.height : undefined;
const wanted = aspect ? wantedRows(aspect, cols, maxRows + TITLE_ROWS) : maxRows + TITLE_ROWS;
// The cap bit: a diagram too tall for three quarters of the tab is drawn to
// fit inside the split instead, since -W would run it off the bottom.
const fitWidth = aspect !== undefined && wanted >= wantedRows(aspect, cols, Number.MAX_SAFE_INTEGER);
// -U upscales: d2 renders a small diagram small, and a pane given most of the
// screen should be filled by it rather than show it postage-stamp sized.
const show = timg(image, fitWidth);

const reused = await existingPane();
// A vertical split, stacking the picture under the work. Diagrams come out
// wider than they are tall, so full width is the dimension worth keeping.
const pane = reused ?? (await splitPane(focused.pane_id, "down", (await repoRoot(dir)) ?? dir, 1 - wanted / tabRows));
if (reused) {
  // Each diagram wants its own height, so an existing split gets moved to it.
  const current = layout.panes.find((candidate) => candidate.pane_id === pane)?.rect.height;
  const delta = current === undefined ? 0 : (wanted - current) / tabRows;
  if (Math.abs(delta) > 0.01) await resizePane(pane, delta > 0 ? "up" : "down", Math.abs(delta));
} else {
  await renamePane(pane, PANE_LABEL);
  await rememberPane(pane);
}
await runInPane(pane, show);
console.log(
  `diagram: ${reused ? "re-rendered" : "rendered"} ${basename(source)} in split ${pane} (${wanted}/${tabRows} rows)`,
);
