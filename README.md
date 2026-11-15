# MCP progressive disclosure evals

Measurements of the MCP working group's draft [Groups extension](https://github.com/modelcontextprotocol/progressive-disclosure-wg/pull/19) on a large real catalog: Cloudflare's API MCP server (3,036 tools) with five of Cloudflare's published skills. One Cloudflare Worker serves the catalog flat and under each option in the [positioning document](https://github.com/modelcontextprotocol/progressive-disclosure-wg/pull/22) for Groups against Skills over MCP, so Option 2 can be run against the flat server and the three options compared on wire shape and tokens. Measured on 2026-11-07 and 2026-11-08 against #19 at `15b2a5c` and #22 at `5e9ff2f`, with a second round on 2026-11-09 that adds a server rebuilt to the guidance in #19, a held-out task set on 2026-11-10, and an agent run on four open models on 2026-11-12.

Three measurements:

1. **Tokens.** What a client reads before and after it commits to a task, per variant, at 238 and 3,036 tools.
2. **Selection.** Sixteen models and two classifier APIs pick a group, skill or tool for 20 tasks that describe a job without naming the product, and for 20 held-out tasks written by two models the demo does not test.
3. **Task completion.** A Claude Code mod that implements the extension runs the same 20 tasks as headless sessions, against the flat server behind the host's tool search and the flat server with all schemas in the prompt up front: 180 sessions in the first round, 300 in the second.

## Findings

- The flat `tools/list` for 3,036 tools is 1.38M tokens, more than any model can read. The groups list for the same catalog is 5.5k. Once the model picks a group, it reads the same tokens at either catalog size: the group's tool schemas and the skill body. Schemas are most of that once a group holds more than a handful of tools.
- Groups did not measurably change what the hosted models picked. Each hosted model scored similarly across groups and flat modes at both catalog sizes. The `skills/list` index is a control, not a finding. Adding it moved flat scores by up to 16 of 20 and six groups-mode cells by two to six.
- Option 2 lists each workflow in both `groups/list` and `skills/list`. In groups mode, five models picked the skill without its group on 2 to 4 of 20 tool tasks, a path that on a real client loads the skill's instructions without the tools the task needs.
- Templated group descriptions cost the mid-size open models up to 6 of 20 tasks at 139 groups. The SEP's guidance that descriptions carry task vocabulary is what this measures.
- Second round: a server rebuilt to the guidance in #19 (task-vocabulary descriptions and a shallow tree, here one level with a size cap of my choosing) closed the gap templated descriptions had opened. At 271 groups on the full catalog the open models scored 17 to 20 of 20, against 10 to 19 on 139 as-generated groups, and every hosted model scored 19 or 20. Its listing is 16.5k tokens, about a fifth of the tool-name list.
- Second round: with tool search off in Claude Code, registering a group's tools resident saved the fetch turn and cost 2.2 to 2.4 times as much. The host keeps tool definitions in the cached prefix, so each open rewrites it, which the SEP's prompt-caching section predicts for such clients. This round did not test appending tools after the prefix or any open model. The open-model run below does.
- Second round: leaving grouped skills out of `skills/list` for a groups client left every model within one task of its score and removed the skill-only answers; listing them as well, with the new descriptions, left 8 such answers across the 18 models.
- Held-out tasks: 20 tasks written by two models the demo does not test, from a product name alone, reproduced the second round. The recommended build scored 17 to 19 of 20 for the open models and 18 to 20 for the hosted models; the as-generated build cost five open models 3 to 14 tasks. On flat tool names the hosted models scored 18 to 20 once a lookup such as `zones_list` counted as a first call, a rule decided after the results.
- Through Claude Code on the 238-tool subset, Sonnet completed 20 of 20 tasks in every condition of both rounds, and Opus missed one, under the host's tool search in round two. In round two groups read 1.54M to 1.75M input tokens per model, the host's tool search 1.51M to 1.60M, and all schemas up front 15.9M to 17.4M. Groups took a median 5 turns on the product tasks against 3 or 4, and their scoped tools loaded through the host's tool search, so the run shows groups composed with it. The prompt cache held across group opens. Round one, with an earlier mod and the two-level tree, read 2.32M to 2.37M under groups against 1.96M to 2.22M.
- Open models, 2026-11-12: four open models ran 30 multi-turn phases through a loop of this demo's, since their endpoints have no deferred tool loading. Appending a group's tools to `tools` on open lost part of the prompt cache at every open, a median 1.5k tokens re-read at the first open and 5.4k at the fifth on DeepSeek V4.1 Flash, and cost 1.34 to 1.38 times a client that keeps a fixed tool set and reads a group's schemas as tool-result text. That client completed about as many phases (DeepSeek 90 of 90 against 87, GLM-5.3 Flash 81 against 88) and its arguments validated at least as often. All 237 schemas up front, in a session that starts cold, cost more after one phase than appended tools did after six, and 3.9 and 5.2 times as much over six. Both models' chat templates can add tools mid-session, and the Baseten endpoints exposed neither path.
- Open models, follow-up on 2026-11-13: on the full 3,036-tool catalog completion held and appending cost 1.9 to 2.4 times the fixed tool set, because both endpoints render tools ahead of the system prompt and every open re-read the 16.5k-token group listing. Putting the listing in the first tool's description brought that to 1.3 to 1.4 times. In 30-turn sessions with about 2k tokens added to each tool result, appending passed all schemas up front at turn 12 or 13 on DeepSeek V4.1 Flash and cost 1.6 times as much by turn 30, and the fixed tool set cost a third of appending. GLM-5.3 Flash's cache missed with no tool change in long sessions, so its long-session costs measure the endpoint more than the client.
- Open models, more 30-turn sessions on 2026-11-14: with six sessions per DeepSeek cell and 2k-token results, appending passed all schemas up front between turns 10 and 13 when that session started cold, and cost 1.6 times as much by turn 30. With the schemas already in the cache it cost more by turn 3 and 2.0 times as much by turn 30. The fixed tool set cost 0.38 times appending. With dry-run-sized results appending stayed below all schemas up front through 30 turns, at 0.71 times a cold session and 0.91 times one with the schemas cached.
- Option 2 of the positioning document works as written on the shipped SDK. Neither document says whether a skill a group lists stays in `skills/list`, and the SDK lists every SKILL.md in `resources/list` by default. Option 3's flattening of a SKILL.md folder into instructions drops the skill's entry, digests and the root for its relative links.

## Read more

- [The explainer page](https://www.olahungerford.com/mcp-progressive-disclosure-evals/explainer.html): a one-page recap with the charts.
- [`docs/results.md`](docs/results.md): every table, the notes behind each, and the limits.
- [`docs/running.md`](docs/running.md): sources, variants, how to run the servers and the trials, the open-model agent loop, the deployed Workers, the Claude Code mod.
- [`results/traces/traces-public/`](results/traces/traces-public/): the 180 redacted sessions with their own README; also attached as a zip to the [`traces-2026-11-08`](https://github.com/olaservo/mcp-progressive-disclosure-evals/releases/tag/traces-2026-11-08) release. [`results/traces/traces2-public/`](results/traces/traces2-public/) holds the second round's 300, attached as a zip to the [`traces-2026-11-09`](https://github.com/olaservo/mcp-progressive-disclosure-evals/releases/tag/traces-2026-11-09) release.

## Quick start

Node 24 or later.

```bash
npm ci
npm run dev        # every variant at http://localhost:8787/<variant>/mcp
npm run compare    # the token comparison against localhost
```

Three variants are also deployed, with no auth and dry-run tools, at `https://pd-groups-{flat,opt2,opt2-rec}.olahungerford.workers.dev/mcp`. `opt1` and `opt3` run locally under `npm run dev`. Everything else is in [`docs/running.md`](docs/running.md).

## License

Apache-2.0, see `LICENSE`. `src/vendor` carries generated tool definitions from cloudflare/mcp and skill files from cloudflare/skills, both Apache-2.0; `NOTICE` names them. The trace sessions are CC-BY-4.0 and say so in their README.
