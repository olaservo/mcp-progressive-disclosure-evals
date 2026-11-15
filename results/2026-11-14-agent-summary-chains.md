Agent runs: 15 files, 56 sessions, 5008 requests. A phase is done when its rubric in agent-tasks.ts holds over the calls the server accepted during it. A full task is a session's first 3 or all 6 phases done. Arguments are valid when they pass the tool's published input schema; rejected calls are those the server answered with an error.

| Model | Arm | Sessions | Errors | Phases done | Full task, 3 phases | Full task, every phase | Median requests | Group opens per session | Server tool calls | Valid arguments | Rejected by server |
| :-- | :-- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: |
| DeepSeek-V4.1-Flash | A | 2 | 0 | 60/60 | 2/2 | 2/2 | 66 | 0.00 | 96 | 99% | 0% |
| DeepSeek-V4.1-Flash | B | 6 | 0 | 180/180 | 6/6 | 6/6 | 83 | 18.50 | 289 | 98% | 0% |
| DeepSeek-V4.1-Flash | A shared | 6 | 0 | 180/180 | 6/6 | 6/6 | 77 | 0.00 | 296 | 99% | 0% |
| DeepSeek-V4.1-Flash | A pad 2000 | 6 | 0 | 179/180 | 6/6 | 5/6 | 63 | 0.00 | 288 | 98% | 0% |
| DeepSeek-V4.1-Flash | A shared pad 2000 | 6 | 0 | 179/180 | 6/6 | 5/6 | 66 | 0.00 | 289 | 99% | 0% |
| DeepSeek-V4.1-Flash | B pad 2000 | 6 | 0 | 180/180 | 6/6 | 6/6 | 86 | 20.67 | 293 | 98% | 0% |
| DeepSeek-V4.1-Flash | C lenient | 6 | 0 | 180/180 | 6/6 | 6/6 | 87 | 21.00 | 290 | 98% | 0% |
| DeepSeek-V4.1-Flash | C lenient pad 2000 | 6 | 0 | 177/180 | 5/6 | 4/6 | 78 | 17.83 | 288 | 98% | 0% |
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
| DeepSeek-V4.1-Flash | B | 6 | 0.0255 | 0.0527 | 0.0788 | 0.1141 | 0.1330 |
| DeepSeek-V4.1-Flash | A shared | 6 | 0.0297 | 0.0592 | 0.0858 | 0.1153 | 0.1463 |
| DeepSeek-V4.1-Flash | A pad 2000 | 6 | 0.0943 | 0.1290 | 0.1636 | 0.2019 | 0.2437 |
| DeepSeek-V4.1-Flash | A shared pad 2000 | 6 | 0.0362 | 0.0734 | 0.1105 | 0.1517 | 0.1984 |
| DeepSeek-V4.1-Flash | B pad 2000 | 6 | 0.0512 | 0.1320 | 0.2113 | 0.3420 | 0.3935 |
| DeepSeek-V4.1-Flash | C lenient | 6 | 0.0210 | 0.0372 | 0.0583 | 0.0807 | 0.1040 |
| DeepSeek-V4.1-Flash | C lenient pad 2000 | 6 | 0.0277 | 0.0531 | 0.0818 | 0.1163 | 0.1500 |
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
| DeepSeek-V4.1-Flash | B | 6 | 509.8k | 1.60M | 2.86M | 4.40M | 5.95M |
| DeepSeek-V4.1-Flash | A shared | 6 | 3.36M | 6.71M | 9.86M | 13.27M | 16.92M |
| DeepSeek-V4.1-Flash | A pad 2000 | 6 | 3.11M | 6.38M | 9.79M | 13.63M | 17.81M |
| DeepSeek-V4.1-Flash | A shared pad 2000 | 6 | 3.19M | 6.67M | 10.34M | 14.47M | 19.25M |
| DeepSeek-V4.1-Flash | B pad 2000 | 6 | 765.3k | 2.48M | 4.70M | 7.75M | 10.94M |
| DeepSeek-V4.1-Flash | C lenient | 6 | 486.4k | 1.55M | 3.00M | 4.90M | 7.00M |
| DeepSeek-V4.1-Flash | C lenient pad 2000 | 6 | 673.9k | 2.21M | 4.23M | 7.06M | 10.02M |
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
| DeepSeek-V4.1-Flash | B | 6 | 66.2k | 125.4k | 177.6k | 254.4k | 274.3k |
| DeepSeek-V4.1-Flash | A shared | 6 | 9.5k | 19.5k | 25.2k | 33.8k | 40.5k |
| DeepSeek-V4.1-Flash | A pad 2000 | 6 | 235.5k | 265.0k | 290.7k | 317.9k | 347.4k |
| DeepSeek-V4.1-Flash | A shared pad 2000 | 6 | 33.5k | 64.0k | 90.3k | 119.1k | 149.5k |
| DeepSeek-V4.1-Flash | B pad 2000 | 6 | 145.6k | 371.1k | 580.3k | 944.3k | 1.03M |
| DeepSeek-V4.1-Flash | C lenient | 6 | 50.4k | 72.3k | 102.4k | 126.0k | 146.8k |
| DeepSeek-V4.1-Flash | C lenient pad 2000 | 6 | 68.9k | 110.3k | 152.9k | 194.9k | 231.0k |
| GLM-5.3-Flash | A | 2 | 200.6k | 204.0k | 207.1k | 210.2k | 214.1k |
| GLM-5.3-Flash | B | 2 | 148.5k | 328.5k | 504.4k | 721.9k | 855.8k |
| GLM-5.3-Flash | A pad 2000 | 2 | 380.7k | 956.9k | 981.8k | 1.01M | 1.36M |
| GLM-5.3-Flash | B pad 2000 | 2 | 191.9k | 437.0k | 653.6k | 1.01M | 1.10M |
| GLM-5.3-Flash | C lenient | 2 | 37.9k | 52.4k | 100.2k | 220.6k | 225.3k |
| GLM-5.3-Flash | C lenient pad 2000 | 2 | 116.3k | 382.7k | 805.7k | 986.5k | 1.11M |

The request after a group open against a session's other requests. Re-read tokens are the part of the previous request's prompt not served from cache. The first request of a session is left out.

| Model | Arm | Requests after an open | Median re-read tokens | Median re-read share | Requests with over half re-read | Median first token ms | Other requests | Median re-read tokens | Median re-read share | Requests with over half re-read | Median first token ms |
| :-- | :-- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: |
| DeepSeek-V4.1-Flash | A | 0 | 0 | - | 0 | 0 | 136 | 138 | 0% | 0 | 1192 |
| DeepSeek-V4.1-Flash | B | 111 | 7.0k | 15% | 6 | 833 | 404 | 136 | 0% | 0 | 637 |
| DeepSeek-V4.1-Flash | A shared | 0 | 0 | - | 0 | 0 | 457 | 140 | 0% | 0 | 1069 |
| DeepSeek-V4.1-Flash | A pad 2000 | 0 | 0 | - | 0 | 0 | 387 | 132 | 0% | 0 | 1166 |
| DeepSeek-V4.1-Flash | A shared pad 2000 | 0 | 0 | - | 0 | 0 | 414 | 120 | 0% | 0 | 1097 |
| DeepSeek-V4.1-Flash | B pad 2000 | 124 | 33.0k | 47% | 51 | 1274 | 401 | 125 | 0% | 0 | 753 |
| DeepSeek-V4.1-Flash | C lenient | 126 | 123 | 0% | 0 | 673 | 391 | 133 | 0% | 0 | 652 |
| DeepSeek-V4.1-Flash | C lenient pad 2000 | 107 | 128 | 0% | 0 | 661 | 383 | 133 | 0% | 0 | 679 |
| GLM-5.3-Flash | A | 0 | 0 | - | 0 | 0 | 155 | 72 | 0% | 0 | 893 |
| GLM-5.3-Flash | B | 32 | 11.7k | 23% | 5 | 1482 | 149 | 116 | 0% | 16 | 1044 |
| GLM-5.3-Flash | A pad 2000 | 0 | 0 | - | 0 | 0 | 154 | 72 | 0% | 4 | 1723 |
| GLM-5.3-Flash | B pad 2000 | 32 | 50.6k | 57% | 29 | 3202 | 150 | 82 | 0% | 2 | 1024 |
| GLM-5.3-Flash | C lenient | 32 | 127 | 0% | 0 | 795 | 153 | 62 | 0% | 4 | 693 |
| GLM-5.3-Flash | C lenient pad 2000 | 32 | 187 | 0% | 5 | 990 | 153 | 117 | 0% | 10 | 994 |

Phases done, by scenario and phase:

| Scenario | Phase | Groups | DeepSeek-V4.1-Flash A | DeepSeek-V4.1-Flash B | DeepSeek-V4.1-Flash A shared | DeepSeek-V4.1-Flash A pad 2000 | DeepSeek-V4.1-Flash A shared pad 2000 | DeepSeek-V4.1-Flash B pad 2000 | DeepSeek-V4.1-Flash C lenient | DeepSeek-V4.1-Flash C lenient pad 2000 | GLM-5.3-Flash A | GLM-5.3-Flash B | GLM-5.3-Flash A pad 2000 | GLM-5.3-Flash B pad 2000 | GLM-5.3-Flash C lenient | GLM-5.3-Flash C lenient pad 2000 |
| :-- | --: | :-- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: |
| chain-forward | 1 | r2-buckets | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 2 | queues-api | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 3 | kv-api | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 0/1 | 1/1 | 1/1 | 0/1 | 0/1 |
| chain-forward | 4 | workers-secrets | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 5 | r2-buckets | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 6 | workers-core | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 7 | d1-api | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 8 | workers-routes | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 9 | workers-domains | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 10 | turnstile-api | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 11 | d1-api | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 12 | workers-deployments | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 13 | containers-api | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 14 | r2-buckets | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 15 | kv-api | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 16 | queues-api | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 17 | containers-api | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 0/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 18 | durable-objects-api | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 19 | email-routing-api | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 20 | email-sending-api | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 21 | workers-secrets | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 22 | r2-objects | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 23 | email-routing-api | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 24 | workers-core | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 25 | r2-buckets | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 26 | r2-super-slurper | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 0/1 | 1/1 | 0/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 27 | d1-api | 1/1 | 3/3 | 3/3 | 2/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 28 | kv-api | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 29 | r2-super-slurper | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-forward | 30 | workers-legacy | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 1 | r2-buckets | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 2 | r2-super-slurper | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 3 | d1-api | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 4 | kv-api | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 5 | r2-super-slurper | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 6 | workers-legacy | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 7 | email-routing-api | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 8 | email-sending-api | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 9 | workers-secrets | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 10 | r2-objects | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 11 | email-routing-api | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 12 | workers-core | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 13 | containers-api | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 14 | r2-buckets | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 15 | kv-api | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 16 | queues-api | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 17 | containers-api | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 18 | durable-objects-api | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 19 | d1-api | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 0/1 | 1/1 |
| chain-reverse | 20 | workers-routes | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 21 | workers-domains | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 22 | turnstile-api | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 23 | d1-api | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 24 | workers-deployments | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 25 | r2-buckets | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 26 | queues-api | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 0/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 27 | kv-api | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 0/1 |
| chain-reverse | 28 | workers-secrets | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 29 | r2-buckets | 1/1 | 3/3 | 3/3 | 3/3 | 2/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| chain-reverse | 30 | workers-core | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |

Sessions that ended in an error:
- DeepSeek-V4.1-Flash A pad 2000 chain-forward #3: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 503 {"error":"Provider 'baseten' is currently failing for model 'deepseek-ai/DeepSeek-V4.1-Flash' and has been paused by the circuit breaker. Retry later 
- DeepSeek-V4.1-Flash A pad 2000 chain-forward #2: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 503 {"error":"Provider 'baseten' is currently failing for model 'deepseek-ai/DeepSeek-V4.1-Flash' and has been paused by the circuit breaker. Retry later 
- DeepSeek-V4.1-Flash A pad 2000 chain-reverse #2: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 429 {"error":{"message":"Rate limit exceeded","type":"rate_limit_error","param":null,"code":"rate_limit_exceeded"}}
- DeepSeek-V4.1-Flash A pad 2000 chain-reverse #3: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 503 {"error":"Provider 'baseten' is currently failing for model 'deepseek-ai/DeepSeek-V4.1-Flash' and has been paused by the circuit breaker. Retry later 
- DeepSeek-V4.1-Flash A pad 2000 chain-forward #3: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 503 {"error":"Provider 'baseten' is currently failing for model 'deepseek-ai/DeepSeek-V4.1-Flash' and has been paused by the circuit breaker. Retry later 
- DeepSeek-V4.1-Flash A pad 2000 chain-reverse #2: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 429 {"error":{"message":"Rate limit exceeded","type":"rate_limit_error","param":null,"code":"rate_limit_exceeded"}}
- DeepSeek-V4.1-Flash A shared pad 2000 chain-forward #3: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 503 {"error":"Provider 'baseten' is currently failing for model 'deepseek-ai/DeepSeek-V4.1-Flash' and has been paused by the circuit breaker. Retry later 
- DeepSeek-V4.1-Flash A shared pad 2000 chain-forward #2: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 429 {"error":{"message":"Rate limit exceeded","type":"rate_limit_error","param":null,"code":"rate_limit_exceeded"}}
- DeepSeek-V4.1-Flash A shared pad 2000 chain-reverse #3: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 503 {"error":"Provider 'baseten' is currently failing for model 'deepseek-ai/DeepSeek-V4.1-Flash' and has been paused by the circuit breaker. Retry later 
- DeepSeek-V4.1-Flash B chain-forward #2: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 503 {"error":"Provider 'baseten' is currently failing for model 'deepseek-ai/DeepSeek-V4.1-Flash' and has been paused by the circuit breaker. Retry later 
- DeepSeek-V4.1-Flash B pad 2000 chain-forward #3: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 503 {"error":"Provider 'baseten' is currently failing for model 'deepseek-ai/DeepSeek-V4.1-Flash' and has been paused by the circuit breaker. Retry later 
- DeepSeek-V4.1-Flash C lenient chain-forward #2: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 429 {"error":{"message":"Rate limit exceeded","type":"rate_limit_error","param":null,"code":"rate_limit_exceeded"}}
- DeepSeek-V4.1-Flash C lenient chain-forward #3: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 429 {"error":{"message":"Rate limit exceeded","type":"rate_limit_error","param":null,"code":"rate_limit_exceeded"}}
- DeepSeek-V4.1-Flash C lenient chain-reverse #3: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 429 {"error":{"message":"Rate limit exceeded","type":"rate_limit_error","param":null,"code":"rate_limit_exceeded"}}
- DeepSeek-V4.1-Flash C lenient pad 2000 chain-forward #3: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 429 {"error":{"message":"Rate limit exceeded","type":"rate_limit_error","param":null,"code":"rate_limit_exceeded"}}
- DeepSeek-V4.1-Flash C lenient pad 2000 chain-forward #2: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 429 {"error":{"message":"Rate limit exceeded","type":"rate_limit_error","param":null,"code":"rate_limit_exceeded"}}
