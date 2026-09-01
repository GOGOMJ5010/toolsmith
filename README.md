# Toolsmith

**Make the button that isn't there.**

A website hands an AI agent a fixed set of buttons. Toolsmith lets the agent build one that's
missing — and puts you in charge of whether it keeps it.

Live demo: `<LIVE-URL>` · Built for the [OpenAI WebMCP Challenge](https://webmcp.devpost.com/)

> A note on vocabulary: the interface says **button**, because that's what it is to the person
> looking at the screen. The WebMCP spec calls the same thing a **tool**, and so does the code.

---

## The problem

An agent can only press the buttons it's given — and those were decided by whoever built the site,
months ago. When the one you need isn't there, the agent does what agents do: it guesses from the
DOM, scrapes, or hands you a snippet of Python and hopes you run it.

Adding a real one today means leaving the conversation entirely: write an MCP server, host it, edit
a config file, restart the client. Minutes to days of work, and a permanent new attack surface, for
a function you might call once.

WebMCP already moved the tool surface into the page — where the user's data and session already
live, and where a human is already watching. That's enough to close the loop without leaving.

## What Toolsmith does

```
agent: read_workbench                 → sees your actual column names
agent: forge_tool(name, schema, code) → builds the button that isn't there
 page: renders it as PENDING          → the code is on screen, editable, not registered
  you: Test run                       → press it once, on real data, before it exists
  you: Grant it                       → registerTool(tool, { signal })
agent: due_within({ days: 40 })       → runs in a sandboxed Worker, returns real rows
  you: Take it back                   → controller.abort() → gone from the registry
```

Seconds, not days. And no capability that a person didn't read first.

### The five permanent tools

| Tool | What it does |
|---|---|
| `read_workbench` | Column names, row count, sample rows — so the button fits your real data. `readOnlyHint`. |
| `forge_tool` | Builds a new button and puts it in front of a human. |
| `list_forged_tools` | Status of every button — the agent polls this to learn it was granted. |
| `revise_tool` | Fix one that threw. A granted button is **unregistered** and returns to pending. |
| `retire_tool` | Aborts that button's `AbortSignal`; it leaves `document.modelContext` immediately. |

## How WebMCP is used

This is not a wrapper around an existing app. The spec's lifecycle *is* the product.

- **`registerTool(tool, { signal })`** — every built button gets its own `AbortController`.
  Granting calls `registerTool`; taking it back calls `controller.abort()`. Unregistration isn't a
  side feature here — it's the revocation mechanism the whole safety argument rests on.
- **A genuinely dynamic tool surface**, authored at runtime by the agent talking to the page.
  `getTools()` and the `toolchange` event drive the live count in the header — that number is the
  honest answer to "what can this agent do right now?"
- **`annotations.untrustedContentHint`** on every built button: its output comes from code an agent
  wrote minutes ago, and downstream consumers are told so. **`readOnlyHint`** on the two that only read.
- **Schema round-tripping** — `forge_tool` takes the child tool's `inputSchema` as a JSON string,
  validates it, and hands it to `registerTool` as a real JSON Schema object.
- **Feature detection** — native `document.modelContext` when present (Chrome with
  `--enable-features=WebMCP`); otherwise the vendored `@mcp-b/global` polyfill. The header says which.

## A button you didn't read is not a button you granted

Self-extension is only acceptable if refusing is as cheap as granting.

- **Nothing registers before you approve.** `auto-approve` exists for demos and is off by default.
- **The code is the review.** Schema and function body on screen, editable, with a **Test run** that
  executes against your real data *before* the button exists.
- **A fresh Worker per call.** `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`,
  `importScripts`, `indexedDB`, `caches`, `localStorage`, `navigator` and `Worker` are deleted from
  the worker's global scope *before* the code is compiled. Verified: built code sees
  `typeof fetch === "undefined"`.
- **A 3-second leash.** The worker is terminated on timeout; an infinite loop returns an error to the
  agent instead of freezing the tab.
- **Editing revokes.** Changing a granted button's code unregisters it and sends it back to pending.
- **Reload revokes.** Buttons persist across reloads as *pending*, never as granted.
- **Everything is logged**, with arguments and results.

This is defence in depth, not a security boundary — a Worker shares the origin, and saying otherwise
would be a lie. It is enough friction that a button written thirty seconds ago can't quietly drain
your data while you're still reading the diff.

## Run it

Any static host. No build step, no dependencies to install — the polyfill is vendored.

```bash
git clone <this repo> && cd toolsmith
python3 -m http.server 8899
# open http://localhost:8899 in ChatGPT's browser,
# or Chrome launched with --enable-features=WebMCP
```

Then tell the agent:

> You don't have a button for this. Look at my data, then build one that returns every row due
> within N days, soonest first.

## Layout

```
index.html                     three panes: your data · buttons · activity
js/app.js                      the five tools, registration lifecycle, UI
js/sandbox.worker.js           the locked-down execution context
vendor/webmcp-global.iife.js   @mcp-b/global v5.1.0, MIT (vendored so the demo
                               never depends on a CDN staying up)
```

## Provenance

100% written during the Challenge submission period. No prior codebase was extended; `git log`
starts at the first commit of this project. The only third-party code is the vendored
`@mcp-b/global` WebMCP polyfill (MIT, license at `vendor/LICENSE.mcp-b`).

## License

MIT — see [LICENSE](LICENSE).
