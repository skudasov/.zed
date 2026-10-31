// Open pull requests of several repos, grouped by repo, with their checks
// (keys.json: "cmd-2": "mod.open:prs").
// j/k move, c shows the selected PR's failing checks, enter opens the PR in the
// browser, esc or cmd-2 again closes.

import { View, div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { exec, theme } from "herdr";

const REPOS = ["skudasov/.zed"];
const SHOWN = 24; // rows on screen; the list follows the selection instead of scrolling

async function list(repo) {
  try {
    // Through a login shell: the app may start without Homebrew on PATH.
    const r = await exec("/bin/zsh", ["-lc", 'gh "$@"', "gh", "pr", "list", "--repo", repo, "--state", "open", "--limit", "100",
      "--json", "number,title,author,url,isDraft,statusCheckRollup"]);
    return r.code === 0 ? { repo, prs: JSON.parse(r.stdout) } : { repo, prs: [], error: (r.stderr.trim() || `gh exited ${r.code}`).split("\n")[0] };
  } catch (e) {
    return { repo, prs: [], error: String(e) }; // gh not installed
  }
}

// statusCheckRollup holds CheckRuns (status + conclusion) and StatusContexts (state).
const PASS = new Set(["SUCCESS", "NEUTRAL", "SKIPPED"]);
const PENDING = new Set(["PENDING", "EXPECTED"]);
function checks(pr) {
  const c = { pass: 0, fail: [], pending: 0 };
  for (const x of pr.statusCheckRollup ?? []) {
    const result = x.__typename === "CheckRun" ? (x.status === "COMPLETED" ? x.conclusion : "PENDING") : x.state;
    if (PASS.has(result)) c.pass++;
    else if (PENDING.has(result)) c.pending++;
    else c.fail.push(x.workflowName ? `${x.workflowName} / ${x.name}` : (x.name ?? x.context));
  }
  return c;
}

export default class Prs extends View {
  init(_props, cx) {
    this.groups = null;
    this.at = 0;
    this.open = false; // failing checks of the selected PR shown
    this.handle = cx.focus_handle();
    this.handle.focus();
    cx.timer.after(50, () => this.handle.focus());
    cx.spawn(async (cx) => {
      this.groups = await Promise.all(REPOS.map(list));
      cx.notify();
    });
  }

  render(_cx) {
    const t = theme();
    const all = (this.groups ?? []).flatMap((g) => g.prs);
    const sel = all[this.at];
    const rows = [];
    let selRow = 0;
    if (this.groups === null) rows.push(div().text_color(t.muted).child("Loading…"));
    for (const g of this.groups ?? []) {
      rows.push(div().pt(8).font_semibold().text_color(t.foreground).child(g.repo));
      if (g.error) rows.push(div().truncate().text_color(t.blocked).child(g.error));
      else if (g.prs.length === 0) rows.push(div().text_color(t.muted).child("No open pull requests"));
      for (const pr of g.prs) {
        const on = pr === sel;
        const c = checks(pr);
        if (on) selRow = rows.length;
        rows.push(
          h_flex().px(8).py(3).gap(8).rounded(6).bg(on ? t.selected : t.popover)
            .child(div().flex_none().text_color(t.dim).child(`#${pr.number}`))
            .child(div().flex_1().truncate().text_color(pr.isDraft ? t.muted : t.foreground).child(pr.title))
            .child(div().flex_none().text_color(t.dim).child(pr.author?.login ?? ""))
            .child(h_flex().flex_none().w(110).gap(6).justify_end()
              .child(div().text_color(t.ansi2).child(`✓${c.pass}`))
              .child(div().text_color(c.fail.length ? t.ansi1 : t.dim).child(`✗${c.fail.length}`))
              .child(div().text_color(c.pending ? t.ansi3 : t.dim).child(`●${c.pending}`))),
        );
        if (on && this.open) {
          if (c.fail.length === 0) rows.push(div().pl(24).text_color(t.muted).child("No failing checks"));
          for (const name of c.fail) rows.push(div().pl(24).truncate().text_color(t.ansi1).child(`✗ ${name}`));
        }
      }
    }
    const start = Math.max(0, Math.min(selRow - 8, rows.length - SHOWN));
    return v_flex().id("prs").track_focus(this.handle).size_full().p(16).gap(2).bg(t.popover).text_size(13)
      .on_key_down((e, cx) => {
        const k = e.keystroke;
        if (k === "j" || k === "down") { this.at = Math.min(this.at + 1, all.length - 1); this.open = false; }
        else if (k === "k" || k === "up") { this.at = Math.max(this.at - 1, 0); this.open = false; }
        else if (k === "c") this.open = !this.open;
        else if (k === "enter" && sel) exec("/usr/bin/open", [sel.url]);
        else return;
        cx.stop_propagation();
        cx.notify();
      })
      .child(h_flex().items_center()
        .child(div().flex_1().text_size(15).font_semibold().text_color(t.foreground).child("Pull requests"))
        .child(div().text_size(11).text_color(t.dim).child("j/k move · c failing checks · enter open")))
      .children(rows.slice(start, start + SHOWN));
  }
}
