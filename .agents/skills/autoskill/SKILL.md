---
name: autoskill
description: Use when the user asks to "learn from this session", "update skills", "remember this pattern", or after a session where corrections were given that should become durable preferences
---

# Autoskill

## Overview

Analyzes coding sessions to extract durable preferences from corrections and approvals, then proposes targeted updates to Skills that were active during the session. Acts as a learning mechanism across sessions.

## When to Use

Trigger on explicit requests:
- "autoskill", "learn from this session", "update skills from these corrections"
- "remember this pattern", "make sure you do X next time"

## When NOT to Use

- One-off corrections without "always" or "we do it this way"
- User declines skill modifications
- Contradictory signals (ask for clarification instead)

## Signal Detection

Scan the session for:

| Signal Type | Value | Examples |
|-------------|-------|----------|
| **Corrections** | Highest | "No, use X instead of Y", "We always do it this way", "Don't do X in this codebase" |
| **Repeated patterns** | High | Same feedback 2+ times, consistent naming across files |
| **Approvals** | Supporting | "Yes, that's right", "Perfect, keep doing it this way" |

**Ignore:**
- Context-specific one-offs ("use X here" without "always")
- Ambiguous feedback
- Contradictory signals

## Signal Quality Filter

Before proposing any change, ask:
1. Was this correction repeated, or stated as a general rule?
2. Would this apply to future sessions, or just this task?
3. Is it specific enough to be actionable?
4. Is this **new information** I wouldn't already know?

Only propose changes that pass all four.

### What Counts as New Information

**Worth capturing:**
- Project-specific conventions ("we use `cn()` not `clsx()` here")
- Custom component/utility locations ("buttons are in `@/components/ui`")
- Team preferences that differ from defaults
- Domain-specific terminology or patterns
- Non-obvious architectural decisions

**NOT worth capturing:**
- General best practices (DRY, separation of concerns)
- Language/framework conventions (React hooks rules, TypeScript basics)
- Common library usage (standard Tailwind, typical Next.js patterns)
- Universal security practices
- Standard accessibility guidelines

If I'd give the same advice to any project, it doesn't belong in a skill.

## Mapping Signals to Skills

- If signal relates to a Skill that was used → update that `SKILL.md`
- If 3+ related signals don't fit any active Skill → propose new Skill
- Ignore signals that don't map to any Skill used in session

## Proposing Changes

For each proposed edit:

```
File: path/to/SKILL.md
Section: [existing section or "new section: X"]
Confidence: HIGH | MEDIUM

Signal: "[exact user quote or paraphrase]"

Current text (if modifying):
> existing content

Proposed text:
> updated content

Rationale: [one sentence]
```

## Review Flow

Always present for review before applying:

```
## autoskill summary

Detected [N] durable preferences from this session.

### HIGH confidence (recommended to apply)
- [change 1]
- [change 2]

### MEDIUM confidence (review carefully)
- [change 3]

Apply high confidence changes? [y/n/selective]
```

**Wait for explicit approval before editing any file.**

## Applying Changes

When approved:
1. Edit target file with minimal, focused changes
2. If git available, commit: `chore(autoskill): [brief description]`
3. Report what was changed

## Constraints

- Never delete existing rules without explicit instruction
- Prefer additive changes over rewrites
- One concept per change (easy to revert)
- Preserve existing file structure and tone
- When uncertain, downgrade to MEDIUM and ask

## Red Flags - STOP

- Proposing changes without user approval
- Deleting rules without explicit instruction
- Adding general best practices that apply to any project
- Making changes based on one-off corrections
