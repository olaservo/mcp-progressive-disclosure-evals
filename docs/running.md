# Running the servers and the trials

## Sources

- Tools: 238 forge-generated tools from 10 products (turnstile, durableObjects, emailSending, emailRouting, workers, d1, kv, r2, queues, containers) of [cloudflare/mcp](https://github.com/cloudflare/mcp) at `4938f2f3`. The full server has 3,036 tools in 1,030 toolsets across 136 products. Cloudflare serves them behind Code Mode by default, three tools (`docs`, `search`, `execute`) at about 1,100 tokens, and exposes them as direct tools only with `?codemode=false`, which its README documents as an escape hatch for composing with another code-mode system. The `flat` variant here is that direct-tool mode. Cloudflare's own README table puts the full-schema direct list at 1,170,523 tokens for 2,594 tools, which agrees with the 1,378,777 measured here for 3,036. Groups against Code Mode itself is not measured.
- Skills: `turnstile-spin`, `durable-objects`, `cloudflare-email-service`, `workers-best-practices` and `wrangler` from [cloudflare/skills](https://github.com/cloudflare/skills) at `1a33048`.
- `src/vendor` is committed, so nothing below is needed to run the demo. `npm run vendor` regenerates it from two checkouts that are not in this repo: cloudflare/mcp at `../servers/cloudflare-mcp` and cloudflare/skills at `.upstream/cloudflare-skills`. The script refuses a checkout at any other commit, so a `git pull` in either clone cannot change the vendored catalog unnoticed. To move to a newer commit, update `PINNED` in `scripts/vendor.mjs` and pass `--unpinned`. To recreate the checkouts at the commits used here:

  ```bash
  git clone https://github.com/cloudflare/mcp ../servers/cloudflare-mcp && git -C ../servers/cloudflare-mcp checkout 4938f2f3
  git clone https://github.com/cloudflare/skills .upstream/cloudflare-skills && git -C .upstream/cloudflare-skills checkout 1a33048
  ```

  Other paths work as arguments to `node scripts/vendor.mjs <mcp> <skills> [--full]`. `npm run vendor:full` vendors all 136 products. The committed `src/vendor` and the deployed Workers use the subset. The full build is for local runs. It bundles to 22.5 MiB, 1.6 MiB gzipped.

Tool calls are dry runs. They return the Cloudflare API request the tool would send and never send it.

## Variants

| Variant | #22 option | Tools | Discovery | Skills |
| :-- | :-- | :-- | :-- | :-- |
| `flat` | Today, and Option 1's Skills server | All 238 in `tools/list` | None | SEP-2640 Skills extension |
| `opt1` | Option 1's Groups server | Scoped | Toolset groups, and workflow groups with authored instructions | None |
| `opt2` | Option 2, complementary | Scoped | Toolset groups, and a workflow group per skill that scopes its tools and lists the skill's `SKILL.md` in `resources` (#22 Example 3) | SEP-2640 Skills extension, with nothing in `resources/list` |
| `opt3` | Option 3, Groups renamed to Skills | Scoped | `skills/list` and `skills/get` under `io.modelcontextprotocol/skills`. Each SKILL.md folder maps to its body as `instructions` and its other files as scoped `skill://` resources. Toolsets are skills too. | Replaced |

Groups follow the draft SEP in [progressive-disclosure-wg#19](https://github.com/modelcontextprotocol/progressive-disclosure-wg/pull/19) at `15b2a5c`: `io.modelcontextprotocol/groups`, `groups/list` and `groups/get`, with scoped primitives directly on the `groups/get` result. The WG prototype in [#20](https://github.com/modelcontextprotocol/progressive-disclosure-wg/pull/20) targets SDK 1.x; `src/groups.ts` implements the same shapes on `@modelcontextprotocol/server` 2.4.0. Skills use the SDK's native `@modelcontextprotocol/server/ext/skills`.

Toolset groups mirror forge's directory tree two levels deep: `workers-api` lists `workers-scripts`, `workers-routes` and so on in its `groups`. Product groups end in `-api` because a workflow group is already called `durable-objects`, and group names share one namespace.

For a client that does not declare the extension on the request, every variant falls back to a flat `tools/list` of all 238 tools. A 2025-era client never declares it, since per-request client capabilities are a 2026-07-28 feature.

## Run

Node 24 or later.

```bash
npm ci
npm run dev                         # every variant at http://localhost:8787/<variant>/mcp
npm run compare                     # the token comparison, against localhost
npx wrangler deploy --env opt2      # one variant as its own Worker, served at /mcp
npm run deploy:all                  # all four
npm run compare -- --urls flat=https://pd-groups-flat.<sub>.workers.dev/mcp,opt2=...
npm run vendor:full && npm run dev   # the 3,036-tool catalog, locally; npm run vendor restores the subset
```

## Deployed

Each variant runs as its own Worker, served at `/mcp`. There is no auth, and tool calls are dry runs.

- https://pd-groups-flat.olahungerford.workers.dev/mcp
- https://pd-groups-opt1.olahungerford.workers.dev/mcp
- https://pd-groups-opt2.olahungerford.workers.dev/mcp
- https://pd-groups-opt3.olahungerford.workers.dev/mcp

Each Worker answers 429 to a client past 120 requests a minute (the Workers Rate Limiting binding, keyed on the client IP, counted per Cloudflare location, approximate under bursts). The account is on the Workers Free plan, so Cloudflare stops a Worker with Error 1027 after 100,000 requests a day and bills nothing; the limiter keeps one client from using that quota up.

## The selection trial

`scripts/select.ts` shows a model what a client sees before `groups/get` and asks for one pick. It reads keys from the environment or from a `.env` file passed as `--env`: `HF_TOKEN` (or an `hf auth login`) for open models, `ANTHROPIC_API_KEY` for `claude-*`, `OPENAI_API_KEY` for `gpt-*` and `decisions:*`, `GEMINI_API_KEY` for `gemini-*`, `MOONSHOT_API_KEY` for `kimi-*`, `TYPESAFE_API_KEY` for `jev-*`. A model id routes by prefix to its vendor's SDK; anything else goes to the Hugging Face router as `<org>/<model>:<provider>`.

- `--tasks v1` is the 14 product-named tasks, `--tasks v2` the 20 that describe the job without naming the product.
- `--mode` is `groups`, `flat` (tool names and first lines) or `flat-schemas` (the whole `tools/list` result). Every mode also shows the server's `skills/list` index, and a `{"skill":"<name>"}` answer is accepted where the matching workflow group is, plus `workers-best-practices` for the fetch-handler question and `wrangler` for the deploy and schedule tasks.
- `SELECT_DUMP_PROMPT=1` prints the catalog text the model sees.
- `--replay results/<file>.jsonl` rebuilds a summary from committed raw answers without calling a model. Hosted model answers can change over time; the raw answers are committed for that reason.

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
# 2026-11-08, with the skill index in every prompt: the groups and flat (names) runs above repeated for $OPEN, $HOSTED, $GEMINI,
# decisions:gpt-6-luna and jev-latest, subset against the Workers and full catalog against localhost:8787, then the schema control for the same models as before.
```

## The task-completion run

`scripts/trace-tasks.ts` holds the 20 tasks and their completion rubrics. `scripts/trace-run.ts` runs each as a headless Claude Code session under one condition and keeps the session file next to an index row; `scripts/trace-score.ts` scores them; `scripts/trace-redact.ts` keeps only the conversation rows for publication.

```bash
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 npm run trace:run -- --condition groups --models claude-sonnet-5-5,claude-haiku-5-5,claude-opus-5-5
npm run trace:run -- --condition flat-toolsearch --models claude-sonnet-5-5
npm run trace:run -- --condition flat-all-schemas --models claude-sonnet-5-5   # a 300k-token prefix per turn; the default budget per run is higher
npm run trace:score                                   # results/traces/traces/summary.md
npm run trace:redact                                  # results/traces/traces-public/
npm run trace:score -- --label traces-public          # re-score the committed public copy
```

Headless runs launched from inside a Claude Code session need `--allowedTools "mcp__groups__*"`; the runner sets that. Raw session files are gitignored because they embed the host's system prompt and account ids.

## The Claude Code mod

`mods/groups` speaks the Groups extension to one of the deployed Workers over HTTP. It registers `list_groups`, `open_group` and `read_skill`, adds a system-prompt section listing the groups and skills, and on `open_group` registers the group's scoped tools as deferred definitions and routes their calls to `tools/call`. Options: `url`, `deferScoped`, `listSkills`.

```bash
claude plugin validate mods/groups
claude plugin test mods/groups
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir mods/groups
```

## Refreshing when #19 or #22 change

1. In a clone of the WG repo, `git fetch origin pull/19/head:pr-19 pull/22/head:pr-22 -f` and diff against the commits named in `NOTES.md`.
2. Update `src/groups.ts` and `src/variants.ts` for any change in wire shapes or option definitions.
3. `npm run typecheck`, then `npm run deploy:all`.
4. `npm run compare -- --urls ...` and save the output under `results/`. For the full catalog, `npm run vendor:full`, `npm run dev`, `npm run compare`, then `npm run vendor`.
5. Re-run the selection trial only if the group names or descriptions changed.
