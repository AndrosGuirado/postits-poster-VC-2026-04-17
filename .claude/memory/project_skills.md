---
name: Skills setup
description: FL skill bundles (general, automation, design) installed at .agents/skills with Claude Code symlinks.
type: project
---

The FL skill suite is installed in this project via `npx skills@latest add B-Reel-US/claude-fl-general/<bundle>/skills`. Bundles installed on 2026-05-04:

- **fl-general** (6): `brand-strategy-agent`, `identity`, `team`, `visual`, `voice`, `ways-of-working`
- **fl-automation** (4): `autoskill`, `cmux`, `notebooklm`, `webmcp`
- **fl-design** (8): `accessibility`, `awwwards-animations`, `awwwards-landing-page`, `creative-director`, `design-taste-frontend`, `ios-design`, `ios-simulator-review`, `ux-design`

Lockfile: `skills-lock.json`. Skills live under `.agents/skills/<name>` with symlinks for Claude Code.

**Why:** These are the studio-shared skills the user expects to be available; future sessions should know they exist before suggesting alternatives.

**How to apply:** Prefer invoking these skills (via the Skill tool) when their domain matches the task — e.g., `awwwards-animations` for motion work, `accessibility` for a11y audits, `creative-director` for design-direction tasks. Re-run the install commands to update.
