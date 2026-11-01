// Asks for a name right after a space (worktrees included) or tab is created: Herdr's
// own rename prompt, opened by space.rename / tab.rename without a name. Lives in a
// 0px block of the zed layout, since a mod only runs while the layout shows it.
// What exists when a machine's spaces first show up is left alone.
import { View, div } from "gpui-kit";
import { spaces, run } from "herdr";

export default class AskName extends View {
  init() {
    this.seen = new Set();
    this.machines = new Set();
  }

  render() {
    for (const s of spaces()) {
      const fresh = this.machines.has(s.machine);
      if (fresh && !this.seen.has(s.id)) run("space.rename", { id: s.id });
      else if (fresh) for (const t of s.tabs) if (!this.seen.has(t.id)) run("tab.rename", { id: t.id });
      this.seen.add(s.id);
      s.tabs.forEach((t) => this.seen.add(t.id));
    }
    spaces().forEach((s) => this.machines.add(s.machine));
    return div();
  }
}
