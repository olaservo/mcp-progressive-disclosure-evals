# Review of the demo against #19, #22 and the WG docs, 2026-11-08

Checked: README, NOTES, both draft comments, `src/groups.ts`, `src/variants.ts`, `src/catalog.ts`, `scripts/select.ts`, `scripts/compare.ts`, the result summaries, #19 at `15b2a5c`, #22 at `5e9ff2f`, every comment and review thread on both PRs, `docs/decisions.md`, `docs/problem-statement.md`, `docs/experimental-findings.md` and `CONTRIBUTING.md` on WG `main` at `f1ccefa`, the Skills extension spec at `_mcp/ext-skills` `649f7ae`, and cloudflare/mcp's README at `4938f2f3`. Neither PR head has moved since the demo was built, and there are no new comments on either since 2026-11-07.

## What holds

- The wire shapes match the SEP: `io.modelcontextprotocol/groups`, `groups/list` and `groups/get`, primitives directly on the result, `-32002` for an unknown group, nested groups fetched by their own name, per-request client capabilities deciding the view, flattened `tools/list` for a client that did not negotiate, scoped tools callable without `groups/get`. The compare script asserts each of these and the asserts pass on the deployed Workers.
- Option 2 follows #22's Example 3 exactly: group named after the skill, tools scoped, `SKILL.md` as an ordinary resource, instructions about the group's own tools, skill verified through `skills/get` and `read`.
- The README's tables match the `.txt` summaries in `results/` for every cell I checked (subset and full groups, hosted; full flat, hosted; schema control, hosted; open-model groups at both sizes; Jev; Gemini).
- The limits section is honest about sample size, product naming, templated descriptions, scoring judgment and the answer format.
- The demo fills gaps the SEP names. Its "Early prototype evidence" says "No frontier models were tested" and cites one 19-tool server. The demo adds ten hosted models and a 3,036-tool catalog, on the shipped 2.x SDK where the WG prototype targets 1.x.

## Where the findings outrun the method

### The flat control never shows the skill index

`scripts/select.ts` in `flat` and `flat-schemas` mode shows tool names or schemas only. The `flat` variant serves five skills over the Skills extension, and `compare.ts` counts that index in flat's upfront tokens, but the selection prompt omits it. The knowledge task ("review our stateful coordination class") therefore has no right answer in flat mode except a Durable Objects list tool, and the README and the #19 draft read the resulting misses as "a flat tool list has no entry for a skill". A Skills-extension client would have shown the five skill names and descriptions at about 100 tokens.

Size of the effect: one task of 20 in the second set for most models, five samples of 70 in the first. Claude Opus's first-set flat score of 64/70 has five of its six misses on that one task. Corrected, flat and groups are equal for Opus, which makes the "groups do not improve selection" conclusion stronger, not weaker.

Fix: add `skills/list` names and descriptions to the flat prompts and re-run the names-only modes (cheap), or drop that task from cross-mode comparisons, and rewrite the sentence in the README and the #19 draft. The schema control is the expensive one to re-run; its flat-mode misses on that task can be footnoted instead.

### One sample of twenty tasks cannot separate one-task differences

The limits section says to read cells as tasks. Several bullets still narrate one-point gaps: "one above for DeepSeek and the 9B model", "cost Sonnet, Luna, Argon and Kimi one or two tasks", "at or below the 139 groups for every model but Kimi". With n=20 and one sample, two cells that differ by one or two are the same result. Report a difference only at three or more, and say "within two" otherwise.

What survives that bar:

- 1.38M tokens flat against 5.3k to 5.5k for 139 groups, deterministic.
- Haiku 5.5 at effort low and Qwen 3.5 9B collapse in every flat mode (7, 4, 1 and 12, 8, 9 of 20) and hold 18 and 10 of 20 in groups mode.
- The 139 templated descriptions cost Qwen3 14B and Qwen3.6 35B-A3B four to six tasks on the indirect set; the hosted models lost zero to two.
- Jev 18 to 13 at 13 to 139 groups.
- The split between the skill group and the API group where both are accepted.

### The 139-group drop is a measurement of descriptions the SEP already says not to write

The toolset descriptions are "Call the Cloudflare X API directly. Use to read or change X resources in an account." The SEP says a description "SHOULD carry the task vocabulary a user is likely to use". So the drop at 139 groups shows what happens when a server ignores that SHOULD. The #19 draft frames it that way in one sentence, which is right, but the headline "139 groups cost up to 6 of 20" should carry the qualifier with it. The most useful follow-up, and a cheap one, is to write real descriptions for the ten or so confusable products (queues against pipelines, D1 against Hyperdrive and SQL, Workers against containers and builds) and re-run groups mode at 139 with the open models. That would turn the SEP's SHOULD into evidence either way.

### `demo_info` is a first-listed-tool attractor

Haiku's and the 9B model's flat collapses are mostly answers of `demo_info`, the first tool in every list, whose description is about the server. A real server's first tool would be something else. The README says so under the hosted table. The #19 draft says "by answering with the first tool listed" without the caveat. Add it. A second cheap check: run Haiku's flat modes once at default effort. If the collapse is an effort-low artifact, the draft should not present it as a model property.

### The Option 3 breakage depends on an identifier choice #22 never made

`variants.ts` serves Option 3 under `io.modelcontextprotocol/skills`, the SEP-2640 identifier. #22 says only that the methods become `skills/list` and `skills/get`. The SEP's own Backward Compatibility section says a breaking change "would ship under a new identifier". If the rename takes a new identifier, no SEP-2640 client crashes; it sees a server with no skills, which is the migration cost #22's table already lists. The #22 draft's bullet states the identifier choice but presents the crash as confirming the "breaking change" row. Reframe: the crash is one outcome of the rename, conditional on reusing the identifier. The part that holds either way is the second half of the bullet, that a `SKILL.md` body delivered as `instructions` loses its entry, digests and root for relative links. #22's "Group instructions without a skill" section and the SEP's "Relationship to the Skills extension" already say this, so the demo confirms it rather than adds it.

### The flat baseline is a configuration Cloudflare tells users not to run

cloudflare/mcp ships code mode by default: three tools, about 1,100 tokens. `codemode=false` is documented as an escape hatch for composing with another code-mode system, with a warning about token cost. Cloudflare's own README table gives 1,170,523 tokens for 2,594 tools with full schemas, which agrees with the demo's 1,378,777 for 3,036. The README calls `flat` "Today's cloudflare/mcp direct-tool mode", which is accurate but the #19 draft never mentions code mode. A reader at the WG will know the Cloudflare server and will ask why groups are compared with a mode nobody runs instead of with the `search` and `execute` pair. The SEP has a "Progressive disclosure vs. tool search" section and the problem statement's criterion 6 lists code mode. One sentence in the draft naming code mode as the comparison the demo does not make would pre-empt that, and the comparison itself is the obvious next experiment: the same 20 tasks against `search`, scored on whether the first query finds the right endpoint, with tokens counted.

### Scope against the WG's evaluation criteria

`docs/problem-statement.md` asks for initial context size, total token usage, end-to-end latency and task completion across catalog sizes. The demo measures the first and part of the second. No latency, no completion. The #19 draft says "a selection trial, not task completion", which is enough, but the README's "Observed" section should say the same once.

## Smaller points

- #22's Background and capability table say `group/list` and `group/get`. `docs/decisions.md` on `main`, an accepted decision, also says `group/get` and `group/list`. The SEP's Naming section says `groups/list` and `groups/get`. This is a WG-level inconsistency between an accepted decision and the SEP, not a typo in #22. The #22 draft should say so and point at the decision log.
- The placement collision is an SDK default, not a spec conflict. The Skills spec never requires `SKILL.md` in `resources/list`; it says `skills/list` is the authoritative record and that skill files are "ordinary resources" to a client without the extension. The #22 draft's framing ("by default") is right. The proposed rule can shrink to the one new sentence, that `skills/list` does not count as a listing for placement, since the "not also in `resources/list` where a group scopes it" half is what the SEP's placement rule already says for every resource.
- `groups/get` returns `cacheScope: "public"`. The SEP says it "will generally be private". Harmless here, since contents do not vary by caller, but a reader may flag it. One line in the README.
- The accept-either scoring hides the skill-group against API-group split, and the README then reports the split separately. Fine, but the two numbers should sit next to each other in the draft so a reader does not take 20/20 as "every model agreed".
- The Decisions API and Jev section in the #19 draft ends with a suggestion that "a host could route to a group with a classifier call before the agent model reads anything". The SEP has a section declining to prescribe host behaviour. Keep the measurement, drop the host suggestion from the SEP thread, or move it to the IG findings.
- The `-api` suffix and the `durable-objects` / `durable-objects-api` overlap are the demo's choices and the README says so. The SEP permits a group to reuse a skill's name, so the collision is one a real server would hit too, which makes the rule-of-thumb point in the #22 draft a fair one.

## Is it useful to share, and where

Yes. The two authors revised both docs on 2026-11-07 and added the evidence section with a single 19-tool data point and "No frontier models were tested". `docs/experimental-findings.md` on `main` is an empty page under a heading the IG says it wants filled. `CONTRIBUTING.md` asks for findings with enough detail to reproduce, the clients and servers tested, and what worked, did not, and remains untested. The README already meets that bar.

Three things before posting:

1. Make the repo public, or the "happy to share the code" closer and the reproducibility claim do not hold. CONTRIBUTING's first guideline is reproducibility.
2. Split the #19 draft. It is about 1,100 words with three tables, twice the length of the comment it answers. Post a short comment on #19 with the setup, the token table, the two or three selection results that survive the sample-size bar, the limits, and a link. Put the full write-up where CONTRIBUTING says findings go: a GitHub Discussion in the WG repo, or a PR adding a section to `docs/experimental-findings.md`. The classifier results, the skill-group split and the schema-dominates-task-load point belong in the long version.
3. Apply the fixes above to both drafts: the skill-index sentence, the one-task differences, the identifier caveat on Option 3, the code-mode sentence, the `group/*` decision-log pointer.

What the demo adds that nobody else in the thread has: Option 2 built on the shipped SDK, which is how the `resources/list` collision surfaced; the Cloudflare catalog at full size; ten hosted models; the skill-group against API-group split as a concrete question for #22's rule of thumb; and the observation that 24 schemas cost as much as a skill body, which is evidence for the SEP's "keep hierarchies shallow" guidance.

What it does not add, and should not claim: that groups improve selection (they do not, and the data says so), that Option 3 is unworkable (one identifier choice crashes one client), or that the flat baseline is what Cloudflare ships.
