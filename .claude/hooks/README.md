# Hooks

Place hook scripts here and wire them up in `.claude/settings.json` (or `settings.local.json`) under the top-level `hooks` key.

## Common hook events

- `PreToolUse` — runs before a tool call; non-zero exit blocks the tool
- `PostToolUse` — runs after a tool call (e.g., auto-format after `Edit`)
- `Stop` — runs when Claude finishes a response
- `UserPromptSubmit` — runs when the user submits a prompt
- `SessionStart` — runs at session start

## Example wiring

```jsonc
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": ".claude/hooks/format-on-edit.sh" }]
      }
    ]
  }
}
```

## Suggested hooks for this project

- `format-on-edit.sh` — run Prettier/Stylus formatters on changed files after `Edit`/`Write`.
- `check-on-stop.sh` — run `pnpm check` when Claude finishes, surface type errors.
- `block-secrets.sh` — `PreToolUse` matcher for `Write|Edit`, scan content for `.env`/API keys before write.

Scripts must be executable: `chmod +x .claude/hooks/<name>.sh`.
