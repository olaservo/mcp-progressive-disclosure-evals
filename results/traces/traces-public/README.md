# Groups positioning traces

180 Claude Code sessions in which an agent does the same 20 Cloudflare tasks three ways: through the draft MCP Groups extension, through a flat MCP server behind the host's tool search, and through the same flat server with every tool schema in the prompt. Three models: Claude Sonnet, Haiku and Opus 5.5. One session per task, model and condition. Run on 2026-11-08.

The sessions are evidence for a write-up on the Model Context Protocol working group's Groups proposal ([progressive-disclosure-wg#19](https://github.com/modelcontextprotocol/progressive-disclosure-wg/pull/19)) and its positioning against Skills over MCP ([#22](https://github.com/modelcontextprotocol/progressive-disclosure-wg/pull/22)). The code, servers and scoring are in this repository; the same files are attached as a zip to the release tagged `traces-2026-11-08`.

## What each condition is

| Folder | What the agent had |
| :-- | :-- |
| `groups/` | A Claude Code mod that speaks the Groups extension over HTTP to a server with 13 groups and 5 skills. `open_group` fetches a group and registers its tools; no MCP server is connected directly. |
| `flat-toolsearch/` | The same 238 tools served flat as an ordinary MCP server, left behind Claude Code's own tool search (the host's default for MCP tools), plus the skill index. |
| `flat-all-schemas/` | The same flat server with tool search off, so all 238 schemas sit in the prompt, about 305k tokens. |

The server is a dry run of the Cloudflare API: every tool returns the HTTP request it would send and changes nothing. Tools and skills come from [cloudflare/mcp](https://github.com/cloudflare/mcp) and [cloudflare/skills](https://github.com/cloudflare/skills).

## Files

- `<condition>/<model>--<task>.jsonl`: one session each, in Claude Code's session format reduced to its `user` and `assistant` rows. Tool calls are `tool_use` blocks named `mcp__groups__<tool>` (the mod) or `mcp__cf__<tool>` (the MCP server); results are `tool_result` blocks. Each assistant row carries the provider's usage, so token and cache numbers can be recomputed.
- `index.jsonl`: one row per session with the condition, model, task id, turns, wall time, cost and final answer.
- `summary.md`: the scored table and every call each session made, as `scripts/trace-score.ts` prints it. `npm run trace:score -- --label traces-public` regenerates it.

## Results

"Done" is a per-task rubric over the calls the session made: the right tool with the right arguments, or the right skill loaded and the answer showing it. Three tasks need data the dry-run server cannot return (a file to upload, key names, namespace ids); for those the right first step with an explanation counts.

| Condition | Sonnet 5.5 | Haiku 5.5 | Opus 5.5 | Input tokens per model | Median turns |
| :-- | --: | --: | --: | --: | --: |
| groups | 20/20 | 16/20 | 20/20 | 2.3M | 5 |
| flat-toolsearch | 20/20 | 18/20 | 20/20 | 2.0M to 2.2M | 3 to 4 |
| flat-all-schemas | 20/20 | 19/20 | 20/20 | 16.5M to 18.4M | 3 |

Sonnet and Opus completed every task under every condition. Groups cut input tokens seven to eight times against loading all schemas up front and matched the host's tool search, at one more turn. Opening a group and registering its tools as deferred definitions added about 2.7k tokens on a 42k-token cached prefix.

## What this set is not

It is evidence for one comparison, not a general dataset. One model family (Claude 5.5) on one host (Claude Code 2.1.319), so nothing here says how another model or harness would behave. The server is a dry run, so no task that needs real data can finish, and the agents' answers say so. Every session starts with the same system-prompt preamble, which tells the agent the tools are dry runs, gives it placeholder identifiers, and tells it to act rather than ask; that steering shapes what you see. The task wording and the completion rubrics are the author's, and another reader could score a session differently. One sample per task, so differences of one or two tasks between cells are noise. The host's user-level plugins and hooks were loaded in every session, the same in each condition.

## Redaction

The raw Claude Code session files carry the host's full system prompt (including the author's personal instructions file), hook output, account identifiers and local paths. This set keeps only the conversation rows, drops the fields that name the machine or the request, replaces the home directory, project path and temp paths with placeholders, and was scanned for known key and token formats before publication. Every email address in the sessions is one the model invented for a placeholder task.

## Licences

The sessions and index are CC-BY-4.0. Some tool results reproduce text from cloudflare/skills (SKILL.md bodies) and cloudflare/mcp (tool schemas), both Apache-2.0; that text keeps its licence and attribution.

## Citation

```
@misc{hungerford2026groupstraces,
  author = {Hungerford, Ola},
  title  = {Groups positioning traces: the MCP Groups extension, host tool search and all schemas up front on 20 Cloudflare tasks},
  year   = {2026},
  url    = {https://github.com/olaservo/mcp-progressive-disclosure-evals/releases/tag/traces-2026-11-08}
}
```
