## AGENTS.md — term-first information architecture

- Wiki index summaries were independently maintained and six differed from their topic documents. Added canonical preview synchronization and equality checks; historical aliases are preserved. The current index is synchronized to article summaries.
- The maintenance gate did not enumerate derived timeline descriptions, graph nodes/edges, incoming references or Open Questions. Added a change-impact command, per-page review receipts, CI gating and a required update workflow.
- Source ownership alone did not establish when derived pages were checked. Added separate page-update and related-review timestamps; unknown historical reviews remain unrecorded rather than being backfilled as approvals.

## README.md — Story & World wiki and design data workflow

- Linked article lists reused index previews while world/personal chronology and flow labels remained independently authored. Added input fingerprints covering explicit links, term mentions and renderer imports, with mandatory human comparison of those separate representations.
- Existing tests checked valid links/titles and selected episode presence, but did not reject stale summaries or unreviewed dependent changes. Added same-timestamp source-mutation, reference-change, preview-sync and renderer-propagation regressions.
- Remaining content ambiguity: the third-act episode list places human Ur's companionship after the final battle/separation, while his article describes companionship before inheritance. Disclosure order is not specified; this task does not invent a new canonical event order. It remains a manual design question, not something timestamps or graph traversal can resolve.

## docs/data/RELATIONSHIPS.md

- Its separation of hierarchy, dependency and sequence must also be respected during impact review; references discovered for review are not inserted as gameplay dependency edges. No game graph edges are modified by this change.
