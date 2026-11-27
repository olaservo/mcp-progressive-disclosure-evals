Agent runs: 6 files, 24 sessions, 2007 requests. A phase is done when its rubric in agent-tasks.ts holds over the calls the server accepted during it. A full task is a session's first 3 or all 6 phases done. Arguments are valid when they pass the tool's published input schema; rejected calls are those the server answered with an error.

| Model | Arm | Sessions | Errors | Phases done | Full task, 3 phases | Full task, every phase | Median requests | Group opens per session | Server tool calls | Valid arguments | Rejected by server |
| :-- | :-- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: |
| DeepSeek-V4.1-Flash | A | 2 | 0 | 60/60 | 2/2 | 2/2 | 66 | 0.00 | 96 | 99% | 0% |
| DeepSeek-V4.1-Flash | B | 2 | 0 | 60/60 | 2/2 | 2/2 | 81 | 16.00 | 96 | 98% | 0% |
| DeepSeek-V4.1-Flash | A pad 2000 | 2 | 0 | 59/60 | 2/2 | 1/2 | 62 | 0.00 | 95 | 98% | 0% |
| DeepSeek-V4.1-Flash | B pad 2000 | 2 | 0 | 60/60 | 2/2 | 2/2 | 82 | 22.50 | 99 | 98% | 0% |
| DeepSeek-V4.1-Flash | C lenient | 2 | 0 | 60/60 | 2/2 | 2/2 | 87 | 22.50 | 96 | 98% | 0% |
| DeepSeek-V4.1-Flash | C lenient pad 2000 | 2 | 0 | 58/60 | 1/2 | 1/2 | 78 | 15.00 | 95 | 98% | 0% |
| GLM-5.3-Flash | A | 2 | 0 | 58/60 | 2/2 | 1/2 | 78 | 0.00 | 98 | 95% | 1% |
| GLM-5.3-Flash | B | 2 | 0 | 58/60 | 1/2 | 0/2 | 89 | 16.00 | 98 | 97% | 0% |
| GLM-5.3-Flash | A pad 2000 | 2 | 0 | 59/60 | 2/2 | 1/2 | 78 | 0.00 | 220 | 98% | 1% |
| GLM-5.3-Flash | B pad 2000 | 2 | 0 | 60/60 | 2/2 | 2/2 | 91 | 16.00 | 98 | 96% | 0% |
| GLM-5.3-Flash | C lenient | 2 | 0 | 58/60 | 1/2 | 0/2 | 92 | 16.00 | 96 | 99% | 0% |
| GLM-5.3-Flash | C lenient pad 2000 | 2 | 0 | 58/60 | 1/2 | 0/2 | 93 | 16.00 | 96 | 97% | 1% |

Cumulative cost in USD at list price through each phase, mean over the sessions that ran all 30 phases:

| Model | Arm | Sessions | Phase 6 | Phase 12 | Phase 18 | Phase 24 | Phase 30 |
| :-- | :-- | --: | --: | --: | --: | --: | --: |
| DeepSeek-V4.1-Flash | A | 2 | 0.0851 | 0.1105 | 0.1352 | 0.1604 | 0.1880 |
| DeepSeek-V4.1-Flash | B | 2 | 0.0253 | 0.0531 | 0.0796 | 0.1151 | 0.1330 |
| DeepSeek-V4.1-Flash | A pad 2000 | 2 | 0.0943 | 0.1310 | 0.1672 | 0.2070 | 0.2505 |
| DeepSeek-V4.1-Flash | B pad 2000 | 2 | 0.0520 | 0.1328 | 0.2121 | 0.3431 | 0.3953 |
| DeepSeek-V4.1-Flash | C lenient | 2 | 0.0207 | 0.0368 | 0.0597 | 0.0830 | 0.1097 |
| DeepSeek-V4.1-Flash | C lenient pad 2000 | 2 | 0.0258 | 0.0505 | 0.0758 | 0.1069 | 0.1345 |
| GLM-5.3-Flash | A | 2 | 0.1258 | 0.2169 | 0.3090 | 0.4021 | 0.5056 |
| GLM-5.3-Flash | B | 2 | 0.0339 | 0.0869 | 0.1438 | 0.2154 | 0.2741 |
| GLM-5.3-Flash | A pad 2000 | 2 | 0.1656 | 0.4116 | 0.6019 | 0.8031 | 1.0737 |
| GLM-5.3-Flash | B pad 2000 | 2 | 0.0463 | 0.1301 | 0.2222 | 0.3563 | 0.4625 |
| GLM-5.3-Flash | C lenient | 2 | 0.0185 | 0.0470 | 0.0843 | 0.1376 | 0.1772 |
| GLM-5.3-Flash | C lenient pad 2000 | 2 | 0.0363 | 0.1156 | 0.2275 | 0.3315 | 0.4347 |

Cumulative input tokens through each phase, mean over the sessions that ran all 30 phases:

| Model | Arm | Sessions | Phase 6 | Phase 12 | Phase 18 | Phase 24 | Phase 30 |
| :-- | :-- | --: | --: | --: | --: | --: | --: |
| DeepSeek-V4.1-Flash | A | 2 | 2.90M | 5.78M | 8.73M | 11.72M | 15.00M |
| DeepSeek-V4.1-Flash | B | 2 | 471.3k | 1.54M | 2.79M | 4.29M | 5.64M |
| DeepSeek-V4.1-Flash | A pad 2000 | 2 | 3.07M | 6.54M | 10.09M | 14.13M | 18.51M |
| DeepSeek-V4.1-Flash | B pad 2000 | 2 | 788.8k | 2.46M | 4.72M | 7.78M | 11.04M |
| DeepSeek-V4.1-Flash | C lenient | 2 | 479.5k | 1.56M | 3.12M | 5.11M | 7.53M |
| DeepSeek-V4.1-Flash | C lenient pad 2000 | 2 | 603.3k | 2.07M | 3.83M | 6.33M | 8.68M |
| GLM-5.3-Flash | A | 2 | 3.37M | 6.38M | 9.43M | 12.50M | 15.92M |
| GLM-5.3-Flash | B | 2 | 514.7k | 1.54M | 2.72M | 4.22M | 5.63M |
| GLM-5.3-Flash | A pad 2000 | 2 | 3.95M | 9.82M | 16.06M | 22.65M | 30.25M |
| GLM-5.3-Flash | B pad 2000 | 2 | 755.6k | 2.55M | 4.74M | 7.75M | 10.94M |
| GLM-5.3-Flash | C lenient | 2 | 443.0k | 1.32M | 2.35M | 3.63M | 4.91M |
| GLM-5.3-Flash | C lenient pad 2000 | 2 | 722.9k | 2.28M | 4.30M | 7.03M | 9.95M |

Cumulative input tokens not read from cache through each phase, mean over the sessions that ran all 30 phases:

| Model | Arm | Sessions | Phase 6 | Phase 12 | Phase 18 | Phase 24 | Phase 30 |
| :-- | :-- | --: | --: | --: | --: | --: | --: |
| DeepSeek-V4.1-Flash | A | 2 | 211.3k | 220.2k | 225.5k | 231.0k | 237.1k |
| DeepSeek-V4.1-Flash | B | 2 | 65.8k | 126.2k | 179.4k | 257.6k | 277.5k |
| DeepSeek-V4.1-Flash | A pad 2000 | 2 | 235.4k | 265.5k | 291.9k | 318.3k | 347.4k |
| DeepSeek-V4.1-Flash | B pad 2000 | 2 | 148.4k | 376.5k | 585.5k | 951.6k | 1.04M |
| DeepSeek-V4.1-Flash | C lenient | 2 | 50.0k | 71.5k | 105.1k | 129.7k | 154.7k |
| DeepSeek-V4.1-Flash | C lenient pad 2000 | 2 | 64.3k | 105.7k | 142.9k | 181.6k | 211.5k |
| GLM-5.3-Flash | A | 2 | 200.6k | 204.0k | 207.1k | 210.2k | 214.1k |
| GLM-5.3-Flash | B | 2 | 148.5k | 328.5k | 504.4k | 721.9k | 855.8k |
| GLM-5.3-Flash | A pad 2000 | 2 | 380.7k | 956.9k | 981.8k | 1.01M | 1.36M |
| GLM-5.3-Flash | B pad 2000 | 2 | 191.9k | 437.0k | 653.6k | 1.01M | 1.10M |
| GLM-5.3-Flash | C lenient | 2 | 37.9k | 52.4k | 100.2k | 220.6k | 225.3k |
| GLM-5.3-Flash | C lenient pad 2000 | 2 | 116.3k | 382.7k | 805.7k | 986.5k | 1.11M |

Where arm B's cumulative cost passes arm A's. A pair is an arm B session and the arm A session of the same model, scenario and sample. Its phase is the first from which arm B stays above arm A.

| Model | Arm B | Arm A | Pairs | Phase, per pair | Arm B cost over arm A's at phase 30, paired sessions |
| :-- | :-- | :-- | --: | :-- | --: |
| DeepSeek-V4.1-Flash | B | A | 2 | not in 30, not in 30 | 0.71 |
| DeepSeek-V4.1-Flash | B pad 2000 | A pad 2000 | 2 | 12, 13 | 1.58 |
| GLM-5.3-Flash | B | A | 2 | not in 30, not in 30 | 0.54 |
| GLM-5.3-Flash | B pad 2000 | A pad 2000 | 2 | not in 30, not in 30 | 0.43 |

The request after a group open against a session's other requests. Re-read tokens are the part of the previous request's prompt not served from cache. The first request of a session is left out.

| Model | Arm | Requests after an open | Median re-read tokens | Median re-read share | Requests with over half re-read | Median first token ms | Other requests | Median re-read tokens | Median re-read share | Requests with over half re-read | Median first token ms |
| :-- | :-- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: |
| DeepSeek-V4.1-Flash | A | 0 | 0 | - | 0 | 0 | 136 | 138 | 0% | 0 | 1192 |
| DeepSeek-V4.1-Flash | B | 32 | 7.8k | 16% | 2 | 842 | 130 | 126 | 0% | 0 | 578 |
| DeepSeek-V4.1-Flash | A pad 2000 | 0 | 0 | - | 0 | 0 | 134 | 138 | 0% | 0 | 1278 |
| DeepSeek-V4.1-Flash | B pad 2000 | 45 | 30.2k | 46% | 17 | 1292 | 131 | 136 | 0% | 0 | 816 |
| DeepSeek-V4.1-Flash | C lenient | 45 | 143 | 0% | 0 | 727 | 134 | 134 | 0% | 0 | 723 |
| DeepSeek-V4.1-Flash | C lenient pad 2000 | 30 | 129 | 0% | 0 | 574 | 124 | 123 | 0% | 0 | 635 |
| GLM-5.3-Flash | A | 0 | 0 | - | 0 | 0 | 155 | 72 | 0% | 0 | 893 |
| GLM-5.3-Flash | B | 32 | 11.7k | 23% | 5 | 1482 | 149 | 116 | 0% | 16 | 1044 |
| GLM-5.3-Flash | A pad 2000 | 0 | 0 | - | 0 | 0 | 154 | 72 | 0% | 4 | 1723 |
| GLM-5.3-Flash | B pad 2000 | 32 | 50.6k | 57% | 29 | 3202 | 150 | 82 | 0% | 2 | 1024 |
| GLM-5.3-Flash | C lenient | 32 | 127 | 0% | 0 | 795 | 153 | 62 | 0% | 4 | 693 |
| GLM-5.3-Flash | C lenient pad 2000 | 32 | 187 | 0% | 5 | 990 | 153 | 117 | 0% | 10 | 994 |

Phases done, by scenario and phase:

| Scenario | Phase | Groups | DeepSeek-V4.1-Flash A | DeepSeek-V4.1-Flash B | DeepSeek-V4.1-Flash A pad 2000 | DeepSeek-V4.1-Flash B pad 2000 | DeepSeek-V4.1-Flash C lenient | DeepSeek-V4.1-Flash C lenient pad 2000 | GLM-5.3-Flash A | GLM-5.3-Flash B | GLM-5.3-Flash A pad 2000 | GLM-5.3-Flash B pad 2000 | GLM-5.3-Flash C lenient | GLM-5.3-Flash C lenient pad 2000 |
| :-- | --: | :-- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: |
| chain-forward | 1 | r2-buckets | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 2 | queues-api | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 3 | kv-api | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 0/1 | 1/1 | 1/1 | 0/1 | 0/1 |
| chain-forward | 4 | workers-secrets | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 5 | r2-buckets | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 6 | workers-core | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 7 | d1-api | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 8 | workers-routes | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 9 | workers-domains | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 10 | turnstile-api | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 11 | d1-api | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 12 | workers-deployments | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 13 | containers-api | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 14 | r2-buckets | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 15 | kv-api | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 16 | queues-api | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 17 | containers-api | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 0/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 18 | durable-objects-api | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 19 | email-routing-api | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 20 | email-sending-api | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 21 | workers-secrets | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 22 | r2-objects | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 23 | email-routing-api | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 24 | workers-core | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 25 | r2-buckets | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 26 | r2-super-slurper | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 0/1 | 1/1 | 0/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 27 | d1-api | 1/1 | 1/1 | 0/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 28 | kv-api | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 29 | r2-super-slurper | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 30 | workers-legacy | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 1 | r2-buckets | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 2 | r2-super-slurper | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 0/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 3 | d1-api | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 4 | kv-api | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 5 | r2-super-slurper | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 0/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 6 | workers-legacy | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 7 | email-routing-api | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 8 | email-sending-api | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 9 | workers-secrets | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 10 | r2-objects | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 11 | email-routing-api | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 12 | workers-core | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 13 | containers-api | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 14 | r2-buckets | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 15 | kv-api | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 16 | queues-api | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 17 | containers-api | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 18 | durable-objects-api | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 19 | d1-api | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 0/1 | 1/1 |
| chain-reverse | 20 | workers-routes | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 21 | workers-domains | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 22 | turnstile-api | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 23 | d1-api | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 24 | workers-deployments | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 25 | r2-buckets | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 26 | queues-api | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 0/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 27 | kv-api | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 0/1 |
| chain-reverse | 28 | workers-secrets | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 29 | r2-buckets | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 30 | workers-core | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
