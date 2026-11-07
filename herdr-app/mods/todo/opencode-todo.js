// OpenCode side of the todo mod: when a session goes idle with TODO.md behind the code
// (stop.zsh says why), ask it once to update TODO.md. Claude gets the same from a Stop hook.
import { execFileSync } from "node:child_process";

const STOP = new URL("./stop.zsh", import.meta.url).pathname;

export const TodoPlugin = async ({ client, directory }) => {
  const nudged = new Set(); // sessions answering our nudge: their next idle is left alone
  return {
    event: async ({ event }) => {
      if (event.type !== "session.idle") return;
      const id = event.properties.sessionID;
      if (nudged.delete(id)) return;
      const s = await client.session.get({ path: { id } }).catch(() => null);
      if (s?.data?.parentID) return; // a subagent's session
      let reason = "";
      try {
        reason = execFileSync("/bin/zsh", [STOP], { cwd: directory, encoding: "utf8" }).trim();
      } catch {}
      if (!reason) return;
      nudged.add(id);
      await client.session.promptAsync({ path: { id }, body: { parts: [{ type: "text", text: reason }] } });
    },
  };
};
