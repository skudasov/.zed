// Review uncommitted changes side by side (HEAD left, working tree right),
// annotate line ranges, send the notes to the agent in this tab.
// keys.json: "cmd-2": "mod.open:zed-changes".
//   Files: j/k file · Enter into its diff
//   Diff:  j/k line · ctrl-d/u half page · h/l side · v comment the line
//          V start/end a selection (then comment) · Esc back to files
// Notes persist per checkout + branch in ~/.local/share/zed-changes/.
//   Enter save the comment · Shift+Enter send all notes
import { View, div } from "gpui-kit";
import {
  v_flex,
  h_flex,
  InputState,
  Input,
  Scrollbar,
  v_virtual_list,
  VirtualListScrollHandle,
} from "gpui-base";
import {
  spaces,
  panes,
  focused,
  agents,
  exec,
  hc,
  home,
  notify,
  readTextFile,
  writeTextFile,
  watchFolder,
  theme,
  settings,
  props,
  closeOverlay,
  layout,
} from "herdr";
import { splitRows } from "./split.js";

// Opened from the PRs mod: props().pr = { root, base, title } diffs the PR's
// merge base against that checkout instead of HEAD against the focused pane's.
const pr = () => props()?.pr ?? null;
function location() {
  if (pr()) return { cwd: pr().root, on: null };
  const space = spaces().find((s) => s.active),
    f = focused();
  const pane = f?.pane ? panes().find((p) => p.pane === f.pane) : null;
  const on =
    f?.pane === null
      ? f.terminal?.includes("/")
        ? f.terminal.split("/")[0]
        : null
      : (space?.machine ?? null);
  return { cwd: pane?.cwd || f?.cwd || space?.folder, on };
}
const key = () => JSON.stringify(location());
// Reads write nothing under .git (no index refresh or lock, no fsmonitor cookie):
// the folder watch would see it, and every refresh would start the next one.
const READ = [
  "--no-optional-locks",
  "-c",
  "core.fsmonitor=false",
  "-c",
  "diff.autoRefreshIndex=false",
];
const countLines = (text) =>
  text ? text.split("\n").length - Number(text.endsWith("\n")) : 0;
const ROW = 20;
// Long lines wrap: hard-split into chunks of `cols` monospace columns, so each
// row's height is known up front for the virtual list.
// ponytail: CHAR is an estimate of the 11px mono advance; bump it if text clips.
const CHAR = 6.7;
const chunks = (cell, cols) => {
  const text = (cell?.text ?? "").replaceAll("\t", "    ") || " ";
  const out = [];
  for (let i = 0; i < text.length; i += cols) out.push(text.slice(i, i + cols));
  return out;
};
// Translucent tints of the theme's own colors, Zed style, so the diff sits on
// the #303135 background and follows the theme: green/red rows with a
// stronger gutter, blue cursor and selection. Backgrounds only: a border
// would shift the text.
const tint = (color, alpha) => color.slice(0, 7) + alpha;
const palette = (t) => ({
  add: { row: tint(t.ansi2, "24"), gutter: tint(t.ansi2, "55"), num: t.ansi2 },
  del: { row: tint(t.ansi1, "26"), gutter: tint(t.ansi1, "55"), num: t.ansi1 },
  pad: tint(t.raised, "55"),
  cursor: tint(t.ansi4, "33"),
  pick: { row: tint(t.ansi4, "4d"), at: tint(t.ansi4, "80") },
  note: { bg: tint(t.ansi4, "1a"), bar: t.ansi4 },
});
const NOTE_H = 26; // saved comment card under its lines
const STORE = () => `${home()}/.local/share/zed-changes`;
// ponytail: fixed half page; measure the list height if it feels off.
const HALF = 15;

// Where the layout's terminal area (block "main") sits: the px sizes of the
// visible blocks beside it, per side, so the panel covers exactly that area.
// No "main" (another layout): zero insets, the whole window.
// ponytail: px-sized siblings only; a weighted sibling next to main is ignored.
function insets() {
  const out = { left: 0, top: 0, right: 0, bottom: 0 },
    gap = layout()?.divider?.width ?? 0;
  const walk = (node) => {
    if (node.id === "main") return true;
    const kids = node.children ?? [];
    const i = kids.findIndex((c) => !c.hidden && walk(c));
    if (i < 0) return false;
    const [a, b] = node.type === "row" ? ["left", "right"] : ["top", "bottom"];
    kids.forEach((s, j) => {
      if (j !== i && !s.hidden && s.size?.px) out[j < i ? a : b] += s.size.px + gap;
    });
    return true;
  };
  walk(layout() ?? {});
  return out;
}

// The agent in the tab under this dialog: the focused one, else the latest.
function target() {
  const tab = focused()?.tab;
  const here = agents().filter((a) => a.tab === tab);
  return (
    here.find((a) => a.focused) ?? here.sort((a, b) => b.seq - a.seq)[0] ?? null
  );
}

function format(root, notes) {
  const out = [
    pr()
      ? `Review comments on PR "${pr().title}" checked out in ${root} (old = merge base ${pr().base}, new = working tree):`
      : `Review comments on uncommitted changes in ${root} (old = HEAD, new = working tree):`,
  ];
  for (const n of notes) {
    const at = n.from === n.to ? n.from : `${n.from}-${n.to}`;
    out.push(
      "",
      `${n.path}:${at} (${n.side}):`,
      "```",
      ...n.code,
      "```",
      n.comment,
    );
  }
  return out.join("\n");
}

export default class Changes extends View {
  init(_props, cx) {
    this.files = [];
    this.rows = [];
    this.notes = [];
    this.cursor = { row: 0, side: "r" };
    this.cols = 80; // per side, from the diff area's width
    this.anchor = null; // {row, side} while selecting
    this.sel = null; // {side, from, to} rows, waiting for a comment
    this.handle = cx.focus_handle();
    this.scroll = VirtualListScrollHandle.new();
    this.fileScroll = VirtualListScrollHandle.new();
    this.base = pr()?.base ?? "HEAD";
    this.input = InputState.new({ placeholder: "Comment · Enter save · Esc cancel" });
    this.input.on("submit", (_e, cx) => this.save(cx));
    this.input.on("focus", (_e, cx) => {
      this.typing = true;
      cx.notify();
    });
    this.input.on("blur", (_e, cx) => {
      this.typing = false;
      cx.notify();
    });
    this.refresh(cx);
    cx.timer.every(10000, (cx) => this.refresh(cx));
    // A window overlay does not take the keyboard by itself.
    this.handle.focus();
    cx.timer.after(50, () => this.handle.focus());
  }

  // j/k: next/previous changed file, wrapping.
  step(by, cx) {
    if (!this.files.length) return;
    const i = this.files.findIndex((f) => f.path === this.open);
    const next =
      i < 0
        ? by > 0
          ? 0
          : this.files.length - 1
        : (i + by + this.files.length) % this.files.length;
    this.pick(this.files[next].path, cx);
  }

  watch(root, cx) {
    if (this.on || this.watched === root) return;
    this.watched = root;
    cx.spawn(async (cx) => {
      try {
        while (this.watched === root) {
          await watchFolder(root);
          if (this.watched === root) this.refresh(cx);
        }
      } catch {
        this.watched = null;
      }
    });
  }

  refresh(cx) {
    if (this.loading || this.sending) return;
    const { cwd, on } = location(),
      context = key();
    if (context !== this.context) {
      this.context = context;
      this.store = null;
      this.root = null;
      this.files = [];
      this.open = null;
      this.setLines([]);
      this.error = null;
      this.note = null;
      this.watched = null;
      this.limited = false;
    }
    if (!cwd) return;
    this.loading = true;
    cx.spawn(async (cx) => {
      try {
        const top = await exec("git", ["rev-parse", "--show-toplevel"], {
          cwd,
          on,
        });
        if (key() !== context) return;
        if (top.code !== 0) {
          this.root = null;
          this.files = [];
          this.setLines([]);
          this.open = null;
          this.error = "Not a git repository";
          return;
        }
        const root = top.stdout.trim(),
          git = (args) => exec("git", [...READ, ...args], { cwd: root, on });
        // PR: the files changed since the merge base, as "XY path" like status.
        const status = await git(
          this.base === "HEAD"
            ? ["status", "--porcelain=v1", "-z", "--no-renames", "--untracked-files=all"]
            : ["diff", this.base, "--name-status", "-z", "--no-renames"],
        );
        if (status.code !== 0) throw new Error(status.stderr);
        let entries = status.stdout.split("\0").filter(Boolean);
        if (this.base !== "HEAD")
          entries = entries.flatMap((x, i) => (i % 2 ? [] : [`${x.padEnd(2)} ${entries[i + 1]}`]));
        const head = await git(["rev-parse", "--verify", this.base]);
        const branch = (await git(["branch", "--show-current"])).stdout.trim() || "detached";
        // Notes live per checkout and branch: ~/.local/share/zed-changes/<root>@<branch>.json
        const store = `${STORE()}/${root.replaceAll("/", "_")}@${branch.replaceAll("/", "_")}.json`;
        if (store !== this.store) {
          const text = await readTextFile(store).catch(() => null);
          if (key() !== context) return;
          this.store = store;
          this.branch = branch;
          this.disk = text;
          try {
            this.notes = text ? JSON.parse(text) : [];
          } catch {
            this.notes = [];
          }
        }
        const stats = {};
        const results =
          head.code === 0
            ? [await git(["diff", this.base, "--numstat", "-z", "--no-renames"])]
            : [
                await git(["diff", "--cached", "--numstat", "-z", "--no-renames"]),
                await git(["diff", "--numstat", "-z", "--no-renames"]),
              ];
        for (const result of results) {
          if (result.code !== 0) throw new Error(result.stderr);
          for (const entry of result.stdout.split("\0")) {
            const [a, d, ...parts] = entry.split("\t");
            if (!parts.length) continue;
            const path = parts.join("\t"),
              old = stats[path] ?? { add: 0, del: 0 };
            stats[path] = {
              add: old.add + (Number(a) || 0),
              del: old.del + (Number(d) || 0),
              binary: a === "-",
            };
          }
        }
        const files = [];
        for (const entry of entries.slice(0, 1000)) {
          const xy = entry.slice(0, 2),
            path = entry.slice(3),
            fresh = xy === "??";
          const conflict = xy.includes("U") || xy === "AA" || xy === "DD";
          const s = conflict
            ? "U"
            : xy.includes("D")
              ? "D"
              : fresh || xy.includes("A")
                ? "A"
                : "M";
          files.push({ path, status: s, fresh, ...(stats[path] ?? { add: 0, del: 0 }) });
        }
        if (key() !== context) return;
        this.root = root;
        this.on = on;
        this.hasHead = head.code === 0;
        this.files = files;
        this.limited = entries.length > 1000;
        this.error = null;
        this.watch(root, cx);
        if (this.open && !files.some((f) => f.path === this.open)) {
          this.open = null;
          this.setLines([]);
        }
        if (!this.open && files.length) this.open = files[0].path;
        // A selection in progress keeps its rows: don't reload under it.
        if (this.open && !this.anchor && !this.sel) {
          try {
            await this.load(this.open, context);
          } catch {
            if (key() === context)
              this.setLines(["Cannot preview this diff (too large or unreadable)"]);
          }
        }
      } catch (e) {
        if (key() === context) this.error = String(e);
      } finally {
        this.loading = false;
        cx.notify();
      }
    });
  }

  async load(path, context) {
    const file = this.files.find((f) => f.path === path),
      root = this.root,
      on = this.on;
    if (!file) return;
    let lines;
    if (file.fresh || (!this.hasHead && file.status === "A")) {
      const text = await readTextFile(`${root}/${path}`, { on }).catch(() => null);
      if (text === null)
        lines = ["Cannot preview this file (binary, too large, or unreadable)"];
      else if (text.includes("\0")) lines = ["Binary file · no text diff"];
      else {
        file.add = countLines(text);
        lines = [
          `@@ -0,0 +1,${file.add} @@`,
          ...text
            .slice(0, 400000)
            .replace(/\n$/, "")
            .split("\n")
            .slice(0, 3000)
            .map((l) => `+${l}`),
        ];
      }
    } else {
      const r = await exec(
        "git",
        [
          ...READ,
          "diff",
          ...(this.hasHead ? [this.base] : []),
          "--no-ext-diff",
          "--no-textconv",
          "--no-color",
          "--",
          path,
        ],
        { cwd: root, on },
      );
      if (r.code !== 0) throw new Error(r.stderr);
      const all = r.stdout.replace(/\n$/, "").split("\n"),
        first = all.findIndex((l) => l.startsWith("@@"));
      lines =
        first < 0
          ? [file.binary ? "Binary file changed" : "No text diff available"]
          : all.slice(first);
    }
    if (key() === context && this.open === path) this.setLines(lines.slice(0, 3000));
  }

  setLines(lines) {
    this.rows = splitRows(lines);
    this.cursor.row = Math.min(this.cursor.row, Math.max(0, this.rows.length - 1));
    // Never rest on a hunk header: nothing to select there.
    const i = this.rows.findIndex((r, i) => i >= this.cursor.row && !r.head);
    if (i >= 0) this.cursor.row = i;
    const r = this.rows[this.cursor.row];
    if (r && !r.head && !r[this.cursor.side]) this.cursor.side = r.l ? "l" : "r";
  }

  pick(path, cx) {
    if (this.open === path) return;
    this.open = path;
    this.fileScroll.scroll_to_item(Math.max(0, this.files.findIndex((f) => f.path === path)));
    this.setLines([]);
    this.cursor = { row: 0, side: "r" };
    this.cancel();
    this.note = null;
    const context = this.context;
    cx.spawn(async (cx) => {
      try {
        await this.load(path, context);
      } catch (e) {
        if (key() === context && this.open === path)
          this.note = `Cannot preview this diff: ${e}`;
      }
      cx.notify();
    });
    cx.notify();
  }

  // ↑/↓ by row (skipping hunk headers), ←/→ by side.
  move(by, side, cx) {
    if (side) this.cursor.side = side;
    const last = this.rows.length - 1;
    if (last < 0) return;
    let row = Math.max(0, Math.min(last, this.cursor.row + by));
    // Off a hunk header: keep going the same way, else back.
    const dir = by < 0 ? -1 : 1;
    while (this.rows[row]?.head && row + dir >= 0 && row + dir <= last) row += dir;
    while (this.rows[row]?.head && row - dir >= 0 && row - dir <= last) row -= dir;
    this.cursor.row = row;
    this.scroll.scroll_to_item(this.view?.at[row] ?? row, Math.abs(by) > 1 ? "center" : "top");
    cx.notify();
  }

  // v: comment on the cursor line, or end a selection in progress.
  comment(cx) {
    if (this.anchor) return this.mark(cx);
    this.mark(cx); // starts at the cursor, if that line can be selected
    if (this.anchor) this.mark(cx); // and ends there
  }

  // V / click: first press starts a selection at the cursor, the second ends it.
  mark(cx) {
    const { row, side } = this.cursor;
    if (this.sel || this.rows[row]?.head || !this.rows[row]?.[side]) return;
    if (!this.anchor) this.anchor = { row, side };
    else {
      const s = this.anchor.side;
      this.sel = {
        side: s,
        from: Math.min(this.anchor.row, row),
        to: Math.max(this.anchor.row, row),
      };
      this.anchor = null;
      this.input.set_value("");
      this.input.focus();
    }
    cx.notify();
  }

  // Rows lit by the selection in progress or the one awaiting a comment.
  lit(i, side) {
    const s =
      this.sel ??
      (this.anchor && {
        side: this.anchor.side,
        from: Math.min(this.anchor.row, this.cursor.row),
        to: Math.max(this.anchor.row, this.cursor.row),
      });
    return s && s.side === side && i >= s.from && i <= s.to;
  }

  cancel() {
    this.anchor = null;
    this.sel = null;
    this.input.set_value("");
  }

  save(cx) {
    const comment = this.input.value().trim();
    if (!this.sel || !comment) return false;
    const { side, from, to } = this.sel;
    const lines = this.rows
      .slice(from, to + 1)
      .map((r) => r[side])
      .filter(Boolean);
    if (lines.length)
      this.notes.push({
        path: this.open,
        side: side === "l" ? "old" : "new",
        from: lines[0].n,
        to: lines[lines.length - 1].n,
        code: lines.map((l) => l.text),
        comment,
      });
    this.persist(cx);
    this.cancel();
    this.handle.focus();
    cx.notify();
    return true;
  }

  // Write notes to this branch's file; writeTextFile refuses a stale
  // snapshot, so re-read and retry once if another copy wrote first.
  persist(cx) {
    const file = this.store,
      text = JSON.stringify(this.notes, null, 2) + "\n";
    if (!file) return;
    cx.spawn(async (cx) => {
      try {
        await exec("mkdir", ["-p", STORE()]);
        try {
          await writeTextFile(file, text, this.disk ?? null);
        } catch {
          await writeTextFile(file, text, await readTextFile(file).catch(() => null));
        }
        if (this.store === file) this.disk = text;
      } catch (e) {
        this.note = `Notes not saved: ${e.message ?? e}`;
        cx.notify();
      }
    });
  }

  send(cx) {
    if (this.sel) this.save(cx);
    if (!this.notes.length || this.sending) return;
    const agent = target();
    if (!agent) {
      this.note = "No agent in this tab; notes kept";
      cx.notify();
      return;
    }
    const notes = this.notes.slice();
    this.sending = true;
    this.note = `Sending ${notes.length} note(s) to ${agent.title || agent.address}…`;
    cx.spawn(async (cx) => {
      try {
        // No --if idle: a busy agent (Claude Code) queues what is typed.
        const r = await hc(["send", agent.address, format(this.root, notes)]);
        if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim() || `exit ${r.code}`);
        this.notes = this.notes.filter((n) => !notes.includes(n));
        this.persist(cx);
        this.note = `Sent ${notes.length} note(s) to ${agent.address}`;
        notify({ title: "Review sent", body: this.note, level: "info", timeout: 3000 });
      } catch (e) {
        this.note = `Not sent, notes kept: ${e.message ?? e}`;
        notify({ title: "Review not sent", body: this.note, level: "error" });
      } finally {
        this.sending = false;
        cx.notify();
      }
    });
    cx.notify();
  }

  onKey(e, cx) {
    const k = e.keystroke;
    const done = () => {
      cx.stop_propagation();
      cx.notify();
    };
    if (k === "shift-enter") return (this.send(cx), done());
    if (k === "escape" && (this.typing || this.anchor || this.sel)) {
      this.cancel();
      this.handle.focus();
      return done();
    }
    if (this.typing) return;
    // Files mode: j/k pick a file, Enter goes into its diff.
    // Diff mode: j/k lines, ctrl-d/u half page, v comment, V select, Esc back.
    const act = !this.inDiff
      ? {
          j: () => this.step(1, cx),
          k: () => this.step(-1, cx),
          down: () => this.step(1, cx),
          up: () => this.step(-1, cx),
          enter: () => {
            if (this.rows.length) this.inDiff = true;
            this.move(0, null, cx);
          },
        }[k]
      : {
          j: () => this.move(1, null, cx),
          k: () => this.move(-1, null, cx),
          down: () => this.move(1, null, cx),
          up: () => this.move(-1, null, cx),
          "ctrl-d": () => this.move(HALF, null, cx),
          "ctrl-u": () => this.move(-HALF, null, cx),
          left: () => this.move(0, "l", cx),
          right: () => this.move(0, "r", cx),
          h: () => this.move(0, "l", cx),
          l: () => this.move(0, "r", cx),
          v: () => this.comment(cx),
          "shift-v": () => this.mark(cx),
          escape: () => (this.inDiff = false),
        }[k];
    // Esc steps back one level: input → selection → diff → files → close.
    if (!act && k === "escape") return (closeOverlay(props().overlay), done());
    if (act) {
      act();
      done();
    }
  }

  half(i, row, side, t, h) {
    const cell = row[side],
      at = this.inDiff && this.cursor.row === i && this.cursor.side === side;
    const lit =
        this.lit(i, side) ||
        (cell && this.view?.notes.some((n) => n.s === side && cell.n >= n.from && cell.n <= n.to)),
      c = palette(t),
      tone = cell?.kind === "-" ? c.del : cell?.kind === "+" ? c.add : null;
    const bg = lit ? (at ? c.pick.at : c.pick.row) : at ? c.cursor : !cell ? c.pad : tone?.row;
    // No handlers here: the list renderer forbids them (see on_item_click).
    return h_flex()
      .flex_1()
      .min_w(0)
      .h(h)
      .gap(8)
      .when(Boolean(bg), (e) => e.bg(bg))
      .child(
        div()
          .w(40)
          .h_full()
          .pr(4)
          .flex_none()
          .text_right()
          .when(Boolean(tone) && !lit && !at, (e) => e.bg(tone.gutter))
          .text_color(tone && !lit ? tone.num : t.dim)
          .child(cell ? String(cell.n) : ""),
      )
      .child(
        v_flex()
          .flex_1()
          .min_w(0)
          .children(cell ? chunks(cell, this.cols).map((c) => div().h(ROW).whitespace_nowrap().child(c)) : []),
      );
  }

  // No handlers here: the list renderer forbids them (see on_item_click).
  fileRow(f, t) {
    const parts = f.path.split("/"),
      name = parts.pop(),
      noted = this.notes.filter((n) => n.path === f.path).length;
    return h_flex()
      .h(28)
      .flex_none()
      .px(8)
      .gap(8)
      .items_center()
      .rounded(7)
      .when(this.open === f.path, (e) => e.bg(t.selected))
      .when(this.open === f.path && !this.inDiff, (e) => e.border_1().border_color(t.accent))
      .child(
        div()
          .w(14)
          .text_size(11)
          .text_color(f.status === "A" ? t.ansi2 : f.status === "M" ? t.blocked : t.ansi1)
          .child(f.status),
      )
      .child(
        h_flex()
          .flex_1()
          .min_w(0)
          .child(div().text_color(t.dim).truncate().child(parts.length ? parts.join("/") + "/" : ""))
          .child(div().max_w(260).min_w(0).truncate().child(name)),
      )
      .when(noted > 0, (e) => e.child(div().text_size(11).text_color(t.accent).child(`✎${noted}`)))
      .when(f.add > 0, (e) => e.child(div().text_size(11).text_color(t.ansi2).child(`+${f.add}`)))
      .when(f.del > 0, (e) => e.child(div().text_size(11).text_color(t.ansi1).child(`−${f.del}`)));
  }

  diffRow(i, t, h) {
    const row = this.rows[i];
    if (row.head)
      return div()
        .w_full()
        .px(12)
        .h(ROW)
        .flex_none()
        .truncate()
        .bg(t.raised)
        .text_color(t.dim)
        .child(row.head);
    return h_flex()
      .w_full()
      .h(h)
      .flex_none()
      .child(this.half(i, row, "l", t, h))
      .child(div().w(1).h_full().bg(t.border))
      .child(this.half(i, row, "r", t, h));
  }

  // Diff rows with each saved note's card after its last line, and where each
  // row landed (for scrolling). Notes whose lines moved away just don't show.
  buildView() {
    const notes = this.notes
      .filter((n) => n.path === this.open)
      .map((n) => ({ ...n, s: n.side === "old" ? "l" : "r" }));
    const after = new Map();
    for (const n of notes) {
      const i = this.rows.findIndex((r) => r[n.s]?.n === n.to);
      if (i >= 0) after.set(i, [...(after.get(i) ?? []), n]);
    }
    const view = [],
      at = [];
    this.rows.forEach((r, i) => {
      at[i] = view.length;
      const lines = r.head ? 1 : Math.max(chunks(r.l, this.cols).length, chunks(r.r, this.cols).length);
      view.push({ i, h: ROW * lines });
      for (const note of after.get(i) ?? []) view.push({ note });
    });
    return { view, at, notes };
  }

  noteRow(n, t) {
    const card = h_flex()
      .flex_1()
      .min_w(0)
      .h(NOTE_H)
      .px(10)
      .gap(8)
      .items_center()
      .bg(palette(t).note.bg)
      .border_l(3)
      .border_color(palette(t).note.bar)
      .text_color(t.foreground)
      .child(div().text_color(palette(t).note.bar).child("✎"))
      .child(div().flex_1().min_w(0).truncate().child(n.comment));
    const empty = () => div().flex_1().min_w(0).h(NOTE_H);
    return h_flex()
      .w_full()
      .h(NOTE_H)
      .flex_none()
      .child(n.s === "l" ? card : empty())
      .child(div().w(1).h_full().bg(t.border))
      .child(n.s === "r" ? card : empty());
  }

  render(cx) {
    if (key() !== this.context) this.refresh(cx);
    this.view = this.buildView();
    const view = this.view.view;
    const t = theme(),
      add = this.files.reduce((n, f) => n + f.add, 0),
      del = this.files.reduce((n, f) => n + f.del, 0);
    const hint = this.sel
      ? `Comment on ${this.sel.to - this.sel.from + 1} row(s) · Enter save · Esc cancel`
      : this.anchor
        ? "Selecting… V ends"
        : this.inDiff
          ? "j/k ^d/^u · h/l side · v comment · V select · Esc files · ⇧Enter send"
          : "j/k file · Enter diff · ⇧Enter send";
    const panel = v_flex()
      .id("changes")
      .size_full()
      .min_h(0)
      .overflow_hidden()
      .bg(t.background)
      .border_1()
      .border_color(t.border)
      .text_color(t.foreground)
      .text_size(13)
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.onKey(e, cx))
      // Presses inside the panel neither drag the window nor close it.
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .child(
        h_flex()
          .h(42)
          .flex_none()
          .px(14)
          .gap(8)
          .items_center()
          .border_b(1)
          .border_color(t.border)
          .child(div().font_semibold().truncate().child(pr() ? pr().title : "Changes"))
          .child(
            div()
              .px(5)
              .py(1)
              .rounded(4)
              .border_1()
              .border_color(t.border)
              .text_size(10)
              .text_color(t.muted)
              .child(`${this.files.length} files`),
          )
          .child(div().text_size(11).text_color(t.ansi2).child(`+${add}`))
          .child(div().text_size(11).text_color(t.ansi1).child(`−${del}`))
          .child(div().flex_1())
          .child(div().text_size(11).text_color(t.dim).child(hint))
          .when(this.notes.length > 0, (e) =>
            e.child(
              h_flex()
                .id("notes")
                .gap(6)
                .px(6)
                .py(1)
                .rounded(4)
                .bg(t.accent)
                .text_color(t.accent_foreground)
                .text_size(11)
                .cursor_pointer()
                .on_click((_e, cx) => {
                  this.notes = [];
                  this.persist(cx);
                  this.note = "Notes cleared";
                  cx.notify();
                })
                .child(`${this.notes.length} note${this.notes.length > 1 ? "s" : ""} ×`),
            ),
          ),
      )
      // A virtual list with its own handle, so j/k keep the open file in view.
      .child(
        div()
          .flex_none()
          .h(Math.min(200, Math.max(44, this.files.length * 28 + 12)))
          .relative()
          .p(6)
          .border_b(1)
          .border_color(t.border)
          .when(!this.files.length, (e) =>
            e.child(
              div()
                .p(8)
                .text_color(t.dim)
                .child(
                  this.error ||
                    (this.loading
                      ? "Loading changes…"
                      : this.root
                        ? pr() ? "No changes against the merge base" : "No uncommitted changes"
                        : "No folder"),
                ),
            ),
          )
          .when(this.files.length > 0, (e) =>
            e
              .child(
                v_virtual_list(
                  "changes-list",
                  this.files.length,
                  28,
                  (i) => this.files[i].path,
                  (range) => this.files.slice(range.start, range.end).map((f) => this.fileRow(f, t)),
                )
                  .track_scroll(this.fileScroll)
                  .on_item_click((path, cx) => this.pick(path, cx))
                  .size_full(),
              )
              .child(Scrollbar.vertical("changes-list").viewport_from_layout().absolute().inset_0()),
          ),
      )
      .when(this.limited, (el) =>
        el.child(
          div()
            .px(12)
            .py(4)
            .text_size(11)
            .text_color(t.dim)
            .child("Showing the first 1,000 changed files"),
        ),
      )
      .child(
        div()
          .id("diff-area")
          .flex_1()
          .w_full()
          .min_h(0)
          .relative()
          // Text columns per side: half the width minus the divider, gutter and gap.
          .on_size_change((size, cx) => {
            const cols = Math.max(20, Math.floor(((size.width - 1) / 2 - 40 - 8 - 12) / CHAR));
            if (cols !== this.cols) {
              this.cols = cols;
              cx.notify();
            }
          })
          .font_family(settings().font_family ?? "JetBrains Mono")
          .text_size(11)
          .child(
            v_virtual_list(
              "changes-diff",
              view.length,
              view.map((v) => (v.note ? NOTE_H : v.h)),
              (j) => (view[j].note ? `n${j}` : String(view[j].i)),
              (range) => {
                const out = [];
                for (let j = range.start; j < range.end; j++)
                  out.push(view[j].note ? this.noteRow(view[j].note, t) : this.diffRow(view[j].i, t, view[j].h));
                return out;
              },
            )
              .track_scroll(this.scroll)
              // Clicks report the row only: keep the cursor's side unless that
              // side is padding there; selecting stays on the anchor's side.
              .on_item_click((k, cx) => {
                if (k.startsWith("n")) return;
                const row = +k,
                  r = this.rows[row];
                if (!r || r.head) return;
                const side = this.anchor?.side ?? this.cursor.side;
                this.cursor = { row, side: r[side] ? side : side === "l" ? "r" : "l" };
                this.inDiff = true;
                this.mark(cx);
              })
              .size_full(),
          )
          .child(
            Scrollbar.vertical("changes-diff")
              .viewport_from_layout()
              .absolute()
              .inset_0(),
          ),
      )
      .when(Boolean(this.note), (e) =>
        e.child(
          div().px(10).py(4).text_size(11).text_color(t.muted).child(this.note),
        ),
      )
      .when(Boolean(this.sel), (e) =>
        e.child(
          div()
            .flex_none()
            .p(10)
            .border_t(1)
            .border_color(t.border)
            .child(
              div()
                .id("comment")
                .h(32)
                .px(10)
                .flex()
                .items_center()
                .rounded(8)
                .border_1()
                .border_color(this.typing ? t.accent : t.border)
                .cursor_text()
                .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
                .child(Input.new(this.input).h_full().text_size(12).text_color(t.foreground)),
            ),
        ),
      );
    // A window overlay (mod.json), so Esc reaches the mod instead of closing
    // a dialog. It covers the whole window but draws only over the terminal
    // area; a click on the rest (sidebar, tabs) closes it.
    const at = insets();
    return div()
      .id("dim")
      .size_full()
      .pl(at.left)
      .pt(at.top)
      .pr(at.right)
      .pb(at.bottom)
      .on_mouse_down("left", (_e, cx) => {
        cx.stop_propagation();
        closeOverlay(props().overlay);
      })
      .child(panel);
  }
}
