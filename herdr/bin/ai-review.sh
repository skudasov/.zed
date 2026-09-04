#!/usr/bin/env bash
#
# ai-review.sh — open a fresh review agent in a "review:<repo>" workspace.
#
# A reviewer with an empty context catches what the author's context is blind
# to, so this always starts a new agent rather than reusing the impl one.
#
#   ai-review.sh diff [agent] [dir]   review this branch: merge-base(default)..HEAD
#   ai-review.sh pr   [agent] [dir]   pick one of the repo's open PRs, review it
#
# agent defaults to claude; dir defaults to the focused pane's cwd, then $PWD.
# Repo and PR list come from the git remote in that directory (via gh).
set -euo pipefail

command -v herdr >/dev/null || { echo "ai-review: herdr not on PATH" >&2; exit 1; }
command -v jq >/dev/null || { echo "ai-review: jq not on PATH" >&2; exit 1; }

# --- internal: runs inside the review pane, where there is a tty -------------
# ai-review.sh __pick <agent> <pane_id> <root>
if [ "${1:-}" = "__pick" ]; then
	agent="$2"; pane="$3"; root="$4"
	command -v gh >/dev/null || { echo "ai-review: gh not on PATH" >&2; exec "$SHELL"; }
	command -v fzf >/dev/null || { echo "ai-review: fzf not on PATH" >&2; exec "$SHELL"; }

	cd "$root"
	line="$(gh pr list --limit 50 \
		--json number,title,author,headRefName \
		--template '{{range .}}{{printf "%v\t%s\t%s\t%s\n" .number .title .author.login .headRefName}}{{end}}' |
		fzf --delimiter='\t' --with-nth=1,2,3 --prompt='review PR > ' --height=100% --border || true)"
	num="$(cut -f1 <<<"$line")"
	[ -n "$num" ] || { echo "ai-review: no PR selected"; exec "$SHELL"; }

	if [ "$(basename "$agent")" = "claude" ]; then
		prompt="/code-review $num"
	else
		prompt="Review pull request #$num of this repo. Start by running: gh pr diff $num. Report correctness bugs first, then simplifications. Do not edit any files."
	fi

	# Send the prompt once the agent has booted; exec the agent into this pane.
	(
		herdr agent wait "$pane" --status idle --timeout 60000 >/dev/null 2>&1 || sleep 5
		herdr pane rename "$pane" "pr-$num" >/dev/null 2>&1 || true
		herdr pane run "$pane" "$prompt" >/dev/null
	) &
	exec "$agent"
fi

mode="${1:-diff}"
agent="${2:-claude}"
dir="${3:-}"

# --- resolve repo ------------------------------------------------------------
if [ -z "$dir" ]; then
	dir="$(herdr pane list 2>/dev/null |
		jq -r 'first(.result.panes[] | select(.focused) | .foreground_cwd // .cwd) // empty')"
fi
dir="${dir:-$PWD}"
root="$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$root" ] || { echo "ai-review: not a git repo: $dir" >&2; exit 1; }
label="review:$(basename "$root")"

# --- find or create the review workspace ------------------------------------
ws="$(herdr workspace list |
	jq -r --arg l "$label" 'first(.result.workspaces[] | select(.label == $l) | .workspace_id) // empty')"

# Sets $ws (creating the workspace on first use) and $pane. Not a subshell: the
# caller needs the workspace id it creates.
new_tab() { # new_tab <name>
	local name="$1" out
	if [ -z "$ws" ]; then
		out="$(herdr workspace create --cwd "$root" --label "$label" --no-focus)"
		ws="$(jq -r '.result.workspace.workspace_id' <<<"$out")"
		herdr tab rename "$(jq -r '.result.tab.tab_id' <<<"$out")" "$name" >/dev/null
	else
		out="$(herdr tab create --workspace "$ws" --cwd "$root" --label "$name" --no-focus)"
	fi
	pane="$(jq -r '.result.root_pane.pane_id' <<<"$out")"
}

case "$mode" in
diff)
	# Default branch, then the point this branch left it.
	base_ref="$(git -C "$root" symbolic-ref --quiet refs/remotes/origin/HEAD 2>/dev/null |
		sed 's#^refs/remotes/##' || true)"
	if [ -z "$base_ref" ]; then
		for c in origin/main origin/master main master; do
			git -C "$root" rev-parse --verify --quiet "$c" >/dev/null && { base_ref="$c"; break; }
		done
	fi
	[ -n "$base_ref" ] || { echo "ai-review: no default branch found" >&2; exit 1; }

	base="$(git -C "$root" merge-base HEAD "$base_ref" 2>/dev/null || true)"
	head="$(git -C "$root" rev-parse HEAD)"
	if [ -z "$base" ] || [ "$base" = "$head" ]; then
		# On the default branch itself: review the last commit instead.
		base="$(git -C "$root" rev-parse HEAD~1 2>/dev/null || true)"
		[ -n "$base" ] || { echo "ai-review: nothing to review" >&2; exit 1; }
	fi
	short="$(git -C "$root" rev-parse --short "$base")"

	if [ "$(basename "$agent")" = "claude" ]; then
		prompt="/code-review $short"
	else
		prompt="Review the changes on this branch. Start by running: git diff $short...HEAD. Report correctness bugs first, then simplifications. Do not edit any files."
	fi

	new_tab diff
	herdr pane run "$pane" "$agent" >/dev/null
	herdr workspace focus "$ws" >/dev/null
	herdr agent wait "$pane" --status idle --timeout 60000 >/dev/null 2>&1 || sleep 5
	herdr pane run "$pane" "$prompt" >/dev/null
	echo "ai-review: reviewing $short...HEAD in $label ($pane)"
	;;
pr)
	command -v gh >/dev/null || { echo "ai-review: gh not on PATH" >&2; exit 1; }
	command -v fzf >/dev/null || { echo "ai-review: fzf not on PATH" >&2; exit 1; }
	self="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
	new_tab pr
	herdr workspace focus "$ws" >/dev/null
	herdr pane run "$pane" "$self __pick $agent $pane $root" >/dev/null
	echo "ai-review: pick a PR in $label ($pane)"
	;;
*)
	echo "ai-review: unknown mode: $mode (want diff or pr)" >&2
	exit 1
	;;
esac
