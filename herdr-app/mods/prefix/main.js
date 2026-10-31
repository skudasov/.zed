// tmux-style prefix, like herdr's ctrl+b (keys.json: "ctrl-b": "mod.open:prefix").
// keys.json binds single chords only, so this popup takes the next key and
// runs its command. Any other key, or Esc, just closes it.

import { View, div } from "gpui-kit";
import { v_flex } from "gpui-base";
import { run, theme, props, closeOverlay } from "herdr";

// Next keystroke -> [command, args]. Matches herdr/config.toml's prefix keys.
const KEYS = {
  "x": ["tab.close", {}],
  "shift-w": ["space.rename", {}],
  "shift-t": ["tab.rename", {}],
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
        if (hit) run(...hit);
      })
      .child(div().text_color(t.foreground).child("ctrl+b"))
      .child(div().child("x close tab · W rename workspace · T rename tab"));
  }
}
