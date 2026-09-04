#!/usr/bin/env bash
#
# ai-layout.sh — create (or focus) an agent workspace for a repo: two tabs.
#
#   plan   long-lived: architecture, decisions, no code edits
#   impl   disposable: does the edits, restarted often
#
# Both tabs run the same agent. Keeping them apart means the plan conversation
# never fills up with the impl tab's tool output.
#
# Usage:
#   ai-layout.sh [agent] [dir]
#
# agent defaults to claude; dir defaults to the focused pane's cwd, then $PWD.
# The workspace is labeled "<agent>:<repo>" — re-running focuses it instead of
# creating a duplicate, so claude and opencode get one workspace each.
#
# Env:
#   AI_LAYOUT_TABS   override the tab list (default "plan impl")
set -euo pipefail

command -v herdr >/dev/null || { echo "ai-layout: herdr not on PATH" >&2; exit 1; }
command -v jq >/dev/null || { echo "ai-layout: jq not on PATH" >&2; exit 1; }

agent="${1:-claude}"
dir="${2:-}"
TABS="${AI_LAYOUT_TABS:-plan impl}"

# --- resolve the target directory ------------------------------------------
if [ -z "$dir" ]; then
	dir="$(herdr pane list 2>/dev/null |
		jq -r 'first(.result.panes[] | select(.focused) | .foreground_cwd // .cwd) // empty')"
fi
dir="${dir:-$PWD}"
[ -d "$dir" ] || { echo "ai-layout: not a directory: $dir" >&2; exit 1; }

# Prefer the repo root so both tabs start at the same place.
root="$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null || echo "$dir")"
label="$(basename "$agent"):$(basename "$root")"

# --- focus an existing workspace with this label ----------------------------
existing="$(herdr workspace list |
	jq -r --arg l "$label" 'first(.result.workspaces[] | select(.label == $l) | .workspace_id) // empty')"
if [ -n "$existing" ]; then
	herdr workspace focus "$existing" >/dev/null
	echo "ai-layout: focused existing workspace $label ($existing)"
	exit 0
fi

# --- create the workspace ---------------------------------------------------
created="$(herdr workspace create --cwd "$root" --label "$label" --no-focus)"
ws="$(jq -r '.result.workspace.workspace_id' <<<"$created")"
first_tab="$(jq -r '.result.tab.tab_id' <<<"$created")"
first_pane="$(jq -r '.result.root_pane.pane_id' <<<"$created")"

# A new workspace already has one tab; reuse it for the first entry.
first=1
for name in $TABS; do
	if [ "$first" = 1 ]; then
		herdr tab rename "$first_tab" "$name" >/dev/null
		pane="$first_pane"
		first=0
	else
		tab="$(herdr tab create --workspace "$ws" --cwd "$root" --label "$name" --no-focus)"
		pane="$(jq -r '.result.root_pane.pane_id' <<<"$tab")"
	fi
	herdr pane run "$pane" "$agent" >/dev/null
done

herdr workspace focus "$ws" >/dev/null
echo "ai-layout: created $label ($ws) at $root"
