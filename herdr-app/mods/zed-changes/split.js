// Unified diff lines → side-by-side rows, Zed style: context on both sides,
// a run of removed lines paired line by line with the added run after it.
// Row: { head } for hunk headers and messages, else { l, r } where each side
// is { n, text, kind: "-" | "+" | " " } or null (padding).
export function splitRows(lines) {
  const rows = [];
  let old = 0,
    next = 0,
    dels = [],
    adds = [];
  const flush = () => {
    for (let i = 0; i < Math.max(dels.length, adds.length); i++)
      rows.push({ l: dels[i] ?? null, r: adds[i] ?? null });
    dels = [];
    adds = [];
  };
  for (const line of lines) {
    const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)/.exec(line);
    if (m) {
      flush();
      old = +m[1];
      next = +m[2];
      rows.push({ head: line });
      continue;
    }
    const kind = line[0],
      text = line.slice(1);
    if (kind === "-") dels.push({ n: old++, text, kind });
    else if (kind === "+") adds.push({ n: next++, text, kind });
    else if (kind === " ") {
      flush();
      rows.push({
        l: { n: old++, text, kind },
        r: { n: next++, text, kind },
      });
    } else if (kind !== "\\") {
      // "\ No newline at end of file" is dropped; anything else is a message.
      flush();
      rows.push({ head: line });
    }
  }
  flush();
  return rows;
}
