Agent runs: 5 files, 135 sessions, 2789 requests. A phase is done when its rubric in agent-tasks.ts holds over the calls the server accepted during it. A full task is a session's first 3 or all 6 phases done. Arguments are valid when they pass the tool's published input schema; rejected calls are those the server answered with an error.

| Model | Arm | Sessions | Errors | Phases done | Full task, 3 phases | Full task, every phase | Median requests | Group opens per session | Server tool calls | Valid arguments | Rejected by server |
| :-- | :-- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: |
| DeepSeek-V4.1-Flash | B full catalog | 15 | 0 | 89/90 | 15/15 | 14/15 | 19 | 6.20 | 146 | 99% | 0% |
| DeepSeek-V4.1-Flash | B listing in tool full catalog | 15 | 0 | 86/90 | 14/15 | 13/15 | 18 | 5.87 | 140 | 99% | 0% |
| DeepSeek-V4.1-Flash | C lenient full catalog | 15 | 0 | 88/90 | 14/15 | 14/15 | 20 | 5.27 | 143 | 98% | 0% |
| gemma-4-26B-A4B-it | C lenient | 15 | 0 | 64/90 | 6/15 | 2/15 | 20 | 4.80 | 172 | 61% | 5% |
| Qwen3.6-35B-A3B | C lenient | 15 | 0 | 85/90 | 13/15 | 10/15 | 24 | 5.60 | 155 | 94% | 3% |
| GLM-5.3-Flash | B full catalog | 15 | 0 | 88/90 | 13/15 | 13/15 | 20 | 5.00 | 149 | 96% | 0% |
| GLM-5.3-Flash | B listing in tool full catalog | 15 | 0 | 87/90 | 12/15 | 12/15 | 20 | 5.07 | 147 | 97% | 0% |
| GLM-5.3-Flash | C lenient | 15 | 0 | 85/90 | 11/15 | 11/15 | 20 | 4.93 | 145 | 98% | 2% |
| GLM-5.3-Flash | C lenient full catalog | 15 | 0 | 86/90 | 11/15 | 11/15 | 20 | 5.00 | 148 | 99% | 1% |

Cumulative cost in USD at list price through each phase, mean over the sessions that ran all 6 phases:

| Model | Arm | Sessions | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Phase 6 |
| :-- | :-- | --: | --: | --: | --: | --: | --: | --: |
| DeepSeek-V4.1-Flash | B full catalog | 15 | 0.0147 | 0.0218 | 0.0299 | 0.0390 | 0.0402 | 0.0557 |
| DeepSeek-V4.1-Flash | B listing in tool full catalog | 15 | 0.0094 | 0.0130 | 0.0160 | 0.0200 | 0.0213 | 0.0301 |
| DeepSeek-V4.1-Flash | C lenient full catalog | 15 | 0.0090 | 0.0121 | 0.0144 | 0.0177 | 0.0195 | 0.0237 |
| gemma-4-26B-A4B-it | C lenient | 15 | 0.0027 | 0.0069 | 0.0116 | 0.0180 | 0.0238 | 0.0314 |
| Qwen3.6-35B-A3B | C lenient | 15 | 0.0045 | 0.0113 | 0.0188 | 0.0285 | 0.0374 | 0.0506 |
| GLM-5.3-Flash | B full catalog | 15 | 0.0101 | 0.0194 | 0.0293 | 0.0386 | 0.0445 | 0.0553 |
| GLM-5.3-Flash | B listing in tool full catalog | 15 | 0.0081 | 0.0159 | 0.0218 | 0.0289 | 0.0336 | 0.0418 |
| GLM-5.3-Flash | C lenient | 15 | 0.0023 | 0.0045 | 0.0068 | 0.0097 | 0.0113 | 0.0148 |
| GLM-5.3-Flash | C lenient full catalog | 15 | 0.0067 | 0.0109 | 0.0159 | 0.0211 | 0.0239 | 0.0297 |

Cumulative input tokens through each phase, mean over the sessions that ran all 6 phases:

| Model | Arm | Sessions | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Phase 6 |
| :-- | :-- | --: | --: | --: | --: | --: | --: | --: |
| DeepSeek-V4.1-Flash | B full catalog | 15 | 94.4k | 201.1k | 319.4k | 465.9k | 566.0k | 747.7k |
| DeepSeek-V4.1-Flash | B listing in tool full catalog | 15 | 92.5k | 202.3k | 325.9k | 463.8k | 558.0k | 732.3k |
| DeepSeek-V4.1-Flash | C lenient full catalog | 15 | 88.0k | 193.9k | 309.7k | 459.8k | 564.0k | 726.5k |
| gemma-4-26B-A4B-it | C lenient | 15 | 36.8k | 96.3k | 162.2k | 252.8k | 333.2k | 441.9k |
| Qwen3.6-35B-A3B | C lenient | 15 | 40.8k | 106.9k | 179.2k | 273.5k | 360.7k | 490.1k |
| GLM-5.3-Flash | B full catalog | 15 | 95.1k | 211.3k | 332.6k | 479.9k | 574.9k | 722.1k |
| GLM-5.3-Flash | B listing in tool full catalog | 15 | 96.3k | 211.1k | 333.3k | 481.6k | 583.4k | 735.2k |
| GLM-5.3-Flash | C lenient | 15 | 31.9k | 79.6k | 139.6k | 216.9k | 265.6k | 351.5k |
| GLM-5.3-Flash | C lenient full catalog | 15 | 95.7k | 202.9k | 315.6k | 451.8k | 539.5k | 674.9k |

Cumulative input tokens not read from cache through each phase, mean over the sessions that ran all 6 phases:

| Model | Arm | Sessions | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Phase 6 |
| :-- | :-- | --: | --: | --: | --: | --: | --: | --: |
| DeepSeek-V4.1-Flash | B full catalog | 15 | 46.1k | 66.6k | 90.1k | 116.1k | 117.0k | 164.0k |
| DeepSeek-V4.1-Flash | B listing in tool full catalog | 15 | 28.2k | 36.5k | 42.8k | 51.7k | 52.6k | 77.2k |
| DeepSeek-V4.1-Flash | C lenient full catalog | 15 | 27.1k | 33.6k | 37.5k | 43.4k | 46.0k | 55.1k |
| gemma-4-26B-A4B-it | C lenient | 15 | 36.8k | 96.3k | 162.2k | 252.8k | 333.2k | 441.9k |
| Qwen3.6-35B-A3B | C lenient | 15 | 32.7k | 86.1k | 127.5k | 174.1k | 202.0k | 267.9k |
| GLM-5.3-Flash | B full catalog | 15 | 59.7k | 107.3k | 158.2k | 198.6k | 223.6k | 275.6k |
| GLM-5.3-Flash | B listing in tool full catalog | 15 | 42.7k | 77.6k | 95.9k | 117.1k | 130.1k | 159.8k |
| GLM-5.3-Flash | C lenient | 15 | 10.3k | 15.9k | 19.3k | 23.0k | 23.5k | 30.6k |
| GLM-5.3-Flash | C lenient full catalog | 15 | 30.7k | 38.0k | 50.3k | 59.1k | 59.6k | 73.5k |

The request after a group open against a session's other requests. Re-read tokens are the part of the previous request's prompt not served from cache. The first request of a session is left out.

| Model | Arm | Requests after an open | Median re-read tokens | Median re-read share | Requests with over half re-read | Median first token ms | Other requests | Median re-read tokens | Median re-read share | Requests with over half re-read | Median first token ms |
| :-- | :-- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: |
| DeepSeek-V4.1-Flash | B full catalog | 79 | 19.2k | 56% | 50 | 1070 | 196 | 121 | 0% | 0 | 606 |
| DeepSeek-V4.1-Flash | B listing in tool full catalog | 78 | 2.2k | 6% | 0 | 545 | 194 | 133 | 0% | 0 | 500 |
| DeepSeek-V4.1-Flash | C lenient full catalog | 79 | 108 | 0% | 0 | 611 | 203 | 122 | 0% | 0 | 526 |
| gemma-4-26B-A4B-it | C lenient | 72 | 15.2k | 100% | 72 | 923 | 244 | 18.6k | 100% | 244 | 747 |
| Qwen3.6-35B-A3B | C lenient | 84 | 6.9k | 68% | 47 | 1336 | 256 | 8.3k | 62% | 141 | 1142 |
| GLM-5.3-Flash | B full catalog | 75 | 22.4k | 83% | 72 | 1549 | 217 | 113 | 0% | 48 | 832 |
| GLM-5.3-Flash | B listing in tool full catalog | 76 | 6.3k | 18% | 8 | 1061 | 217 | 122 | 0% | 22 | 796 |
| GLM-5.3-Flash | C lenient | 74 | 158 | 1% | 1 | 607 | 216 | 78 | 0% | 0 | 473 |
| GLM-5.3-Flash | C lenient full catalog | 75 | 101 | 0% | 6 | 736 | 219 | 69 | 0% | 7 | 581 |

Phases done, by scenario and phase:

| Scenario | Phase | Groups | DeepSeek-V4.1-Flash B full catalog | DeepSeek-V4.1-Flash B listing in tool full catalog | DeepSeek-V4.1-Flash C lenient full catalog | gemma-4-26B-A4B-it C lenient | Qwen3.6-35B-A3B C lenient | GLM-5.3-Flash B full catalog | GLM-5.3-Flash B listing in tool full catalog | GLM-5.3-Flash C lenient | GLM-5.3-Flash C lenient full catalog |
| :-- | --: | :-- | --: | --: | --: | --: | --: | --: | --: | --: | --: |
| uploads | 1 | r2-buckets | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| uploads | 2 | queues-api | 3/3 | 3/3 | 3/3 | 3/3 | 1/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| uploads | 3 | kv-api | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 | 0/3 | 0/3 |
| uploads | 4 | workers-secrets | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| uploads | 5 | r2-buckets | 3/3 | 3/3 | 3/3 | 2/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| uploads | 6 | workers-core | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| shop-api | 1 | d1-api | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| shop-api | 2 | workers-routes | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| shop-api | 3 | workers-domains | 3/3 | 3/3 | 3/3 | 0/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| shop-api | 4 | turnstile-api | 3/3 | 3/3 | 3/3 | 0/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| shop-api | 5 | d1-api | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| shop-api | 6 | workers-deployments | 3/3 | 3/3 | 3/3 | 3/3 | 0/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| resizer | 1 | containers-api | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| resizer | 2 | r2-buckets | 3/3 | 3/3 | 3/3 | 0/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| resizer | 3 | kv-api | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| resizer | 4 | queues-api | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| resizer | 5 | containers-api | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| resizer | 6 | durable-objects-api | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| mail | 1 | email-routing-api | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| mail | 2 | email-sending-api | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 |
| mail | 3 | workers-secrets | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| mail | 4 | r2-objects | 3/3 | 3/3 | 3/3 | 2/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| mail | 5 | email-routing-api | 3/3 | 3/3 | 3/3 | 0/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| mail | 6 | workers-core | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| migration | 1 | r2-buckets | 3/3 | 3/3 | 3/3 | 0/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| migration | 2 | r2-super-slurper | 3/3 | 2/3 | 2/3 | 0/3 | 3/3 | 1/3 | 1/3 | 2/3 | 3/3 |
| migration | 3 | d1-api | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| migration | 4 | kv-api | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| migration | 5 | r2-super-slurper | 3/3 | 2/3 | 2/3 | 0/3 | 3/3 | 3/3 | 3/3 | 2/3 | 3/3 |
| migration | 6 | workers-legacy | 2/3 | 1/3 | 3/3 | 0/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
