# Trace sessions, second round: the recommended groups server, a client without tool search, host tool search and all schemas up front

300 Claude Code sessions in which an agent does the same 20 Cloudflare tasks five ways. Three models: Claude Sonnet, Haiku and Opus 5.5. One session per task, model and condition. Run on 2026-11-09. The first round's 180 sessions are in `../traces-public/`.

The sessions are evidence for a write-up on the Model Context Protocol working group's Groups proposal ([progressive-disclosure-wg#19](https://github.com/modelcontextprotocol/progressive-disclosure-wg/pull/19)) and its positioning against Skills over MCP ([#22](https://github.com/modelcontextprotocol/progressive-disclosure-wg/pull/22)). The code, servers and scoring are in this repository.

## What each condition is

| Folder | What the agent had |
| :-- | :-- |
| `groups-rec/` | A Claude Code mod that implements the Groups extension over HTTP to a server rebuilt to the guidance in #19: 22 one-level groups with task-vocabulary descriptions, and the 2 skills no group lists. A group's tools are registered deferred, behind Claude Code's tool search. |
| `groups-rec-resident/` | The same with Claude Code's tool search off and a group's tools registered into the prompt's tool list, as a client without tool search would. |
| `groups/` | The mod against the first round's server: 13 groups mirroring the generator's directory tree two levels deep, templated descriptions, all 5 skills listed. |
| `flat-toolsearch/` | The 237 tools served flat as an ordinary MCP server, behind Claude Code's tool search, plus the skill index. |
| `flat-all-schemas/` | The same flat server with tool search off, so every schema sits in the prompt. |

In every condition, opening a group returns the group's instructions, its tools and the URI of any skill it lists; `read_skill` loads a skill through `skills/get` and checks its digest. The server is a dry run of the Cloudflare API: every tool returns the HTTP request it would send and changes nothing. Tools and skills come from [cloudflare/mcp](https://github.com/cloudflare/mcp) and [cloudflare/skills](https://github.com/cloudflare/skills).

## Files

- `<condition>/<model>--<task>.jsonl`: one session each, in Claude Code's session format reduced to its `user` and `assistant` rows. Tool calls are `tool_use` blocks named `mcp__groups__<tool>` (the mod) or `mcp__cf__<tool>` (the MCP server); results are `tool_result` blocks. Each assistant row carries the provider's usage, so token and cache numbers can be recomputed.
- `<condition>/<model>--<task>.groups.jsonl`: the mod's log of every group the session opened, with the tool count and whether the tools were registered deferred. Absent where the session opened none.
- `index.jsonl`: one row per session with the condition, mod version, model, task id, turns, wall time, cost and final answer.
- `summary.md`: the scored tables and every call each session made, as `scripts/trace-score.ts` prints them. `npm run trace:score -- --label traces2-public` regenerates it.

## Results

"Done" is a per-task rubric over the calls the session made: the right tool with the right arguments, or the right skill read and the answer showing it. Three tasks need data the dry-run server cannot return (a file to upload, key names, namespace ids); for those the right first step with an explanation counts.

| Condition | Haiku 5.5 | Sonnet 5.5 | Opus 5.5 | Input tokens per model | Median turns, 12 product tasks |
| :-- | --: | --: | --: | --: | --: |
| groups-rec | 17/20 | 20/20 | 20/20 | 1.54M to 1.75M | 5 |
| groups-rec-resident | 16/20 | 20/20 | 20/20 | 2.51M to 2.81M | 4 |
| groups | 18/20 | 20/20 | 20/20 | 1.53M to 1.93M | 5 to 6 |
| flat-toolsearch | 20/20 | 20/20 | 19/20 | 1.51M to 1.60M | 3 to 4 |
| flat-all-schemas | 20/20 | 20/20 | 20/20 | 15.9M to 17.4M | 3 |

## What this set is not

It is evidence for one comparison, not a general dataset. One model family (Claude 5.5) on one host (Claude Code 2.1.319), so nothing here says how another model or harness would behave. The server is a dry run, so no task that needs real data can finish, and the agents' answers say so. Every session starts with the same system-prompt preamble, which tells the agent the tools are dry runs, gives it placeholder identifiers, and tells it to act rather than ask; that steering shapes what you see. The task wording and the completion rubrics are the author's, and another reader could score a session differently. One sample per task, so differences of one or two tasks between cells are noise. The host's user-level plugins and hooks were loaded in every session, the same in each condition. Sessions for different conditions and models ran side by side, so their wall times share the same API load.

## Redaction

The raw Claude Code session files carry the host's full system prompt (including the author's personal instructions file), hook output, account identifiers and local paths. This set keeps only the conversation rows, drops the fields that name the machine or the request, replaces the home directory, project path and temp paths with placeholders, and was scanned for known key and token formats before publication. The group-open logs carry only group names, counts, timestamps and the public server URL.

## Licenses

The sessions and index are CC-BY-4.0. Some tool results reproduce text from cloudflare/skills (SKILL.md bodies) and cloudflare/mcp (tool schemas), both Apache-2.0; that text keeps its licence and attribution.
