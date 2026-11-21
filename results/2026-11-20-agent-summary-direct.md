Agent runs: 4 files, 58 sessions, 1043 requests. A phase is done when its rubric in agent-tasks.ts holds over the calls the server accepted during it. A full task is a session's first 3 or all 6 phases done. Arguments are valid when they pass the tool's published input schema; rejected calls are those the server answered with an error.

| Model | Arm | Sessions | Errors | Phases done | Full task, 3 phases | Full task, every phase | Median requests | Group opens per session | Server tool calls | Valid arguments | Rejected by server |
| :-- | :-- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: |
| DeepSeek-V4.1-Flash | A direct | 13 | 4 | 67/67 | 12/12 | 9/9 | 15 | 0.00 | 112 | 98% | 0% |
| DeepSeek-V4.1-Flash | B direct | 15 | 0 | 90/90 | 15/15 | 15/15 | 19 | 5.00 | 147 | 98% | 0% |
| DeepSeek-V4.1-Flash | D direct | 15 | 0 | 87/90 | 13/15 | 13/15 | 19 | 4.93 | 146 | 98% | 0% |
| DeepSeek-V4.1-Flash | C lenient direct | 15 | 0 | 90/90 | 15/15 | 15/15 | 20 | 5.13 | 146 | 98% | 0% |

Cumulative cost in USD at list price through each phase, mean over the sessions that ran all 6 phases:

| Model | Arm | Sessions | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Phase 6 |
| :-- | :-- | --: | --: | --: | --: | --: | --: | --: |
| DeepSeek-V4.1-Flash | A direct | 9 | 0.0659 | 0.0704 | 0.0744 | 0.0793 | 0.0831 | 0.0868 |
| DeepSeek-V4.1-Flash | B direct | 15 | 0.0045 | 0.0081 | 0.0110 | 0.0148 | 0.0157 | 0.0215 |
| DeepSeek-V4.1-Flash | D direct | 15 | 0.0041 | 0.0069 | 0.0089 | 0.0118 | 0.0127 | 0.0164 |
| DeepSeek-V4.1-Flash | C lenient direct | 15 | 0.0039 | 0.0066 | 0.0085 | 0.0111 | 0.0124 | 0.0158 |

Cumulative input tokens through each phase, mean over the sessions that ran all 6 phases:

| Model | Arm | Sessions | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Phase 6 |
| :-- | :-- | --: | --: | --: | --: | --: | --: | --: |
| DeepSeek-V4.1-Flash | A direct | 9 | 727.6k | 1.28M | 1.76M | 2.34M | 2.80M | 3.24M |
| DeepSeek-V4.1-Flash | B direct | 15 | 31.2k | 87.8k | 157.1k | 246.9k | 307.3k | 411.7k |
| DeepSeek-V4.1-Flash | D direct | 15 | 31.9k | 84.3k | 151.0k | 246.6k | 304.9k | 409.3k |
| DeepSeek-V4.1-Flash | C lenient direct | 15 | 29.1k | 81.4k | 145.0k | 234.0k | 295.2k | 399.3k |

Cumulative input tokens not read from cache through each phase, mean over the sessions that ran all 6 phases:

| Model | Arm | Sessions | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Phase 6 |
| :-- | :-- | --: | --: | --: | --: | --: | --: | --: |
| DeepSeek-V4.1-Flash | A direct | 9 | 205.5k | 206.2k | 206.7k | 208.1k | 208.6k | 209.2k |
| DeepSeek-V4.1-Flash | B direct | 15 | 12.9k | 22.4k | 29.4k | 39.0k | 39.6k | 55.7k |
| DeepSeek-V4.1-Flash | D direct | 15 | 11.4k | 18.2k | 22.1k | 28.0k | 28.5k | 37.4k |
| DeepSeek-V4.1-Flash | C lenient direct | 15 | 11.1k | 17.4k | 20.9k | 26.4k | 28.0k | 35.8k |

The request after a group open against a session's other requests. Re-read tokens are the part of the previous request's prompt not served from cache. The first request of a session is left out.

| Model | Arm | Requests after an open | Median re-read tokens | Median re-read share | Requests with over half re-read | Median first token ms | Other requests | Median re-read tokens | Median re-read share | Requests with over half re-read | Median first token ms |
| :-- | :-- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: |
| DeepSeek-V4.1-Flash | A direct | 0 | 0 | - | 0 | 0 | 165 | 0 | 0% | 0 | 1381 |
| DeepSeek-V4.1-Flash | B direct | 75 | 3.0k | 20% | 18 | 924 | 196 | 14 | 0% | 0 | 529 |
| DeepSeek-V4.1-Flash | D direct | 74 | 33 | 0% | 0 | 1325 | 198 | 5 | 0% | 0 | 1255 |
| DeepSeek-V4.1-Flash | C lenient direct | 77 | 90 | 1% | 0 | 724 | 197 | 0 | 0% | 0 | 557 |

Phases done, by scenario and phase:

| Scenario | Phase | Groups | DeepSeek-V4.1-Flash A direct | DeepSeek-V4.1-Flash B direct | DeepSeek-V4.1-Flash D direct | DeepSeek-V4.1-Flash C lenient direct |
| :-- | --: | :-- | --: | --: | --: | --: |
| uploads | 1 | r2-buckets | 2/2 | 3/3 | 3/3 | 3/3 |
| uploads | 2 | queues-api | 2/2 | 3/3 | 3/3 | 3/3 |
| uploads | 3 | kv-api | 2/2 | 3/3 | 2/3 | 3/3 |
| uploads | 4 | workers-secrets | 2/2 | 3/3 | 3/3 | 3/3 |
| uploads | 5 | r2-buckets | 1/1 | 3/3 | 3/3 | 3/3 |
| uploads | 6 | workers-core | 1/1 | 3/3 | 3/3 | 3/3 |
| shop-api | 1 | d1-api | 3/3 | 3/3 | 3/3 | 3/3 |
| shop-api | 2 | workers-routes | 3/3 | 3/3 | 3/3 | 3/3 |
| shop-api | 3 | workers-domains | 3/3 | 3/3 | 3/3 | 3/3 |
| shop-api | 4 | turnstile-api | 2/2 | 3/3 | 3/3 | 3/3 |
| shop-api | 5 | d1-api | 2/2 | 3/3 | 3/3 | 3/3 |
| shop-api | 6 | workers-deployments | 1/1 | 3/3 | 3/3 | 3/3 |
| resizer | 1 | containers-api | 2/2 | 3/3 | 3/3 | 3/3 |
| resizer | 2 | r2-buckets | 2/2 | 3/3 | 3/3 | 3/3 |
| resizer | 3 | kv-api | 2/2 | 3/3 | 3/3 | 3/3 |
| resizer | 4 | queues-api | 2/2 | 3/3 | 3/3 | 3/3 |
| resizer | 5 | containers-api | 2/2 | 3/3 | 3/3 | 3/3 |
| resizer | 6 | durable-objects-api | 2/2 | 3/3 | 3/3 | 3/3 |
| mail | 1 | email-routing-api | 3/3 | 3/3 | 3/3 | 3/3 |
| mail | 2 | email-sending-api | 3/3 | 3/3 | 3/3 | 3/3 |
| mail | 3 | workers-secrets | 3/3 | 3/3 | 3/3 | 3/3 |
| mail | 4 | r2-objects | 3/3 | 3/3 | 3/3 | 3/3 |
| mail | 5 | email-routing-api | 3/3 | 3/3 | 3/3 | 3/3 |
| mail | 6 | workers-core | 3/3 | 3/3 | 3/3 | 3/3 |
| migration | 1 | r2-buckets | 3/3 | 3/3 | 3/3 | 3/3 |
| migration | 2 | r2-super-slurper | 2/2 | 3/3 | 2/3 | 3/3 |
| migration | 3 | d1-api | 2/2 | 3/3 | 3/3 | 3/3 |
| migration | 4 | kv-api | 2/2 | 3/3 | 3/3 | 3/3 |
| migration | 5 | r2-super-slurper | 2/2 | 3/3 | 2/3 | 3/3 |
| migration | 6 | workers-legacy | 2/2 | 3/3 | 3/3 | 3/3 |

Sessions that ended in an error:
- DeepSeek-V4.1-Flash A direct uploads #2: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 429 {"error":{"message":"Rate limit exceeded","type":"rate_limit_error","param":null,"code":"rate_limit_exceeded"}}
- DeepSeek-V4.1-Flash A direct uploads #3: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 429 {"error":{"message":"Rate limit exceeded","type":"rate_limit_error","param":null,"code":"rate_limit_exceeded"}}
- DeepSeek-V4.1-Flash A direct shop-api #1: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 429 {"error":{"message":"Rate limit exceeded","type":"rate_limit_error","param":null,"code":"rate_limit_exceeded"}}
- DeepSeek-V4.1-Flash A direct shop-api #3: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 429 {"error":{"message":"Rate limit exceeded","type":"rate_limit_error","param":null,"code":"rate_limit_exceeded"}}
- DeepSeek-V4.1-Flash A direct resizer #2: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 429 {"error":{"message":"Rate limit exceeded","type":"rate_limit_error","param":null,"code":"rate_limit_exceeded"}}
- DeepSeek-V4.1-Flash A direct migration #1: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 429 {"error":{"message":"Rate limit exceeded","type":"rate_limit_error","param":null,"code":"rate_limit_exceeded"}}
