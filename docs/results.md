# Results

Every table in the repository, with the notes behind each. The sections are in the order the runs were made, and the [README](../README.md) has the findings by conclusion.

This page is reference detail, written to be searched more than read through. Its numbers were re-derived from the files in `results/` on 2026-11-23.

Terms used throughout:

- Two servers ran in two rounds. Round one (2026-11-07 and 2026-11-08) is the as-generated groups server. Round two (2026-11-09) adds the rewritten one.
- Three task sets: v1 (14 tasks that name the product), v2 (20 that do not) and v3 (20 held out). Rounds and task sets are separate things: v2 ran in both rounds.
- The subset is 237 Cloudflare tools. Round one's servers also listed a `demo_info` tool, so its counts say 238.
- In the open-model runs, arm A sends every schema up front, arm B appends a group's tools to `tools` when it opens, and arm C keeps a fixed tool set and reads schemas as tool-result text. Arm D declares every tool deferred and loads a group's tools by reference. A phase is one user turn.
- `#19` is the Groups extension draft (the SEP), `#22` the positioning document with Options 1 to 3, and `flat`, `opt1`, `opt2`, `opt3` the server variants. The [README](../README.md#terms) defines them.

## Token measurements

Token counts are tiktoken `o200k_base` over the compact JSON the model would see, not a provider's tool prompt. "Upfront" is what the model reads before it commits to a task: `tools/list`, plus `groups/list` and the skill index where the variant serves them. "Task-load" is what it reads after: instructions, scoped tools and resources, and the skill body. There is one task per cloudflare/skills workflow with API tools. In `flat` the tools are already upfront. Its "Task tools" column counts tools whose names start with the workflow's product prefixes, so email shows 41 there while the workflow group curates 24. A 2025-era client gets every tool in every variant.

### Subset: 238 tools, 13 top-level groups

Deployed Workers, 2026-11-07 (`results/tokens/2026-11-07-deployed-tasks.txt`).

| Variant | Task | Upfront tokens | Task-load tokens | Task tools | Bytes on the wire |
| :-- | :-- | --: | --: | --: | --: |
| flat | set up Turnstile | 157763 | 6570 | 6 | 751106 |
| flat | inspect Durable Objects | 157763 | 1369 | 3 | 728548 |
| flat | configure email | 157763 | 1493 | 41 | 729051 |
| opt1 | set up Turnstile | 556 | 2190 | 6 | 12253 |
| opt1 | inspect Durable Objects | 556 | 897 | 3 | 6768 |
| opt1 | configure email | 556 | 7822 | 24 | 38406 |
| opt2 | set up Turnstile | 743 | 8768 | 6 | 50012 |
| opt2 | inspect Durable Objects | 743 | 2305 | 3 | 20564 |
| opt2 | configure email | 743 | 9319 | 24 | 53008 |
| opt3 | set up Turnstile | 664 | 9037 | 6 | 43111 |
| opt3 | inspect Durable Objects | 664 | 2313 | 3 | 13776 |
| opt3 | configure email | 664 | 9291 | 24 | 45395 |

### Full catalog: 3,036 tools, 1,030 toolsets, 139 top-level groups

Local `wrangler dev` after `npm run vendor:full`, 2026-11-07 (`results/tokens/2026-11-07-full-local.txt`). The raw output says 3,037 tools because every variant adds `demo_info`.

| Variant | Task | Upfront tokens | Task-load tokens | Task tools | Bytes on the wire |
| :-- | :-- | --: | --: | --: | --: |
| flat | set up Turnstile | 1378777 | 6570 | 6 | 6180816 |
| flat | inspect Durable Objects | 1378777 | 1369 | 3 | 6158258 |
| flat | configure email | 1378777 | 1493 | 41 | 6158761 |
| opt1 | set up Turnstile | 5308 | 2190 | 6 | 35191 |
| opt1 | inspect Durable Objects | 5308 | 897 | 3 | 29706 |
| opt1 | configure email | 5308 | 7822 | 24 | 61344 |
| opt2 | set up Turnstile | 5495 | 8768 | 6 | 72950 |
| opt2 | inspect Durable Objects | 5495 | 2305 | 3 | 43502 |
| opt2 | configure email | 5495 | 9319 | 24 | 75946 |
| opt3 | set up Turnstile | 5416 | 9037 | 6 | 66049 |
| opt3 | inspect Durable Objects | 5416 | 2313 | 3 | 36714 |
| opt3 | configure email | 5416 | 9291 | 24 | 68333 |

### What the variants showed

- `flat` loads the skill with its digests verified. The skill names no tools, so all 238 stay in front of the model.
- `opt1` is the smallest because its instructions are a short paraphrase of the skill. The paraphrase is a second copy of the workflow that will drift from cloudflare/skills, and it drops the skill's seven Turnstile framework guides. A host that also connects the Skills server has no way to match a group to its skill.
- `opt2` keeps the skill verified (`skills/get` and `read` check its digests) and adds 6 tool definitions. The SDK's `SkillCatalog` lists every SKILL.md in `resources/list`, so a group that scopes one breaks the placement rule. A `SkillSource` with no `listResources` serves the same entries through `skills/list` only, and the rule holds. The SEP's placement rule names only `tools/list`, `prompts/list` and `resources/list`, so by its text `skills/list` is not a listing. Neither document says whether a skill a group lists stays in `skills/list`.
- `opt3` measures within 100 tokens of `opt2` at every point but the Turnstile task load, where it is 269 higher, since it serves the same bundles under other method names. It flattens the skill: the SKILL.md body arrives as `instructions` with no skill entry and no digests, and its seven `references/*.md` links resolve to scoped resources only if the host uses `skill://turnstile-spin/` as their base, which the response does not say. The deployment uses the existing `io.modelcontextprotocol/skills` identifier, so a SEP-2640 client reading it sees entries without `uri` or `frontmatter`. An SDK that speaks both can map one shape to the other.
- In every groups variant, `tools/call` on a scoped tool works on a connection that never issued `groups/get`, as the SEP requires, and the tool stays out of that connection's `tools/list`. The comparison checks this with a dry run of `turnstile_widgets_create`.
- `workers-best-practices` and `wrangler` have no API tools to pair with. Under `opt2` they stay plain skills. Under `opt3` they become instruction-only skills with no digests.
- With the full catalog, the flat `tools/list` is 1.38 million tokens and 6.2 MB, more than any current context window holds. The groups listing is 5,308 to 5,495 tokens for 139 top-level groups. Task load is the same as the subset, because `groups/get` returns the same group. The saving is all in what the model reads before it picks a group, so the question at this scale is whether it picks the right one out of 139. The selection trial tests that.
- Once a group holds more than a few tools, schemas dominate task load. The email group's 24 schemas put `opt1` at 7,822 tokens for email, close to the 8,768 that `opt2` spends on Turnstile, where the skill body is most of the cost and the six schemas are small.
- `groups/get` here answers with `cacheScope: "public"`, since no variant varies a group's contents by caller. The SEP expects `private` in the general case. `tools/list` on the groups variants depends on whether the client negotiated the extension, and it was served `public` during every run. Since the 2026-11-12 redeploy it is served `private`.
- The WG problem statement asks for four measures: initial context size, total tokens, end-to-end latency and task completion. The tables above and the selection trial cover the first two. The task-completion run covers the other two, through a real client.

## Selection trial, v1 tasks

`scripts/select.ts` shows a model what a client sees before `groups/get`: the top-level tools and `groups/list`, as names and first description lines. It then gives the model a task and asks for one JSON answer: a group to load, a top-level tool to call, or none. The flat control shows every tool's name and first line instead, and asks for a tool. There are 14 tasks: 12 tool tasks across the 10 products and 2 knowledge tasks (review a Durable Object class, explain a Worker's fetch handler). Nothing in the listing fits the fetch-handler question, and its expected answer is none. Each task gets 5 samples, or 2 on the 3,036-tool control. The models are Qwen 3.5 9B and Qwen3 14B through the Hugging Face router on deepinfra (thinking off, temperature 0.2, one seed per sample) and Claude Opus 5.5 through the Anthropic SDK at effort low. Claude reads the catalog from a cached block, so its input-token count excludes the cache read. "Right name" counts an answer whose value is correct under either JSON key. The 9B model often returns a group name as `{"tool": ...}`, which a real client would send to `tools/call`. Run on 2026-11-07. Raw answers are in `results/select/2026-11-07-select-*.jsonl`.

| What the model read | Tokens before the task | Qwen 3.5 9B | Qwen3 14B | Claude Opus 5.5 |
| :-- | --: | --: | --: | --: |
| 13 groups (238-tool subset) | 442 | 45/70, right name 65/70 | 70/70 | 70/70 |
| 139 groups (3,036-tool catalog) | 3,682 | 33/70, right name 65/70 | 65/70 | 70/70 |
| 238 tool names, flat control | 6,720 | 61/70 | 70/70 | 64/70 |
| 3,036 tool names, flat control | 81,414 | 22/28 | not run (40k context) | 25/28 |

- Going from 13 to 139 groups did not change whether the models picked an accepted group. In three cells a Qwen model moved between the workflow group and the API group, both accepted. The 14B model's five misses at 139 groups are all on the no-fit task, where it chose the server's `demo_info` tool instead of none. The 9B model's five name-level misses are on that same task at both sizes. Every other sample picked the right group.
- The flat control agrees with the data point the SEP cites: a model that can read the whole list already selects well, and the 14B model was perfect on 238 names. Groups did not improve selection. They cut what the model reads before the task from 6,720 tokens to 442 at 238 tools and from 81,414 to 3,682 at 3,036 tools. At 3,036 tools the full schemas, 1.38M tokens, cannot be read at all.
- Claude's flat-control misses are on the two knowledge tasks, where it picked `demo_info`. The 9B model answered none on the Durable Object review, on the Turnstile setup task (4 of 5 at 238 names, 2 of 2 at 3,036) and on the queue-consumer task (2 of 2 at 3,036). The v1 set ran before the prompt carried the skill index (see the v2 set), so flat mode had no skill to answer with while groups mode had the `durable-objects` workflow group. Five of Claude's six misses on 238 names are that one task. Read the flat control here as at least as good as groups.
- The 9B model's weak point is the answer format. 20 of 70 answers at 13 groups and 32 of 70 at 139 named the right group under the `tool` key. A host that routes on the key would issue a `tools/call` for a group name. Group and tool names share vocabulary in this catalog (`kv-api`, `kv_bulk_get`), which may contribute.
- Where a task accepted either the skill's workflow group or the product's API group, the Qwen models chose the workflow group on 24 to 29 of 35 answers and Claude chose the API group on 20 of 35. Claude's split followed the task: the setup task went to `turnstile-spin`, rotating a leaked secret went to `turnstile-api`.

## Selection trial, v2 tasks: the job without the product name

20 tasks behind `--tasks v2`, one sample each. Each describes the job and not the product ("Serve 50 GB of user uploads to browsers on another origin, so cross-origin headers are needed"), with pairs that one group answers: routing against sending, queues against Durable Objects, KV against D1 and R2, Workers against containers. Three are knowledge tasks (the state holder, the alarm review and the fetch handler), and two have no fit in the subset (the fetch handler and rotating the account token). Six open models through the Hugging Face router with thinking off: Qwen 3.5 9B, Qwen3 14B, GLM-5.3 Flash, DeepSeek V4.1 Flash, Qwen3.6 35B-A3B and Gemma 4 26B-A4B. The `flat-schemas` mode puts the whole `tools/list` result with input schemas in the prompt, 157,642 tokens at 238 tools. The 14B model was not run on that or on the 81k-token full name list, which exceed its 40k context. Against the 3,036-tool catalog the scoring also accepts the products the subset lacks that fit a task: `dns-api`, `email-auth-api` and `email-domains-api` for the mail DNS check, `workflows-api` for retried background jobs, `workers-builds-api` and `builds-api` for pushing a build, `flagship-api` for feature flags, and `accounts-api` or `user-api` for rotating an account token, which the subset cannot do.

The set ran twice. The first run, on 2026-11-07, showed the model tools and, in groups mode, groups. Both servers also serve five skills over the Skills extension, and a Skills-extension client would show those too, but the prompt left them out. So a knowledge task had no answer in flat mode. The second run, on 2026-11-08, added the `skills/list` index to every prompt (five names and descriptions, about 190 tokens) and a `{"skill":"<name>"}` answer. A skill counts where the same-named workflow group counts, and `workers-best-practices` counts for the fetch-handler question and `wrangler` for the deploy and schedule tasks. The tables below are the second run. Raw answers are in `results/select/2026-11-07-select2-*.jsonl` and `results/select/2026-11-08-select2-*.jsonl`, and the `.txt` summaries show every model's pick per task. Three 2026-11-07 full-catalog files (`select2-full-flat`, `select2-full-groups` and `select2-full-groups-hosted`) were scored before those full-catalog answers were accepted, so their `correct` column is lower than their `.txt` summaries, which are replays under the final answers. The first-run numbers below are the replayed ones. With one sample per task, two cells that differ by one or two are the same result. The notes below call out differences of three or more in the flat modes and of two or more in groups mode.

### Open models

| What the model read | Tokens before the task | Qwen 3.5 9B | Qwen3 14B | GLM-5.3 Flash | DeepSeek V4.1 Flash | Qwen3.6 35B-A3B | Gemma 4 26B |
| :-- | --: | --: | --: | --: | --: | --: | --: |
| 13 groups and 5 skills (238-tool subset) | 633 | 16/20 | 18/20 | 19/20 | 19/20 | 19/20 | 19/20 |
| 139 groups and 5 skills (3,036-tool catalog) | 3,873 | 10/20, right name 13 | 13/20, right name 14 | 18/20 | 17/20 | 15/20 | 19/20 |
| 238 tool names and 5 skills, flat | 6,911 | 15/20 | 19/20 | 18/20 | 20/20 | 19/20 | 19/20 |
| 238 tools with schemas and 5 skills, flat | 157,834 | 9/20 | not run (40k context) | 19/20 | 19/20 | 16/20 | 19/20 |
| 3,036 tool names and 5 skills, flat | 81,605 | 5/20 | not run (40k context) | 19/20 | 19/20 | 18/20 | 18/20 |

- On the subset, groups and the flat name list read the same: 18 to 20 of 20 for every model but the 9B, which is at 16 and 15.
- At 139 templated groups the mid-size open models drop: Qwen3 14B to 13, Qwen3.6 35B-A3B to 15, the 9B to 10. GLM, DeepSeek and Gemma hold 17 to 19. The misses go to neighbouring products: `pipelines-api` for a dead-letter destination, `durable-objects` for relational tables, feature flags, a nightly schedule or retried jobs, `iam-api` for rotating a token, `pages-api` for serving uploads.
- At 3,036 tool names with the skill index, the four larger models score 18 or 19. GLM, DeepSeek and Qwen3.6 are above their 139-group scores and Gemma is one below. The 9B model falls to 5 and answers none on 14 of 20.
- Full schemas at 238 tools left GLM, DeepSeek and Gemma within one task of their names-only scores (19, 19 and 19 against 18, 20 and 19) and cost Qwen3.6 three (16 against 19). The 9B model dropped from 15 to 9 and answered none on 9 tasks. Three of Qwen3.6's four schema misses are `skill:workers-best-practices` for a queue or R2 task. The fourth is `skill:durable-objects` for the feature-flags task.
- What the skill index changed, by three or more tasks in the flat modes and by more than one in groups mode: the 9B model at 13 groups went from 10 to 16, and Qwen3 14B at 238 names from 15 to 19. The 9B model also went from 12 to 15 at 238 names and from 9 to 5 at 3,036, and Qwen3.6 from 20 to 16 on the schema control. At 3,036 names, GLM went from 16 to 19, Qwen3.6 from 13 to 18 and Gemma from 13 to 18. In groups mode the 9B model went from 7 to 10 at 139 groups and Gemma from 17 to 19. The other four larger models' groups cells moved by at most one. Eleven of the twenty tasks accept a skill as an answer, and the models take it: 3 to 11 skill answers per model on the 238 flat names, and the fetch-handler question went to a skill from every model in every mode. The class review went to a skill in the flat modes, except the 9B model's none at 3,036 names, and to the skill or its workflow group in groups mode.
- Four flat tasks expect a specific tool (rotate the secret, a lifecycle rule, a schedule, the mail DNS check). A model that answers with the product's list tool first is scored as a miss, and so is `skill:workers-best-practices` for a Workers task, where `wrangler` is accepted.
- Where a task accepts either the workflow (as a group or as a skill) or the product's API group, the open models took the workflow on 3 of 6 up to 7 of 7 at 13 groups.

### Hosted models and classifiers

The same set with hosted models through their vendors' SDKs, each at its lowest reasoning setting: Claude Opus, Sonnet and Haiku 5.5 at effort low, GPT-6 Astra and GPT-6.1 Sol at reasoning effort low, GPT-6.1 Terra and GPT-6 Luna at none, Kimi K3.1 Pro at low, Gemini 4 Argon and 3.8 Flash at thinking level low. The last two columns are classifiers, which take the group names with first description lines, the skills not already named by a group, and none as the choices, and return a pick with probabilities and no generated text, so they run in groups mode only: the OpenAI Decisions API on GPT-6 Luna, and TypeSafe's Jev through its System One endpoint (`jev-latest`, resolved to 1.14.0). Astra was not run on the schema control. The OpenAI account ran out of credits partway through the schema control. Terra's and Luna's rows in that file are from a re-run after credits were added. Raw answers are in `results/select/2026-11-08-select2-*-hosted.jsonl`, `*-gemini.jsonl`, `*-kimi.jsonl` and `*-jev.jsonl`.

| What the model read | Opus 5.5 | Sonnet 5.5 | Haiku 5.5 | GPT-6 Astra | GPT-6.1 Sol | GPT-6.1 Terra | GPT-6 Luna | Gemini 4 Argon | Gemini 3.8 Flash | Kimi K3.1 Pro | Decisions API (Luna) | Jev 1.14 |
| :-- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: |
| 13 groups and 5 skills | 20/20 | 20/20 | 19/20 | 20/20 | 20/20 | 20/20 | 20/20 | 19/20 | 20/20 | 19/20 | 19/20 | 20/20 |
| 139 groups and 5 skills | 20/20 | 19/20 | 19/20 | 20/20 | 20/20 | 19/20 | 18/20 | 19/20 | 18/20 | 18/20 | 20/20 | 16/20 |
| 238 tool names and 5 skills, flat | 20/20 | 20/20 | 18/20 | 20/20 | 20/20 | 18/20 | 20/20 | 20/20 | 20/20 | 20/20 | | |
| 238 tools with schemas and 5 skills, flat | 19/20 | 20/20 | 17/20 | not run | 18/20 | 19/20 | 20/20 | 20/20 | 19/20 | 18/20 | | |
| 3,036 tool names and 5 skills, flat | 20/20 | 20/20 | 17/20 | 19/20 | 18/20 | 17/20 | 20/20 | 20/20 | 20/20 | 20/20 | | |

- Every hosted chat model scores 17 to 20 of 20 in every mode at both sizes, and no model moves by three or more between modes at the same catalog size. Groups did not measurably change what the hosted models picked. They changed how much the models read first: 633 or 3,873 tokens instead of 6,911 or 81,605. With one run of 20 tasks per cell, a 95% interval on 19 of 20 spans 15 to 20, so a gap of one or two tasks is noise.
- The misses at 139 groups repeat across models: `iam-api` for rotating an account token (Sonnet, Haiku, Terra and Argon; IAM has no token tools), `durable-objects` for retried background jobs (Luna and Kimi), `workers-best-practices` for the nightly schedule (Kimi and Flash), `hyperdrive-api` for relational tables (Luna), `pipelines-api` for the dead-letter destination (Flash). The flat misses are list-first picks (`turnstile_widgets_list` before rotating the secret, `r2_buckets_list` before a lifecycle rule, from Terra), `workers-best-practices` for a queue, deploy or schedule task (Astra, Sol, Terra, Haiku) and `demo_info` (Haiku, 3).
- What the skill index changed for the hosted models, by three or more tasks in the flat modes and by more than one in groups mode: Haiku went from 7 to 18 at 238 names and from 1 to 17 at 3,036. At 238 names Opus, Sonnet and Luna each went from 17 to 20, and Luna went from 17 to 20 on the schema control. At 3,036 names Opus and Sonnet went from 16 to 20, Luna from 15 to 20, Flash from 17 to 20. Jev went from 13 to 16 at 139 groups and 18 to 20 at 13, and Gemini 3.8 Flash went from 20 to 18 at 139. Every other hosted groups cell moved by at most one. In the first run Haiku answered `demo_info`, the first tool listed, on most flat tasks. With the skill index it answered a skill on 7 and 10 of 20 and `demo_info` on 2 and 1. The first run's collapse came from a prompt with no non-tool answer for the knowledge tasks, not from the model. On the repeated schema control Haiku scored 17, against 4 before.
- The classifiers: the Decisions API scored 19 and 20 of 20 at about 600 and 4,000 input tokens per call and no output tokens. Both runs together cost about a cent. Jev scored 20 at 13 groups and 16 at 139, where three of its four misses follow surface words: `pipelines-api` for "the orders pipeline", `sql-api` for SQL joins, `workflows-api` for a nightly schedule. The fourth is none for the stored-data task. Enumerated choices rule out the key confusion the small chat models show.
- The 158k-token schema list with the skill index: Opus 19, Sonnet 20, Haiku 17, Sol 18, Terra 19, Luna 20, Argon 20, Flash 19, Kimi 18, each within two of its names-only score. Every miss on it is a skill answer for a tool task (`workers-best-practices` or `wrangler` for a queue, deploy or containers task) or a list-first pick. Anthropic, Kimi and Argon reported cache reads throughout (2.9M to 5.2M tokens per model on this control). The OpenAI chat completions API reported none even with a `prompt_cache_key`, so the GPT-6 input counts are uncached.
- Where a task accepts either the workflow or the API group, Opus, Sonnet, the four GPT-6 models and the Decisions classifier all split 3 workflow to 4 API group at 13 groups, Haiku 6 to 1, Kimi 4 to 3. At 139 groups the hosted models lean to the workflow, 3 to 3 up to 6 to 0.
- Some of those workflow picks are the skill alone. `opt2` lists `turnstile-spin`, `durable-objects` and `cloudflare-email-service` in both `groups/list` and `skills/list` under one name, and `score()` in `scripts/select.ts` accepts a skill wherever its group is accepted. Skill-only answers in groups mode on tasks that expect an `-api` group, out of 20:

  | Model, catalog | Skill-only picks |
  | :-- | --: |
  | Gemini 3.8 Flash, 139 groups | 4 |
  | DeepSeek V4.1 Flash, 139 groups | 3 |
  | Qwen 3.5 9B, 13 and 139 groups | 3 each |
  | Kimi K3.1 Pro, 139 groups | 2 |
  | DeepSeek V4.1 Flash, 13 groups | 2 |
  | Opus 5.5, 13 groups | 2 |
  | GLM-5.3 Flash and Qwen3.6 35B-A3B, 139 groups | 1 each |
  | Qwen3.6 35B-A3B, 13 groups | 1 |

  A real Option 2 client that follows the skill-only path loads the skill's instructions without the tools the task needs. The cloudflare/skills files name no MCP tools, so the model is not pointed at a missing tool by name. Two ways out: the server omits grouped skills from `skills/list` for clients that negotiated groups, which the SEP allows since a view may vary by negotiated extensions, or the host opens the listing group when it loads a grouped skill.

## Task completion through a real client

The selection trial asks a model where it would look. This run has an agent do the task. `scripts/trace-run.ts` runs each of the 20 tasks (`scripts/trace-tasks.ts`, the v2 set reworded with concrete names: account `demo`, bucket `demo-uploads`, a Durable Object class to review) as a headless Claude Code session, `claude -p` with the built-in file and shell tools disallowed, under three conditions:

| Condition | What the model has |
| :-- | :-- |
| `groups` | `mods/groups` against the opt2 Worker: `list_groups`, `open_group`, `read_skill`, a system-prompt section listing the 13 groups and 5 skills, scoped tools registered as deferred on open. No MCP server connected. |
| `flat-toolsearch` | The flat Worker as an MCP server, its 238 tools behind Claude Code's own tool search (the host's default for MCP tools), plus the mod against the same Worker for the skill index and `read_skill`. |
| `flat-all-schemas` | The same, with `ENABLE_TOOL_SEARCH=false` so all 238 schemas sit in the prompt up front, about 305k tokens as the provider renders them. |

Three models, Claude Sonnet, Haiku and Opus 5.5 at default effort, one session per task, 180 sessions on 2026-11-08, no errors. `scripts/trace-score.ts` reads the session files: "done" is a per-task rubric over the calls made (the right tool with the right arguments, or the right skill loaded and the answer showing it), "first step" is whether the first group opened, skill read or tool called fits the task, as in the selection trial. Token counts are the provider's, summed over turns, cache reads included. Full table with every call: `results/traces/traces-public/summary.md`.

| Condition | Model | Done | First step | Median turns | Median wall s | Cost USD | Input tokens | From cache |
| :-- | :-- | --: | --: | --: | --: | --: | --: | --: |
| groups | Sonnet 5.5 | 20/20 | 20/20 | 5 | 16 | 1.18 | 2.37M | 92% |
| groups | Haiku 5.5 | 16/20 | 17/20 | 5 | 16 | 0.09 | 2.36M | 88% |
| groups | Opus 5.5 | 20/20 | 20/20 | 5 | 19 | 2.66 | 2.32M | 90% |
| flat-toolsearch | Sonnet 5.5 | 20/20 | 18/20 | 3 | 13 | 1.67 | 1.96M | 83% |
| flat-toolsearch | Haiku 5.5 | 18/20 | 19/20 | 4 | 13 | 0.10 | 2.15M | 84% |
| flat-toolsearch | Opus 5.5 | 20/20 | 20/20 | 4 | 16 | 3.56 | 2.22M | 84% |
| flat-all-schemas | Sonnet 5.5 | 20/20 | 19/20 | 3 | 12 | 3.53 | 16.5M | 97% |
| flat-all-schemas | Haiku 5.5 | 19/20 | 20/20 | 3 | 13 | 1.33 | 16.6M | 97% |
| flat-all-schemas | Opus 5.5 | 20/20 | 20/20 | 3 | 15 | 7.72 | 18.4M | 97% |

- Sonnet and Opus completed every task under every condition. Haiku missed 4, 2 and 1. Its groups-mode misses are answers given without opening a group or reading a skill (the class review, the nightly schedule, the fetch-handler question) and one attempt to use the disallowed Bash tool. One of its two `flat-toolsearch` misses is a session that also called the host's `Workflow` tool.
- Groups cost a turn. Opening a group is a round trip, and the nested toolset groups often cost two (`turnstile-api`, then `turnstile-widgets`): median 5 turns against 3 or 4, and 3 to 4 seconds more wall time per task. The second open comes from this demo's tree. `productToolsets()` in `src/catalog.ts` gives a product group only the tools at the product's root path, and 5 of the 10 subset products (Turnstile, Durable Objects, KV, R2, containers) have none there, so the parent holds only child groups. The SEP says servers SHOULD keep hierarchies shallow and that groups pay disclosure once. The second round runs a one-level tree.
- Loading every schema up front reads seven to eight times the input tokens of groups, but costs only three times as much on Sonnet and Opus. On Haiku it costs 14 times as much, 1.33 against 0.09 USD. The provider's cache explains the gap: the 305k-token prefix is written once per model and read from cache on every turn of every session, 97% of all input. Groups read 2.32M to 2.37M input tokens per model and the host's tool search 1.96M to 2.22M. Groups cost less in dollars because more of their input came from cache, 88% to 92% against 83% to 84%.
- On this catalog, the host's tool search does for the flat server what groups do: same completion, a nearby token band, one fewer turn. `register.ts` registers scoped tools with `isDeferred` true by default, so they load through ToolSearch after each `open_group`, 19 to 21 calls per model against 16 to 19. Five of those calls, four of them Haiku's, searched for host tools such as `Read`. The run shows groups composed with host tool search. The second round tests a client without it. Groups add the bundle: instructions and a skill delivered with the tools.
- The mod does not use the Skills extension. `open_group` reads the listed SKILL.md with `resources/read` and inlines it in the tool result. It never calls `skills/get` and checks no digests. The run does not exercise #22's interop rules 1 and 2 or Example 3's steps 3 and 4, and it loads the skill on group open, which the SEP says a group fetch does not do. The `skills/get` and digest checks in this repository are in `scripts/compare.ts`.
- Three tasks depend on data a dry-run server never returns. `push-build` needs a file the session cannot read, `purge-sessions` needs the key names a list would return, `instances-with-data` needs namespace ids. Every session said why it stopped, and every one started toward the task except Haiku's two missed `instances-with-data` sessions. On `push-build`, Sonnet uploaded a placeholder bundle in two of its three sessions, Haiku in one, and Opus in one or two, depending on whether a call that sent the file's name as its content counts. On `purge-sessions`, all three Sonnet sessions and two Opus sessions filled a bulk delete with made-up key names, and the other Opus session refused to. The rubrics accept the first step for these three.
- Prefix sizes, from the session usage: about 21k tokens on the first request for groups (Claude Code's system prompt, the mod's section and three helper tools), about 25k for tool search (the 238 tools as deferred names), about 305k with all schemas up front. In groups mode, the request after an open wrote a median 0.5k tokens to the cache, and the request after the ToolSearch call that loaded the group's tools a median 1.5k. The rest was read from cache. A session grew by a median 3.8k tokens from its first request to its last. With tool search off, a registration rewrites the prefix.
- The headless sessions load the user-level Claude Code plugins and hooks of this machine, the same overhead in every arm. One model family on one host, 20 tasks, one sample each. The `flat-toolsearch` arm is Claude Code's tool search; another host's would differ.

Raw session files are not committed: they embed the full system prompt and account ids. `scripts/trace-redact.ts` keeps the `user` and `assistant` rows, strips paths and ids, and refuses to write anything key-shaped. The result is `results/traces/traces-public/`, 180 files with the scrubbed index and its own README, which `npm run trace:score -- --label traces-public` re-scores. The same folder is attached as a zip to the release `traces-2026-11-08`.

## Second round, 2026-11-09: the rewritten build, a client without tool search, and the duplicate listing

The second round tested three questions. A: does a groups server rebuilt to the guidance in #19 behave differently from the as-generated one, and how do both compare with flat behind host tool search? B: what do groups cost in a client without tool search? C: does listing a grouped workflow in both `groups/list` and `skills/list` cost anything?

### What changed

- `opt2-rec`, a new variant, deployed at `https://pd-groups-opt2-rec.olahungerford.workers.dev/mcp`. It is called the rewritten build below, and the `-rec` in its name stands for the two recommendations it follows. It takes the two SHOULDs from #19: descriptions that carry task vocabulary, and a shallow hierarchy. The one-level split, the size cap and leaving grouped skills out of `skills/list` are this demo's choices. Every group is top level. A product stays one group unless it has more than 25 tools or about 15k tokens of schemas. A larger one is split by its second-level directories, and areas under 4 tools join a `-core` group. On the subset that splits `workers` into 8 groups and `r2` into 3, for 22 groups. On the full catalog it gives 271. The subset's 19 product descriptions were written by hand. The full catalog's 249 others were written by Sonnet 5.5 from each group's tool descriptions (`scripts/describe-groups.ts`) and the ones round one's misses landed on were reviewed by hand. Each workflow group's description says when to open it against the product group ("open `turnstile-api` to list or edit existing widgets"). A client that negotiated groups gets only `workers-best-practices` and `wrangler` in `skills/list`. That listing is served with `cacheScope: "private"`. The descriptions were written after round one's results, and some of the hand-written ones reuse wording from the v2 tasks. `describe-groups.ts` gave the writing model four hand-written descriptions as examples. The held-out task set below tests the rewritten build on tasks written after it, by models that did not see it.
- `opt2` is kept as the as-generated baseline. `demo_info` is gone from every variant. Its text is in the server `instructions`. Every selection prompt's "Top-level tools" line changed with it, so the flat-names and as-generated arms were re-run. The flat-schemas control was not. Its 2026-11-08 file still shows `demo_info`.
- The mod (0.2.0) no longer inlines the SKILL.md when a group opens. `open_group` returns the instructions, the tools and the skill's URI. `read_skill` fetches the entry with `skills/get`, reads the file and refuses it unless its SHA-256 matches the published digest. With `dedupGroupedSkills` (default on), a skill that is also a group is listed once, as the group, and `read_skill` on it opens the group first. Group opens are logged to the file `GROUPS_LOG` names.
- The knowledge rubrics (`state-holder`, `review-alarms`, `fetch-handler`) now require a `read_skill` call. Round-one rows, which have no mod version in the index, keep the old rule, so the committed round-one traces re-score unchanged.

### Tokens

`results/tokens/2026-11-09-deployed.txt`. Upfront is 1,221 tokens for `opt2-rec` against 674 for `opt2` (both now without `demo_info`), since the listing has 22 groups with longer descriptions. Task load for the three workflows: Turnstile 8,781, Durable Objects 2,322, email 11,661 with 33 tools (the bundle now includes the sending subdomains' DNS tools and the routing settings). Per group, from `groups/get`:

| Group | Tools | Task-load tokens |
| :-- | --: | --: |
| turnstile-spin | 6 | 2,211 |
| durable-objects | 3 | 953 |
| cloudflare-email-service | 33 | 10,168 |
| turnstile-api | 6 | 2,062 |
| durable-objects-api | 3 | 830 |
| email-sending-api | 21 | 6,127 |
| email-routing-api | 20 | 6,082 |
| workers-core | 20 | 11,351 |
| workers-deployments | 4 | 1,282 |
| workers-domains | 4 | 1,010 |
| workers-legacy | 18 | 36,196 |
| workers-previews | 10 | 24,278 |
| workers-routes | 5 | 868 |
| workers-secrets | 5 | 2,230 |
| workers-versions | 6 | 23,759 |
| d1-api | 11 | 3,240 |
| kv-api | 13 | 4,406 |
| r2-buckets | 35 | 13,360 |
| r2-objects | 5 | 2,462 |
| r2-super-slurper | 12 | 3,334 |
| queues-api | 25 | 6,548 |
| containers-api | 14 | 8,137 |

`workers-legacy`, `workers-previews` and `workers-versions` stay large after the split because their individual schemas are large: six `workers-versions` tools are 24k tokens. A one-level split by directory cannot make those smaller. On the full catalog the rewritten `groups/list` is 16,538 tokens in the selection prompt, against 3,856 for the as-generated 139 groups and 81,586 for 3,036 tool names.

### Selection

The 20 v2 tasks, one sample, the skill index in every prompt, as in the 2026-11-08 run. Four arms: as-generated (`opt2`), rewritten (`opt2-rec`), rewritten with every skill listed (`--list-all-skills`, which reads `skills/list` as a client that declares only the Skills extension), and flat names. The rewritten server's split groups are accepted where they hold the task's tools: `r2-buckets` for CORS and lifecycle, `workers-versions`, `workers-deployments` or `workers-legacy` for pushing a build, `workers-core` for the schedule, and on the full catalog `dns-records`, the four `builds-*` groups and `accounts-tokens` or `user-tokens`. Runs that record the served group names (every 2026-11-09 run) accept only names that exist. Raw answers are in `results/select/2026-11-09-select2-*.jsonl`.

Baseten's DeepSeek V4.1 Flash answered 503 or 429 to most calls on 2026-11-09. Its seven cells were run again in full on 2026-11-12, on Baseten, against the same servers and prompts, and every call was answered. The table shows the 2026-11-12 runs (`results/select/2026-11-12-select2-*-deepseek-baseten.jsonl`). The OpenAI account ran out of credits partway through, and the trials it failed were asked again with `--retry` on 2026-11-09.

| What the model read | Tokens before the task | Qwen 3.5 9B | Qwen3 14B | GLM-5.3 Flash | DeepSeek V4.1 Flash | Qwen3.6 35B-A3B | Gemma 4 26B |
| :-- | --: | --: | --: | --: | --: | --: | --: |
| As-generated, 13 groups and 5 skills (subset) | 616 | 17/20 | 16/20 | 19/20 | 19/20 | 19/20 | 19/20 |
| Rewritten, 22 groups and 2 skills (subset) | 1,112 | 19/20 | 20/20 | 20/20 | 20/20 | 18/20 | 20/20 |
| Rewritten, 22 groups and all 5 skills (subset) | 1,190 | 18/20 | 20/20 | 20/20 | 20/20 | 19/20 | 20/20 |
| 237 tool names and 5 skills, flat | 6,892 | 15/20 | 19/20 | 19/20 | 20/20 | 19/20 | 20/20 |
| As-generated, 139 groups and 5 skills (full catalog) | 3,856 | 10/20 | 16/20 | 19/20 | 19/20 | 15/20 | 18/20 |
| Rewritten, 271 groups and 2 skills (full catalog) | 16,538 | 17/20 | 18/20 | 19/20 | 19/20 | 20/20 | 20/20 |
| 3,036 tool names and 5 skills, flat | 81,586 | 6/20 | not run (40k context) | 19/20 | 19/20 | 17/20 | 18/20 |

| What the model read | Opus 5.5 | Sonnet 5.5 | Haiku 5.5 | GPT-6 Astra | GPT-6.1 Sol | GPT-6.1 Terra | GPT-6 Luna | Gemini 4 Argon | Gemini 3.8 Flash | Kimi K3.1 Pro | Decisions API (Luna) | Jev |
| :-- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: |
| As-generated, 13 groups (subset) | 20/20 | 20/20 | 20/20 | 20/20 | 20/20 | 20/20 | 19/20 | 19/20 | 20/20 | 20/20 | 19/20 | 20/20 |
| Rewritten, 22 groups (subset) | 20/20 | 20/20 | 20/20 | 20/20 | 20/20 | 20/20 | 20/20 | 20/20 | 20/20 | 20/20 | 20/20 | 19/20 |
| Rewritten, all 5 skills (subset) | 20/20 | 20/20 | 20/20 | 20/20 | 20/20 | 20/20 | 20/20 | 20/20 | 20/20 | 20/20 | 20/20 | 19/20 |
| 237 tool names, flat | 20/20 | 20/20 | 19/20 | 20/20 | 18/20 | 17/20 | 19/20 | 20/20 | 20/20 | 20/20 | | |
| As-generated, 139 groups (full catalog) | 20/20 | 19/20 | 19/20 | 20/20 | 20/20 | 20/20 | 19/20 | 19/20 | 17/20 | 19/20 | 20/20 | 16/20 |
| Rewritten, 271 groups (full catalog) | 20/20 | 20/20 | 19/20 | 20/20 | 20/20 | 20/20 | 19/20 | 20/20 | 20/20 | 20/20 | over 255 choices | too long |
| 3,036 tool names, flat | 20/20 | 19/20 | 18/20 | 20/20 | 20/20 | 18/20 | 19/20 | 20/20 | 18/20 | 20/20 | | |

- A: at the full catalog, the rewritten build raised the two open models the as-generated one had cost most: Qwen 3.5 9B from 10 to 17 and Qwen3.6 35B-A3B from 15 to 20. Qwen3 14B (16 to 18) and Gemma (18 to 20) moved by two, which is inside the noise. Every hosted model scored 19 or 20 of 20 on it. The price is the listing: 16,538 tokens against 3,856, about a fifth of the 81,586-token name list.
- A: the largest group of misses at 271 groups is one confusion, `pipelines-api` for the dead-letter destination on "the orders pipeline" (3 models). Retried background jobs was missed by two models, and every other miss is a single model. At 139 as-generated groups the misses spread across `iam-api`, `sql-api`, `durable-objects`, `workers-best-practices` and others, as in round one.
- A: on the subset every model scored 18 to 20 of 20 on the rewritten build, against 16 to 20 as-generated. Most of those gaps are inside one or two tasks, so the subset result is that the rewritten build does no harm.
- C: on the subset, listing every skill as well cost no correct picks: each model is within one task of itself between the two rewritten arms. Skill answers on tasks that accept a group fell to 0 across all models with the grouped skills left out, against 3 open-model and 5 hosted-model answers with them listed (Gemini 3.8 Flash 2, Opus, Haiku, Kimi, GLM, DeepSeek, Qwen3.6 one each). All 8 are `skill:durable-objects` on the two Durable Objects tasks, 6 on the alarm review and 2 on the state holder, and all are scored correct. The completion run's rubric for both tasks requires reading that skill. Neither arm sent a task that needs a group to `wrangler` or `workers-best-practices`. On the as-generated server the same count was 18 for the open models and 17 for the hosted models, plus one from Jev, and 17 of those 36 were `wrangler` or `workers-best-practices`. The arm that still lists every skill has 8, so most of the drop came from the rest of the rewritten build, not from leaving grouped skills out of the listing. Counted as in the round-one table, a grouped skill on a task that accepts an `-api` group, the as-generated server's highest count in this round was 5 (Gemini 3.8 Flash, 139 groups), and the rewritten arm with every skill listed had 2 in total. Leaving grouped skills out of the as-generated server was not run.
- The classifiers cannot take the full rewritten listing. The Decisions API caps a choice list at 255 and the listing has 271 groups plus skills and none. Jev rejects the same list as too long.

### Task completion

Five conditions, three models, 20 tasks, 300 sessions on 2026-11-09, no errors, 35.27 USD. Every arm was re-run the same day. Jobs for different conditions and models ran side by side. Full table with every call: `results/traces/traces2-public/summary.md`.

| Condition | What the model has |
| :-- | :-- |
| `groups-rec` | The mod against `opt2-rec`, scoped tools deferred behind the host's tool search, grouped skills listed once. |
| `groups-rec-resident` | The same with `ENABLE_TOOL_SEARCH=false` and scoped tools registered resident, as a client without tool search would. |
| `groups` | The mod against `opt2`, scoped tools deferred, every skill listed. |
| `flat-toolsearch` | As in round one. |
| `flat-all-schemas` | As in round one. |

| Condition | Model | Done | Median turns, 12 product tasks | p50 wall s | Cost USD | Input tokens | From cache | Cache writes | ToolSearch calls | Group opens per session |
| :-- | :-- | --: | --: | --: | --: | --: | --: | --: | --: | --: |
| groups-rec | Haiku 5.5 | 17/20 | 5 | 19.1 | 0.08 | 1.75M | 85% | 270k | 18 | 0.95 |
| groups-rec | Sonnet 5.5 | 20/20 | 5 | 16.6 | 1.26 | 1.59M | 85% | 244k | 18 | 0.95 |
| groups-rec | Opus 5.5 | 20/20 | 5 | 23.7 | 2.59 | 1.54M | 84% | 243k | 16 | 0.95 |
| groups-rec-resident | Haiku 5.5 | 16/20 | 4 | 18.4 | 0.18 | 2.51M | 71% | 729k | 0 | 0.90 |
| groups-rec-resident | Sonnet 5.5 | 20/20 | 4 | 15.2 | 2.91 | 2.68M | 76% | 643k | 0 | 1.05 |
| groups-rec-resident | Opus 5.5 | 20/20 | 4 | 20.9 | 6.32 | 2.81M | 75% | 695k | 0 | 0.95 |
| groups | Haiku 5.5 | 18/20 | 6 | 20.6 | 0.09 | 1.93M | 85% | 290k | 28 | 1.90 |
| groups | Sonnet 5.5 | 20/20 | 5 | 20.7 | 1.26 | 1.53M | 84% | 241k | 18 | 1.90 |
| groups | Opus 5.5 | 20/20 | 6 | 24.2 | 2.64 | 1.68M | 86% | 241k | 19 | 1.85 |
| flat-toolsearch | Haiku 5.5 | 20/20 | 3 | 19.0 | 0.11 | 1.60M | 76% | 392k | 18 | |
| flat-toolsearch | Sonnet 5.5 | 20/20 | 4 | 15.3 | 1.72 | 1.51M | 76% | 362k | 16 | |
| flat-toolsearch | Opus 5.5 | 19/20 | 4 | 21.5 | 3.53 | 1.54M | 76% | 367k | 18 | |
| flat-all-schemas | Haiku 5.5 | 20/20 | 3 | 17.5 | 1.31 | 15.9M | 97% | 474k | 0 | |
| flat-all-schemas | Sonnet 5.5 | 20/20 | 3 | 15.9 | 3.62 | 16.5M | 97% | 471k | 0 | |
| flat-all-schemas | Opus 5.5 | 20/20 | 3 | 21.1 | 7.63 | 17.4M | 97% | 489k | 0 | |

- A: the rewritten build halved the group opens, 0.95 per session against 1.85 to 1.90, and every other measure moved by less than the noise: the same completion, the same median turns on the 12 product tasks except Haiku and Opus at 5 against 6, and p50 wall 0.5 to 4 seconds lower. The second open in round one came from the two-level tree, and the one-level tree removes it.
- A: the host's tool search still finishes in fewer turns, a median of 3 or 4 on the product tasks against 5. The deferred rewritten arm cost less, 1.26 against 1.72 USD on Sonnet and 2.59 against 3.53 on Opus, with input tokens within 15% of each other.
- B: without tool search, sessions took fewer turns and more tokens. Every model took one fewer median turn on the product tasks (4 against 5), made no ToolSearch calls, and ran 0.7 to 2.8 seconds faster at p50. But each resident open rewrites the cached prefix: cache writes were 2.6 to 2.9 times the deferred arm's, input tokens 1.4 to 1.8 times, and cost 2.2 to 2.4 times. On Opus the turn after a resident open read a median of nothing from cache and wrote a median 30k tokens. After a deferred open every model read the whole prefix from cache and wrote a median under 1k. Part of the prefix did come from cache on 8 of 18 resident opens on Sonnet, 7 of 18 on Opus and 3 of 15 on Haiku. The likely source is prefixes other sessions in the batch had written, so a single cold session would cost more. This is the case the SEP's prompt-caching section describes for clients that keep tool definitions in the cached prefix. Appending tools after the prefix, which it describes for providers that support it, was not tested in this round, and neither was any open model. Both are in the open-model agent run below. In the smoke run one `r2-buckets` open took the prefix from 25.7k to 48.7k tokens as the provider renders it, 23k for a group that measures 13.4k in o200k.
- Opening a group no longer loads its skill, and Sonnet and Opus read the skill anyway in every session that opened a workflow group, 4 to 6 of the 8 workflow tasks per model and arm. They completed all 8 in both rewritten arms and made 8 to 10 `read_skill` calls per model over the 20 tasks. Haiku answered the two Durable Objects knowledge tasks and the fetch-handler question from its own knowledge in one turn in several groups arms, which the rubric now scores as a miss. In round one the same answers counted, because the group open had already put the SKILL.md in context.
- `read_skill` in mod 0.2.0 has one path, `skills/get` and then a digest check, and none of round two's 139 calls returned an error. The redacted traces do not record the `skills/get` requests.
- Haiku's `nightly` miss in the resident arm planned to use `CronCreate`, a host built-in that `trace-run.ts` does not disallow. Its one call was a Bash `date`, which was refused, and it stopped to ask for a timezone.
- In `flat-toolsearch`, every model called ToolSearch at least once on each of the 16 tasks that need a tool, in both rounds. The sessions with no call are the three knowledge tasks, plus Sonnet on `rotate-token`, the no-fit task, which it answered correctly without a tool. On these tasks no miss came from a model failing to search.

Raw sessions are under `results/traces/traces2/` (gitignored). `results/traces/traces2-public/` is the redacted copy, 300 sessions with each session's group-open log, and re-scores identically.

## Held-out task set, 2026-11-10

The v2 tasks were written by this demo's author, who had read the group descriptions. The v3 set was written by two models the demo does not test, from a product name alone, and run on the full catalog against the three servers from round two.

### How the tasks were made

- `scripts/write-tasks.ts` gave Fable 5.2 and Gemini 3.6 Flash one product at a time, as `Cloudflare <product> (API directory "<dir>")`, with rules: one or two sentences, no product, Cloudflare or API names, a job done by reading or changing account resources, and SKIP for a product the writer does not know. Neither writer saw a group listing, a tool name or a description. Products were drawn from the 136 forge directories in a seeded order (mulberry32, seed 20261109), and each writer took 3 of the 10 subset products and 7 of the others.
- Six of the first 20 tasks spanned products, missed their product or repeated its name (smartShield, emailAuth, observability, signedUrl, connectorTelemetrySnapshots, diagnostics). Fable redrew them from the next products in the same stratum, with two added rules: the job needs only this product, and no word from its name. It skipped cps and connectorInterrupts in the redraw, and webAssets in the first pass. The final set is 14 Fable tasks and 6 Gemini tasks in `results/tasks/v3/tasks.json`. Every reply, skips included, is in `results/tasks/v3/raw.jsonl`.
- Accepted answers were fixed before any model ran. `scripts/v3-answers.ts` names the tools that do any step of each task, by name prefix from the catalog. It accepts a top-level group when that group or one nested under it returns one of those tools from `groups/get` on the served variant, and writes `tasks/select-v3.json`. Six near neighbours are not among the accepted groups and count as misses: `dls-api` for EU processing, `connector-telemetry-snapshots-api` and `connectors-api` for the appliance events, `network-api` for the private connection, `ai-gateway-logs` for the LLM proxy and `web-assets-labels` for the endpoint inventory. This list was written after the runs, and the accepted answers were not changed. The EU-processing task was written from the product `dls`. The catalog's `dls` tools do not create or list regional hostnames, so `dls-api` is a miss.
- `npm run select -- --tasks v3`, with the same prompts and settings as round two: one sample, the skill index in every prompt. Three arms: 271 rewritten groups (16,538 tokens), 139 as-generated groups (3,856) and 3,036 tool names flat (81,586). Raw answers are in `results/select/2026-11-10-select3-full-*.jsonl`.

### Selection

Correct picks out of 20. The two flat columns are explained below the table.

| Model | Rewritten, 271 groups | As-generated, 139 groups | Flat names, strict | Flat names, first-call rule |
| :-- | --: | --: | --: | --: |
| Qwen 3.5 9B | 17 | 3 | 15 | 15 |
| Qwen3 14B | 17 | 9 | not run (40k context) | |
| GLM-5.3 Flash | 19 | 14 | 20 | 20 |
| DeepSeek V4.1 Flash | 19 | 18 | 20 | 20 |
| Qwen3.6 35B-A3B | 19 | 9 | 17 | 17 |
| Gemma 4 26B | 19 | 16 | 15 | 17 |
| Opus 5.5 | 20 | 19 | 15 | 19 |
| Sonnet 5.5 | 20 | 19 | 18 | 20 |
| Haiku 5.5 | 20 | 19 | 18 | 19 |
| GPT-6 Astra | 20 | 19 | 13 | 19 |
| GPT-6.1 Sol | 20 | 18 | 13 | 19 |
| GPT-6.1 Terra | 20 | 18 | 11 | 18 |
| GPT-6 Luna | 18 | 16 | 19 | 20 |
| Gemini 4 Argon | 20 | 19 | 11 | 19 |
| Gemini 3.8 Flash | 20 | 19 | 15 | 19 |
| Kimi K3.1 Pro | 20 | 20 | 18 | 19 |
| Decisions API (Luna) | over 255 choices | 17 | | |
| Jev | too long | 15 | | |

- On the rewritten build the open models scored 17 to 19 and the hosted models 18 to 20, close to their round-two scores on the v2 tasks. The largest group of misses is one task: 5 of 12 on the private connection (`workers-vpc-api` 3, `network-api` 2). Two went to `connector-telemetry-snapshots-api` for the appliance events and two were on the LLM proxy. Three tasks were missed once each.
- On the as-generated build the open models scored 3 to 18, and five of them lost 3 to 14 tasks against the rewritten build. The hosted models scored 16 to 20. EU processing was missed 14 times across models and classifiers (`zones-api` 7, `dls-api` 5). Its tools sit in `addressing-api`, whose templated description names only the product. This repeats round one's finding on templated descriptions on tasks nobody tuned for, with a wider gap.
- One Haiku answer on the as-generated build gave `queues-api`, the accepted group, twice with a sentence between. The parser of the time rejected it, and this table showed 18 until 2026-11-23, when the answer was parsed again.
- Flat, strict: the prompt asks for the tool a model would call first, and the committed answers list only the tools that do the job. A lookup first therefore scored a miss: `zones_list` on 37 picks, mostly for tasks that name a domain, and `d1_list` on 6 picks before a query. `scripts/v3-rescore.ts` applies a first-call rule decided after the results. It also accepts any tool of a needed tool's product, as v2's product prefixes did, and `zones_list` or `zones_get` when a needed tool's path takes `{zone_id}` (9 tasks, read from the catalog). Under it the hosted models score 18 to 20 flat, against 18 to 20 on the rewritten build. Groups did not measurably change what the hosted models picked. The open models do not move except Gemma, 15 to 17. The committed scoring and `--replay` are unchanged.
- The custom-pages task names a zone, but this catalog's custom-pages tools are account-level, so its 7 `zones_list` picks stay misses under the first-call rule.
- Writers: on the rewritten build the Claude models scored 60 of 60 and the Gemini models 40 of 40, across both writers' tasks. On the as-generated build the Claude models scored 41 of 42 on Fable's tasks and 16 of 18 on Gemini's, and the Gemini models 12 of 12 on Gemini's and 26 of 28 on Fable's. Each family scored higher on its own writer's tasks, which this set is too small to separate from chance. Three of those misses are `dls-api` on the EU-processing task. The rewritten build is at ceiling and shows nothing either way. On flat names under strict scoring the Gemini models scored 10 of 12 on Gemini's tasks and 16 of 28 on Fable's, and the Claude models 16 of 18 and 35 of 42.
- The classifiers ran on the as-generated listing only, for the reasons in round two: the Decisions API scored 17 and Jev 15.

## Open-model agent run, 2026-11-12

The completion runs above used Claude models through Claude Code, which defers tool loading. This run asks what groups cost when the client has no way to load tools mid-session, as the number of group opens in a session grows, and whether a client that keeps a fixed tool set still completes the tasks. The question came from the 2026-11-11 WG meeting.

### Setup

- `scripts/agent-tasks.ts`: five scenarios of six phases. A phase is one user turn that needs one or two tools from one group, and phase five returns to a group an earlier phase used, so a session opens five groups. The phases name no group and no tool. Each has a rubric over the tool calls and their arguments. Fable 5.2 wrote them with the subset's group listing and schemas in view. They were committed (`8d6e83f`) before the full runs. Only the rubrics' string-body handling changed after, as described below.
- `scripts/agent-run.ts` drives a model through the phases with its own loop, under three client designs. Arm A puts all 237 schemas of the flat Worker in `tools` from the first request. Arm B starts with `list_groups`, `open_group` and `read_skill` against `opt2-rec` and appends a group's tools to `tools` when it opens. Arm C keeps `tools` fixed at those three plus `call_tool(name, arguments)`, and `open_group` returns the schemas as tool-result text.
- Models: GLM-5.3 Flash and DeepSeek V4.1 Flash on Baseten, Qwen3.6 35B-A3B and Gemma 4 26B on DeepInfra, all through the Hugging Face router with thinking off, temperature 0.2 and streamed responses. Three samples per scenario, 15 sessions per cell. Arm A ran on the two Baseten models only.
- Reference: Claude Sonnet 5.5 through Claude Code with the mod against `opt2-rec`, scoped tools deferred, each phase a user turn in one process (`scripts/agent-ref.ts`).
- Cost is list price on 2026-11-12: GLM-5.3 Flash 0.15 USD per million input tokens, 0.03 cached, 0.50 output; DeepSeek V4.1 Flash 0.30, 0.007, 1.20; Qwen3.6 0.10, 0.10, 0.95; Gemma 0.07 with no cached price, 0.34.
- Full tables: `results/agent/2026-11-13-agent-summary.md`. The files are dated in UTC.

### The templates' mid-session paths did not work as sent

Both Baseten models' public chat templates can add tools after the first turn. GLM-5.3 Flash's template leaves out a tool marked `defer_loading` and renders it when a tool result carries a `tool_reference`. DeepSeek V4.1 Flash's template renders `tools` attached to a later system message. `scripts/agent-probe.ts` tried both on 2026-11-12, through the Hugging Face router to Baseten's chat completions endpoint (`results/agent/2026-11-13-agent-probe.txt`). The GLM endpoint rendered the 13 deferred schemas up front (4,455 prompt tokens against 234 without them) and answered a `tool_reference` tool result with HTTP 400. The DeepSeek endpoint accepted the system message and dropped its `tools` (407 prompt tokens against 4,726 with the tools resident), and the model called `open_group` again. So arm B re-sends a longer `tools` array. The 2026-11-19 probes [below](#deferred-loading-on-baseten-direct-2026-11-19-to-2026-11-21) found that Baseten's endpoint does load tools mid-session in another request shape.

### Cold sessions need the session id in the tool block

Each session's system prompt starts with a unique id, which was meant to keep sessions from reading each other's cache. The first B and C runs showed cache reads on a session's first request and on tool blocks the session had not sent before. Both Baseten endpoints behave as if tools are rendered ahead of the system prompt, so sessions that send the same tool list share its cached block. The runs were repeated with the session id also at the end of the first tool's description. The tables below are those cold runs. The earlier runs are kept as the shared-tool-block condition (`-shared` files), which is how a batch of sessions with one tool list would run.

### Completion

Phases done, cold runs, 15 sessions of 6 phases per cell:

| Model | Arm A, all schemas up front | Arm B, tools appended on open | Arm C, fixed tool set | Valid arguments, A | Valid arguments, B | Valid arguments, C |
| :-- | --: | --: | --: | --: | --: | --: |
| DeepSeek V4.1 Flash | 90/90 | 87/90 | 90/90 | 99% | 98% | 98% |
| GLM-5.3 Flash | 86/90 | 88/90 | 81/90 | 95% | 96% | 99% |
| Qwen3.6 35B-A3B | | 85/90 | 84/90 | | 55% | 97% |
| Gemma 4 26B | | 49/90 | 64/90 | | 51% | 70% |
| Sonnet 5.5, Claude Code, deferred loading | | 90/90 | | | | |

- On the two Baseten models the three arms finished within seven phases of each other. With the shared-tool-block runs added, DeepSeek finished 177 of 180 phases in B and 178 in C, and GLM 173 and 168.
- Arm C's arguments passed the tool's input schema at least as often as arm B's on every model. Against arm A it was one point lower on DeepSeek and four higher on GLM. The prediction written before the runs was that a model reading schemas as text would produce arguments that do not validate. That did not happen.
- Qwen3.6 in arm B passed the request body as a JSON string on 69 of its 71 invalid calls. The server accepts a string body, and the rubrics were meant to. The rubric code committed before the runs only unescaped quotes, so a string body with spaces after its colons did not match, and Qwen3.6 scored 48 of 90 in arm B. The fix parses string bodies and was made after seeing the results. No other cell changes under it. `--as-committed` reproduces the committed scoring (`results/agent/2026-11-13-agent-summary-as-committed.md`).
- Gemma's misses are wrong field names (`allowedOrigins` for `allowed.origins`, `query` for `sql`). Two of its arm C sessions ended when the Hugging Face account ran out of credit and were run again the same night.
- Six of GLM's nine arm C misses are one session. It put the tool's `name` inside `arguments` on every `call_tool`, the loop answered that `call_tool` needs a name and an arguments object, and the model repeated the same call through all six phases. A client that accepted that shape or explained the error would likely have recovered it. Three of GLM's 15 arm C sessions had a `call_tool` error and none of DeepSeek's.
- The other misses on the Baseten models repeat: a URL-encoded key name (`config%3Amax_width`, GLM in arms A and C, and in arm B's shared run), a migration target without the bucket's EU jurisdiction (GLM, arm B), and the incremental-migration tools used for a bulk migration (DeepSeek, arm B).
- Sonnet finished 30 of 30 phases in a pilot on the flat server behind the host's tool search and 90 of 90 with groups. The plan was to tune the tasks until a hosted model landed at 60 to 80 percent. That was not done: the tools are dry runs that return no data, and the tasks were left as first written.

### Cache and cost after an open

Cold runs. Re-read tokens are the part of the previous request's prompt that the request did not get from cache.

| Model | Arm | Requests after an open | Median re-read tokens | Requests re-reading over half | Other requests | Median re-read tokens, other | Other requests re-reading over half | Median first token ms, after an open / other |
| :-- | :-- | --: | --: | --: | --: | --: | --: | --: |
| DeepSeek V4.1 Flash | B | 75 | 3.0k | 19 | 191 | 126 | 0 | 506 / 344 |
| DeepSeek V4.1 Flash | C | 78 | 110 | 1 | 200 | 141 | 0 | 442 / 347 |
| GLM-5.3 Flash | B | 75 | 6.8k | 39 | 211 | 91 | 13 | 1048 / 686 |
| GLM-5.3 Flash | C | 75 | 151 | 0 | 259 | 76 | 1 | 840 / 681 |
| Sonnet 5.5, Claude Code | deferred | 72 | 2 | 0 | 267 | 2 | 0 | |

- Arm B lost part of its cache at every open, and the loss grew with the session. On DeepSeek the earlier tool block stayed cached and what followed it was re-read: a median 1.5k tokens at the first open, then 2.4k, 3.2k, 3.8k and 5.4k at the fifth. On GLM the median at opens two to five was 6.8k to 9.2k, and 15 of those 60 requests re-read at least 90% of the previous prompt. The claim under test predicted cached tokens near zero after every open. The observed loss is the conversation and system prompt on DeepSeek, and more than that on GLM.
- Arm C kept its cache across opens: a median 110 and 151 tokens re-read. The Claude Code reference re-read a median 2 tokens after 72 opens and wrote a median 523 to cache.
- On GLM, 13 of the 75 requests that came second after an open also re-read over half of the previous prompt. No later request in arm B did, and arms A and C had one such request each in over 220. These misses follow the tool change and are part of arm B's cost. The shared runs had misses at every position, 37 of 218 requests in arm B and 24 of 235 in arm C.

Mean cumulative cost per session in USD through each phase:

| Model | Arm | Sessions | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Phase 6 | Input tokens not from cache, 6 phases |
| :-- | :-- | --: | --: | --: | --: | --: | --: | --: | --: |
| DeepSeek V4.1 Flash | B | 15 | 0.0045 | 0.0079 | 0.0112 | 0.0151 | 0.0164 | 0.0223 | 58.1k |
| DeepSeek V4.1 Flash | C | 15 | 0.0041 | 0.0070 | 0.0090 | 0.0116 | 0.0132 | 0.0167 | 38.8k |
| GLM-5.3 Flash | B | 15 | 0.0036 | 0.0075 | 0.0117 | 0.0164 | 0.0182 | 0.0233 | 90.6k |
| GLM-5.3 Flash | C | 15 | 0.0024 | 0.0049 | 0.0077 | 0.0109 | 0.0129 | 0.0169 | 32.7k |
| DeepSeek V4.1 Flash | A | 15 | 0.0657 | 0.0703 | 0.0745 | 0.0795 | 0.0833 | 0.0871 | 212.6k |
| DeepSeek V4.1 Flash | A, shared tool block | 15 | 0.0063 | 0.0106 | 0.0146 | 0.0194 | 0.0231 | 0.0269 | 9.6k |
| GLM-5.3 Flash | A | 15 | 0.0436 | 0.0616 | 0.0760 | 0.0928 | 0.1073 | 0.1206 | 213.9k |
| GLM-5.3 Flash | A, shared tool block | 13 | 0.0317 | 0.0483 | 0.0626 | 0.0793 | 0.0937 | 0.1067 | 95.0k |
| Qwen3.6 35B-A3B | B | 15 | 0.0043 | 0.0116 | 0.0204 | 0.0311 | 0.0389 | 0.0532 | 182.2k |
| Qwen3.6 35B-A3B | C | 15 | 0.0042 | 0.0110 | 0.0185 | 0.0282 | 0.0372 | 0.0512 | 273.0k |
| Gemma 4 26B | B | 15 | 0.0018 | 0.0049 | 0.0083 | 0.0139 | 0.0169 | 0.0211 | 295.9k |
| Gemma 4 26B | C | 15 | 0.0027 | 0.0062 | 0.0111 | 0.0181 | 0.0246 | 0.0327 | 461.0k |
| Sonnet 5.5, Claude Code | deferred | 15 | 0.0419 | 0.0667 | 0.0929 | 0.1185 | 0.1399 | 0.1713 | 21.2k |

- Arm B cost 1.34 times arm C on DeepSeek and 1.38 times on GLM over six phases.
- Arm B's cumulative cost did not pass arm A's on either model in six turns with dry-run results. The follow-up runs below find where it does. A cold arm A session cost more after one phase (0.0657 USD on DeepSeek, 0.0436 on GLM) than arm B did after six (0.0223 and 0.0233). Over six phases cold arm A cost 3.9 times arm B on DeepSeek and 5.2 times on GLM. Each arm A request carried about 200k prompt tokens against about 20k in arm B.
- A cold arm A session pays for the tool block once. The first request was 203k prompt tokens on DeepSeek and 197k on GLM with none from cache, and took a median 3.9 and 5.7 seconds to the first token. Later requests read all but about 100 tokens of the previous prompt from cache, with a median 1.0 and 1.3 seconds to the first token, against 0.3 and 0.7 in arm B.
- With the tool block shared between sessions, arm A on DeepSeek cost 0.0269 USD over six phases, 1.2 times cold arm B, and stayed above it at every phase. DeepSeek's cached price is about 2% of its input price, and every shared session's first request read the tool block from cache. On GLM, whose cached price is a fifth of its input price, shared arm A cost 0.1067. Six of GLM's 15 shared sessions started with no cache read.
- The Hugging Face account answered HTTP 402 partway through the first arm A runs. Arm A was run again in full after a top-up, later the same night. The first attempt's rows are kept in `arm-a.jsonl`, and two GLM sessions of the shared run were not repeated.
- On DeepInfra the cache does not change the bill. Qwen3.6's cached price equals its input price, and Gemma reported no cache reads on any of its requests. There arm B and arm C differ by what they send: Gemma's arm C sessions sent 461k input tokens against 296k.
- In the shared runs, arm B on DeepSeek cost 0.0148 USD against arm C's 0.0158, since tool blocks other sessions had opened in the same order came from cache. On GLM the shared runs cost 0.0273 and 0.0195.

## Follow-up runs, 2026-11-13

The open-model run above had five weaknesses that could be checked or fixed with the same loop: cache behaviour was inferred, the loop's `call_tool` handling cost sessions, the catalog was the 237-tool subset, sessions were six turns, and dry-run tool results are about 100 tokens. This section checks each against the data and re-runs what it could. Summaries: `results/agent/2026-11-13-agent-summary-followup.md` and `results/agent/2026-11-13-agent-summary-chains.md`.

### What the first run's data confirms

- On DeepSeek the cost of appending tools is what sits after the old tool block. Of the 59 cold arm B opens after the first that read more than 256 tokens from cache, 47 read exactly the old tool block from cache, to the endpoint's 256-token step. On GLM the 45 such opens re-read a median 3.2k tokens more than that. Both use an estimate of the tool block in provider tokens from the jump in prompt tokens at each open, which no committed script computes.
- The dry-run results are small. A server tool result was a median of about 105 to 112 tokens in o200k, and an arm B conversation ended at about 4.5k. So the first run measured appending at close to its cheapest.
- The three samples of a scenario are near repeats. On the Baseten models they agree on which phases were done in 4 or 5 of 5 scenarios per cell, except GLM in arm A at 2 of 5, and in arms B and C cost varies 2 to 13% within a scenario against 17 to 32% between scenarios. So a cell holds about five independent samples.
- Of the 77 `call_tool` wrapper errors in arm C, cold and shared runs together, 64 put the tool's name inside `arguments` (54 in one GLM session, 10 in one Gemma session), 9 were GLM passing `arguments` as a string of invalid JSON, which it corrected within the phase, and 4 were Qwen3.6 sending no name.

### Where the endpoints put tools, from cache counts

`scripts/agent-probe-order.ts` warms a request, then changes one thing and reads `cached_tokens` (`results/agent/2026-11-13-agent-probe-order.txt`).

| Model, tool block | Prompt tokens | Repeat | New system prompt, same tools | First tool changed | Last tool changed |
| :-- | --: | --: | --: | --: | --: |
| DeepSeek V4.1 Flash, 13 tools | 5,548 | 5,376 | 4,352 | 256 | 4,352 |
| DeepSeek V4.1 Flash, 87 tools | 33,181 | 33,024 | 32,000 | 256 | 32,000 |
| GLM-5.3 Flash, 13 tools | 5,313 | 5,120 | 0 | 0 | 0 |
| GLM-5.3 Flash, 35 tools | 14,682 | 14,592 | 0 | 0 | 0 |
| GLM-5.3 Flash, 87 tools | 32,198 | 32,000 | 16,384 | 0 | 18,176 |

- Both Baseten endpoints cache as if tools are rendered ahead of the system prompt: a new system prompt still reads the tool block from cache, and a changed first tool reads nothing. On GLM this shows only with the 87-tool block. Render order is inferred from these counts and was not observed. DeepSeek's public chat template puts the system prompt first, which the counts do not match.
- DeepSeek reuses any shared prefix in 256-token steps. GLM reuses a prompt it has seen in full, and a shared part of one only in coarse steps: nothing under a 14.7k prompt, and about 16k of a 32k one.
- GLM read its cache only when the request carried the `x-session-affinity` header, which the agent loop sends per session. Without it the exact repeat read 0. DeepSeek was the same either way.
- Qwen3.6 on DeepInfra gave inconsistent counts across two runs of the probe.

### A tolerant call_tool

The loop now takes a tool name nested inside `arguments` and says what a rejected call was missing. Arm C again, cold, 15 sessions per cell:

| Model | Arm C as first run | Arm C, tolerant wrapper | Arm B |
| :-- | --: | --: | --: |
| GLM-5.3 Flash | 81/90 | 85/90 | 88/90 |
| Qwen3.6 35B-A3B | 84/90 | 85/90 | 85/90 |
| Gemma 4 26B | 64/90 | 64/90 | 49/90 |

The tolerant wrapper recovered the six misses of the one stuck session. Two new misses appeared in one migration session, which had no wrapper error, so the net gain is four. DeepSeek had no wrapper error in its 30 strict-wrapper sessions and was not run again.

### The full catalog

Arms B and C against the rewritten build of the full catalog, served locally: 3,036 tools in 271 groups, whose listing is 16.5k tokens in the system prompt. Arm A was not run here, since the schemas are 1.38M tokens. Cold, 15 sessions per cell.

| Model | Arm | Phases done | Cost per session, subset | Cost per session, full catalog | Median re-read after an open | Median first token ms after an open |
| :-- | :-- | --: | --: | --: | --: | --: |
| DeepSeek V4.1 Flash | B | 89/90 | 0.0223 | 0.0557 | 19.2k | 1070 |
| DeepSeek V4.1 Flash | B, listing in the first tool | 86/90 | | 0.0301 | 2.2k | 545 |
| DeepSeek V4.1 Flash | C | 88/90 | 0.0167 | 0.0237 | 108 | 611 |
| GLM-5.3 Flash | B | 88/90 | 0.0233 | 0.0553 | 22.4k | 1549 |
| GLM-5.3 Flash | B, listing in the first tool | 87/90 | | 0.0418 | 6.3k | 1061 |
| GLM-5.3 Flash | C | 86/90 | 0.0148 | 0.0297 | 101 | 736 |

- Choosing among 271 groups did not cost completion: 86 to 89 of 90 in every cell, as on the subset.
- Appending cost 2.4 times the fixed tool set on DeepSeek and 1.9 times on GLM, against 1.3 to 1.6 on the subset. GLM's subset cost for arm C in this table is the tolerant-wrapper run. Against its first run (0.0169 USD) the subset ratio is 1.4. The group listing sits in the system prompt, which these endpoints' caches place after the tool block, so every open re-read it.
- Moving the listing into the description of `list_groups`, the first tool, put it ahead of everything that changes. The re-read fell to 2.2k and 6.3k tokens and the cost to 1.3 and 1.4 times the fixed tool set. This is a client choice that depends on the endpoint caching tools first.

### Thirty-turn sessions and larger results

Each chained session runs all 30 phases, in scenario order or in reverse, and opens 15 to 17 groups, 16 in most. `--pad-results 2000` adds about 2,000 tokens of filler to every server tool result. Two sessions per cell, cold. Mean cost per session in USD:

| Model | Results | Arm A | Arm B | Arm C | Arm B passes arm A |
| :-- | :-- | --: | --: | --: | :-- |
| DeepSeek V4.1 Flash | dry-run size | 0.188 | 0.133 | 0.110 | not in 30 turns |
| DeepSeek V4.1 Flash | padded | 0.250 | 0.395 | 0.135 | at turns 12 and 13 |
| GLM-5.3 Flash | dry-run size | 0.506 | 0.274 | 0.177 | not in 30 turns |
| GLM-5.3 Flash | padded | 1.074 | 0.462 | 0.435 | not in 30 turns |

- The re-read after an open grew through the session. On DeepSeek with dry-run results it went from 1.5k tokens at the first open to 20.9k at the sixteenth. With padded results it passed 100k.
- With padded results on DeepSeek, appending passed all schemas up front at turn 12 in one session and turn 13 in the other, and cost 1.6 times as much by turn 30. This is the crossover the claim under test predicted. It did not appear with dry-run results. With padded results the fixed tool set cost a third of appending. Arm A started cold in these sessions. The 2026-11-14 sessions below add four sessions to each DeepSeek cell and an arm A whose tool block is already cached.
- By the end of a session arm B had loaded 203 of the 237 tools. An appending client that never unloads ends up sending most of the catalog and re-reading the conversation on the way.
- GLM's cache missed with no tool change in long sessions, 2 to 16 times per roughly 150 requests in every cell but unpadded arm A. Four misses in padded arm A re-read 1.7M tokens. DeepSeek had none in about 790 such requests. The GLM row measures that endpoint's cache more than the client design.
- Completion held at 58 to 60 of 60 phases in every cell.

## More 30-turn sessions on DeepSeek, 2026-11-14

The 2026-11-13 chained cells were two sessions each, and every arm A session started cold. Samples 2 and 3 were added to the DeepSeek cells, which makes six sessions per cell: three seeds in each order. Arm A was also run with `--shared` after a warm-up session, so its tool block was in the cache before each session's first request. Cold arm A with dry-run results and the GLM cells were not run again. Mean cost per session in USD, with the range over the sessions:

| Results | Arm A, cold | Arm A, tool block cached | Arm B | Arm C |
| :-- | :-- | :-- | :-- | :-- |
| dry-run size | 0.188 (0.179 to 0.197, two sessions) | 0.146 (0.134 to 0.164) | 0.133 (0.117 to 0.154) | 0.104 (0.075 to 0.144) |
| padded | 0.244 (0.231 to 0.264) | 0.198 (0.182 to 0.218) | 0.394 (0.377 to 0.411) | 0.150 (0.133 to 0.215) |

- With padded results, arm B's cumulative cost passed cold arm A's between turns 10 and 13: at turn 10 in two of the six same-seed pairs, turn 12 in three and turn 13 in one. Arm B cost 1.6 times arm A by turn 30, as on 2026-11-13.
- Where arm B passes arm A depends on arm A's cold start. A cold arm A session's first request cost 0.061 USD for the 203k-token tool block. With the block cached it cost 0.0017 USD. Arm B with padded results was then above arm A by turn 3 in every pair and cost 2.0 times as much by turn 30.
- With dry-run results arm B stayed below cold arm A at every turn and cost 0.71 times as much at turn 30. Against arm A with the block cached, arm B's mean ended at 0.91 times arm A's. In two of the six pairs arm B was above arm A from turn 18 or 19.
- Arm A with the block cached still reads it on every request. At DeepSeek's cached price that is 0.0014 USD per request, 0.11 of the 0.146 USD over a mean 77 requests. The cached price is about 2% of DeepSeek's input price, and arm A's cost here depends on it.
- Arm C cost 0.38 times arm B with padded results and 0.78 times with dry-run results. It cost 0.76 and 0.71 times arm A with the block cached.
- Phases done: 180 of 180 in arm B with both result sizes, and in arm C and cached arm A with dry-run results. Both padded arm A cells did 179, and padded arm C 177.
- Sixteen sessions ended in an HTTP 429 or 503 from the provider, eleven while about 14 sessions ran at once and five at three at a time. Each was run again with the same seed. The files keep the errored sessions, and the scorer leaves one out when its re-run completed. No completed session re-read more than half of its previous prompt outside the request after an open. The five sessions run last are in files dated 2026-11-15, the UTC date.

## Deferred loading on Baseten direct, 2026-11-19 to 2026-11-21

The open-model runs above assumed the Baseten endpoints could not load tools mid-session. That came from one probe, sent through the Hugging Face router in the chat templates' request shape. Baseten documents deferred loading in another shape: `defer_loading` beside `function` on each tool, and a tool result of `tool_reference` blocks keyed by `tool_name`. These runs test that shape. The earlier sections stand as measurements of a client that appends to `tools`.

### Deferred loading probes

`scripts/agent-probe-deferred.ts` sends `open_group` plus the 24 tools of `kv-api` and `d1-api`, with about 7k tokens of filler in the system prompt (`results/agent/2026-11-19-agent-probe-deferred.txt`). One conversation per model and one request per row. Each cell is prompt tokens / cached tokens.

| Request | GLM-5.3 Flash, Baseten direct | DeepSeek V4.1 Flash, Baseten direct | GLM-5.3 Flash, Hugging Face router | DeepSeek V4.1 Flash, Hugging Face router |
| :-- | --: | --: | --: | --: |
| 24 tools deferred, first turn | 7,509 / 0 | 7,013 / 0 | 14,812 / 0 | 14,504 / 0 |
| `open_group` only, first turn | 7,505 / 0 | 7,021 / 0 | 7,507 / 0 | 7,039 / 0 |
| After opening kv, `tool_reference` by `tool_name` | 11,753 / 7,424 | 11,462 / 6,912 | 14,829 / 14,592 | 14,554 / 14,336 |
| After opening d1, `tool_reference` by `tool_name` | 14,918 / 11,520 | 14,813 / 11,264 | 7,917 / 0 | 7,580 / 0 |
| Control, kv appended to `tools` | 11,748 / 0 | 11,406 / 256 | 11,750 / 0 | 11,425 / 256 |
| Control, d1 appended to `tools` | 14,913 / 0 | 14,702 / 4,608 | 14,915 / 0 | 14,724 / 4,608 |

- On Baseten direct the deferred schemas stayed out of the prompt, each reference loaded its group's schemas, and the request read the whole earlier prompt from cache. Both models called the loaded tool.
- Appending the same tools to `tools` on the same endpoint read 0 to 4,608 tokens from cache.
- Through the router the 24 deferred tools were sent in full on the first turn. After the second open the prompt fell to 7.9k and 7.6k tokens and neither model called a D1 tool. Which layer behind the router produced this was not determined.
- The 2026-11-12 probe put `defer_loading` inside `function` and keyed its reference by `name`. On Baseten direct a flag inside `function` is ignored (14,814 and 14,478 prompt tokens on the first turn), and a `name`-keyed reference returns the HTTP 400 that probe got. DeepSeek's template path, `tools` on a later system message, was not tried on Baseten direct.
- `scripts/repro-deferred-loading.mjs` repeats the comparison with one deferred tool on DeepSeek, three runs (`results/agent/2026-11-20-repro-deferred-loading.txt`). After a `tool_reference` result, Baseten direct gave 7,484 to 7,490 prompt tokens with 3,840 cached and the model called the tool, in three of three. OpenRouter pinned to Baseten gave 3,909 to 3,911 prompt tokens and the model called `group_search` again, in three of three.
- Three other vendors' loading shapes were run against the same append control, which read 0 from cache at every load on all three. On Anthropic Messages with Haiku 5.5, a `tool_reference` result and a `tool_addition` system message both read the whole earlier prompt from cache, in three runs direct and three through OpenRouter (`results/agent/2026-11-21-agent-probe-anthropic.txt`). On OpenAI's Responses endpoint with GPT-6.1 Terra, a `tool_search_output` item read the whole earlier prompt at both loads, and an `additional_tools` item read the first 6.8k tokens at both, in five runs (`results/agent/2026-11-20-agent-probe-responses-openai.txt`). On the Gemini Interactions API with Gemini 4 Hydrogen, schemas returned in a `function_result` read the previous request from cache at both loads, in three runs (`results/agent/2026-11-21-agent-probe-gemini.txt`).
- The other `2026-11-20-agent-probe-*` and `2026-11-21-agent-probe-openrouter-*` files hold the same shapes sent through OpenRouter. They are not summarised here.

### Arm D on Baseten direct

`agent-run.ts --arm D` puts all 237 tools in `tools` with `defer_loading` from the first request, and `open_group` answers with `tool_reference` blocks. `--base-url` and `--key-env` send any arm to a provider's own endpoint. DeepSeek V4.1 Flash on `https://inference.baseten.co/v1`, the same five scenarios, three samples, cold, on 2026-11-20 (`results/agent/2026-11-20-agent-summary-direct.md`). Arm C used the tolerant wrapper.

| Arm | Complete sessions | Phases done | Valid arguments | Cost per session, USD | Input tokens not from cache | Median re-read after an open | Requests after an open re-reading over half |
| :-- | --: | --: | --: | --: | --: | --: | --: |
| A, all schemas up front | 9 | 67/67 | 98% | 0.0868 | 209.2k | | |
| B, tools appended on open | 15 | 90/90 | 98% | 0.0215 | 55.7k | 3.0k | 18 of 75 |
| C, fixed tool set | 15 | 90/90 | 98% | 0.0158 | 35.8k | 90 | 0 of 77 |
| D, deferred and loaded by reference | 15 | 87/90 | 98% | 0.0164 | 37.4k | 33 | 0 of 74 |

- Arm D kept its cache across opens and cost 0.76 times arm B and 1.04 times arm C.
- Arm D's three missed phases are in two sessions. In one the model used an `r2-buckets` tool it already had and never opened `r2-super-slurper`. In the other it sent a URL-encoded key name. Neither is a failed load.
- Six of arm A's 15 sessions ended in HTTP 429, so its cost is a mean over nine sessions with an uneven mix of scenarios. The scorer leaves out an errored session that finished no phase, so its table shows 13 sessions and 4 errors.
- Direct and router costs agree for the arms run both ways: arm A 0.0868 against 0.0871 USD, arm B 0.0215 against 0.0223.
- With the tool block shared between sessions, arm B cost 0.0176 USD with 9 of 75 requests after an open re-reading over half, and arm D 0.0164 with 0 of 75. Each has 14 complete sessions (`results/agent/2026-11-20-agent-summary-direct-shared.md`).
- Arm D in 30-turn sessions, six per cell, completed 178 of 180 phases with both result sizes and cost 0.091 USD with dry-run results and 0.155 with padded ones. No request after an open re-read over half, in 118 and 121 such requests (`results/agent/2026-11-20-agent-summary-chain30-d-direct.md`). Through the router on 2026-11-14, arm B cost 0.133 and 0.394 and arm C 0.104 and 0.150. Those cells differ from arm D's in endpoint and date.
- GLM-5.3 Flash was not run in arm D. Both its smoke sessions ended in HTTP 429.

## Listing each workflow once, 2026-11-23

Option 2 lists a workflow as a group and again as a skill of the same name. This run asks what changes when a host shows it once. `--dedup-grouped-skills` drops from the prompt every skill that shares a group's name, which leaves `workers-best-practices` and `wrangler` in the skill index. The server is the as-generated `opt2`, unchanged. The tasks are the v2 set, five samples each, so 100 trials per cell.

Each cell is the count with every skill listed, then with each workflow listed once. "Skill only" is the script's column: a skill picked for a task whose answer is a group or tool. "Same-named skill" is the part of that column where the skill shares a group's name and the task accepts an API group.

| Catalog | Model | Correct | Skill only | Same-named skill |
| :-- | :-- | :-- | :-- | :-- |
| Subset, 13 groups | Opus 5.5 | 100, 100 | 19, 5 | 9, 0 |
| Subset | Gemini 3.8 Flash | 100, 99 | 12, 6 | 4, 0 |
| Subset | Kimi K3.1 Pro | 99, 100 | 8, 5 | 0, 0 |
| Subset | DeepSeek V4.1 Flash | 95, 99 (one HTTP 429) | 29, 8 | 14, 0 |
| Full, 139 groups | Opus 5.5 | 99, 100 | 24, 5 | 14, 0 |
| Full | Gemini 3.8 Flash | 88, 89 | 39, 8 | 25, 0 |
| Full | Kimi K3.1 Pro | 94, 97 | 18, 8 | 6, 0 |
| Full | DeepSeek V4.1 Flash | 95, 97 | 31, 10 | 16, 0 |

- The last column's second number is zero because those skills are not in the prompt. Twenty-eight pairs of the table's models and tasks had a same-named skill answer. With the workflow listed once, 129 of their 140 answers were the group of the same name and 139 were accepted. The other one is Kimi on the image-resize task on the full catalog, which picked the `durable-objects` group.
- The correct count stayed level or rose in seven of the eight cells. Gemini on the subset lost one: the nightly-schedule task went to `workers-best-practices` once.
- The scoring accepts the same-named skill on these tasks except image-resize, so the correct column does not count it as a miss. On a real client it loads the skill's instructions without the product's tools.
- Qwen3.6, GLM-5.3 Flash and Qwen 3.5 9B were run on the subset and are in the two 2026-11-23 files. They returned an empty answer at the 200-token cap on 94, 45 and 38 of 100 trials with every skill listed. The request turns thinking off with `chat_template_kwargs`, and on 2026-11-08 the same models answered in about ten tokens through the same router. Their rows are not in the table.
- Seven Opus answers on the full catalog, all on the token-rotation task, were first stored as unparsed. Each wrote a URL template such as `accounts/{id}/tokens` before its JSON, and the parser read from the first brace. The parser now falls back to the last flat object, and `--retry` parses stored answers again. Six of the seven were correct. Three rows in earlier files failed the first-brace parse the same way and were parsed again with `--reparse` on 2026-11-23. Haiku's flat-names cell in the second round went from 18 to 19, and its as-generated cell on the held-out set from 18 to 19. Sonnet's answer on the full catalog in `2026-11-09-select2-full-groups-hosted` was `iam-api`, still a miss, so its 19 stands.

## Tool search probe on the Messages API

`scripts/agent-probe-toolsearch.ts` lists every tool on a flat server and sends them all to the Messages API with `defer_loading`, beside the BM25 tool search tool. It was run on Haiku 5.5 against the full catalog, three runs of two requests.

- The API accepted 3,036 deferred tools in a 5.5 MiB request. Six requests took 7.4 to 9.1 seconds and billed 6.4k to 18.3k input tokens each, with no HTTP 400 or 429.
- The task was to remove every `session:` key from the key-value store. Every request searched for key-value terms, and the search returned `kv_` tools in the two requests whose results were printed.
- The model called no tool. In the two requests whose text was printed, it asked for the account and namespace IDs.
- The requests set no cache breakpoint, so the probe says nothing about caching.

## Tool search on the held-out tasks, 2026-11-23

A first run of the flat catalog behind a vendor's tool search, on the Messages API. `scripts/search-run.ts` sends all 3,036 tools with `defer_loading` beside the BM25 tool search tool and gives the model one held-out task. The system prompt gives an account ID and a zone ID, both invented, and tells the model not to ask for identifiers. A trial ends at the model's first call to a catalog tool, or when it stops without one. Nothing is executed. Haiku 5.5 and Opus 5.5 at effort low, three samples per task, 120 trials, no errors.

| Model | Search returned a tool for the task | Called one | Called another tool | Called nothing | Median input tokens |
| :-- | --: | --: | --: | --: | --: |
| Haiku 5.5 | 57 of 60 | 53 | 4 | 3 | 16,933 |
| Opus 5.5 | 60 of 60 | 57 | 3 | 0 | 8,478 |

- Six of the seven calls to another tool are `d1_get` before `d1_query` on the task that names a database, a lookup first. The seventh is Haiku's `connectors_list` on the appliance task.
- Haiku called nothing three times and said no tool existed: twice on the edge IP ranges task and once on the LLM proxy task. On the IP ranges task its first sample did get `ips_list` back, with queries close to those of the two that did not, and Opus's queries returned it every time.
- `scripts/search-overlap.ts` ranks the catalog against each task with a local BM25 and the task text as the query, with no model. Nine of the 20 tasks have a needed tool in the top 10, and eight have their best match below rank 50. On those eight the API's search returned a needed tool in 47 of 48 trials. The models wrote queries with product words the task does not use: "web3" for the IPFS gateway, "tunnel" and "cloudflared" for the private connection, "page rules" for the URL overrides, "spectrum application" for the game server.
- A trial made 1.8 searches on average and at most 5.
- On the same tasks in the selection trial of 2026-11-10, one sample each, Haiku and Opus picked an accepted group on 19 of 20 on the as-generated build and 20 of 20 on the rewritten one.

### The same queries on a renamed catalog, no model

`scripts/search-replay.ts` replays the run's 215 queries against a local BM25 over the 3,036 tools, as served and with product names replaced. A tool's text is its name, description, argument names and argument descriptions. `prefix` replaces the product prefix of each tool name with an invented word. `label` also replaces the product's label with that word in the tool's description and argument text, drops the API path line and URLs, and removes "Cloudflare". `brand` replaces the vendor and the 28 coined product names listed in `scripts/rename.ts` (R2, Spectrum, Workers, Zero Trust) wherever they appear, and keeps names that describe the product (Email Routing, Queues, AI Gateway). A trial counts when any of its queries brings back a tool that does the task.

| Catalog | In the top 5 | In the top 10 | Same verdict as the API, top 10 | API-returned tools also in the top 10 |
| :-- | --: | --: | --: | --: |
| As served | 101 of 120 | 113 | 110 | 711 of 1,092 |
| Prefix | 101 | 112 | 109 | 707 |
| Label | 81 | 96 | 97 | 622 |
| Brand | 98 | 109 | 108 | 663 |

- 167 of the 215 queries hold the product label of a tool that does the task.
- Replacing the prefix alone changes one trial in the top 10, on the origin protocols task.
- Under `label`, 12 of the 20 tasks have the same count in the top 10 as on the catalog as served. Seven lose trials: the Google Tag Gateway task from 6 to 0, the edge IP ranges task from 6 to 1, the container task from 6 to 3, the account task from 2 to 0, the game server task from 6 to 4, and the URL overrides and origin protocols tasks from 6 to 5. The IPFS gateway task goes from 3 to 6.
- The `label` rule takes every prefix as a product name. `ips` replaces "IP" and `accounts` replaces "account", so `ips_list` reads "Get mulosktan used on the /JD Cloud network" and `accounts_update` reads "Update an existing vekpelzor".
- Under `brand`, 18 of the 20 tasks have the same count as on the catalog as served. The game server task goes from 6 to 4 and the edge IP ranges task from 6 to 4.

## Workflow tasks, search against groups, 2026-11-24

A first run of jobs that take three or four calls, on the Messages API with all 3,036 tools sent with `defer_loading`. `scripts/workflow-run.ts` has two arms. In `search` the model has the BM25 tool search tool and sees nothing about the tools first. In `groups` the system prompt lists the 271 groups of the rewritten build with their descriptions, about 80,000 characters, and a client tool `open_group` answers with `tool_reference` blocks for the group's tools. A trial runs until the model stops or has made 14 requests. Nothing is executed: a call gets a made-up result.

The tasks were written by `scripts/write-tasks.ts --set workflow`. Fable 5.2 and Gemini 3.6 Flash each wrote ten jobs, each from one product name: five inside that product and five that also need one or two other products of the writer's choice. The prompt asks for the outcome wanted and for at least one needed step the task does not mention. Gemini skipped four products. `scripts/workflow-answers.ts` holds the key, written before the run: for each step, the catalog tools that do it, chosen with the writer's step list in view. Two tasks were dropped because the catalog has no tool for steps the writer assumed. That leaves 18 tasks, 8 inside one product and 10 across products, with 65 required steps of which 20 are unsaid.

Haiku 5.5 at effort low, three samples per task, 54 trials per arm, no errors, none stopped at the request limit.

| | Search | Groups |
| :-- | --: | --: |
| Required steps with a fitting tool loaded | 167 of 195 | 191 of 195 |
| Unsaid steps with a fitting tool loaded | 45 of 60 | 59 of 60 |
| Required steps called | 151 of 195 | 159 of 195 |
| Trials with every required step called | 20 of 54 | 24 of 54 |
| Steps called, tasks inside one product | 82 of 93 | 80 of 93 |
| Steps called, tasks across products | 69 of 102 | 79 of 102 |
| Searches or opens per trial | 4.1 | 2.3 |
| Tools loaded per trial | 26.0 | 38.3 |
| Tools loaded and never called | 21.9 | 33.7 |
| Requests per trial | 4.6 | 6.2 |
| Median input tokens per trial | 139,275 | 326,031 |

- By task, search had fewer steps with a fitting tool loaded than groups on nine tasks and the same number on nine.
- Six steps had no fitting tool loaded in any of the three search trials: finding the old sending subdomain, finding the other account, finding the script that owns a namespace, reading the script's bindings on the container task, and reading a script's bindings before adding one, on two tasks. Five of the six are unsaid steps. The groups arm had no fitting tool loaded for the container task's bindings read either.
- On the container task search had a fitting tool loaded for 3 of 12 steps and groups for 9.
- Four steps were loaded and not called in any trial of either arm: the rollback, replacing the DNS record, and blocking the address on two tasks. In those trials the model said the made-up results lacked what the step needed: a scan report with no address, a deployment list whose one item was not a deployment, a get that returned a different ID from the list.
- The search arm used 13.2 million input tokens and the groups arm 19.2 million, of which 10.2 and 16.8 million were cache reads.

### Second run, with a result written for each task

The key was revised after the first run. Each task now has a `world` in `scripts/workflow-answers.ts`: the result returned for each tool the task is expected to touch, with the same ID in a list and a get and the fields a later step needs. The steps changed in three ways, by one rule read from the tools' schemas: a lookup is required when a later tool's path takes an ID the task does not give.

- The tools after a named-resource lookup take IDs (`subdomain_id`, `deployment_id`, `policy_id`, `dns_record_id`, `connector_id`, `organization_id`, `app_id`, `rule_id`), so those lookups stay required.
- Zone lookups are required on the seven tasks with a zone-scoped tool. The run gives no zone ID.
- The two abuse report steps are one, since the get takes the public report ID.
- The read before the vector index binding is optional, since that task does not ask to keep the bindings.

The key has 70 required steps, 25 unsaid. Haiku 5.5, three samples, 54 trials per arm, no errors, none stopped at the request limit.

| | Search | Groups |
| :-- | --: | --: |
| Required steps called | 178 of 210 | 207 of 210 |
| Trials with every required step called | 33 of 54 | 51 of 54 |
| Stated steps called | 118 of 135 | 132 of 135 |
| Unsaid steps called | 60 of 75 | 75 of 75 |
| Steps with a fitting tool loaded, tasks inside one product | 94 of 102 | 102 of 102 |
| Steps with a fitting tool loaded, tasks across products | 92 of 108 | 107 of 108 |
| Searches or opens per trial | 4.0 | 2.4 |
| Tools loaded per trial | 25.6 | 43.2 |
| Tools loaded and never called | 21.6 | 38.7 |
| Requests per trial | 4.4 | 5.8 |
| Median input tokens per trial | 133,230 | 335,988 |

- The four steps that neither arm called in the first run were called in every trial of both arms, except the rollback in one search trial.
- By task, search called fewer required steps than groups on 11 tasks, the same number on 6 and more on 1.
- Three unsaid lookups had no fitting tool loaded in any search trial: the old sending subdomain, the other account, and the script that owns the namespace. The alert policy lookup had none in two of three.
- The search arm used 14.5 million input tokens and the groups arm 18.7 million, of which 11.4 and 15.9 million were cache reads.

### Opus on the second key

Opus 5.5 at effort low, the same 18 tasks, key and results, three samples, 54 trials per arm, no errors, none stopped at the request limit.

| | Search | Groups |
| :-- | --: | --: |
| Required steps called | 201 of 210 | 210 of 210 |
| Trials with every required step called | 47 of 54 | 54 of 54 |
| Stated steps called | 129 of 135 | 135 of 135 |
| Unsaid steps called | 72 of 75 | 75 of 75 |
| Steps with a fitting tool loaded, tasks inside one product | 101 of 102 | 102 of 102 |
| Steps with a fitting tool loaded, tasks across products | 105 of 108 | 108 of 108 |
| Searches or opens per trial | 4.9 | 2.3 |
| Tools loaded per trial | 20.1 | 42.2 |
| Tools loaded and never called | 16.0 | 38.0 |
| Requests per trial | 4.4 | 4.9 |
| Median input tokens per trial | 90,046 | 287,834 |
| Mean input tokens per trial | 291,563 | 286,606 |

- By task, search called fewer required steps than groups on 5 tasks and the same number on 13. Four of the five are tasks across products.
- Search's nine missed steps: the other account and the share on the ruleset task in two trials each, starting the scan in two, and one each of adding a secret, reading the monitoring configuration and adding the vector index binding. Five of the nine had a fitting tool loaded.

### What the misses are, from a review of the trial rows

A second reader went through the rows of the second run and the Opus run on 2026-11-24, and the points below were checked again against the files. They replace an earlier reading in this section, that search missed steps because the model did not search for them.

- Haiku's search arm missed 17 stated steps and 15 unsaid ones. The gap is not particular to unsaid steps.
- In 13 of the 15 unsaid misses the model did search for the lookup and no fitting tool came back. Its queries include "list zones by domain name", "list accounts memberships", "list notification policies alerting" and "Durable Objects namespaces list objects count". Of the other two, one trial made no such query and one had the tool loaded.
- So on Haiku the search arm's misses are mostly searches for a list or lookup tool that did not return one. After such a miss the model usually stopped, said so, or took another route.
- Some misses are the key's or the made-up results' doing. On the subdomain task the model found the old subdomain with `emailSending_subdomains_get` and `_preview`, which the key does not accept for the lookup. On the ruleset task it called `user_memberships_list` and `organization_list`, and the made-up results returned nothing for either. The reviewer puts about 8 of Haiku's 32 search misses in this class.
- Opus's search arm missed nine steps and most are of that class. Four are the ruleset task, where the routes it tried returned nothing and it declined to create a share with an unknown account. Two are `urlScanner_scans_bulkCreate` used to start the scan, and one is a binding added with `workers_legacy_scripts_versions_create`. The key of the time accepted neither. One is the secret set through the settings edit. One, the monitoring configuration read, is a step not done. The run does not show a gap between the arms on Opus.
- One groups miss on Haiku is the runner's: a trial stopped at `max_tokens` and was not continued.
- The rows hold tool names and not the arguments, so they do not show what a call passed as an ID.

### Input tokens in the second run and the Opus run

The median and the mean give different answers on what groups cost.

| | Haiku, search | Haiku, groups | Opus, search | Opus, groups |
| :-- | --: | --: | --: | --: |
| Median per trial | 133,230 | 335,988 | 90,046 | 287,834 |
| Mean per trial | 267,777 | 345,454 | 291,563 | 286,606 |
| 90th percentile | 536,010 | 481,568 | 832,637 | 393,750 |
| Largest trial | 1,602,298 | 1,052,796 | 2,691,800 | 578,164 |
| Share of the arm's tokens in its five largest trials | 0.42 | 0.20 | 0.55 | 0.16 |

- A groups trial pays for the group listing on every request, about 80,000 characters, so its trials sit close together.
- A search trial is small unless a search returns tools with large schemas. Opus's three trials on the container task took 1.7, 2.2 and 2.7 million input tokens in four requests each.
- In total the groups arm used 1.29 times the search arm's input tokens on Haiku and 0.98 times on Opus.
- That near-parity rests on one task. Without the container task the groups arm used 1.73 times the search arm's input tokens on Haiku and 1.55 times on Opus.
- Tokens that were not cache reads were lower for groups on both models: 2.72 million against 3.05 million on Haiku, and 1.98 million against 2.54 million on Opus.
- Opus's arms were billed about $17 for search and $14 for groups, read from the console's credit balance before and after each.

### Third Haiku run, with call arguments recorded, 2026-11-25

The key was revised a second time from the calls made in trials that missed a step. A settings edit or a version upload now counts for adding a binding or a secret, `urlScanner_scans_bulkCreate` for starting the scan, `emailRouting_settings_apply` and `_update` for turning forwarding on, and `user_memberships_list` for finding the other account. The made-up results now answer `organization_list`, `accounts_organizations_list` and `user_memberships_list` on the ruleset task. `emailSending_subdomains_get` is still not accepted as the subdomain lookup, since it takes a subdomain ID the task does not give. The runner now records each call's arguments, and sends a request again with a larger limit when it stops at `max_tokens`.

Under this key the earlier rows score 182 of 210 for Haiku's search arm and 208 for its groups arm, and 206 and 210 for Opus. Haiku was run again on both arms, 54 trials each, no errors.

| Arm | Every required step | Required steps | Stated | Unsaid | Median input tokens | Mean input tokens |
| :-- | --: | --: | --: | --: | --: | --: |
| Search | 39 of 54 | 187 of 210 | 123 of 135 | 64 of 75 | 146,310 | 277,372 |
| Groups | 53 of 54 | 209 of 210 | 134 of 135 | 75 of 75 | 340,221 | 364,628 |

- The search arm missed 23 steps in 15 trials. Five are on the container task in two trials, four on the subdomain task in three, three each on the notification policy task and the cache store task in one trial each, and the other eight are on seven tasks.
- The ruleset task was done in full in all three search trials. It was the task with a dead end in the made-up results.
- Groups used 1.31 times the input tokens of search in total, and 1.55 times with the container task left out.
- None of the search arm's 236 calls passed a path ID the model had not read in the task, the system prompt or an earlier result. Nine of the 269 calls in the groups arm did, in nine trials. The values are "PLACEHOLDER", "example-zone-id" and the like as a zone ID. In the trials read, the call was sent in the same request as `zones_list` and made again with the ID that came back.
- Five vector index trials still ended at `max_tokens` after the insert was called, with about 85,000 output tokens each. The runner then resent up to twice, at 16,000 and 64,000 tokens. It now resends once, at 16,000.
- The two attempts cost $5.29 of promotional credit. The first attempt ran the search arm only and three of its trials ended in an SDK error, so it was run again.

### What the search returned, by kind of tool

`scripts/search-returned.ts` tallies the tools the API's search returned in the three search files: the held-out run of 2026-11-23, the second Haiku workflow run and the Opus workflow run. That is 228 trials, 694 queries and 4,237 returned tools, repeats counted. A tool's kind is the verb at the end of its name. No model is called.

| Kind | Share of catalog | Share of tools returned | Median characters of description and schema |
| :-- | --: | --: | --: |
| `_list` | 18% | 16% | 729 |
| `_get` | 24% | 19% | 499 |
| `_create` | 13% | 18% | 1,262 |
| `_update` | 11% | 16% | 1,370 |
| `_edit` | 4% | 8% | 1,375 |
| `_delete` | 13% | 10% | 556 |
| other | 17% | 13% | 1,014 |

- 283 of the 694 queries hold the word "list". 128 hold "create" and 61 hold "update".
- In the 12 trials whose every query says "list" and none says create, update or delete, the search returned 135 tools: 20 list tools, 12 get tools and 81 create, update, edit or delete tools.
- Where a create, update, edit or delete tool was returned and the same resource has a `_list` tool, the `_list` tool was returned nowhere in the trial in 636 of 850 cases. Where a `_list` tool was returned and the resource has a `_create` tool, the `_create` tool was returned nowhere in the trial in 261 of 390 cases.
- The returned tools have a median of 1,043 characters of description and schema. The catalog's median is 750.

`scripts/search-probe.ts` passes 20 fixed queries to the search one at a time on Haiku 5.5, with the whole catalog deferred, and records what each returns. Sixteen are queries the models wrote in the workflow runs when a lookup step was missed. Haiku passed every query word for word.

| Queries | Wanted tool | Returned for | Returned in its place |
| :-- | :-- | --: | :-- |
| 5 written by a model, about zones | `zones_list` | 2 of 5, at ranks 4 and 1 | `zones_create`, `workers_domains_list`, `accounts_subscriptions_get`, `customNameservers_get` |
| 3 written by a model, about accounts | `accounts_list` | 0 of 3 | `user_memberships_list`, `accounts_applications_list`, `tunnels_connections_list` |
| 3 written by a model, about notification policies | `alerting_policies_list` | 0 of 3 | `alerting_policies_test`, `_update` and `_create` in all three |
| 2 written by a model, about Durable Object namespaces | `durableObjects_namespaces_list` | 0 of 2 | `durableObjects_namespaces_objects_list`, `kv_namespaces_create`, `containers_applications_create` |
| 3 written by a model, about email sending subdomains | `emailSending_subdomains_list` | 0 of 3 | `emailSending_subdomains_create`, `_delete` and `_preview` in all three |
| "list zones" | `zones_list` | rank 4 | three `dns_` create and update tools above it |
| 3 tool names as the query | that tool | 3 of 3 | nothing: the search returned that one tool |

- Each query returned five tools, and a query that is a tool's name returned that tool alone. Five is the default when the model passes no `limit`, and the probe's instruction gave none. In the workflow runs Haiku passed `limit: 10` on some searches. See the 2026-11-26 run on descriptions below.
- "list email sending subdomains" returned four tools of that resource and not its list tool. `emailSending_subdomains_list` is the shortest of the resource's tools, 97 characters of description and 229 of schema, so its absence is not explained by longer tools holding more matching words. The 2026-11-26 run below shows the search does not split hyphenated words, so its "sending-enabled" does not match "sending". The `alerting_policies_create` and `_update` tools returned for the policy queries have about 9,700 characters of schema each, and `alerting_policies_list` has 238.
- The probe cost $0.02 of the account's promotional credit, 183,981 input tokens over 20 requests.

## A second server with real execution, 2026-11-25

A first check of two servers attached at once. `scripts/db-run.ts` sends the 3,036 Cloudflare tools and the 29 tools of Google's MCP Toolbox for Databases v1.18.0, run locally with `--prebuilt=postgres` against a Postgres 18 container, all with `defer_loading`. Toolbox calls are executed. Cloudflare calls are dry runs. `tasks/db/seed.sql` plants 11 problems in a small shop database, and each of the 11 tasks in `tasks/db-tasks.json` is passed when its check query returns true afterwards. `scripts/db-check.ts` shows each check false on the seeded database and true after the fix in `tasks/db/fixes.sql`. The groups arm lists the 271 rewritten Cloudflare groups and the toolbox's own five groups, read through its `com.google.cloud/toolbox.v1` extension. Those five have names (`data`, `health`, `monitor`, `replication`, `view-config`) and no descriptions.

Haiku 5.5 at effort low, one sample per task.

| Arm | Passed the check | Called a Cloudflare tool | Searches or opens | Tools loaded | Database tools among them | Median input tokens | Total input tokens |
| :-- | --: | --: | --: | --: | --: | --: | --: |
| Search | 11 of 11 | 0 | 1.7 | 16.3 | 4.4 | 45,465 | 733,620 |
| Groups | 11 of 11 | 0 | 2.3 | 15.4 | 15.4 | 159,449 | 1,928,471 |

- Both arms passed every task, so the run does not separate them on the outcome.
- Every task can be done with `execute_sql` alone. The search arm used only that tool in 5 of 11 trials and the groups arm in 2.
- 16 of the search arm's 19 queries name Postgres or the server, as in "shop-db postgresql query execute SQL". The system prompt gives both. About 12 of the 16 tools a search trial loaded were Cloudflare tools, and none was called.
- The groups arm opened two or more of the toolbox's groups in every trial, and `data`, which holds `execute_sql`, in all of them. It opened no Cloudflare group.
- Groups used 2.6 times the input tokens of search. The listing of 271 Cloudflare groups is in the system prompt of every request.
- The toolbox advertises `io.modelcontextprotocol/skills` and serves no skill with the prebuilt configuration. Its `skills-generate` command writes one skill per toolset that runs each tool as a Node script from a shell, which this harness does not have, so no skill was offered.
- The run cost $0.10 of promotional credit.

### Lookups with `execute_sql` taken away

A second run on the same two servers, to see whether either arm has trouble finding one narrow database tool among 3,064. `--without execute_sql` leaves that tool out of the tool list and out of the toolbox's groups, so 28 database tools remain and none of them writes. `tasks/db-find-tasks.json` has 14 lookups, such as which index is invalid, which session holds a lock, and what the replication slot is called. A trial passes when a database tool was called and the model's answer holds the expected value. `scripts/db-find-check.ts` shows each answer in the output of at least one tool the task lists, with no model. The seed gained a stored procedure, a publication and a replication slot for three of the lookups.

Haiku 5.5 at effort low, three samples per task, 42 trials per arm.

| Arm | Passed | Called a tool the task lists | Searches or opens | Tools loaded | Database tools among them | Requests | Median input tokens | Total input tokens |
| :-- | --: | --: | --: | --: | --: | --: | --: | --: |
| Search | 41 of 42 | 41 | 1.7 | 10.7 | 5.2 | 2.0 | 12,009 | 930,715 |
| Groups | 41 of 42 | 41 | 1.9 | 11.9 | 11.9 | 3.7 | 90,771 | 4,603,802 |

- Both arms passed 41 of 42, so this run does not separate them on the outcome either.
- The search arm's miss was a `sort-memory` trial. It searched twice for a tool that runs SQL, called nothing, and asked for one.
- The groups arm's miss was a `role-limit` trial. `list_roles` is in the group `replication`. The trial opened the other four groups, called nothing, and asked for a tool that queries `pg_roles`. The other two samples of that task opened four and five groups before calling `list_roles`.
- In 22 of the 42 groups trials the first group opened held a tool the task lists. With names and no descriptions, the model opened `monitor` first for the index, extension and trigger tasks, whose tools are in `data`, `health` and `view-config`.
- Neither arm called a Cloudflare tool. The groups arm opened no Cloudflare group.
- Groups used 4.9 times the input tokens of search. The listing of 271 Cloudflare groups is in every request, and a groups trial took 3.7 requests against 2.0.
- The run cost $0.17 of promotional credit.

## How the search splits and ranks, 2026-11-26

`scripts/search-mechanics.ts` sends 44 requests to the Messages API's BM25 tool search on Haiku 5.5, each with one tool list sent with `defer_loading` and one query that Haiku passed word for word. Some use the full catalog in served, reversed and shuffled order, or a single word as the query. Others use small made-up catalogs: a made-up word placed in one part of one tool, eight tools with the same text under different names, and one word repeated in tools of different lengths. `scripts/search-fit.py` compares the results with a local BM25. No request failed. The run used 138,923 input tokens, and the promotional credit on the billing page fell by $0.02.

Where a word was found. Each made-up word was in one place in one tool, and the query was that word.

| Where the word was | Found |
| :-- | :-- |
| Description, argument name, argument description, nested argument description | yes |
| Enum value, a description inside `$defs`, `title`, `default` | yes |
| Part of the tool's name, between underscores (`place_namepart_frobule`) or in camel case (`place_camelCaseWimbrel`) | no |
| Either half of a hyphenated word in the description (`dorvin-kelp`) | no |
| Either half of an underscored word in the description (`yarrow_plinth`) | no |
| The whole tool name as the query | yes, that tool alone |

- The query "Plimbat" and the query "plimbats" both found the tool whose description says "plimbat". On the full catalog "zone" and "zones" returned the same five tools, as did "subdomain" and "subdomains", and "listing zones" returned what "list zones" did.
- Anthropic's documentation says the search covers tool names, descriptions, argument names and argument descriptions. Enum values, `$defs`, titles and defaults were searched as well.

Ties. The eight tools had the same description and schema, and names from `aa_widget_list` to `zz_widget_list`. The query was "widget inventory".

| Order sent | Returned |
| :-- | :-- |
| aa to zz | aa, bb, cc, dd, ww |
| zz to aa | zz, yy, xx, ww, dd |
| aa, xx, bb, yy, zz, dd, cc, ww | aa, xx, bb, yy, zz |

- Tools that tie are returned in the order the request lists them, and the first five in that order are kept. The order of the names did not matter.
- On the full catalog, "zones list account get zone id name", "list zones" and "list email sending subdomains" returned the same five tools in served, reversed and shuffled order. For the first two, the order within the five changed between catalog orders. A repeat of the first query and the 2026-11-25 probe gave the same list as this run.

Length. "gadget" was sent to eight tools holding it 1 to 16 times, padded with 0 to 200 words that are in neither the query nor the eight filler tools beside them. The API returned the tool with 8 occurrences and 40 padding words (8-in-40), then 16-in-200, 4-in-40, 1-in-0 and 8-in-200, in either catalog order. Under BM25 that order holds for b from about 0.65 to 0.87, depending on how the schema's words are counted in a tool's length, and for k1 from 0.1 to 10. The common defaults, k1 1.2 and b 0.75, give it.

A local BM25 that splits on whitespace, strips punctuation at the ends of a word, lowercases, drops English stop words, stems with Snowball, and reads every property name and string value in the schema, with k1 1.2 and b 0.75, was compared with the 32 requests on the full catalog in served order whose query is not a tool name: 28 distinct queries, from this run and the 2026-11-25 probe.

- Its top five held 108 of the 160 tools the API returned, and the same set in 9 requests.
- The API returned the same five tools for "zones list account get" and for "zones list account get zone id name". The local BM25 gave the API's five for the first. Adding "zone" or "id" alone kept them, and adding "name" changed four of the five. So the local BM25 and the API differ on "name", for a reason not known.
- Under the local BM25, the query words in the tools behind two of the misses on 2026-11-25:

| Tool | Words | Query words held |
| :-- | --: | :-- |
| `emailSending_subdomains_list` | 14 | list 1, email 0, sending 0, subdomain 1 |
| `emailSending_subdomains_delete` | 42 | list 0, email 1, sending 5, subdomain 4 |
| `alerting_policies_list` | 15 | list 1, notification 1, policies 1, alerting 0 |
| `alerting_policies_test` | 83 | list 0, notification 3, policies 2, alerting 5 |

- `emailSending_subdomains_list` says "sending-enabled subdomains", and its other "email" and "sending" are in the path line, `GET /zones/{zone_id}/email/sending/subdomains`. `alerting_policies_list` has "alerting" only in its path line. The hyphenated word is one word in the API, from the test above. The path line is one word in the local BM25, and was not tested. Under the local BM25 these list tools lack query words their siblings repeat in prose. Both take only path IDs, so they have little other text.
- Parts of a made-up tool's name were not found on their own. If that holds on the catalog, the "zones" and "list" in `zones_list` count for nothing, and the tool is found through its description and schema.
- Every request in this run used the search's default limit of five tools. The next section shows the model can ask for more.

## Descriptions that start with the tool's name, 2026-11-26

The run above suggests some list tools are missed because their descriptions lack the words in their names. This tests one rule a server author could apply to every tool: start the description with the tool's name split into words at underscores and capitals. `emailSending_subdomains_list` gets "email sending subdomains list. " before its description.

`scripts/search-rewrite.ts` sends the 185 distinct queries of the third Haiku run's search arm, 215 searches in 54 trials, to the API's search again. Each query is one request on Haiku 5.5, with the catalog as served and rewritten, at `limit` 5 and 10. That is 740 requests, with no errors. Haiku passed every query word for word, and sent one query twice in its request. The limit-5 rows were sent with no limit and each search returned five tools. The limit-10 rows asked for 10 and each returned ten. A required step counts when a tool that fits it is among the tools returned for its trial's queries. The model was not run on the tasks, so each trial keeps the queries it wrote against the served catalog.

The search returns five tools unless the model passes `limit`. In one request on the traffic-monitoring task, Haiku passed `limit: 10` on both its searches and got ten tools back from each. The workflow runner recorded the query and not the limit. A search in the run is taken to have used limit 10 when all ten tools the served catalog returns at 10 are among the tools its trial loaded. That holds for 118 of the 215 searches. With those limits the served rows give exactly the tools each trial loaded, in 54 of 54 trials. The scorer now infers each search's count as in the next section, which gives the same counts in the table below.

| Tools returned by | Required steps with a fitting tool returned |
| :-- | --: |
| The run, as recorded | 192 of 210 |
| Served, limit 5 | 156 of 210 |
| Served, limit 10 | 193 of 210 |
| Rewritten, limit 5 | 168 of 210 |
| Rewritten, limit 10 | 197 of 210 |
| Served, the run's limits | 192 of 210 |
| Rewritten, the run's limits | 192 of 210 |

- At the run's limits the rewrite gained seven steps and lost seven. It gained the old sending subdomain in two trials and its DNS records in a third, the alert policy in one, and the container app, the namespace and the object count in one container trial. It lost four zone lookups, attaching the domain to a script, replacing a DNS record and adding a binding. Why each was lost was not traced.
- Eleven of the 18 steps with no fitting tool in the run still had none under the rewrite. In one trial of the cache task the queries never mention Cache Reserve, the product of the three steps that trial missed.
- The groups arm of that run had a fitting tool loaded for 210 of 210 steps. On this catalog and these queries, the rewrite does not narrow that gap.
- A one-request check sent before the run, which showed the `limit`, is not kept. The promotional credit on the billing page fell from $152.31 to $149.29 over these requests. That includes the limit-10 batch on the rewritten catalog, which was sent twice because its first rows were overwritten. The kept rows hold 10.5 million input tokens. The fall is more than those tokens price at, and other use of the account in that time is not ruled out. The Cost page, as of 8:56 PM UTC, shows $1.62 of Haiku for 2026-11-26 UTC, which covers these requests and the run in the previous section.

## How many tools a search returns, 2026-11-26

The same replay, at more limits and on the Opus run's queries. `scripts/search-rewrite.ts` sent the third Haiku run's 185 queries to the served catalog at limit 20, and the 176 distinct queries of the Opus search run of 2026-11-24 (263 searches in 54 trials) at limits 5 and 10. That is 537 requests, with no errors. One request on the traffic-monitoring task's first query at limit 50 returned 50 tools.

A smaller limit returned the first tools of a larger limit's results for the same query, in 911 of 911 comparisons. So the number of tools a search in a run returned is inferred as the longest prefix of the served catalog's results that the trial loaded. That is an upper bound: another search of the same trial can have loaded the next tools.

| Queries | Limit 5 | Limit 10 | Limit 20 | The run's limits, inferred | The run, as recorded |
| :-- | --: | --: | --: | --: | --: |
| Haiku, third run | 156 of 210 | 193 of 210 | 202 of 210 | 192 of 210 | 192 of 210 |
| Opus, 2026-11-24 | 192 of 210 | 209 of 210 | not sent | 209 of 210 | 209 of 210 |

- The cells count required steps with a fitting tool among the tools returned for the trial's queries. The groups arms had a fitting tool loaded for 210 of 210 in both runs.
- At limit 20, eight steps of the Haiku run still had no fitting tool: the old sending subdomain in two trials, the Durable Object namespace in two, and the container app, the object count, the wipe status and the Zaraz workflow mode in one each.
- Opus's searches are inferred to have returned five tools in 117 of 263, ten in 50, and between one and nine in the other 96. So Opus passed limits other than 5 and 10. Some counts below five may be queries that matched fewer tools. The inferred limits rebuild the tools each Opus trial loaded exactly in 53 of 54 trials.
- For Haiku the inferred counts are 5 or 10 in 168 of 215 searches and other values in 47, where another search of the trial loaded the next tools.
- At limit 5, Opus's queries reach a fitting tool for 192 of 210 steps and Haiku's for 156. The difference is in the queries.
- The limit-20 requests used 8.2 million input tokens and the Opus replay 5.4 million. With the next section's runs, they raised the Cost page's 30-day total from $74.97 to $76.38, read as of 9:54 PM UTC, which may not hold the last requests. The promotional credit on the billing page fell from $149.29 to $145.37 over the same requests.

## Three servers with the same tools, 2026-11-26

`scripts/samename-run.ts` starts three MCP Toolbox for Databases servers, v1.18.0 with `--prebuilt=postgres`, each on its own database in one Postgres 18 container: `shop-us` on `shop_us`, `shop-eu` on `shop_eu` and `shop-staging` on `shop_staging`. The client names each tool as Claude Code does, `mcp__<server>__<tool>`, so the three copies of a tool differ only in that prefix. Their descriptions and schemas are the same. `execute_sql` is left out, which leaves 28 tools per server and 84 in all, every one sent with `defer_loading`. The system prompt says which server is which database.

Each database is seeded from `tasks/db/samename-seed.sql` with its own names and values: a different invalid index, unused index, disabled trigger, dead-row table and count, sequence value, view column, procedure and publication. Eight lookups from `tasks/db-find-tasks.json` whose answers depend on the database are each asked of all three databases, for 24 tasks. A trial passes when a tool on the named database's server was called and the answer matches that database. The search arm has the BM25 tool search. The groups arm lists each server's five toolbox groups by server, names without descriptions, and `open_group` takes a server and a group.

Haiku 5.5 at effort low, two samples per task, 48 trials per arm, no errors.

| | Search | Groups |
| :-- | --: | --: |
| Passed | 46 of 48 | 48 of 48 |
| Called a tool on the named server | 48 | 48 |
| Called a tool on another server | 0 | 0 |
| A fitting tool of the named server loaded | 43 | 48 |
| Tools of another server loaded, per trial | 8.0 | 0 |
| Searches or opens per trial | 2.1 | 1.6 |
| Requests per trial | 2.1 | 3.1 |
| Median input tokens per trial | 12,023 | 10,000 |
| Input tokens, all trials | 692,462 | 442,183 |

- 73 of the search arm's 103 queries name a server or its database, such as "shop-staging query postgres". The search does not split tool names, so a server's name in the query matches nothing, and the three copies of a tool tie. Ties come back in the order the request lists the tools, which here is `shop-us`, `shop-eu`, `shop-staging`.
- In three trials, all on staging, the search returned the US and EU copies of the fitting tool and not the staging copy. In each the model called `mcp__shop-staging__list_indexes` or `mcp__shop-staging__list_sequences` anyway, the API passed the call to the client, and the trial passed.
- The two failures are the view-columns task on EU and on staging. The model searched for a way to run SQL, which was left out. No search returned `list_views` or `list_tables` for any server, and the model gave up.
- The groups listing here is 15 group names, so the groups arm read fewer input tokens than search.
- The cost of both arms is in the figures of the previous section.

## Limits

### Every run

- One vendor's API catalog, Cloudflare's, with three of its workflows. The database runs add Google's MCP Toolbox for Databases. Models are pinned by name, and the runs span 2026-11-07 to 2026-11-26.
- Toolset group names and descriptions are this demo's, not Cloudflare's. The `-api` suffix and the templated sentences are a naming choice, and so is the overlap between `durable-objects` and `durable-objects-api`.
- Token counts in the trial tables are compact JSON. A provider's tool prompt renders schemas differently, and forge-generated schemas are verbose, which inflates the flat numbers relative to a hand-written server. The `opt1` task load depends on how long this demo's paraphrase is.
- Groups against Code Mode, the Cloudflare server's default, was not measured. The flat baseline is its direct-tool mode.
- Per-caller scoping, the problem statement's dynamic-correctness criterion, was not tested. Every group answers the same to every caller.
- The selection and completion runs compare Option 2 against flat. Options 1 and 3 appear only in the token and wire comparison.
- The deployed Workers were redeployed on 2026-11-12 to change the `opt2-rec` server's `instructions` text and the `tools/list` cache scope. For a client that negotiated both extensions, `tools/list`, `groups/list`, `skills/list`, `resources/list` and the `turnstile-spin` group returned the same content before and after. Runs from 2026-11-14 on that used the deployed Workers saw the redeployed version.

### Selection trial

- The v1 set has five samples per task. At 13 groups they are identical on every task for the 14B model and Claude and on 9 of 14 for the 9B model. Other arms vary more: Claude is identical on 11 of 14 at 238 flat names. The v2 set has one, except the five-sample runs of 2026-11-23 and 2026-11-24. Read each cell as tasks, not answers, and two cells that differ by one or two as the same result. More tasks, not more samples, would add information.
- The v1 set names the product (Turnstile, D1, KV, R2, queue, container), and the toolset group descriptions are templated around the product name ("Call the Cloudflare queues API directly. Use to read or change queues resources in an account."), so it measures keyword routing. The SEP says a group description SHOULD carry the task vocabulary a user would use. These do not, so the drop at 139 groups on the indirect tasks measures what templated descriptions cost, not what groups cost. The second round rewrote them with task vocabulary and re-ran.
- The v1 set and the 2026-11-07 run of the v2 set showed no skill index, so their flat modes had no answer for a knowledge task. The 2026-11-08 run fixed that in every mode.
- Accepted answers are this demo's judgment. For the 3,036-tool catalog: `pipelines-api` for a dead-letter destination and `hyperdrive_create` for relational data were left as misses. `workflows-api` for retried jobs and `flagship-api` for feature flags were accepted, and `email-domains-api` was added after the first hosted run. For skills: `wrangler` is accepted for the deploy and schedule tasks and `workers-best-practices` for the fetch-handler question, and `workers-best-practices` is a miss for a queue or deploy task. A different reader might draw these lines elsewhere.
- The flat control shows tool names and first description lines, 6,911 tokens at 238 tools with the skill index. The `flat-schemas` mode tested the full `tools/list`, 157,834 tokens with the skill index, for five open and nine hosted models. At 3,036 tools the schemas are 1.38M tokens and cannot be tested. Astra skipped the schema control.
- Round one's servers had `demo_info` as their first tool, a tool about the server itself. In the 2026-11-07 flat runs Haiku 5.5 and the 9B model answered it on most tasks, and stopped once a skill answer was available. A real server's first tool is something else, so the collapse those runs showed is not a finding about either model.
- The hosted models scored 16 to 20 of 20 in every groups arm, so these task sets cannot detect a small difference in either direction. The result is no detectable change, which is weaker than equivalence.
- The hosted models in the selection trial ran at their lowest reasoning setting. The completion run used default effort.
- The answer format (`group`, `skill`, `tool` or `none` keys) is this script's design. A host would expose `groups/get` as a tool call, so the 9B model's key confusion may not carry over.
- Selection measures the first top-level pick only. Navigation into nested groups shows only in the completion traces.

### Task completion in Claude Code

- The completion tasks need one or two tools each and ran only on the 238-tool subset. The SEP's case against tool search is about multi-tool workflows, which this run does not test.

### Second round

- The rewritten server's split rule, size cap and hand-written descriptions are mine. The 249 full-catalog descriptions were written by a model and spot-checked, as a server author with 136 products would do it. Accepted answers for the split groups are this demo's judgment like the rest.
- The headless sessions still load this machine's user-level plugins. Config isolation was not set up. The base prefix differs by arm: about 15k tokens in the groups arms with tool search on, 18k in `flat-toolsearch`, and 26.6k in the resident arm, where turning tool search off also makes the host's built-in tools resident. Part of the resident arm's extra input tokens is that difference. `CronCreate` is a host built-in the runner does not disallow. Haiku searched for it in two `nightly` sessions and named it in a third, and never called it.
- `read_skill` in the mod checks each file's SHA-256 against the published digest. It does not check the file's size or compare the SKILL.md frontmatter with the `skills/get` entry.
- Completion jobs for all conditions and models ran side by side, so their wall times share the same API load. Gaps of one or two tasks in any cell are noise, as before.
- DeepSeek V4.1 Flash on Baseten failed on most calls on 2026-11-09, so its cells come from a full re-run three days after the other models'. The OpenAI trials that failed on credits were asked again later the same day. The classifiers could not run on the 271-group listing.

### Held-out task set

- 20 tasks, 14 from one writer and 6 from the other, one sample each. The accepted tools per task are this demo's judgment, fixed before the runs. The list of near neighbours that count as misses was written after them. The flat first-call rule was decided after seeing the results, and both scores are shown. The task rules forbid the product name, which is the only vocabulary the templated descriptions carry, so the as-generated gap on this set is partly by construction.

### Open-model agent run

- One catalog, the 237-tool subset, four open models on two providers through one router, on one evening. Fifteen sessions per cell, which are five scenarios run three times. Phases need one or two tools, and Sonnet completed all of them, so the set separates the open models only.
- The tasks and rubrics were written by a model with the group listing and schemas in view, which the held-out set avoided. The string-body fix to the rubric code was made after the results, and both scorings are committed.
- Arm A ran on the two Baseten models only, and ran after arms B and C, later the same night, once the account had credit again. Its shared-tool-block run on GLM has 13 complete sessions.
- Arm C's `call_tool` error message and its strictness about the wrapper shape are this loop's. One GLM session failed on them alone.
- Arm C gives up the provider's typed tool calling and puts every opened schema in the conversation, where it is paid for again on a provider with no cache. Arm B never unloads a group. A batched open was not run: the phases are separate user turns, so the model cannot know the later groups in its first turn.
- The B and C runs for the Baseten models ran side by side, and arm A ran beside other jobs, so first-token times share load. Any other change to the `tools` array mid-session, such as a `list_changed` refresh or connecting a server, would be expected to have the same cache effect as an open. That was not run.
- The reference is one Claude model on one host. Its sessions share the host's cached base prefix, as in round two.

### Follow-up runs

- The GLM cells and DeepSeek's cold arm A with dry-run results have two chained sessions each, one per order. The other DeepSeek cells have six, after the 2026-11-14 runs. The padding is filler of a fixed size, a stand-in for real response bodies and not a measurement of them. The full catalog was served by a local dev server. Arm C in these runs uses the tolerant wrapper.
- The listing-in-the-first-tool variant was tried on the full catalog and arm B only.
- Render order on the Baseten endpoints is inferred from cache counts, and on GLM from one tool-block size.

### Deferred loading runs

- The sessions are one model, DeepSeek V4.1 Flash, on one endpoint on one evening. GLM-5.3 Flash on Baseten direct is one probe conversation.
- The probe table is one request per row. The repeats are the three reproduction runs and the other vendors' three to five runs.
- The arms ran one after another under rate limiting, and 36% to 95% of requests were retried. First-token times are not compared.
- The 30-turn comparison sets arm D on Baseten direct against arms B and C through the router six days earlier.
- The router's behaviour is as observed on 2026-11-19.
- The run files record `73d4f67` in their headers. Arm D was committed at `433defe`, so they ran from the working tree that became it.

### Listing each workflow once

- One server, the as-generated `opt2`, and one task set. The rewritten build was not run.
- The full-catalog arms ran against a local dev server on the full build. Their files record its address.
- DeepSeek's trials that ended in HTTP 429 were asked again with the same seed until none were left on the full catalog. One is left on the subset with each workflow listed once.
- The same-named skill count was made by a one-off script that is not in the repository. The other two columns are printed by `--replay`.
- The files are dated 2026-11-24 where the run crossed midnight UTC.

### Tool search on the held-out tasks

- Two models from one vendor, on that vendor's search. No open model and no other vendor's search was run.
- The catalog is Cloudflare's, and the models put its product names into their queries. The run does not show how search does on a catalog whose names a model has not seen.
- The groups numbers beside it are a different measure: one sample, and a pick of a group with no call. No groups arm was run on these tasks on the Messages API.
- A lookup first counts as a call to another tool here. The first-call rule in `scripts/v3-rescore.ts` is not applied.
- The local ranking is a proxy. It indexes names and descriptions, and the API's search also indexes argument names and descriptions.
- The file is dated 2026-11-24, the UTC date.
- The replay uses queries the models wrote for the catalog as served. A model given a renamed catalog would write other queries, so the replay does not measure search on one.
- The replay's BM25 is not the API's. On the catalog as served it gives the API's verdict in 110 of 120 trials and holds 711 of the 1,092 tools the API returned. The API returned 5 or 10 tools per query and the run did not record which was asked for.
- `label` renames a product's label only in that product's own tools. Another product's tool that mentions it keeps the name.
- `brand` matches prose by its capital letter and leaves argument names alone. "the worker" in lower case and arguments such as `r2` keep the name.
- `brand` also renames ordinary uses that start with a capital, such as "Pages use descending revision IDs" and "Robots Access Control License". A reviewer counted 39 tools outside Zero Trust.
- No run on the API used a renamed catalog. The replay moved two of the 20 tasks, and 27 of the 136 name prefixes are on the list, so that run was not made.

### Workflow tasks

- Two models from one vendor, one vendor's search, one catalog. Samples of a task mostly agree, so the sample is 18 tasks.
- Input tokens are summed over a trial's requests, cached or not, and most were cache reads. The comparison between arms depends on the cache price and on whether the mean or the median is taken.
- In the first run the made-up results stopped some trials. A list returned the resources the key said exist, whatever was listed, and a get returned a new ID. Its "called" counts are lowered by this in both arms. Its "loaded" counts are not.
- In every run a made-up result accepts any ID. A call made with an ID that was never looked up gets a success, where the API would return an error. The rows of the first two Haiku runs and the Opus run do not record call arguments, so how often this happened in them is not known. The third Haiku run records them. A call made with an invented ID counts as done, which favours whichever arm does it more.
- The check for a path value not read before compares text. It passes over `account_or_zone` and `ruleset_phase`, which take a fixed word, and it does not look at IDs in a request body.
- The key was written by one person and revised after the first run's results were seen, and again after the second run and the Opus run. Each revision accepted more calls, and the calls it accepted were made more often in the search arm. The second run's `world` results were written by the same person, from the tool names and descriptions and not from the API's response schemas.
- One writer step was left out because no tool lists organization roles.
- Three tasks have no unsaid required step, and Gemini's tasks tend to name each step. Two tasks across products cross only by a zone lookup, and one task inside a product spans four name prefixes.
- The writer chose the other products of a cross-product task, so that choice is not seeded. It is in `results/tasks/workflow/raw.jsonl` with each reply.
- Groups are built per product, and the tasks are drawn per product. The cross-product tasks are there for that reason.
- The groups arm puts every group description in the system prompt. Its input tokens include that listing on every request.
- A group's instructions are sent as text after the `open_group` result. Skills are not offered in either arm.
- The search returns five tools for a query unless the model passes `limit`. The runner did not record the limit. In the third Haiku run 118 of 215 searches are inferred to have used 10, from the 2026-11-26 replay. The tally of returned tools by kind is over trials, since the run files do not record which query returned which tool. The probe records that, for 20 queries on one day, one sample each.
- The API's ranking is not documented at the level of what text is indexed or how a tool name is split into words. The 2026-11-26 run measures some of it, and its limits are below.
- The 16 model-written probe queries were picked from trials where a lookup was missed. They are not a sample of all queries.

### A second server with real execution

- The repair run: one model, one sample, 11 tasks written by the person who wrote the seed, and tool names from the two servers merged without a server prefix.
- The lookup run: one model, 14 tasks written by the person who wrote the seed, answers matched by pattern, and `execute_sql` removed by the harness and not by the server's configuration.

### How the search splits and ranks

- One model, one sample per request, on one day. The search's results did not vary between repeats where a query was sent more than once, but its behaviour could change without notice.
- The made-up catalogs test one case each. Splitting was tested on hyphens, underscores and camel case only, not on slashes, dots or other punctuation. That a path line is one word comes from the local model, not from a test.
- Stemming is inferred from plurals and "listing" matching. The stemmer, the stop words and how a tool's length is counted are not known.
- Exact ties went to the earlier tool in eight identical tools. On the full catalog, order changed no returned set in three queries. It was not tested on more.
- The local model was chosen after seeing the API's results, and was not checked on queries held out from that choice.
- Every request used the default limit of five.

### Descriptions that start with the tool's name

- The queries are the ones Haiku wrote against the served catalog. A model reading the rewritten catalog's results would write other queries, and might search more or less often. The workflow tasks were not run on the rewritten catalog.
- One rule on one catalog, with one run's queries and one sample per request. Prose written by hand, or a rule applied to list tools only, was not tested.
- The limit each search in the run used is inferred from the tools its trial loaded.

### How many tools a search returns

- The queries are the ones the models wrote at the limits they chose. A model given more tools per search might search less often or write other queries.
- The inferred counts are upper bounds, and a query that matches fewer tools than the limit returns fewer.
- Limit 20 was sent for the Haiku run's queries only. Limits above 20 were sent once, at 50.

### Three servers with the same tools

- Three servers, so the three copies of a tool fit in a search of five. With more servers than the limit, a tie would leave the later servers' copies out. That was not tested.
- One model, two samples per task, eight lookups. The lookups are read-only, and the databases differ only in the planted names and values.
- The Cloudflare catalog was not attached. The toolbox's groups have no descriptions, and the server names carried the distinction in the groups arm.
- That the API returns a call to a deferred tool the search did not return was seen in three trials. It was not tested on its own.

## Results files

`results/` has one folder per experiment, and each file keeps the experiment in its name. The task definitions the runners read are in the top-level `tasks/`, with the database seeds in `tasks/db/`. Paths below are relative to each heading's folder.

### results/tokens/

The `npm run compare` output.

- `2026-11-07-deployed.txt`: the four variants on the deployed Workers, characters / 4, Turnstile only.
- `2026-11-07-deployed-tasks.txt` and `2026-11-07-full-local.txt`: the token tables above, tiktoken, three tasks.
- `2026-11-09-deployed.txt`: the token table and per-group task load for the second round, `flat`, `opt2` and `opt2-rec` on the deployed Workers and `opt1` and `opt3` locally.

### results/select/

- `2026-11-07-select-*.jsonl` and `.txt`: the v1 set's raw answers and summaries.
- `2026-11-07-select2-*.jsonl` and `.txt`: the v2 set's first run, without the skill index, with the per-task matrix.
- `2026-11-08-select2-*.jsonl` and `.txt`: the v2 set with the skill index, every mode and model. The tables above come from these.
- `2026-11-09-select2-*.jsonl` and `.txt`: the second round's selection runs. Labels with `-rec` are `opt2-rec`, `-rec-dup` the same with every skill listed.
- `2026-11-10-select3-full-*.jsonl`: the held-out tasks' selection runs on the full catalog. Labels with `-rec` are `opt2-rec`.
- `2026-11-12-select2-*-deepseek-baseten.jsonl` and `.txt`: DeepSeek V4.1 Flash's seven second-round cells, run again in full. They replace its rows in the 2026-11-09 files, which are kept.
- `2026-11-23-select2-subset-groups-s5.jsonl` and `-dedup-s5.jsonl`: the open models on the subset with every skill listed and with each workflow listed once. `2026-11-24-select2-subset-groups-hosted-s5.jsonl` and `-dedup-hosted-s5.jsonl`: Opus, Gemini 3.8 Flash and Kimi on the subset. `2026-11-24-select2-full-groups-s5.jsonl` and `-dedup-s5.jsonl`: those three and DeepSeek on the full catalog. `--replay` prints each summary.

### results/traces/

- `traces-public/`: the 180 redacted sessions, their index and scored summary. The summary is in the scorer's 2026-11-08 format, and the current scorer prints the same values in more columns.
- `traces2-public/`: the second round's 300 redacted sessions, their group-open logs, index and scored summary.

### results/agent/

- `2026-11-13-agent-*.jsonl`: the open-model agent run, one row per model request. `arm-b`, `arm-c` and `arm-a-rerun` are the cold runs for the Baseten models (`arm-a` holds the first attempt, made before the account ran out of credit), the `-shared` files the runs with the tool block shared between sessions, and the `-deepinfra` files Qwen3.6 and Gemma, with the two repeated Gemma sessions in `-deepinfra-rerun`. `ref-groups-rec` and `pilot-flat-toolsearch` are Sonnet through Claude Code. The `smoke-*` files are the one-scenario checks made before the task script was committed. The scorer drops a session that ended in an error when the same sample was run again, or when it finished no phase.
- `2026-11-13-agent-summary.md` is `npm run agent:score` over the arm, reference and pilot files, `-as-committed` the same with the rubric code as committed before the runs, and `2026-11-13-agent-probe.txt` the endpoint probe.
- The 2026-11-13 follow-up runs are `arm-c-lenient*` (the tolerant wrapper), `full-*` (the full catalog, with `full-b-listing` the listing in the first tool) and `chain30-*` (30-turn sessions, `-pad` with padded results), with `2026-11-13-agent-summary-followup.md`, `2026-11-13-agent-summary-chains.md` and `2026-11-13-agent-probe-order.txt`. Their files record `4f0a982` in their headers. They ran from the working tree that became `6e59282`, which is where their flags were committed.
- `2026-11-14-agent-chain30-*.jsonl` and `2026-11-15-agent-chain30-*.jsonl`: samples 2 and 3 of the DeepSeek chained cells, and arm A with a shared tool block in `a-shared` and `a-shared-pad`, with its warm-up sessions in `a-shared-warm`. They hold the sessions that ended in a provider error and their re-runs. `2026-11-14-agent-summary-chains.md` is `npm run agent:score` over these and the 2026-11-13 chained files. Both chain summaries list, for each pair of sessions, the phase at which arm B passes arm A.
- `2026-11-19-agent-probe-deferred.txt` and `2026-11-20-repro-deferred-loading.txt`: the deferred loading probe through the router and on Baseten direct, and the one-tool reproduction. `2026-11-20-agent-probe-*.txt` and `2026-11-21-agent-probe-*.txt`: the same probe through OpenRouter, and the OpenAI Responses, Gemini and Anthropic probes.
- `2026-11-20-agent-direct-*.jsonl`: DeepSeek arms A, B, C and D on Baseten's own endpoint, with `-shared` for the shared tool block. `2026-11-20-agent-chain30-d-direct*.jsonl`: arm D's 30-turn sessions, with the sessions that ended in HTTP 429 and their re-runs. `2026-11-20-agent-summary-direct.md`, `-direct-shared.md` and `-chain30-d-direct.md` are `npm run agent:score` over them. `2026-11-20-agent-smoke-d-direct.jsonl` is the check made first.

### results/search/

- `2026-11-24-search-v3-full.jsonl`: the tool search run on the held-out tasks, one row per trial with the queries, the tools returned and the tools called. `npx tsx scripts/search-run.ts --replay` prints its tables. `2026-11-24-search-replay-v3-full.txt` is `scripts/search-replay.ts` over it.
- `2026-11-24-search-returned.txt`: `scripts/search-returned.ts` over `2026-11-24-search-v3-full.jsonl` and the second Haiku and the Opus workflow search files.
- `2026-11-25-search-probe.jsonl` and `.txt`: the 20-query probe of the search, one row per query with the query sent and the tools returned.
- `2026-11-26-search-mechanics.jsonl`: the run on what the search indexes, how it splits words and how it breaks ties, one row per request. `scripts/search-fit.py` prints the figures from it.
- `2026-11-26-search-rewrite.jsonl` and `-10.jsonl`: the third Haiku run's queries sent again on the served and rewritten catalogs, at limit 5 and at limit 10, one row per request with the query and limit sent and the tools returned. `2026-11-26-search-rewrite-20.jsonl`: the same queries at limit 20 on the served catalog. `2026-11-26-search-rewrite.txt` is `scripts/search-rewrite.ts --score` over the three.
- `2026-11-26-search-replay-opus.jsonl` and `.txt`: the Opus search run's queries at limits 5 and 10, and their score.

### results/workflow/

`tasks/workflow-tasks.json` at the top level holds the key as last revised, before the third Haiku run, so `scripts/workflow-run.ts --replay` over any of these files scores it with that key.

- `2026-11-24-workflow-haiku-search.jsonl` and `-groups.jsonl`: the first run on Haiku, one row per trial with the searches or opens, the tools loaded and the tools called. `2026-11-24-workflow-haiku.txt` is `--replay` over both, printed with the first key.
- The `2026-11-24-workflow-haiku-*-v2` files: the second run.
- `2026-11-24-workflow-opus-search.jsonl`, `-groups.jsonl` and `2026-11-24-workflow-opus.txt`: the Opus run.
- `2026-11-25-workflow-haiku-search-v3.jsonl`, `-groups-v3.jsonl` and `2026-11-25-workflow-haiku-v3.txt`: the third Haiku run, with a `calls` field holding each call's arguments.

### results/db/

- `2026-11-25-db-haiku-search-smoke.jsonl` and `-groups-smoke.jsonl`: the two-server database run, one row per trial with the searches or opens, the tools loaded, each call with its arguments, and whether the check passed. `npx tsx scripts/db-run.ts --replay` prints the tables.
- `2026-11-25-db-find-haiku-search.jsonl`, `-groups.jsonl` and `2026-11-25-db-find-haiku.txt`: the lookup tasks on the two servers with `execute_sql` left out, and the tables printed from both files.

### results/samename/

- `2026-11-26-samename-haiku-search.jsonl`, `-groups.jsonl` and their `.txt`: the three servers with the same tools, one row per trial with the searches or opens, the tools loaded and each call with its server. `npx tsx scripts/samename-run.ts --replay` prints the tables.

### results/tasks/

- `v3/`: the held-out tasks and every writer reply.
- `workflow/`: the workflow tasks and every writer reply.

Files were moved into these folders on 2026-11-27. Headers written before then name input files at their old paths, such as `scripts/db-find-tasks.json` for `tasks/db-find-tasks.json` and `results/<file>` for `results/workflow/<file>`.

Re-runs that reproduced an earlier file were not kept, and the 2026-11-02 file from the build against the earlier drafts was removed. This repository starts from a single commit. The private predecessor repository holds the earlier history.
