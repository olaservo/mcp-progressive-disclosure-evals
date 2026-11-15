Agent runs: 13 files, 260 sessions, 5205 requests. A phase is done when its rubric in agent-tasks.ts holds over the calls the server accepted during it. A full task is a session's first 3 or all 6 phases done. Arguments are valid when they pass the tool's published input schema; rejected calls are those the server answered with an error.

| Model | Arm | Sessions | Errors | Phases done | Full task, 3 phases | Full task, every phase | Median requests | Group opens per session | Server tool calls | Valid arguments | Rejected by server |
| :-- | :-- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: |
| sonnet-5-5 | ref-groups-rec | 15 | 0 | 90/90 | 15/15 | 15/15 | 23 | 4.87 | 147 | - | 0% |
| sonnet-5-5 | ref-flat-toolsearch | 5 | 0 | 30/30 | 5/5 | 5/5 | 18 | 0.00 | 53 | - | 6% |
| DeepSeek-V4.1-Flash | A | 15 | 0 | 90/90 | 15/15 | 15/15 | 15 | 0.00 | 147 | 99% | 0% |
| DeepSeek-V4.1-Flash | B | 15 | 0 | 87/90 | 13/15 | 13/15 | 19 | 5.00 | 144 | 98% | 0% |
| DeepSeek-V4.1-Flash | C | 15 | 0 | 90/90 | 15/15 | 15/15 | 20 | 5.20 | 149 | 98% | 0% |
| DeepSeek-V4.1-Flash | A shared | 15 | 0 | 90/90 | 15/15 | 15/15 | 15 | 0.00 | 145 | 98% | 0% |
| DeepSeek-V4.1-Flash | B shared | 15 | 0 | 90/90 | 15/15 | 15/15 | 19 | 5.00 | 148 | 98% | 0% |
| DeepSeek-V4.1-Flash | C shared | 15 | 0 | 88/90 | 14/15 | 14/15 | 19 | 5.00 | 145 | 98% | 0% |
| gemma-4-26B-A4B-it | B | 15 | 0 | 49/90 | 0/15 | 0/15 | 20 | 4.73 | 155 | 51% | 4% |
| gemma-4-26B-A4B-it | C | 15 | 0 | 64/90 | 6/15 | 2/15 | 21 | 5.00 | 149 | 70% | 5% |
| Qwen3.6-35B-A3B | B | 15 | 0 | 48/90 | 0/15 | 0/15 | 23 | 5.27 | 171 | 55% | 9% |
| Qwen3.6-35B-A3B | C | 15 | 0 | 84/90 | 11/15 | 9/15 | 24 | 5.53 | 152 | 97% | 1% |
| GLM-5.3-Flash | A | 15 | 0 | 86/90 | 12/15 | 11/15 | 16 | 0.00 | 150 | 95% | 2% |
| GLM-5.3-Flash | B | 15 | 0 | 88/90 | 13/15 | 13/15 | 20 | 5.00 | 154 | 96% | 0% |
| GLM-5.3-Flash | C | 15 | 0 | 81/90 | 11/15 | 11/15 | 20 | 5.00 | 140 | 99% | 1% |
| GLM-5.3-Flash | A shared | 15 | 2 | 81/84 | 13/14 | 10/13 | 16 | 0.00 | 142 | 96% | 2% |
| GLM-5.3-Flash | B shared | 15 | 0 | 85/90 | 10/15 | 10/15 | 21 | 5.00 | 153 | 95% | 2% |
| GLM-5.3-Flash | C shared | 15 | 0 | 87/90 | 12/15 | 12/15 | 22 | 5.00 | 164 | 97% | 9% |

Cumulative cost in USD at list price through each phase, mean over the sessions that ran all 6 phases:

| Model | Arm | Sessions | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Phase 6 |
| :-- | :-- | --: | --: | --: | --: | --: | --: | --: |
| sonnet-5-5 | ref-groups-rec | 15 | 0.0419 | 0.0667 | 0.0929 | 0.1185 | 0.1399 | 0.1713 |
| sonnet-5-5 | ref-flat-toolsearch | 5 | 0.0714 | 0.0935 | 0.1168 | 0.1473 | 0.1665 | 0.2081 |
| DeepSeek-V4.1-Flash | A | 15 | 0.0657 | 0.0703 | 0.0745 | 0.0795 | 0.0833 | 0.0871 |
| DeepSeek-V4.1-Flash | B | 15 | 0.0045 | 0.0079 | 0.0112 | 0.0151 | 0.0164 | 0.0223 |
| DeepSeek-V4.1-Flash | C | 15 | 0.0041 | 0.0070 | 0.0090 | 0.0116 | 0.0132 | 0.0167 |
| DeepSeek-V4.1-Flash | A shared | 15 | 0.0063 | 0.0106 | 0.0146 | 0.0194 | 0.0231 | 0.0269 |
| DeepSeek-V4.1-Flash | B shared | 15 | 0.0022 | 0.0045 | 0.0069 | 0.0099 | 0.0108 | 0.0148 |
| DeepSeek-V4.1-Flash | C shared | 15 | 0.0039 | 0.0066 | 0.0086 | 0.0113 | 0.0123 | 0.0158 |
| gemma-4-26B-A4B-it | B | 15 | 0.0018 | 0.0049 | 0.0083 | 0.0139 | 0.0169 | 0.0211 |
| gemma-4-26B-A4B-it | C | 15 | 0.0027 | 0.0062 | 0.0111 | 0.0181 | 0.0246 | 0.0327 |
| Qwen3.6-35B-A3B | B | 15 | 0.0043 | 0.0116 | 0.0204 | 0.0311 | 0.0389 | 0.0532 |
| Qwen3.6-35B-A3B | C | 15 | 0.0042 | 0.0110 | 0.0185 | 0.0282 | 0.0372 | 0.0512 |
| GLM-5.3-Flash | A | 15 | 0.0436 | 0.0616 | 0.0760 | 0.0928 | 0.1073 | 0.1206 |
| GLM-5.3-Flash | B | 15 | 0.0036 | 0.0075 | 0.0117 | 0.0164 | 0.0182 | 0.0233 |
| GLM-5.3-Flash | C | 15 | 0.0024 | 0.0049 | 0.0077 | 0.0109 | 0.0129 | 0.0169 |
| GLM-5.3-Flash | A shared | 13 | 0.0317 | 0.0483 | 0.0626 | 0.0793 | 0.0937 | 0.1067 |
| GLM-5.3-Flash | B shared | 15 | 0.0036 | 0.0079 | 0.0125 | 0.0183 | 0.0210 | 0.0273 |
| GLM-5.3-Flash | C shared | 15 | 0.0030 | 0.0063 | 0.0091 | 0.0123 | 0.0149 | 0.0195 |

Cumulative input tokens through each phase, mean over the sessions that ran all 6 phases:

| Model | Arm | Sessions | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Phase 6 |
| :-- | :-- | --: | --: | --: | --: | --: | --: | --: |
| sonnet-5-5 | ref-groups-rec | 15 | 72.6k | 154.4k | 256.6k | 359.4k | 439.8k | 564.6k |
| sonnet-5-5 | ref-flat-toolsearch | 5 | 64.7k | 135.6k | 219.0k | 303.4k | 377.3k | 485.8k |
| DeepSeek-V4.1-Flash | A | 15 | 669.1k | 1.21M | 1.70M | 2.25M | 2.68M | 3.13M |
| DeepSeek-V4.1-Flash | B | 15 | 28.6k | 78.9k | 144.5k | 233.2k | 296.4k | 400.7k |
| DeepSeek-V4.1-Flash | C | 15 | 30.7k | 87.4k | 151.1k | 236.2k | 298.3k | 406.0k |
| DeepSeek-V4.1-Flash | A shared | 15 | 668.8k | 1.19M | 1.67M | 2.20M | 2.65M | 3.10M |
| DeepSeek-V4.1-Flash | B shared | 15 | 31.1k | 89.2k | 160.4k | 243.9k | 301.3k | 404.2k |
| DeepSeek-V4.1-Flash | C shared | 15 | 30.0k | 83.3k | 147.6k | 233.2k | 290.3k | 388.5k |
| gemma-4-26B-A4B-it | B | 15 | 25.1k | 67.4k | 116.0k | 194.2k | 236.1k | 295.9k |
| gemma-4-26B-A4B-it | C | 15 | 36.8k | 86.1k | 154.6k | 254.4k | 346.0k | 461.0k |
| Qwen3.6-35B-A3B | B | 15 | 39.8k | 110.9k | 196.3k | 301.5k | 377.2k | 518.3k |
| Qwen3.6-35B-A3B | C | 15 | 38.3k | 103.8k | 175.8k | 270.4k | 358.0k | 495.6k |
| GLM-5.3-Flash | A | 15 | 658.1k | 1.20M | 1.68M | 2.23M | 2.71M | 3.15M |
| GLM-5.3-Flash | B | 15 | 33.4k | 89.8k | 158.5k | 247.2k | 301.4k | 395.5k |
| GLM-5.3-Flash | C | 15 | 34.3k | 91.8k | 160.0k | 246.2k | 307.3k | 408.6k |
| GLM-5.3-Flash | A shared | 13 | 683.7k | 1.23M | 1.71M | 2.26M | 2.73M | 3.16M |
| GLM-5.3-Flash | B shared | 15 | 33.8k | 90.1k | 158.7k | 249.6k | 309.9k | 408.8k |
| GLM-5.3-Flash | C shared | 15 | 35.6k | 88.1k | 148.9k | 227.3k | 283.7k | 372.7k |

Cumulative input tokens not read from cache through each phase, mean over the sessions that ran all 6 phases:

| Model | Arm | Sessions | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Phase 6 |
| :-- | :-- | --: | --: | --: | --: | --: | --: | --: |
| sonnet-5-5 | ref-groups-rec | 15 | 7.1k | 10.0k | 12.6k | 15.3k | 17.5k | 21.2k |
| sonnet-5-5 | ref-flat-toolsearch | 5 | 15.1k | 17.5k | 19.9k | 24.3k | 26.2k | 33.1k |
| DeepSeek-V4.1-Flash | A | 15 | 206.2k | 207.3k | 208.3k | 210.6k | 211.6k | 212.6k |
| DeepSeek-V4.1-Flash | B | 15 | 13.1k | 22.0k | 30.1k | 40.0k | 41.5k | 58.1k |
| DeepSeek-V4.1-Flash | C | 15 | 11.5k | 18.6k | 22.5k | 27.9k | 30.7k | 38.8k |
| DeepSeek-V4.1-Flash | A shared | 15 | 3.6k | 4.6k | 5.5k | 7.8k | 8.6k | 9.6k |
| DeepSeek-V4.1-Flash | B shared | 15 | 5.1k | 10.3k | 15.5k | 22.4k | 23.2k | 33.0k |
| DeepSeek-V4.1-Flash | C shared | 15 | 10.8k | 17.4k | 21.3k | 27.1k | 28.2k | 36.3k |
| gemma-4-26B-A4B-it | B | 15 | 25.1k | 67.4k | 116.0k | 194.2k | 236.1k | 295.9k |
| gemma-4-26B-A4B-it | C | 15 | 36.8k | 86.1k | 154.6k | 254.4k | 346.0k | 461.0k |
| Qwen3.6-35B-A3B | B | 15 | 22.5k | 50.8k | 77.1k | 109.5k | 124.3k | 182.2k |
| Qwen3.6-35B-A3B | C | 15 | 31.0k | 83.9k | 122.7k | 169.4k | 202.6k | 273.0k |
| GLM-5.3-Flash | A | 15 | 197.9k | 211.8k | 212.3k | 212.8k | 213.4k | 213.9k |
| GLM-5.3-Flash | B | 15 | 20.5k | 38.3k | 55.3k | 71.8k | 72.5k | 90.6k |
| GLM-5.3-Flash | C | 15 | 10.2k | 16.1k | 21.1k | 24.9k | 25.6k | 32.7k |
| GLM-5.3-Flash | A shared | 13 | 92.3k | 92.9k | 93.5k | 94.0k | 94.6k | 95.0k |
| GLM-5.3-Flash | B shared | 15 | 20.9k | 41.9k | 61.8k | 87.4k | 93.8k | 120.8k |
| GLM-5.3-Flash | C shared | 15 | 15.2k | 28.4k | 35.7k | 42.0k | 48.3k | 64.0k |

The request after a group open against a session's other requests. Re-read tokens are the part of the previous request's prompt not served from cache. The first request of a session is left out.

| Model | Arm | Requests after an open | Median re-read tokens | Median re-read share | Requests with over half re-read | Median first token ms | Other requests | Median re-read tokens | Median re-read share | Requests with over half re-read | Median first token ms |
| :-- | :-- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: |
| sonnet-5-5 | ref-groups-rec | 72 | 2 | 0% | 0 | 1647 | 267 | 2 | 0% | 0 | 1973 |
| sonnet-5-5 | ref-flat-toolsearch | 0 | 0 | - | 0 | 0 | 87 | 2 | 0% | 0 | 1815 |
| DeepSeek-V4.1-Flash | A | 0 | 0 | - | 0 | 0 | 211 | 133 | 0% | 0 | 1035 |
| DeepSeek-V4.1-Flash | B | 75 | 3.0k | 21% | 19 | 506 | 191 | 126 | 1% | 0 | 344 |
| DeepSeek-V4.1-Flash | C | 78 | 110 | 1% | 1 | 442 | 200 | 141 | 1% | 0 | 347 |
| DeepSeek-V4.1-Flash | A shared | 0 | 0 | - | 0 | 0 | 209 | 138 | 0% | 0 | 933 |
| DeepSeek-V4.1-Flash | B shared | 75 | 521 | 2% | 5 | 420 | 194 | 151 | 1% | 0 | 373 |
| DeepSeek-V4.1-Flash | C shared | 75 | 103 | 1% | 0 | 382 | 198 | 135 | 1% | 0 | 349 |
| gemma-4-26B-A4B-it | B | 71 | 9.8k | 100% | 71 | 1007 | 228 | 14.2k | 100% | 228 | 787 |
| gemma-4-26B-A4B-it | C | 75 | 15.2k | 100% | 75 | 927 | 232 | 21.5k | 100% | 232 | 685 |
| Qwen3.6-35B-A3B | B | 79 | 4.3k | 28% | 26 | 1352 | 256 | 4.3k | 24% | 63 | 998 |
| Qwen3.6-35B-A3B | C | 83 | 5.1k | 42% | 39 | 1108 | 259 | 9.2k | 56% | 145 | 1059 |
| GLM-5.3-Flash | A | 0 | 0 | - | 0 | 0 | 223 | 90 | 0% | 1 | 1257 |
| GLM-5.3-Flash | B | 75 | 6.8k | 52% | 39 | 1048 | 211 | 91 | 0% | 13 | 686 |
| GLM-5.3-Flash | C | 75 | 151 | 1% | 0 | 840 | 259 | 76 | 0% | 1 | 681 |
| GLM-5.3-Flash | A shared | 0 | 0 | - | 0 | 0 | 211 | 88 | 0% | 0 | 1463 |
| GLM-5.3-Flash | B shared | 75 | 6.0k | 51% | 39 | 1064 | 218 | 140 | 1% | 37 | 740 |
| GLM-5.3-Flash | C shared | 75 | 179 | 1% | 5 | 815 | 235 | 97 | 1% | 24 | 679 |

Phases done, by scenario and phase:

| Scenario | Phase | Groups | sonnet-5-5 ref-groups-rec | sonnet-5-5 ref-flat-toolsearch | DeepSeek-V4.1-Flash A | DeepSeek-V4.1-Flash B | DeepSeek-V4.1-Flash C | DeepSeek-V4.1-Flash A shared | DeepSeek-V4.1-Flash B shared | DeepSeek-V4.1-Flash C shared | gemma-4-26B-A4B-it B | gemma-4-26B-A4B-it C | Qwen3.6-35B-A3B B | Qwen3.6-35B-A3B C | GLM-5.3-Flash A | GLM-5.3-Flash B | GLM-5.3-Flash C | GLM-5.3-Flash A shared | GLM-5.3-Flash B shared | GLM-5.3-Flash C shared |
| :-- | --: | :-- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: |
| uploads | 1 | r2-buckets | 3/3 | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| uploads | 2 | queues-api | 3/3 | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 0/3 | 3/3 | 0/3 | 0/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| uploads | 3 | kv-api | 3/3 | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 0/3 | 3/3 | 2/3 | 3/3 | 0/3 | 3/3 | 1/3 | 0/3 |
| uploads | 4 | workers-secrets | 3/3 | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| uploads | 5 | r2-buckets | 3/3 | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 0/3 | 2/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| uploads | 6 | workers-core | 3/3 | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| shop-api | 1 | d1-api | 3/3 | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| shop-api | 2 | workers-routes | 3/3 | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 0/3 | 3/3 | 0/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| shop-api | 3 | workers-domains | 3/3 | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 0/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| shop-api | 4 | turnstile-api | 3/3 | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 0/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| shop-api | 5 | d1-api | 3/3 | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 | 0/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| shop-api | 6 | workers-deployments | 3/3 | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 0/3 | 3/3 | 0/3 | 1/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| resizer | 1 | containers-api | 3/3 | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 0/3 | 3/3 | 0/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| resizer | 2 | r2-buckets | 3/3 | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 0/3 | 0/3 | 0/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| resizer | 3 | kv-api | 3/3 | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 0/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/2 | 3/3 | 3/3 |
| resizer | 4 | queues-api | 3/3 | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/2 | 3/3 | 3/3 |
| resizer | 5 | containers-api | 3/3 | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 0/3 | 3/3 | 0/3 | 3/3 | 2/3 | 3/3 | 3/3 | 0/2 | 3/3 | 3/3 |
| resizer | 6 | durable-objects-api | 3/3 | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/2 | 3/3 | 3/3 |
| mail | 1 | email-routing-api | 3/3 | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/3 | 3/3 | 0/3 | 3/3 | 3/3 | 3/3 | 2/3 | 3/3 | 3/3 | 3/3 |
| mail | 2 | email-sending-api | 3/3 | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 0/3 | 3/3 | 0/3 | 3/3 | 3/3 | 3/3 | 2/3 | 3/3 | 3/3 | 3/3 |
| mail | 3 | workers-secrets | 3/3 | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 | 3/3 | 3/3 | 3/3 |
| mail | 4 | r2-objects | 3/3 | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 | 3/3 | 3/3 | 3/3 |
| mail | 5 | email-routing-api | 3/3 | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 0/3 | 0/3 | 0/3 | 3/3 | 3/3 | 3/3 | 2/3 | 3/3 | 3/3 | 3/3 |
| mail | 6 | workers-core | 3/3 | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 | 3/3 | 3/3 | 3/3 |
| migration | 1 | r2-buckets | 3/3 | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 0/3 | 0/3 | 0/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| migration | 2 | r2-super-slurper | 3/3 | 1/1 | 3/3 | 1/3 | 3/3 | 3/3 | 3/3 | 2/3 | 0/3 | 0/3 | 0/3 | 2/3 | 1/3 | 1/3 | 3/3 | 2/3 | 0/3 | 3/3 |
| migration | 3 | d1-api | 3/3 | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| migration | 4 | kv-api | 3/3 | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| migration | 5 | r2-super-slurper | 3/3 | 1/1 | 3/3 | 2/3 | 3/3 | 3/3 | 3/3 | 2/3 | 0/3 | 0/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/2 | 3/3 | 3/3 |
| migration | 6 | workers-legacy | 3/3 | 1/1 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 0/3 | 0/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/2 | 3/3 | 3/3 |

Sessions that ended in an error:
- GLM-5.3-Flash A uploads #3: zai-org/GLM-5.3-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- GLM-5.3-Flash A shop-api #1: zai-org/GLM-5.3-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- GLM-5.3-Flash A shop-api #2: zai-org/GLM-5.3-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- GLM-5.3-Flash A shop-api #3: zai-org/GLM-5.3-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- GLM-5.3-Flash A resizer #1: zai-org/GLM-5.3-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- GLM-5.3-Flash A resizer #2: zai-org/GLM-5.3-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- GLM-5.3-Flash A resizer #3: zai-org/GLM-5.3-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- GLM-5.3-Flash A mail #1: zai-org/GLM-5.3-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- GLM-5.3-Flash A mail #2: zai-org/GLM-5.3-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- GLM-5.3-Flash A mail #3: zai-org/GLM-5.3-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- GLM-5.3-Flash A migration #1: zai-org/GLM-5.3-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- GLM-5.3-Flash A migration #2: zai-org/GLM-5.3-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- GLM-5.3-Flash A migration #3: zai-org/GLM-5.3-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- DeepSeek-V4.1-Flash A uploads #1: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- DeepSeek-V4.1-Flash A uploads #2: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- DeepSeek-V4.1-Flash A uploads #3: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- DeepSeek-V4.1-Flash A shop-api #1: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- DeepSeek-V4.1-Flash A shop-api #2: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- DeepSeek-V4.1-Flash A shop-api #3: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- DeepSeek-V4.1-Flash A resizer #1: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- DeepSeek-V4.1-Flash A resizer #2: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- DeepSeek-V4.1-Flash A resizer #3: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- GLM-5.3-Flash A uploads #2: zai-org/GLM-5.3-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- DeepSeek-V4.1-Flash A mail #2: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- DeepSeek-V4.1-Flash A mail #1: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- DeepSeek-V4.1-Flash A mail #3: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- DeepSeek-V4.1-Flash A migration #1: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- DeepSeek-V4.1-Flash A migration #2: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- GLM-5.3-Flash A uploads #1: zai-org/GLM-5.3-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- DeepSeek-V4.1-Flash A migration #3: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- DeepSeek-V4.1-Flash A uploads #2: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 503 {"error":"Provider 'baseten' is currently failing for model 'deepseek-ai/DeepSeek-V4.1-Flash' and has been paused by the circuit breaker. Retry later 
- DeepSeek-V4.1-Flash A shared uploads #1: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- DeepSeek-V4.1-Flash A shared uploads #2: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- DeepSeek-V4.1-Flash A shared uploads #3: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- DeepSeek-V4.1-Flash A shared shop-api #1: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- DeepSeek-V4.1-Flash A shared shop-api #2: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- DeepSeek-V4.1-Flash A shared shop-api #3: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- DeepSeek-V4.1-Flash A shared resizer #1: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- DeepSeek-V4.1-Flash A shared resizer #2: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- DeepSeek-V4.1-Flash A shared resizer #3: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- DeepSeek-V4.1-Flash A shared mail #1: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- DeepSeek-V4.1-Flash A shared mail #2: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- DeepSeek-V4.1-Flash A shared mail #3: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- DeepSeek-V4.1-Flash A shared migration #1: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- GLM-5.3-Flash A shared migration #3: zai-org/GLM-5.3-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- DeepSeek-V4.1-Flash A shared migration #3: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- DeepSeek-V4.1-Flash A shared migration #2: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- GLM-5.3-Flash A shared resizer #1: zai-org/GLM-5.3-Flash:baseten: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- DeepSeek-V4.1-Flash A shared resizer #1: deepseek-ai/DeepSeek-V4.1-Flash:baseten: HTTP 429 {"error":{"message":"Rate limit exceeded","type":"rate_limit_error","param":null,"code":"rate_limit_exceeded"}}
- gemma-4-26B-A4B-it C migration #2: google/gemma-4-26B-A4B-it:deepinfra: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
- gemma-4-26B-A4B-it C migration #3: google/gemma-4-26B-A4B-it:deepinfra: HTTP 402 {"error":"Purchase pre-paid credits to continue using Inference Providers."}
