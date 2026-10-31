// Pull request titles of one repo, opened as a dialog (keys.json: "cmd-3": "mod.open:prs").
// Esc or cmd-3 again closes it.

import { View, div } from "gpui-kit";
import { v_flex } from "gpui-base";
import { exec, theme } from "herdr";

const REPO = "skudasov/.zed";

export default class Prs extends View {
  init(_props, cx) {
    this.titles = null;
    this.error = null;
    cx.spawn(async (cx) => {
      try {
        const r = await exec("gh", ["pr", "list", "--repo", REPO, "--state", "all", "--limit", "100", "--json", "title", "--jq", ".[].title"]);
        if (r.code === 0) this.titles = r.stdout.split("\n").filter(Boolean);
        else this.error = r.stderr.trim() || `gh exited ${r.code}`;
      } catch (e) {
        this.error = String(e); // gh not installed
      }
      cx.notify();
    });
  }

  render(_cx) {
    const t = theme();
    const rows = this.error
      ? [div().text_color(t.blocked).child(this.error)]
      : this.titles === null
        ? [div().text_color(t.muted).child("Loading…")]
        : this.titles.length === 0
          ? [div().text_color(t.muted).child("No pull requests")]
          : this.titles.map((title) => div().truncate().text_color(t.foreground).child(title));
    return v_flex().w(480).max_h(600).p(16).gap(6).bg(t.popover).text_size(13)
      .child(div().text_size(15).font_semibold().text_color(t.foreground).child(REPO))
      .child(v_flex().id("list").gap(4).overflow_y_scrollbar().children(rows));
  }
}
