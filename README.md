# MCP progressive disclosure evals

Measurements of the MCP working group's draft [Groups extension](https://github.com/modelcontextprotocol/progressive-disclosure-wg/pull/19) on a large real catalog: Cloudflare's API MCP server (3,036 tools) with five of Cloudflare's published skills. One Cloudflare Worker serves the catalog flat and under each option in the [positioning document](https://github.com/modelcontextprotocol/progressive-disclosure-wg/pull/22) for Groups against Skills over MCP. Measured from 2026-11-07 to 2026-11-14 against #19 at `15b2a5c` and #22 at `5e9ff2f`.

## TL;DR

- Groups shrink what a model reads before it starts a task. For Cloudflare's 3,036 tools that is 1.38M tokens as a flat list and 5.5k to 16.5k as a list of groups.
- Groups made no measurable difference to which tool the hosted models picked. The smaller open models picked well once the group descriptions used the words a user would use.
- In Claude Code, on a 237-tool subset, the built-in tool search finished the same tasks as groups in one fewer turn, for about the same tokens. What groups add is that the server ships tools together with their instructions and skill.
- On two open-model endpoints on Baseten, adding a group's tools to the request partway through a session lost part of the prompt cache each time. In 30-turn sessions on DeepSeek V4.1 Flash with 2k-token tool results, that cost more than loading every tool up front by turn 10 to 13. With very small results it stayed cheaper.
- A client can keep its tool list fixed and read a group's schemas as plain tool-result text. On the Baseten endpoints that kept the cache and finished about as many tasks, and on DeepSeek it cost 40% to 80% of what adding tools cost. On two DeepInfra endpoints, where the cache does not change the bill, it cost about the same for Qwen3.6 and about 1.5 times as much for Gemma.

## What was measured

1. **Tokens.** What a client reads before and after it commits to a task, per variant, on the subset and on the full 3,036 tools.
2. **Selection.** Sixteen models and two classifier APIs pick a group, skill or tool for 20 tasks that describe a job without naming the product, and for 20 held-out tasks written by two models the repository does not test.
3. **Task completion in Claude Code.** A mod that implements the extension runs the same 20 tasks as headless sessions, against the flat server behind the host's tool search and the flat server with all schemas in the prompt: 180 sessions in the first round, 300 in the second.
4. **Open-model agent runs.** Four open models run six-turn and 30-turn sessions through a loop in this repository under three client designs: every schema up front, a group's tools appended to `tools` when it opens, and a fixed tool set that reads schemas as tool-result text.

The subset is 237 Cloudflare tools from 10 products. Counts of 238 include a `demo_info` tool that the first round's servers listed.

## Findings

- **Tokens.** The flat `tools/list` for 3,036 tools is 1.38M tokens, more than any model can read. The groups list is 5.5k tokens for 139 generated groups and 16.5k for 271 groups with rewritten descriptions. What the model reads after it picks a group is the same at either catalog size: the group's tool schemas and the skill body.
- **Selection, hosted models.** Groups did not measurably change what the ten hosted models picked. Each scored 16 to 20 of 20 in every groups arm on both task sets and 17 to 20 on flat tool names, counting a lookup such as `zones_list` as a first call on the held-out set. These task sets cannot detect a small difference.
- **Selection, open models.** Templated group descriptions cost the open models. On the full catalog they scored 10 to 19 of 20 on 139 generated groups and 17 to 20 on 271 groups whose descriptions carry task vocabulary, which is the guidance in #19. On the held-out tasks five of the six lost 3 to 14 tasks to the templated descriptions. The held-out rules forbid the product name, so that gap is partly by construction.
- **Duplicate listing.** Option 2 lists each workflow in both `groups/list` and `skills/list`. Shown both, models answered with the skill alone on up to 4 of 20 tool tasks, a path that on a real client loads the skill's instructions without the tools the task needs. Leaving grouped skills out of `skills/list` for a groups client took those answers to 0 and left every model within one task of its score.
- **Claude Code.** Sonnet completed 20 of 20 tasks in every condition of both rounds, and Opus missed one. In round two groups read 1.54M to 1.75M input tokens per model, the host's tool search 1.51M to 1.60M, and all schemas up front 15.9M to 17.4M. Groups took a median 5 turns on the product tasks against 3 or 4. The groups arm loaded its scoped tools through the host's tool search, so it shows the two composed. With tool search off, each group open rewrote the cached prefix and the run cost 2.2 to 2.4 times as much.
- **Open models, appending tools.** Both Baseten models' chat templates can add tools mid-session, and the endpoints exposed neither path, so an appending client re-sends a longer `tools` array. Each open then re-read what followed the tool block, and the re-read grew with the session. Over six turns appending cost 1.34 to 1.38 times the fixed tool set on the subset and 1.9 to 2.4 times on the full catalog, where every open re-read the 16.5k-token group listing. Putting the listing in the first tool's description brought that to 1.3 to 1.4 times.
- **Open models, 30 turns.** On DeepSeek V4.1 Flash, six sessions per cell, with 2k-token tool results: appending passed all schemas up front between turns 10 and 13 when that session started cold, and by turn 3 when the schemas were already cached. It cost 1.6 and 2.0 times as much by turn 30. With dry-run-sized results it stayed below, at 0.71 and 0.91 times. GLM-5.3 Flash's cache missed with no tool change in long sessions, so its cells measure the endpoint more than the client.
- **Open models, fixed tool set.** It kept the cache across opens on both Baseten endpoints. It completed about as many turns as appending: DeepSeek 90 of 90 against 87, Qwen3.6 84 against 85, Gemma 64 against 49, and GLM 81 against 88, or 85 once the loop accepted a misplaced tool name. Its arguments validated at least as often. On DeepSeek it cost 0.38 to 0.78 times appending. On DeepInfra, where the cache does not change the bill, it sent more input tokens and cost 0.96 times appending for Qwen3.6 and 1.55 times for Gemma.
- **Spec gaps.** Option 2 of the positioning document works as written on the shipped SDK. Neither document says whether a skill a group lists stays in `skills/list`, and the SDK lists every SKILL.md in `resources/list` by default. Option 3's flattening of a SKILL.md folder into instructions drops the skill's entry, digests and the root for its relative links.

Limits: one vendor's catalog, dry-run tools, tasks that need one or two tools, one sample per selection task, Claude models only in Claude Code, and a 30-turn result from one model on one provider. The full list is in [`docs/results.md`](docs/results.md#limits).

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
