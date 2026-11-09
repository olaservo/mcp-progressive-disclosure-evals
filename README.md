# MCP progressive disclosure evals

Measurements of the MCP working group's draft [Groups extension](https://github.com/modelcontextprotocol/progressive-disclosure-wg/pull/19) on a large real catalog: Cloudflare's API MCP server (3,036 tools) with five of Cloudflare's published skills. One Cloudflare Worker serves the catalog flat and under each option in the [positioning document](https://github.com/modelcontextprotocol/progressive-disclosure-wg/pull/22) for Groups against Skills over MCP, so the options can be compared side by side. Measured on 2026-11-07 and 2026-11-08 against #19 at `15b2a5c` and #22 at `5e9ff2f`.

Three measurements:

1. **Tokens.** What a client reads before and after it commits to a task, per variant, at 238 and 3,036 tools.
2. **Selection.** Sixteen models and two classifier APIs pick a group, skill or tool for 20 tasks that describe a job without naming the product.
3. **Task completion.** A Claude Code mod that speaks the extension runs the same 20 tasks as 180 headless sessions, against the flat server behind the host's tool search and the flat server with all 238 schemas in the prompt up front.

## Findings

- The flat `tools/list` for 3,036 tools is 1.38M tokens, more than any model can read. The groups list for the same catalog is 5.5k. Task load is the same whether the catalog has 238 tools or 3,036, and schemas are most of it once a group holds more than a handful of tools.
- Groups did not change what the hosted models picked. Every hosted model landed within two tasks of itself across groups and flat modes at both sizes. The five-line skills index in the prompt moved flat scores by up to 17 of 20 and moved no groups score.
- Templated group descriptions cost the mid-size open models up to 6 of 20 tasks at 139 groups. The SEP's guidance that descriptions carry task vocabulary is what this measures.
- Through Claude Code, Sonnet and Opus completed 20 of 20 tasks under groups, under the host's tool search, and with all schemas up front. Groups read 2.3M input tokens per model against 16.5M to 18.4M with all schemas up front, cost one more turn, and matched the host's tool search on completion and tokens. The prompt cache held across group opens.
- Option 2 of the positioning document works as written on the shipped SDK. One rule is missing: `skills/list` should not count as a listing for placement. Option 3's rename delivers a skill's body with no entry, digests or root for relative links.

Against the working group's four criteria: groups deliver initial context size and total tokens, leave completion unchanged for frontier models, add a turn, and on this catalog a host with tool search gets the token result without a protocol change. What groups add is the bundle, instructions and a skill delivered with the tools, scoped to the caller, and a path for clients without tool search.

## Read more

- [`explainer.html`](explainer.html): a one-page recap. [`writeup.html`](writeup.html) is the long form, rendered from [`drafts/wg-findings-writeup.md`](drafts/wg-findings-writeup.md), which is the text for the working group.
- [`docs/results.md`](docs/results.md): every table, the notes behind each, and the limits.
- [`docs/running.md`](docs/running.md): sources, variants, how to run the servers and the trials, the deployed Workers, the Claude Code mod.
- [`results/traces/traces-public/`](results/traces/traces-public/): the 180 redacted sessions with their own README; also attached as a zip to the [`traces-2026-11-08`](https://github.com/olaservo/mcp-progressive-disclosure-evals/releases/tag/traces-2026-11-08) release.
- [`drafts/`](drafts/): the comments drafted for #19 and #22, the methodology review and the plan for the real-client run.
- [`NOTES.md`](NOTES.md): the session log, what was done in what order and what went wrong.

## Quick start

Node 24 or later.

```bash
npm ci
npm run dev        # every variant at http://localhost:8787/<variant>/mcp
npm run compare    # the token comparison against localhost
```

The four variants are also deployed, with no auth and dry-run tools, at `https://pd-groups-{flat,opt1,opt2,opt3}.olahungerford.workers.dev/mcp`. Everything else is in [`docs/running.md`](docs/running.md).

## Licence

Apache-2.0, see `LICENSE`. `src/vendor` carries generated tool definitions from cloudflare/mcp and skill files from cloudflare/skills, both Apache-2.0; `NOTICE` names them. The trace sessions are CC-BY-4.0 and say so in their README.
