# Traces with a real client: what is verified, and the plan

Companion to `methodology-review-2026-11-08.md`. Section 1 is what was checked today and where. Section 2 is the follow-up. Section 3 is what to fix before posting anything.

## 1. Verified understanding

No shipped client speaks the Groups extension. What exists:

- **The WG prototype in #20 already contains a Claude Code mod**, `examples/groups-mod` at `9554415`. It registers `list_groups` and `open_group` as plugin tools, calls `groups/list` and `groups/get` itself, registers each scoped tool mid-session with `tool.describe` answering `isDeferred: true` so the cached prefix holds, and routes scoped calls to `tools/call`. It speaks JSON-RPC to a stdio server through `$.process.run` because `$.mcp.call` only reaches tools in a server's `tools/list`. It is built against the older `contents` wrapper on `groups/get`, which the SEP dropped at `15b2a5c`, and hardcodes a stdio server path on the author's machine. It needs Claude Code 2.1.283 or later and `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`. This machine runs 2.1.319 on Node 24.19.
- **#20 also has `groups-agent`**, a bare Anthropic SDK loop with `list_groups` and `get_group` as client-side tools that surfaces scoped tools through `tool_addition` blocks in a mid-conversation system message and prints a per-turn cache report. Claude Opus 4.8, API key or Vertex.
- **Sambhav's mcp-demo** at `a980da6`, cloned to `related-work-repos/mcp-demo`, is the Skills-side counterpart. The server negotiates one tier per client: SEP-2640 methods for a client that declares or calls them, `skill://` resources otherwise, and `list_skills` / `get_skill` / `read_skill_file` as plain tools for clients known not to read resources. The `skills-mcp` mod adds a `prompt.compose` section listing the skills, polled every two seconds, and `skills-mcp-commands` turns each into a slash command. His README's harness table says none of the other harnesses implement the SEP-2640 methods and that Claude Code's native SEP-2640 client is behind a remote flag.
- **The mod API** (this build's `claude-code.d.ts`, 23,355 lines) has `$.http.fetch`, which the #20 mod did not use. It fetches through the host and returns `{ status, ok, headers, text }`. `$.process.run` is also there. `$.tool.register` plus `tool.describe` with `isDeferred` is as #20 uses it. `prompt.compose` adds a system-prompt section scoped to the session. A headless `claude -p` run loads `--plugin-dir` fresh with no hot-reload question, which is what a batch of scripted runs needs.
- **The deployed Workers answer single stateless POSTs.** Verified against `pd-groups-opt2` today: `groups/list`, `groups/get` and `tools/call` each return JSON from one POST with `content-type: application/json`, `mcp-protocol-version: 2026-07-28`, an `mcp-method` header naming the method, `mcp-name` naming the tool on `tools/call`, and a `params._meta` envelope carrying `io.modelcontextprotocol/protocolVersion` and `io.modelcontextprotocol/clientCapabilities`. No session id, no initialize. So a mod can drive the demo servers with `$.http.fetch` and nothing else.
- **Hub trace viewer.** Claude Code sessions in `~/.claude/projects` render natively on the Hub without conversion, and MCP tool calls appear in them as `tool_use` blocks named `mcp__<server>__<tool>` with their `tool_result`. Plugin tools registered by a mod appear the same way under the plugin's name. Upload is `hf upload <user>/<dataset> <dir> . --repo-type dataset`. The docs warn that session files carry paths, command output and sometimes secrets, and point at `pi-share-hf` for redaction of Pi sessions.
- **fast-agent** at `d89956d8` has a SEP-2640 client, refreshes tools on `tools/list_changed`, exports sessions as Codex-style JSONL or ATIF with `fast-agent export --hf-url`, and has `--privacy-filter`. It has no groups support and no generic raw-request API outside the skills methods. Its MCP SDK is pinned to 2.3.0. Reaching groups from fast-agent means a fork or a proxy server.
- **The WG problem statement** asks for initial context size, total tokens, end-to-end latency and task completion. The demo has the first and part of the second. A real-client run is the only way to get the other two.

Not yet checked, and added to the plan:

- **Other harnesses' extension points.** Pi has a TypeScript extension system that registers tools, and Pi sessions render natively on the Hub, so it is the second harness to try and brings non-Claude models. OpenCode plugins and goose extensions are worth the same look. Codex and Gemini CLI have no code hooks. Scan `_clients/pi-mono`, `_clients/opencode` and `_clients/goose` before step 1 of section 2.6.
- **fast-agent's capability declaration.** No per-request `clientCapabilities` code was found, so it probably never declares the Skills extension and Sambhav's server infers the tier from the `skills/list` call. Only matters if fast-agent joins later.
- **A render check.** Nobody has confirmed that a mod's plugin tools render sensibly in the Hub viewer. Upload one session to a private dataset as the first act of step 1.

## 2. The follow-up

### 2.1 Approach

Build a groups mod for Claude Code against the deployed Workers, run the 20 indirect tasks headlessly under three conditions, score from the session files, and publish the session files as a trace dataset next to the tabular one.

Why a mod and not a proxy: a proxy server exposing `open_group` as a tool and emitting `tools/list_changed` would work for any client that honours the notification, but then the scoped tools arrive through the host's ordinary MCP registration path and land in the prompt as ordinary tools. The mod can mark them deferred, which is the cache behaviour the SEP's prompt-caching section describes, and it is the pattern the SEP's "Client behavior after `groups/get`" section sketches. The proxy stays as the path for fast-agent later.

Why not reuse #20's mod as is: it targets the old `contents` shape, speaks stdio to a hardcoded path, and takes no configuration. A rewrite on `$.http.fetch` against our Workers is about the same size, follows the SEP at `15b2a5c`, and would be a reasonable contribution back to #20.

### 2.2 The mod

Folder `mods/groups/` in this repo, not in the session's dev-mods folder, loaded with `--plugin-dir`. Four files: `plugin.json` with `userConfig` for `url` (default the opt2 Worker) and `variant`, `hooks.json`, `hooks/register.ts`, `types/index.d.ts` for the state contract.

- `session.start`: register `list_groups` and `open_group`. Fetch `groups/list` once and keep it in `$.state`.
- `prompt.compose`: add one session-scoped section listing the groups as `name: description`, the same shape `select.ts` shows the model, so the two trials are comparable. Also list the skills from `skills/list` the same way, which fixes the gap the review found in the flat control.
- `tool.call` on `open_group`: `groups/get`, register each scoped tool, return the instructions and the resource list. If a resource is a `SKILL.md`, call `skills/get` and include the body in the result, since Claude Code's own SEP-2640 client is behind a flag on this build. Record what was opened in `$.state`.
- `tool.call` on a scoped tool: `tools/call` with the `mcp-name` header, result verbatim.
- `tool.describe` on a scoped tool: `isDeferred: true`.
- A `command.run` for `/groups-status` that prints what was opened and how many tokens of schemas were registered, for debugging.

All requests go through one `rpc(method, params)` helper that sets the three headers and the envelope. Validate with `claude plugin validate mods/groups`, type-check with `tsc -p mods/groups` once the engine has laid the types, and write `tests/groups.test.ts` covering the three hooks with a stubbed `$.http.fetch`.

### 2.3 Conditions

Each of the 20 `TASKS_V2` runs once per condition as `claude -p "<task>" --model <m> --permission-mode bypassPermissions --output-format json`, with a system-prompt appendix that says the tools are dry runs and the account id is `demo`, so every task can finish.

| Condition | How | What it tests |
| :-- | :-- | :-- |
| groups | `--plugin-dir mods/groups`, no MCP server configured | The SEP's path: pick a group, open it, call its tools |
| flat, all schemas | `pd-groups-flat` as an ordinary MCP server, `ENABLE_TOOL_SEARCH=false` | Every schema in the prompt, the baseline the token tables assume |
| flat, host tool search | `pd-groups-flat` as an ordinary MCP server, tool search left on | The alternative the SEP's "vs tool search" section argues against, as a host actually ships it |

Models: Opus 5.5, Sonnet 5.5, Haiku 5.5 through `--model`. That is 180 sessions. Haiku at default effort in this run also answers the review's question about whether its flat collapse was an effort-low artifact.

A fourth condition, Cloudflare's own code mode, needs their server with real auth and is out of scope for a dry-run demo. Say so in the write-up.

### 2.4 Scoring, from the session files

Read each session's JSONL. For every run record: which group was opened first and in total, which tools were called with what arguments, whether the first tool call hit the expected product, turn count, wall-clock from first to last message, `usage` per assistant turn including cache reads, and whether the run ended with an answer or an error. Task completion is a per-task rubric on the dry-run requests: the right endpoint with the required path parameters filled. Twenty rubrics, written before the runs.

Tokens here are the provider's real counts, which the review noted the tiktoken tables are not.

### 2.5 Traces dataset

Copy the 180 session files into `results/traces/<condition>/<model>/<task-slug>.jsonl`. Redact before anything leaves the machine: strip the `session-owner` line, replace the absolute working directory, grep for `sk-`, `hf_`, `Bearer`, and the `.env` path. Upload to a private dataset first, open it in the viewer, then make it public with a README in the agent-race-traces shape: the task table, a run table, the conditions, the scoring rubric, CC-BY-4.0, and the limits. Tag `agent-traces`, `mcp`. The tabular selection-trial dataset from the review goes up alongside as a second dataset, or a second config.

### 2.6 Order and effort

1. Mod, validate, test, one manual session against opt2. Half a day. **Done 2026-11-08**: `mods/groups/`, validated, two tests passing, one headless Sonnet session that opened `turnstile-api`, drilled into `turnstile-widgets` and called `turnstile_widgets_rotateSecret` correctly in 5 turns and 17 s for 0.21 USD, with the cached prefix intact across the open (2,695 new tokens on a 41,835-token read). Headless runs need `--allowedTools "mcp__groups__*"`; `--permission-mode bypassPermissions` is refused when launched from inside a Claude Code session. The render check (one session uploaded privately) is still to do and needs a go-ahead, since it sends a session file off the machine.
2. Rubrics for the 20 tasks and the scoring script over session files. Half a day. **Done 2026-11-08**: `scripts/trace-tasks.ts`, `scripts/trace-score.ts`.
3. Runs: 180 headless sessions, a few minutes each, batched by condition. An evening. Cost in the tens of dollars at Opus prices. **Done 2026-11-08**: 180 sessions, no errors, about 22 USD plus 6 USD of smoke and one contaminated start (NOTES section 10). Results in the README.
4. Redaction, upload, README. Two hours. **Redaction and README done**; `results/traces/traces-public/` holds the 180 conversation-only sessions. The Hub upload waits for a go-ahead.
5. Write-up section for the WG findings page, and an offer on #20 of the mod as an updated example.

Later, optional: a proxy server for fast-agent, so the same tasks run through GPT, Gemini and open models with ATIF export. That is the path to a multi-vendor trace set.

### To do

- **ATIF export.** Write `scripts/trace-atif.ts` that converts each redacted session into Harbor's Agent Trajectory Interchange Format (the RFC is `rfcs/0001-trajectory-format.md` in harbor-framework/harbor; fast-agent emits it with `--format atif`, Phoenix and Opik import it). One trajectory per session: metadata from the index row (condition, model, task), one step per API turn with the tool calls, results and token usage. Validate with Harbor's trajectory validator. Publish alongside the Claude Code files as a second config, so the set is usable outside Claude Code tooling.
- The sessions ship from GitHub (the repo and a release zip), not the Hub. If they go to the Hub later, open three in the trace viewer first and record whether the filtered format renders; if not, emit Pi's session format with a `harness` field.

## 3. Before publishing or sharing anything

In priority order. The first five change numbers or claims that are in the drafts now.

1. **Flat prompt without the skill index.** Add `skills/list` names and descriptions to `select.ts` flat modes and re-run the names-only modes for every model. Drop or footnote the knowledge-task row in the schema control rather than re-running it. Rewrite the "a flat tool list has no entry for a skill" sentence in the README and the #19 draft.
2. **One-task differences.** Rewrite every bullet that reads a gap of one or two as a result. Keep the differences of three or more.
3. **Option 3 identifier caveat.** In the #22 draft, state that the crash follows from reusing `io.modelcontextprotocol/skills` and that a new identifier avoids it, leaving the digests-and-root point as the one that holds regardless.
4. **Code mode.** One sentence in the #19 draft naming Cloudflare's default mode as the comparison the demo does not make, and its own table's 1.17M-token figure as corroboration of ours.
5. **`group/*` naming.** Point the #22 draft at `docs/decisions.md` as the source of the singular, so it reads as a WG inconsistency and not a nitpick.
6. **Repo public.** The drafts say "happy to share the code" and CONTRIBUTING asks for reproducibility. Make it public, or drop the offer.
7. **Split the #19 draft.** Short comment on the PR with the token table, the surviving selection results and the limits. Full write-up as a WG Discussion or a PR to `docs/experimental-findings.md`.
8. **Descriptions re-run.** Write task-vocabulary descriptions for the ten confusable toolset groups and re-run groups mode at 139 with the six open models. Report it as a before-and-after. If the drop closes, the SEP's SHOULD has evidence; if not, that is a finding too.
9. **Loose ends from NOTES.** Kill the stale `wrangler dev` listeners on 8787 to 8790. Decide on the unrestricted Gemini key. Leave Astra off the schema control and say so.
10. **Datasets.** Publish the tabular trial data with the prompt text or catalog file per row, as the review describes, so the raw answers are reusable without this repo.

Items 1 to 7 are a day. Item 8 is an evening of API calls. The trace follow-up in section 2 is independent of all of them and can be posted later as a second data point.
