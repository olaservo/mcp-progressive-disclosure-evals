# MCP progressive disclosure evals

Measurements of the MCP working group's draft [Groups extension](https://github.com/modelcontextprotocol/progressive-disclosure-wg/pull/19) on a large real catalog: Cloudflare's API MCP server (3,036 tools) with five of Cloudflare's published skills. One Cloudflare Worker serves the catalog flat and under each option in the [positioning document](https://github.com/modelcontextprotocol/progressive-disclosure-wg/pull/22) for Groups against Skills over MCP, so Option 2 can be run against the flat server and the three options compared on wire shape and tokens. Measured on 2026-11-07 and 2026-11-08 against #19 at `15b2a5c` and #22 at `5e9ff2f`.

Three measurements:

1. **Tokens.** What a client reads before and after it commits to a task, per variant, at 238 and 3,036 tools.
2. **Selection.** Sixteen models and two classifier APIs pick a group, skill or tool for 20 tasks that describe a job without naming the product.
3. **Task completion.** A Claude Code mod that implements the extension runs the same 20 tasks as 180 headless sessions, against the flat server behind the host's tool search and the flat server with all 238 schemas in the prompt up front.

## Findings

- The flat `tools/list` for 3,036 tools is 1.38M tokens, more than any model can read. The groups list for the same catalog is 5.5k. Once the model picks a group, it reads the same tokens at either catalog size: the group's tool schemas and the skill body. Schemas are most of that once a group holds more than a handful of tools.
- Groups did not measurably change what the hosted models picked. Each hosted model scored similarly across groups and flat modes at both catalog sizes. The `skills/list` index is a control, not a finding. Adding it moved flat scores by up to 17 of 20 and six groups-mode cells by two to six.
- Option 2 lists each workflow in both `groups/list` and `skills/list`. In groups mode, five models picked the skill without its group on 2 to 4 of 20 tool tasks, a path that on a real client loads instructions naming tools the client was not given.
- Templated group descriptions cost the mid-size open models up to 6 of 20 tasks at 139 groups. The SEP's guidance that descriptions carry task vocabulary is what this measures.
- Through Claude Code, Sonnet and Opus completed 20 of 20 tasks under groups, under the host's tool search, and with all schemas up front. Groups read 2.32M to 2.37M input tokens per model, the host's tool search 1.96M to 2.22M, and all schemas up front 16.5M to 18.4M. Groups cost one more turn and 3 to 4 seconds per task, and their scoped tools loaded through the host's tool search, so the run shows groups composed with it. The prompt cache held across group opens.
- Option 2 of the positioning document works as written on the shipped SDK. Neither document says whether a skill a group lists stays in `skills/list`, and the SDK lists every SKILL.md in `resources/list` by default. Option 3's flattening of a SKILL.md folder into instructions drops the skill's entry, digests and the root for its relative links.

## Read more

- [The explainer page](https://www.olahungerford.com/mcp-progressive-disclosure-evals/explainer.html): a one-page recap with the charts. [`drafts/wg-findings-writeup.md`](drafts/wg-findings-writeup.md) is the long form, the text for the working group.
- [`docs/results.md`](docs/results.md): every table, the notes behind each, and the limits.
- [`docs/running.md`](docs/running.md): sources, variants, how to run the servers and the trials, the deployed Workers, the Claude Code mod.
- [`results/traces/traces-public/`](results/traces/traces-public/): the 180 redacted sessions with their own README; also attached as a zip to the [`traces-2026-11-08`](https://github.com/olaservo/mcp-progressive-disclosure-evals/releases/tag/traces-2026-11-08) release.

## Quick start

Node 24 or later.

```bash
npm ci
npm run dev        # every variant at http://localhost:8787/<variant>/mcp
npm run compare    # the token comparison against localhost
```

The four variants are also deployed, with no auth and dry-run tools, at `https://pd-groups-{flat,opt1,opt2,opt3}.olahungerford.workers.dev/mcp`. Everything else is in [`docs/running.md`](docs/running.md).

## License

Apache-2.0, see `LICENSE`. `src/vendor` carries generated tool definitions from cloudflare/mcp and skill files from cloudflare/skills, both Apache-2.0; `NOTICE` names them. The trace sessions are CC-BY-4.0 and say so in their README.
