# Plan in a shared file

Keep your plan in a file, not only in chat: I watch it in a side window, and it is how this session is found and resumed later.

1. Plans always live in `~/.plans/`, one file per session, whatever folder or repo you work in. Never put the plan anywhere else (not in the repo, not in a plan-mode file). Resolve the path, run:
   `echo "$HOME/.plans/${CLAUDE_CODE_SESSION_ID:-${OPENCODE_SESSION_ID:-none}}.md"`
   In OpenCode, if that prints `none.md`: your session id is the newest `id` in `opencode session list -n 1 --format json` (run in your working directory); use it in place of `none`.
   Create the folder (`mkdir -p ~/.plans`). If the file exists, it is your own plan from before: read it and continue it.
2. Write it with exactly this template (frontmatter included, keys unchanged):

```markdown
---
title: <5-8 words naming the task>
repo: <repo folder name>
folder: <absolute path of your working directory>
session: <your session id from step 1, or none>
agent: <claude-code or opencode>
terminal: <$HC_TERMINAL_ID, or none>
updated: <YYYY-MM-DD HH:MM>
---
# <title>

## Context
Why this change, what done looks like. 2-5 lines.

## Steps
- [ ] <one concrete action: file or command, what changes>
- [ ] ...

## Verification
- [ ] <command to run or thing to check, and the expected result>

## Notes
Decisions made, open questions, dead ends. Plain bullets.
```

Rules, no exceptions:
- Every action is a `- [ ]` checkbox, in Steps or Verification. No bare bullets, prose or numbered lists there. Split big actions into sub-checkboxes (indented `- [ ]`).
- Tick `- [x]` the moment a step is done, not in batches at the end. Add new steps as checkboxes when scope grows. Never delete a done step.
- Edit the file in place and bump `updated` every time you change it. Don't create a second file for the same session.
- In chat, post only a 3-5 line summary and the path, then keep working from the file.
