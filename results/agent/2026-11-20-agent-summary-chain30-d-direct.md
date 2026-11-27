Agent runs: 6 files, 12 sessions, 1621 requests. A phase is done when its rubric in agent-tasks.ts holds over the calls the server accepted during it. A full task is a session's first 3 or all 6 phases done. Arguments are valid when they pass the tool's published input schema; rejected calls are those the server answered with an error.

| Model | Arm | Sessions | Errors | Phases done | Full task, 3 phases | Full task, every phase | Median requests | Group opens per session | Server tool calls | Valid arguments | Rejected by server |
| :-- | :-- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: |
| DeepSeek-V4.1-Flash | D direct | 6 | 0 | 178/180 | 4/6 | 4/6 | 94 | 19.67 | 289 | 98% | 0% |
| DeepSeek-V4.1-Flash | D pad 2000 direct | 6 | 0 | 178/180 | 5/6 | 4/6 | 89 | 20.33 | 289 | 98% | 0% |

Cumulative cost in USD at list price through each phase, mean over the sessions that ran all 30 phases:

| Model | Arm | Sessions | Phase 6 | Phase 12 | Phase 18 | Phase 24 | Phase 30 |
| :-- | :-- | --: | --: | --: | --: | --: | --: |
| DeepSeek-V4.1-Flash | D direct | 6 | 0.0206 | 0.0373 | 0.0541 | 0.0742 | 0.0912 |
| DeepSeek-V4.1-Flash | D pad 2000 direct | 6 | 0.0295 | 0.0561 | 0.0850 | 0.1202 | 0.1545 |

Cumulative input tokens through each phase, mean over the sessions that ran all 30 phases:

| Model | Arm | Sessions | Phase 6 | Phase 12 | Phase 18 | Phase 24 | Phase 30 |
| :-- | :-- | --: | --: | --: | --: | --: | --: |
| DeepSeek-V4.1-Flash | D direct | 6 | 524.0k | 1.65M | 3.03M | 4.77M | 6.52M |
| DeepSeek-V4.1-Flash | D pad 2000 direct | 6 | 780.5k | 2.50M | 4.77M | 7.81M | 11.06M |

Cumulative input tokens not read from cache through each phase, mean over the sessions that ran all 30 phases:

| Model | Arm | Sessions | Phase 6 | Phase 12 | Phase 18 | Phase 24 | Phase 30 |
| :-- | :-- | --: | --: | --: | --: | --: | --: |
| DeepSeek-V4.1-Flash | D direct | 6 | 47.2k | 67.9k | 83.6k | 101.4k | 107.0k |
| DeepSeek-V4.1-Flash | D pad 2000 direct | 6 | 71.8k | 112.4k | 148.1k | 185.9k | 214.6k |

Where arm B's cumulative cost passes arm A's. A pair is an arm B session and the arm A session of the same model, scenario and sample. Its phase is the first from which arm B stays above arm A.

| Model | Arm B | Arm A | Pairs | Phase, per pair | Arm B cost over arm A's at phase 30, paired sessions |
| :-- | :-- | :-- | --: | :-- | --: |

The request after a group open against a session's other requests. Re-read tokens are the part of the previous request's prompt not served from cache. The first request of a session is left out.

| Model | Arm | Requests after an open | Median re-read tokens | Median re-read share | Requests with over half re-read | Median first token ms | Other requests | Median re-read tokens | Median re-read share | Requests with over half re-read | Median first token ms |
| :-- | :-- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: |
| DeepSeek-V4.1-Flash | D direct | 118 | 70 | 0% | 0 | 1413 | 425 | 0 | 0% | 0 | 1393 |
| DeepSeek-V4.1-Flash | D pad 2000 direct | 121 | 78 | 0% | 0 | 1710 | 412 | 0 | 0% | 0 | 1805 |

Phases done, by scenario and phase:

| Scenario | Phase | Groups | DeepSeek-V4.1-Flash D direct | DeepSeek-V4.1-Flash D pad 2000 direct |
| :-- | --: | :-- | --: | --: |
| chain-forward | 1 | r2-buckets | 3/3 | 3/3 |
| chain-forward | 2 | queues-api | 3/3 | 3/3 |
| chain-forward | 3 | kv-api | 1/3 | 2/3 |
| chain-forward | 4 | workers-secrets | 3/3 | 3/3 |
| chain-forward | 5 | r2-buckets | 3/3 | 3/3 |
| chain-forward | 6 | workers-core | 3/3 | 3/3 |
| chain-forward | 7 | d1-api | 3/3 | 3/3 |
| chain-forward | 8 | workers-routes | 3/3 | 3/3 |
| chain-forward | 9 | workers-domains | 3/3 | 3/3 |
| chain-forward | 10 | turnstile-api | 3/3 | 3/3 |
| chain-forward | 11 | d1-api | 3/3 | 3/3 |
| chain-forward | 12 | workers-deployments | 3/3 | 3/3 |
| chain-forward | 13 | containers-api | 3/3 | 3/3 |
| chain-forward | 14 | r2-buckets | 3/3 | 3/3 |
| chain-forward | 15 | kv-api | 3/3 | 3/3 |
| chain-forward | 16 | queues-api | 3/3 | 3/3 |
| chain-forward | 17 | containers-api | 3/3 | 3/3 |
| chain-forward | 18 | durable-objects-api | 3/3 | 3/3 |
| chain-forward | 19 | email-routing-api | 3/3 | 3/3 |
| chain-forward | 20 | email-sending-api | 3/3 | 3/3 |
| chain-forward | 21 | workers-secrets | 3/3 | 3/3 |
| chain-forward | 22 | r2-objects | 3/3 | 3/3 |
| chain-forward | 23 | email-routing-api | 3/3 | 3/3 |
| chain-forward | 24 | workers-core | 3/3 | 3/3 |
| chain-forward | 25 | r2-buckets | 3/3 | 3/3 |
| chain-forward | 26 | r2-super-slurper | 3/3 | 3/3 |
| chain-forward | 27 | d1-api | 3/3 | 2/3 |
| chain-forward | 28 | kv-api | 3/3 | 3/3 |
| chain-forward | 29 | r2-super-slurper | 3/3 | 3/3 |
| chain-forward | 30 | workers-legacy | 3/3 | 3/3 |
| chain-reverse | 1 | r2-buckets | 3/3 | 3/3 |
| chain-reverse | 2 | r2-super-slurper | 3/3 | 3/3 |
| chain-reverse | 3 | d1-api | 3/3 | 3/3 |
| chain-reverse | 4 | kv-api | 3/3 | 3/3 |
| chain-reverse | 5 | r2-super-slurper | 3/3 | 3/3 |
| chain-reverse | 6 | workers-legacy | 3/3 | 3/3 |
| chain-reverse | 7 | email-routing-api | 3/3 | 3/3 |
| chain-reverse | 8 | email-sending-api | 3/3 | 3/3 |
| chain-reverse | 9 | workers-secrets | 3/3 | 3/3 |
| chain-reverse | 10 | r2-objects | 3/3 | 3/3 |
| chain-reverse | 11 | email-routing-api | 3/3 | 3/3 |
| chain-reverse | 12 | workers-core | 3/3 | 3/3 |
| chain-reverse | 13 | containers-api | 3/3 | 3/3 |
| chain-reverse | 14 | r2-buckets | 3/3 | 3/3 |
| chain-reverse | 15 | kv-api | 3/3 | 3/3 |
| chain-reverse | 16 | queues-api | 3/3 | 3/3 |
| chain-reverse | 17 | containers-api | 3/3 | 3/3 |
| chain-reverse | 18 | durable-objects-api | 3/3 | 3/3 |
| chain-reverse | 19 | d1-api | 3/3 | 3/3 |
| chain-reverse | 20 | workers-routes | 3/3 | 3/3 |
| chain-reverse | 21 | workers-domains | 3/3 | 3/3 |
| chain-reverse | 22 | turnstile-api | 3/3 | 3/3 |
| chain-reverse | 23 | d1-api | 3/3 | 3/3 |
| chain-reverse | 24 | workers-deployments | 3/3 | 3/3 |
| chain-reverse | 25 | r2-buckets | 3/3 | 3/3 |
| chain-reverse | 26 | queues-api | 3/3 | 3/3 |
| chain-reverse | 27 | kv-api | 3/3 | 3/3 |
| chain-reverse | 28 | workers-secrets | 3/3 | 3/3 |
| chain-reverse | 29 | r2-buckets | 3/3 | 3/3 |
| chain-reverse | 30 | workers-core | 3/3 | 3/3 |

Sessions that ended in an error:
- DeepSeek-V4.1-Flash D pad 2000 direct chain-forward #1: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 429 {"error":{"message":"Rate limit exceeded","type":"rate_limit_error","param":null,"code":"rate_limit_exceeded"}}
- DeepSeek-V4.1-Flash D pad 2000 direct chain-forward #3: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 429 {"error":{"message":"Rate limit exceeded","type":"rate_limit_error","param":null,"code":"rate_limit_exceeded"}}
- DeepSeek-V4.1-Flash D pad 2000 direct chain-forward #2: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 429 {"error":{"message":"Rate limit exceeded","type":"rate_limit_error","param":null,"code":"rate_limit_exceeded"}}
- DeepSeek-V4.1-Flash D pad 2000 direct chain-reverse #1: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 429 {"error":{"message":"Rate limit exceeded","type":"rate_limit_error","param":null,"code":"rate_limit_exceeded"}}
- DeepSeek-V4.1-Flash D pad 2000 direct chain-reverse #3: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 429 {"error":{"message":"Rate limit exceeded","type":"rate_limit_error","param":null,"code":"rate_limit_exceeded"}}
- DeepSeek-V4.1-Flash D direct chain-forward #1: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 429 {"error":{"message":"Rate limit exceeded","type":"rate_limit_error","param":null,"code":"rate_limit_exceeded"}}
- DeepSeek-V4.1-Flash D direct chain-forward #2: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 429 {"error":{"message":"Rate limit exceeded","type":"rate_limit_error","param":null,"code":"rate_limit_exceeded"}}
- DeepSeek-V4.1-Flash D direct chain-forward #3: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 429 {"error":{"message":"Rate limit exceeded","type":"rate_limit_error","param":null,"code":"rate_limit_exceeded"}}
- DeepSeek-V4.1-Flash D direct chain-reverse #2: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 429 {"error":{"message":"Rate limit exceeded","type":"rate_limit_error","param":null,"code":"rate_limit_exceeded"}}
