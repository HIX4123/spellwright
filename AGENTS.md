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
