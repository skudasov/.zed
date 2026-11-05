// Agents' plans, one per session: ~/.plans/<session>.md, written
// from the "plan" snippet (snippets/plan.md has the template). Floats above everything, live.
// keys.json: "cmd-4": "mod.open:plan".
//   List: type to filter · j/k move · enter open · s resume its session · y copy path
//         n new plan (sends the snippet to the agent in this tab) · x archive/unarchive
//         h hide/show archived · esc close
//   Plan: s resume · y copy path · x archive · esc back
// Archived plans stay where they are (agents may still write them); which ones is kept here.
import { View, div } from "gpui-kit";
import { v_flex, h_flex, TextView } from "gpui-base";
import { exec, hc, home, spaces, terminals, agents, focused, readTextFile, run, notify, watchFolder, theme, props, closeOverlay } from "herdr";

const DIR = `${home()}/.plans`;

// Typing filters the list (shown in the header). Enter stops typing and opens the
// selected item, esc clears the filter. `own`: the list's keys, they don't start typing.
// True when the key was taken. Copied in launcher, snippets, prs, tab-jump and plan (mods can't share files).
function filterKey(s, e, own) {
  const k = e.keystroke;
  // Enter's key_char is a carriage return: only real characters type.
  const typed = e.key_char >= " " && !e.modifiers?.platform && !e.modifiers?.control ? e.key_char : "";
  if (k === "escape" && s.q) {
    s.q = "";
    s.typing = false;
  } else if (k === "enter" && s.typing) {
    s.typing = false;
    return false; // fall through: the caller's enter opens the selected item
  } else if (k === "backspace" && s.q) s.q = s.q.slice(0, -1);
  else if (typed && (s.typing || !own.includes(k))) {
    s.q = (s.q ?? "") + typed;
    s.typing = true;
  } else return false;
  s.at = 0;
  return true;
}
const matches = (q, text) => !q || text.toLowerCase().includes(q.toLowerCase());

// "---\nkey: value\n---\n" at the top → { meta, body }.
function parse(path, text) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  const meta = {};
  for (const line of (m?.[1] ?? "").split("\n")) {
    const kv = /^(\w+):\s*(.*)$/.exec(line);
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  const body = m ? text.slice(m[0].length) : text;
  return {
    path,
    meta,
    body,
    title: meta.title || /^#\s+(.+)$/m.exec(body)?.[1] || path.split("/").pop(),
    repo: meta.repo || meta.folder?.split("/").pop() || "?",
    done: (body.match(/^\s*[-*] \[[xX]\]/gm) ?? []).length,
    total: (body.match(/^\s*[-*] \[[ xX]\]/gm) ?? []).length,
  };
}

// One call: path\0text\0 per plan, newest first (zsh's om: by modification time).
async function load() {
  const r = await exec("/bin/zsh", [
    "-c",
    'mkdir -p "$1" && cd "$1" && for f in *.md(N.om); do printf "%s\\0%s\\0" "$PWD/$f" "$(<$f)"; done',
    "plan",
    DIR,
  ]);
  const parts = r.stdout.split("\0");
  const out = [];
  for (let i = 0; i + 1 < parts.length; i += 2) out.push(parse(parts[i], parts[i + 1]));
  return out;
}

// The agent in the focused tab: the focused one, else the last that changed (as zed-changes).
function target() {
  const tab = focused()?.tab;
  const here = agents().filter((a) => a.tab === tab);
  return here.find((a) => a.focused) ?? here.sort((a, b) => b.seq - a.seq)[0] ?? null;
}

// The plan snippet, pasted to that agent with enter (a busy agent queues it).
async function newPlan() {
  const agent = target();
  if (!agent) return notify({ title: "No agent in this tab", level: "warning" });
  const text = await readTextFile(`${home()}/.config/herdr-app/mods/snippets/snippets/plan.md`);
  if (!text) return notify({ title: "snippets/plan.md not installed", level: "error" });
  const r = await hc(["send", agent.address, text.trim()]);
  if (r.code !== 0) return notify({ title: "Not sent", body: (r.stderr || r.stdout).trim(), level: "error" });
  notify({ title: "Plan asked", body: agent.title || agent.address, level: "info", timeout: 3000 });
}

// localStorage can throw or come back empty; then nothing is archived.
const stored = (k, d) => {
  try {
    return JSON.parse(localStorage.getItem(k) ?? "null") ?? d;
  } catch {
    return d;
  }
};
const store = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

// How each agent resumes a session, and whether that session still exists.
const AGENTS = {
  "claude-code": {
    argv: (id) => ["claude", "--resume", id],
    exists: ["/bin/zsh", ["-c", 'ls "$HOME"/.claude/projects/*/"$1".jsonl(N) | grep -q .', "plan"]],
  },
  opencode: {
    argv: (id) => ["opencode", "--session", id],
    exists: ["/bin/zsh", ["-c", 'sqlite3 "$HOME/.local/share/opencode/opencode.db" "select 1 from session where id=\'$1\'" | grep -q 1', "plan"]],
  },
};
// opencode ids start with ses_; older plans may lack `agent`.
const agentOf = (p) => AGENTS[p.meta.agent] ?? (p.meta.session?.startsWith("ses_") ? AGENTS.opencode : AGENTS["claude-code"]);

// Its terminal if the session runs here already, else a resume in a tab of the space on that folder, else a new space.
// Closes the window once the session is shown; stays open on a warning.
async function resume(p) {
  const overlay = props().overlay; // read before the first await
  const id = p.meta.session;
  // Plans are written by agents: only plain ids reach a shell.
  if (!id || !/^[\w-]+$/.test(id) || id === "none") return notify({ title: "No session recorded in this plan", level: "warning" });
  // The terminal the plan was written from (address, agent and folder must still match:
  // addresses can be reused), or one a resume started.
  const m = p.meta;
  const open = terminals().find(
    (t) =>
      t.state === "live" &&
      ((t.address === m.terminal && t.agent === m.agent && (!m.folder || t.cwd === m.folder)) || (t.argv ?? []).includes(id)),
  );
  if (open) {
    run("agent.focus", { terminal: open.address });
    return closeOverlay(overlay);
  }
  const agent = agentOf(p);
  const [cmd, args] = agent.exists;
  const found = await exec(cmd, [...args, id]).catch(() => ({ code: 1 }));
  if (found.code !== 0) return notify({ title: "Session is gone", body: id, level: "warning" });
  const folder = p.meta.folder || undefined;
  const argv = agent.argv(id);
  const space = spaces().find((s) => !s.machine && folder && s.folder === folder);
  if (space) {
    run("space.select", { id: space.id });
    run("tab.new", { space: space.id, name: p.title, folder, argv });
  } else run("space.new", { name: p.repo, folder, tab: p.title, argv });
  closeOverlay(overlay);
}

export default class Plan extends View {
  init(_props, cx) {
    this.plans = null;
    this.at = 0;
    this.open = null; // path of the plan shown, null: the list
    this.archived = new Set(stored("archived", []));
    this.hide = stored("hide", false);
    this.handle = cx.focus_handle();
    // A window overlay does not take the keyboard by itself.
    this.handle.focus();
    cx.timer.after(50, () => this.handle.focus());
    cx.spawn(async (cx) => {
      for (;;) {
        this.plans = await load().catch((e) => (notify({ title: `Plan: can't load ${DIR}`, body: String(e), level: "error" }), []));
        cx.notify();
        await watchFolder(DIR);
      }
    });
  }

  render(_cx) {
    const t = theme();
    const arch = (p) => this.archived.has(p.path);
    // Newest first, archived ones after the rest (sort keeps mtime order inside each).
    const list = (this.plans ?? [])
      .filter((p) => !(this.hide && arch(p)) && matches(this.q, `${p.title} ${p.repo} ${p.meta.session ?? ""}`))
      .sort((a, b) => arch(a) - arch(b));
    this.at = Math.max(0, Math.min(this.at, list.length - 1));
    const shown = this.open && (this.plans ?? []).find((p) => p.path === this.open);
    const sel = shown || list[this.at];
    return v_flex()
      .id("plan")
      .track_focus(this.handle)
      .size_full()
      .p(16)
      .gap(6)
      .bg(t.popover)
      .text_size(13)
      .text_color(t.foreground)
      .on_key_down((e, cx) => {
        const k = e.keystroke;
        if (!shown && filterKey(this, e, ["j", "k", "s", "y", "n", "x", "h"]));
        else if (k === "escape") shown ? (this.open = null) : closeOverlay(props().overlay);
        else if (!shown && (k === "j" || k === "down")) this.at = Math.min(this.at + 1, list.length - 1);
        else if (!shown && (k === "k" || k === "up")) this.at = Math.max(this.at - 1, 0);
        else if (!shown && k === "enter" && sel) this.open = sel.path;
        else if (k === "s" && sel) resume(sel);
        else if (k === "y" && sel) cx.write_to_clipboard(sel.path);
        else if (k === "n") newPlan();
        else if (k === "x" && sel) {
          this.archived.has(sel.path) ? this.archived.delete(sel.path) : this.archived.add(sel.path);
          // Forget plans whose files are gone.
          const live = new Set((this.plans ?? []).map((p) => p.path));
          store("archived", [...this.archived].filter((a) => live.has(a)));
        } else if (k === "h" && !shown) store("hide", (this.hide = !this.hide));
        else return;
        cx.stop_propagation();
        cx.notify();
      })
      .child(
        h_flex()
          .gap(8)
          .child(div().text_size(15).font_semibold().truncate().child(shown ? shown.title : "Plans"))
          .child(
            div()
              .text_size(11)
              .text_color(t.muted)
              .child(shown ? `${shown.repo} · ${shown.done}/${shown.total}${arch(shown) ? " · archived" : ""} · s resume · y path · x archive · esc back`
                : `type to filter · enter open · s resume · n new · x archive · h ${this.hide ? "show" : "hide"} archived`),
          ),
      )
      .when(!shown && Boolean(this.q), (el) => el.child(div().px(8).text_color(t.muted).child(`${this.q}${this.typing ? "▏" : ""}`)))
      .child(
        shown
          ? div()
              .flex_1()
              .min_h(0)
              // Selecting text shouldn't drag the window.
              .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
              .child(TextView.markdown("plan-md", shown.body).scrollable().selectable().size_full())
          : v_flex()
              .gap(2)
              .when(this.plans === null, (el) => el.child(div().text_color(t.muted).child("Loading…")))
              .when(this.plans?.length === 0, (el) => el.child(div().text_color(t.muted).child('No plans yet — paste the "plan" snippet to an agent')))
              .children(
                list.map((p, i) =>
                  h_flex()
                    .gap(8)
                    .px(8)
                    .py(3)
                    .rounded(6)
                    .bg(i === this.at ? t.selected : t.popover)
                    .text_color(arch(p) ? t.dim : t.foreground)
                    .child(div().flex_1().truncate().child(p.title))
                    .child(div().text_color(p.total && p.done === p.total ? t.done : t.muted).child(`${p.done}/${p.total}`))
                    .child(div().text_color(t.muted).child(`${p.repo} · ${(p.meta.session ?? "—").slice(0, 8)}`)),
                ),
              ),
      );
  }
}
