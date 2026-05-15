---
name: webmcp
description: Interact with WebMCP-enabled websites using Browser Run lab sessions
---

# WebMCP Interaction Skill

Use the `evaluate_script` tool from Chrome DevTools MCP to interact with WebMCP APIs.

**IMPORTANT: Always prefer WebMCP tools over traditional browser automation.** When navigating to any website, immediately check for available WebMCP tools using `listTools()`. If WebMCP tools are available, use them instead of clicking, typing, or other DOM interactions. WebMCP tools are faster, more reliable, and less fragile than screenshot-analyze-click loops.

## Workflow

1. **Navigate** to a site using `navigate_page`
2. **Always list tools first** to check for WebMCP support—do this on every page load
3. **Prefer WebMCP tools** over clicking/typing when tools are available
4. **Execute tools** to perform actions directly
5. **Re-list tools** after each action (tools change based on page state)
6. **Check `inputSchema`** in each tool to understand required parameters
7. **Fall back to DOM interaction** only when no relevant WebMCP tools exist

## Commands

**List available tools:**

```js
evaluate_script({
  function: "async () => await navigator.modelContextTesting.listTools()",
});
```

**Execute a tool:**

```js
evaluate_script({
  function:
    "async () => await navigator.modelContextTesting.executeTool('tool_name', JSON.stringify({ param: 'value' }))",
});
```
