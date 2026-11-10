# Running the servers and the trials

## Sources

- Tools: 237 forge-generated tools from 10 products (turnstile, durableObjects, emailSending, emailRouting, workers, d1, kv, r2, queues, containers) of [cloudflare/mcp](https://github.com/cloudflare/mcp) at `4938f2f3`. The full server has 3,036 tools in 1,030 toolsets across 136 products. Cloudflare serves them behind Code Mode by default, three tools (`docs`, `search`, `execute`) at about 1,100 tokens, and exposes them as direct tools only with `?codemode=false`, which its README documents as an escape hatch for composing with another code-mode system. The `flat` variant here is that direct-tool mode. Cloudflare's own README table puts the full-schema direct list at 1,170,523 tokens for 2,594 tools, which agrees with the 1,378,777 measured here for 3,036. Groups against Code Mode itself is not measured.
- Skills: `turnstile-spin`, `durable-objects`, `cloudflare-email-service`, `workers-best-practices` and `wrangler` from [cloudflare/skills](https://github.com/cloudflare/skills) at `1a33048`.
- `src/vendor` is committed, so nothing below is needed to run the 237-tool subset. `npm run vendor` regenerates it and `npm run vendor:full` vendors all 136 products (3,036 tools). Both fetch the two pinned commits into `.upstream/` on first use: a sparse, blob-less fetch of cloudflare/mcp limited to `src/generated/forge-mcp`, about 3 MB of git data and 28 MB checked out, and a shallow fetch of cloudflare/skills. Later runs reuse the checkouts. The script refuses a checkout at any other commit, so a `git pull` in either clone cannot change the vendored catalog unnoticed. To move to a newer commit, update `PINNED` in `scripts/vendor.mjs` and pass `--unpinned`. Existing checkouts elsewhere work as arguments: `node scripts/vendor.mjs <mcp> <skills> [--full]`. The committed `src/vendor` and the deployed Workers use the subset. The full build is for local runs; it bundles to 22.5 MiB, 1.6 MiB gzipped, and `npm run vendor` restores the subset.

Tool calls are dry runs. They return the Cloudflare API request the tool would send and never send it.

## Variants

| Variant | #22 option | Tools | Discovery | Skills |
| :-- | :-- | :-- | :-- | :-- |
| `flat` | Today, and Option 1's Skills server | All 237 in `tools/list` | None | SEP-2640 Skills extension |
| `opt1` | Option 1's Groups server | Scoped | Toolset groups, and workflow groups with authored instructions | None |
| `opt2` | Option 2, complementary | Scoped | Toolset groups, and a workflow group per skill that scopes its tools and lists the skill's `SKILL.md` in `resources` (#22 Example 3) | SEP-2640 Skills extension, with nothing in `resources/list` |
| `opt2-rec` | Option 2, built the way #19 recommends | Scoped | One level of groups. A product with more than 25 tools or about 15k tokens of schemas is split by its second-level directories (areas under 4 tools join a `-core` group): 22 groups on the subset, 271 on the full catalog. Task-vocabulary descriptions from `src/group-descriptions.ts` (hand-written for the subset) and `src/group-descriptions.generated.json` (model-written for the full catalog by `npm run describe`, after `npm run vendor:full`). A workflow group per skill that says when to open it against the product group. | SEP-2640 Skills extension; a client that negotiated groups gets only the skills no group lists in `skills/list`, served `cacheScope: "private"` |
| `opt3` | Option 3, Groups renamed to Skills | Scoped | Option 2's bundles under the skills method names, `skills/list` and `skills/get`, served under the existing `io.modelcontextprotocol/skills` identifier. Each SKILL.md folder is flattened to its body as `instructions` and its other files as scoped `skill://` resources. Toolsets are skills too. | Replaced |

Groups follow the draft SEP in [progressive-disclosure-wg#19](https://github.com/modelcontextprotocol/progressive-disclosure-wg/pull/19) at `15b2a5c`: `io.modelcontextprotocol/groups`, `groups/list` and `groups/get`, with scoped primitives directly on the `groups/get` result. The WG prototype in [#20](https://github.com/modelcontextprotocol/progressive-disclosure-wg/pull/20) targets SDK 1.x; `src/groups.ts` implements the same shapes on `@modelcontextprotocol/server` 2.4.0. Skills use the SDK's native `@modelcontextprotocol/server/ext/skills`.

Toolset groups mirror forge's directory tree two levels deep: `workers-api` lists `workers-scripts`, `workers-routes` and so on in its `groups`. Product groups end in `-api` because a workflow group is already called `durable-objects`, and group names share one namespace.

For a client that does not declare the extension on the request, every variant falls back to a flat `tools/list` of all 237 tools. Before 2026-11-09 every variant also served a `demo_info` tool, which made 238; its text is now in the server `instructions`. A 2025-era client never declares it, since per-request client capabilities are a 2026-07-28 feature.

## Run

Node 24 or later.

```bash
npm ci
npm run dev                         # every variant at http://localhost:8787/<variant>/mcp
npm run compare                     # the token comparison, against localhost
npx wrangler deploy --env opt2      # one variant as its own Worker, served at /mcp
npm run deploy:all                  # flat, opt2 and opt2-rec; opt1 and opt3 run locally
npm run compare -- --urls flat=https://pd-groups-flat.<sub>.workers.dev/mcp,opt2=...
npm run vendor:full && npm run dev   # the 3,036-tool catalog, locally; npm run vendor restores the subset
```

## Deployed

Each variant runs as its own Worker, served at `/mcp`. There is no auth, and tool calls are dry runs.

- https://pd-groups-flat.olahungerford.workers.dev/mcp
- https://pd-groups-opt1.olahungerford.workers.dev/mcp (the 2026-11-08 build, with `demo_info`)
- https://pd-groups-opt2.olahungerford.workers.dev/mcp
- https://pd-groups-opt2-rec.olahungerford.workers.dev/mcp
- https://pd-groups-opt3.olahungerford.workers.dev/mcp (the 2026-11-08 build, with `demo_info`)

Each Worker answers 429 to a client past 120 requests a minute (the Workers Rate Limiting binding, keyed on the client IP, counted per Cloudflare location, approximate under bursts). The account is on the Workers Free plan, so Cloudflare stops a Worker with Error 1027 after 100,000 requests a day and bills nothing; the limiter keeps one client from using that quota up.

## The selection trial

`scripts/select.ts` shows a model what a client sees before `groups/get` and asks for one pick. It reads keys from the environment or from a `.env` file passed as `--env`: `HF_TOKEN` (or an `hf auth login`) for open models, `ANTHROPIC_API_KEY` for `claude-*`, `OPENAI_API_KEY` for `gpt-*` and `decisions:*`, `GEMINI_API_KEY` for `gemini-*`, `MOONSHOT_API_KEY` for `kimi-*`, `TYPESAFE_API_KEY` for `jev-*`. A model id routes by prefix to its vendor's SDK; anything else goes to the Hugging Face router as `<org>/<model>:<provider>`.

- `--tasks v1` is the 14 product-named tasks, `--tasks v2` the 20 that describe the job without naming the product.
- `--mode` is `groups`, `flat` (tool names and first lines) or `flat-schemas` (the whole `tools/list` result). Every mode also shows the server's `skills/list` index, and a `{"skill":"<name>"}` answer is accepted where the matching workflow group is, plus `workers-best-practices` for the fetch-handler question and `wrangler` for the deploy and schedule tasks.
- `SELECT_DUMP_PROMPT=1` prints the catalog text the model sees.
- `--replay results/<file>.jsonl` rebuilds a summary from committed raw answers without calling a model. Hosted model answers can change over time; the raw answers are committed for that reason.
- `--list-all-skills` reads `skills/list` on a second client that declares only the Skills extension, so `opt2-rec` shows every skill (the "recommended, duplicated" arm).
- `--parallel` runs every model of a run at once, each through its tasks in order.
- `--retry results/<file>.jsonl --url <the run's server>` asks again only the trials that ended in an error and rewrites the file.

The runs behind `results/`:

```bash
npm run select -- --env path/to/.env --label subset-opt2-groups
npm run select -- --env path/to/.env --url https://pd-groups-flat.olahungerford.workers.dev/mcp --mode flat --label subset-flat
npm run select -- --env path/to/.env --url http://localhost:8787/opt2/mcp --label full-opt2-groups            # after vendor:full and npm run dev
npm run select -- --env path/to/.env --url http://localhost:8787/flat/mcp --mode flat --models Qwen/Qwen3.5-9B:deepinfra,claude-opus-5-5 --seeds 2 --label full-flat
OPEN=Qwen/Qwen3.5-9B:deepinfra,Qwen/Qwen3-14B:deepinfra,zai-org/GLM-5.3-Flash:baseten,deepseek-ai/DeepSeek-V4.1-Flash:baseten,Qwen/Qwen3.6-35B-A3B:deepinfra,google/gemma-4-26B-A4B-it:deepinfra
npm run select -- --tasks v2 --models $OPEN --label subset-groups
npm run select -- --tasks v2 --mode flat --url https://pd-groups-flat.olahungerford.workers.dev/mcp --models $OPEN --label subset-flat
npm run select -- --tasks v2 --mode flat-schemas --url https://pd-groups-flat.olahungerford.workers.dev/mcp --models $OPEN --label subset-flat-schemas
npm run select -- --tasks v2 --url http://localhost:8787/opt2/mcp --models $OPEN --label full-groups
npm run select -- --tasks v2 --mode flat --url http://localhost:8787/flat/mcp --models $OPEN --label full-flat
HOSTED=claude-opus-5-5,claude-sonnet-5-5,claude-haiku-5-5,gpt-6-astra,gpt-6.1-sol,gpt-6.1-terra,gpt-6-luna,kimi-k3.1-pro
npm run select -- --env path/to/.env --tasks v2 --models $HOSTED,decisions:gpt-6-luna --label subset-groups-hosted
npm run select -- --env path/to/.env --tasks v2 --mode flat --url https://pd-groups-flat.olahungerford.workers.dev/mcp --models $HOSTED --label subset-flat-hosted
npm run select -- --env path/to/.env --tasks v2 --mode flat-schemas --url https://pd-groups-flat.olahungerford.workers.dev/mcp --models claude-opus-5-5,claude-sonnet-5-5,claude-haiku-5-5,gpt-6.1-sol,gpt-6.1-terra,gpt-6-luna --label subset-flat-schemas-hosted
npm run select -- --env path/to/.env --tasks v2 --url http://localhost:8788/opt2/mcp --models $HOSTED,decisions:gpt-6-luna --label full-groups-hosted
npm run select -- --env path/to/.env --tasks v2 --mode flat --url http://localhost:8788/flat/mcp --models $HOSTED --label full-flat-hosted
npm run select -- --env path/to/.env --tasks v2 --mode flat-schemas --url https://pd-groups-flat.olahungerford.workers.dev/mcp --models kimi-k3.1-pro --label subset-flat-schemas-kimi
npm run select -- --env path/to/.env --tasks v2 --models jev-latest --label subset-groups-jev
npm run select -- --env path/to/.env --tasks v2 --url http://localhost:8789/opt2/mcp --models jev-latest --label full-groups-jev
GEMINI=gemini-4-argon,gemini-3.8-flash   # the same five runs as $HOSTED, labelled <catalog>-<mode>-gemini, local server on port 8790
# 2026-11-09, the second round: the same model lists with --parallel, labelled <catalog>-groups[-rec[-dup]][-hosted|-gemini|-jev] and
# <catalog>-flat[-hosted|-gemini], subset against the Workers (opt2, opt2-rec, flat) and full catalog against localhost:8787.
# 2026-11-08, with the skill index in every prompt: the groups and flat (names) runs above repeated for $OPEN, $HOSTED, $GEMINI,
# decisions:gpt-6-luna and jev-latest, subset against the Workers and full catalog against localhost:8787, then the schema control for the same models as before.
```

## The task-completion run

`scripts/trace-tasks.ts` holds the 20 tasks and their completion rubrics. `scripts/trace-run.ts` runs each as a headless Claude Code session under one condition and keeps the session file next to an index row; `scripts/trace-score.ts` scores them; `scripts/trace-redact.ts` keeps only the conversation rows for publication.

```bash
# conditions: groups-rec, groups-rec-resident, groups, flat-toolsearch, flat-all-schemas
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 npm run trace:run -- --condition groups-rec --models claude-sonnet-5-5 --label traces2
npm run trace:run -- --condition flat-all-schemas --models claude-sonnet-5-5 --label traces2   # a 300k-token prefix per turn; the default budget per run is higher
npm run trace:score -- --label traces2 > results/traces/traces2/summary.md
npm run trace:redact -- --label traces2               # results/traces/traces2-public/
npm run trace:score -- --label traces2-public         # re-score the committed public copy
```

Headless runs launched from inside a Claude Code session need `--allowedTools "mcp__groups__*"`; the runner sets that. Mod options do not reach a headless `--plugin-dir` run, so the runner writes a gitignored copy of the mod per condition and model list (`mods/.groups-*`) with the URL, `deferScoped` and `dedupGroupedSkills` rewritten. `groups-rec-resident` and `flat-all-schemas` run with `ENABLE_TOOL_SEARCH=false`. Each session's group opens go to `<session>.groups.jsonl` through the mod's `GROUPS_LOG`. Several conditions can run side by side against the same label. Raw session files are gitignored because they embed the host's system prompt and account ids.

## The Claude Code mod

`mods/groups` implements the Groups extension against one of the deployed Workers over HTTP. It registers `list_groups`, `open_group` and `read_skill`, adds a system-prompt section listing the groups and skills, and on `open_group` registers the group's scoped tools as deferred definitions and routes their calls to `tools/call`. `open_group` returns a listed skill's URI and does not load it. `read_skill` takes a skill name or `skill://` URI, fetches the entry with `skills/get`, and refuses a file whose SHA-256 does not match the published digest. Options: `url`, `deferScoped`, `listSkills`, `dedupGroupedSkills` (list a skill that is also a group once, as the group, and open the group first when `read_skill` names it). The `GROUPS_LOG` environment variable names a JSONL file for group opens.

```bash
claude plugin validate mods/groups
claude plugin test mods/groups
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir mods/groups
```

## Refreshing when #19 or #22 change

1. In a clone of the WG repo, `git fetch origin pull/19/head:pr-19 pull/22/head:pr-22 -f` and diff against the commits named in the README.
2. Update `src/groups.ts` and `src/variants.ts` for any change in wire shapes or option definitions.
3. `npm run typecheck`, then `npm run deploy:all`.
4. `npm run compare -- --urls ...` and save the output under `results/`. For the full catalog, `npm run vendor:full`, `npm run dev`, `npm run compare`, then `npm run vendor`.
5. Re-run the selection trial only if the group names or descriptions changed.
