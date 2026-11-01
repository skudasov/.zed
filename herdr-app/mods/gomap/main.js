import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import {
  spaces,
  panes,
  focused,
  exec,
  appHome,
  theme,
  settings,
  props,
  closeOverlay,
} from "herdr";

const ROW = 28;
const STEP = { j: 1, down: 1, k: -1, up: -1 };
// Bulb color per change kind (the helper's Row.Change).
const BULB = { added: "ansi2", changed: "ansi3", removed: "ansi1", body: "dim" };
// [key, label, theme color, which rows it keeps]
const MODES = [
  ["a", "all", "ansi5", () => true],
  [
    "i",
    "interfaces",
    "ansi6",
    (r) => r.kind === "type" && r.text.endsWith(" interface"),
  ],
  ["f", "functions", "ansi4", (r) => r.kind === "func" && r.pub],
  ["s", "structs", "ansi3", (r) => r.kind === "type" && r.text.endsWith(" struct")],
];

// Same as zed-changes: the focused pane's cwd, else the space's folder.
function location() {
  const space = spaces().find((s) => s.active),
    f = focused();
  const pane = f?.pane ? panes().find((p) => p.pane === f.pane) : null;
  return pane?.cwd || f?.cwd || space?.folder;
}

const dirLabel = (dir) => (dir === "." ? "(root)" : dir);

// One list: a header per package dir, then its types and func signatures.
// j/k move, ctrl-d/ctrl-u half a page, enter (or double-click) opens in Zed,
// a/i/f/s pick everything / interfaces / public funcs / structs, / filters by text,
// d keeps only what the branch changed, p picks a dir to look inside (the same
// list then shows dirs; typing narrows them, enter picks, escape cancels).
// Escape steps back: typing/picking, then p and d, then closes.
// Only the rows that fit are drawn, from `top` (v_virtual_list drew nothing
// inside the overlay, so the window is kept by hand).
export default class GoMap extends View {
  init(_props, cx) {
    this.all = [];
    this.rows = [];
    this.mode = "a";
    this.query = "";
    this.scope = null; // a package dir: only it and the dirs under it
    this.changedOnly = false;
    this.picking = false;
    this.base = "";
    this.sel = -1;
    this.top = 0;
    this.height = 0;
    this.wheel = 0;
    // Typing goes to `query` from the list's own keys (like launcher), not a
    // text input: an input takes escape itself.
    this.typing = false;
    this.handle = cx.focus_handle();
    this.load(cx);
    this.handle.focus();
    cx.timer.after(50, () => this.handle.focus());
  }

  load(cx) {
    const cwd = location();
    if (!cwd) return (this.error = "No folder");
    cx.spawn(async (cx) => {
      try {
        const r = await exec(`${appHome()}/mods/gomap/gomap`, [cwd]);
        if (r.code !== 0)
          throw new Error(r.stderr.trim() || `gomap exited ${r.code}`);
        const out = JSON.parse(r.stdout);
        this.all = out.rows;
        this.base = out.base;
        this.root = out.root;
        this.refilter();
      } catch (e) {
        this.error = String(e.message ?? e);
      }
      cx.notify();
    });
  }

  // Rebuilds the shown rows from mode, scope, d and query, a header before each
  // package. While picking: every package dir and its parents instead.
  refilter() {
    const q = this.query.toLowerCase();
    this.top = 0;
    if (this.picking) {
      const dirs = new Set();
      for (const { pkg } of this.all)
        pkg
          .split("/")
          .forEach((_, i, parts) => dirs.add(parts.slice(0, i + 1).join("/")));
      this.rows = [
        { dir: null },
        ...[...dirs].sort().map((dir) => ({ dir })),
      ].filter((r) => !q || (r.dir ?? "(all)").toLowerCase().includes(q));
      this.sel = this.rows.length ? 0 : -1;
      return;
    }
    const keep = MODES.find(([k]) => k === this.mode)[3];
    const inScope = (pkg) =>
      !this.scope || pkg === this.scope || pkg.startsWith(this.scope + "/");
    this.rows = [];
    for (const row of this.all) {
      if (!keep(row) || !inScope(row.pkg) || (this.changedOnly && !row.change))
        continue;
      if (q && !`${row.pkg} ${row.text}`.toLowerCase().includes(q)) continue;
      if (this.rows.at(-1)?.pkg !== row.pkg)
        this.rows.push({ header: true, pkg: row.pkg });
      this.rows.push(row);
    }
    this.sel = this.rows.findIndex((r) => !r.header);
  }

  fits() {
    return Math.max(1, Math.floor(this.height / ROW));
  }

  setTop(top) {
    this.top = Math.max(0, Math.min(top, this.rows.length - this.fits()));
  }

  // Moves the selection by `by` rows, skipping headers, and keeps it on screen.
  move(by) {
    if (this.sel < 0) return;
    const dir = by > 0 ? 1 : -1;
    let i = Math.max(0, Math.min(this.rows.length - 1, this.sel + by));
    while (this.rows[i]?.header) i += dir;
    if (!this.rows[i])
      do i -= dir;
      while (this.rows[i]?.header); // ran off the end
    if (!this.rows[i]) return;
    this.sel = i;
    const want = this.rows[i - 1]?.header ? i - 1 : i; // keep its package header in view
    if (want < this.top) this.setTop(want);
    else if (i >= this.top + this.fits()) this.setTop(i - this.fits() + 1);
  }

  setMode(mode) {
    this.mode = mode;
    this.refilter();
  }

  toggleChanged() {
    this.changedOnly = !this.changedOnly;
    this.refilter();
  }

  // p: the list shows dirs; the text filter is put aside until a dir is picked.
  startPicking() {
    if (this.picking) return;
    this.picking = true;
    this.typing = true;
    this.saved = this.query;
    this.query = "";
    this.refilter();
  }

  stopPicking() {
    this.picking = false;
    this.typing = false;
    this.query = this.saved;
    this.refilter();
  }

  pick() {
    const r = this.rows[this.sel];
    if (r) this.scope = r.dir;
    this.stopPicking();
  }

  openSel() {
    if (this.picking) return this.pick();
    const r = this.rows[this.sel];
    // Through a login shell: the app's own PATH has no /usr/local/bin, so a bare
    // `zed` fails to start. The CLI raises the Zed window and puts the cursor on the line.
    if (r && !r.header && r.change !== "removed")
      exec("/bin/zsh", ["-lc", 'exec zed "$0"', `${this.root}/${r.pkg}/${r.file}:${r.line}`]);
  }

  key(e, cx) {
    const m = e.modifiers;
    // Enter's key_char is a carriage return: only real characters type.
    const typed =
      e.key_char >= " " && !m.control && !m.platform ? e.key_char : "";
    if (this.typing) {
      const step = { down: 1, up: -1 }[e.key];
      if (step) this.move(step);
      else if (e.key === "escape" || e.key === "enter") {
        // Picking: escape cancels, enter picks. Filtering: both keep the filter and
        // hand the keys back to the list; enter also opens the selected row.
        if (!this.picking) {
          this.typing = false;
          if (e.key === "enter") this.openSel();
        }
        else if (e.key === "enter") this.pick();
        else this.stopPicking();
      } else if (e.key === "backspace") {
        this.query = this.query.slice(0, -1);
        this.refilter();
      } else if (typed) {
        this.query += typed;
        this.refilter();
      } else return;
    } else if (e.key === "escape" && (this.scope || this.changedOnly)) {
      this.scope = null;
      this.changedOnly = false;
      this.refilter();
    } else if (e.key === "escape") {
      // A window overlay (mod.json): Herdr leaves escape to the mod.
      closeOverlay(props().overlay);
    } else if (m.control && (e.key === "d" || e.key === "u")) {
      const half =
        Math.max(1, Math.floor(this.fits() / 2)) * (e.key === "d" ? 1 : -1);
      this.setTop(this.top + half);
      this.move(half);
    } else if (m.control || m.platform || m.alt) {
      return;
    } else if (STEP[e.key]) {
      this.move(STEP[e.key]);
    } else if (e.key === "enter") {
      this.openSel();
    } else if (e.key === "d") {
      this.toggleChanged();
    } else if (e.key === "p") {
      this.startPicking();
    } else if (MODES.some(([k]) => k === e.key.toLowerCase())) {
      this.setMode(e.key.toLowerCase());
    } else if (e.key === "/") {
      this.typing = true;
    } else {
      return;
    }
    cx.stop_propagation();
    cx.notify();
  }

  row(r, i, t) {
    if ("dir" in r)
      return h_flex()
        .id(`dir-${i}`)
        .h(ROW)
        .flex_none()
        .px(12)
        .items_center()
        .cursor_pointer()
        .when(i === this.sel, (el) => el.bg(t.selected))
        .when(i !== this.sel, (el) => el.hover((s) => s.bg(t.hover)))
        .on_mouse_down("left", (_e, cx) => {
          this.sel = i;
          this.pick();
          cx.notify();
        })
        .text_color(
          r.dir === null
            ? t.dim
            : r.dir === this.scope
              ? t.accent
              : t.foreground,
        )
        .child(r.dir === null ? "(all)" : dirLabel(r.dir));
    if (r.header)
      return div()
        .h(ROW)
        .flex_none()
        .px(12)
        .pt(8)
        .font_semibold()
        .text_color(t.accent)
        .child(dirLabel(r.pkg));
    const [kw, ...rest] = r.text.split(" ");
    return (
      h_flex()
        .id(`row-${i}`)
        .h(ROW)
        .flex_none()
        .px(12)
        .pl(16)
        .gap(8)
        .items_center()
        .cursor_pointer()
        .when(i === this.sel, (el) => el.bg(t.selected))
        .when(i !== this.sel, (el) => el.hover((s) => s.bg(t.hover)))
        .on_mouse_down("left", (e, cx) => {
          this.sel = i;
          if (e.click_count === 2) this.openSel();
          cx.notify();
        })
        // A bulb on what the branch changed: green added, yellow signature or
        // type changed, red removed, grey only the body.
        .child(
          div()
            .w(8)
            .flex_none()
            .text_color(t[BULB[r.change]] ?? t.dim)
            .child(r.change ? "●" : ""),
        )
        .child(div().flex_none().text_color(t.ansi5).child(kw))
        .child(
          div()
            .min_w(0)
            .truncate()
            .text_color(r.change === "removed" ? t.dim : t.foreground)
            .child(rest.join(" ")),
        )
    );
  }

  header(t) {
    // A header toggle: its color always, a tinted fill and border when on.
    const chip = (id, on, c, label, act) =>
      div()
        .id(id)
        .px(8)
        .py(2)
        .rounded(5)
        .border_1()
        .cursor_pointer()
        .text_color(t[c])
        .when(on, (el) => el.bg(t[c] + "26").border_color(t[c]))
        .when(!on, (el) =>
          el
            .border_color("#00000000")
            .opacity(0.7)
            .hover((s) => s.bg(t.hover)),
        )
        .on_click((_e, cx) => {
          act();
          cx.notify();
        })
        .child(label);
    const count = this.rows.filter((r) => !r.header).length;
    return h_flex()
      .h(38)
      .flex_none()
      .px(10)
      .gap(4)
      .items_center()
      .border_b(1)
      .border_color(t.border)
      .children(
        MODES.map(([k, label, c]) =>
          chip(`mode-${k}`, this.mode === k, c, `${k.toUpperCase()} ${label}`, () =>
            this.setMode(k),
          ),
        ),
      )
      .child(div().w(10))
      .child(
        chip(
          "changed",
          this.changedOnly,
          "ansi2",
          this.base ? `D changed vs ${this.base}` : "D changed (no git)",
          () => this.toggleChanged(),
        ),
      )
      .child(
        chip(
          "scope",
          Boolean(this.scope) || this.picking,
          "ansi1",
          this.picking
            ? "P pick a dir…"
            : `P ${this.scope ? dirLabel(this.scope) : "all dirs"}`,
          () => this.startPicking(),
        ),
      )
      .child(div().flex_1())
      .when(!this.picking, (el) =>
        el.child(
          div()
            .text_size(11)
            .text_color(t.dim)
            .pr(8)
            .child(`${count} / ${this.all.length}`),
        ),
      )
      .child(
        h_flex()
          .id("filter")
          .w(240)
          .h(26)
          .px(8)
          .gap(6)
          .items_center()
          .rounded(6)
          .border_1()
          .border_color(this.typing ? t.accent : t.border)
          .cursor_text()
          .on_click((_e, cx) => {
            this.typing = true;
            cx.notify();
          })
          .child(div().text_color(t.dim).child("/"))
          .child(
            div()
              .flex_1()
              .min_w(0)
              .truncate()
              .text_size(12)
              .text_color(this.query || this.typing ? t.foreground : t.dim)
              .child(
                (this.query ||
                  (this.typing ? "" : this.picking ? "dir" : "filter")) +
                  (this.typing ? "▏" : ""),
              ),
          ),
      );
  }

  render() {
    const t = theme();
    const shown = this.rows.slice(this.top, this.top + this.fits() + 1);
    const panel = v_flex()
      .id("gomap")
      .w("85%")
      .h("85%")
      .rounded(10)
      .border_1()
      .border_color(t.border)
      .overflow_hidden()
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .bg(t.surface)
      .text_size(12.5)
      .font_family(settings().font_family ?? "JetBrains Mono")
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      .child(this.header(t))
      .child(
        v_flex()
          .id("gomap-list")
          .flex_1()
          .min_h(0)
          .overflow_hidden()
          .on_size_change((size, cx) => {
            this.height = size.height;
            this.setTop(this.top);
            cx.notify();
          })
          .on_scroll_wheel((e, cx) => {
            // Trackpads send small pixel steps: add them up to whole rows.
            this.wheel -= e.delta.y;
            const by = Math.trunc(this.wheel / ROW);
            if (!by) return;
            this.wheel -= by * ROW;
            this.setTop(this.top + by);
            cx.notify();
          })
          .children(shown.map((r, k) => this.row(r, this.top + k, t)))
          .when(!this.rows.length, (el) =>
            el.child(
              div()
                .p(16)
                .text_color(this.error ? t.ansi1 : t.dim)
                .child(
                  this.error ??
                    (this.all.length ? "Nothing matches" : "Loading…"),
                ),
            ),
          ),
      );
    // A window (mod.json) instead of a dialog, so escape reaches the mod. Windows
    // don't dim, so it fills the app and draws the dim itself; a click on the dim
    // closes it, and every press stops here so the full-size window never drags.
    return div()
      .id("dim")
      .size_full()
      .flex()
      .items_center()
      .justify_center()
      .bg("#00000066")
      .on_mouse_down("left", (_e, cx) => {
        cx.stop_propagation();
        closeOverlay(props().overlay);
      })
      .child(panel);
  }
}
