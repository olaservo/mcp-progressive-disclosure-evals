# Dev journal, 2026-11-19: loading tools mid-session on open-model endpoints

Status: in progress. The DeepSeek arms on Baseten direct, the shared-tool-block runs, the 30-turn sessions and the OpenRouter and Responses probes are in. GLM is open.

## Question

The Groups deck (slide 9, 10, 17) says a host can append a group's schemas "cache-safely". The repo's open-model runs (2026-11-12 to 2026-11-15) measured a client that re-sends a longer `tools` array, and concluded that the two Baseten endpoints exposed no mid-session tool path. This round checks that conclusion.

## Terms

Three things get called "tool search", and they are separable.

- **Deferral.** A tool is declared in the request and its schema is kept out of the prompt. `defer_loading: true` on most APIs.
- **Loading.** A schema becomes visible to the model part-way through a conversation, placed after the existing context so the cached prefix still matches. `tool_reference` blocks (Anthropic, Baseten), `tool_search_output` or `additional_tools` items (OpenAI, Meta), a system message with a `tools` field (Kimi).
- **Search.** Something decides which tools to load. It can be the vendor's hosted search or the client's own logic.

Groups needs deferral and loading. It does not need search: the model names a group with `open_group` and the client already knows the group's tools. So the relevant question for each API is whether the client can choose what to load, which the vendors call client-side or client-executed tool search.

Loading is cache-safe in one direction. OpenAI's and Meta's docs both say that changing the loaded set on a later turn breaks the cache from that point.

## What ran

All through `scripts/agent-probe-deferred.ts` and `scripts/agent-run.ts`, models `zai-org/GLM-5.3-Flash` and `deepseek-ai/DeepSeek-V4.1-Flash`, both served by Baseten. Raw output is in `results/2026-11-19-agent-probe-deferred.txt`.

### Probe through the Hugging Face router

Baseten's documented Chat Completions shape (`defer_loading` beside `function`, `tool_reference` keyed by `tool_name`), sent to `router.huggingface.co` with the `:baseten` suffix.

- First turn with 24 tools deferred: 14,494 prompt tokens on DeepSeek and 14,810 on GLM, the same as with no flag.
- A `tool_reference` result added 17 to 50 tokens. No schemas loaded.
- Once the history held a call to a deferred tool, the prompt fell to about 7.5k and the model reported only `open_group` and `kv_keys_list` as callable.
- A `name`-keyed reference was accepted. The HTTP 400 of 2026-11-12 did not reproduce.

Which layer produces this is not determined. See "The router path" below.

### Probe on Baseten direct

The same script against `https://inference.baseten.co/v1`.

| Step | GLM prompt / cached | DeepSeek prompt / cached |
| :-- | :-- | :-- |
| 24 tools deferred, first turn | 7,509 / 0 | 7,013 / 0 |
| `open_group` only, first turn | 7,505 / 0 | 7,021 / 0 |
| Open kv, `tool_reference` by `tool_name` | 11,753 / 7,424 | 11,462 / 6,912 |
| Open d1, `tool_reference` by `tool_name` | 14,918 / 11,520 | 14,813 / 11,264 |
| Append kv to `tools` (arm B) | 11,748 / 0 | 11,406 / 256 |
| Append d1 to `tools` (arm B) | 14,913 / 0 | 14,702 / 4,608 |

- Deferred schemas stay out of the prompt.
- A reference loads the schemas, and everything sent before it is read from cache.
- Appending to `tools` on the same endpoint loses the cache, as it did through the router.
- A nested flag is ignored and a `name`-keyed reference returns 400, both as Baseten documents.

One conversation per model with two opens. This shows the mechanism and gives no cost figure.

### Tool results that mix text and references

Observed on Baseten direct with synthetic tools.

| Tool result content | GLM | DeepSeek |
| :-- | :-- | :-- |
| References only | Tools load | Tools load |
| References, then a text block | Tools load, text dropped (same prompt size as references only) | Tools load, text kept |
| Text block, then references | References ignored, text kept | Tools load, text kept |

With text first on GLM the model still called the tool by name without its schema.

### Arm D

`agent-run.ts --arm D` puts every group's tools (237) in `tools` with `defer_loading: true` from the first request. `open_group` answers with `tool_reference` blocks as the whole tool result. A group's instructions and listed skills follow in a user message, because of the GLM behaviour above. The client fetches every group before the session starts, which is the "fetch eagerly and surface lazily" option in the SEP's caching section. `--base-url` and `--key-env` send any arm to a provider's own endpoint, and `agent-score.ts` scores those files as `<arm> direct`.

Smoke run, DeepSeek direct, scenario `mail`, one session:

| Phase, turn | Tools in prompt | Prompt | Cached | After an open |
| :-- | :-- | :-- | :-- | :-- |
| 1, 1 | 3 | 1,784 | 0 | |
| 1, 2 | 23 | 7,612 | 1,792 | 20 tools |
| 2, 2 | 44 | 15,350 | 8,448 | 21 tools |
| 3, 2 | 49 | 18,826 | 15,872 | 5 tools |
| 4, 2 | 54 | 22,048 | 19,200 | 5 tools |
| 6, 2 | 74 | 37,752 | 23,040 | 20 tools |

Each request after an open read the whole previous prompt from cache. Both smoke sessions passed all six phases.

### GLM on Baseten direct is rate limited

Arm D on GLM returns HTTP 429 "Rate limit exceeded" on the first request, run alone, after six retries over about five minutes. Arm A with 237 resident schemas returns the same. Arm B, which starts with three tools, runs, and so does the 24-tool probe. Inferred, not confirmed: the account's limit for GLM counts the size of the `tools` array whether or not the tools are deferred. Not checked against Baseten's limits page.

### DeepSeek arms A, B, C, D on Baseten direct

Five scenarios, three samples, `--parallel 3`, cold sessions. Files `results/2026-11-20-agent-direct-{a,b,c,d}.jsonl`, summary in `results/2026-11-20-agent-summary-direct.md`. Arm C ran with the lenient wrapper. About half of all requests were retried after a 429.

| Arm | Sessions | Phases done | Valid arguments | Cost through phase 6 | Input not read from cache, through phase 6 | Median re-read after an open | Requests after an open with over half re-read |
| :-- | --: | --: | --: | --: | --: | --: | --: |
| A, 237 schemas up front | 9 complete, 6 ended in 429 | 67/67 | 98% | $0.0868 | 209.2k | no opens | |
| B, append to `tools` | 15 | 90/90 | 98% | $0.0215 | 55.7k | 3.0k (20%) | 18 of 75 |
| C, `call_tool` wrapper | 15 | 90/90 | 98% | $0.0158 | 35.8k | 90 (1%) | 0 of 77 |
| D, deferred with references | 15 | 87/90 | 98% | $0.0164 | 37.4k | 33 (0%) | 0 of 74 |

- Arm D cost 0.76 of arm B and 0.19 of arm A. It cost 1.04 of arm C.
- Arm D re-read a median of 33 tokens on the request after an open. Arm B re-read 3.0k.
- Arm D's three missed phases were in two sessions (`uploads` #2 phase 3, `migration` #2 phases 2 and 5). In `migration` #2 the model used an `r2-buckets` tool it already had and did not open `r2-super-slurper`. In `uploads` #2 it opened the right group and its calls did not satisfy the rubric. Neither is a failed load. Arm B through the router on 2026-11-13 also scored 87/90.
- Direct and router costs agree for the arms run both ways: arm A $0.0868 direct and $0.0871 through the router, arm B $0.0215 and $0.0223.
- Arm A's request is about 203k prompt tokens. Six of its 15 sessions ended in a 429 after six retries.
- Median time to first token was 1,255 ms in arm D on requests not after an open, and 529 ms in arm B. The arms ran one after another under rate limiting, so this is not a controlled comparison.

### Arms B and D with a shared tool block

The same 15 sessions with `--shared`, which leaves the session id out of the tools. Files `results/2026-11-20-agent-direct-{b,d}-shared.jsonl`. One session in each run ended in an error, so the cost rows cover 14 sessions.

| Arm | Phases done | Cost through phase 6 | Input not read from cache, through phase 6 | Median re-read after an open | Requests after an open with over half re-read |
| :-- | --: | --: | --: | --: | --: |
| B cold | 90/90 | $0.0215 | 55.7k | 3.0k (20%) | 18 of 75 |
| B shared | 88/88 | $0.0176 | 42.0k | 2.3k (15%) | 9 of 75 |
| D cold | 87/90 | $0.0164 | 37.4k | 33 (0%) | 0 of 74 |
| D shared | 86/88 | $0.0164 | 37.5k | 41 (0%) | 0 of 75 |

- Arm D cost the same shared and cold.
- Arm B shared cost 0.82 of arm B cold. Arm D cost 0.93 of arm B shared.
- Arm B shared cost $0.0176 direct and $0.0148 through the router on 2026-11-13. The router run had both models' sessions in the batch. This run had DeepSeek only.
- The first request of a session read 256 tokens from cache in both shared runs, so the saving in arm B is not on the first request. Inferred, not tested: in arm B the appended schemas sit in `tools`, ahead of the conversation, so a session reads them from the cache another session of the same scenario wrote. In arm D the loaded schemas sit inside the conversation.

### 30-turn sessions for arm D

Arm D on Baseten direct over the two chained scenarios, three samples each, with and without `--pad-results 2000`. At `--parallel 3` nine of the twelve sessions ended in HTTP 429. Those nine were run again one at a time and all completed. Files `results/2026-11-20-agent-chain30-d-direct{,-pad}.jsonl` and the four `-rerun-` files. Arms B and C are the router runs of 2026-11-14, which have four complete sessions per cell, so the cells differ in endpoint, date and session count.

| Results | Arm | Sessions | Phases done | Cost through phase 30 | Input not read from cache | Median re-read after an open | Requests after an open with over half re-read |
| :-- | :-- | --: | --: | --: | --: | --: | --: |
| Unpadded | B, router | 4 | 120/120 | $0.1331 | 272.7k | 6.6k (15%) | 4 of 79 |
| Unpadded | C, router | 4 | 120/120 | $0.1012 | 142.9k | 111 (0%) | 0 of 81 |
| Unpadded | D, direct | 6 | 178/180 | $0.0912 | 107.0k | 70 (0%) | 0 of 118 |
| Padded | B, router | 4 | 120/120 | $0.3926 | 1.03M | 34.4k (47%) | 34 of 79 |
| Padded | C, router | 4 | 119/120 | $0.1577 | 240.8k | 128 (0%) | 0 of 77 |
| Padded | D, direct | 6 | 178/180 | $0.1545 | 214.6k | 78 (0%) | 0 of 121 |

- Arm D cost 0.69 of arm B unpadded and 0.39 padded. It cost 0.90 of arm C unpadded and 0.98 padded.
- The token difference is small unpadded: 166k of about 6M input tokens. The cost ratio comes from DeepSeek's list price, where uncached input costs 43 times cached. A model with a smaller cache discount would show a smaller cost difference for the same tokens. Not measured on one.
- The append arm's uncached input grows with the conversation at each load: 66k at phase 6 and 273k at phase 30 unpadded, and 1.03M at phase 30 padded. Arm D's was 47k, 107k and 215k.
- No request after a load in arm D re-read over half the prompt, across 239 loads.
- Total input was about the same in the three arms: 6.1M to 6.7M unpadded and 10.7M to 11.1M padded.
- Median time to first token in arm D was 1.4 s unpadded and 1.8 s padded, against 0.6 to 0.8 s for arms B and C through the router. Different endpoints and days.
- Three of arm D's four missed phases are `chain-forward` phase 3. In each the model called `kv_keys_put` with `key_name` `config%3Amax_width`, and the rubric looks for `config:max_width`. The other arm D sessions and all arm B and C sessions sent the colon unencoded. The fourth miss is `chain-forward` phase 27 (`d1-api`) in one padded session, not looked at.

## The router path

Hugging Face's docs say language-model routing runs on OpenRouter. They do not say whether a request pinned with a `:provider` suffix passes through OpenRouter, and they say nothing about which fields are forwarded.

OpenRouter documents its own deferral, in a different shape from Baseten's:

- On Chat Completions the flag is `tools[].function.defer_loading`, inside `function`. Baseten ignores a flag there.
- OpenRouter lists the endpoints that defer natively as Anthropic models on four platforms and "Anthropic-compatible gateways that implement deferral". Baseten is not named.
- On any other endpoint a deferred tool is "Withheld until you re-send the tool without `defer_loading`", and revealed definitions are appended after the loaded tools. That is arm B's behaviour performed by the router.
- "Client-side deferral on endpoints without native deferral is rolling out per account. Until an account is admitted, Chat Completions and Responses send deferred tools in full with the flag removed".
- The `openrouter:tool_search` tool type is not accepted on Chat Completions. A `deferred_tools` protocol field is.

### Probe through OpenRouter, pinned to Baseten

`scripts/agent-probe-deferred.ts --base-url https://openrouter.ai/api/v1 --key-env OPENROUTER_API_KEY --provider baseten --resend`, 2026-11-20. Output in `results/2026-11-20-agent-probe-openrouter.txt`. Every response named the provider as BaseTen. GLM ran with reasoning on, because OpenRouter answered `reasoning: { enabled: false }` with "Reasoning is mandatory for this endpoint and cannot be disabled."

With the loaded tool named `open_group`, both models:

- First turn 14.5k to 14.8k prompt tokens with the flag beside `function` or inside it. The control with `open_group` alone was 7.0k to 7.5k. The deferred tools were sent in full.
- The conversation with two opens answered by `tool_reference` blocks came back at 7.5k to 7.9k, and the model said it had no D1 tool. The tools were withheld on that request.
- These are the numbers the Hugging Face router gave on 2026-11-19.

With the loaded tool named `group_search`, DeepSeek:

| Request | Prompt | Cached |
| :-- | --: | --: |
| Deferred, flag beside `function`, first turn | 7,015 | 0 |
| Deferred, flag inside `function`, first turn | 7,009 | 0 |
| After an open answered by `tool_reference` blocks | 7,064 | 6,912 |
| kv tools sent again without the flag | 11,394 | 256 |
| The same request again | 11,394 | 11,264 |
| d1 tools sent again without the flag | 14,690 | 0 |
| Control, kv tools appended to `tools` | 11,392 | 256 |
| Control, d1 tools appended to `tools` | 14,688 | 0 |

- OpenRouter withheld the deferred tools once a loaded tool had a name its docs count as a search tool. Its docs say a request without one fails with a 400 or is given `openrouter:tool_search`. Observed with `open_group`: no error, tools sent in full.
- `tool_reference` blocks loaded nothing. The model called `group_search` again.
- Sending a group's tools again without the flag loaded them. Token counts and cache reads matched the arm B control within a few tokens. Each reveal read 0 or 256 tokens from cache.
- OpenRouter's page says revealed definitions are appended "so the prompt prefix the provider caches does not move between turns". Observed on DeepSeek at Baseten: the cache was lost at each reveal, as in arm B.
- Baseten's own deferral was not reached through OpenRouter in any variant tried. The flag beside `function` is handled by OpenRouter and the references are not acted on.

Each count in the table is one request.

Five repeats per model with `group_search`, `results/2026-11-20-agent-probe-openrouter-repeats.txt`:

| Request | DeepSeek prompt | DeepSeek cached, five runs | GLM prompt | GLM cached, five runs |
| :-- | --: | :-- | --: | :-- |
| Deferred, first turn | 7.0k | 0, 0, 0, 0, 0 | 7.5k | 0, 0, 0, 0, 0 |
| After an open answered by `tool_reference` blocks | 7.1k | 6,912 five times | 7.5k | 7,424, 0, 0, 0, 7,424 |
| kv tools sent again without the flag | 11.4k | 256 five times | 11.8k | 0 five times |
| The same request again | 11.4k | 11,264 five times | 11.8k | 0, 0, 0, 11,520, 11,520 |
| d1 tools sent again without the flag | 14.7k | 4,352, 4,352, 256, 4,608, 4,352 | 14.9k | 0 five times |
| Control, kv tools appended | 11.4k | 256, 0, 256, 256, 256 | 11.8k | 0 five times |
| Control, d1 tools appended | 14.7k | 4,352, 256, 4,352, 4,352, 4,352 | 14.9k | 0 five times |

- OpenRouter withheld the deferred tools in all ten runs.
- After `tool_reference` blocks the model called `group_search` again in all ten runs.
- The reveal and the append control gave the same prompt sizes and the same cache reads on DeepSeek in every run.
- GLM ran with reasoning on, and an identical repeated request read from cache in 2 of 5 runs or fewer. Its cache numbers through OpenRouter do not separate the reveal from anything else.

### Responses API probe through OpenRouter

`scripts/agent-probe-responses.ts`, 2026-11-20. Output in `results/2026-11-20-agent-probe-responses.txt`. It sends OpenAI's two documented loading shapes to OpenRouter's Responses endpoint: a client-executed `tool_search` answered by a `tool_search_output` item, and an `additional_tools` input item. The control appends the tools to `tools`. One request per row.

| Request | `openai/gpt-6.1-terra` input / cached | `deepseek/deepseek-v4.1-flash`, Baseten, input / cached |
| :-- | --: | --: |
| First turn, repeated | 6,797 / 6,794 | 7,044 / 6,912 |
| After `tool_search_output` with kv tools | 13,480 / 0 | 15,805 / 256 |
| After `additional_tools` with kv tools | 9,560 / 6,794 | 11,495 / 256 |
| Control, kv tools appended to `tools` | 9,458 / 0 | 11,493 / 0 |
| After a second `tool_search_output`, d1 tools | 18,241 / 0 | 22,269 / 4,608 |
| After a second `additional_tools`, d1 tools | 11,430 / 0 | 14,849 / 4,608 |
| Control, d1 tools appended | 11,328 / 0 | 14,847 / 4,608 |

- Both models called the loaded tool after every load in both shapes.
- On the OpenAI model the first `additional_tools` load kept the cached prefix (6,794 of 9,560 read from cache) and the append control did not (0).
- On the OpenAI model the first `tool_search_output` load read 0 from cache. OpenAI's docs say loaded tools go at the end of the context so the cache is kept. Not explained. The request went through OpenRouter, and OpenAI has not been called directly.
- On the OpenAI model every second load read 0 from cache, in both shapes and in the control. Not explained.
- On DeepSeek at Baseten both shapes gave the control's token counts and cache reads. OpenRouter accepts the items and the result is an append to `tools`.
- These are single requests.

### Responses API probe on OpenAI's own endpoint

The same script against `https://api.openai.com/v1/responses`, `gpt-6.1-terra`, five runs, and three more runs of the OpenAI model through OpenRouter. Files `results/2026-11-20-agent-probe-responses-openai.txt` and `results/2026-11-20-agent-probe-responses-openrouter-repeats.txt`. The table gives one run's values. Every run of a column gave the same cache result, with token counts within a few tokens.

| Request | OpenAI direct, input / cached | Through OpenRouter, input / cached |
| :-- | --: | --: |
| First turn, repeated | 6.8k / 6.8k | 6.8k / 6.8k |
| After `tool_search_output`, 12 tools | 9,576 / 6,800 | 13,482 / 0 |
| The same request again | 9,576 / 9,573 | 13,482 / 13,479 |
| After a second `tool_search_output`, 12 more | 11,553 / 9,573 | 18,243 / 0 |
| After `additional_tools`, 12 tools | 9,558 / 6,792 | 9,560 / 6,794 |
| The same request again | 9,558 / 6,827 | 9,560 / 6,829 |
| After a second `additional_tools`, 12 more | 11,526 / 6,827 | 11,430 / 0 |
| Control, 12 tools appended to `tools` | 9,464 / 0 | 9,460 / 0 |
| Control, 12 more appended | 11,334 / 0 | 11,330 / 0 |

- On OpenAI direct, `tool_search_output` kept the whole earlier prompt in cache at both loads, in five of five runs. The loaded schemas were themselves cached on the next request.
- On OpenAI direct, `additional_tools` kept the prompt up to the first item in cache, in five of five runs. Nothing from the first item onward was read from cache on later requests, including an identical repeat. The second load read the same 6.8k as the first.
- On OpenAI direct the append control read 0 at every load, in five of five runs.
- Through OpenRouter the `tool_search_output` request was 3.9k tokens larger than direct and read 0 from cache at both loads, in three of three runs. The repeat was fully cached. OpenRouter does not pass this item through to OpenAI unchanged.
- Through OpenRouter the first `additional_tools` load matched direct. The second was 96 tokens smaller than direct and read 0, in three of three runs.
- The two zeros noted above as unexplained came from OpenRouter.
- A `tool_search_output` item with no `tool_search_call` before it returns HTTP 400 "No tool call found for tool search output with call_id call_9." on OpenAI, with or without `tool_search` in `tools` (`--orphan`, one run). `additional_tools` needs no preceding call.

### Minimal reproduction

`scripts/repro-deferred-loading.mjs`, no dependencies. One loaded tool and one deferred tool of about 3k tokens, DeepSeek, five requests to Baseten direct and five to OpenRouter pinned to Baseten. Three runs in `results/2026-11-20-repro-deferred-loading.txt`, all with the same result: after a tool result of `tool_reference`, Baseten direct gave 7,486 prompt / 3,840 cached and called the tool, and OpenRouter gave 3,909 / 3,840 and called `group_search` again. Re-sending the tool without the flag read 0 or 256 on both. With the tool not deferred the first turn was 7.4k against 3.9k deferred, on both.

A first version put the run id in the system prompt only. The tool block renders ahead of the system prompt, so a later run read the tool block from the cache an earlier run wrote. The id is now in the first tool's description and differs per endpoint. Adding the undeferred baseline request with the same id had the same effect on request 4, so the baseline has its own id. The script's stated floor is Node 22, at the user's request. Node 22 ends on 2027-04-30 (nodejs/Release `schedule.json`, read 2026-11-21). It has not been run on Node 22.

## 2026-11-21: Gemini, Anthropic, and more OpenRouter routes

Each probe puts a run id in the first tool's description. Token counts below are from one run, and every run of a column gave the same cache result unless a line says otherwise.

### Gemini Interactions API

`scripts/agent-probe-gemini.ts`, `gemini-4-hydrogen`, three runs, output `results/2026-11-21-agent-probe-gemini.txt`. Stateless requests (`store: false`) carry the whole history and echo model steps as received. The loop is model-driven. Total input / cached:

| Request | Client `tool_search`, schemas in a `function_result` | Control, appended to `tools` |
| :-- | --: | --: |
| First turn | 9,183 / 0 | 9,193 / 0 |
| After loading kv | 13,503 / 9,184 | 13,386 / 0 |
| After loading d1 | 16,898 / 13,741 | 16,693 / 0 |

- The client-executed load read the whole previous request from cache at both loads. The control read 0.
- An identical repeat read all but 2,049 tokens. Google's caching page says Gemini 4 caches the full previous request only if the new one adds at least 2,050 tokens.
- Server-executed `tool_search` over the same tools with `defer_loading` added about 10.3k `total_tool_use_tokens` on each request that searched. Its cached counts exceeded total input, so they appear to include the search's own model call, and are not compared here.
- Gemini returned HTTP 400 on `$ref` into `$defs` inside a `function_result`, so the script inlines references.

### Anthropic Messages, direct and through OpenRouter

`scripts/agent-probe-anthropic.ts`, `claude-haiku-5-5`, three runs on Anthropic's endpoint and three through OpenRouter's Messages endpoint pinned to Anthropic, output `results/2026-11-21-agent-probe-anthropic.txt`. 24 tools with `defer_loading`, top-level automatic caching on every request, thinking disabled. Cache write / cache read, Anthropic direct:

| Request | `tool_reference` in a tool result | `tool_addition` system message | Control, appended to `tools` |
| :-- | --: | --: | --: |
| First turn | 8,199 / 0 | 8,189 / 0 | 8,098 / 0 |
| After loading kv | 7,008 / 8,199 | 7,051 / 8,189 | 15,106 / 0 |
| The same request again | 0 / 15,207 | 0 / 15,240 | 0 / 15,106 |
| After loading d1 | 5,045 / 15,207 | 5,088 / 15,240 | 20,151 / 0 |

- Both loading forms read the whole earlier prompt from cache, and the model called the loaded tool, in six of six runs. The control read 0.
- `tool_addition` used beta `mid-conversation-tool-changes-2026-07-01`, which takes references only. Anthropic now prefers `inline-tools-2026-09-15`, which also takes full definitions. Not tried.
- OpenRouter's Messages endpoint gave the same counts within about 20 tokens.
- 24 deferred tools added about 100 tokens to the first turn.

### OpenRouter Chat Completions to Anthropic

`scripts/agent-probe-deferred.ts --models anthropic/claude-haiku-5.5 --provider anthropic --open-name group_search --resend --cache-control`, three runs, output `results/2026-11-21-agent-probe-openrouter-anthropic-chat.txt`. `--cache-control` is new and adds top-level `cache_control`.

- Deferral is passed through: 8,199 prompt tokens with 24 deferred tools against 8,110 without them.
- After a tool result of `tool_reference` blocks the prompt grew 56 tokens (8,255 / 8,195 cached) and the model called `group_search` again or nothing, in three of three runs. After the second it called `d1_database_list`, which does not exist, in three of three. OpenRouter documents `tool_reference` for Messages only.
- Re-sending the tools without the flag read 0 at both loads, as did the append control.

### OpenRouter Messages to Baseten

`scripts/agent-probe-anthropic.ts --target openrouter --provider baseten --model deepseek/deepseek-v4.1-flash --open-name group_search --arms reference,control`, three runs, output `results/2026-11-21-agent-probe-openrouter-messages-baseten.txt`. With the loaded tool named `open_group` OpenRouter returned 400 asking for a search-named tool.

- After a tool result of references the model called `kv_keys_list` in three of three runs, and the request read 0 or 256 from cache. The control read 0 or 256.
- Totals (uncached input plus cache read) were about 11.5k at the first load and 14.7k to 14.9k at the second, in both arms. Two runs, one per arm, read 4.4k to 4.6k at the second load.

### OpenRouter `deferred_tools`

`scripts/agent-probe-openrouter-deferred.ts`, output `results/2026-11-21-agent-probe-openrouter-deferred-tools.txt`. A Chat Completions request with `deferred_tools` (`protocol: "v1"`, `profile: "portable"`, `validation: "runtime"`, search `{ type: "custom", tool_id: "group_search", result_key: "tools" }`) returned HTTP 403 "Deferred-tool protocol is unavailable for this workspace" for DeepSeek at Baseten and Haiku at Anthropic. OpenRouter's page says client-side deferral is rolling out per account.

## What the vendors document

Read 2026-11-19. "Verified" means the quoted wording was found by exact match in the page's raw text. Baseten's API was tested here first. OpenAI's, Google's and Anthropic's were tested later (see above).

| Vendor | API surface | Client chooses what loads | Cache statement | Verified |
| :-- | :-- | :-- | :-- | :-- |
| Anthropic | Messages | Yes, `tool_reference` in a tool result | The caching page covers "how `defer_loading` preserves your cache" | Yes |
| OpenAI | Responses. "Only `gpt-5.4` and later models support `tool_search`." Astra and 6.1 Sol "require the Responses API for tool calling" | Yes, client execution or an `additional_tools` item | "tool search is designed to preserve the model's cache"; "changing the loaded tool set will break the model's cache from that point forward" | Yes |
| Google Gemini | "Tool retrieval is supported on the Interactions API only." Models listed: `gemini-4-hydrogen`, `gemini-4-argon`, `gemini-3.8-flash`, `gemini-3.6-flash`. `gemini-4-carbon` is not on the page | Yes, client mode | "Tool retrieval works with implicit caching"; "Retrieved schemas are added to the conversation where the model loads them, not to the start of the prompt" | Yes |
| Meta | Tool search "runs on the Responses and Messages APIs only" | Yes | "the API appends it at the end of the context, preserving the cache prefix from earlier turns" | Yes |
| Kimi | Chat Completions, "currently supported only on `kimi-k3.1-pro` and `kimi-k3`" | Client only: a system message with a `tools` field | "the existing conversation prefix stays unchanged, so dynamic loading does not break the prefix cache" | Yes |
| Baseten | Chat Completions, Messages, Responses, per-model table | Yes | Tested above | Yes, and tested |
| Fireworks | Anthropic-compatible Messages | Yes, `tool_reference` expanded inline | Not stated | Yes |
| OpenRouter | All three, see above | Yes | "prompt caching is preserved across a search" | Yes |
| xAI | Nothing in the docs index or the function-calling page. "max 350 tools per request" | | | Yes, absence by search |
| DeepInfra, Together, Groq, Cerebras, Nebius | No hits for `defer_loading`, `tool_reference`, `tool_search`, `additional_tools` in each `llms-full.txt` | | | Yes, absence by search |
| Bedrock Converse | Nothing found. "modifying `tools` invalidates the `system` and `messages` caches" | | | Yes |
| Bedrock Mantle | Claude on Messages: "Server-side tool use (tool search only; regex and BM25)" on the Opus 5.5 card. Nothing found for the OpenAI-compatible APIs | Not established | | Card quote yes; the rest is one subagent's reading |

Not verified by exact match: SambaNova (docs export returned 404), Vertex AI (page partly read), DeepInfra's "only functions are supported as a tool" (the API reference has "only function is supported currently" on the tool-call type).

Baseten's list prices match `agent-score.ts`: GLM-5.3-Flash $0.15 / $0.03 cached / $0.50, DeepSeek V4.1 Flash $0.30 / $0.007 cached / $1.20.

## Standards work

Reported by the `standardize-tool-search-caching` session on 2026-11-20, with its later corrections applied. Not re-checked here. Its notes are in `C:/Users/johnn/OneDrive/Documents/everything/_mcp/pd/Standardization status of tool deferral and loading.md`.

As of 2026-11-20 no AAIF project or MCP proposal standardizes deferral, loading or gateway forwarding.

- Searched: local clones of A2A (`5f931b8a`), agents.md, openresponses (`dce9ddb`, spec 2026-04-24), technical-committee, aaif-landscape and the five WG repos, and GitHub issues and PRs on `openresponses/openresponses` and `modelcontextprotocol/modelcontextprotocol`. Not searched: Agent Router, agentgateway, OpenEnv, OpenSandbox, Open Responses discussions, any effort outside AAIF.
- Open Responses covers the Responses API only. Its OpenAPI has no `defer_loading`, `tool_search`, `tool_search_output` or namespace types. PR #73, OpenAI's sync of more Responses API features (closed 2026-05-26), did not add them.
- Its only tool-related cache control is `allowed_tools`, described as "primarily a cache-preserving control surface". It keeps every schema in context and limits which tools can be called.
- openresponses #89 adds a `configuration_update` input item that changes reasoning effort mid-conversation "without changing the original request configuration and its cacheable prefix". A loading item could follow the same pattern.
- openresponses #76 and PR #94 (open) require that a mid-conversation developer or system message not bust the cache. The acceptance test is `cached_tokens > 0` on the second call with a shared `prompt_cache_key`. A deferred-loading test could reuse it.
- The spec says nothing about what an intermediary must pass through. Its extension rules ask for a slug prefix on implementor fields and items.
- Open Responses has no input item that carries tool definitions. `ItemParam` is the union of assistant, developer, system and user messages, function call, function call output, item reference, reasoning and compaction summary. Tools exist only in top-level `tools` and in `tool_choice`. #89's `configuration_update` would be the first input item that changes configuration.
- The #76 test: two calls share a `prompt_cache_key`. The second appends a developer or system message after the cached prefix and must report `usage.input_tokens_details.cached_tokens > 0`. Draft PR #94 (`8259402f`) adds a `cachedTokensGreaterThanZero` validator and case ids of the form `mid-conversation-<role>-cache`.
- Responses endpoints on open-model providers, per agentgateway's 1.7.x provider table and not tested: native on Groq, Hugging Face, OpenRouter, Fireworks, Meta, Ollama, xAI and Perplexity. Through agentgateway translation only on Baseten, Cerebras, DeepInfra, DeepSeek, Mistral and Together.
- agentgateway (AAIF, `cec2c4ee`) has a golden test, `crates/llm/src/tests/requests/messages/tool_reference.completions.snap`, that translates a Messages request to Chat Completions. The deferred tool's flag is dropped and the full schema is sent. The `tool_reference` block becomes a text part. Not run.
- The Decoder reported on 2026-11-18 that Hugging Face Inference Providers "now routes language model requests through OpenRouter", citing `huggingface.co/blog/openrouter`. The blog post has not been read here.
- No Baseten statement on gateways forwarding its deferral was found.
- MCP #3430 (open, updated 2026-11-15) asks for server-level routing metadata under deferred loading. A comment there reports replay data in which every failed trial was the model deciding not to search. SEP-1821 (`tools/list` query parameter) was closed when SEPs moved to PRs. SEP-1300 (groups and tags filtering) closed 2025-12-01, superseded by Groups WG discussion #1567, which is now closed.
- Open Responses' `CONTRIBUTING` file sets out a proposal process. Open an issue titled "Proposal: <short name>" with the problem, proposed spec text or API shape, compatibility impact, a reference implementation and a test or conformance plan. After feedback, open a PR against the TypeSpec contract under `schema/`, with DCO sign-off. Decisions go by consensus, then a vote of the nine-maintainer TSC: OpenAI (two), Databricks, Amazon, Hugging Face (two), Ollama, OpenRouter, Ramp. Anthropic and Google are not members. OpenRouter and Hugging Face are, and theirs are the two routers where Baseten's shape did not get through.

## Corrections to earlier statements

- `docs/results.md:347-349`, README row 8 and the "appending tools" finding say the endpoints exposed neither template path. The probe behind that went through the Hugging Face router with the chat templates' shape. Baseten documents the feature in another shape and it works direct.
- README row 9's premise, "endpoints with no mid-session tool mechanism", does not hold for Baseten direct.
- Said in this session and wrong: that OpenRouter's tool search returns a 400 on Chat Completions. Only the `openrouter:tool_search` tool type does. OpenRouter documents deferral on Chat Completions through `function.defer_loading` and `deferred_tools`.
- Deck slide 6 lists Gemini as missing native tool search, and its notes add Kimi. Both now document a mechanism. Bedrock Converse still has none in AWS's docs.
- Deck slide 9's "mid-turn additional_tools" is OpenAI's Responses API. It is not available on Chat Completions.

## Where the harness still differs from the slides

- `tools/list` is empty for a groups client (`src/variants.ts:188`), so there are no core tools. Slide 9 keeps core tools in `tools/list`.
- The Claude Code groups conditions take two hops, `open_group` then ToolSearch. The slides claim one.
- Arm B uses none of the SEP's mitigations: batching, deferring to a boundary, unloading.
- The repo reads PR #19 at `15b2a5c`. The head is `dbbb549`. Not diffed.

## Open items

- [x] Fill in the DeepSeek direct results above
- [ ] Re-run the six arm A direct sessions that ended in 429 (`--only-samples`, lower `--parallel`)
- [x] Arm D with `--shared`, against arm B shared
- [ ] GLM arm D and arm A on Baseten direct, once the rate limit is understood or raised
- [x] OpenRouter direct probe with its own shape, provider pinned to Baseten
- [x] OpenRouter's `deferred_tools` protocol field: 403 for this workspace
- [x] Gemini Interactions API and Anthropic Messages, direct and through OpenRouter
- [ ] Anthropic `tool_addition` with full definitions under `inline-tools-2026-09-15`
- [ ] Run `repro-deferred-loading.mjs` on Node 22
- [x] Repeats of the OpenRouter probe on both models with `group_search`
- [x] Repeats of the Responses probe, and the OpenAI model on OpenAI's own endpoint
- [x] Draft report to OpenRouter: `docs/draft-openrouter-baseten-report.md`, not posted. Revised after review by the `standardize-tool-search-caching` session.
- [x] Draft question to Baseten on mixed tool results: `docs/draft-baseten-glm-question.md`, not posted
- [x] Draft Open Responses proposal: `docs/draft-open-responses-proposal.md`, not posted
- [x] 30-turn chained sessions for arm D, with and without padded results
- [ ] A frontier arm on a Responses API with client-executed tool search, if the deck keeps the `additional_tools` claim
- [ ] Reword README and `docs/results.md` per "Corrections"
- [ ] Add core tools to `opt2-rec`
- [ ] Diff PR #19 `15b2a5c` against `dbbb549`

## Files this round

`repro-deferred-loading.mjs` and its output went in at `863be72`. The deferred, Responses and Gemini probes and their output went in at `293ccfa`.

- `scripts/agent-probe-deferred.ts`, new, with `--provider`, `--open-name`, `--resend`, `--keep-reasoning` for OpenRouter, and `--cache-control` added 2026-11-21
- `scripts/agent-probe-gemini.ts` and `results/2026-11-21-agent-probe-gemini.txt`, new
- `scripts/agent-probe-anthropic.ts`, new, with `--target`, `--provider`, `--open-name`, `--arms`
- `scripts/agent-probe-openrouter-deferred.ts`, new
- `results/2026-11-21-agent-probe-anthropic.txt`, `results/2026-11-21-agent-probe-openrouter-anthropic-chat.txt`, `results/2026-11-21-agent-probe-openrouter-messages-baseten.txt` and `results/2026-11-21-agent-probe-openrouter-deferred-tools.txt`, new
- `scripts/agent-run.ts`, arm D, `--base-url`, `--key-env`
- `scripts/agent-score.ts`, `direct` arm suffix
- `results/2026-11-19-agent-probe-deferred.txt`, new
- `results/2026-11-20-agent-smoke-d-direct.jsonl`, new. Its two GLM sessions are the 429 errors.
- `results/2026-11-20-agent-direct-{a,b,c,d}.jsonl` and `results/2026-11-20-agent-summary-direct.md`, new
- `results/2026-11-20-agent-direct-{b,d}-shared.jsonl`, new
- `results/2026-11-20-agent-chain30-d-direct{,-pad}.jsonl` and their `-rerun-fwd` and `-rerun-rev` files, new
- `results/2026-11-20-agent-probe-openrouter.txt` and `results/2026-11-20-agent-probe-openrouter-repeats.txt`, new
- `scripts/agent-probe-responses.ts` and `results/2026-11-20-agent-probe-responses{,-openai,-openrouter-repeats}.txt`, new
- `docs/draft-openrouter-baseten-report.md`, `docs/draft-baseten-glm-question.md` and `docs/draft-open-responses-proposal.md`, new
- `scripts/repro-deferred-loading.mjs` and `results/2026-11-20-repro-deferred-loading.txt`, new

## Sources

- https://docs.baseten.co/inference/model-apis/deferred-tool-loading
- https://www.baseten.co/pricing/
- https://huggingface.co/docs/inference-providers/routing
- https://huggingface.co/docs/inference-providers/index
- https://huggingface.co/docs/inference-providers/prompt-caching
- https://openrouter.ai/docs/guides/features/server-tools/tool-search
- https://developers.openai.com/api/docs/guides/tools-tool-search
- https://developers.openai.com/api/docs/guides/function-calling
- https://developers.openai.com/api/docs/guides/prompt-caching
- https://aistudio.google.com/docs/tool-retrieval
- https://docs.x.ai/developers/tools/function-calling
- https://dev.meta.ai/docs/tool-calling
- https://dev.meta.ai/docs/models
- https://platform.kimi.ai/docs/guide/use-dynamic-tool-loading
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-use-with-prompt-caching
- https://platform.claude.com/docs/en/build-with-claude/mid-conversation-system-messages
- https://aistudio.google.com/docs/caching
- https://blog.google/innovation-and-ai/technology/developers-tools/gemini-api-tool-retrieval/
- https://docs.fireworks.ai/tools-sdks/anthropic-compatibility
- https://docs.deepinfra.com/llms-full.txt
- https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html
- https://docs.aws.amazon.com/bedrock/latest/userguide/endpoints.html
- https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-opus-5-5.html
