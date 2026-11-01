// Markdown snippets (./snippets/*.md) for agents: j/k move, enter copies the
// selected one to the clipboard and closes, then paste it into any agent.
// Also used by herdr/bin/skill-snippet.ts (TUI), which reads the installed copy.

import { View, div } from "gpui-kit";
import { v_flex } from "gpui-base";
import { exec, theme, props, closeOverlay } from "herdr";

// One call: name\0text\0 per snippet, read from the installed mod.
async function load() {
  const r = await exec("/bin/zsh", [
    "-lc",
    'cd "$HOME/.config/herdr-app/mods/snippets/snippets" && for f in *.md; do printf "%s\\0%s\\0" "${f%.md}" "$(<$f)"; done',
  ]);
  const parts = r.stdout.split("\0");
  const out = [];
  for (let i = 0; i + 1 < parts.length; i += 2) out.push({ name: parts[i], text: parts[i + 1] });
  return out;
}

export default class Snippets extends View {
  init(_props, cx) {
    this.items = null;
    this.at = 0;
    this.handle = cx.focus_handle();
    this.handle.focus();
    cx.timer.after(50, () => this.handle.focus());
    cx.spawn(async (cx) => {
      this.items = await load().catch(() => []);
      cx.notify();
    });
  }

  render(_cx) {
    const t = theme();
    const items = this.items ?? [];
    return v_flex()
      .id("snippets")
      .track_focus(this.handle)
      .size_full()
      .p(16)
      .gap(2)
      .bg(t.popover)
      .text_size(13)
      .on_key_down((e, cx) => {
        const k = e.keystroke;
        if (k === "j" || k === "down") this.at = Math.min(this.at + 1, items.length - 1);
        else if (k === "k" || k === "up") this.at = Math.max(this.at - 1, 0);
        else if (k === "enter" && items[this.at]) {
          cx.write_to_clipboard(items[this.at].text);
          closeOverlay(props().overlay);
        } else return;
        cx.stop_propagation();
        cx.notify();
      })
      .child(
        div().pb(8).text_size(15).font_semibold().text_color(t.foreground).child("Snippets · enter copies"),
      )
      .when(this.items === null, (el) => el.child(div().text_color(t.muted).child("Loading…")))
      .children(
        items.map((s, i) =>
          div()
            .px(8)
            .py(3)
            .rounded(6)
            .bg(i === this.at ? t.selected : t.popover)
            .text_color(t.foreground)
            .truncate()
            .child(`${s.name}  ·  ${s.text.split("\n")[0].replace(/^#\s*/, "")}`),
        ),
      );
  }
}
