Agent runs: 2 files, 30 sessions, 577 requests. A phase is done when its rubric in agent-tasks.ts holds over the calls the server accepted during it. A full task is a session's first 3 or all 6 phases done. Arguments are valid when they pass the tool's published input schema; rejected calls are those the server answered with an error.

| Model | Arm | Sessions | Errors | Phases done | Full task, 3 phases | Full task, every phase | Median requests | Group opens per session | Server tool calls | Valid arguments | Rejected by server |
| :-- | :-- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: |
| DeepSeek-V4.1-Flash | B shared direct | 15 | 1 | 88/88 | 15/15 | 14/14 | 19 | 5.07 | 148 | 98% | 0% |
| DeepSeek-V4.1-Flash | D shared direct | 15 | 1 | 86/88 | 14/15 | 13/14 | 20 | 5.00 | 152 | 98% | 0% |

Cumulative cost in USD at list price through each phase, mean over the sessions that ran all 6 phases:

| Model | Arm | Sessions | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Phase 6 |
| :-- | :-- | --: | --: | --: | --: | --: | --: | --: |
| DeepSeek-V4.1-Flash | B shared direct | 14 | 0.0028 | 0.0056 | 0.0081 | 0.0116 | 0.0126 | 0.0176 |
| DeepSeek-V4.1-Flash | D shared direct | 14 | 0.0039 | 0.0067 | 0.0087 | 0.0115 | 0.0125 | 0.0164 |

Cumulative input tokens through each phase, mean over the sessions that ran all 6 phases:

| Model | Arm | Sessions | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Phase 6 |
| :-- | :-- | --: | --: | --: | --: | --: | --: | --: |
| DeepSeek-V4.1-Flash | B shared direct | 14 | 33.6k | 93.1k | 162.3k | 252.0k | 314.6k | 419.2k |
| DeepSeek-V4.1-Flash | D shared direct | 14 | 32.8k | 85.8k | 153.3k | 250.9k | 318.0k | 424.1k |

Cumulative input tokens not read from cache through each phase, mean over the sessions that ran all 6 phases:

| Model | Arm | Sessions | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Phase 6 |
| :-- | :-- | --: | --: | --: | --: | --: | --: | --: |
| DeepSeek-V4.1-Flash | B shared direct | 14 | 7.1k | 13.5k | 19.3k | 27.8k | 28.4k | 42.0k |
| DeepSeek-V4.1-Flash | D shared direct | 14 | 10.8k | 17.6k | 21.4k | 27.4k | 28.0k | 37.5k |

The request after a group open against a session's other requests. Re-read tokens are the part of the previous request's prompt not served from cache. The first request of a session is left out.

| Model | Arm | Requests after an open | Median re-read tokens | Median re-read share | Requests with over half re-read | Median first token ms | Other requests | Median re-read tokens | Median re-read share | Requests with over half re-read | Median first token ms |
| :-- | :-- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: |
| DeepSeek-V4.1-Flash | B shared direct | 75 | 2.3k | 15% | 9 | 847 | 195 | 0 | 0% | 0 | 693 |
| DeepSeek-V4.1-Flash | D shared direct | 75 | 41 | 0% | 0 | 1425 | 202 | 0 | 0% | 0 | 1340 |

Phases done, by scenario and phase:

| Scenario | Phase | Groups | DeepSeek-V4.1-Flash B shared direct | DeepSeek-V4.1-Flash D shared direct |
| :-- | --: | :-- | --: | --: |
| uploads | 1 | r2-buckets | 3/3 | 3/3 |
| uploads | 2 | queues-api | 3/3 | 3/3 |
| uploads | 3 | kv-api | 3/3 | 3/3 |
| uploads | 4 | workers-secrets | 3/3 | 3/3 |
| uploads | 5 | r2-buckets | 3/3 | 2/2 |
| uploads | 6 | workers-core | 3/3 | 2/2 |
| shop-api | 1 | d1-api | 3/3 | 3/3 |
| shop-api | 2 | workers-routes | 3/3 | 3/3 |
| shop-api | 3 | workers-domains | 3/3 | 3/3 |
| shop-api | 4 | turnstile-api | 3/3 | 3/3 |
| shop-api | 5 | d1-api | 3/3 | 3/3 |
| shop-api | 6 | workers-deployments | 3/3 | 3/3 |
| resizer | 1 | containers-api | 3/3 | 3/3 |
| resizer | 2 | r2-buckets | 3/3 | 3/3 |
| resizer | 3 | kv-api | 3/3 | 3/3 |
| resizer | 4 | queues-api | 3/3 | 3/3 |
| resizer | 5 | containers-api | 2/2 | 3/3 |
| resizer | 6 | durable-objects-api | 2/2 | 3/3 |
| mail | 1 | email-routing-api | 3/3 | 3/3 |
| mail | 2 | email-sending-api | 3/3 | 3/3 |
| mail | 3 | workers-secrets | 3/3 | 3/3 |
| mail | 4 | r2-objects | 3/3 | 3/3 |
| mail | 5 | email-routing-api | 3/3 | 3/3 |
| mail | 6 | workers-core | 3/3 | 3/3 |
| migration | 1 | r2-buckets | 3/3 | 3/3 |
| migration | 2 | r2-super-slurper | 3/3 | 2/3 |
| migration | 3 | d1-api | 3/3 | 3/3 |
| migration | 4 | kv-api | 3/3 | 3/3 |
| migration | 5 | r2-super-slurper | 3/3 | 2/3 |
| migration | 6 | workers-legacy | 3/3 | 3/3 |

Sessions that ended in an error:
- DeepSeek-V4.1-Flash B shared direct resizer #2: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 429 {"error":{"message":"Rate limit exceeded","type":"rate_limit_error","param":null,"code":"rate_limit_exceeded"}}
- DeepSeek-V4.1-Flash D shared direct uploads #3: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 429 {"error":{"message":"Rate limit exceeded","type":"rate_limit_error","param":null,"code":"rate_limit_exceeded"}}
