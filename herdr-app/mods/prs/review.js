// AI review of a PR, two picker steps inside the PRs dialog: agent, then prompt preset.
// Prompts live in ./prompts/*.md (copied from herdr/review-prompts) with {{var}} placeholders.
// Launch: new tab running the agent, prompt handed over as its first message.

import { div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { exec, run } from "herdr";

const AGENTS = ["claude", "opencode"];
const sh = (script, ...args) => exec("/bin/zsh", ["-lc", script, "zsh", ...args]);

// One call: name\0text\0 per preset, read from the installed mod (just herdr-app copies mods there).
async function loadPresets() {
  const r = await sh(
    'cd "$HOME/.config/herdr-app/mods/prs/prompts" && for f in *.md; do printf "%s\\0%s\\0" "${f%.md}" "$(<$f)"; done',
  );
  const parts = r.stdout.split("\0");
  const out = [];
  for (let i = 0; i + 1 < parts.length; i += 2) out.push({ name: parts[i], text: parts[i + 1] });
  return out;
}

// Same vars as herdr/bin/ai-review.ts. herdr pane run presses Enter, so newlines become spaces.
function render(text, pr, failed) {
  const vars = {
    ref: `${pr.repo}#${pr.number}`,
    number: String(pr.number),
    repo: pr.repo,
    title: pr.title,
    url: pr.url,
    draft: pr.isDraft ? "yes" : "no",
    failedChecks: failed.join(", ") || "none",
  };
  return text
    .replace(/\{\{(\w+)\}\}/g, (m, k) => vars[k] ?? m)
    .replace(/\s*\n\s*/g, " ")
    .trim();
}

// The app's own tab.new: argv starts the agent, task is its first message.
// (The herdr CLI talks to the TUI server, not this app.)
// task is appended as a positional arg; opencode reads that as a project dir, so it gets --prompt.
const launch = (agent, prompt, name) =>
  run(
    "tab.new",
    agent === "opencode"
      ? { name, argv: [agent, "--prompt", prompt] }
      : { name, argv: [agent], task: prompt },
  );

// State: { pr, failed, agent, presets, at }. Picking the agent first, then the preset.
export function startReview(pr, failed, cx) {
  const s = { pr, failed, agent: null, presets: null, at: 0 };
  cx.spawn(async (cx) => {
    s.presets = await loadPresets().catch(() => []);
    cx.notify();
  });
  return s;
}

const items = (s) => (s.agent ? (s.presets ?? []).map((p) => p.name) : AGENTS);

// Returns the next state: same object, null to go back to the PR list, or "done" after launching.
export function reviewKey(s, k) {
  const n = items(s).length;
  if (k === "j" || k === "down") s.at = Math.min(s.at + 1, n - 1);
  else if (k === "k" || k === "up") s.at = Math.max(s.at - 1, 0);
  else if (k === "escape") {
    if (!s.agent) return null;
    s.agent = null;
    s.at = 0;
  } else if (k === "enter" && n) {
    if (!s.agent) {
      s.agent = AGENTS[s.at];
      s.at = 0;
    } else {
      const p = s.presets[s.at];
      launch(s.agent, render(p.text, s.pr, s.failed), `#${s.pr.number} ${s.pr.title}`.slice(0, 48));
      return "done";
    }
  }
  return s;
}

export function reviewView(s, t) {
  const list = items(s);
  return v_flex()
    .gap(2)
    .child(
      h_flex()
        .pb(8)
        .child(
          div()
            .flex_1()
            .truncate()
            .text_size(15)
            .font_semibold()
            .text_color(t.foreground)
            .child(`Review #${s.pr.number}${s.agent ? ` with ${s.agent}` : ""}`),
        )
        .child(div().text_size(11).text_color(t.dim).child("j/k move · enter pick · esc back")),
    )
    .child(div().text_color(t.muted).child(s.agent ? "Prompt" : "Agent"))
    .when(s.agent && s.presets === null, (el) => el.child(div().text_color(t.muted).child("Loading…")))
    .children(
      list.map((name, i) =>
        div()
          .px(8)
          .py(3)
          .rounded(6)
          .bg(i === s.at ? t.selected : t.popover)
          .text_color(t.foreground)
          .child(name),
      ),
    );
}
