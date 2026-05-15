# Claude Code Harness — Postits

This folder configures the Claude Code harness for the project. It is checked into git so the team shares the same setup.

## Layout

```
.claude/
├── README.md                # this file
├── settings.json            # shared permissions, env, hooks (create from settings.example.json)
├── settings.local.json      # personal overrides (gitignored by convention)
├── commands/                # custom slash commands — invoked as /<filename-without-md>
│   ├── dev.md
│   ├── check.md
│   ├── build.md
│   ├── preview.md
│   └── skills-sync.md
├── agents/                  # custom subagents — invoked via the Agent tool
│   └── svelte-three-reviewer.md
├── hooks/                   # hook scripts wired up in settings.json
│   └── README.md
└── memory/                  # project-scoped persistent memory
    ├── MEMORY.md
    └── *.md
```

## Setup

1. Copy `settings.example.json` → `settings.json` (or merge into your existing one). The example is not auto-applied because permission grants require explicit user review.
2. `pnpm install`
3. Run `/skills-sync` (or the three `npx skills add` commands) to install the FL skill bundles.

## Slash commands

| Command | What it does |
|---|---|
| `/dev` | Start Vite dev server |
| `/check` | Run `pnpm check` (svelte-check + tsc) |
| `/build` | Production build |
| `/preview` | Preview production build |
| `/skills-sync` | Reinstall FL skill bundles |

## Agents

- **svelte-three-reviewer** — code review focused on Svelte 5 runes, Three.js render-loop hygiene, GSAP cleanup, and Tweakpane gating.

## Memory

`.claude/memory/MEMORY.md` is the index. Each entry points to a file with frontmatter (`name`, `description`, `type` ∈ {user, feedback, project, reference}). See `memory/MEMORY.md` for current entries.

## Skills

Installed under `.agents/skills/` (see `skills-lock.json`). FL bundles: `fl-general`, `fl-automation`, `fl-design`. Restart the session after installing new skills.
