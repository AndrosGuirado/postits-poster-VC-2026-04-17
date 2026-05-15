---
description: Reinstall the FL skill bundles from B-Reel-US/claude-fl-general
---

Run, in order:

1. `npx skills@latest add B-Reel-US/claude-fl-general/fl-general/skills -y`
2. `npx skills@latest add B-Reel-US/claude-fl-general/fl-automation/skills -y`
3. `npx skills@latest add B-Reel-US/claude-fl-general/fl-design/skills -y`

Report which skills were updated vs. unchanged based on the installer output. Remind the user to restart the session for newly added skills to load.
