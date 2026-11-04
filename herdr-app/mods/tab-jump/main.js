import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, panes, run, theme, settings, props, closeOverlay } from "herdr";

// Every space on a row: its name, then its tabs left to right (keys.json: "cmd-s").
// j/k (or arrows) move through all tabs, enter (or a click) opens one, typing filters
// tabs by name (filterKey), escape closes.
const COLORS = ["ansi5", "ansi6", "ansi4", "ansi3", "ansi2", "ansi1"];
const STEP = { j: 1, down: 1, k: -1, up: -1 };

// Typing filters the list (shown in the header). Enter stops typing and opens the
// selected item, esc clears the filter. `own`: the list's keys, they don't start typing.
// True when the key was taken. Copied in launcher, snippets, prs and tab-jump (mods can't share files).
function filterKey(s, e, own) {
  const k = e.keystroke;
  // Enter's key_char is a carriage return: only real characters type.
  const typed = e.key_char >= " " && !e.modifiers?.platform && !e.modifiers?.control ? e.key_char : "";
  if (k === "escape" && s.q) {
    s.q = "";
    s.typing = false;
  } else if (k === "enter" && s.typing) {
    s.typing = false;
    return false; // fall through: the caller's enter opens the selected item
  } else if (k === "backspace" && s.q) s.q = s.q.slice(0, -1);
  else if (typed && (s.typing || !own.includes(k))) {
    s.q = (s.q ?? "") + typed;
    s.typing = true;
  } else return false;
  s.at = 0;
  return true;
}

export default class TabJump extends View {
  init(_props, cx) {
    this.at = 0;
    this.handle = cx.focus_handle();
    this.handle.focus();
    cx.timer.after(50, () => this.handle.focus());
  }

  // Spaces with the tabs whose name matches the filter; spaces left empty drop out.
  rows() {
    const q = (this.q ?? "").toLowerCase();
    return spaces()
      .map((s, i) => ({ s, i, tabs: s.tabs.filter((t) => t.name.toLowerCase().includes(q)) }))
      .filter((r) => r.tabs.length);
  }

  open(space, tab) {
    closeOverlay(props().overlay);
    run("space.select", { id: space.id });
    run("tab.select", { id: tab.id });
  }

  key(e, cx, flat) {
    const step = STEP[e.keystroke];
    if (filterKey(this, e, ["j", "k"]));
    else if (step) this.at = Math.max(0, Math.min(flat.length - 1, this.at + step));
    else if (e.keystroke === "enter" && flat[this.at]) this.open(...flat[this.at]);
    else if (e.keystroke === "escape") closeOverlay(props().overlay);
    else return;
    cx.stop_propagation();
    cx.notify();
  }

  render() {
    const t = theme();
    const rows = this.rows();
    const flat = rows.flatMap((r) => r.tabs.map((tab) => [r.s, tab]));
    if (this.at >= flat.length) this.at = Math.max(0, flat.length - 1);
    const selTab = flat[this.at]?.[1];
    // The pane that speaks for a tab, picked like Herdr's own tabs: its agent, else the focused one, else the first.
    const ps = panes();
    const lead = (tab) =>
      ps.find((x) => x.tab === tab.id && x.program?.agent) ??
      ps.find((x) => x.tab === tab.id && x.focused) ??
      ps.find((x) => x.tab === tab.id);
    const icon = (p) => {
      if (!p?.icon) return div().w(14).h(14).flex_none();
      return p.tint ? svg(p.icon).size(14).flex_none() : image(p.icon).w(14).h(14).flex_none();
    };
    const STATUS = { working: "ansi3", blocked: "ansi1", done: "ansi2" };
    const since = (ms) => {
      const m = Math.floor((Date.now() - ms) / 60000);
      return m < 1 ? "now" : m < 60 ? `${m}m` : `${Math.floor(m / 60)}h`;
    };
    const dim = (label) => div().flex_none().text_size(11).text_color(t.dim).child(label);

    // A two-line square: a top line and one dim detail line. Tinted fill and border when on.
    const square = (id, c, on, top, detail) =>
      v_flex()
        .id(id)
        .flex_none()
        .gap(1)
        .px(8)
        .py(3)
        .rounded(6)
        .border_1()
        .text_color(t[c])
        .when(on, (el) => el.bg(t[c] + "26").border_color(t[c]))
        .when(!on, (el) => el.border_color(t[c] + "33").bg(t[c] + "0a"))
        .child(h_flex().gap(5).items_center().children([].concat(top)))
        .child(div().max_w(160).truncate().text_size(10.5).text_color(t.dim).child(detail || " "));

    const tabSquare = (s, tab) => {
      const p = lead(tab);
      const current = tab.active && s.active;
      const status = STATUS[tab.status];
      // Detail: how long it's been working, else what it shows (title, else program).
      const detail = [
        tab.status === "working" && tab.working_since ? since(tab.working_since) : null,
        p?.title && p.title !== tab.name ? p.title : p?.program?.name,
        tab.panes > 1 ? `▦${tab.panes}` : null,
      ].filter(Boolean).join(" · ");
      return square(
        `t-${tab.id}`,
        current ? "accent" : "ansi4",
        tab === selTab,
        [
          div().text_size(10.5).text_color(t.dim).child(String(tab.index)),
          icon(p?.program),
          div().when(current, (el) => el.font_semibold()).child(tab.name),
          status ? div().w(7).h(7).rounded(4).flex_none().bg(t[status]) : null,
        ].filter(Boolean),
        detail,
      )
        .cursor_pointer()
        .when(tab !== selTab, (el) => el.hover((h) => h.bg(t.hover)))
        .on_click(() => this.open(s, tab));
    };

    const spaceRow = ({ s, i, tabs }) =>
      h_flex()
        .gap(6)
        .flex_wrap()
        .items_center()
        .child(
          square(
            `s-${s.id}`,
            COLORS[i % COLORS.length],
            true,
            div().font_semibold().child(s.name),
            [s.branch && `⎇ ${s.branch}`, s.machine && `@${s.machine}`].filter(Boolean).join(" ") || `${tabs.length} tabs`,
          ).min_w(120),
        )
        .children(tabs.map((tab) => tabSquare(s, tab)));

    const panel = v_flex()
      .id("tab-jump")
      .w("48%")
      .max_h("80%")
      .rounded(10)
      .border_1()
      .border_color(t.border)
      .overflow_hidden()
      .bg(t.surface)
      .text_size(12.5)
      .font_family(settings().font_family ?? "JetBrains Mono")
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx, flat))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .child(
        h_flex()
          .h(36)
          .px(12)
          .gap(8)
          .items_center()
          .flex_none()
          .border_b(1)
          .border_color(this.typing ? t.accent : t.border)
          .child(div().text_color(t.dim).child("⌕"))
          .child(
            div()
              .flex_1()
              .text_color(this.q ? t.foreground : t.dim)
              .child(`${this.q || "type to filter"}${this.typing ? "▏" : ""}`),
          )
          .child(dim(`${flat.length ? this.at + 1 : 0}/${flat.length}`)),
      )
      .child(
        v_flex()
          .id("tab-jump-list")
          .flex_1()
          .min_h(0)
          .overflow_y_scroll()
          .p(8)
          .gap(6)
          .children(rows.map(spaceRow))
          .when(!rows.length, (el) => el.child(div().p(8).text_color(t.dim).child("Nothing matches"))),
      )
      .child(
        h_flex()
          .flex_none()
          .gap(14)
          .px(12)
          .py(6)
          .border_t(1)
          .border_color(t.border)
          .child(dim("j/k move"))
          .child(dim("enter open"))
          .child(dim("type filter"))
          .child(dim("esc close")),
      );
    // A window overlay (mod.json) so escape reaches the mod: it draws its own dim,
    // and a click on the dim closes it.
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
