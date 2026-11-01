// tmux-style prefix, like herdr's ctrl+b (keys.json: "ctrl-b": "mod.open:prefix").
// keys.json binds single chords only, so this popup takes the next key and
// runs its command. Any other key, or Esc, just closes it.

import { View, div } from "gpui-kit";
import { v_flex } from "gpui-base";
import { run, theme, props, closeOverlay, openOverlay } from "herdr";

// Next keystroke -> what it does.
// C opens Changes (zed-changes, the git diff of the focused pane's repo) filling
// the window; cmd-2 opens it as a popover. Esc closes either.
const KEYS = {
  x: () => run("tab.close", {}),
  "shift-w": () => run("space.rename", {}),
  "shift-t": () => run("tab.rename", {}),
  "shift-c": () =>
    openOverlay({ mod: "zed-changes", kind: "dialog", width: 1, height: 1 }),
};

export default class Prefix extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.handle.focus();
    cx.timer.after(50, () => this.handle.focus());
  }

  render(_cx) {
    const t = theme();
    return v_flex()
      .id("prefix")
      .track_focus(this.handle)
      .size_full()
      .p(12)
      .gap(4)
      .bg(t.popover)
      .text_size(12)
      .text_color(t.muted)
      .on_key_down((e, cx) => {
        cx.stop_propagation();
        closeOverlay(props().overlay);
        const hit = KEYS[e.keystroke];
        if (hit) hit();
      })
      .child(div().text_color(t.foreground).child("ctrl+b"))
      .child(
        div().child("x close tab · W/T rename workspace/tab · C changes full"),
      );
  }
}
