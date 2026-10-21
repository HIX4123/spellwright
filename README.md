# Spellwright

마법진을 직접 구성하고 영창하는 로그라이트 게임 프로젝트입니다.

현재 저장소의 첫 개발 산출물은 게임 시스템 설계를 추적하는 **Live Design Dashboard**입니다.

## Live Dashboard

**https://hix4123.github.io/spellwright/**

GitHub Pages는 `main` 브랜치의 `/docs` 디렉터리를 그대로 배포하는 구조를 사용합니다.

```text
spellwright/
├─ README.md
└─ docs/                  # GitHub Pages document root
   ├─ .nojekyll
   ├─ index.html          # /spellwright/ 진입점
   ├─ 404.html            # 잘못된 경로를 대시보드 루트로 복귀
   ├─ app.js              # 화면 렌더링과 편집 동작
   ├─ graph-model.mjs     # 관계 그래프의 순수 모델·레이아웃
   ├─ graph-layout.css
   ├─ styles.css
   └─ data/
      ├─ project.json     # 시스템·개요·미정 사항 데이터
      └─ relationships.json
```

사이트 내부의 자산과 데이터 경로는 모두 상대 경로를 사용하므로 GitHub Project Pages의 `/spellwright/` base path에서 동작합니다.

### Pages 설정

Repository **Settings → Pages**에서 다음 값만 지정하면 됩니다.

- **Source:** Deploy from a branch
- **Branch:** `main`
- **Folder:** `/docs`

## Design data workflow

`docs/data/project.json`은 시스템·프로젝트 개요·미정 사항을, `docs/data/wiki/`는 Story & World 표제어별 문서를 관리합니다.

대시보드에서 수정한 내용은 브라우저 `localStorage`에 로컬 초안으로 저장되며, 저장소의 공식 데이터 변경은 Git commit으로 관리합니다. 따라서 대시보드는 공개 조회용 UI이면서 동시에 설계 초안을 실험하는 프런트엔드 역할을 합니다.

그래프 모델의 최소 회귀 검사는 `node --test test/graph-model.test.mjs`로 실행합니다.

## Design data ownership (2026-10-11)

The dashboard now has eight sections: Overview, Story & World, Systems, Character, Attributes, Projections, Open Questions, and Archive. Legacy hash links are mapped to their merged views.

- `docs/data/project.json` owns system relationships, story overview canon, MVP scope, decisions and open questions. Story detail records are owned once by topic documents in `docs/data/wiki/`.
- `docs/data/stats.json` is the single source for character stat descriptions. System nodes with `statRef` use that source; the corresponding fields are read-only in the browser system editor.
- `docs/data/classes.json` is the single source for class drafts. Character composes the stat and class data without duplicating the records.
- Unknown historical edit dates remain unrecorded. Subsequent system edits set `lastModifiedAt` to the local edit date, while `lastModified` records the version.
- World questions are owned by `narrative.unresolved` and grouped by `questionGroups`; gameplay questions are owned by `openQuestions`. Both appear in Open Questions without copying source text.
- The browser editor persists local drafts only. Official updates require a Git commit of data files. Draft freshness includes both the project and stat data hashes; stale drafts are retained in a local backup.

Run `node --test test/*.test.mjs` after editing content or navigation.

## Worldbuilding / character reference notes (2026-10-16)

The **Story & World** area is now a topic wiki. Character documents own their names, motifs and designs; `ieumsae.json` owns founding notes; `creative-references.json` and `craft.json` retain references and narrative principles. Events and concepts are linked rather than repeated across tab bodies.

- **Interpretation statuses matter:** a motif source, analogy, IF scene, or speculative image is not automatically an adopted story event. The only timeline is the one described by the existing plot rules; "IF" comparisons are not additional histories.


## Narrative naming and visual direction (2026-10-19)

- **주인공:** 현행 통용 이름은 **카르**(로마자 **Kar**, 잠정). 옛 작업명 **카이**는 현행 화면에서 대체했다. 카르 자체가 본명인지, 카르-로 시작하는 긴 본명의 애칭인지는 미정이다. 내부 `kai*` 키와 `kai` 그래프 ID는 호환성을 위해 유지한다.
- **공동체:** 프레미아가 주도해 결성한 비공식 마법사 모임의 이름 **이음새**는 확정이다. 서로 다른 사람을 잇는 연결과 방황하는 마법사의 머물 틈새라는 중의성을 가진다. 스테인드글라스 접합은 비유이며 공식 엠블럼으로 확정하지 않았다.
- **엘로이 낙원:** 흐릿하거나 눈부신 드림코어보다 색채와 윤곽이 비정상적으로 또렷하고 인위적으로 완벽해서 이질적인 풍경을 지향한다. 미술 방향이며 정식 지형·장르 분류를 확정하지 않았다.
- 탐색한 과학 용어, 명칭 아나그램, 이전 후보는 참고 기록으로만 관리한다. 서사의 기존 사건과 연대표는 보존하며, 이전 연결 주소는 위키 문서로 연결한다.


## Story & World wiki (2026-10-19)

- `docs/data/wiki/index.json`: 문서 ID·표제어·분류·짧은 소개·검색 별칭과 기존 URL의 연결 대상.
- `docs/data/wiki/<id>.json`: 해당 표제어의 유일한 상세 원본. `sections`에 내용과 확정/검토/미정 상태를 두고 `related`에 관련 문서 ID를 지정합니다.
- 표제어·별칭이 본문에 나오면 긴 이름부터 해당 문서로 연결합니다. 자기 문서에는 링크를 만들지 않습니다. 새 별칭은 다른 표제어와 의미가 겹치지 않도록 고릅니다.
- 문서 주소는 `#story/wiki/<id>`, 절 주소는 `#story/wiki/<id>/<section-id>`입니다. 이름을 바꿔도 ID를 유지합니다. 기존 `#story/world/...`, `#story/cast/...`, `#story/plot/...` 링크도 대응 문서를 엽니다.
- 연대표의 사건 설명은 각 사건 문서에서 관리합니다. `chronology.json`은 사건 링크와 세계 연대기·교차 시간선만 관리합니다.
- 문서는 선택할 때 개별 로드하며, Story & World는 계속 읽기 전용입니다. 대시보드의 Project JSON 내보내기/가져오기는 시스템 초안과 개요를 대상으로 하며, 별도 위키 문서는 저장소에서 관리합니다.
- 검증: `node --test test/*.test.mjs`. 문서·링크·목차·기존 주소·HTML 이스케이프를 실제 데이터로 검사합니다.

## Attributes glossary and topic documents (2026-10-20)

- **Attributes** (`#attributes`) is a compact index: each of five terms has one row showing the Platonic solid, symbolic motto and one-line gameplay role. The only full description is on its dedicated page, e.g. `#attributes/wiki/haeri` or `#attributes/wiki/banchu`. Shared initiation/adjacency rules have their own topic page at `#attributes/wiki/rules`.
- Each attribute article groups **confirmed symbolism**, **exploratory maths and visual motifs**, **established manipulation domain**, **proposed combat examples**, and **unresolved constraints** together, using permanent subsection anchors such as `#attributes/wiki/banchu/mechanics`. Term links cross-reference other attributes and Projections. The older `#attributes/motifs` and `#attributes/gameplay` hashes lead safely to the index.
- Canonical descriptions remain in `docs/data/project.json` under `elements[*]` (stable `id`, short `summary`, `motto`, `loss`, `meaning`, `motifIdeas`, `gameplay`) and `attributeRules`. Index summaries are deliberately short; there are no per-term duplicate JSON documents. The 43 projection records remain in `docs/data/projections.json` and continue to appear in **Projections**; 16 Haeri/Soeoe/Chojo roles are confirmed, and 27 others remain hypotheses.
- The shared initiation rules are free choice of all five attributes and no extra attribute-selection charge; choosing the same or a linearly adjacent attribute on subsequent initiation confers an ultimate-related advantage. Its value, casting costs and projection roles remain undecided.
- **Maintenance rule:** For any growing dashboard topic, add one stable term article and a compact index preview, link related topics rather than replicate their descriptions across tabs, and mark decisions separately from hypotheses. This rule is recorded in `AGENTS.md` for future work. Run `node --test test/*.test.mjs` after updates.

## Confirmed Haeri initiation and serial rebasing (2026-10-20)

- Haeri separates the self from the world with a **2×2 grid**: 내재성 (내재/외재) × 배타성 (성립/배제). The four confirmed pairs are `tetrahedron:3` **정립** (내재, 성립), `tetrahedron:4` **분화** (내재, 배제), `tetrahedron:1` **수용** (외재, 성립), and `tetrahedron:2` **절연** (외재, 배제). Exact operator text is canonical in `docs/data/projections.json`; the Attributes Haeri glossary renders that source as a concise matrix.
- All 43 projection classes retain their shared symmetry-reduced **1D MDS** source coordinates and stable `<solid-id>:<class-id>` geometric keys. Their display IDs now use **separate modulo-1000 phase origins for each Platonic solid**, rather than one uniform global phase shift. The baseline anchors are 해리·정립 `tetrahedron:3` **#000** (previously #000), 소외·지향 `cube:1` **#001** (previously #627), 초조·추진 `octahedron:1` **#002** (previously #145), 고착·결속 `dodecahedron:1` **#003** (previously #162), 반추·보존 `icosahedron:1` **#004** (previously #163).
- Each solid uses `(oldGlobalSerial - oldSolidAnchorSerial + newSolidAnchorSerial + 1000) % 1000`. All five anchor slots are reserved first; remaining global collisions move to the nearest vacant cyclic integer. For this dataset, `dodecahedron:4` would collide at #001 and therefore becomes **#999**. Haeri's other three values stay **#516**, **#598**, **#599**. The 1D MDS embedding and projection images are unchanged; only displayed serials and periodic-table positions change.
- The other 27 projection roles (고착·반추) remain drafts. Only after all five attributes' initiation operators are designed will development-stage engravings and karma computations be specified.

## Projection periodic table grouping (2026-10-20)

- The Projections periodic table has three accessible row-grouping toggles: **H** (6 rows, outer Convex Hull vertex count; default), **P** (4 rows, Convex Hull layer depth), and **속성** (5 rows, Platonic solid / attribute). The 43 projection classes and their #000–#999 serial coordinates remain unchanged across modes.
- Each mode preserves serial order within each row and uses minimum-gap/minimum-displacement packing. Desktop thumbnails show the other dimension(s) as a compact badge; accessible labels and hover titles retain the H, P and attribute information.
- The grouped layout is a read-only view. It never changes canonical JSON, geometric class IDs, representative frames or the projection selector. Run `node --test test/*.test.mjs` when updating the feature.

## Soeoe initiation: A₂ roots and six spatial operations (2026-10-20)

- The `#attributes/wiki/soeoe/operators` term document presents the adopted symbolic correspondence `Φ(A₂)={±α, ±β, ±(α+β)}`: `α` = the position I desire, `β` = the position the world/others expect, and `γ=α+β` = the position I actually reach. Negatives are independent **opposing concepts**, not Boolean NOT, while root addition is a philosophical analogy rather than a physical summation or spell composition rule.
- Six confirmed cube roles, displayed using the current per-solid global serial layout: `cube:1` **#001 지향** (creation), `cube:2` **#385 기피** (annihilation), `cube:6` **#623 호명** (absolute-space confinement), `cube:5` **#095 추방** (space-occupancy exclusion), `cube:3` **#886 도달** (teleportation), `cube:4` **#766 실위** (temporary removal of spatial occupancy). Exact role descriptions reside in `docs/data/projections.json`, with the A₂ framework and unresolved rulings in `docs/data/project.json`.
- 호명 and 추방 constrain **one target against fixed world space**; they are not movements generated by acceleration (초조) or relative bindings between two entities (고착). Existing occupants of an exclusion zone, the limits of temporary spatial separation, damage and return-to-space mechanics, and numeric engraving/karma rules are explicitly **undecided**.

## Chojo initiation: 3A₁ roots and six change-process operations (2026-10-21)

- The `#attributes/wiki/chojo/operators` term document adopts **3A₁ = A₁⊕A₁⊕A₁** as a symbolic model with six independent roots `Φ(3A₁)={±α,±β,±γ}`. The three axes are 변위 (spatial motion), 변성 (internal state change), 파급 (propagation). These are **six roots, not six Weyl chambers** (the latter number eight).
- Confirmed roles preserving the existing global serials and geometric keys: `octahedron:1` **#002 추진**, `octahedron:6` **#441 제동**, `octahedron:3` **#361 촉진**, `octahedron:4` **#283 억제**, `octahedron:5` **#666 발산**, `octahedron:2` **#461 수렴**. Opposing operations are separate base projections, never a 0-karma generic inversion engraving.
- Chojo manipulates **the processes of possible/ongoing change**, not instantaneous spatial reassignment, arbitrary creation, reversal of history, or global time control. Effects, targets, energies, propagation media, engraving details, and karma costs remain undecided. Of 43 projection roles, 16 are confirmed; 고착·반추's remaining 27 roles are drafts.
