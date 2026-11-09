# Session notes, 2026-11-02 to 2026-11-07

These notes were kept in a private predecessor repository whose history is not carried here. Commit hashes mentioned in sections 1 to 9 refer to that history.

Sections 1 to 8 are the first two sessions. Section 9 is the third, on the evening of 2026-11-07.

What we did, in order, and what we found. The README covers how the demo works and its latest results. Raw comparison output is in `results/`.

## Current findings

Measured against #19 at `15b2a5c` and #22 at `5e9ff2f` on the deployed Workers on 2026-11-07, and reproduced later that day locally, against the Workers, and from a fresh clone (sections 4 and 8). Token counts below are tiktoken `o200k_base` from `results/2026-11-07-deployed-tasks.txt`. `results/2026-11-07-deployed.txt` is the same run counted as characters / 4.

- Option 2 works as #22's Example 3 describes. A group named after the skill scopes the 6 Turnstile tools and lists `skill://turnstile-spin/SKILL.md`, and the host still verifies the skill through `skills/get` and `read`.
- Under Option 3, the SKILL.md body arrives as `instructions` with no skill entry and no digests. Its 7 relative `references/*.md` links resolve to scoped resources only if the host assumes `skill://turnstile-spin/` as their base. The SEP's "Relationship to the Skills extension" section already says group instructions carry no skill entry, digests, approval, or skill root for relative references.
- Option 1's Groups server is the cheapest (2,190 task-load tokens against 8,768 for Option 2), because its instructions are a paraphrase. The paraphrase drops the skill's 7 framework guides, and nothing ties the group to the skill on the Skills server.
- At the full 3,036-tool catalog (local build, section 5), the flat `tools/list` is 1,378,777 tokens and 6.2 MB. `groups/list` with 139 top-level groups is 5,308 to 5,495 tokens. Task load is the same as the subset.
- Selection trial (section 5): a 14B model and Claude Opus 5.5 pick the right group from 139 descriptions on 65 and 70 of 70 samples. A flat list of tool names does as well where it fits in context. Groups cut the pre-task read from 81,414 to 3,682 tokens at 3,036 tools. They do not improve selection over a list the model can read.
- Second task set (sections 9 and 10), 20 tasks that do not name the product, re-run on 2026-11-08 with the skill index in every prompt. Ten hosted models score 17 to 20 of 20 in every mode at both catalog sizes, and none moves by three or more between modes. The mid-size open models drop at 139 templated groups (Qwen3 14B 13, Qwen3.6 15, the 9B 10). Adding the skill index moved flat scores by up to 17 tasks and no groups-mode score by more than one, so the earlier "small models collapse in flat mode" was a prompt artifact. The Decisions API classifier scored 19 and 20 of 20; Jev 20 and 16.
- Task completion through Claude Code (section 10), 180 headless sessions with a groups mod: Sonnet and Opus 20 of 20 under groups, under the flat server with the host's tool search, and with all 238 schemas in the prompt up front; Haiku 16, 18, 19. Groups read 2.3M input tokens per model against 16.5M to 18.4M with all schemas up front, cost a turn more, and matched the host's tool search on completion and tokens. The prompt cache held across group opens.

## 1. Pulled the latest of four repos

| Repo | Location | Commit |
| :-- | :-- | :-- |
| ext-skills | `_mcp/ext-skills` | `649f7ae` (2026-10-30). The spec moved from `specification/stable` to `specification/beta`. |
| typescript-sdk | `_mcp/typescript-sdk` | `1e608cae` (2026-10-31). Packages at 2.4.0. |
| progressive-disclosure-wg | `skills-over-mcp-ig/related-work-repos/progressive-disclosure-wg` | `f1ccefa` (2026-10-27). PRs #19, #20 and #22 are fetched as local branches `pr-19`, `pr-20` and `pr-22`. |
| cloudflare/mcp | `skills-over-mcp-ig/servers/cloudflare-mcp` (new clone) | `4938f2f3` (2026-11-01) |

cloudflare/mcp defaults to Code Mode (`search` and `execute`). With `?codemode=false&experimentalForge=true` it serves 3,036 forge-generated tools, which it describes as "3036 tools in 1030 groups". Its skills come from cloudflare/skills through hand-written handlers in `src/skills/handlers.ts`.

## 2. What #19 and #22 say

Both at the heads measured here, #19 at `15b2a5c` and #22 at `5e9ff2f`, revised by helloeve on 2026-11-07.

- #19 is the draft Groups SEP. It defines `io.modelcontextprotocol/groups`, `groups/list` and `groups/get`, with `tools`, `prompts`, `resources` and `groups` directly on the `groups/get` result. Within one client view a tool, prompt or resource is either top-level or scoped to one or more groups, never both. Discovery gating is not access control: a scoped tool is callable whether or not the client issued `groups/get`. Nested groups and nested cycles are permitted. A client that does not negotiate the extension gets a flattened view, through the per-request client capabilities of protocol 2026-07-28. Credentials for `groups/list` are left to server policy. The "Relationship to the Skills extension" section says a group references a skill by listing its SKILL.md URI in `resources`, and that inlined `instructions` are not a skill and carry no skill entry, digests, approval or root for relative references. "Early prototype evidence" cites markusvankempen's measurements.
- #20 is a prototype SDK, `@modelcontextprotocol/ext-grouping`, built on SDK 1.x.
- #22 is the positioning doc. Its status line says Option 2 received the most votes and Option 3 remains competitive, and "Current lean" is Option 2.
  - Option 1, competing: a server is either a Skills server, with every tool in `tools/list`, or a Groups server. Neither spec references the other.
  - Option 2, complementary: a group lists the skill's SKILL.md as a normal resource next to its tools (Example 3), and the skill is still verified and activated through the Skills extension.
  - Option 3, evolving: rename Groups to Skills. Code-defined skills and SKILL.md folders both live under one extension served over `skills/list` and `skills/get`.
  - A "rough rule of thumb" table sits under "What Option 2 looks like in practice" (helloeve's review reply calls it "Choosing between them", but there is no heading by that name). "Interop rules" has seven rules; rules 5 and 6, a firm guarantee for returned primitives and a SHOULD that instructions stay consistent with what a caller gets, come from Jeremy-Friese's review.
- The decisions log (`docs/decisions.md`, merged to `main`) says `group/get` and `group/list`, singular. The SEP and the prototype say `groups/*`. This demo follows the SEP.

## 3. Built and deployed the demo

One Worker on SDK 2.4.0, serving 238 of the Cloudflare server's tools from 10 products and 5 skills from cloudflare/skills, in the four variants the README's table describes: `flat`, `opt1`, `opt2` and `opt3`.

- `opt2` groups take the skill's name and list its SKILL.md in `resources`, as in #22 Example 3. Skills are served through a `SkillSource` with no `listResources`, so the scoped SKILL.md stays out of `resources/list` and the placement rule holds.
- `opt3` is the rename: `skills/list` and `skills/get` under `io.modelcontextprotocol/skills`. The SDK's SEP-2640 `SkillsClient` fails on it.
- `npm run compare` runs each task against every variant. The README has the table and what each variant showed.

All four variants are deployed to Cloudflare Workers at the URLs in the README. The live run matched the local run.

An earlier build on 2026-11-02 (commits `362c088` and `55db6c1`) targeted the drafts as they stood before helloeve's revisions: a `contents` wrapper on `groups/get`, Option 3 as "Groups absorb Skills", and six variants including #13's Skills-as-Groups approach and separate Option 1 servers. It was replaced on 2026-11-07, its three extra Workers were deleted, and its results file was removed on 2026-11-07 (git history at `324bc65` has it). Its findings are either re-measured by the current variants or moot.

The repo is private at https://github.com/olaservo/mcp-progressive-disclosure-evals.

## 4. Re-verified on 2026-11-07

Checked that nothing upstream had moved, then re-ran everything and probed the claims the comparison script asserts but does not print.

- #19 still at `15b2a5c`, #22 still at `5e9ff2f`, WG `main` at `f1ccefa`. No new review comments on #22 since helloeve's 2026-11-07 replies. On #19, helloeve thanked markusvankempen for the measurements and said the SEP revision would cite them; it does, under "Early prototype evidence".
- `@modelcontextprotocol/server` and `client` are still 2.4.0 on npm (published 2026-10-23).
- `npm run compare` locally (`wrangler dev`) and against the four deployed Workers reproduced the 2026-11-07 table and notes exactly.
- Verified from the SDK source at `1e608cae`: the catalog `SkillSource` in `packages/server/src/ext/skills/catalogSource.ts` implements `listResources`, and `SkillsExtension` registers a `resources/list` handler only when the source has one. `partitionEntries` in `packages/client/src/ext/skills/entries.ts` is what rejects Option 3's entries.
- Added a scoped-call check to `scripts/compare.ts`: after `groups/get`, open a fresh connection, confirm the first scoped tool is not in its `tools/list`, and call it with placeholder arguments built from its input schema. The Option 3 note now carries the client's reason for rejecting each entry. The table did not change.
- Deleted the gitignored scratch files `.upstream/dbg.ts`, `.upstream/compare-local.txt` and `.upstream/compare-deployed.txt`. The two text files were identical to files in `results/`.
- Switched the script's token counts from characters / 4 to tiktoken `o200k_base` (`js-tiktoken` 1.0.21), the measure markusvankempen used in the data point #19 cites. Upfront went from 179,213 to 157,763 for `flat` and from 653 to 556 for `opt1`. The ranking did not change. README table updated. The re-run files from this step were removed in section 8 and remain in git history at `c089aaf`.
- Drafted comments for #22 and #19 in `drafts/`. Neither is posted.

These changes and section 5's were committed together as `c089aaf` and pushed.

## 5. Full catalog, three tasks, model selection trial (2026-11-07)

Three additions after the re-verification, to make the demo a stronger data point.

- `scripts/vendor.mjs --full` (npm `vendor:full`) vendors all 136 forge products: 3,036 tools in 1,030 toolsets, 139 top-level groups. The build runs under `wrangler dev` and bundles to 22.5 MiB, 1.6 MiB gzipped, so it would deploy. It stays local so the deployed Workers and the committed `src/vendor` remain the subset. The first `vendor:full` run failed on a file lock under OneDrive and the second succeeded.
- `scripts/compare.ts` now runs one task per workflow skill with API tools: Turnstile, Durable Objects, email. In `flat`, task tools are matched by product prefix, so email counts 41 there against the 24 the group curates. Results: `results/2026-11-07-deployed-tasks.txt` (subset, deployed) and `results/2026-11-07-full-local.txt` (full, local). With the full catalog the flat `tools/list` is 1,378,777 tokens and 6.2 MB, `groups/list` is 5,308 to 5,495 tokens, and task load is unchanged.
- `scripts/select.ts` (npm `select`) is the model-in-the-loop check. It shows a model the top-level tools and `groups/list` as names and first description lines, then asks for one JSON answer: a group, a top-level tool, or none. 14 tasks, 5 samples each. Flat mode shows every tool's name and first line instead, as the control. The models are `Qwen/Qwen3.5-9B` and `Qwen/Qwen3-14B` through the Hugging Face router on deepinfra, the same 8B and 14B classes as the data point the SEP cites, with thinking off, temperature 0.2 and one seed per sample, and `claude-opus-5-5` through the Anthropic SDK at effort low with the catalog block cached. Keys load from a `.env` file passed as `--env` and are never printed. Without one, the HF token comes from the `hf` CLI login.
- Local Ollama was tried first and dropped. CPU-only inference took about four minutes per 1,600-token prompt on both local models.
- Trial results (`results/2026-11-07-select-*.txt`, table in the README): at 13 groups, Qwen3 14B and Claude Opus 5.5 picked the right group on 70 of 70 samples. At 139 groups they scored 65 and 70 of 70, with the 14B misses all on the no-fit task. Qwen 3.5 9B named the right group on 65 of 70 at both sizes but put it under the `tool` key on 20 and 32 answers. The flat controls, tool names and first lines only, were 70/70 for the 14B at 238 tools and 25/28 for Claude at 3,036 tools. Groups did not beat a readable list on selection. They cut the pre-task read from 81,414 to 3,682 tokens at 3,036 tools.
- `select.ts --replay <jsonl>` re-prints a summary and adds the "right name, either key" column. The first replay attempt built a `--mode` argument from a summary file whose first line is blank. The newline inside the argument made `npx` on Windows truncate the command, which dropped `--replay` and started a stray live run with an empty mode. I stopped it, deleted its file (`results/2026-11-07-select-.jsonl`), and rewrote the header lines of the four real files by hand. Replay now takes the mode from the file's header line.
- `src/vendor` was restored to the subset with `npm run vendor` and the local full-catalog server stopped.

## 6. Methodology check (2026-11-07)

A pass over whether the experiments give reliable data, from the raw trial files.

What holds up:

- The code-level findings: the SDK catalog lists SKILL.md in `resources/list`; the SEP-2640 client rejects the renamed listing; scoped tools are callable without `groups/get` and absent from `tools/list`; a client without the extension gets the flat list. These are deterministic and reproduced twice.
- The size measurements. Deterministic, reproduced locally and against the Workers, and the full-catalog numbers (1.38M tokens flat, 5.4k for 139 groups) do not depend on any judgment call.
- The qualitative scale result: 139 group descriptions did not hurt selection for the 14B model or Claude, and no run produced errors, refusals, or unparsed answers (except the 9B key confusion).

What is weaker, now recorded in the README's "Limits of the trial":

- Five samples per task at temperature 0.2 were identical on 14 of 14 tasks for the 14B model and Claude. The trial is 14 tasks, not 70 answers.
- The tasks name the product and the toolset descriptions are templated around the product name, so the trial mostly measures keyword routing.
- The flat control is names and first lines, 6,720 tokens at 238 tools, not the 157,763 tokens of schemas a flat server sends. Nobody has tested selection over the full schemas at this size; markusvankempen did at 19 tools.
- The answer format is this script's, and a host would expose `groups/get` as a tool call. The 9B key confusion is partly an artifact.
- Group names, the `-api` suffix and the templated descriptions are this demo's choices. The `durable-objects` / `durable-objects-api` overlap is one of them.
- `opt1`'s cost depends on the length of the paraphrase we wrote. Forge schemas are verbose, which inflates the flat numbers relative to hand-written servers.
- Where both the workflow group and the API group were accepted, Qwen chose the workflow group on 24 to 29 of 35 and Claude the API group on 20 of 35. The lenient scoring had hidden this split.

Verified from the data: Claude's cached catalog block was read on 69 or 70 of 70 calls per run; no refusals; no HF errors.

What to do if the trial is extended: add tasks that do not name the product, add confusable pairs, run a full-schema flat control at 238 tools with Claude and the 9B model (the 14B model's 40k context cannot hold it), and drop to one sample per task.

## 7. What the findings say about our position

- Option 2 stands, and the data strengthens it. A listed skill keeps its entry, digests and verification. The rename breaks the shipped SDK client, and the inlined body loses its root for relative links.
- The one spec change to ask for is the placement rule for a listed skill (`skills/list` as a listing, `resources/list` per view). Drafted for #22.
- Groups are a context-budget mechanism, not a selection-quality one. Below a few hundred tools, a flat list of names and descriptions selects as well as groups. Groups earn their place around a thousand tools, where even names overflow. The #19 draft should say this, since the SEP's prototype evidence is framed around whether models take the group path. Section 9 adds the shape of the cost: with tasks that do not name the product, 139 one-line group descriptions cost the mid-size open models up to 6 of 20 tasks that 13 descriptions did not, and the 3,036-name flat list cost three of five models more than that. Group descriptions carry the selection at scale, so a server with many groups should write them to separate neighbours (queues against pipelines, D1 against Hyperdrive), not template them.
- Schemas dominate `groups/get` once a group holds 20-odd tools. A 24-tool group costs as much as a whole skill. That is an argument for small groups and nesting, and a data point for the SEP's inline-delivery decision, not a wire change.
- Overlapping groups split the models. A server with both a workflow group and a toolset group for one product should say in the descriptions which to load when, or not offer both. A sentence for #22's rule of thumb.
- Small models confuse group names with tool names. Hosts should route on the method the model chose, not on the name, and group names that look unlike tool names would help.

## 8. Cleanup and reproducibility check (2026-11-07)

- Fresh clone into a scratch directory, `npm ci`, `npm run typecheck`, then `npm run compare` against the deployed Workers: output byte-identical to `results/2026-11-07-deployed-tasks.txt`. `select.ts --replay` on a committed `.jsonl` reproduced its summary, differing only in line endings from the checkout.
- Added `.gitattributes` (`* text=auto eol=lf`) and renormalized, which ends the CRLF warnings on every commit.
- Removed three result files that duplicated others: `local-rerun` (identical to `deployed`), `deployed-rerun` (same plus the scoped-call notes), `deployed-tiktoken` (same Turnstile rows as `deployed-tasks`). Removed the probe scripts left in the ignored `.upstream/`.
- README now says how to recreate the two vendor source checkouts at the commits used, that `src/vendor` is committed so they are optional, which env vars the trial needs, and the exact commands behind the four trial runs.
- `scripts/vendor.mjs` now pins both checkouts to the commits in the README and refuses any other unless `--unpinned` is passed. cloudflare/mcp main had already moved from `4938f2f3` to `563b7103` by 2026-11-07, so a `git pull` in that clone would have changed `vendor:full` output. The committed 238-tool subset was always pinned by being committed; the full catalog was not.
- What a fresh clone cannot reproduce without more: the full-catalog numbers need the cloudflare/mcp checkout and `vendor:full`; the trial needs an HF token and an Anthropic key, and hosted model answers can drift, so the raw answers are committed and `--replay` rebuilds the summaries.

## 9. Extended trial (2026-11-07)

The follow-up to section 6, run as planned: first with the open models, then, once the `.env` path was supplied, with the hosted models (see "Hosted runs" below).

Script changes in `scripts/select.ts`:

- `--tasks v1|v2`. The 20 v2 tasks describe the job without the product name, with pairs one group answers (routing against sending, queues against Durable Objects, KV against D1 and R2, Workers against containers), two knowledge tasks and two with no fit in the subset. The default sample count is 1 for v2 and 5 for v1.
- `--mode flat-schemas` puts the whole `tools/list` result in the prompt: 157,642 tokens at 238 tools. A `MAX_CONTEXT` map skips Qwen3-14B (40,960 on deepinfra) on prompts it cannot hold, with a note on stderr.
- `askOpenAI` (chat completions, `reasoning_effort`, `prompt_cache_key`; Kimi through the same client with the Moonshot base URL), `askGemini` (`thinking_level` low, or minimal on 3.6 Flash) and `askDecisions` (one `choice` question whose choices are the group names with first description lines plus `none`) beside `askHf` and `askClaude`, dispatched on the model id prefix. The lowest reasoning setting per model is recorded in the header.
- `summary()` prints a per-task matrix of every model's pick, a split count for tasks that accept either the skill group or the API group, and a cache-read column.
- Expected answers are a function of the task set and the catalog size, and replay recomputes them, so a scoring change applies to committed runs. Against the 3,036-tool catalog, tasks accept the products the subset lacks that fit them: `dns-api` and `email-auth-api` for the mail DNS check, `workflows-api` for retried jobs, `workers-builds-api` and `builds-api` for pushing a build, `flagship-api` for feature flags, `accounts-api` or `user-api` for rotating an account token (the full catalog has `accounts_tokens_roll` and `user_tokens_roll`, so the subset's `none` drops out). These were added after the first read of the full-catalog results, where every "miss" to one of them was a defensible answer. `pipelines-api` for a dead-letter destination and `hyperdrive_create` for relational data stayed misses.
- Results files are `results/<date>-select2-<label>.jsonl` and `.txt`. The runs crossed midnight UTC, so the raw files were written as `2026-11-08-*` and renamed to the run date; the summaries were regenerated with `--replay` and carry the renamed path.

Checks before running:

- `openai` 7.53.0 and `@google/genai` 3.0.0 installed as dev dependencies. The OpenAI SDK has `client.decisions.create`; the Decisions API is GA, `gpt-6-luna` only, 0.10 USD per M input tokens, no output charge, 2 to 255 choices per question.
- TypeSafe's Jev was dropped at first (the web search found only aggregator routes), then added once the `.env` turned out to hold a `TYPESAFE_API_KEY` that works directly. The docs index at `docs.typesafe.ai/llms.txt` has the HTTP reference: `POST https://api.typesafe.ai/v1/systemone`, Bearer auth, body `{state, model, questions: {name: {type: 'choice', instructions, criteria: {option: description}}}}`, answer `{choice, confidence, probabilities}`, up to 255 options. `askJev` uses `fetch`, no SDK. `jev-latest` resolved to 1.14.0.
- Kimi's pricing page renders its tables client-side and came back empty twice. Third-party pricing pages agree on 2 / 10 USD per M for `kimi-k3.1-pro` with cache hits at 0.20, and 3 / 15 for `kimi-k3`. Unverified against the vendor.
- One smoke call per new open model with `chat_template_kwargs.enable_thinking: false`: all four returned the JSON directly with `reasoning_tokens` 0 (GLM, DeepSeek) or no reasoning field (Qwen3.6, Gemma).
- `vendor:full` failed once on the OneDrive file lock, as in section 5, and succeeded on the retry.

Runs, all six open models unless skipped: `subset-groups` and `subset-flat` against the deployed Workers, `subset-flat-schemas` against the deployed flat Worker, `full-groups` and `full-flat` against `wrangler dev` after `vendor:full`. The full `flat-schemas` catalog is 1.38M tokens and was not run. The README has the table and observations. In short:

- 13 groups: 18 to 20 of 20 for five models. The 9B model fell from 65 of 70 right names on v1 to 11 of 20, answering none on six tasks.
- 139 groups: 14 of 20 for Qwen3 14B and Qwen3.6 35B-A3B, 17 or 18 for GLM, DeepSeek and Gemma. The product-named set had shown no drop at 139. Misses go to neighbours: `pipelines-api` for a dead-letter destination on four models, `durable-objects` for relational tables, feature flags or a nightly schedule.
- 238 tools with schemas: 18, 19, 20 and 17 for GLM, DeepSeek, Qwen3.6 and Gemma, within two of their names-only scores in both directions. The 9B model dropped to 8. One DeepSeek call hit HTTP 429.
- 3,036 tool names: below the 139 groups for GLM, Qwen3.6 and Gemma (16, 13, 13 against 18, 14, 17), one above for DeepSeek and the 9B model. Misses go to products that look right by name: `hyperdrive_create`, `agentMemory_listNamespaces`, `secretsStore_`, `user_tokens_roll` for the bot-check secret.
- Three flat tasks expect a specific tool (rotate the secret, a lifecycle rule, a schedule) and some models answered the product's list tool first, counted as a miss. GLM did so on all three at 238 names.
- The knowledge task "review our stateful coordination class" got none from four of six models at 238 names and from all at 3,036; in groups mode every model sent it to the `durable-objects` skill group.
- Skill group against API group: the Qwen models took the skill group almost always; GLM, DeepSeek and Gemma split evenly at 13 groups and leaned to the skill group at 139.

Cost: the five open-model runs together were under 3 USD of HF credit, almost all of it the schema control.

Hosted runs, same evening, keys from a local `.env` outside this repo passed as `--env`:

- Smoke run first, `--limit 2` in groups mode with every hosted id. Claude, GPT-6, Kimi and the Decisions API all answered. Both Gemini models returned HTTP 402, "prepayment credits are depleted", on `GEMINI_API_KEY` and again on `GOOGLE_GENERATIVE_AI_API_KEY` from the same file. Gemini was dropped from the runs; `askGemini` is untested against a live response.
- Five runs: `subset-groups-hosted` (with `decisions:gpt-6-luna`), `subset-flat-hosted`, `subset-flat-schemas-hosted` (Claude x3, Sol, Terra, Luna; Astra at about 32 USD and Kimi left off), `full-groups-hosted` (with the Decisions API), `full-flat-hosted`. Results in the README's second hosted table. In short: 18 to 20 of 20 in groups mode for every hosted model at both sizes, with Opus, Astra and Sol at 20 at 139 groups; the Decisions classifier 19 then 20; flat modes cost the frontier models two to four tasks each; Haiku 5.5 collapsed to the first listed tool in every flat mode (7, 4 and 1 of 20) and held 18 in groups mode.
- The first attempt at the two full-catalog hosted runs failed in the SDK's version negotiation probe, which timed out after 60 s: the two scripts connected to a cold `wrangler dev` at the same time and the 22.5 MiB bundle did not answer in time. Warm the server with one request per variant before starting runs. The restart then hit three stale `wrangler dev` listeners on 127.0.0.1:8787 (PIDs 16840, 53412, 25920) left by earlier TaskStops, which the session was not permitted to kill, so the runs went to port 8788. Kill those processes by hand.
- `email-domains-api` was added to the mail DNS task's full-catalog alternates after Luna picked it (`emailDomains_verify` schedules an email domain's verification check) and all ten summaries were regenerated with `--replay`. IAM, picked by Sonnet and Haiku for the token rotation, has no token tools and stays a miss. `ai_websearch`, picked by Sol and Terra at 3,036 names for the fetch-handler question, is a real tool and a defensible answer to a knowledge question; it stays a miss against `none` and the README says so.
- OpenAI chat completions returned `cached_tokens: 0` on every call, including the 157k-token schema prompts with `prompt_cache_key`. Anthropic reported cache reads throughout. Kimi reported some.
- After the user approved the schema control for the skipped models, Kimi K3.1 Pro ran it and scored 20 of 20 at 155k input tokens per call, 2.9M of 3.1M read from cache. Astra stays off it at about 32 USD unless asked.
- Jev ran the two groups catalogs: 18 of 20 at 13 groups, 13 of 20 at 139, where its misses track surface words (`images-api` for image-resize jobs, `pipelines-api` for both tasks that say "pipeline", `sql-api` for SQL joins). The Decisions classifier on the same choices scored 19 and 20. Jev's second local run used port 8789, since 8788 had also been left with a stale listener (PID 12392) after its TaskStop.
- Gemini, after the user bought 20 USD of prepay credit in AI Studio: the key in the `.env` answered at once, with no key restriction change. Five runs on port 8790: 20 and 20 at 13 groups, 19 and 20 at 139, 19 and 19 on 238 names, 18 and 17 on the schemas, 18 and 17 on 3,036 names (Argon first, Flash second). The flat misses are the two Durable Objects tasks answered none. Argon's implicit cache served 3.0M of 3.2M schema tokens; Flash reported no cache reads. `askGemini` worked first time with `thinkingLevel` LOW and `responseMimeType` JSON.
- AI Studio's API Keys page lists two keys on the project, one labelled Unrestricted with a banner that unrestricted keys stopped working on 2026-06-19. The "Restrict to Gemini API only" confirmation was left open for the user, since it revokes the key's access to every other Google service and that key belongs to another app. The key that answered our calls is therefore probably the other one.
- `npm run vendor` failed twice on the OneDrive lock while swapping the full catalog back and left `src/vendor` half-swapped with a broken `forge-catalog.ts`. `git checkout -- src/vendor && git clean -fd src/vendor` restored the committed subset. That is the reliable way to restore it on this machine.
- Cost was not measured. The section 9 estimate (about 6.5 USD for the hosted schema control, cents for the rest, about a cent for the Decisions API) stands as the estimate.

What the results changed: the README's "Limits of the trial" items on product naming, sample count, the names-only control and the pending hosted runs; the Current findings; section 7's claim about a readable flat list; and the "Limits" paragraph of `drafts/pr19-comment.md`.

## 10. Review, re-run with the skill index, and the traces plan (2026-11-08)

A fourth session. Reviewed the methodology against the specs and PR threads, planned a real-client follow-up, then did the day-sized fixes.

- Neither PR head moved (#19 `15b2a5c`, #22 `5e9ff2f`), and no new comments since 2026-11-07. `drafts/methodology-review-2026-11-08.md` is the review. Its main finding: `select.ts` never showed the skill index in any mode, while both servers serve five skills over the Skills extension and `compare.ts` counts that index in flat's upfront tokens. The knowledge tasks therefore had no answer in flat mode, and "a flat tool list has no entry for a skill" was an artifact. Five of Claude's six first-set flat misses were that one task.
- `drafts/traces-followup-plan-2026-11-08.md` is the plan for traces through a real client. Verified for it: PR #20 already contains a Claude Code mod (`examples/groups-mod`) that registers `list_groups` and `open_group` and marks scoped tools deferred, built on the old `contents` shape and a hardcoded stdio path; the current mod API has `$.http.fetch`; the deployed Workers answer single stateless POSTs with `mcp-method` and `mcp-name` headers plus the `protocolVersion` and `clientCapabilities` envelope keys (tested against opt2); Claude Code session files render natively in the Hub trace viewer; fast-agent has a SEP-2640 client and Codex and ATIF export but no groups support. Sambhav's mcp-demo (`related-work-repos/mcp-demo` at `a980da6`) is the Skills-side pattern: per-client negotiation tiers on the server, `prompt.compose` sections and slash commands in mods.
- `scripts/select.ts` now shows `skills/list` in every mode, accepts `{"skill": name}` where the same-named workflow group is accepted plus `workers-best-practices` for the fetch-handler question and `wrangler` for the deploy and schedule tasks, offers skills as classifier choices, reports a "Picked a skill" column, and prints the prompt with `SELECT_DUMP_PROMPT=1`. Expected answers carry `skill:<name>` entries; replay recomputes them, and replaying three 2026-11-07 files reproduced their scores exactly.
- Killed two full `npx wrangler dev` trees left listening on 8787 and 8790 since 2026-11-07 (the bash and npx wrappers respawn `workerd` if only it is killed). `vendor:full` succeeded first time; the local server on 8787 was warmed with one request per variant before the runs. Restored the subset afterwards with `git checkout -- src/vendor && git clean -fd src/vendor`.
- Re-ran the second task set in groups and flat (names) mode at both sizes for every model: six open, eight hosted, two Gemini, the Decisions classifier and Jev. Fifteen runs, no errors, raw files `results/2026-11-08-select2-*.jsonl` with `.txt` summaries from `--replay`. The schema controls were not repeated.
- Results, against 2026-11-07: no groups-mode cell for a hosted model moved by more than one. Flat names-only scores rose by three or more for Haiku 5.5 (7 to 18 at 238 names, 1 to 17 at 3,036), Opus and Sonnet (16 to 20 at 3,036), Luna (15 to 20), Flash (17 to 20), GLM, Qwen3.6 and Gemma (16, 13, 13 to 19, 18, 18 at 3,036), Qwen3 14B (15 to 19 at 238); the 9B rose from 10 to 16 at 13 groups and fell from 9 to 5 at 3,036 names; Jev rose from 13 to 16 at 139 groups and 18 to 20 at 13. Eleven of twenty tasks accept a skill and models take it on 3 to 11 of 20 flat tasks. The 139-group drop for the mid-size open models stands (14B 13, Qwen3.6 15, 9B 10). The Haiku and 9B "collapse in flat mode" claim is withdrawn: both answered `demo_info`, the first listed tool, until a skill answer existed.
- Cost not measured. Estimate at list price: about 25 to 30 USD, almost all of it the uncached GPT-6 calls on the 81k-token full name list (Astra about 16 USD); Anthropic, Kimi and Argon served most input from cache; the open models were under 2 USD of HF credit.
- README rewritten: Code Mode paragraph in Sources, Option 3 identifier caveat, `cacheScope` note, scope line on latency and completion, the second-set tables and bullets from the 2026-11-08 runs with the schema row marked, one-task differences no longer reported, limits updated. `drafts/pr22-comment.md` revised (identifier caveat, decision-log pointer, one-sentence placement rule). `drafts/pr19-comment.md` rewritten short, with `drafts/wg-findings-writeup.md` as the long form for a Discussion or an experimental-findings PR.
- Schema control repeated with the skill index for the same models as before (no Astra): `results/2026-11-08-select2-subset-flat-schemas*.jsonl`. Open models 9, 19, 19, 16, 19 (9B, GLM, DeepSeek, Qwen3.6, Gemma); Opus 19, Sonnet 20, Haiku 17, Sol 18, Kimi 18, Argon 20, Flash 19. The OpenAI account ran out of credits during the run: Terra and Luna got HTTP 429 "no credits remaining" on 11 and 13 of 20 calls. After credits were added they were re-run (Terra 19, Luna 20, no errors) and their rows replaced in the hosted file, whose summary was regenerated with `--replay`. The misses that remain are models answering `skill:workers-best-practices` or `skill:wrangler` for a queue, R2 or containers task.
- Built the groups mod from the traces plan: `mods/groups/` (plugin.json with `url`, `deferScoped`, `listSkills` options; `hooks/register.ts`; `tests/groups.test.ts`). It speaks the Groups extension to a Worker with `$.http.fetch`, one stateless POST per request with `mcp-method` and `mcp-name` headers (the latter carries `params.name` or `params.uri`; `resources/read` requires it too) and the `protocolVersion` and `clientCapabilities` envelope. `claude plugin validate` passes (a license warning for directory submission only); two tests pass with a canned server answering `http.fetch`. The test kit needs `on('ui.status', ...)` answered and reads the fetch event as `{ url, init }`.
- The batch run (plan steps 2 and 3): `scripts/trace-tasks.ts` (20 tasks with completion rubrics), `scripts/trace-run.ts` (one headless session per task and condition, session file copied next to an index row, `--retry-errors`), `scripts/trace-score.ts`, `scripts/trace-redact.ts`. 180 sessions, three conditions, Sonnet, Haiku and Opus 5.5, no errors. README has the table. Sonnet and Opus 20 of 20 everywhere; Haiku 16, 18, 19. Groups 2.3M input tokens per model against 16.5M to 18.4M with all schemas up front; median 5 turns against 3. The host's tool search matched groups on completion and tokens.
- Incident: the first flat-condition runs were contaminated. `--settings '{"pluginConfigs":{"groups":{"url":...}}}'` did not reach the `--plugin-dir` mod's options in a headless run, so the mod kept its default URL (opt2) and the flat sessions had both the 238 up-front tools and the groups catalog. Found when a flat-all-schemas session called `open_group` and got opt2 data. Both flat runners were stopped, their results and index rows deleted (the dying runners had appended 120 instant-error rows), and the runner now writes a copy of the mod with the flat Worker as its manifest default (`mods/.groups-flat`, gitignored). The groups arm was unaffected. About 4.6 USD of contaminated runs.
- Rubrics were relaxed after reading the answers for three tasks that need data a dry-run server never returns (`push-build` a file, `purge-sessions` key names, `instances-with-data` namespace ids): the right first step with an explanation counts. The `rotate-token` no-fit regex was broadened after every model declined correctly in wording it missed. `Workflow` joined the disallowed built-in tools after one Haiku session wandered into it.
- Session files embed the full system prompt (including this machine's global CLAUDE.md in `api-request-blob` rows), hook output in `attachment` rows and account ids in `session-owner` rows. Raw sessions are gitignored; `trace-redact.ts` keeps `user` and `assistant` rows, scrubs the home path and the project slug, refuses key-shaped strings, and the redacted copy in `results/traces/traces-public/` scores identically.
- Cost of the batch at list price from the index rows: groups 3.93 USD, tool search 5.33, all schemas 12.58, plus about 6 USD of smoke and contaminated runs.
- First real session: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude -p "<task>" --plugin-dir mods/groups --allowedTools "mcp__groups__*" --model claude-sonnet-5-5 --max-turns 8 --output-format json` against the opt2 Worker, task "rotate the leaked Turnstile secret, dry run, account demo". The auto-mode classifier refused `--permission-mode bypassPermissions` from inside this session; the tool allowlist form ran. Sonnet opened `turnstile-api`, then the nested `turnstile-widgets`, loaded `turnstile_widgets_rotateSecret` through ToolSearch and called it with the right path arguments: 5 turns, 17 s, 0.21 USD, session `02904a8b`. Per-turn usage from the session file: turn 1 wrote a 41,835-token prefix; opening the group and registering six deferred tools added 2,695; every later turn read the whole prefix from cache and added 0.5k to 1k. The plugin tools appear in the session JSONL as `mcp__groups__<name>` tool_use blocks with their results, which is what the scorer and the Hub viewer need.

## 11. Public-repo preparation (2026-11-08)

- Audited the tracked files and the full git history for key and token shapes (none), account ids (none) and the home path (none). Removed the key-file path, the GCP project nickname and the Gemini key's last four characters from this file; the older wording remains in history as a path and a suffix.
- Added `LICENSE` (Apache-2.0) and `NOTICE` naming the two Cloudflare sources vendored under `src/vendor`. The trace sessions keep CC-BY-4.0 in their own README.
- Cost protection for the Workers, from the Cloudflare docs read through the `cloudflare` skill: on the Free plan a Worker stops with Error 1027 after 100,000 requests a day and bills nothing; on the Paid plan overage is billed and there is no spend cap. Added the Workers Rate Limiting binding (GA since 2025-09) to every Worker, 120 requests a minute per client IP per location, answered with 429 in `src/index.ts`, and redeployed all four. Tested: 200 sequential-ish requests from one IP got 429 from request 104; a 260-request burst in two seconds all passed, which the docs describe (counters are eventually consistent per location). The account is on the Free plan, confirmed by the user in the dashboard.
- Wrote `explainer.html`, a one-page explainer in the style of the skills-research pages, for copying into olaservo.github.io.

## Refreshing when #19 or #22 change

1. In the WG clone (`skills-over-mcp-ig/related-work-repos/progressive-disclosure-wg`), run `git fetch origin pull/19/head:pr-19 pull/22/head:pr-22 -f` and diff against the commits named in Current findings.
2. Update `src/groups.ts` and `src/variants.ts` to match any change in wire shapes or option definitions.
3. Run `npm run typecheck`, then `npm run deploy:all`. On Windows, npm runs scripts under cmd, so the deploy loop lives in `scripts/deploy-all.mjs`.
4. Run `npm run compare -- --urls flat=https://pd-groups-flat.olahungerford.workers.dev/mcp,opt1=...,opt2=...,opt3=...` and save the output to `results/<date>-deployed-tasks.txt`. For the full catalog, `npm run vendor:full`, `npm run dev`, `npm run compare` to `results/<date>-full-local.txt`, then `npm run vendor` to restore the subset.
5. Update Current findings and the README results tables. Re-run the selection trial only if the group names or descriptions changed.

Any comment for #19 or #22 is drafted to a `.md` file first and posted only after review.

## Loose ends

- `drafts/pr22-comment.md`, `drafts/pr19-comment.md` (short) and `drafts/wg-findings-writeup.md` (long) await review before posting. They link to the repo by URL, which resolves once it is public.
- The demo repo is private and audited for going public (section 11). Flip it with `gh repo edit --visibility public`, then decide whether the long write-up goes to a WG Discussion or a PR to `docs/experimental-findings.md`, which is empty on `main`.
- `explainer.html` is written but not yet copied into olaservo.github.io. That is a PR to the site repo, as the skills-research pages do it. Its skills paragraph links the published catalog-regimes page (www.olahungerford.com/skills-research). A Skills-over-MCP version of the skills research and a tools-against-skills comparison page are still listed as future work in skills-research-temp's TODO.md; when they exist, link them here too.
- The long write-up stays markdown only (`drafts/wg-findings-writeup.md`); a rendered HTML copy was tried and dropped. A Google Docs copy is made by importing the markdown by hand and is not synced back.
- GPT-6 Astra has not run the schema control (about 32 USD at list price).
- Decide whether to restrict or delete the unrestricted Gemini key in AI Studio. The dialog was left open on 2026-11-07.
- Section 7's claims about Haiku and the 9B model collapsing in flat modes predate the skill index and are superseded by section 10.
- The account is on the Workers Free plan (confirmed by the user on 2026-11-08), so the deployed Workers cannot bill anything; the daily cap ends in Error 1027.
- Next experiments, in order: task-vocabulary descriptions for the confusable groups and a re-run at 139 (an evening); the real-client run on a second harness (Pi) and other models.
- ATIF export of the trace sessions, so the set is readable outside Claude Code tooling. Spelled out under "To do" in `drafts/traces-followup-plan-2026-11-08.md`.
- The sessions are distributed from GitHub: committed under `results/traces/traces-public/` and attached as a zip to the release `traces-2026-11-08`. A private Hugging Face dataset `olaservo/groups-positioning-traces` was uploaded first, then deleted the same day in favour of GitHub.
