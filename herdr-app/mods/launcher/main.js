// Our mods in one list (keys.json: "cmd-e": "mod.open:launcher"). j/k move, enter opens.
// Shipped mods look the same in mod.json, so ours are listed here: add a line per new mod.

import { View, div } from "gpui-kit";
import { v_flex } from "gpui-base";
import { run, theme, props, closeOverlay } from "herdr";

const MODS = [
  ["prs", "Pull requests"],
  ["snippets", "Snippets"],
  ["zed-changes", "Changes"],
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
        if (k === "j" || k === "down") this.at = Math.min(this.at + 1, MODS.length - 1);
        else if (k === "k" || k === "up") this.at = Math.max(this.at - 1, 0);
        else if (k === "enter") {
          closeOverlay(props().overlay);
          run("mod.open", { name: MODS[this.at][0] });
        } else return;
        cx.stop_propagation();
        cx.notify();
      })
      .children(
        MODS.map(([, title], i) =>
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
