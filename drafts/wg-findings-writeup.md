# Groups and Skills over MCP on the Cloudflare API catalog: measurements from one implementation

Draft for a progressive-disclosure-wg Discussion or a PR to `docs/experimental-findings.md`. Written against #19 at `15b2a5c` and #22 at `5e9ff2f`, measured on 2026-11-07 and 2026-11-08. Code, raw answers, session files and the full tables: https://github.com/olaservo/mcp-progressive-disclosure-evals. Author: @olaservo.

## Summary

- Option 2 of #22 works as Example 3 describes it on the shipped TypeScript SDK 2.4.0. One gap: the SDK lists every SKILL.md in `resources/list`, which the placement rule forbids once a group scopes the same URI. One sentence saying `skills/list` is not a listing for placement would close it.
- At 3,036 tools the flat `tools/list` is 1.38M tokens. `groups/list` for 139 top-level groups is 5.5k. Task load does not grow with the catalog, and schemas are most of it once a group holds more than a handful of tools.
- Groups did not measurably change what sixteen models picked for 20 indirect tasks. Each hosted model is within two tasks of itself across groups and flat modes at both catalog sizes, and with one run of 20 tasks per cell a gap of two is noise: a 95% interval on 19 of 20 spans 15 to 20. What groups changed is the read before the task: 3,873 tokens instead of 81,605.
- Templated group descriptions cost the mid-size open models up to 6 of 20 tasks at 139 groups. That measures the SEP's guidance on `description`, not groups.
- The `skills/list` index mattered more than groups against flat. Adding it moved flat scores by up to 17 tasks and no groups score by more than one.
- Through Claude Code, 180 sessions: Sonnet and Opus completed 20 of 20 under groups, under the host's tool search, and with all 238 schemas in the prompt up front. Groups read 2.3M input tokens per model against 16.5M to 18.4M with all schemas up front, cost one more turn, and matched the host's tool search on completion and tokens. The prompt cache held across group opens.
- Against the problem statement's four criteria: groups deliver initial context size and total tokens, leave completion unchanged for frontier models, and add a turn. On this catalog a host with tool search gets the token result with no protocol change. What groups add is the server-authored bundle, instructions and a skill with the tools, and a path for clients without tool search.

## Setup

One Cloudflare Worker on `@modelcontextprotocol/server` 2.4.0 serves Cloudflare's API MCP server (cloudflare/mcp at `4938f2f3`) four ways. A 238-tool subset from 10 products is deployed; the full 3,036 tools from 136 products run locally. Five skills from cloudflare/skills at `1a33048` ride on the SDK's SEP-2640 extension. Groups follow the SEP at `15b2a5c`. Toolset groups mirror the generator's directory tree two levels deep, with templated descriptions ("Call the Cloudflare workers API directly. Use to read or change workers resources in an account."). Each workflow skill with API tools is also a group that scopes them and lists the SKILL.md. Tool calls are dry runs that return the request they would send. Cloudflare ships this server behind Code Mode; the flat baseline here is its `codemode=false` direct-tool mode, and groups against Code Mode was not measured.

| Variant | #22 option | Tools | Discovery | Skills |
| :-- | :-- | :-- | :-- | :-- |
| `flat` | Today, and Option 1's Skills server | All in `tools/list` | None | SEP-2640 |
| `opt1` | Option 1's Groups server | Scoped | Toolset groups, and workflow groups with authored instructions | None |
| `opt2` | Option 2, complementary | Scoped | Toolset groups, and a workflow group per skill that scopes its tools and lists the SKILL.md | SEP-2640, nothing in `resources/list` |
| `opt3` | Option 3, rename | Scoped | Option 2's bundles under the skills method names, `skills/list` and `skills/get`, with each SKILL.md folder flattened to `instructions` plus scoped resources | Replaced |

## What the code showed

Deterministic, reproduced locally, against the deployed Workers, and from a fresh clone.

- **Option 2 works as Example 3 describes.** The `turnstile-spin` group scopes the six Turnstile tools and lists `skill://turnstile-spin/SKILL.md`; a host confirms it with `skills/get` and reads it with digests verified.
- **Placement meets the SDK's default.** `SkillCatalog` lists every SKILL.md in `resources/list`, so a group that scopes one breaks the placement rule. A `SkillSource` without `listResources` fixes it. Neither document says whether `skills/list` counts as a listing. Proposed sentence for both: "For placement, `skills/list` is not a listing. A skill a group lists stays in `skills/list`."
- **Scoped tools are callable without `groups/get`** and stay out of that connection's `tools/list`. A client that does not declare the extension gets every tool.
- **Option 3 flattens the skill.** When a SKILL.md folder becomes `instructions` plus scoped resources, the skill loses its entry (name, description, frontmatter), its digests, and the root that its relative `references/*.md` links resolve against. That is the concrete form of the mapping contract #22 lists as Option 3's cost.
- **Option 1's paraphrase is cheapest and drifts.** 2,190 task-load tokens against 8,768 for Option 2, and it drops the skill's seven framework guides.
- **Naming.** #22's prose and the accepted decision in `docs/decisions.md` say `group/list`; the examples and the SEP say `groups/list`.

## Tokens

tiktoken `o200k_base` over compact JSON. "Upfront" is everything read before the model commits to a task: `tools/list`, `groups/list` and the skill index. "Task load" is `groups/get` plus the skill body, for the Turnstile, Durable Objects and email workflows.

| Variant | Upfront, 238 tools | Upfront, 3,036 tools | Task load: Turnstile / DO / email |
| :-- | --: | --: | :-- |
| flat | 157,763 | 1,378,777 | 6,570 / 1,369 / 1,493 |
| opt1 | 556 | 5,308 | 2,190 / 897 / 7,822 |
| opt2 | 743 | 5,495 | 8,768 / 2,305 / 9,319 |

Option 3 is left out of the table: it measures within 100 tokens of Option 2 at every point, since it serves the same bundles under other method names. At 3,036 tools the flat list is 6.2 MB, more than any context window holds. Task load does not change with catalog size, so the saving is all in the read before the pick, and the question at scale is whether the model picks the right group out of 139. Once a group holds 20-odd tools, schemas are most of the load: the email group's 24 schemas cost `opt1` 7,822 tokens, close to the 8,768 that `opt2` spends on Turnstile, where the skill body is most of the cost.

## Selection

`scripts/select.ts` shows a model what a client sees before `groups/get` (top-level tools, `groups/list` and `skills/list` as names and first lines), gives it a task, and asks for one pick: a group, a skill, a top-level tool, or none. The flat control shows every tool's name and first line instead, with the same skill index. A `flat-schemas` mode puts the whole `tools/list` result in the prompt, 158k tokens at 238 tools.

Twenty tasks describe the job without naming the product ("Serve 50 GB of user uploads to browsers on another origin, so cross-origin headers are needed"), with confusable pairs, two knowledge questions and two with no fit in the subset. One sample per task, so a 95% interval on 19 of 20 spans 15 to 20 and two cells within two of each other are the same result. Accepted answers are in the script, including the extra products the full catalog adds and the skills a task accepts. Six open models ran through the Hugging Face router with thinking off; ten hosted models and two classifier APIs ran at their lowest reasoning setting.

| What the model read | Tokens | Qwen 3.5 9B | Qwen3 14B | GLM-5.3 Flash | DeepSeek V4.1 Flash | Qwen3.6 35B-A3B | Gemma 4 26B |
| :-- | --: | --: | --: | --: | --: | --: | --: |
| 13 groups and 5 skills | 633 | 16 | 18 | 19 | 19 | 19 | 19 |
| 139 groups and 5 skills | 3,873 | 10 | 13 | 18 | 17 | 15 | 19 |
| 238 tool names, flat | 6,911 | 15 | 19 | 18 | 20 | 19 | 19 |
| 238 tools with schemas, flat | 157,834 | 9 | 40k context | 19 | 19 | 16 | 19 |
| 3,036 tool names, flat | 81,605 | 5 | 40k context | 19 | 19 | 18 | 18 |

| What the model read | Opus 5.5 | Sonnet 5.5 | Haiku 5.5 | GPT-6 Astra | GPT-6.1 Sol | GPT-6.1 Terra | GPT-6 Luna | Gemini 4 Argon | Gemini 3.8 Flash | Kimi K3.1 Pro | Decisions API | Jev 1.14 |
| :-- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: |
| 13 groups and 5 skills | 20 | 20 | 19 | 20 | 20 | 20 | 20 | 19 | 20 | 19 | 19 | 20 |
| 139 groups and 5 skills | 20 | 19 | 19 | 20 | 20 | 19 | 18 | 19 | 18 | 18 | 20 | 16 |
| 238 tool names, flat | 20 | 20 | 18 | 20 | 20 | 18 | 20 | 20 | 20 | 20 | | |
| 238 tools with schemas, flat | 19 | 20 | 17 | not run | 18 | 19 | 20 | 20 | 19 | 18 | | |
| 3,036 tool names, flat | 20 | 20 | 17 | 19 | 18 | 17 | 20 | 20 | 20 | 20 | | |

Correct picks out of 20. Every number is a count of tasks.

- **Groups did not measurably change which product the hosted models picked.** Each is within two tasks of itself across the four modes, and the direction is mixed: at the full catalog four hosted models score higher with groups, five higher flat, one ties. With one run of 20 tasks per cell, a 95% interval on 19 of 20 spans 15 to 20, so these gaps are noise. What changed is the read before the task. This agrees with the finding the SEP already cites.
- **Templated descriptions hurt the mid-size open models at 139 groups.** Qwen3 14B 18 to 13, Qwen3.6 19 to 15, the 9B 16 to 10. No single row is outside the noise on its own; the evidence is that the four mid-size open models all move the same way while the hosted models do not. The misses land on neighbours: `pipelines-api` for a dead-letter destination, `durable-objects` for relational tables, `iam-api` for rotating a token. The SEP says a description should carry task vocabulary; these carry only the product name.
- **The skill index mattered more than groups against flat.** A first run without `skills/list` in the prompt had flat scores up to 17 tasks lower (Haiku 7 and 1 of 20, against 18 and 17 with it) and groups scores within one. Eleven tasks accept a skill, and the models take it. A client with groups but no SEP-2640 would see a different picture from one with both.
- **Full schemas did not hurt the models that fit them.** Every such model is within two of its names-only score on the 158k-token list. The 9B drops to 9 there and to 5 on 3,036 names, where it stops answering.
- **Overlapping groups split the models.** Where a task accepts either the workflow or the product's API group, the hosted models split about evenly at 13 groups and lean to the workflow at 139. A server that offers both should say in the descriptions which to open when.
- **Classifiers route on the one-liners.** The OpenAI Decisions API over the group and skill names scored 19 and 20 for about a cent in total. Jev scored 20 and 16; its misses follow shared words.

## Task completion

The twenty tasks, reworded with concrete identifiers, ran as headless Claude Code sessions with the file and shell tools disallowed. Claude Sonnet, Haiku and Opus 5.5 at default effort, one session per task, 180 sessions, no errors.

| Condition | What the agent had |
| :-- | :-- |
| groups | A Claude Code mod that speaks the extension to the opt2 Worker over HTTP, in the pattern the SEP's "Client behavior after `groups/get`" section sketches: `list_groups`, `open_group` and `read_skill` as client-side tools, a prompt section listing the 13 groups and 5 skills, scoped tools registered as deferred when a group opens. No MCP server connected. |
| flat, host tool search | The flat Worker as an ordinary MCP server, its 238 tools behind Claude Code's own tool search, plus the mod for the skill index. |
| flat, all schemas up front | The same with tool search off, so all 238 schemas sit in the prompt, about 305k tokens. |

"Done" is a per-task rubric over the calls made: the right tool with the right arguments, or the right skill loaded and the answer showing it. Tokens are the provider's, summed over turns, cache reads included.

| Condition | Model | Done | Median turns | Cost USD | Input tokens | From cache |
| :-- | :-- | --: | --: | --: | --: | --: |
| groups | Sonnet 5.5 | 20/20 | 5 | 1.18 | 2.37M | 92% |
| groups | Haiku 5.5 | 16/20 | 5 | 0.09 | 2.36M | 88% |
| groups | Opus 5.5 | 20/20 | 5 | 2.66 | 2.32M | 90% |
| flat, host tool search | Sonnet 5.5 | 20/20 | 3 | 1.67 | 1.96M | 83% |
| flat, host tool search | Haiku 5.5 | 18/20 | 4 | 0.10 | 2.15M | 84% |
| flat, host tool search | Opus 5.5 | 20/20 | 4 | 3.56 | 2.22M | 84% |
| flat, all schemas up front | Sonnet 5.5 | 20/20 | 3 | 3.53 | 16.5M | 97% |
| flat, all schemas up front | Haiku 5.5 | 19/20 | 3 | 1.33 | 16.6M | 97% |
| flat, all schemas up front | Opus 5.5 | 20/20 | 3 | 7.72 | 18.4M | 97% |

- Sonnet and Opus completed every task every way. Haiku's groups misses are answers given without opening a group or reading a skill.
- Groups cost a turn: opening a bundle is a round trip, and nested bundles sometimes cost two.
- All schemas up front reads seven to eight times the tokens of groups at three times the cost; the provider cache served 97% of that prefix. Groups and the host's tool search sit in the same 2.0M to 2.4M band.
- The host's tool search does for the flat server what groups do here, one turn faster. What groups add is the bundle, instructions and a skill delivered with the tools, and a path for clients without tool search.
- The prompt cache held across group opens: registering a group's tools as deferred added about 2.7k tokens on a 42k-token cached prefix. With tool search off, a mid-session registration rewrites the prefix.
- Three tasks need data a dry-run server cannot return (a file, key names, namespace ids). Every model took the right first step and said why it stopped, which the rubric accepts.

The sessions, reduced to their conversation rows, are in the repo under `results/traces/traces-public/` and re-score with the committed scripts.

## Limits

- One sample per task. The group names and descriptions are mine, not Cloudflare's, and templated.
- Accepted answers are my judgment; the script lists them.
- The 3,036-tool schemas (1.38M tokens) cannot be tested. Astra skipped the schema control.
- Every server lists a `demo_info` tool first, and two small models answered it on most flat tasks until a skill answer existed.
- The completion run is one model family on one host, with the host's user-level plugins loaded in every arm alike, and the tool-search arm is Claude Code's implementation.
- The flat baseline is a mode Cloudflare documents as an escape hatch; groups against Code Mode was not measured.
- Trial token counts are compact JSON, and generated schemas are verbose. OpenAI reported no cache hits on its calls, so the GPT-6 input counts are uncached.

## What is next

1. Task-vocabulary descriptions for the confusable groups and a re-run at 139, to see whether the SEP's description guidance closes the gap.
2. The completion run on a second harness (Pi) and non-Claude models.
3. Groups against Cloudflare's own Code Mode, and tasks against a server that answers with data.

## Reproduce

`npm ci && npm run dev && npm run compare` gives the token table against localhost. `npm run select -- --replay results/<file>.jsonl` rebuilds any trial summary from the committed answers without calling a model, and `npm run trace:score -- --label traces-public` re-scores the sessions. `docs/running.md` in the repo has every command.
