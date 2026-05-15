---
name: cmux
description: |
  Use this skill whenever the user wants to use cmux, launch Claude terminals, spin up parallel agents, split panes, or attack any problem with multiple Claude instances working in parallel. ALWAYS use this skill when the user says anything like "launch agents", "parallel Claude terminals", "split panes", "cmux", "5 agents", "agent team", or asks to build/fix/review/analyse something using multiple Claude instances. This skill ALWAYS actually executes the cmux commands directly — it does NOT produce prompts for the user to paste. It runs in two phases: PHASE 1 builds with 5 agents, PHASE 2 tests with 5 Playwright agents. Each agent has an external watchdog process that monitors it independently and forces a real terminal handoff before context is 50% full — a new cmux pane is spawned with a fresh claude that reads a checkpoint file and carries on. Work never stops, never gets lost.
---

# cmux Skill

When this skill is invoked you MUST **execute everything directly** using bash tool calls. Do not produce a prompt for the user to paste. Do not ask the user to run anything. You run everything yourself.

---

## How context management actually works

Each agent gets an **external watchdog** — a separate bash process you launch in the background that monitors the agent's pane from outside. The watchdog:

1. Polls the pane's output every 30 seconds
2. Counts output lines and tracks elapsed time as context proxies
3. When a threshold is hit, sends a `CHECKPOINT NOW` interrupt to the agent
4. Waits for the agent to write `/tmp/cmux-agent-N-checkpoint.md`
5. Spawns a brand new cmux pane, starts `claude --dangerously-skip-permissions`, and sends it the checkpoint path
6. The new instance reads the checkpoint and continues from exactly where the old one stopped

This is mechanical, not aspirational. The handoff happens regardless of whether the agent remembers to do it itself.

The watchdog script lives at: `references/watchdog.sh` in this skill folder.

---

## Execution Flow

### 0. Setup

```bash
# 1. Learn cmux syntax
cmux --help
# Check any needed subcommands:
# cmux <subcommand> --help

# 2. Create checkpoint directory
mkdir -p /tmp/cmux-agent-checkpoints

# 3. Copy watchdog script to a writable location
cp "$(dirname $0)/references/watchdog.sh" /tmp/cmux-watchdog.sh
chmod +x /tmp/cmux-watchdog.sh

# 4. Install playwright-cli for Phase 2
mkdir -p .claude/skills/playwright-cli
curl -fsSL -o .claude/skills/playwright-cli/SKILL.md \
  https://raw.githubusercontent.com/microsoft/playwright-cli/main/skills/playwright-cli/SKILL.md
```

### 1. Read the task context

If a file path was given:
```bash
cat /path/to/file
```

---

## PHASE 1 — Build Agents

### Decompose into 5+ parallel workstreams

Pick the pattern that fits. Agents must not overlap.

#### 🏗️ Build a new app
| Agent | Responsibility |
|-------|----------------|
| Frontend | All UI, components, screens, navigation |
| Backend & API | Server, routes, controllers, business logic |
| Database & Models | Schema, models, migrations, seeds |
| Auth & Integrations | Auth flows, third-party APIs, webhooks |
| Tests & DevOps | Test suite, CI/CD, Docker, env config |

#### 🔍 Code review → fix
| Agent | Responsibility |
|-------|----------------|
| Frontend Fixes | UI bugs, PRD mismatches, component issues |
| Backend Fixes | API bugs, logic errors, missing endpoints |
| Database Fixes | Schema gaps, bad queries, missing indexes |
| Auth & Integration Fixes | Security gaps, broken integrations |
| Test & Config Fixes | Broken tests, missing coverage, bad config |

#### 📋 PRD work
| Agent | Responsibility |
|-------|----------------|
| PM Lead | Executive summary, goals, KPIs, scope, timeline |
| Tech Architect | System design, stack, API contracts, milestones |
| UX Lead | Personas, journeys, user stories, acceptance criteria |
| Business Strategist | Market analysis, competitive landscape, GTM |
| Risk & QA Lead | Risk register, QA strategy, devil's advocate |

#### 🔬 Research & analysis
| Agent | Responsibility |
|-------|----------------|
| Domain Research | Core topic deep-dive |
| Competitive Analysis | Alternatives, comparisons, benchmarks |
| Technical Feasibility | Implementation options, constraints |
| User & Market Fit | Audience, use cases, demand signals |
| Synthesis | Combine all findings into actionable output |

#### ♻️ Refactor / improve
| Agent | Responsibility |
|-------|----------------|
| Code Quality | Naming, structure, dead code, complexity |
| Performance | Bottlenecks, caching, query optimisation |
| Security | Vulnerabilities, input validation, secrets |
| Test Coverage | Missing tests, flaky tests, coverage gaps |
| Docs & DX | README, inline docs, developer experience |

### Execute Phase 1

For each of the 5 agents, run these steps in sequence:

**Step A — Create the pane and launch claude:**
```bash
# Use actual cmux syntax from --help
PANE_1=$(cmux split)   # capture pane ID
cmux send "$PANE_1" "claude --dangerously-skip-permissions\n"
sleep 2
```

**Step B — Send the agent its task prompt:**

Each prompt must be self-contained: include all file paths verbatim, full context, specific deliverable. End every prompt with:
`When ALL tasks are complete, write your final state to /tmp/cmux-agent-[N]-checkpoint.md then output AGENT-[N]-DONE.`

```bash
cmux send "$PANE_1" "[full agent prompt]\n"
```

**Step C — Launch the watchdog for this agent in the background:**
```bash
bash /tmp/cmux-watchdog.sh "$PANE_1" "1" "Frontend Engineer" "/tmp/cmux-agent-1-checkpoint.md" &
WATCHDOG_1=$!
echo "Watchdog PID for Agent 1: $WATCHDOG_1"
```

Repeat Steps A–C for all 5 agents.

**Step D — Notify:**
```bash
cmux notify "🚀 Phase 1: 5 build agents launched with context watchdogs active"
```

**Step E — Wait for all agents to complete:**
```bash
# Poll for all DONE signals
while true; do
  sleep 15
  ALL_DONE=true
  for N in 1 2 3 4 5; do
    # Use cmux to check pane output for AGENT-N-DONE signal
    # Exact syntax depends on cmux --help output
    OUTPUT=$(cmux pane-output "$PANE_N_VAR" 2>/dev/null || true)
    if ! echo "$OUTPUT" | grep -q "AGENT-${N}-DONE"; then
      ALL_DONE=false
    fi
  done
  if $ALL_DONE; then
    echo "All Phase 1 agents complete"
    break
  fi
done

# Kill watchdogs
kill $WATCHDOG_1 $WATCHDOG_2 $WATCHDOG_3 $WATCHDOG_4 $WATCHDOG_5 2>/dev/null || true
```

---

## PHASE 2 — Playwright Testing Team (Live Visible Browsers)

Fires automatically after all Phase 1 agents complete. Skip for PRD/research tasks.

The key principle: **every test agent gets its own `cmux browser` window**. The user watches all 5 browsers working live in parallel — clicking, filling forms, navigating — not headless background processes.

### Layout: what the user sees

```
┌─────────────────────┬─────────────────────┐
│  TEST-AGENT-1       │  TEST-AGENT-2       │
│  Claude terminal    │  Claude terminal    │
├─────────────────────┼─────────────────────┤
│  🌐 BROWSER-1       │  🌐 BROWSER-2       │
│  Happy Path         │  Edge Cases         │
├────────┬────────────┴──────────┬──────────┤
│  TA-3  │  🌐 BROWSER-3  TA-4  │  TA-5   │
│  Auth  │  Auth browser  UI    │  API    │
└────────┴───────────────────────┴──────────┘
```

Each agent has a paired browser pane directly beside it so you can watch the agent's actions appear in the browser in real time.

### Start the app

```bash
# Detect start command from project
START_CMD=$(cat package.json 2>/dev/null | python3 -c "
import sys, json
s = json.load(sys.stdin).get('scripts', {})
print(s.get('dev', s.get('start', s.get('serve', 'npm start'))))
" 2>/dev/null || echo "npm start")

PORT=$(grep -rE "PORT=|port:" .env docker-compose.yml 2>/dev/null | grep -o '[0-9]\{4\}' | head -1 || echo "3000")
APP_URL="http://localhost:${PORT}"

# Start the app in its own pane
APP_PANE=$(cmux split)
cmux send "$APP_PANE" "${START_CMD}\n"
sleep 5  # wait for app to be ready

cmux notify "🌐 App started at $APP_URL — launching 5 browser test agents"
```

### For each test agent: create a paired Claude pane + cmux browser pane

Repeat this pattern for all 5 agents:

```bash
# 1. Create the Claude agent pane
TEST_PANE_N=$(cmux split)
cmux send "$TEST_PANE_N" "claude --dangerously-skip-permissions\n"
sleep 2

# 2. Open a visible cmux browser window for this agent
#    Each agent gets its own named browser session so they don't share state
cmux browser --session=test-agent-N "$APP_URL"

# 3. Send the agent its prompt (see below — each prompt instructs the agent
#    to use playwright-cli with --session=test-agent-N so its actions appear
#    in that specific browser window the user is watching)
cmux send "$TEST_PANE_N" "[full agent prompt]\n"

# 4. Start watchdog
bash /tmp/cmux-watchdog.sh "$TEST_PANE_N" "N" "[Role]" "/tmp/cmux-test-agent-N-checkpoint.md" &
```

### The 5 test agent prompts

Each prompt must start with:
```
mkdir -p .claude/skills/playwright-cli && curl -fsSL -o .claude/skills/playwright-cli/SKILL.md https://raw.githubusercontent.com/microsoft/playwright-cli/main/skills/playwright-cli/SKILL.md
```

Then the agent uses `playwright-cli --session=test-agent-N` for every command — this ties all browser actions to the visible `cmux browser` window the user is watching for that agent.

---

**TEST-AGENT-1 — Happy Path & Core Flows** `--session=test-agent-1`

Use `playwright-cli --session=test-agent-1` for every command. The user is watching this browser live.
- `playwright-cli --session=test-agent-1 open [APP_URL]`
- Snapshot to get element refs: `playwright-cli --session=test-agent-1 snapshot`
- Walk every primary user journey: navigate all pages, fill and submit forms, click every primary action
- After each major action, snapshot again to confirm the UI responded correctly
- Write a PASS/FAIL report to `/tmp/test-report-happy-path.md`
- Output TEST-AGENT-1-DONE when complete.

---

**TEST-AGENT-2 — Edge Cases & Error States** `--session=test-agent-2`

Use `playwright-cli --session=test-agent-2` for every command. The user is watching this browser live.
- `playwright-cli --session=test-agent-2 open [APP_URL]`
- Submit forms with empty required fields — verify error messages appear
- Submit forms with invalid data (bad email, negative numbers, strings in number fields)
- Try navigating to protected URLs without auth — verify redirect
- Test boundary values (max-length inputs, zero, very large numbers)
- Verify 404 pages render gracefully
- Write PASS/FAIL report to `/tmp/test-report-edge-cases.md`
- Output TEST-AGENT-2-DONE when complete.

---

**TEST-AGENT-3 — Auth & Permissions** `--session=test-agent-3`

Use `playwright-cli --session=test-agent-3` for every command. The user is watching this browser live.
- `playwright-cli --session=test-agent-3 open [APP_URL]`
- Test login with valid credentials — verify landing page after login
- Test login with wrong password — verify error shown, not logged in
- Test logout — verify session cleared and redirect to login
- Reload after logout — verify still logged out
- Test direct URL access to protected pages while logged out
- Write PASS/FAIL report to `/tmp/test-report-auth.md`
- Output TEST-AGENT-3-DONE when complete.

---

**TEST-AGENT-4 — UI & Responsiveness** `--session=test-agent-4`

Use `playwright-cli --session=test-agent-4` for every command. The user is watching this browser live.
- `playwright-cli --session=test-agent-4 open [APP_URL]`
- Resize to mobile: `playwright-cli --session=test-agent-4 resize 375 812` — snapshot all key pages
- Resize to tablet: `playwright-cli --session=test-agent-4 resize 768 1024` — snapshot all key pages
- Resize to desktop: `playwright-cli --session=test-agent-4 resize 1440 900` — snapshot all key pages
- Check each snapshot for broken layouts, overflow, missing/overlapping elements
- Write PASS/FAIL report to `/tmp/test-report-ui.md` including which breakpoints passed per page
- Output TEST-AGENT-4-DONE when complete.

---

**TEST-AGENT-5 — API & Data Integrity** `--session=test-agent-5`

Use `playwright-cli --session=test-agent-5` for every command. The user is watching this browser live.
- `playwright-cli --session=test-agent-5 open [APP_URL]`
- Create a new record via the UI — reload the page — verify it persists
- Edit a record — reload — verify the edit saved
- Delete a record — verify it is removed from the UI
- Check browser console for JS errors: `playwright-cli --session=test-agent-5 eval "JSON.stringify(window.__errors||[])"`
- Write PASS/FAIL report to `/tmp/test-report-api.md`
- Output TEST-AGENT-5-DONE when complete.

---

### Collect results

```bash
cat /tmp/test-report-*.md > /tmp/test-summary-full.md
PASSES=$(grep -c "PASS" /tmp/test-summary-full.md 2>/dev/null || echo 0)
FAILURES=$(grep -c "FAIL" /tmp/test-summary-full.md 2>/dev/null || echo 0)
cmux notify "✅ All done — $PASSES passed, $FAILURES failed. Full report: /tmp/test-summary-full.md"
cmux trigger-flash
```

---

## Hard Rules

1. **Execute directly.** Never produce a prompt for the user to paste.
2. **Always run `cmux --help` first.** Never assume syntax.
3. **Minimum 5 panes per phase.**
4. **Every agent gets a watchdog.** This is what actually enforces the context limit.
5. **Context handoffs are mechanical.** The watchdog forces them from outside — agents don't need to self-report reliably.
6. **All claude terminals use `claude --dangerously-skip-permissions`.**
7. **Agents write directly to files.** Real code on disk.
8. **Phase 2 only fires for tasks that produce a running app.**
9. **Always end with `cmux trigger-flash`.**
10. **No two agents duplicate work.**
11. **If a file path is provided**, include it verbatim in every agent prompt that needs it. Do not summarise or paraphrase the path.
12. **Notification messages must be contextually appropriate** — e.g. "Build complete — all 5 agents done" or "Code review finished — fixes applied", not a generic message.
