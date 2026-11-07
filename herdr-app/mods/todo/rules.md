# TODO.md

Your working directory has a TODO.md: the short, current plan for this work. Keep it true at all times, in every mode. In plan mode, write the plan as the same list of actions, and put it in TODO.md as soon as you can edit files.

Format, exactly:

```markdown
# <name of the module or component>

<2-5 short paragraphs: the main idea, what it does and why. No implementation details, no file lists.>

## TODO
- [ ] <one concrete action>
- [x] <a finished action>
```

Rules:
- Every plan you make is a list of actions, and those actions are the TODO list. No prose or numbered steps for the plan itself. Split big actions into indented `- [ ]` sub-actions.
- Tick `- [x]` as soon as an action is done. Add new actions when scope grows. Never delete done actions. Rewrite the idea paragraphs only when the idea changes.
- Keep it short: TODO.md is a snapshot of where things stand, not a log.
- If TODO.md still has the `<name>` / `<idea>` placeholders, fill them in from the user's first request.
