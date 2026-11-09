# Groups and Skills over MCP on the Cloudflare API catalog: measurements from one implementation

Draft for a progressive-disclosure-wg Discussion or a PR to `docs/experimental-findings.md`. Written against #19 at `15b2a5c` and #22 at `5e9ff2f`. Measured on 2026-11-07 and 2026-11-08. Code, deployed servers, raw answers and session files: https://github.com/olaservo/mcp-progressive-disclosure-evals. Author: @olaservo.

## Summary

- Option 2 of #22 works as Example 3 describes it, on the shipped TypeScript SDK 2.4.0. A group named after the skill scopes its tools and lists the SKILL.md, and the host still verifies the skill through `skills/get` and `resources/read`. One gap: the SDK's skill catalog lists every SKILL.md in `resources/list`, which the SEP's placement rule forbids once a group scopes the same URI. One sentence saying `skills/list` is not a listing for placement would close it.
- At the full 3,036-tool catalog, the flat `tools/list` is 1.38M tokens. `groups/list` for 139 top-level groups is 5.5k. Task load does not grow with the catalog, and tool schemas are most of it once a group holds more than a handful of tools.
- In a selection trial over 20 indirect tasks, groups did not change which product ten hosted models picked. Each model is within two tasks of itself across groups and flat modes at both catalog sizes. What groups changed is the read before the task: 3,873 tokens instead of 81,605 at 3,036 tools.
- Templated descriptions for 139 groups cost the mid-size open models up to 6 of 20 tasks. The descriptions ignore the SEP's guidance that `description` carry task vocabulary, so this measures that guidance rather than groups.
- The `skills/list` index mattered more than groups against flat. Adding it to the prompt moved flat scores by up to 17 tasks and moved no groups-mode score by more than one.
- Through a real client (Claude Code with a groups mod, 180 headless sessions), Sonnet and Opus completed 20 of 20 tasks under groups, under the flat server with the host's tool search, and under the flat server with all 238 schemas in the prompt up front. Groups read 2.3M input tokens per model against 16.5M to 18.4M with all schemas up front, cost one more turn, and matched the host's tool search on completion and tokens. The prompt cache held across group opens.
- Against the problem statement's four criteria: groups deliver initial context size and total tokens, leave task completion unchanged for frontier models, and add a turn. On this catalog the host's tool search reaches the same token result with no protocol change. What groups add is the server-authored bundle and a path for clients without tool search.
- Under Option 3's rename, a SKILL.md body delivered as `instructions` loses its entry, its digests and the root for relative links. Under the existing Skills identifier it also crashes the SDK's SEP-2640 client.

## What was built

One Cloudflare Worker on `@modelcontextprotocol/server` 2.4.0, with one wrangler environment per positioning option, so the options can be compared side by side on the same catalog.

- Tools: generated tools from cloudflare/mcp at `4938f2f3`. A 238-tool subset from 10 products (turnstile, durableObjects, emailSending, emailRouting, workers, d1, kv, r2, queues, containers) is deployed. The full 3,036 tools in 1,030 toolsets from 136 products run locally. Cloudflare ships this server behind Code Mode by default (`docs`, `search` and `execute`, about 1,100 tokens) and exposes direct tools only with `?codemode=false`, which its README calls an escape hatch for composing with another code-mode system. The flat baseline here is that direct-tool mode. Cloudflare's README puts the full-schema direct list at 1,170,523 tokens for 2,594 tools, which agrees with the 1,378,777 measured here for 3,036. Groups against Code Mode itself was not measured.
- Skills: `turnstile-spin`, `durable-objects`, `cloudflare-email-service`, `workers-best-practices` and `wrangler` from cloudflare/skills at `1a33048`, served through the SDK's native SEP-2640 extension.
- Groups: `io.modelcontextprotocol/groups`, `groups/list` and `groups/get` as the SEP at `15b2a5c` defines them. Scoped primitives sit directly on the result, an unknown group gets `-32002`, per-request client capabilities decide the view, and a client that did not negotiate gets the flat `tools/list`. Toolset groups follow the generator's directory tree two levels deep (`workers-api` nests `workers-scripts`, `workers-routes` and so on). Their descriptions are templated: "Call the Cloudflare workers API directly. Use to read or change workers resources in an account." Product groups end in `-api` because a workflow group is already called `durable-objects`.
- Tool calls are dry runs. They return the Cloudflare API request the tool would send.

| Variant | #22 option | Tools | Discovery | Skills |
| :-- | :-- | :-- | :-- | :-- |
| `flat` | Today, and Option 1's Skills server | All in `tools/list` | None | SEP-2640 |
| `opt1` | Option 1's Groups server | Scoped | Toolset groups, and workflow groups with authored instructions | None |
| `opt2` | Option 2, complementary | Scoped | Toolset groups, and a workflow group per skill that scopes its tools and lists the SKILL.md in `resources` | SEP-2640, with nothing in `resources/list` |
| `opt3` | Option 3, Groups renamed to Skills | Scoped | `skills/list` and `skills/get` under `io.modelcontextprotocol/skills`; each SKILL.md folder maps to its body as `instructions` and its other files as scoped `skill://` resources | Replaced |

## Code-level findings

These are deterministic. They reproduced locally, against the deployed Workers, and from a fresh clone.

- **Option 2 works as Example 3 describes.** The `turnstile-spin` group scopes the six Turnstile tools and lists `skill://turnstile-spin/SKILL.md`. A host that confirms the reference with `skills/get` reads the skill with its digests verified.
- **The placement rule meets the SDK's default.** The SDK's `SkillCatalog` lists every SKILL.md in `resources/list`. Once a group scopes the same URI, the placement rule breaks. A `SkillSource` with no `listResources` serves the same entries through `skills/list` only, and the rule holds. Neither #19 nor #22 says whether `skills/list` counts as a listing for placement. Proposed sentence for both: "For placement, `skills/list` is not a listing. A skill a group lists stays in `skills/list`." The rule's view qualifier matters: a client that negotiated neither extension finds skills through `resources/list`, and the SDK cannot yet list a SKILL.md in one view and not the other.
- **Scoped tools are callable without `groups/get`**, and they stay out of that connection's `tools/list`. Checked with a dry run of `turnstile_widgets_create` on a fresh connection.
- **Graceful degradation works through per-request capabilities.** A client that does not put the extension in `io.modelcontextprotocol/clientCapabilities` gets every tool on every variant.
- **Option 3.** This demo serves the rename under the existing `io.modelcontextprotocol/skills` identifier, and the SDK 2.4.0 `SkillsClient` rejects the listing ("skills/list returned invalid entries", each entry missing `uri`, `frontmatter` and `resources`). #22 does not say which identifier the rename would use. Under a new one, which the SEP's Backward Compatibility section asks of a breaking change, a SEP-2640 client would see a server with no skills rather than crash. Either way the SKILL.md body arrives as `instructions` with no skill entry and no digests, and its seven `references/*.md` links resolve to scoped resources only if the host assumes `skill://turnstile-spin/` as their base, which the response does not say. "Group instructions without a skill" in #22 already says this; the demo shows it is what a client sees.
- **Option 1's paraphrase is cheapest and drifts.** Its instructions are a short restatement of the skill, 2,190 task-load tokens against 8,768 for Option 2. The paraphrase drops the skill's seven framework guides, and a host that also connects the Skills server has no way to match the group to its skill.
- **Naming.** #22's background and capability table say `group/list` and `group/get`. The examples and the SEP's Naming section say `groups/*`. The accepted decision in `docs/decisions.md` (2026-10-27) has the singular. The SEP and the decision log disagree.

## Token measurements

tiktoken `o200k_base` over the compact JSON the model would see, not a provider's tool prompt. "Upfront" is everything read before the model commits to a task: `tools/list`, `groups/list` and the skill index. "Task load" is `groups/get` plus the skill body. One task per workflow skill with API tools. In `flat`, task tools are counted by product prefix, so email shows 41 where the workflow group curates 24.

Subset, 238 tools, 13 top-level groups, deployed Workers:

| Variant | Task | Upfront | Task load | Task tools |
| :-- | :-- | --: | --: | --: |
| flat | set up Turnstile | 157,763 | 6,570 | 6 |
| flat | inspect Durable Objects | 157,763 | 1,369 | 3 |
| flat | configure email | 157,763 | 1,493 | 41 |
| opt1 | set up Turnstile | 556 | 2,190 | 6 |
| opt1 | inspect Durable Objects | 556 | 897 | 3 |
| opt1 | configure email | 556 | 7,822 | 24 |
| opt2 | set up Turnstile | 743 | 8,768 | 6 |
| opt2 | inspect Durable Objects | 743 | 2,305 | 3 |
| opt2 | configure email | 743 | 9,319 | 24 |
| opt3 | set up Turnstile | 664 | 9,037 | 6 |
| opt3 | inspect Durable Objects | 664 | 2,313 | 3 |
| opt3 | configure email | 664 | 9,291 | 24 |

Full catalog, 3,036 tools, 1,030 toolsets, 139 top-level groups, local:

| Variant | Upfront | Task load (Turnstile, DO, email) |
| :-- | --: | :-- |
| flat | 1,378,777 | 6,570 / 1,369 / 1,493 |
| opt1 | 5,308 | 2,190 / 897 / 7,822 |
| opt2 | 5,495 | 8,768 / 2,305 / 9,319 |
| opt3 | 5,416 | 9,037 / 2,313 / 9,291 |

- At 3,036 tools the flat list is 6.2 MB, more than any current context window holds. The groups listing is 5.3k to 5.5k tokens.
- Task load does not change with catalog size. The saving is all in the read before the model picks a group, so the question at scale is whether it picks the right one out of 139.
- Schemas are most of the task load once a group holds 20-odd tools. The email group's 24 schemas put `opt1` at 7,822 tokens, close to the 8,768 that `opt2` spends on Turnstile, where the skill body is most of the cost. That argues for small groups and nesting, and it is a data point for the SEP's inline-delivery decision.

## Selection trial

`scripts/select.ts` shows a model what a client sees before `groups/get`: the top-level tools, `groups/list` and `skills/list`, as names and first description lines. It gives the model a task and asks for one answer: `{"group": name}`, `{"skill": name}`, `{"tool": name}` or `{"none": true}`. The flat control shows every tool's name and first line instead, with the same skill index, and asks for a tool, a skill or none. A `flat-schemas` mode puts the whole `tools/list` result in the prompt, 158k tokens at 238 tools.

Twenty tasks describe the job without naming the product. Some are confusable pairs (routing against sending, queues against Durable Objects, KV against D1 and R2, Workers against containers), two are knowledge questions, and two have no fit in the subset. One sample per task. Accepted answers are in the script. Against the full catalog they also accept the products the subset lacks (`dns-api`, `email-auth-api` and `email-domains-api` for the mail DNS check, `workflows-api` for retried jobs, `workers-builds-api` and `builds-api` for pushing a build, `flagship-api` for feature flags, `accounts-api` or `user-api` for rotating a token). A skill is accepted where the same-named workflow group is, plus `workers-best-practices` for the fetch-handler question and `wrangler` for the deploy and schedule tasks.

Models: six open models through the Hugging Face router with thinking off, temperature 0.2, seeded (Qwen 3.5 9B, Qwen3 14B, GLM-5.3 Flash, DeepSeek V4.1 Flash, Qwen3.6 35B-A3B, Gemma 4 26B-A4B); ten hosted models at their lowest reasoning setting (Claude Opus, Sonnet and Haiku 5.5 at effort low; GPT-6 Astra and 6.1 Sol at reasoning effort low, 6.1 Terra and 6 Luna at none; Gemini 4 Argon and 3.8 Flash at thinking level low; Kimi K3.1 Pro at low); and two classifier APIs that take the group and skill names as choices (the OpenAI Decisions API on GPT-6 Luna, TypeSafe's Jev 1.14), in groups mode only.

The set ran twice. The 2026-11-07 run left `skills/list` out of the prompt; the 2026-11-08 run added it. The tables are the 2026-11-08 run. With one sample per task, two cells within two of each other are the same result, and the notes below report differences of three or more.

### Open models

| What the model read | Tokens before the task | Qwen 3.5 9B | Qwen3 14B | GLM-5.3 Flash | DeepSeek V4.1 Flash | Qwen3.6 35B-A3B | Gemma 4 26B |
| :-- | --: | --: | --: | --: | --: | --: | --: |
| 13 groups and 5 skills (238-tool subset) | 633 | 16/20 | 18/20 | 19/20 | 19/20 | 19/20 | 19/20 |
| 139 groups and 5 skills (3,036-tool catalog) | 3,873 | 10/20 | 13/20 | 18/20 | 17/20 | 15/20 | 19/20 |
| 238 tool names and 5 skills, flat | 6,911 | 15/20 | 19/20 | 18/20 | 20/20 | 19/20 | 19/20 |
| 238 tools with schemas and 5 skills, flat | 157,834 | 9/20 | not run (40k context) | 19/20 | 19/20 | 16/20 | 19/20 |
| 3,036 tool names and 5 skills, flat | 81,605 | 5/20 | not run (40k context) | 19/20 | 19/20 | 18/20 | 18/20 |

### Hosted models and classifiers

| What the model read | Opus 5.5 | Sonnet 5.5 | Haiku 5.5 | GPT-6 Astra | GPT-6.1 Sol | GPT-6.1 Terra | GPT-6 Luna | Gemini 4 Argon | Gemini 3.8 Flash | Kimi K3.1 Pro | Decisions API (Luna) | Jev 1.14 |
| :-- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: |
| 13 groups and 5 skills | 20/20 | 20/20 | 19/20 | 20/20 | 20/20 | 20/20 | 20/20 | 19/20 | 20/20 | 19/20 | 19/20 | 20/20 |
| 139 groups and 5 skills | 20/20 | 19/20 | 19/20 | 20/20 | 20/20 | 19/20 | 18/20 | 19/20 | 18/20 | 18/20 | 20/20 | 16/20 |
| 238 tool names and 5 skills, flat | 20/20 | 20/20 | 18/20 | 20/20 | 20/20 | 18/20 | 20/20 | 20/20 | 20/20 | 20/20 | | |
| 238 tools with schemas and 5 skills, flat | 19/20 | 20/20 | 17/20 | not run | 18/20 | 19/20 | 20/20 | 20/20 | 19/20 | 18/20 | | |
| 3,036 tool names and 5 skills, flat | 20/20 | 20/20 | 17/20 | 19/20 | 18/20 | 17/20 | 20/20 | 20/20 | 20/20 | 20/20 | | |

### What the results say

- **Groups did not change which product the hosted models picked.** Every hosted model is within two tasks of itself across the four modes at both sizes. Groups changed the read before the task: 633 or 3,873 tokens against 6,911 or 81,605. At 3,036 tools the full schemas (1.38M tokens) cannot be read at all. This agrees with the finding the SEP already cites.
- **Templated descriptions cost the mid-size open models at 139 groups.** Qwen3 14B went from 18 to 13, Qwen3.6 35B-A3B from 19 to 15, the 9B from 16 to 10. GLM, DeepSeek and Gemma held 17 to 19, and the hosted models 18 to 20. The misses land on neighbouring products: `pipelines-api` for a dead-letter destination, `durable-objects` for relational tables or feature flags, `iam-api` for rotating a token, `hyperdrive-api` for relational tables. The SEP says a description should carry the task vocabulary a user would use, and these carry only the product name. This row measures the cost of ignoring that guidance.
- **The skill index mattered more than groups against flat.** Adding the five-line `skills/list` index moved flat scores by up to 17 tasks: Haiku 5.5 from 7 and 1 of 20 to 18 and 17; Opus and Sonnet from 16 to 20 at 3,036 names; GLM, Qwen3.6 and Gemma from 16, 13 and 13 to 19, 18 and 18. No groups-mode cell for a hosted model moved by more than one. Eleven of the twenty tasks have a skill as a right answer, and the models take it. A client that implements groups but not SEP-2640 would see a different picture from one that implements both.
- **Full schemas did not hurt the models that fit them.** On the 158k-token schema list, every model that fits it scored within two of its names-only score. The 9B dropped to 9. The misses are skill answers for tool tasks, or a list tool called before the one the task needs. Anthropic, Kimi and Gemini 4 Argon served 2.9M to 5.2M tokens per model from cache on this control; OpenAI reported none.
- **The 9B model stops answering at 85k tokens.** 5 of 20 at 3,036 names, with none on 14 tasks.
- **Overlapping groups split the models.** Where a task accepts either the workflow (as a group or a skill) or the product's API group, Opus, Sonnet, the four GPT-6 models and the Decisions classifier split 3 to 4 at 13 groups, Haiku 6 to 1, and the open models took the workflow on 4 to 7 of 7. At 139 groups every model leans to the workflow. A server that offers both for one product should say in the descriptions which to load when.
- **Classifiers route on one-line descriptions.** The Decisions API over the group and skill names scored 19 and 20 of 20, at about 600 and 4,000 input tokens per call and no output tokens; both runs together cost about a cent. Jev scored 20 and 16. Its misses at 139 follow shared words, such as `pipelines-api` for "the orders pipeline" and `sql-api` for SQL joins. Enumerated choices rule out the key confusion the small chat models show.

## Task completion through a real client

The selection trial asks where a model would look. This run has an agent do the task, which is the problem statement's fourth criterion. Each of the twenty tasks, reworded with concrete identifiers (account `demo`, bucket `demo-uploads`, a Durable Object class pasted in for the review), ran as a headless Claude Code session with the file and shell tools disallowed, under three conditions:

- **groups**: a Claude Code mod that speaks the Groups extension to the opt2 Worker over HTTP, in the pattern the SEP's "Client behavior after `groups/get`" section sketches. `list_groups`, `open_group` and `read_skill` are client-side tools, a system-prompt section lists the 13 groups and 5 skills, and a group's scoped tools are registered as deferred definitions when it opens. No MCP server is connected.
- **flat with the host's tool search**: the flat Worker connected as an ordinary MCP server, its 238 tools behind Claude Code's own tool search, which is the host's default for MCP tools. The mod runs against the same Worker for the skill index and `read_skill`.
- **flat with all schemas up front**: the same, with tool search off, so all 238 schemas sit in the prompt, about 305k tokens as the provider renders them.

Claude Sonnet, Haiku and Opus 5.5 at default effort, one session per task, 180 sessions, no errors. "Done" is a per-task rubric over the calls the session made: the right tool with the right arguments, or the right skill loaded and the answer showing it. Tokens are the provider's, summed over turns, cache reads included.

| Condition | Model | Done | First step right | Median turns | Median wall s | Cost USD | Input tokens | From cache |
| :-- | :-- | --: | --: | --: | --: | --: | --: | --: |
| groups | Sonnet 5.5 | 20/20 | 20/20 | 5 | 16 | 1.18 | 2.37M | 92% |
| groups | Haiku 5.5 | 16/20 | 17/20 | 5 | 16 | 0.09 | 2.36M | 88% |
| groups | Opus 5.5 | 20/20 | 20/20 | 5 | 19 | 2.66 | 2.32M | 90% |
| flat, host tool search | Sonnet 5.5 | 20/20 | 18/20 | 3 | 13 | 1.67 | 1.96M | 83% |
| flat, host tool search | Haiku 5.5 | 18/20 | 19/20 | 4 | 13 | 0.10 | 2.15M | 84% |
| flat, host tool search | Opus 5.5 | 20/20 | 20/20 | 4 | 16 | 3.56 | 2.22M | 84% |
| flat, all schemas up front | Sonnet 5.5 | 20/20 | 19/20 | 3 | 12 | 3.53 | 16.5M | 97% |
| flat, all schemas up front | Haiku 5.5 | 19/20 | 20/20 | 3 | 13 | 1.33 | 16.6M | 97% |
| flat, all schemas up front | Opus 5.5 | 20/20 | 20/20 | 3 | 15 | 7.72 | 18.4M | 97% |

- Sonnet and Opus completed every task under every condition. Haiku missed 4, 2 and 1. Its groups-mode misses are answers given without opening a group or reading a skill, one attempt at the disallowed shell tool, and one session that wandered into an unrelated host tool.
- Groups cost a turn. Opening a group is a round trip, and nested toolset groups often cost two. Median 5 turns against 3 or 4, and 3 to 4 seconds more per task.
- Loading every schema up front reads seven to eight times the input tokens of groups, at three times the cost. The gap between those two ratios is the provider cache, which served 97% of that 305k-token prefix. Groups and the host's tool search land in the same band, 2.0M to 2.4M tokens per model.
- On this catalog the host's tool search does for the flat server what groups do: same completion, same token band, one fewer turn. The deferred scoped tools in groups mode also load through tool search. What groups add is the bundle, instructions and a skill delivered with the tools, and a path for clients without tool search.
- The prompt cache held across group opens. Registering a group's tools as deferred added about 2.7k tokens on a 42k-token cached prefix. With tool search off, a mid-session registration rewrites the prefix. This is the SEP's prompt-caching claim observed on a shipped host.
- Three tasks depend on data a dry-run server never returns: a file to upload, key names from a list, namespace ids. Every model took the right first step and said why it stopped. Two Opus sessions filled a bulk delete with made-up key names and one refused to. The rubrics accept the first step for those three.

The sessions are published with only their conversation rows, since the raw files embed the host's full system prompt and account ids: `results/traces/traces-public/` in the repo, 180 files, re-scorable with the committed scripts.

## Limits

- One sample per task. Two cells within two of each other are the same result.
- The group names and descriptions are this demo's, not Cloudflare's, and they are templated. The `-api` suffix and the `durable-objects` / `durable-objects-api` overlap are naming choices.
- Accepted answers are this demo's judgment; the list above says where the line was drawn. A different reader might draw it elsewhere.
- The 3,036-tool schemas (1.38M tokens) cannot be tested. Astra skipped the schema control.
- Every server lists a `demo_info` tool first. Two small models answered it on most flat tasks until a skill answer was available. A real server's first tool is something else.
- The hosted models in the selection trial ran at their lowest reasoning setting. In the completion run they ran at default effort.
- The answer format is this script's. A host would expose `groups/get` as a tool call.
- Token counts in the tables are compact JSON. A provider's tool prompt renders schemas differently, and generated schemas are verbose. `opt1`'s task load depends on how long its paraphrase is.
- The completion run is one model family on one host, 20 tasks, one sample each, with the host's user-level plugins loaded in every arm alike. The tool-search arm is Claude Code's implementation. The flat baseline is a mode Cloudflare documents as an escape hatch, and groups against Code Mode was not measured.
- The OpenAI chat completions API reported no cached tokens even with a `prompt_cache_key`, so the GPT-6 input counts are uncached. Anthropic, Kimi and Gemini 4 Argon reported cache reads throughout.
- One server, one vendor's catalog, three workflows, models pinned by name on one provider on two days.

## What is next

1. Task-vocabulary descriptions for the confusable toolset groups (queues against pipelines, D1 against Hyperdrive and SQL, Workers against containers and builds, KV against Flagship) and a re-run of groups mode at 139 with the open models, to see whether the SEP's description guidance closes the gap.
2. The real-client run on other hosts and models. Pi's extension system is the next harness, and it brings non-Claude models. The same sessions as a Hugging Face agent-traces dataset.
3. Groups against Cloudflare's own Code Mode on the same tasks.
4. Tasks against a server that answers with data, so the read-then-act tasks can complete.

## Reproduce

https://github.com/olaservo/mcp-progressive-disclosure-evals: `npm ci`, `npm run dev`, `npm run compare` for the token tables against localhost, or `npm run compare -- --urls ...` against the deployed Workers. `npm run select -- --replay results/<file>.jsonl` rebuilds any trial summary from the committed raw answers without calling a model. `npm run trace:score -- --label traces-public` re-scores the committed sessions. `npm run vendor:full` builds the 3,036-tool catalog from a cloudflare/mcp checkout at `4938f2f3`. The README has every command behind every table.
