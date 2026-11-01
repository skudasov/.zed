import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { spaces, panes, focused, exec, appHome, theme, settings } from "herdr";

const ROW = 28;
// [key, label, theme color, which rows it keeps]
const MODES = [
  ["f", "funcs", "ansi4", (r) => r.kind === "func" && r.pub],
  ["t", "types", "ansi3", (r) => r.kind === "type"],
  ["i", "interfaces", "ansi6", (r) => r.kind === "type" && r.text.endsWith(" interface")],
  ["a", "all", "ansi5", () => true],
];

// Same as zed-changes: the focused pane's cwd, else the space's folder.
function location() {
  const space = spaces().find((s) => s.active),
    f = focused();
  const pane = f?.pane ? panes().find((p) => p.pane === f.pane) : null;
  return pane?.cwd || f?.cwd || space?.folder;
}

// One list: a header per package dir, then its types and func signatures.
// j/k move, ctrl-d/ctrl-u half a page, enter (or double-click) opens in Zed,
// f/t/i/a pick public funcs / types / interfaces / everything, / filters by text.
// Only the rows that fit are drawn, from `top` (v_virtual_list drew nothing
// inside this dialog, so the window is kept by hand).
export default class GoMap extends View {
  init(_props, cx) {
    this.all = [];
    this.rows = [];
    this.mode = "f";
    this.query = "";
    this.sel = -1;
    this.top = 0;
    this.height = 0;
    this.wheel = 0;
    this.handle = cx.focus_handle();
    this.input = InputState.new({ placeholder: "filter" });
    this.input.on("change", (_e, cx) => {
      this.query = this.input.value();
      this.refilter();
      cx.notify();
    });
    this.input.on("submit", (_e, cx) => this.leaveInput(cx));
    this.input.on("focus", (_e, cx) => { this.typing = true; cx.notify(); });
    this.input.on("blur", (_e, cx) => { this.typing = false; cx.notify(); });
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
        if (r.code !== 0) throw new Error(r.stderr.trim() || `gomap exited ${r.code}`);
        this.all = JSON.parse(r.stdout).rows;
        this.refilter();
      } catch (e) {
        this.error = String(e.message ?? e);
      }
      cx.notify();
    });
  }

  // Rebuilds the shown rows from mode + query, a header before each package.
  refilter() {
    const keep = MODES.find(([k]) => k === this.mode)[3];
    const q = this.query.toLowerCase();
    this.rows = [];
    for (const row of this.all) {
      if (!keep(row) || (q && !`${row.pkg} ${row.text}`.toLowerCase().includes(q))) continue;
      if (this.rows.at(-1)?.pkg !== row.pkg) this.rows.push({ header: true, pkg: row.pkg });
      this.rows.push(row);
    }
    this.top = 0;
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
    if (!this.rows[i]) do i -= dir; while (this.rows[i]?.header); // ran off the end
    if (!this.rows[i]) return;
    this.sel = i;
    const want = this.rows[i - 1]?.header ? i - 1 : i; // keep its package header in view
    if (want < this.top) this.setTop(want);
    else if (i >= this.top + this.fits()) this.setTop(i - this.fits() + 1);
  }

  setMode(mode, cx) {
    this.mode = mode;
    this.refilter();
    cx.notify();
  }

  leaveInput(cx) {
    this.handle.focus();
    cx.notify();
  }

  openSel() {
    const r = this.rows[this.sel];
    // Through a login shell: the app's own PATH has no /usr/local/bin, so a bare
    // `zed` fails to start. The CLI raises the Zed window and puts the cursor on the line.
    if (r && !r.header) exec("/bin/zsh", ["-lc", 'exec zed "$0"', `${r.file}:${r.line}`]);
  }

  key(e, cx) {
    const m = e.modifiers;
    if (this.typing) {
      if (e.key !== "escape") return;
      this.leaveInput(cx); // keeps the filter; a second escape closes the dialog
    } else if (m.control && (e.key === "d" || e.key === "u")) {
      const half = Math.max(1, Math.floor(this.fits() / 2)) * (e.key === "d" ? 1 : -1);
      this.setTop(this.top + half);
      this.move(half);
    } else if (m.control || m.platform || m.alt) {
      return;
    } else if ({ j: 1, down: 1, k: -1, up: -1 }[e.key]) {
      this.move({ j: 1, down: 1, k: -1, up: -1 }[e.key]);
    } else if (e.key === "enter") {
      this.openSel();
    } else if (MODES.some(([k]) => k === e.key.toLowerCase())) {
      this.setMode(e.key.toLowerCase(), cx);
    } else if (e.key === "/") {
      this.input.focus();
    } else {
      return;
    }
    cx.stop_propagation();
    cx.notify();
  }

  row(r, i, t) {
    if (r.header)
      return div().h(ROW).flex_none().px(12).pt(8).font_semibold().text_color(t.accent)
        .child(r.pkg === "." ? "(root)" : r.pkg);
    const [kw, ...rest] = r.text.split(" ");
    return h_flex().id(`row-${i}`).h(ROW).flex_none().px(12).pl(28).gap(8).items_center().cursor_pointer()
      .when(i === this.sel, (el) => el.bg(t.selected))
      .when(i !== this.sel, (el) => el.hover((s) => s.bg(t.hover)))
      .on_mouse_down("left", (e, cx) => {
        this.sel = i;
        if (e.click_count === 2) this.openSel();
        cx.notify();
      })
      .child(div().flex_none().text_color(t.ansi5).child(kw))
      .child(div().min_w(0).truncate().text_color(t.foreground).child(rest.join(" ")));
  }

  header(t) {
    // Each mode keeps its color; the active one gets a tinted fill and border.
    const toggle = ([k, label, c]) => div().id(`mode-${k}`).px(8).py(2).rounded(5).border_1().cursor_pointer()
      .text_color(t[c])
      .when(this.mode === k, (el) => el.bg(t[c] + "26").border_color(t[c]))
      .when(this.mode !== k, (el) => el.border_color("#00000000").opacity(0.7).hover((s) => s.bg(t.hover)))
      .on_click((_e, cx) => this.setMode(k, cx))
      .child(`${k.toUpperCase()} ${label}`);
    const count = this.rows.filter((r) => !r.header).length;
    return h_flex().h(38).flex_none().px(10).gap(4).items_center().border_b(1).border_color(t.border)
      .children(MODES.map(toggle))
      .child(div().flex_1())
      .child(div().text_size(11).text_color(t.dim).pr(8).child(`${count} / ${this.all.length}`))
      .child(h_flex().id("filter").w(240).h(26).px(8).gap(6).items_center().rounded(6).border_1()
        .border_color(this.typing ? t.accent : t.border).cursor_text()
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .child(div().text_color(t.dim).child("/"))
        .child(Input.new(this.input).flex_1().text_size(12).text_color(t.foreground)));
  }

  render() {
    const t = theme();
    const shown = this.rows.slice(this.top, this.top + this.fits() + 1);
    return v_flex().id("gomap").size_full().bg(t.surface).text_size(12.5)
      .font_family(settings().font_family ?? "JetBrains Mono")
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      .child(this.header(t))
      .child(v_flex().id("gomap-list").flex_1().min_h(0).overflow_hidden()
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
        .when(!this.rows.length, (el) => el.child(div().p(16).text_color(this.error ? t.ansi1 : t.dim)
          .child(this.error ?? (this.all.length ? "Nothing matches" : "Loading…")))));
  }
}
