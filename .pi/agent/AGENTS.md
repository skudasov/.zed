# Global AGENTS.md

## Working style
- Be concise and practical.
- Prefer small, local, low-risk changes.
- Explain planned changes briefly before large edits.
- Preserve existing code style unless asked to refactor.

## Safety
- Ask before destructive or irreversible actions.
- Avoid changing secrets, credentials, or environment files unless explicitly requested.
- Avoid editing generated files directly unless the user asks for it.

## Quality
- When changing code, run the smallest relevant validation if practical.
- Prefer root-cause fixes over superficial patches.
- Call out risks, assumptions, and skipped validation clearly.

## Tool use
- Prefer read/search before editing.
- Prefer precise edits over full rewrites.
- Use bash for inspection, tests, and project-local automation.
