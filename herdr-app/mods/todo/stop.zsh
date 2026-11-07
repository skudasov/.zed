#!/bin/zsh
# Is ./TODO.md behind the code? Prints why (the first changed file newer than it, or that
# it's missing), nothing when it's current. Git: modified and untracked files, not ignored.
# `stop.zsh claude`: Claude's Stop hook (JSON on stdin), blocks the stop once with the reason.
if [[ $1 == claude ]]; then
  grep -qE '"stop_hook_active": ?true' && exit 0
fi
if [[ ! -e TODO.md ]]; then
  reason="TODO.md is missing: create it (idea, then the TODO actions), then stop."
else
  if git rev-parse 2>/dev/null; then files=(${(f)"$(git ls-files -mo --exclude-standard)"})
  else files=(**/*(N.)) # ponytail: walks the whole tree outside git; fine for project folders
  fi
  for f in $files; [[ $f != TODO.md && $f -nt TODO.md ]] && break || f=
  [[ -z $f ]] && exit 0
  reason="${f//\"/} changed after TODO.md: update TODO.md now (tick done actions, add new ones, keep the idea short), then stop."
fi
if [[ $1 == claude ]]; then print -r -- "{\"decision\":\"block\",\"reason\":\"$reason\"}"; else print -r -- $reason; fi
