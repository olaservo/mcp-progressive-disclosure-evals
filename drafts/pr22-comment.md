# Draft comment for progressive-disclosure-wg#22, at `5e9ff2f`

Post as a review comment on the "Interop rules" section, or as a top-level PR comment. Everything below the rule is the comment.

---

I built Option 2 as Example 3 describes it. The server runs on the TypeScript SDK 2.4.0 with its native Skills extension, plus a groups implementation that follows #19 at `15b2a5c`. It serves 238 of the Cloudflare API server's generated tools and five skills from cloudflare/skills. The `turnstile-spin` group takes the skill's name, scopes its six tools, and lists `skill://turnstile-spin/SKILL.md` in `resources`. A host that confirms the reference with `skills/get` reads the skill with its digests verified, and the scoped tools work on a connection that never issued `groups/get`. That part works as written.

One interop point is missing. The SEP's placement rule says a resource is either in `resources/list` or scoped to a group, never both in one view. The SDK's `SkillCatalog` lists every SKILL.md in `resources/list` by default, so adding a group that lists a skill breaks the rule unless the server stops listing the skill there. I ended up with a `SkillSource` that has no `listResources`, so the skill appears only in `skills/list`. The placement rule names `tools/list`, `prompts/list` and `resources/list`, and neither document says whether `skills/list` counts as a listing.

I'd add one sentence here and in the SEP's Placement section: "For placement, `skills/list` is not a listing. A skill a group lists stays in `skills/list`." The rest follows from the existing rule. The rule's view qualifier matters here: a client that did not negotiate groups gets the flattened catalog, and if it has no Skills extension either, `resources/list` is how it finds skills. The SDK cannot yet list a SKILL.md in one view and not the other.

Three smaller things:

- On Option 3, I served the same bundles under `skills/list` and `skills/get`, with each SKILL.md folder flattened to `instructions` plus scoped resources, as the option describes. It costs the same tokens as Option 2. What the flattening loses is the skill's entry, its digests, and the root for its seven `references/*.md` links; the response does not say that `skill://turnstile-spin/` is their base. That is the mapping contract in the table, in concrete form. "Group instructions without a skill" already says most of this.
- The Background prose and the capability table say `group/list` and `group/get` (lines 28, 29, 40 and 54). The examples and the SEP's Naming section say `groups/list` and `groups/get`. The accepted decision in `docs/decisions.md` (2026-10-27) has the singular. The SEP and the decision log disagree, and one of them should change.
- For the rule of thumb: my server offers both a workflow group that lists the Turnstile skill and a plain `turnstile-api` toolset group. In a selection trial, models split between them by task: setting up Turnstile went to the skill group, rotating a leaked secret to the API group. A server that offers both for one product should say in the descriptions which to load when, or offer one.
