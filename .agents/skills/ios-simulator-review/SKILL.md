---
name: ios-simulator-review
description: >
  Use this skill whenever the user wants to review, inspect, audit, or evaluate their iOS app running
  in the Xcode Simulator. Triggers include: design review, UI review, layout review, visual audit,
  accessibility audit, performance review, performance profiling, frame rate analysis, memory review,
  CPU analysis, or any request to "look at", "check", "evaluate", "inspect", or "analyze" an iOS app
  in the simulator. Also triggers on: "run my app in the simulator", "screenshot my app",
  "check how my app looks", "review my iOS app", "profile my app", or similar phrasings.
  Always use this skill when the user mentions Xcode Simulator + review/audit/analyze/check.
compatibility:
  required_tools:
    - bash_tool
  required_system:
    - macOS with Xcode installed (xcrun simctl must be available)
    - The app must be built and either already installed in the simulator or buildable via xcodebuild
---

# iOS Simulator Review Skill

This skill lets Claude act as a senior iOS design and performance engineer — using the Xcode Simulator
to take screenshots, record interactions, inspect layouts, and profile performance, then deliver
a structured, actionable review.

## Workflow Overview

1. **Discover** — Find booted simulators and the target app
2. **Prepare** — Ensure the app is running
3. **Capture** — Take screenshots and/or performance traces
4. **Analyze** — Review the captured data
5. **Report** — Deliver a structured review

---

## Step 1: Discover the Environment

Always start by listing available simulators:

```bash
xcrun simctl list devices --json
```

Find the booted device:
```bash
xcrun simctl list devices | grep Booted
```

If nothing is booted, boot the most appropriate device:
```bash
xcrun simctl boot "iPhone 16 Pro"
open /Applications/Xcode.app/Contents/Developer/Applications/Simulator.app/
```

List installed apps on the booted simulator to find the target:
```bash
xcrun simctl listapps booted | python3 -c "
import sys, json
data = json.load(sys.stdin)
for bid, info in data.items():
    print(bid, '-', info.get('CFBundleDisplayName', info.get('CFBundleName', '?')))
" 2>/dev/null || xcrun simctl listapps booted
```

---

## Step 2: Prepare the App

**If the app is already installed and running**, skip to Step 3.

**If you have the bundle ID**, launch it:
```bash
xcrun simctl launch booted <BUNDLE_ID>
sleep 2  # Give it time to render
```

**If you need to build first**, ask the user for the project path and scheme, then:
```bash
xcodebuild build \
  -project <PROJECT.xcodeproj> \
  -scheme <SCHEME> \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro' \
  -derivedDataPath /tmp/sim-review-build \
  | tail -5

APP_PATH=$(find /tmp/sim-review-build -name "*.app" -not -path "*/PlugIns/*" | head -1)
xcrun simctl install booted "$APP_PATH"
xcrun simctl launch booted <BUNDLE_ID>
sleep 2
```

---

## Step 3a: Design Review Capture

For a **design review**, take screenshots across multiple states/screens. Read `references/design-review.md` for the full checklist and evaluation criteria.

### Screenshot capture
```bash
REVIEW_DIR="/tmp/ios-review-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$REVIEW_DIR"

# Take screenshot of current state
xcrun simctl io booted screenshot "$REVIEW_DIR/screen-$(date +%s).png"
```

### Navigate between screens
Use `xcrun simctl io` for touch simulation or `xcrun simctl openurl` for deep links:
```bash
# Deep link to a specific screen
xcrun simctl openurl booted "yourapp://screen/settings"
sleep 1
xcrun simctl io booted screenshot "$REVIEW_DIR/settings.png"
```

### Check dark mode
```bash
xcrun simctl ui booted appearance dark
sleep 1
xcrun simctl io booted screenshot "$REVIEW_DIR/screen-dark.png"

xcrun simctl ui booted appearance light
sleep 1
xcrun simctl io booted screenshot "$REVIEW_DIR/screen-light.png"
```

### Check Dynamic Type sizes
```bash
# Set largest accessibility text size
xcrun simctl ui booted content_size accessibility5
sleep 1
xcrun simctl io booted screenshot "$REVIEW_DIR/large-text.png"

# Reset to default
xcrun simctl ui booted content_size default
```

### Check landscape orientation
```bash
# Rotate to landscape (use simctl or trigger from app)
xcrun simctl io booted screenshot "$REVIEW_DIR/portrait.png"
```

After capturing, use the `view` tool to display each PNG image so Claude can visually analyze it.

---

## Step 3b: Performance Review Capture

For a **performance review**, use `xctrace` (Xcode 12+) to record a trace. Read `references/performance-review.md` for interpretation guidance.

### Record a performance trace
```bash
TRACE_PATH="/tmp/ios-perf-$(date +%Y%m%d-%H%M%S).trace"

# Record 15 seconds of Time Profiler + Display (frame rate)
xcrun xctrace record \
  --device booted \
  --template 'Time Profiler' \
  --time-limit 15s \
  --output "$TRACE_PATH" \
  --launch -- <BUNDLE_ID>

echo "Trace saved to: $TRACE_PATH"
```

### Export trace data to parseable format
```bash
# Export table of contents
xcrun xctrace export --input "$TRACE_PATH" --toc

# Export Time Profiler samples
xcrun xctrace export \
  --input "$TRACE_PATH" \
  --xpath '/trace-toc/run[@number="1"]/data/table[@schema="time-profile"]' \
  --output "$TRACE_PATH.xml" 2>/dev/null || echo "Use Instruments GUI to open $TRACE_PATH"
```

### Quick CPU/Memory snapshot (no trace needed)
```bash
# Get memory usage of the app process
BUNDLE_ID="<BUNDLE_ID>"
PID=$(xcrun simctl spawn booted launchctl list | grep "$BUNDLE_ID" | awk '{print $1}' | head -1)

if [ -n "$PID" ] && [ "$PID" != "-" ]; then
  ps -o pid,rss,%cpu,command -p "$PID"
fi

# Alternatively use the diagnostics log
xcrun simctl diagnose -b "$BUNDLE_ID" -l --output /tmp/ios-diagnostics/ 2>/dev/null
```

### Frame rate check via display perf template
```bash
xcrun xctrace record \
  --device booted \
  --template 'Animation Hitches' \
  --time-limit 10s \
  --output "/tmp/frame-rate.trace" \
  --attach <BUNDLE_ID>
```

---

## Step 4: Analyze

### Design Review
After capturing screenshots, use the `view` tool on each PNG to see the images, then evaluate against the checklist in `references/design-review.md`.

### Performance Review
Parse the exported XML or read the trace summary, then evaluate against the thresholds in `references/performance-review.md`.

---

## Step 5: Generate the Report

Structure all reviews as:

```
# iOS [Design / Performance] Review — <App Name>
**Device:** <simulator name + iOS version>
**Date:** <today>

## Executive Summary
<2-3 sentence overall verdict>

## Findings
### 🔴 Critical Issues
### 🟡 Warnings  
### 🟢 Passing

## Recommendations
<Prioritized, actionable list>

## Screenshots / Evidence
<Reference captured files>
```

Save the report:
```bash
cat > "$REVIEW_DIR/review-report.md" << 'EOF'
<report content>
EOF
```

Then present it with `present_files`.

---

## Useful Utility Commands

```bash
# Status bar override for clean screenshots
xcrun simctl status_bar booted override \
  --time "9:41" \
  --dataNetwork wifi \
  --wifiMode active \
  --wifiBars 3 \
  --cellularMode active \
  --cellularBars 4 \
  --batteryState charged \
  --batteryLevel 100

# Reset status bar
xcrun simctl status_bar booted clear

# Grant permissions (avoid permission dialogs interrupting review)
xcrun simctl privacy booted grant all <BUNDLE_ID>

# Trigger memory warning
xcrun simctl io booted memory_warning

# Simulate push notification
xcrun simctl push booted <BUNDLE_ID> /path/to/notification.apns

# Get app container path (for reading logs/databases)
xcrun simctl get_app_container booted <BUNDLE_ID> data
```

---

## Common Issues & Fixes

| Problem | Fix |
|---|---|
| "No booted devices" | `xcrun simctl boot "iPhone 16 Pro"` then open Simulator.app |
| App not installed | Build with xcodebuild or drag .app into Simulator |
| `xctrace` not found | Requires Xcode 12+; check `xcode-select -p` points to full Xcode |
| Screenshot is black | App may be in background; use `xcrun simctl launch booted <BUNDLE_ID>` first |
| Privacy permission dialogs block review | Use `xcrun simctl privacy booted grant all <BUNDLE_ID>` |
| Build fails | Ask user for correct scheme name; check with `xcodebuild -list` |

---

## References

- `references/design-review.md` — Full design review checklist (typography, spacing, color, accessibility, layout)
- `references/performance-review.md` — Performance thresholds, metrics, and interpretation guide
