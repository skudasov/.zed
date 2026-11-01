// Our mods in one list (keys.json: "cmd-e": "mod.open:launcher"). j/k move, enter opens.
// Shipped mods look the same in mod.json, so ours are listed here: add a line per new mod.

import { View, div } from "gpui-kit";
import { v_flex } from "gpui-base";
import { run, theme, props, closeOverlay } from "herdr";

// Typing filters the list (shown in the header). Enter stops typing and gives the
// keys back to the list, esc clears the filter. `own`: the list's keys, they don't start typing.
// True when the key was taken. Copied in launcher, snippets and prs (mods can't share files).
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
const matches = (q, text) => !q || text.toLowerCase().includes(q.toLowerCase());

const MODS = [
  ["prs", "Pull requests"],
  ["snippets", "Snippets"],
  ["zed-changes", "Changes"],
  ["gomap", "Go map"],
];

export default class Launcher extends View {
  init(_props, cx) {
    this.at = 0;
    this.handle = cx.focus_handle();
    this.handle.focus();
    cx.timer.after(50, () => this.handle.focus());
  }

  render(_cx) {
    const t = theme();
    const list = MODS.filter(([, title]) => matches(this.q, title));
    return v_flex()
      .id("launcher")
      .track_focus(this.handle)
      .size_full()
      .p(12)
      .gap(2)
      .bg(t.popover)
      .text_size(13)
      .on_key_down((e, cx) => {
        const k = e.keystroke;
        if (filterKey(this, e, ["j", "k"]));
        else if (k === "j" || k === "down") this.at = Math.min(this.at + 1, list.length - 1);
        else if (k === "k" || k === "up") this.at = Math.max(this.at - 1, 0);
        else if (k === "enter" && list[this.at]) {
          closeOverlay(props().overlay);
          run("mod.open", { name: list[this.at][0] });
        } else return;
        cx.stop_propagation();
        cx.notify();
      })
      .when(Boolean(this.q), (el) => el.child(div().px(8).pb(4).text_color(t.muted).child(`${this.q}${this.typing ? "▏" : ""}`)))
      .children(
        list.map(([, title], i) =>
          div()
            .px(8)
            .py(3)
            .rounded(6)
            .bg(i === this.at ? t.selected : t.popover)
            .text_color(t.foreground)
            .child(title),
        ),
      );
  }
}
