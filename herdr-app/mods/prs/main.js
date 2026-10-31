// Open pull requests of several repos, grouped by repo (keys.json: "cmd-2": "mod.open:prs").
// j/k move, enter opens the PR in the browser, esc or cmd-2 again closes.

import { View, div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { exec, theme } from "herdr";

const REPOS = ["skudasov/.zed"];

async function list(repo) {
  try {
    // Through a login shell: the app may start without Homebrew on PATH.
    const r = await exec("/bin/zsh", ["-lc", 'gh "$@"', "gh", "pr", "list", "--repo", repo, "--state", "open", "--limit", "100", "--json", "number,title,author,url,isDraft"]);
    return r.code === 0 ? { repo, prs: JSON.parse(r.stdout) } : { repo, prs: [], error: r.stderr.trim() || `gh exited ${r.code}` };
  } catch (e) {
    return { repo, prs: [], error: String(e) }; // gh not installed
  }
}

export default class Prs extends View {
  init(_props, cx) {
    this.groups = null;
    this.at = 0;
    this.handle = cx.focus_handle();
    this.handle.focus();
    cx.timer.after(50, () => this.handle.focus());
    cx.spawn(async (cx) => {
      this.groups = await Promise.all(REPOS.map(list));
      cx.notify();
    });
  }

  prs() {
    return (this.groups ?? []).flatMap((g) => g.prs);
  }

  render(_cx) {
    const t = theme();
    const all = this.prs();
    const sel = all[this.at];
    const rows = [];
    if (this.groups === null) rows.push(div().text_color(t.muted).child("Loading…"));
    for (const g of this.groups ?? []) {
      rows.push(div().pt(8).font_semibold().text_color(t.foreground).child(g.repo));
      if (g.error) rows.push(div().text_color(t.blocked).child(g.error));
      else if (g.prs.length === 0) rows.push(div().text_color(t.muted).child("No open pull requests"));
      for (const pr of g.prs) {
        const on = pr === sel;
        rows.push(
          h_flex().px(8).py(3).gap(8).rounded(6).bg(on ? t.selected : t.popover)
            .child(div().flex_none().text_color(t.dim).child(`#${pr.number}`))
            .child(div().flex_1().truncate().text_color(pr.isDraft ? t.muted : t.foreground).child(pr.title))
            .child(div().flex_none().text_color(t.dim).child(pr.author?.login ?? "")),
        );
      }
    }
    return v_flex().id("prs").track_focus(this.handle).w(640).max_h(600).p(16).gap(2).bg(t.popover).text_size(13)
      .on_key_down((e, cx) => {
        const k = e.keystroke;
        if (k === "j" || k === "down") this.at = Math.min(this.at + 1, all.length - 1);
        else if (k === "k" || k === "up") this.at = Math.max(this.at - 1, 0);
        else if (k === "enter" && sel) exec("/usr/bin/open", [sel.url]);
        else return;
        cx.stop_propagation();
        cx.notify();
      })
      .child(div().text_size(15).font_semibold().text_color(t.foreground).child("Pull requests"))
      // ponytail: no scroll-to-selection; past ~25 rows the selection can leave view, add a scroll handle then.
      .child(v_flex().id("list").gap(2).overflow_y_scrollbar().children(rows));
  }
}
