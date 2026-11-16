# Results

Every table in the repository, with the notes behind each. The sections are in the order the runs were made, and the [README](../README.md) has the findings by conclusion.

Terms used throughout:

- Two servers ran in two rounds. Round one (2026-11-07 and 2026-11-08) is the as-generated groups server. Round two (2026-11-09) adds the rewritten one.
- Three task sets: v1 (14 tasks that name the product), v2 (20 that do not) and v3 (20 held out). Rounds and task sets are separate things: v2 ran in both rounds.
- The subset is 237 Cloudflare tools. Round one's servers also listed a `demo_info` tool, so its counts say 238.
- In the open-model runs, arm A sends every schema up front, arm B appends a group's tools to `tools` when it opens, and arm C keeps a fixed tool set and reads schemas as tool-result text. A phase is one user turn.

## Token measurements

Token counts are tiktoken `o200k_base` over the compact JSON the model would see, not a provider's tool prompt. "Upfront" is what the model reads before it commits to a task: `tools/list`, plus `groups/list` and the skill index where the variant serves them. "Task-load" is what it reads after: instructions, scoped tools and resources, and the skill body. There is one task per cloudflare/skills workflow with API tools. In `flat` the tools are already upfront. Its "Task tools" column counts tools whose names start with the workflow's product prefixes, so email shows 41 there while the workflow group curates 24. A 2025-era client gets every tool in every variant.

### Subset: 238 tools, 13 top-level groups

Deployed Workers, 2026-11-07 (`results/2026-11-07-deployed-tasks.txt`).

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

Local `wrangler dev` after `npm run vendor:full`, 2026-11-07 (`results/2026-11-07-full-local.txt`). The raw output says 3,037 tools because every variant adds `demo_info`.

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
- `opt2` keeps the skill verified (`skills/get` and `read` check its digests) and adds 6 tool definitions. The SDK's `SkillCatalog` lists every SKILL.md in `resources/list`, so a group that scopes one breaks the placement rule. A `SkillSource` with no `listResources` serves the same entries through `skills/list` only, and the rule holds. The SEP's placement rule names only `tools/list`, `prompts/list` and `resources/list`, so by its text `skills/list` is not a listing. What neither document says is whether a skill a group lists stays in `skills/list`.
- `opt3` measures within 100 tokens of `opt2` at every point but the Turnstile task load, where it is 269 higher, since it serves the same bundles under other method names. What it shows is the flattening: the SKILL.md body arrives as `instructions` with no skill entry and no digests, and its seven `references/*.md` links resolve to scoped resources only if the host uses `skill://turnstile-spin/` as their base, which the response does not say. The deployment uses the existing `io.modelcontextprotocol/skills` identifier, so a SEP-2640 client reading it sees entries without `uri` or `frontmatter`; an SDK that speaks both can map one shape to the other.
- In every groups variant, `tools/call` on a scoped tool works on a connection that never issued `groups/get`, as the SEP requires, and the tool stays out of that connection's `tools/list`. The comparison checks this with a dry run of `turnstile_widgets_create`.
- `workers-best-practices` and `wrangler` have no API tools to pair with. Under `opt2` they stay plain skills. Under `opt3` they become instruction-only skills with no digests.
- With the full catalog, the flat `tools/list` is 1.38 million tokens and 6.2 MB, more than any current context window holds. The groups listing is 5,308 to 5,495 tokens for 139 top-level groups. Task load is the same as the subset, because `groups/get` returns the same group. The saving is all in what the model reads before it picks a group, so the question at this scale is whether it picks the right one out of 139. The selection trial tests that.
- Once a group holds more than a few tools, schemas dominate task load. The email group's 24 schemas put `opt1` at 7,822 tokens for email, close to the 8,768 that `opt2` spends on Turnstile, where the skill body is most of the cost and the six schemas are small.
- `groups/get` here answers with `cacheScope: "public"`, since no variant varies a group's contents by caller. The SEP expects `private` in the general case. `tools/list` on the groups variants depends on whether the client negotiated the extension, and it was served `public` during every run. Since the 2026-11-12 redeploy it is served `private`.
- The WG problem statement asks for four measures: initial context size, total tokens, end-to-end latency and task completion. The tables above and the selection trial cover the first two. The task-completion run covers the other two, through a real client.

## Selection trial, v1 tasks

`scripts/select.ts` shows a model what a client sees before `groups/get`: the top-level tools and `groups/list`, as names and first description lines. It then gives the model a task and asks for one JSON answer: a group to load, a top-level tool to call, or none. The flat control shows every tool's name and first line instead, and asks for a tool. There are 14 tasks: 11 tool tasks across the 10 products, 2 knowledge tasks (review a Durable Object class, explain a Worker's fetch handler) and 1 that nothing fits, where the expected answer is none. Each task gets 5 samples, or 2 on the 3,036-tool control. The models are Qwen 3.5 9B and Qwen3 14B through the Hugging Face router on deepinfra (thinking off, temperature 0.2, one seed per sample) and Claude Opus 5.5 through the Anthropic SDK at effort low. Claude reads the catalog from a cached block, so its input-token count excludes the cache read. "Right name" counts an answer whose value is correct under either JSON key. The 9B model often returns a group name as `{"tool": ...}`, which a real client would send to `tools/call`. Run on 2026-11-07; raw answers are in `results/2026-11-07-select-*.jsonl`.

| What the model read | Tokens before the task | Qwen 3.5 9B | Qwen3 14B | Claude Opus 5.5 |
| :-- | --: | --: | --: | --: |
| 13 groups (238-tool subset) | 442 | 45/70, right name 65/70 | 70/70 | 70/70 |
| 139 groups (3,036-tool catalog) | 3,682 | 33/70, right name 65/70 | 65/70 | 70/70 |
| 238 tool names, flat control | 6,720 | 61/70 | 70/70 | 64/70 |
| 3,036 tool names, flat control | 81,414 | 22/28 | not run (40k context) | 25/28 |

- Going from 13 to 139 groups did not change which group the models picked. The 14B model's five misses at 139 groups are all on the no-fit task, where it chose the server's `demo_info` tool instead of none. The 9B model's five name-level misses are on that same task at both sizes. Every other sample picked the right group.
- The flat control agrees with the data point the SEP cites: a model that can read the whole list already selects well, and the 14B model was perfect on 238 names. Groups did not improve selection. They cut what the model reads before the task from 6,720 tokens to 442 at 238 tools and from 81,414 to 3,682 at 3,036 tools. At 3,036 tools the full schemas, 1.38M tokens, cannot be read at all.
- Claude's flat-control misses are on the two knowledge tasks, where it picked `demo_info`. The 9B model answered none on the Durable Object review, on the Turnstile setup task (4 of 5 at 238 names, 2 of 2 at 3,036) and on the queue-consumer task (2 of 2 at 3,036). The v1 set ran before the prompt carried the skill index (see the v2 set), so flat mode had no skill to answer with while groups mode had the `durable-objects` workflow group. Five of Claude's six flat misses are that one task. Read the flat control here as at least as good as groups.
- The 9B model's weak point is the answer format. 20 of 70 answers at 13 groups and 32 of 70 at 139 named the right group under the `tool` key. A host that routes on the key would issue a `tools/call` for a group name. Group and tool names share vocabulary in this catalog (`kv-api`, `kv_bulk_get`), which may contribute.
- Where a task accepted either the skill's workflow group or the product's API group, the Qwen models chose the workflow group on 24 to 29 of 35 answers and Claude chose the API group on 20 of 35. Claude's split followed the task: the setup task went to `turnstile-spin`, rotating a leaked secret went to `turnstile-api`.

## Selection trial, v2 tasks: the job without the product name

20 tasks behind `--tasks v2`, one sample each. Each describes the job and not the product ("Serve 50 GB of user uploads to browsers on another origin, so cross-origin headers are needed"), with pairs that one group answers: routing against sending, queues against Durable Objects, KV against D1 and R2, Workers against containers. Two are knowledge tasks and two have no fit in the subset. Six open models through the Hugging Face router with thinking off: Qwen 3.5 9B, Qwen3 14B, GLM-5.3 Flash, DeepSeek V4.1 Flash, Qwen3.6 35B-A3B and Gemma 4 26B-A4B. The `flat-schemas` mode puts the whole `tools/list` result with input schemas in the prompt, 157,642 tokens at 238 tools. The 14B model's 40k context skips that and the 81k-token full name list. Against the 3,036-tool catalog the scoring also accepts the products the subset lacks that fit a task: `dns-api` and `email-auth-api` for the mail DNS check, `workflows-api` for retried background jobs, `workers-builds-api` and `builds-api` for pushing a build, `flagship-api` for feature flags, and `accounts-api` or `user-api` for rotating an account token, which the subset cannot do.

The set ran twice. The first run, on 2026-11-07, showed the model tools and, in groups mode, groups. Both servers also serve five skills over the Skills extension, and a Skills-extension client would show those too, but the prompt left them out. So a knowledge task had no answer in flat mode. The second run, on 2026-11-08, added the `skills/list` index to every prompt (five names and descriptions, about 190 tokens) and a `{"skill":"<name>"}` answer. A skill counts where the same-named workflow group counts, and `workers-best-practices` counts for the fetch-handler question and `wrangler` for the deploy and schedule tasks. The tables below are the second run. Raw answers are in `results/2026-11-07-select2-*.jsonl` and `results/2026-11-08-select2-*.jsonl`, and the `.txt` summaries show every model's pick per task. With one sample per task, two cells that differ by one or two are the same result. The notes below only call out differences of three or more.

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
- At 3,036 tool names with the skill index, the four models whose context holds the list score 18 or 19. GLM, DeepSeek and Qwen3.6 are above their 139-group scores and Gemma is one below. The 9B model falls to 5 and answers none on 14 of 20.
- Full schemas at 238 tools did not hurt the models whose context holds them: GLM, DeepSeek, Qwen3.6 and Gemma scored 19, 19, 16 and 19 against 18, 20, 19 and 19 on names alone. The 9B model dropped to 9 and answered none on 9 tasks. Three of Qwen3.6's four schema misses are `skill:workers-best-practices` for a queue or R2 task. The fourth is `skill:durable-objects` for the feature-flags task.
- What the skill index changed, by three or more tasks: the 9B model at 13 groups went from 10 to 16, and Qwen3 14B at 238 names from 15 to 19. The 9B model also went from 12 to 15 at 238 names and from 9 to 5 at 3,036, and Qwen3.6 from 20 to 16 on the schema control. At 3,036 names, GLM went from 16 to 19, Qwen3.6 from 13 to 18 and Gemma from 13 to 18. In groups mode the 9B model went from 7 to 10 at 139 groups and Gemma from 17 to 19; the other four larger models' groups cells moved by at most one. Eleven of the twenty tasks accept a skill as an answer, and the models take it: 3 to 11 skill answers per model on the 238 flat names, and both knowledge tasks went to a skill from every model in every mode.
- Three flat tasks expect a specific tool (rotate the secret, a lifecycle rule, a schedule). A model that answers with the product's list tool first is scored as a miss, and so is `skill:workers-best-practices` for a Workers task, where `wrangler` is accepted.
- Where a task accepts either the workflow (as a group or as a skill) or the product's API group, the open models took the workflow on 3 of 6 up to 7 of 7 at 13 groups.

### Hosted models and classifiers

The same set with hosted models through their vendors' SDKs, each at its lowest reasoning setting: Claude Opus, Sonnet and Haiku 5.5 at effort low, GPT-6 Astra and GPT-6.1 Sol at reasoning effort low, GPT-6.1 Terra and GPT-6 Luna at none, Kimi K3.1 Pro at low, Gemini 4 Argon and 3.8 Flash at thinking level low. The last two columns are classifiers, which take the group names with first description lines, the skills not already named by a group, and none as the choices, and return a pick with probabilities and no generated text, so they run in groups mode only: the OpenAI Decisions API on GPT-6 Luna, and TypeSafe's Jev through its System One endpoint (`jev-latest`, resolved to 1.14.0). Astra was not run on the schema control. The OpenAI account ran out of credits partway through the schema control; Terra's and Luna's rows in that file are from a re-run after credits were added. Raw answers are in `results/2026-11-08-select2-*-hosted.jsonl`, `*-gemini.jsonl`, `*-kimi.jsonl` and `*-jev.jsonl`.

| What the model read | Opus 5.5 | Sonnet 5.5 | Haiku 5.5 | GPT-6 Astra | GPT-6.1 Sol | GPT-6.1 Terra | GPT-6 Luna | Gemini 4 Argon | Gemini 3.8 Flash | Kimi K3.1 Pro | Decisions API (Luna) | Jev 1.14 |
| :-- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: |
| 13 groups and 5 skills | 20/20 | 20/20 | 19/20 | 20/20 | 20/20 | 20/20 | 20/20 | 19/20 | 20/20 | 19/20 | 19/20 | 20/20 |
| 139 groups and 5 skills | 20/20 | 19/20 | 19/20 | 20/20 | 20/20 | 19/20 | 18/20 | 19/20 | 18/20 | 18/20 | 20/20 | 16/20 |
| 238 tool names and 5 skills, flat | 20/20 | 20/20 | 18/20 | 20/20 | 20/20 | 18/20 | 20/20 | 20/20 | 20/20 | 20/20 | | |
| 238 tools with schemas and 5 skills, flat | 19/20 | 20/20 | 17/20 | not run | 18/20 | 19/20 | 20/20 | 20/20 | 19/20 | 18/20 | | |
| 3,036 tool names and 5 skills, flat | 20/20 | 20/20 | 17/20 | 19/20 | 18/20 | 17/20 | 20/20 | 20/20 | 20/20 | 20/20 | | |

- Every hosted model scores 17 to 20 of 20 in every mode at both sizes, and no model moves by three or more between modes. Groups did not measurably change what the hosted models picked. They changed how much the models read first: 633 or 3,873 tokens instead of 6,911 or 81,605. With one run of 20 tasks per cell, a 95% interval on 19 of 20 spans 15 to 20, so a gap of one or two tasks is noise.
- The misses at 139 groups repeat across models: `iam-api` for rotating an account token (Sonnet, Haiku, Terra and Argon; IAM has no token tools), `durable-objects` for retried background jobs (Luna and Kimi), `workers-best-practices` for the nightly schedule (Kimi and Flash), `hyperdrive-api` for relational tables (Luna). The flat misses are list-first picks (`turnstile_widgets_list` before rotating the secret, `r2_buckets_list` before a lifecycle rule, from Terra) and `workers-best-practices` for a queue or deploy task (Astra, Sol, Terra, Haiku).
- What the skill index changed for the hosted models, by three or more tasks: Haiku went from 7 to 18 at 238 names and from 1 to 17 at 3,036. At 238 names Opus, Sonnet and Luna each went from 17 to 20, and Luna went from 17 to 20 on the schema control. At 3,036 names Opus and Sonnet went from 16 to 20, Luna from 15 to 20, Flash from 17 to 20. Jev went from 13 to 16 at 139 groups and 18 to 20 at 13, and Gemini 3.8 Flash went from 20 to 18 at 139. Every other hosted groups cell moved by at most one. In the first run Haiku answered `demo_info`, the first tool listed, on most flat tasks. With the skill index it answered a skill on 7 and 10 of 20 and `demo_info` on two. The first run's collapse came from a prompt with no non-tool answer for the knowledge tasks, not from the model. On the repeated schema control Haiku scored 17, against 4 before.
- The classifiers: the Decisions API scored 19 and 20 of 20 at about 600 and 4,000 input tokens per call and no output tokens; both runs together cost about a cent. Jev scored 20 at 13 groups and 16 at 139, where its misses follow surface words: `pipelines-api` for "the orders pipeline", `sql-api` for SQL joins, `workflows-api` for a nightly schedule. Enumerated choices rule out the key confusion the small chat models show.
- The 158k-token schema list with the skill index: Opus 19, Sonnet 20, Haiku 17, Sol 18, Terra 19, Luna 20, Argon 20, Flash 19, Kimi 18, each within two of its names-only score. Every miss on it is a skill answer for a tool task (`workers-best-practices` or `wrangler` for a queue, deploy or containers task) or a list-first pick. Anthropic, Kimi and Argon reported cache reads throughout (2.9M to 5.2M tokens per model on this control); the OpenAI chat completions API reported none even with a `prompt_cache_key`, so the GPT-6 input counts are uncached.
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

- Sonnet and Opus completed every task under every condition. Haiku missed 4, 2 and 1; its groups-mode misses are answers given without opening a group or reading a skill (the class review, the nightly schedule, the fetch-handler question), one attempt to use the disallowed Bash tool, and one session that wandered into the host's `Workflow` tool.
- Groups cost a turn. Opening a group is a round trip, and the nested toolset groups often cost two (`turnstile-api`, then `turnstile-widgets`): median 5 turns against 3 or 4, and 3 to 4 seconds more wall time per task. The second open comes from this demo's tree. `productToolsets()` in `src/catalog.ts` gives a product group only the tools at the product's root path, and 5 of the 10 subset products (Turnstile, Durable Objects, KV, R2, containers) have none there, so the parent holds only child groups. The SEP says servers SHOULD keep hierarchies shallow and that groups pay disclosure once; the second round runs a one-level tree.
- Loading every schema up front reads seven to eight times the input tokens of groups, but costs only three times as much on Sonnet and Opus. On Haiku it costs 14 times as much, 1.33 against 0.09 USD. The provider's cache explains the gap: the 305k-token prefix is written once per model and read from cache on every turn of every session, 97% of all input. Groups read 2.32M to 2.37M input tokens per model and the host's tool search 1.96M to 2.22M; groups cost less in dollars because more of their input came from cache, 88% to 92% against 83% to 84%.
- On this catalog, the host's tool search does for the flat server what groups do: same completion, a nearby token band, one fewer turn. `register.ts` registers scoped tools with `isDeferred` true by default, so they load through ToolSearch after each `open_group`, 19 to 21 calls per model against 16 to 19. The run shows groups composed with host tool search; the second round tests a client without it. What groups add is the bundle: instructions and a skill delivered with the tools.
- The mod does not use the Skills extension. `open_group` reads the listed SKILL.md with `resources/read` and inlines it in the tool result; it never calls `skills/get` and checks no digests. The run does not exercise #22's interop rules 1 and 2 or Example 3's steps 3 and 4, and it loads the skill on group open, which the SEP says a group fetch does not do. The `skills/get` and digest checks in this repository are in `scripts/compare.ts`.
- Three tasks depend on data a dry-run server never returns. `push-build` needs a file the session cannot read, `purge-sessions` needs the key names a list would return, `instances-with-data` needs namespace ids. Every model took the right first step and said why it stopped; Sonnet and one Opus session uploaded a placeholder bundle, two Opus sessions filled a bulk delete with made-up key names, the other Opus session refused to. The rubrics accept the first step for these three.
- Prefix sizes, from the session usage: about 21k tokens on the first request for groups (Claude Code's system prompt, the mod's section and three helper tools), about 25k for tool search (the 238 tools as deferred names), about 305k with all schemas up front. In groups mode, the request after an open wrote a median 0.5k tokens to the cache, and the request after the ToolSearch call that loaded the group's tools a median 1.5k. The rest was read from cache. A session grew by a median 3.8k tokens from its first request to its last. With tool search off, a registration rewrites the prefix.
- The headless sessions load the user-level Claude Code plugins and hooks of this machine, the same overhead in every arm. One model family on one host, 20 tasks, one sample each. The `flat-toolsearch` arm is Claude Code's tool search; another host's would differ.

Raw session files are not committed: they embed the full system prompt and account ids. `scripts/trace-redact.ts` keeps the `user` and `assistant` rows, strips paths and ids, and refuses to write anything key-shaped; the result is `results/traces/traces-public/`, 180 files with the scrubbed index and its own README, which `npm run trace:score -- --label traces-public` re-scores. The same folder is attached as a zip to the release `traces-2026-11-08`.

## Second round, 2026-11-09: the rewritten build, a client without tool search, and the duplicate listing

The second round tested three questions. A: does a groups server rebuilt to the guidance in #19 behave differently from the as-generated one, and how do both compare with flat behind host tool search? B: what do groups cost in a client without tool search? C: does listing a grouped workflow in both `groups/list` and `skills/list` cost anything?

### What changed

- `opt2-rec`, a new variant, deployed at `https://pd-groups-opt2-rec.olahungerford.workers.dev/mcp`. It is called the rewritten build below, and the `-rec` in its name stands for the two recommendations it follows. What it takes from #19 is the two SHOULDs: descriptions that carry task vocabulary, and a shallow hierarchy. The one-level split, the size cap and leaving grouped skills out of `skills/list` are this demo's choices. Every group is top level. A product stays one group unless it has more than 25 tools or about 15k tokens of schemas; a larger one is split by its second-level directories, and areas under 4 tools join a `-core` group. On the subset that splits `workers` into 8 groups and `r2` into 3, for 22 groups; on the full catalog it gives 271. Product descriptions carry task vocabulary. The subset's 19 were written by hand; the full catalog's 249 others were written by Sonnet 5.5 from each group's tool descriptions (`scripts/describe-groups.ts`) and the ones round one's misses landed on were reviewed by hand. Each workflow group's description says when to open it against the product group ("open `turnstile-api` to list or edit existing widgets"). A client that negotiated groups gets only `workers-best-practices` and `wrangler` in `skills/list`; that listing is served with `cacheScope: "private"`. The descriptions were written after round one's results, and some of the hand-written ones reuse wording from the v2 tasks. `describe-groups.ts` gave the writing model four hand-written descriptions as examples. The held-out task set below tests the rewritten build on tasks written after it, by models that did not see it.
- `opt2` is kept as the as-generated baseline. `demo_info` is gone from every variant; its text is in the server `instructions`. Every selection prompt's "Top-level tools" line changed with it, so the flat-names and as-generated arms were re-run. The flat-schemas control was not; its 2026-11-08 file still shows `demo_info`.
- The mod (0.2.0) no longer inlines the SKILL.md when a group opens. `open_group` returns the instructions, the tools and the skill's URI. `read_skill` fetches the entry with `skills/get`, reads the file and refuses it unless its SHA-256 matches the published digest. With `dedupGroupedSkills` (default on), a skill that is also a group is listed once, as the group, and `read_skill` on it opens the group first. Group opens are logged to the file `GROUPS_LOG` names.
- The knowledge rubrics (`state-holder`, `review-alarms`, `fetch-handler`) now require a `read_skill` call. Round-one rows, which have no mod version in the index, keep the old rule, so the committed round-one traces re-score unchanged.

### Tokens

`results/2026-11-09-deployed.txt`. Upfront is 1,221 tokens for `opt2-rec` against 674 for `opt2` (both now without `demo_info`), since the listing has 22 groups with longer descriptions. Task load for the three workflows: Turnstile 8,781, Durable Objects 2,322, email 11,661 with 33 tools (the bundle now includes the sending subdomains' DNS tools and the routing settings). Per group, from `groups/get`:

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

The 20 v2 tasks, one sample, the skill index in every prompt, as in the 2026-11-08 run. Four arms: as-generated (`opt2`), rewritten (`opt2-rec`), rewritten with every skill listed (`--list-all-skills`, which reads `skills/list` as a client that declares only the Skills extension), and flat names. The rewritten server's split groups are accepted where they hold the task's tools: `r2-buckets` for CORS and lifecycle, `workers-versions`, `workers-deployments` or `workers-legacy` for pushing a build, `workers-core` for the schedule, and on the full catalog `dns-records`, the four `builds-*` groups and `accounts-tokens` or `user-tokens`. Runs that record the served group names (every 2026-11-09 run) accept only names that exist. Raw answers are in `results/2026-11-09-select2-*.jsonl`.

Baseten's DeepSeek V4.1 Flash answered 503 or 429 to most calls on 2026-11-09. Its seven cells were run again in full on 2026-11-12, on Baseten, against the same servers and prompts, and every call was answered. The table shows the 2026-11-12 runs (`results/2026-11-12-select2-*-deepseek-baseten.jsonl`). The OpenAI account ran out of credits partway through, and the trials it failed were asked again with `--retry` the same day.

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
| 237 tool names, flat | 20/20 | 20/20 | 18/20 | 20/20 | 18/20 | 17/20 | 19/20 | 20/20 | 20/20 | 20/20 | | |
| As-generated, 139 groups (full catalog) | 20/20 | 19/20 | 19/20 | 20/20 | 20/20 | 20/20 | 19/20 | 19/20 | 17/20 | 19/20 | 20/20 | 16/20 |
| Rewritten, 271 groups (full catalog) | 20/20 | 20/20 | 19/20 | 20/20 | 20/20 | 20/20 | 19/20 | 20/20 | 20/20 | 20/20 | over 255 choices | too long |
| 3,036 tool names, flat | 20/20 | 19/20 | 18/20 | 20/20 | 20/20 | 18/20 | 19/20 | 20/20 | 18/20 | 20/20 | | |

- A: at the full catalog, the rewritten build raised the two open models the as-generated one had cost most: Qwen 3.5 9B from 10 to 17 and Qwen3.6 35B-A3B from 15 to 20. Qwen3 14B (16 to 18) and Gemma (18 to 20) moved by two, which is inside the noise. Every hosted model scored 19 or 20 of 20 on it. The price is the listing: 16,538 tokens against 3,856, about a fifth of the 81,586-token name list.
- A: the misses at 271 groups are mostly one confusion, `pipelines-api` for the dead-letter destination on "the orders pipeline" (3 models). Retried background jobs was missed by two models, and every other miss is a single model. At 139 as-generated groups the misses spread across `iam-api`, `sql-api`, `durable-objects`, `workers-best-practices` and others, as in round one.
- A: on the subset every model scored 18 to 20 of 20 on the rewritten build, against 16 to 20 as-generated. Most of those gaps are inside one or two tasks, so the subset result is that the rewritten build does no harm.
- C: on the subset, listing every skill as well cost no correct picks: each model is within one task of itself between the two rewritten arms. Skill answers on tasks that need a group fell to 0 across all models with the grouped skills left out, against 3 open-model and 5 hosted-model answers with them listed (Gemini 3.8 Flash 2, Opus, Haiku, Kimi, GLM, DeepSeek, Qwen3.6 one each). Neither arm sent a task to `wrangler` or `workers-best-practices`. On the as-generated server the same count was 18 and 18. The arm that still lists every skill has 8, so most of the drop came with the rest of the rewritten build, before the listing changed.
- The classifiers cannot take the full rewritten listing. The Decisions API caps a choice list at 255 and the listing has 271 groups plus skills and none; Jev rejects the same list as too long.

### Task completion

Five conditions, three models, 20 tasks, 300 sessions on 2026-11-09, no errors, 35.27 USD. Every arm was re-run the same day; jobs for different conditions and models ran side by side. Full table with every call: `results/traces/traces2-public/summary.md`.

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
- B: without tool search, the prediction on turns held and the one on tokens did not. Every model took one fewer median turn on the product tasks (4 against 5) and made no ToolSearch calls. But each resident open rewrites the cached prefix: cache writes were 2.6 to 2.9 times the deferred arm's, input tokens 1.4 to 1.8 times, and cost 2.2 to 2.4 times. On Opus the turn after a resident open read nothing from cache and wrote a median 30k tokens. After a deferred open every model read the whole prefix from cache and wrote under 1k. Sonnet's resident opens were partly served from prefixes other sessions in the batch had written, so a single cold session would cost more. This is the case the SEP's prompt-caching section describes for clients that keep tool definitions in the cached prefix. Appending tools after the prefix, which it describes for providers that support it, was not tested in this round, and neither was any open model. Both are in the open-model agent run below. In the smoke run one `r2-buckets` open took the prefix from 25.7k to 48.7k tokens as the provider renders it, 23k for a group that measures 13.4k in o200k. Wall time was 0.7 to 2.8 seconds lower at p50.
- Opening a group no longer loads its skill, and Sonnet and Opus read the skill anyway: 8 of 8 workflow tasks in both rewritten arms, with 8 to 10 `read_skill` calls per model. Haiku answered the two Durable Objects knowledge tasks and the fetch-handler question from its own knowledge in one turn in several groups arms, which the rubric now scores as a miss. In round one the same answers counted, because the group open had already put the SKILL.md in context.
- Every `read_skill` in round two went through `skills/get` with the digest checked; no digest failed.
- Haiku's `nightly` miss in the resident arm reached for `CronCreate`, a host built-in that `trace-run.ts` does not disallow, and stopped to ask for a timezone.
- In `flat-toolsearch`, every model called ToolSearch at least once on each of the 16 tasks that need a tool, in both rounds. The sessions with no call are the three knowledge tasks, plus Sonnet on `rotate-token`, the no-fit task, which it answered correctly without a tool. On these tasks no miss came from a model failing to search.

Raw sessions are under `results/traces/traces2/` (gitignored); `results/traces/traces2-public/` is the redacted copy, 300 sessions with each session's group-open log, and re-scores identically.

## Held-out task set, 2026-11-10

The v2 tasks were written by this demo's author, who had read the group descriptions. The v3 set was written by two models the demo does not test, from a product name alone, and run on the full catalog against the three servers from round two.

### How the tasks were made

- `scripts/write-tasks.ts` gave Fable 5.2 and Gemini 3.6 Flash one product at a time, as `Cloudflare <product> (API directory "<dir>")`, with rules: one or two sentences, no product, Cloudflare or API names, a job done by reading or changing account resources, and SKIP for a product the writer does not know. Neither writer saw a group listing, a tool name or a description. Products were drawn from the 136 forge directories in a seeded order (mulberry32, seed 20261109), and each writer took 3 of the 10 subset products and 7 of the others.
- Six of the first 20 tasks spanned products, missed their product or repeated its name (smartShield, emailAuth, observability, signedUrl, connectorTelemetrySnapshots, diagnostics). Fable redrew them from the next products in the same stratum, with two added rules: the job needs only this product, and no word from its name. It skipped webAssets, cps and connectorInterrupts. The final set is 14 Fable tasks and 6 Gemini tasks in `results/tasks-v3/tasks.json`. Every reply, skips included, is in `results/tasks-v3/raw.jsonl`.
- Accepted answers were fixed before any model ran. `scripts/v3-answers.ts` names the tools that do any step of each task, by name prefix from the catalog. It accepts a top-level group when that group or one nested under it returns one of those tools from `groups/get` on the served variant, and writes `scripts/select-v3.json`. Six near neighbours are not among the accepted groups and count as misses: `dls-api` for EU processing, `connector-telemetry-snapshots-api` and `connectors-api` for the appliance events, `network-api` for the private connection, `ai-gateway-logs` for the LLM proxy and `web-assets-labels` for the endpoint inventory. This list was written after the runs, and the accepted answers were not changed.
- `npm run select -- --tasks v3`, with the same prompts and settings as round two: one sample, the skill index in every prompt. Three arms: 271 rewritten groups (16,538 tokens), 139 as-generated groups (3,856) and 3,036 tool names flat (81,586). Raw answers are in `results/2026-11-10-select3-full-*.jsonl`.

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
| Haiku 5.5 | 20 | 18, one answer unparsed | 18 | 19 |
| GPT-6 Astra | 20 | 19 | 13 | 19 |
| GPT-6.1 Sol | 20 | 18 | 13 | 19 |
| GPT-6.1 Terra | 20 | 18 | 11 | 18 |
| GPT-6 Luna | 18 | 16 | 19 | 20 |
| Gemini 4 Argon | 20 | 19 | 11 | 19 |
| Gemini 3.8 Flash | 20 | 19 | 15 | 19 |
| Kimi K3.1 Pro | 20 | 20 | 18 | 19 |
| Decisions API (Luna) | over 255 choices | 17 | | |
| Jev | too long | 15 | | |

- On the rewritten build the open models scored 17 to 19 and the hosted models 18 to 20, close to their round-two scores on the v2 tasks. The misses are mostly one task: 5 on the private connection (`workers-vpc-api` 3, `network-api` 2). Two went to `connector-telemetry-snapshots-api` for the appliance events and two were on the LLM proxy. Three tasks were missed once each.
- On the as-generated build the open models scored 3 to 18, and five of them lost 3 to 14 tasks against the rewritten build. The hosted models scored 16 to 20. EU processing was missed 14 times across models and classifiers (`zones-api` 7, `dls-api` 5). Its tools sit in `addressing-api`, whose templated description names only the product. This repeats round one's finding on templated descriptions on tasks nobody tuned for, with a wider gap.
- Haiku's unparsed answer on the as-generated build gave `queues-api`, the accepted group, twice with a sentence between, which the parser rejects. Read as its first object it scores 19.
- Flat, strict: the prompt asks for the tool a model would call first, and the committed answers list only the tools that do the job. A lookup first therefore scored a miss: `zones_list` on 37 picks, mostly for tasks that name a domain, and `d1_list` on 6 picks before a query. `scripts/v3-rescore.ts` applies a first-call rule decided after the results. It also accepts any tool of a needed tool's product, as v2's product prefixes did, and `zones_list` or `zones_get` when a needed tool's path takes `{zone_id}` (9 tasks, read from the catalog). Under it the hosted models score 18 to 20 flat, against 18 to 20 on the rewritten build. Groups did not measurably change what the hosted models picked. The open models do not move except Gemma, 15 to 17. The committed scoring and `--replay` are unchanged.
- The custom-pages task names a zone, but this catalog's custom-pages tools are account-level, so its 7 `zones_list` picks stay misses under the first-call rule.
- Writers: on the rewritten build the Claude models scored 60 of 60 and the Gemini models 40 of 40, across both writers' tasks. On the as-generated build the Claude models scored 41 of 42 on Fable's tasks and 15 of 18 on Gemini's, so neither groups arm shows a writer favouring its own family. On flat names under strict scoring the Gemini models scored 10 of 12 on Gemini's tasks and 16 of 28 on Fable's, and the Claude models 16 of 18 and 35 of 42.
- The classifiers ran on the as-generated listing only, for the reasons in round two: the Decisions API scored 17 and Jev 15.

## Open-model agent run, 2026-11-12

The completion runs above used Claude models through Claude Code, which defers tool loading. This run asks what groups cost on models whose endpoints have no mid-session tool mechanism, as the number of group opens in a session grows, and whether a client that keeps a fixed tool set still completes the tasks. The question came from the 2026-11-11 WG meeting.

### Setup

- `scripts/agent-tasks.ts`: five scenarios of six phases. A phase is one user turn that needs one or two tools from one group, and phase five returns to a group an earlier phase used, so a session opens five groups. The phases name no group and no tool. Each has a rubric over the tool calls and their arguments. Fable 5.2 wrote them with the subset's group listing and schemas in view. They were committed (`8d6e83f`) before the full runs and not changed after.
- `scripts/agent-run.ts` drives a model through the phases with its own loop, under three client designs. Arm A puts all 237 schemas of the flat Worker in `tools` from the first request. Arm B starts with `list_groups`, `open_group` and `read_skill` against `opt2-rec` and appends a group's tools to `tools` when it opens. Arm C keeps `tools` fixed at those three plus `call_tool(name, arguments)`, and `open_group` returns the schemas as tool-result text.
- Models: GLM-5.3 Flash and DeepSeek V4.1 Flash on Baseten, Qwen3.6 35B-A3B and Gemma 4 26B on DeepInfra, all through the Hugging Face router with thinking off, temperature 0.2 and streamed responses. Three samples per scenario, 15 sessions per cell. Arm A ran on the two Baseten models only.
- Reference: Claude Sonnet 5.5 through Claude Code with the mod against `opt2-rec`, scoped tools deferred, each phase a user turn in one process (`scripts/agent-ref.ts`).
- Cost is list price on 2026-11-12: GLM-5.3 Flash 0.15 USD per million input tokens, 0.03 cached, 0.50 output; DeepSeek V4.1 Flash 0.30, 0.007, 1.20; Qwen3.6 0.10, 0.10, 0.95; Gemma 0.07 with no cached price, 0.34.
- Full tables: `results/2026-11-13-agent-summary.md`. The files are dated in UTC.

### The endpoints do not expose the templates' own mid-session paths

Both Baseten models' public chat templates can add tools after the first turn. GLM-5.3 Flash's template leaves out a tool marked `defer_loading` and renders it when a tool result carries a `tool_reference`. DeepSeek V4.1 Flash's template renders `tools` attached to a later system message. `scripts/agent-probe.ts` tried both through Baseten's chat completions endpoint on 2026-11-12 (`results/2026-11-13-agent-probe.txt`). The GLM endpoint rendered the 13 deferred schemas up front (4,455 prompt tokens against 234 without them) and answered a `tool_reference` tool result with HTTP 400. The DeepSeek endpoint accepted the system message and dropped its `tools` (407 prompt tokens against 4,726 with the tools resident), and the model called `open_group` again. So arm B re-sends a longer `tools` array.

### Cold sessions need the marker in the tool block

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
- Qwen3.6 in arm B passed the request body as a JSON string on 69 of its 71 invalid calls. The server accepts a string body, and the rubrics were meant to. The rubric code committed before the runs only unescaped quotes, so a string body with spaces after its colons did not match, and Qwen3.6 scored 48 of 90 in arm B. The fix parses string bodies and was made after seeing the results. No other cell changes under it. `--as-committed` reproduces the committed scoring (`results/2026-11-13-agent-summary-as-committed.md`).
- Gemma's misses are wrong field names (`allowedOrigins` for `allowed.origins`, `query` for `sql`). Two of its arm C sessions ended when the Hugging Face account ran out of credit and were run again the same night.
- Six of GLM's nine arm C misses are one session. It put the tool's `name` inside `arguments` on every `call_tool`, the loop answered that `call_tool` needs a name and an arguments object, and the model repeated the same call through all six phases. A client that accepted that shape or explained the error would likely have recovered it. Three of GLM's 15 arm C sessions had a `call_tool` error and none of DeepSeek's.
- The other misses on the Baseten models repeat: a URL-encoded key name (`config%3Amax_width`, GLM in every arm), a migration target without the bucket's EU jurisdiction (GLM, arm B), and the incremental-migration tools used for a bulk migration (DeepSeek, arm B).
- Sonnet finished 30 of 30 phases in a pilot on the flat server behind the host's tool search and 90 of 90 with groups. The plan was to tune the tasks until a hosted model landed at 60 to 80 percent. That was not done: the tools are dry runs that return no data, and the tasks were left as first written.

### Cache and cost after an open

Cold runs. Re-read tokens are the part of the previous request's prompt that the request did not get from cache.

| Model | Arm | Requests after an open | Median re-read tokens | Requests re-reading over half | Other requests | Median re-read tokens | Requests re-reading over half | Median first token ms, after an open / other |
| :-- | :-- | --: | --: | --: | --: | --: | --: | --: |
| DeepSeek V4.1 Flash | B | 75 | 3.0k | 19 | 191 | 126 | 0 | 506 / 344 |
| DeepSeek V4.1 Flash | C | 78 | 110 | 1 | 200 | 141 | 0 | 442 / 347 |
| GLM-5.3 Flash | B | 75 | 6.8k | 39 | 211 | 91 | 13 | 1048 / 686 |
| GLM-5.3 Flash | C | 75 | 151 | 0 | 259 | 76 | 1 | 840 / 681 |
| Sonnet 5.5, Claude Code | deferred | 72 | 2 | 0 | 267 | 2 | 0 | |

- Arm B lost part of its cache at every open, and the loss grew with the session. On DeepSeek the earlier tool block stayed cached and what followed it was re-read: a median 1.5k tokens at the first open, then 2.4k, 3.2k, 3.8k and 5.4k at the fifth. On GLM the median at opens two to five was 6.8k to 9.2k, and 15 of those 60 requests re-read at least 90% of the previous prompt. The claim under test predicted cached tokens near zero after every open. The observed loss is the conversation and system prompt on DeepSeek, and more than that on GLM.
- Arm C kept its cache across opens: a median 110 and 151 tokens re-read. The Claude Code reference re-read a median 2 tokens after 72 opens and wrote a median 525 to cache.
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
- Arm B did not pass arm A on either model in six turns with dry-run results. The follow-up runs below find where it does. A cold arm A session cost more after one phase (0.0657 USD on DeepSeek, 0.0436 on GLM) than arm B did after six (0.0223 and 0.0233). Over six phases cold arm A cost 3.9 times arm B on DeepSeek and 5.2 times on GLM. Each arm A request carried about 200k prompt tokens against about 20k in arm B.
- A cold arm A session pays for the tool block once. The first request was 203k prompt tokens on DeepSeek and 197k on GLM with none from cache, and took a median 4.0 and 5.7 seconds to the first token. Later requests read all but about 100 tokens of the previous prompt from cache, with a median 1.0 and 1.3 seconds to the first token, against 0.3 and 0.7 in arm B.
- With the tool block shared between sessions, arm A on DeepSeek cost 0.0269 USD over six phases, 1.2 times cold arm B, and stayed above it at every phase. DeepSeek's cached price is about 2% of its input price, and every shared session's first request read the tool block from cache. On GLM, whose cached price is a fifth of its input price, shared arm A cost 0.1067. Six of GLM's 15 shared sessions started with no cache read.
- The Hugging Face account answered HTTP 402 partway through the first arm A runs. Arm A was run again in full after a top-up, later the same night. The first attempt's rows are kept in `arm-a.jsonl`, and two GLM sessions of the shared run were not repeated.
- On DeepInfra the cache does not change the bill. Qwen3.6's cached price equals its input price, and Gemma reported no cache reads on any of its requests. There arm B and arm C differ by what they send: Gemma's arm C sessions sent 461k input tokens against 296k.
- In the shared runs, arm B on DeepSeek cost 0.0148 USD against arm C's 0.0158, since tool blocks other sessions had opened in the same order came from cache. On GLM the shared runs cost 0.0273 and 0.0195.

## Follow-up runs, 2026-11-13

The open-model run above had five weaknesses that could be checked or fixed with the same loop: cache behaviour was inferred, the loop's `call_tool` handling cost sessions, the catalog was the 237-tool subset, sessions were six turns, and dry-run tool results are about 100 tokens. This section checks each against the data and re-runs what it could. Summaries: `results/2026-11-13-agent-summary-followup.md` and `results/2026-11-13-agent-summary-chains.md`.

### What the first run's data confirms

- The cost of appending tools is what sits after the old tool block. Across the cold arm B opens that kept part of their cache (59 on DeepSeek, 45 on GLM), the re-read differed from the previous prompt minus the old tool block by a median 0 tokens.
- The dry-run results are small. A server tool result was a median 103 to 109 tokens, and an arm B conversation ended at a median 4.7k tokens. So the first run measured appending at close to its cheapest.
- The three samples of a scenario are near repeats. On the Baseten models they agree on which phases were done in 4 or 5 of 5 scenarios per cell, and in arms B and C cost varies 2 to 13% within a scenario against 17 to 32% between scenarios. A cell is five scenarios.
- Of the 77 `call_tool` wrapper errors in arm C, 64 put the tool's name inside `arguments` (54 in one GLM session, 10 in one Gemma session), 9 were GLM passing `arguments` as a string of invalid JSON, which it corrected on the next call, and 4 were Qwen3.6 sending no name.

### Where the endpoints put tools, from cache counts

`scripts/agent-probe-order.ts` warms a request, then changes one thing and reads `cached_tokens` (`results/2026-11-13-agent-probe-order.txt`).

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

Four of GLM's nine arm C misses were the loop's strictness. DeepSeek had no wrapper error in 60 sessions and was not run again.

### The full catalog

Arms B and C against the rewritten build of the full catalog, served locally: 3,036 tools in 271 groups, whose listing is 16.5k tokens in the system prompt. Arm A does not exist here, since the schemas are 1.38M tokens. Cold, 15 sessions per cell.

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

Each chained session runs all 30 phases, in scenario order or in reverse, and opens 16 or 17 groups. `--pad-results 2000` adds about 2,000 tokens of filler to every server tool result. Two sessions per cell, cold. Mean cost per session in USD:

| Model | Results | Arm A | Arm B | Arm C | Arm B passes arm A |
| :-- | :-- | --: | --: | --: | :-- |
| DeepSeek V4.1 Flash | dry-run size | 0.188 | 0.133 | 0.110 | not in 30 turns |
| DeepSeek V4.1 Flash | padded | 0.251 | 0.395 | 0.135 | at turns 12 and 13 |
| GLM-5.3 Flash | dry-run size | 0.506 | 0.274 | 0.177 | not in 30 turns |
| GLM-5.3 Flash | padded | 1.074 | 0.463 | 0.435 | not in 30 turns |

- The re-read after an open grew through the session. On DeepSeek with dry-run results it went from 1.5k tokens at the first open to 20.9k at the sixteenth. With padded results it passed 100k.
- With padded results on DeepSeek, appending passed all schemas up front at turn 12 in one session and turn 13 in the other, and cost 1.6 times as much by turn 30. This is the crossover the claim under test predicted. It did not appear with dry-run results, and the fixed tool set cost a third of appending. Arm A started cold in these sessions. The 2026-11-14 sessions below add four sessions to each DeepSeek cell and an arm A whose tool block is already cached.
- By the end of a session arm B's tool list held 206 of the 237 tools. An appending client that never unloads ends up sending most of the catalog and re-reading the conversation on the way.
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
- With dry-run results arm B stayed below cold arm A at every turn and cost 0.71 times as much at turn 30. Against arm A with the block cached, arm B's mean stayed below through turn 30, at 0.91 times. In two of the six pairs arm B was above arm A from turn 18 or 19.
- Arm A with the block cached still reads it on every request. At DeepSeek's cached price that is 0.0014 USD per request, 0.11 of the 0.146 USD over a mean 77 requests. The cached price is about 2% of DeepSeek's input price, and arm A's cost here depends on it.
- Arm C cost 0.38 times arm B with padded results and 0.78 times with dry-run results. It cost 0.76 and 0.71 times arm A with the block cached.
- Phases done: 180 of 180 in arm B with both result sizes, and in arm C and cached arm A with dry-run results. Both padded arm A cells did 179, and padded arm C 177.
- Sixteen sessions ended in an HTTP 429 or 503 from the provider, eleven while about 14 sessions ran at once and five at three at a time. Each was run again with the same seed. The files keep the errored sessions, and the scorer leaves one out when its re-run completed. No completed session re-read more than half of its previous prompt outside the request after an open. The five sessions run last are in files dated 2026-11-15, the UTC date.

## Limits

### Every run

- One server, one vendor's catalog, three workflows, models pinned by name on one provider on two days.
- Toolset group names and descriptions are this demo's, not Cloudflare's. The `-api` suffix and the templated sentences are a naming choice, and so is the overlap between `durable-objects` and `durable-objects-api`.
- Token counts in the trial tables are compact JSON. A provider's tool prompt renders schemas differently, and forge-generated schemas are verbose, which inflates the flat numbers relative to a hand-written server. The `opt1` task load depends on how long this demo's paraphrase is.
- Groups against Code Mode, the Cloudflare server's default, was not measured. The flat baseline is its direct-tool mode.
- Per-caller scoping, the problem statement's dynamic-correctness criterion, was not tested. Every group answers the same to every caller.
- The selection and completion runs compare Option 2 against flat. Options 1 and 3 appear only in the token and wire comparison.
- The deployed Workers were redeployed on 2026-11-12, after every run, to change the `opt2-rec` server's `instructions` text and the `tools/list` cache scope. For a client that negotiated both extensions, `tools/list`, `groups/list`, `skills/list`, `resources/list` and the `turnstile-spin` group returned the same content before and after.

### Selection trial

- The v1 set has five samples per task. At 13 groups they are identical on every task for the 14B model and Claude and on 9 of 14 for the 9B model. Other arms vary more: Claude is identical on 11 of 14 at 238 flat names. The v2 set has one. Read each cell as tasks, not answers, and two cells that differ by one or two as the same result. More tasks, not more samples, would add information.
- The v1 set names the product (Turnstile, D1, KV, R2, queue, container), and the toolset group descriptions are templated around the product name ("Call the Cloudflare queues API directly. Use to read or change queues resources in an account."), so it measures keyword routing. The SEP says a group description SHOULD carry the task vocabulary a user would use; these do not, so the drop at 139 groups on the indirect tasks measures what templated descriptions cost, not what groups cost. The second round rewrote them with task vocabulary and re-ran.
- The v1 set and the 2026-11-07 run of the v2 set showed no skill index, so their flat modes had no answer for a knowledge task. The 2026-11-08 run fixed that in every mode.
- Accepted answers are this demo's judgment. For the 3,036-tool catalog: `pipelines-api` for a dead-letter destination and `hyperdrive_create` for relational data were left as misses; `workflows-api` for retried jobs and `flagship-api` for feature flags were accepted, and `email-domains-api` was added after the first hosted run. For skills: `wrangler` is accepted for the deploy and schedule tasks and `workers-best-practices` for the fetch-handler question, and `workers-best-practices` is a miss for a queue or deploy task. A different reader might draw these lines elsewhere.
- The flat control shows tool names and first description lines, 6,911 tokens at 238 tools with the skill index. The `flat-schemas` mode tested the full `tools/list`, 157,834 tokens with the skill index, for five open and nine hosted models. At 3,036 tools the schemas are 1.38M tokens and cannot be tested. Astra skipped the schema control.
- Every server here has `demo_info` as its first tool, a tool about the server itself. In the 2026-11-07 flat runs Haiku 5.5 and the 9B model answered it on most tasks, and stopped once a skill answer was available. A real server's first tool is something else, so the collapse those runs showed is not a finding about either model.
- The hosted models scored 16 to 20 of 20 in every groups arm, so these task sets cannot detect a small difference in either direction. The result is no detectable change, which is weaker than equivalence.
- The hosted models in the selection trial ran at their lowest reasoning setting; the completion run used default effort.
- The answer format (`group`, `skill`, `tool` or `none` keys) is this script's design. A host would expose `groups/get` as a tool call, so the 9B model's key confusion may not carry over.
- Selection measures the first top-level pick only. Navigation into nested groups shows only in the completion traces.

### Task completion in Claude Code

- The completion tasks need one or two tools each and ran only on the 238-tool subset. The SEP's case against tool search is about multi-tool workflows, which this run does not test.

### Second round

- The rewritten server's split rule, size cap and hand-written descriptions are mine. The 249 full-catalog descriptions were written by a model and spot-checked, as a server author with 136 products would do it. Accepted answers for the split groups are this demo's judgment like the rest.
- The headless sessions still load this machine's user-level plugins; config isolation was not set up. The base prefix differs by arm: about 15k tokens in the groups arms with tool search on, 18k in `flat-toolsearch`, and 26.6k in the resident arm, where turning tool search off also makes the host's built-in tools resident. Part of the resident arm's extra input tokens is that difference. `CronCreate` is a host built-in the runner does not disallow, and one Haiku session used it.
- `read_skill` in the mod checks each file's SHA-256 against the published digest. It does not check the file's size or compare the SKILL.md frontmatter with the `skills/get` entry.
- Completion jobs for all conditions and models ran side by side, so their wall times share the same API load. Gaps of one or two tasks in any cell are noise, as before.
- DeepSeek V4.1 Flash on Baseten failed on most calls on 2026-11-09, so its cells come from a full re-run three days after the other models'. The OpenAI trials that failed on credits were asked again later the same day. The classifiers could not run on the 271-group listing.

### Held-out task set

- 20 tasks, 14 from one writer and 6 from the other, one sample each. The accepted tools per task are this demo's judgment, fixed before the runs. The list of near neighbours that count as misses was written after them. The flat first-call rule was decided after seeing the results, and both scores are shown. The task rules forbid the product name, which is the only vocabulary the templated descriptions carry, so the as-generated gap on this set is partly by construction.

### Open-model agent run

- One catalog, the 237-tool subset, four open models on two providers through one router, on one evening. Fifteen sessions per cell, which are five scenarios run three times. Phases need one or two tools, and Sonnet completed all of them, so the set separates the open models only.
- The tasks and rubrics were written by a model with the group listing and schemas in view, which the held-out set avoided. The string-body fix to the rubric code was made after the results, and both scorings are committed.
- Arm A ran on the two Baseten models only, and later the same night than arms B and C, once the account had credit again. Its shared-tool-block run on GLM has 13 complete sessions.
- Arm C's `call_tool` error message and its strictness about the wrapper shape are this loop's. One GLM session failed on them alone.
- Arm C gives up the provider's typed tool calling and puts every opened schema in the conversation, where it is paid for again on a provider with no cache. Arm B never unloads a group. A batched open was not run: the phases are separate user turns, so the model cannot know the later groups in its first turn.
- The B and C runs for the Baseten models ran side by side, and arm A ran beside other jobs, so first-token times share load. Any mid-session tool change has the same cache effect as an open: client-side tool search, `list_changed`, connecting a server.
- The reference is one Claude model on one host. Its sessions share the host's cached base prefix, as in round two.

### Follow-up runs

- The chained sessions are two per cell, one per order, on GLM and for cold arm A with dry-run results. The other DeepSeek cells are six after 2026-11-14. The padding is filler of a fixed size, a stand-in for real response bodies and not a measurement of them. The full catalog was served by a local dev server. Arm C in these runs uses the tolerant wrapper.
- The listing-in-the-first-tool variant was tried on the full catalog and arm B only.
- Render order on the Baseten endpoints is inferred from cache counts, and on GLM from one tool-block size.

## Results files

`results/` holds the raw `npm run compare` output, the `select-*` trial output, and the redacted sessions.

- `2026-11-07-deployed.txt`: the four variants on the deployed Workers, characters / 4, Turnstile only.
- `2026-11-07-deployed-tasks.txt` and `2026-11-07-full-local.txt`: the token tables above, tiktoken, three tasks.
- `2026-11-07-select-*.jsonl` and `.txt`: the v1 set's raw answers and summaries.
- `2026-11-07-select2-*.jsonl` and `.txt`: the v2 set's first run, without the skill index, with the per-task matrix.
- `2026-11-08-select2-*.jsonl` and `.txt`: the v2 set with the skill index, every mode and model. The tables above come from these.
- `traces/traces-public/`: the 180 redacted sessions, their index and scored summary.
- `2026-11-09-deployed.txt`: the token table and per-group task load for the second round, `flat`, `opt2` and `opt2-rec` on the deployed Workers and `opt1` and `opt3` locally.
- `2026-11-09-select2-*.jsonl` and `.txt`: the second round's selection runs. Labels with `-rec` are `opt2-rec`, `-rec-dup` the same with every skill listed.
- `2026-11-12-select2-*-deepseek-baseten.jsonl` and `.txt`: DeepSeek V4.1 Flash's seven second-round cells, run again in full. They replace its rows in the 2026-11-09 files, which are kept.
- `traces/traces2-public/`: the second round's 300 redacted sessions, their group-open logs, index and scored summary.
- `tasks-v3/`: the held-out tasks and every writer reply. `2026-11-10-select3-full-*.jsonl`: their selection runs on the full catalog. Labels with `-rec` are `opt2-rec`.
- `2026-11-13-agent-*.jsonl`: the open-model agent run, one row per model request. `arm-b`, `arm-c` and `arm-a-rerun` are the cold runs for the Baseten models (`arm-a` holds the first attempt, made before the account ran out of credit), the `-shared` files the runs with the tool block shared between sessions, and the `-deepinfra` files Qwen3.6 and Gemma, with the two repeated Gemma sessions in `-deepinfra-rerun`. The scorer drops a session that ended in an error when the same sample was run again. `ref-groups-rec` and `pilot-flat-toolsearch` are Sonnet through Claude Code. The `smoke-*` files are the one-scenario checks made before the task script was committed. `2026-11-13-agent-summary.md` is `npm run agent:score` over the arm, reference and pilot files, `-as-committed` the same with the rubric code as committed before the runs, and `2026-11-13-agent-probe.txt` the endpoint probe. The follow-up runs are `arm-c-lenient*` (the tolerant wrapper), `full-*` (the full catalog, with `full-b-listing` the listing in the first tool) and `chain30-*` (30-turn sessions, `-pad` with padded results), with `2026-11-13-agent-summary-followup.md`, `2026-11-13-agent-summary-chains.md` and `2026-11-13-agent-probe-order.txt`. The follow-up files record `4f0a982` in their headers. They ran from the working tree that became `6e59282`, which is where their flags were committed.
- `2026-11-14-agent-chain30-*.jsonl` and `2026-11-15-agent-chain30-*.jsonl`: samples 2 and 3 of the DeepSeek chained cells, and arm A with a shared tool block in `a-shared` and `a-shared-pad`, with its warm-up sessions in `a-shared-warm`. They hold the sessions that ended in a provider error and their re-runs. `2026-11-14-agent-summary-chains.md` is `npm run agent:score` over these and the 2026-11-13 chained files. Both chain summaries list, for each pair of sessions, the phase at which arm B passes arm A.

Re-runs that reproduced an earlier file were not kept, and the 2026-11-02 file from the build against the earlier drafts was removed. This repository starts from a single commit; the private predecessor repository holds the earlier history.
