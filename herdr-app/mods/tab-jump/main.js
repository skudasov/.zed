import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, panes, run, theme, settings, props, closeOverlay } from "herdr";

// Every space on a row: its name, then its tabs left to right (keys.json: "cmd-s").
// j/k (or arrows) move through all tabs, enter (or a click) opens one, typing filters
// tabs by name (filterKey), escape closes.
const COLORS = ["ansi5", "ansi6", "ansi4", "ansi3", "ansi2", "ansi1"];
const STEP = { j: 1, down: 1, k: -1, up: -1 };

// Typing filters the list (shown in the header). Enter stops typing and gives the
// keys back to the list, esc clears the filter. `own`: the list's keys, they don't start typing.
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
    return true;
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
    // A colored label: tinted fill and border when on, faded when off.
    // The tab's program icon, picked like Herdr's own tabs: its agent, else its first pane.
    const ps = panes();
    const icon = (tab) => {
      const p = (ps.find((x) => x.tab === tab.id && x.program?.agent) ?? ps.find((x) => x.tab === tab.id))?.program;
      if (!p?.icon) return null;
      return p.tint ? svg(p.icon).size(13).flex_none() : image(p.icon).w(13).h(13).flex_none();
    };
    const chip = (id, c, on, label, glyph = null) =>
      div()
        .id(id)
        .flex()
        .items_center()
        .gap(5)
        .flex_none()
        .px(8)
        .py(2)
        .rounded(5)
        .border_1()
        .text_color(t[c])
        .when(on, (el) => el.bg(t[c] + "26").border_color(t[c]))
        .when(!on, (el) => el.border_color("#00000000").opacity(0.7))
        .when(Boolean(glyph), (el) => el.child(glyph))
        .child(label);
    const panel = v_flex()
      .id("tab-jump")
      .w("42%")
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
          .h(34)
          .px(12)
          .items_center()
          .border_b(1)
          .border_color(this.typing ? t.accent : t.border)
          .text_color(this.q ? t.foreground : t.dim)
          .child(`${this.q || "type to filter"}${this.typing ? "▏" : ""}`),
      )
      .child(
        v_flex()
          .p(10)
          .gap(6)
          .children(
            rows.map(({ s, i, tabs }) =>
              h_flex()
                .gap(6)
                .flex_wrap()
                .items_center()
                .child(chip(`s-${s.id}`, COLORS[i % COLORS.length], true, s.name).font_semibold().min_w(120))
                .children(
                  tabs.map((tab) =>
                    chip(`t-${tab.id}`, tab.active && s.active ? "accent" : "ansi4", tab === selTab, tab.name, icon(tab))
                      .cursor_pointer()
                      .on_click(() => this.open(s, tab)),
                  ),
                ),
            ),
          )
          .when(!rows.length, (el) => el.child(div().text_color(t.dim).child("Nothing matches"))),
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
