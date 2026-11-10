# Groups and Skills over MCP on the Cloudflare API catalog: measurements from one implementation

Draft for a progressive-disclosure-wg Discussion or a PR to `docs/experimental-findings.md`. Measured on 2026-11-07 and 2026-11-08 against #19 at `15b2a5c` and #22 at `5e9ff2f`, with a second round on 2026-11-09 that adds a server built the way #19 recommends, and a held-out task set on 2026-11-10. Code, raw answers, session files and the full tables: https://github.com/olaservo/mcp-progressive-disclosure-evals. Author: @olaservo.

## Summary

- Option 2 of #22 works as Example 3 describes it on the shipped TypeScript SDK 2.4.0. One gap is that the SDK lists every SKILL.md in `resources/list`, which the placement rule forbids once a group scopes the same URI. One sentence saying `skills/list` is not a listing for placement would close it.
- At 3,036 tools the flat `tools/list` is 1.38M tokens. `groups/list` for 139 top-level groups is 5.5k. What the model reads after picking a group, its tool schemas and the skill body, is the same at either catalog size, and schemas are most of it once a group holds more than a handful of tools.
- Groups did not measurably change what sixteen models picked for 20 indirect tasks. Each hosted model scored similarly across groups and flat modes at both catalog sizes. What groups changed is the read before the task: 3,873 tokens for 139 groups against 81,605 for 3,036 tool names with first lines, or 1.38M for the full flat `tools/list`.
- Templated group descriptions cost the mid-size open models up to 6 of 20 tasks at 139 groups. That measures the SEP's guidance on `description`, not groups.
- The `skills/list` index is a control, not a finding. Adding it moved flat scores by up to 17 of 20 and six groups-mode cells by two to six.
- Option 2 lists each workflow twice, in `groups/list` and in `skills/list`. In groups mode, five models picked the skill without its group on 2 to 4 of 20 tool tasks, and the scorer counts that correct. On a real client that path loads a SKILL.md naming tools the client was not given.
- Through Claude Code, 180 sessions: Sonnet and Opus completed 20 of 20 under groups, under the host's tool search, and with all 238 schemas in the prompt up front. Groups read 2.32M to 2.37M input tokens per model, the host's tool search 1.96M to 2.22M, and all schemas up front 16.5M to 18.4M. Groups cost one more turn and 3 to 4 seconds more per task. The prompt cache held across group opens.
- Second round: a server built the way #19 recommends (one level, groups sized to a task, task-vocabulary descriptions) closed the gap templated descriptions had opened. At 271 groups on the full catalog the open models scored 17 to 20 of 20, against 10 to 19 on 139 as-generated groups, and every hosted model scored 19 or 20. Its listing is 16.5k tokens, about a fifth of the tool-name list.
- Second round: in a client without tool search, registering a group's tools resident saved the fetch turn and cost 2.2 to 2.4 times as much, because each open rewrites the cached prefix.
- Second round: leaving grouped skills out of `skills/list` for a groups client cost no correct picks and removed the skill-only answers; listing them as well, with the new descriptions, left 7 such answers across the models that ran.
- Held-out tasks: 20 tasks written by two models the demo does not test, from a product name alone, reproduced the second round. The recommended build scored 17 to 19 of 20 for the open models and 18 to 20 for the hosted models; the as-generated build cost five open models 3 to 14 tasks. On flat tool names the hosted models scored 18 to 20 once a lookup such as `zones_list` counted as a first call, a rule decided after the results.
- Against the problem statement's four criteria: groups deliver initial context size and total tokens, leave completion unchanged for frontier models, and add a turn. On this catalog a host with tool search gets the token result. What groups add is the server-authored bundle: instructions and a skill delivered with the tools. Round one's scoped tools loaded through Claude Code's own tool search, so it showed groups composed with host tool search; the second round tests a client without it.

## Setup

One Cloudflare Worker on `@modelcontextprotocol/server` 2.4.0 served Cloudflare's API MCP server (cloudflare/mcp at `4938f2f3`) four ways. A 238-tool subset from 10 products is deployed; the full 3,036 tools from 136 products run locally. Five skills from cloudflare/skills at `1a33048` ride on the SDK's SEP-2640 extension. Groups follow the SEP at `15b2a5c`. Toolset groups mirror the generator's directory tree two levels deep, with templated descriptions ("Call the Cloudflare workers API directly. Use to read or change workers resources in an account."). Each workflow skill with API tools is also a group that scopes them and lists the SKILL.md. Tool calls were dry runs that return the request they would send. Cloudflare ships this server behind Code Mode; the flat baseline here is its `codemode=false` direct-tool mode, and groups against Code Mode was not measured.

| Variant | #22 option | Tools | Discovery | Skills |
| :-- | :-- | :-- | :-- | :-- |
| `flat` | Today, and Option 1's Skills server | All in `tools/list` | None | SEP-2640 |
| `opt1` | Option 1's Groups server | Scoped | Toolset groups, and workflow groups with authored instructions | None |
| `opt2` | Option 2, complementary | Scoped | Toolset groups, and a workflow group per skill that scopes its tools and lists the SKILL.md | SEP-2640, nothing in `resources/list` |
| `opt3` | Option 3, rename | Scoped | Option 2's bundles under the skills method names, `skills/list` and `skills/get`, with each SKILL.md folder flattened to `instructions` plus scoped resources | Replaced |

## What the code showed

Deterministic, reproduced locally, against the deployed Workers, and from a fresh clone.

- **Option 2 works as Example 3 describes.** The `turnstile-spin` group scopes the six Turnstile tools and lists `skill://turnstile-spin/SKILL.md`; `scripts/compare.ts` confirms it with `skills/get` and reads it with digests verified.
- **Placement meets the SDK's default.** The SDK's `SkillCatalog` lists every SKILL.md in `resources/list`, so a group that scopes one breaks the placement rule. A `SkillSource` without `listResources` fixes it. The SEP's placement rule names only `tools/list`, `prompts/list` and `resources/list`, so by its text `skills/list` is not a listing. What neither document says is whether a skill a group lists stays in `skills/list` for a client that also negotiated groups. Both placements are legal under the SEP, since a view may vary by negotiated extension. The skill-only picks below are the reason to test omitting it, and the next round does.
- **Scoped tools are callable without `groups/get`** and stay out of that connection's `tools/list`. A client that does not declare the extension gets every tool.
- **Option 3 flattens the skill.** When a SKILL.md folder becomes `instructions` plus scoped resources, the skill loses its entry (name, description, frontmatter), its digests, and the root that its relative `references/*.md` links resolve against. That is the concrete form of the mapping contract #22 lists as Option 3's cost.
- **Option 1's paraphrase is cheapest and is a second copy.** 2,190 task-load tokens against 8,768 for Option 2. The paraphrase is mine; it drops the skill's seven framework guides and would have to track cloudflare/skills by hand. Options 1 and 3 were compared on wire shape and tokens only. The selection and completion runs put Option 2 against flat.
- **Naming.** #22's prose says `group/list` in four places; its examples, the SEP and `docs/decisions.md` (since #23) say `groups/list`. A commenter asked about the same drift on #19 on 2026-11-09 ([comment](https://github.com/modelcontextprotocol/progressive-disclosure-wg/pull/19#issuecomment-6735714636)).

## Tokens

tiktoken `o200k_base` over compact JSON. "Upfront" is what the model reads before it commits to a task: `tools/list`, plus `groups/list` and the skill index where the variant serves them. "Task load" is `groups/get` plus the skill body, for the Turnstile, Durable Objects and email workflows.

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
- **Templated descriptions hurt the mid-size open models at 139 groups.** Qwen3 14B 18 to 13, Qwen3.6 19 to 15, the 9B 16 to 10. No single row is outside the noise on its own; the evidence is that the four mid-size open models all move the same way while the hosted models do not. The misses at 139 groups land on neighbours: `pipelines-api` for a dead-letter destination, `durable-objects` for relational tables, `iam-api` for rotating a token. The SEP says a description should carry task vocabulary; mine carry only the product name.
- **The skill index is a control.** The first run had no `skills/list` in the prompt, so a knowledge task had no non-tool answer in flat mode and two small models answered the first tool listed. Adding the index raised flat scores by up to 17 tasks (Haiku 7 and 1 of 20, against 18 and 17) and moved six groups-mode cells by two to six (Qwen 3.5 9B 10 to 16 at 13 groups; Gemini 3.8 Flash 20 to 18 at 139). Eleven tasks accept a skill, and the models take it, so a client with groups but no SEP-2640 would see a different picture from one with both.
- **Models pick the skill without the group.** Option 2 lists `turnstile-spin`, `durable-objects` and `cloudflare-email-service` in both `groups/list` and `skills/list`, and the script accepts a skill wherever its group is accepted. On tasks that need the workflow's tools, Gemini 3.8 Flash answered the skill alone on 4 of 20 at 139 groups, DeepSeek V4.1 Flash and Qwen 3.5 9B on 3, Kimi K3.1 Pro and Opus 5.5 on 2. A real Option 2 client on that path loads a SKILL.md naming tools absent from its `tools/list`, the "batteries not included" failure the SEP describes. Two ways out: the server omits grouped skills from `skills/list` for clients that negotiated groups, which the SEP allows since a view may vary by negotiated extensions, or the host opens the listing group when it loads a grouped skill.
- **Full schemas did not hurt the models that fit them.** Every such model is within two of its names-only score on the 158k-token list. The 9B drops to 9 there and to 5 on 3,036 names, where it stops answering.
- **Overlapping groups split the models.** Where a task accepts either the workflow or the product's API group, the hosted models split about evenly at 13 groups and lean to the workflow at 139. A server that offers both should say in the descriptions which to open when.
- **Classifiers route on the one-liners.** The OpenAI Decisions API over the group and skill names scored 19 and 20 for about a cent in total. Jev scored 20 and 16; its misses follow shared words.

## Task completion

The twenty tasks, reworded with concrete identifiers, ran as headless Claude Code sessions with the file and shell tools disallowed. Claude Sonnet, Haiku and Opus 5.5 ran at default effort, one session per task, 180 sessions, no errors.

| Condition | What the agent had |
| :-- | :-- |
| groups | A Claude Code mod that implements the extension against the opt2 Worker over HTTP, in the pattern the SEP's "Client behavior after `groups/get`" section sketches: `list_groups`, `open_group` and `read_skill` as client-side tools, a prompt section listing the 13 groups and 5 skills, scoped tools registered as deferred when a group opens. No MCP server connected. |
| flat, host tool search | The flat Worker as an ordinary MCP server, its 238 tools behind Claude Code's own tool search, plus the mod for the skill index. |
| flat, all schemas up front | The same with tool search off, so all 238 schemas sit in the prompt, about 305k tokens. |

"Done" is a per-task rubric over the calls made: the right tool with the right arguments, or the right skill loaded and the answer showing it. Tokens are the provider's, summed over turns, cache reads included.

| Condition | Model | Done | Median turns | Median wall s | Cost USD | Input tokens | From cache |
| :-- | :-- | --: | --: | --: | --: | --: | --: |
| groups | Sonnet 5.5 | 20/20 | 5 | 16 | 1.18 | 2.37M | 92% |
| groups | Haiku 5.5 | 16/20 | 5 | 16 | 0.09 | 2.36M | 88% |
| groups | Opus 5.5 | 20/20 | 5 | 19 | 2.66 | 2.32M | 90% |
| flat, host tool search | Sonnet 5.5 | 20/20 | 3 | 13 | 1.67 | 1.96M | 83% |
| flat, host tool search | Haiku 5.5 | 18/20 | 4 | 13 | 0.10 | 2.15M | 84% |
| flat, host tool search | Opus 5.5 | 20/20 | 4 | 16 | 3.56 | 2.22M | 84% |
| flat, all schemas up front | Sonnet 5.5 | 20/20 | 3 | 12 | 3.53 | 16.5M | 97% |
| flat, all schemas up front | Haiku 5.5 | 19/20 | 3 | 13 | 1.33 | 16.6M | 97% |
| flat, all schemas up front | Opus 5.5 | 20/20 | 3 | 15 | 7.72 | 18.4M | 97% |

- Sonnet and Opus completed every task every way. Haiku's groups misses are answers given without opening a group or reading a skill.
- Groups cost a turn and 3 to 4 seconds per task. Opening a bundle is a round trip, and 5 of the 10 product groups on the subset hold only child groups, so those tasks open two. The SEP says servers SHOULD keep hierarchies shallow and that groups pay disclosure once; the second round runs a one-level tree.
- All schemas up front reads seven to eight times the tokens of groups at three times the cost; the provider cache served 97% of that prefix. Groups read 2.32M to 2.37M input tokens per model and the host's tool search 1.96M to 2.22M; groups cost less in dollars because more of their input came from cache, 88% to 92% against 83% to 84%.
- The host's tool search does for the flat server what groups do here, one turn faster. What groups add is the bundle: instructions and a skill delivered with the tools. The mod registers a group's tools as deferred, so Claude Code loaded them through ToolSearch after each `open_group`, 19 to 21 calls per model against 16 to 19 in the tool-search arm. The run shows groups composed with host tool search; the second round tests a client without it.
- The mod reads a group's SKILL.md with `resources/read` and inlines it on open. It never calls `skills/get` and checks no digests, so the run does not exercise #22's interop rules 1 and 2, and it loads the skill on group open, which the SEP says a group fetch does not do.
- The prompt cache held across group opens: registering a group's tools as deferred added about 2.7k tokens on a 42k-token cached prefix. With tool search off, a mid-session registration rewrites the prefix.
- Three tasks need data a dry-run server cannot return (a file, key names, namespace ids). Every model took the right first step and said why it stopped, which the rubric accepts.

The sessions, reduced to their conversation rows, are in the repository under `results/traces/traces-public/` and re-score with the committed scripts.

## Limits

- One sample per task. The group names and descriptions are mine, not Cloudflare's, and templated.
- Accepted answers are my judgment and the script lists them.
- The 3,036-tool schemas (1.38M tokens) cannot be tested. Astra was skipped in the schema control group for cost reasons.
- Every server lists a `demo_info` tool first, and two small models answered it on most flat tasks until a skill answer existed in an index of skills it could read.
- The completion run is one model family on one host, with the host's user-level plugins loaded in every arm alike, and the tool-search arm is Claude Code's implementation.
- The flat baseline is a mode Cloudflare documents as an escape hatch and not the recommended way to use the server.
- Groups against Code Mode was not measured, and neither was per-caller scoping: every group answers the same to every caller.
- Selection measures the first top-level pick only. Navigation into nested groups shows only in the completion traces.
- Trial token counts are compact JSON, and generated schemas are verbose. OpenAI reported no cache hits on its calls, so the GPT-6 input counts are uncached.

## Second round, 2026-11-09

The second round tested three questions. A: does a groups server built the way #19 recommends behave differently from the as-generated one, and how do both compare with flat behind host tool search? B: what do groups cost in a client without tool search? C: does listing a grouped workflow in both `groups/list` and `skills/list` cost anything?

`opt2-rec` is the recommended build. Every group is top level. A product stays one group unless it has more than 25 tools or about 15k tokens of schemas; a larger one is split by its second-level directories, and areas under 4 tools join a `-core` group. On the subset that splits `workers` into 8 groups and `r2` into 3, for 22 groups; on the full catalog it gives 271. Product descriptions carry task vocabulary: hand-written for the subset, written by Sonnet 5.5 from each group's tool descriptions for the full catalog and spot-checked. Each workflow group's description says when to open it against the product group ("open `turnstile-api` to list or edit existing widgets"). A client that negotiated groups gets only `workers-best-practices` and `wrangler` in `skills/list`; that listing is served with `cacheScope: "private"`. The descriptions were written after round one's results, and some of the hand-written ones reuse wording from the v2 tasks. `describe-groups.ts` gave the writing model four hand-written descriptions as examples. The held-out task set below tests the recommended build on tasks written after it, by models that did not see it. The mod no longer inlines the SKILL.md on open: `read_skill` fetches the entry with `skills/get` and checks the digest, so this round exercises #22's interop rules 1 and 2. `demo_info` is gone from every server.

### Selection

The same 20 tasks, one sample. Correct picks out of 20; a DeepSeek cell is correct out of the calls its provider answered.

| What the model read | Tokens | Qwen 3.5 9B | Qwen3 14B | GLM-5.3 Flash | DeepSeek V4.1 Flash | Qwen3.6 35B-A3B | Gemma 4 26B |
| :-- | --: | --: | --: | --: | --: | --: | --: |
| As-generated, 13 groups (subset) | 616 | 17 | 16 | 19 | 18 of 19 | 19 | 19 |
| Recommended, 22 groups (subset) | 1,112 | 19 | 20 | 20 | 13 of 13 | 18 | 20 |
| Recommended, all 5 skills listed (subset) | 1,190 | 18 | 20 | 20 | 6 of 6 | 19 | 20 |
| As-generated, 139 groups (full) | 3,856 | 10 | 16 | 19 | 1 of 1 | 15 | 18 |
| Recommended, 271 groups (full) | 16,538 | 17 | 18 | 19 | 17 of 18 | 20 | 20 |
| 3,036 tool names, flat (full) | 81,586 | 6 | 40k context | 19 | 2 of 2 | 17 | 18 |

| What the model read | Opus 5.5 | Sonnet 5.5 | Haiku 5.5 | GPT-6 Astra | GPT-6.1 Sol | GPT-6.1 Terra | GPT-6 Luna | Gemini 4 Argon | Gemini 3.8 Flash | Kimi K3.1 Pro | Decisions API | Jev |
| :-- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: |
| As-generated, 13 groups (subset) | 20 | 20 | 20 | 20 | 20 | 20 | 19 | 19 | 20 | 20 | 19 | 20 |
| Recommended, 22 groups (subset) | 20 | 20 | 20 | 20 | 20 | 20 | 20 | 20 | 20 | 20 | 20 | 19 |
| Recommended, all 5 skills listed (subset) | 20 | 20 | 20 | 20 | 20 | 20 | 20 | 20 | 20 | 20 | 20 | 19 |
| As-generated, 139 groups (full) | 20 | 19 | 19 | 20 | 20 | 20 | 19 | 19 | 17 | 19 | 20 | 16 |
| Recommended, 271 groups (full) | 20 | 20 | 19 | 20 | 20 | 20 | 19 | 20 | 20 | 20 | over 255 choices | too long |
| 3,036 tool names, flat (full) | 20 | 19 | 18 | 20 | 20 | 18 | 19 | 20 | 18 | 20 | | |

- A: at the full catalog, the recommended build raised every open model that the as-generated one had cost: Qwen 3.5 9B from 10 to 17, Qwen3.6 35B-A3B from 15 to 20, Qwen3 14B from 16 to 18, Gemma from 18 to 20. Every hosted model scored 19 or 20 of 20 on it. The price is the listing: 16,538 tokens against 3,856, about a fifth of the 81,586-token name list.
- A: the misses at 271 groups are mostly one confusion, `pipelines-api` for the dead-letter destination on "the orders pipeline" (3 models); every other miss is a single model. At 139 as-generated groups the misses spread across `iam-api`, `sql-api`, `durable-objects`, `workers-best-practices` and others, as in round one.
- C: on the subset, listing every skill as well cost no correct picks: each model is within one task of itself between the two recommended arms. Skill answers on tasks that need a group fell to 0 across all models with the grouped skills left out, against 2 open-model and 5 hosted-model answers with them listed (Gemini 3.8 Flash 2, Opus, Haiku, Kimi, GLM, Qwen3.6 one each). Neither arm sent a task to `wrangler` or `workers-best-practices`. On the as-generated server the same count was 19 and 18. The arm that still lists every skill has 7, so most of the drop came with the rest of the recommended build, before the listing changed.
- The classifiers cannot take the full recommended listing. The Decisions API caps a choice list at 255 and the listing has 271 groups plus skills and none; Jev rejects the same list as too long.

### Task completion

Five conditions, three Claude models, 300 sessions, no errors. `groups-rec` is the mod against the recommended server with scoped tools deferred behind Claude Code's tool search. `groups-rec-resident` is the same with tool search off and scoped tools registered resident, as a client without tool search would. `groups` is the as-generated server, as in round one. Medians are over the 12 tasks without a workflow skill.

| Condition | Model | Done | Median turns | p50 wall s | Cost USD | Input tokens | Cache writes |
| :-- | :-- | --: | --: | --: | --: | --: | --: |
| groups-rec | Sonnet 5.5 | 20/20 | 5 | 16.6 | 1.26 | 1.59M | 244k |
| groups-rec | Opus 5.5 | 20/20 | 5 | 23.7 | 2.59 | 1.54M | 243k |
| groups-rec-resident | Sonnet 5.5 | 20/20 | 4 | 15.2 | 2.91 | 2.68M | 643k |
| groups-rec-resident | Opus 5.5 | 20/20 | 4 | 20.9 | 6.32 | 2.81M | 695k |
| groups (as-generated) | Sonnet 5.5 | 20/20 | 5 | 20.7 | 1.26 | 1.53M | 241k |
| groups (as-generated) | Opus 5.5 | 20/20 | 6 | 24.2 | 2.64 | 1.68M | 241k |
| flat, host tool search | Sonnet 5.5 | 20/20 | 4 | 15.3 | 1.72 | 1.51M | 362k |
| flat, host tool search | Opus 5.5 | 19/20 | 4 | 21.5 | 3.53 | 1.54M | 367k |

Haiku's rows and the all-schemas arm are in the full table in the repository.

- A: the recommended build halved the group opens, 0.95 per session against 1.85 to 1.90, and every other measure moved by less than the noise: the same completion, the same median turns on the 12 product tasks except Haiku and Opus at 5 against 6, and p50 wall 0.5 to 4 seconds lower. The second open in round one came from the two-level tree, and the one-level tree removes it.
- A: the host's tool search still finishes in fewer turns, a median of 3 or 4 on the product tasks against 5. The deferred recommended arm cost less, 1.26 against 1.72 USD on Sonnet and 2.59 against 3.53 on Opus, with input tokens within 15% of each other.
- B: without tool search, the prediction on turns held and the one on tokens did not. Every model took one fewer median turn on the product tasks (4 against 5) and made no ToolSearch calls. But each resident open rewrites the cached prefix: cache writes were 2.6 to 2.9 times the deferred arm's, input tokens 1.4 to 1.8 times, and cost 2.2 to 2.4 times. In the smoke run one `r2-buckets` open took the prefix from 25.7k to 48.7k tokens as the provider renders it, 23k for a group that measures 13.4k in o200k. Wall time was 0.7 to 2.8 seconds lower at p50.
- Opening a group no longer loads its skill, and Sonnet and Opus read the skill anyway: 8 of 8 workflow tasks in both recommended arms, with 8 to 10 `read_skill` calls per model. Haiku answered the two Durable Objects knowledge tasks and the fetch-handler question from its own knowledge in one turn in several groups arms, which the rubric now scores as a miss. In round one the same answers counted, because the group open had already put the SKILL.md in context.
- Every `read_skill` in round two went through `skills/get` with the digest checked; no digest failed.
- In `flat-toolsearch`, every model called ToolSearch at least once on each of the 16 tasks that need a tool, in both rounds. The sessions with no call are the three knowledge tasks, plus Sonnet on `rotate-token`, the no-fit task, which it answered correctly without a tool. On these tasks no miss came from a model failing to search.

## Held-out tasks, 2026-11-10

The v2 tasks were written by this demo's author, who had read the group descriptions. The v3 set was written by two models the demo does not test, from a product name alone, and run on the full catalog against the three servers from round two.

Fable 5.2 and Gemini 3.6 Flash each got one product at a time from a seeded draw (3 of the 10 subset products and 7 others each) and wrote a task in a developer's words without naming the product. Neither writer saw a group listing, a tool name or a description. Fable redrew six tasks that spanned products, missed their product or repeated its name, so the set is 14 Fable tasks and 6 Gemini tasks. Accepted answers were fixed before any model ran: the tools that do any step of the task, by name from the catalog, and every group whose `groups/get` subtree returns one of them. Same prompts and settings as round two, one sample.

| Model | Recommended, 271 groups | As-generated, 139 groups | Flat names, strict | Flat names, first-call rule |
| :-- | --: | --: | --: | --: |
| Qwen 3.5 9B | 17 | 3 | 15 | 15 |
| Qwen3 14B | 17 | 9 | 40k context | |
| GLM-5.3 Flash | 19 | 14 | 20 | 20 |
| DeepSeek V4.1 Flash | 19 | 18 | 20 | 20 |
| Qwen3.6 35B-A3B | 19 | 9 | 17 | 17 |
| Gemma 4 26B | 19 | 16 | 15 | 17 |
| Opus 5.5 | 20 | 19 | 15 | 19 |
| Sonnet 5.5 | 20 | 19 | 18 | 20 |
| Haiku 5.5 | 20 | 18 | 18 | 19 |
| GPT-6 Astra | 20 | 19 | 13 | 19 |
| GPT-6.1 Sol | 20 | 18 | 13 | 19 |
| GPT-6.1 Terra | 20 | 18 | 11 | 18 |
| GPT-6 Luna | 18 | 16 | 19 | 20 |
| Gemini 4 Argon | 20 | 19 | 11 | 19 |
| Gemini 3.8 Flash | 20 | 19 | 15 | 19 |
| Kimi K3.1 Pro | 20 | 20 | 18 | 19 |

- On the recommended build the open models scored 17 to 19 and the hosted models 18 to 20, close to their round-two scores on the v2 tasks. The misses are mostly one task: 5 on the private connection (`workers-vpc-api` 3, `network-api` 2).
- On the as-generated build the open models scored 3 to 18, and five of them lost 3 to 14 tasks against the recommended build. The hosted models scored 16 to 20. EU processing was missed 14 times across models and classifiers (`zones-api` 7, `dls-api` 5). Its tools sit in `addressing-api`, whose templated description names only the product. This repeats round one's finding on templated descriptions on tasks nobody tuned for, with a wider gap.
- Flat, strict: the prompt asks for the tool a model would call first, and the committed answers list only the tools that do the job. A lookup first therefore scored a miss: `zones_list` on 35 picks for tasks that name a domain, and `d1_list` on 6 picks before a query. `scripts/v3-rescore.ts` applies a first-call rule decided after the results. It also accepts any tool of a needed tool's product, as v2's product prefixes did, and `zones_list` or `zones_get` when a needed tool's path takes `{zone_id}` (9 tasks, read from the catalog). Under it the hosted models score 18 to 20 flat, against 18 to 20 on the recommended build. Groups did not measurably change what the hosted models picked.
- Writers: on the recommended build the Claude models scored 60 of 60 and the Gemini models 40 of 40, across both writers' tasks. On the as-generated build the Claude models scored 41 of 42 on Fable's tasks and 15 of 18 on Gemini's, so no arm shows a writer favouring its own family.

## What is next

1. The completion run on a second harness (such as Pi) and non-Claude models.
2. Groups against Cloudflare's own Code Mode, and tasks against a server that answers with data.
3. Per-caller scoping: a view that varies by caller, write tasks, and a rule for scoring a call to a withheld tool.

## Reproduce

`npm ci && npm run dev && npm run compare` gives the token table against localhost. `npm run select -- --replay results/<file>.jsonl` rebuilds any trial summary from the committed answers without calling a model, and `npm run trace:score -- --label traces-public` re-scores the sessions. `docs/running.md` in the repo has every command.
