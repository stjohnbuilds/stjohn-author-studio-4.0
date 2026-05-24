# `dev/active/` — Three-file pattern for big tasks (bible Step 5)

Any time the user asks for a non-trivial feature, refactor, or fix that
spans more than one or two files, create a folder here:

```
dev/active/<task-name>/
  <task-name>-plan.md      the full agreed plan
  <task-name>-context.md   key files, decisions, notes
  <task-name>-tasks.md     checklist of every step
```

Update all three as you work. When context is running low, update them
before you compact.

When finished, move the sub-folder to `dev/archived/<task-name>/` and
mark the matching `TODO.md` row complete.
