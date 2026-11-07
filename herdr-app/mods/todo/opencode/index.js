// OpenCode 2.x side of the todo mod (a plugin must be a folder with a default {id, setup}).
// When a turn ends with TODO.md behind the code (stop.zsh says why), ask once to update it.
// OpenCode 1.x loads ../opencode-todo.js instead; Claude gets the same from a Stop hook.
import { execFileSync } from "node:child_process";

const STOP = new URL("../stop.zsh", import.meta.url).pathname;

export default {
  id: "todo",
  setup(ctx) {
    const nudged = new Set(); // sessions answering our nudge: that turn's end is left alone
    const stop = new AbortController();
    (async () => {
      for await (const e of ctx.event.subscribe({ types: ["session.execution.succeeded"], signal: stop.signal })) {
        const sessionID = e.data?.sessionID;
        if (!sessionID || nudged.delete(sessionID)) continue;
        const s = await ctx.session.get({ sessionID }).catch(() => null);
        if (s?.parentID) continue; // a subagent's session
        let text = "";
        try {
          text = execFileSync("/bin/zsh", [STOP], { cwd: e.location?.directory ?? ctx.location.directory, encoding: "utf8" }).trim();
        } catch {}
        if (!text) continue;
        nudged.add(sessionID);
        ctx.session.prompt({ sessionID, text }).catch(() => nudged.delete(sessionID));
      }
    })();
    return () => stop.abort();
  },
};
