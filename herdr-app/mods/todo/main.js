// TODO: a Claude or OpenCode tab on the focused folder that keeps ./TODO.md, a short plan:
// the idea in a few paragraphs, then the work as - [ ] / - [x] actions. rules.md goes into the
// agent's system prompt (plan and default mode). After each answer stop.zsh checks TODO.md is
// newer than every changed file, else the agent is asked once to update it: Claude through a
// Stop hook, OpenCode through a plugin: opencode/ on 2.x, opencode-todo.js on 1.x.
// Keys: c Claude · o OpenCode · esc close.
import { View } from "gpui-kit";
import { h_flex } from "gpui-base";
import { run, focused, spaces, appHome, theme, props, closeOverlay } from "herdr";

// $1 this folder, $2 claude|opencode. Runs as `zsh -c SH todo dir agent` in the tab's folder.
const SH = String.raw`
D=$1
[[ -e TODO.md ]] || print '# <name>\n\n<idea>\n\n## TODO' > TODO.md
if [[ $2 == claude ]]; then
  exec claude --append-system-prompt "$(<$D/rules.md)" --settings '{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"zsh '$D'/stop.zsh claude"}]}]}}'
else
  # 1.x: a plugin file under "plugin", its own server. 2.x: a plugin folder under "plugins",
  # and --standalone so this env reaches the server instead of the shared background one.
  if [[ $(opencode --version) == (|*v)1.* ]]; then P='"plugin":["file://'$D'/opencode-todo.js"]' S=()
  else P='"plugins":["'$D'/opencode"]' S=(--standalone); fi
  OPENCODE_CONFIG_CONTENT='{"instructions":["'$D'/rules.md"],'$P'}' exec opencode $S
fi`;

export default class Todo extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.handle.focus();
    cx.timer.after(50, () => this.handle.focus());
  }

  start(agent) {
    const space = spaces().find((s) => s.active);
    const folder = focused()?.cwd || space?.folder;
    closeOverlay(props().overlay);
    run("tab.new", {
      space: space?.id,
      name: agent === "claude" ? "Claude" : "OpenCode",
      folder,
      argv: ["/bin/zsh", "-c", SH, "todo", `${appHome()}/mods/todo`, agent],
    });
  }

  render(_cx) {
    const t = theme();
    return h_flex()
      .id("todo")
      .track_focus(this.handle)
      .size_full()
      .p(12)
      .gap(12)
      .bg(t.popover)
      .text_size(13)
      .text_color(t.foreground)
      .on_key_down((e, cx) => {
        const k = e.keystroke;
        if (k === "c") this.start("claude");
        else if (k === "o") this.start("opencode");
        else if (k === "escape") closeOverlay(props().overlay);
        else return;
        cx.stop_propagation();
      })
      .child("TODO.md agent:")
      .child("c Claude")
      .child("o OpenCode");
  }
}
