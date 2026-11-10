# Re-run plan

Carried out on 2026-11-09. The results are in the "Second round" section of `docs/results.md` and in the write-up.

Written 2026-11-09 after a methodology review on 2026-11-09, whose corrections are committed in `53aac83`. Revised the same day after an adversarial read of the first draft. This file is the handoff for the session that runs the second round. Breaking changes to anything in this repository are allowed. The round is for understanding how groups behave in real use, so it tests three questions and leaves the rest.

## The three questions

**A. Does a groups server built the recommended way behave differently from the as-generated one, and how do both compare with flat behind host tool search?** The first run's server mirrors the generator's directory tree two levels deep with templated descriptions, which is what a server author gets for free. The SEP recommends shallow hierarchies, descriptions that carry the task vocabulary a user would use, and a group as a workflow bundle that lists its skill. Nobody has measured that design. Build it as `opt2-rec` and keep the current server as `opt2`, the as-generated baseline.

**B. What do groups cost in a client without tool search?** The first run's groups arm registered scoped tools as deferred, so Claude Code fetched every schema through ToolSearch, 19 to 21 calls per model. A client without tool search appends the group's tools to the resident tool list, which rewrites the cached prefix once per open but saves the fetch turn. Run the recommended server with `deferScoped` false and `ENABLE_TOOL_SEARCH=false`. Prediction: one fewer turn than the deferred arm on product tasks, one prefix rewrite per open whose size is the group's schema tokens plus the base prefix, total tokens in the same band as the deferred arm. The group-size cap below is what keeps that rewrite small; without it a `workers` open would rewrite about 230k tokens as the provider renders it.

**C. Does listing a grouped workflow twice cost anything?** Models picked the skill alone on 2 to 4 of 20 tool tasks in groups mode because `turnstile-spin`, `durable-objects` and `cloudflare-email-service` appear in both `groups/list` and `skills/list`. Shared names stay: the SEP sets group name rules equal to Agent Skills name rules so a workflow can reuse its skill name, and the match lets a host pair the two by name. The recommended server omits grouped skills from `skills/list` for a client that negotiated groups, and the mod opens the group when the model asks for a skill that is also a group. In the recommended prompt a skill-only pick is impossible by construction, so the measured outcome is not that column. It is the correct-pick count and the misroutes to `wrangler` and `workers-best-practices`, recommended against recommended-duplicated. This is open: the write-up says both placements are legal and the question is which a host should prefer.

## What the recommended server looks like

`opt2-rec`, served beside `opt2`:

- One level, groups sized to a task. No child groups. A product whose tools fit in about 20 goes in one group; a larger product is split by area into top-level groups (`workers` is 72 tools and 98k compact tokens on the subset, `r2` 52 and 17k, from `src/vendor/forge-catalog.ts`; `workers` becomes `workers-scripts`, `workers-deployments`, `workers-routes` and so on, each with its own task-vocabulary description). Report every group's task-load tokens with `npm run compare` before the run, and put the per-product table in the write-up.
- Task-vocabulary descriptions. For the subset groups, written by hand from the jobs a user would bring ("r2-buckets: object storage. Buckets, CORS for browser access, lifecycle rules for expiry, custom domains, event notifications."). For the 139 full-catalog groups, generated from each product's tool descriptions by a script and reviewed by hand for the groups the first run's misses landed on (`pipelines-api`, `durable-objects`, `iam-api`, `hyperdrive-api`, `workflows-api`, `pages-api`, `queues-api`, `d1-api`, `kv-api`, `r2-api`, `workers-api`, `accounts-api`, `user-api`). Say in the write-up that the full-catalog descriptions were model-written and reviewed, since that is what a real server author with 136 products would do.
- Workflow groups say when to open them against the plain product group ("open `turnstile-spin` to set up Turnstile for a site; open `turnstile-api` to manage existing widgets"), since the first run showed models splitting between the two.
- Grouped skills left out of `skills/list` for a client that negotiated groups. `SkillSource.list`, `get` and `read` receive `ctx: ServerContext` (the SDK's `extension-*.d.mts`), so filter inside `list` on `clientNegotiated(ctx)` from `src/groups.ts`. A client that never negotiated groups keeps the full list. Because the listing now varies by negotiated extension, that variant's skills use `cacheScope: 'private'`.

## Conditions

Selection trial (`scripts/select.ts`), the existing 20 v2 tasks with their current wording, one sample, skill index in every prompt:

| Mode | Server | Catalog |
| :-- | :-- | :-- |
| as-generated | `opt2`, templated, two-level, all five skills listed | 13 and 139 groups |
| recommended | `opt2-rec` | 13 and 139 groups |
| recommended, duplicated | `opt2-rec`, with `--list-all-skills`, which fetches `skills/list` on a second client that declares only the Skills extension | 13 groups |
| flat, names | `flat` without `demo_info` | 238 and 3,036 tools |

The flat-schemas control is not re-run; the 2026-11-08 file stands, with a note that it still showed `demo_info`. A "shallow but templated" arm was dropped because `groups/list` shows only top-level groups, so on the two-level server it is the same prompt as the as-generated one. Add a skill-only-on-tool-task column to the summary; leave `correct` as it is so `--replay` of old files still matches the committed summaries.

Completion run (`scripts/trace-run.ts`), the existing 20 tasks, Sonnet, Haiku and Opus 5.5, every arm re-run on the same days so they are comparable:

| Condition | Server | Host tool search | Scoped tools | Mod dedup rule |
| :-- | :-- | :-- | :-- | :-- |
| groups-rec | `opt2-rec` | on | deferred | on |
| groups-rec-resident | `opt2-rec` | off | resident | on |
| groups | `opt2` | on | deferred | off |
| flat-toolsearch | `flat` | on | n/a | n/a |
| flat-all-schemas | `flat` | off | n/a | n/a |

Report turns and wall time split by workflow tasks (the eight that have a skill) and product tasks, because stopping the SKILL.md inline adds a `read_skill` turn on workflow tasks in every groups arm, which offsets the turn the shallow tree saves on product tasks. The first run cost about 22 USD for three conditions; five at 20 tasks is about 300 sessions and 35 to 45 USD. Give the resident arm a higher `--max-budget-usd` default like the all-schemas arm, since a resident open rewrites the prefix on Opus.

## Changes before any run

Hygiene:

- Remove `demo_info` from every variant (`src/variants.ts` line 24 and `callTool`); put its sentence in server `instructions`. This changes the "Top-level tools" line in every selection prompt, which is why the flat names arm is re-run and the schema control is not reused as a like-for-like.
- Keep both task lists as they are. `select.ts` keeps its v2 wording and `full` extras so its results compare with 2026-11-08; `trace-tasks.ts` keeps the agent wording. Keep `TASKS_V1` in code because `--replay` of the 2026-11-07 files indexes it; drop v1 from the docs only.
- Config isolation is optional and must be smoke-tested first. `trace-run.ts` line 35 reads sessions from `~/.claude/projects/<slug>`, and a fresh `CLAUDE_CONFIG_DIR` has no credentials. If you isolate: derive the sessions dir from `CLAUDE_CONFIG_DIR`, copy `.credentials.json` into it or pass `ANTHROPIC_API_KEY` deliberately and say which account paid, and run one task before anything else. If that costs more than an hour, run as before with the user-level plugins loaded in every arm and keep the limit in the write-up.
- `scripts/trace-score.ts`: per-turn latency from the `timestamp` on each session row, p50 and p90 wall per condition, the number of group opens per session, and `read_skill` names normalised to the skill name so `skill:turnstile-spin/SKILL.md` and `skill:turnstile-spin` score alike.
- `scripts/trace-tasks.ts`: the `loaded()` helper counts a group open as having loaded the skill. That was true while the mod inlined the SKILL.md and is false once it stops, so the three knowledge rubrics (`state-holder`, `review-alarms`, `fetch-handler`) must require `picks.skills`.

Mod:

- `read_skill` calls `skills/get`, verifies the SKILL.md digest (Web Crypto `subtle.digest`, available in the mod runtime; confirm in `mods/groups/tests/groups.test.ts`), and refuses on mismatch. It accepts a bare name or a `skill://<name>/SKILL.md` URI and normalises both to the name.
- `open_group` returns instructions, the scoped tools and the skill's URI, and stops inlining the SKILL.md, so opening a group no longer activates the skill, as the SEP says.
- A `dedupGroupedSkills` manifest option, default true: skills whose name is a group are left out of the prompt's skills section, and `read_skill` on such a name opens the group first. The as-generated arm runs with it off.
- Group opens are written into the tool result text and to a JSONL file named by a `GROUPS_LOG` env var, not stderr; `trace-run.ts` keeps only 500 characters of the child's stderr.
- `trace-run.ts`: one gitignored copy dir per condition. Mod options do not reach a headless run (`--settings pluginConfigs` did not, observed 2026-11-08), so the copy rewrites the `url` literal, the `deferScoped` expression and the `dedupGroupedSkills` expression in the copied `register.ts`, as the flat copy already does for `url`. The smoke run for the resident arm must show zero ToolSearch calls and resident `mcp__groups__*` tools in the session.
- `claude plugin validate mods/groups` and `claude plugin test mods/groups`.

Server:

- `src/catalog.ts`: a one-level builder with the size cap and split, and a second description table.
- `src/variants.ts`: `opt2-rec` with the negotiated-extension filter in the skills source. Drop `opt1` and `opt3` from the deployed set; they appear only in the token comparison and can run locally.
- `npm run typecheck`, `npm run deploy:all`, `npm run compare` against the new Workers, save the output under `results/`, and check the per-group task load before any model run.

## Run order

1. One headless task under `groups-rec-resident`, Sonnet. Confirms session capture, auth, zero ToolSearch calls and resident tools. Nothing else runs until this passes.
2. Selection: recommended and recommended-duplicated at 13 groups, open models. Cheap, and shows whether the misroute pattern changes.
3. Selection: the rest of the grid, hosted models and classifiers.
4. Completion: groups-rec and groups-rec-resident, Sonnet, all 20 tasks. Confirms the turn and prefix prediction before the other models run.
5. Completion: the remaining conditions and models.
6. `npm run trace:score`, `npm run trace:redact`, update the three documents once per claim, redeploy the explainer.

## Left out of this round, and why

- More tasks. Twenty tasks put a two-task gap inside the noise band, and a new task set with rubrics is the most expensive item. The predictions above are a whole turn and a misroute pattern, both larger than that band. Say in the write-up that gaps of one or two tasks are noise.
- Per-caller scoping. Real and worth testing, but it needs a header-driven view on the server, write tasks and a scoring rule for "called a withheld tool". Next round.
- Unifying the two task lists, a second harness, non-Claude completion models, Code Mode as the baseline, generating the tables by script. Each either breaks comparability with round one or is a project of its own.

## Fresh-session checklist

Read first: this file, `docs/running.md`, the limits section of `docs/results.md`, `scripts/trace-run.ts`, `scripts/select.ts` lines 50 to 115 and 360 to 372, `mods/groups/hooks/register.ts`, `src/catalog.ts`, `src/variants.ts`, `src/groups.ts`.

Pinned references: #19 at `15b2a5cf919702ae95a591856525486c857b3ea5` (`seps/0000-progressive-disclosure-groups.md`; the placement rule under "Placement and naming", the shallow-hierarchy SHOULD just before "Graceful Degradation", the description SHOULD under the group object, "Progressive disclosure vs. tool search" in the rationale). #22 at `5e9ff2f45a623cda09996400e8674333d7bba901` (`docs/groups-and-skills-positioning.md`; Example 3 and the interop rules). Fetch either with `gh api "repos/modelcontextprotocol/progressive-disclosure-wg/contents/<path>?ref=<sha>" --jq .content | base64 -d`, and check whether the PR heads moved first: `gh pr view 19 --repo modelcontextprotocol/progressive-disclosure-wg --json headRefOid`.

Environment: Node 24, `npm ci`, a `.env` with `HF_TOKEN`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `MOONSHOT_API_KEY`, `TYPESAFE_API_KEY` passed as `--env`; the Claude Code binary at `~/.local/bin/claude` or `CLAUDE_BIN`; `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1` for every headless run; wrangler logged in to the `olahungerford` account for deploys. Raw session files are gitignored and must stay so.

Decisions already taken: shared group and skill names stay; whether a grouped skill stays in `skills/list` for a groups client is the open question this round tests; Options 1 and 3 remain wire-only comparisons; the existing 20 tasks are kept with their current wording in each script; prose is written once per claim, with `docs/results.md` as the full record, the write-up as the standalone text for the working group, and README and explainer as one-sentence summaries.
