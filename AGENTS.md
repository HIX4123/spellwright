# Dashboard content

- Use native HTML and SVG to make design relationships intuitive. Prefer diagrams for spatial or geometric concepts, comparison layouts for contrasts, and structured sections for story progression when they clarify the content.
- Do not accumulate long prose as the default representation or add decorative interaction without a useful purpose. Keep supporting explanations concise and accessible on mobile and in both themes.
- Keep content in repository data. Story & World is a read-only reference updated through design discussion, not a browser text editor.
- Distinguish confirmed decisions, current proposals, and unresolved questions. A diagram must not imply that an undecided ability or rule is established.

## Term-first information architecture (standing rule for all dashboard updates)

- **Lead with a glossary or compact index.** The first view of any growing domain must let readers scan the term, one-line meaning, status and location of detail; no repeated walls of text or five full descriptions on the overview.
- **One term, one canonical detailed explanation.** Keep the full definition, symbolism/motifs, gameplay or narrative implications and unresolved questions together under that term's stable URL. Cross-link related terms instead of repeating sections across tabs.
- **Separate browsing dimensions from ownership.** Motif, worldbuilding, gameplay and exceptions are headings within a term document, not parallel tabs that each duplicate every term. An index may contain short previews, never competing source paragraphs.
- **Keep source fields canonical.** Attribute entries live in `docs/data/project.json` under `elements`, shared initiation rules under `attributeRules`; the Attributes glossary is a read-only renderer. Story & World retains its own wiki topic JSON documents. Do not silently clone either dataset into UI constants or new docs.
- **Distinguish confirmed vs proposed vs unresolved at the claim/section level.** Never promote design examples, projection role hypotheses or symbolic analogies to confirmed rules just because they appear beside a confirmed term.
- **Preserve discoverability.** Stable term IDs, concise index summaries, internal headings/deep links, related-article links and old URL compatibility are expected. Keep the index usable on narrow screens in light and dark themes.
- **Maintenance gate.** When adding substantially more content, add or update a term document and its preview rather than lengthening an overview. Test routing, references, content escaping, source integrity and regression behavior; keep the full atlas/simulator out of the glossary.

## Global projection serial invariants

- All 43 geometric classes use the stable key `<solid-id>:<local-class-id>`, the existing symmetry-reduced rotation-distance matrix and one shared 1D MDS embedding. Display `#000–#999` IDs are cyclic coordinates with **one independent phase origin per Platonic solid**; they are not literal per-class manual swaps.
- The locked five anchor IDs are `tetrahedron:3` **#000** (해리·정립), `cube:1` **#001** (소외·지향), `octahedron:1` **#002** (초조·추진), `dodecahedron:1` **#003** (고착·결속), and `icosahedron:1` **#004** (반추·보존). They correspond to the previous global-phase IDs #000, #627, #145, #162 and #163.
- For each solid use `(previousGlobalSerial - previousSolidAnchorSerial + newSolidAnchorSerial + 1000) % 1000`. Reserve the five anchors, then assign the closest free circular ID to non-anchor collisions (for the 2026-10-20 dataset, `dodecahedron:4` becomes #999). Preserve geometric class IDs, source views, asset filenames and source MDS distances.
- The original unshifted tetrahedral origin was #401 for the 2026-10-20 dataset. All selector IDs, thumbnails, searches and periodic-table positions must consume the same `globalProjectionSerialLayout` result. Change front-end import cache versions when modifying serial logic.
- All 4 Haeri quadrant roles, 6 Soeoe A₂ roles, and 6 Chojo 3A₁ roles in `docs/data/projections.json` are confirmed. Other 27 projection role labels (고착·반추) are drafts. Chojo uses six roots, not its eight Weyl chambers; inverse roots correspond to independent operators, not zero-cost inversion engravings. Complete initiation operators for the other attributes **before** defining development-stage engravings or karma costs.

## Magic reproduction catalog (2026-10-24)

- Each external ability test is stored once in `docs/data/project.json.magicTrials`, and rendered as a short expandable case in Systems. A technique case never confirms an undecided projection power.
- Keep adopted motion principles separate from the generic/specialized engraving syntax proposals. All 27 Gochak/Banchu projections remain provisional, even when working words like 편입 or 동조 are used.
- Gochak graph edges are metaphysical references, not physical shortcuts between spaces. Topos's cutting/rejoining of spacetime is distinct from the magic graph.
- Banchu's representation, sensory and mental expansion is pending; preserve the canonical magical action-history scope until explicitly redesigned.
