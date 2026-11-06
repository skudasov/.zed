// Duo: two tabs on the focused folder, Claude + OpenCode as a critic.
// OpenCode stands by with a prompt that points at Claude's transcript; a Stop hook
// on Claude (every finished answer) sends it "go". Pane ids are swapped through
// ~/.local/state/duo/<id>.oc (OpenCode's HC_TERMINAL_ID), written when its tab starts.
import { View, div } from "gpui-kit";
import { run, focused, spaces, props, closeOverlay } from "herdr";

// $1 role, $2 duo id. Runs as `zsh -c SH role id`. Both tabs start in the same folder.
const SH = String.raw`
d=$HOME/.local/state/duo; mkdir -p $d
T=$HOME/.claude/projects/$(pwd -P | sed "s/[^a-zA-Z0-9]/-/g")/$2.jsonl
if [[ $1 == claude ]]; then
  H='{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"t=$(cat '$d/$2.oc' 2>/dev/null) && hc get $t --json | grep -q name.:.opencode && hc send --if idle $t go >/dev/null 2>&1; true"}]}]}}'
  exec claude --session-id $2 --settings $H
else
  echo $HC_TERMINAL_ID > $d/$2.oc
  exec opencode --prompt "You are a critical thinking partner for another agent (Claude Code) working in this folder. Its session transcript is the JSONL file $T (read it fresh every time; it keeps growing). Do NOT edit files or run state-changing commands. Now just reply 'standing by' and wait. Each time I send 'go': read the tail of the transcript, find Claude's latest answer to the user's latest prompt, and critique it: wrong or unstated assumptions, missed alternatives, risky or unverified steps, bugs, scope creep. Verify claims against the actual code when cheap. Be concise: the top few issues, ranked, plus what you would do instead. If it is sound, say so in one line. If you see a more simple or idiomatic solution for the coding language used describe it shortly."
fi`;

export default class Duo extends View {
  init() {
    if (!props()) return; // `just herdr-app` check loads the mod with no overlay: do nothing
    const f = focused();
    const folder = f?.cwd || spaces().find((s) => s.active)?.folder;
    const space = spaces().find((s) => s.active)?.id;
    const id = crypto.randomUUID();
    for (const [name, role] of [["Claude", "claude"], ["OpenCode", "opencode"]])
      run("tab.new", { space, name, folder, argv: ["/bin/zsh", "-c", SH, "duo", role, id] });
    closeOverlay(props().overlay);
  }
  render() {
    return div();
  }
}
