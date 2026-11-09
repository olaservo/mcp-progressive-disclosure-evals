# Re-run plan

Written 2026-11-09 after the methodology review in `C:\Users\johnn\OneDrive\Documents\everything\_mcp\pd\groups-demo-review-2026-11-09.md`. The review's corrections are applied in the working tree (README, `drafts/wg-findings-writeup.md`, `docs/results.md`, `explainer.html`, `results/traces/traces-public/README.md`) and not yet committed. This file is the handoff for the session that runs the second round. Breaking changes to anything in this repository are allowed. The round is for understanding how groups behave in real use, so it tests three questions and leaves the rest.

## The three questions

**A. Does a groups server built the recommended way behave differently from the as-generated one, and how do both compare with flat behind host tool search?** The first run's server mirrors the generator's directory tree two levels deep with templated descriptions, which is what a server author gets for free. The SEP recommends the opposite on every point: shallow hierarchies, descriptions that carry the task vocabulary a user would use, and a group as a workflow bundle that lists its skill. Nobody has measured the recommended design. Build it as `opt2-rec` and keep the current server as `opt2` (the as-generated baseline).

**B. What do groups cost in a client without tool search?** The first run's groups arm registered scoped tools as deferred, so Claude Code fetched every schema through ToolSearch, 19 to 21 calls per model. A client without tool search appends the group's tools to the resident tool list, which rewrites the cached prefix once per open but saves the fetch turn. Run the recommended server with `deferScoped` false and `ENABLE_TOOL_SEARCH=false`. Prediction: one fewer turn than the deferred arm, one prefix rewrite of about 42k tokens per open, total tokens in the same band.

**C. Does listing a grouped workflow twice cost anything, and does the recommended design remove it?** Models picked the skill alone on 2 to 4 of 20 tool tasks in groups mode because `turnstile-spin`, `durable-objects` and `cloudflare-email-service` appear in both `groups/list` and `skills/list`. Shared names stay: the SEP sets group name rules equal to Agent Skills name rules so a workflow can reuse its skill name, and the match lets a host pair the two by name. The recommended server omits grouped skills from `skills/list` for a client that negotiated groups, and the mod opens the group when the model asks for a skill that is also a group. This is cheap to measure in the selection trial as a prompt flag.

## What the recommended server looks like

`opt2-rec`, served beside `opt2`:

- One level. A product group holds every tool under the product; no child groups. The five products whose tools all sit one directory down (turnstile, durableObjects, kv, r2, containers) stop being empty parents. Report the task-load increase this causes for the larger products (`workers`, `emailSending`) next to the turn saving.
- Task-vocabulary descriptions. For the 13 subset groups, written by hand from the tasks a user would bring ("r2-api: object storage. Buckets, CORS for browser access, lifecycle rules for expiry, custom domains, event notifications."). For the 139 full-catalog groups, generated from each product's tool descriptions and reviewed by hand for the groups the first run's misses landed on (`pipelines-api`, `durable-objects`, `iam-api`, `hyperdrive-api`, `workflows-api`, `pages-api`, `queues-api`, `d1-api`, `kv-api`, `r2-api`, `workers-api`, `accounts-api`, `user-api`). Say in the write-up that the full-catalog descriptions were model-written and reviewed, since that is what a real server author with 136 products would do.
- Workflow groups say when to open them against the plain product group ("open `turnstile-spin` to set up Turnstile for a site; open `turnstile-api` to manage existing widgets"), since the first run showed models splitting between the two.
- Grouped skills left out of `skills/list` for a client that negotiated groups. The skills source in `src/variants.ts` takes no request context, so this is a separate `SkillsExtension` instance for the variant rather than a per-request check; if the SDK's `SkillSource.list` turns out to receive one, use it instead.
- `cacheScope` stays `public` since nothing varies by caller.

Selection runs add one middle arm, shallow tree with the templated descriptions, so the description effect can be read apart from depth at the cost of one cheap run. The completion run does not; the real-world question is the whole design.

## Conditions

Selection trial (`scripts/select.ts`), the existing 20 tasks, one sample, skill index in every prompt. Flat and flat-schemas results from 2026-11-08 are reused unchanged; only groups modes run.

| Mode | Server | Descriptions | Tree | Skills listed | Catalog |
| :-- | :-- | :-- | :-- | :-- | :-- |
| as-generated | `opt2` | templated | two-level | all five | 13 and 139 groups |
| shallow only | `opt2-rec` with templated descriptions | templated | one-level | all five | 13 and 139 groups |
| recommended | `opt2-rec` | task vocabulary | one-level | grouped skills omitted | 13 and 139 groups |
| recommended, duplicated | `opt2-rec` | task vocabulary | one-level | all five (`--list-all-skills`) | 13 groups |

Score skill-only picks on tool tasks as their own column. Leave `correct` as it is so `--replay` of the 2026-11-08 files still matches the committed summaries.

Completion run (`scripts/trace-run.ts`), the existing 20 tasks, Sonnet, Haiku and Opus 5.5, all arms re-run on the same days under the isolated config so they are comparable:

| Condition | Server | Host tool search | Scoped tools |
| :-- | :-- | :-- | :-- |
| groups-rec | `opt2-rec` | on | deferred |
| groups-rec-resident | `opt2-rec` | off | resident |
| groups | `opt2` | on | deferred |
| flat-toolsearch | `flat` | on | n/a |
| flat-all-schemas | `flat` | off | n/a |

The first run cost about 22 USD for its three conditions at 180 sessions. Five conditions at 20 tasks is about 300 sessions and 35 to 40 USD; the resident arm pays cache writes and the all-schemas arm is the expensive one either way.

## Changes before any run

Hygiene, cheap, do all of these:

- Commit the applied review edits as they stand, with nothing else in that commit.
- Remove `demo_info` from every variant (`src/variants.ts` line 24 and `callTool`); put its sentence in server `instructions`. Two small models answered it on most flat tasks in the first run.
- Make `scripts/trace-tasks.ts` the single source of task text; `select.ts` imports it and derives `expected` from `firstPick`. Delete the `v1` task set from the docs and keep its raw files.
- Point headless runs at a clean config dir (`CLAUDE_CONFIG_DIR`; verify the installed Claude Code honours it) so no user-level plugin or hook loads in any arm.
- `scripts/trace-score.ts`: per-turn latency from the `timestamp` on each session row, p50 and p90 wall per condition, and the count of group opens per session. The mod logs each `groups/get`, `skills/get` and `resources/read` round trip to stderr.

Mod, needed for the run to test what #22 describes:

- `read_skill` calls `skills/get`, verifies the SKILL.md digest with Node's `crypto`, and refuses on mismatch. `open_group` returns instructions, the scoped tools and the skill's URI, and stops inlining the SKILL.md, so opening a group no longer activates the skill, as the SEP says.
- Skills whose name is a group are left out of the prompt's skills section; `read_skill` on such a name opens the group first.
- `scripts/trace-run.ts`: the two new conditions. Mod options cannot be passed in a headless run (`--settings pluginConfigs` did not reach the mod, observed 2026-11-08), so `modDir()` copies the mod and rewrites the manifest defaults for `url` and `deferScoped`, as it already does for `url` in the flat conditions.
- `claude plugin validate mods/groups` and `claude plugin test mods/groups`.

Server:

- `src/catalog.ts`: a one-level option on `productToolsets()` and a second description table.
- `src/variants.ts`: `opt2-rec`, plus a query parameter or variant for the shallow-templated selection arm. Drop `opt1` and `opt3` from the deployed set; they appear only in the token comparison and can run locally.
- `npm run typecheck`, `npm run deploy:all`, `npm run compare` against the new Workers, save the output under `results/`.

## Run order

1. Selection: recommended and recommended-duplicated at 13 groups, open models. Confirms the skill-only column moves before anything else is spent.
2. Selection: the rest of the groups grid, hosted models and classifiers.
3. Completion: groups-rec and groups-rec-resident, Sonnet only. Confirms the turn and cache prediction.
4. Completion: the remaining conditions and models.
5. `npm run trace:score`, `npm run trace:redact`, update the three documents once per claim, redeploy the explainer.

## Left out of this round, and why

- More tasks. Twenty tasks put a two-task gap inside the noise band, and a full new task set with rubrics is the most expensive item on the list. The three questions above predict differences larger than that band (a whole turn, a column of skill-only picks going to zero). Say in the write-up that gaps of one or two tasks are noise.
- Per-caller scoping. Real and worth testing, but it needs a header-driven view on the server, five new write tasks and a scoring rule for "called a withheld tool". Next round.
- A second harness, non-Claude completion models, Code Mode as the baseline. Each is a project of its own.
- Generating the tables into the documents by script. Worth doing if the three documents keep drifting; not a measurement.

## Fresh-session checklist

Read first: this file, `docs/running.md`, the limits section of `docs/results.md`, `scripts/trace-run.ts`, `scripts/select.ts` lines 50 to 115 and 360 to 372, `mods/groups/hooks/register.ts`, `src/catalog.ts`, `src/variants.ts`.

Pinned references: #19 at `15b2a5cf919702ae95a591856525486c857b3ea5` (`seps/0000-progressive-disclosure-groups.md`; the placement rule at "Placement and naming", the shallow-hierarchy SHOULD just before "Graceful Degradation", the description SHOULD under the group object, "Progressive disclosure vs. tool search" in the rationale). #22 at `5e9ff2f45a623cda09996400e8674333d7bba901` (`docs/groups-and-skills-positioning.md`; Example 3 and the interop rules). Fetch either with `gh api "repos/modelcontextprotocol/progressive-disclosure-wg/contents/<path>?ref=<sha>" --jq .content | base64 -d`, and check whether the PR heads moved first: `gh pr view 19 --repo modelcontextprotocol/progressive-disclosure-wg --json headRefOid`.

Environment: Node 24, `npm ci`, a `.env` with `HF_TOKEN`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `MOONSHOT_API_KEY`, `TYPESAFE_API_KEY` passed as `--env`; the Claude Code binary at `~/.local/bin/claude` or `CLAUDE_BIN`; `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1` for every headless run; wrangler logged in to the `olahungerford` account for deploys. Raw session files are gitignored and must stay so.

Decisions already taken: shared group and skill names stay and the duplicate listing goes; Options 1 and 3 remain wire-only comparisons; the existing 20 tasks are kept; prose is written once per claim, with `docs/results.md` as the full record, the write-up as the standalone text for the working group, and README and explainer as one-sentence summaries.
