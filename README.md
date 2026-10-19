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
      ├─ project.json     # 현재 설계 데이터의 source of truth
      └─ relationships.json
```

사이트 내부의 자산과 데이터 경로는 모두 상대 경로를 사용하므로 GitHub Project Pages의 `/spellwright/` base path에서 동작합니다.

### Pages 설정

Repository **Settings → Pages**에서 다음 값만 지정하면 됩니다.

- **Source:** Deploy from a branch
- **Branch:** `main`
- **Folder:** `/docs`

## Design data workflow

`docs/data/project.json`이 현재 프로젝트 설계의 공식 데이터입니다.

대시보드에서 수정한 내용은 브라우저 `localStorage`에 로컬 초안으로 저장되며, 저장소의 공식 데이터 변경은 Git commit으로 관리합니다. 따라서 대시보드는 공개 조회용 UI이면서 동시에 설계 초안을 실험하는 프런트엔드 역할을 합니다.

그래프 모델의 최소 회귀 검사는 `node --test test/graph-model.test.mjs`로 실행합니다.

## Design data ownership (2026-10-11)

The dashboard now has seven sections: Overview, Story & World, Systems, Character, Projections, Open Questions, and Archive. Legacy hash links are mapped to their merged views.

- `docs/data/project.json` owns system relationships, story canon, MVP scope, decisions and open questions. Story events reference canonical plot records through `source` and `index` instead of copying descriptions.
- `docs/data/stats.json` is the single source for character stat descriptions. System nodes with `statRef` use that source; the corresponding fields are read-only in the browser system editor.
- `docs/data/classes.json` is the single source for class drafts. Character composes the stat and class data without duplicating the records.
- Unknown historical edit dates remain unrecorded. Subsequent system edits set `lastModifiedAt` to the local edit date, while `lastModified` records the version.
- World questions are owned by `narrative.unresolved` and grouped by `questionGroups`; gameplay questions are owned by `openQuestions`. Both appear in Open Questions without copying source text.
- The browser editor persists local drafts only. Official updates require a Git commit of data files. Draft freshness includes both the project and stat data hashes; stale drafts are retained in a local backup.

Run `node --test test/*.test.mjs` after editing content or navigation.

## Worldbuilding / character reference notes (2026-10-16)

The **Story & World** area remains a four-subtab view (Overview, World, Cast, Plot). The design notes are canonical structured content in `docs/data/project.json`, not separate copies of the plot or private drafts:

- **Cast:** `narrative.characterMotifs` records each cast member's referenced originals, borrowed characteristics, rejected interpretations, and provisional visual designs. Each cast card links directly to its motif entry. `narrative.groupFounding` records the proposed founding order and its open details.
- **Plot:** `narrative.creativeReferences` retains explored but not necessarily adopted motifs (cell death, plants, flowers, detached landscapes, quiet perpetual motion), while `narrative.narrativeCraft` tracks narrative technique and scene design principles.
- **Existing canon stays in place:** divine creature forms are owned by `beastForms`, Eloi appearance by `eloiAppearance`, Kai's form by `kaiDesignStages`/`kaiDesignNotes`, and event chronology by `timeline`/`plot`. The new notes point to those concepts without defining conflicting duplicates.
- **Interpretation statuses matter:** a motif source, analogy, IF scene, or speculative image is not automatically an adopted story event. The only timeline is the one described by the existing plot rules; "IF" comparisons are not additional histories.


## Narrative naming and visual direction (2026-10-19)

- **주인공:** 현행 통용 이름은 **카르**(로마자 **Kar**, 잠정). 옛 작업명 **카이**는 현행 화면에서 대체했다. 카르 자체가 본명인지, 카르-로 시작하는 긴 본명의 애칭인지는 미정이다. 내부 `kai*` 키와 `kai` 그래프 ID는 호환성을 위해 유지한다.
- **공동체:** 프레미아가 주도해 결성한 비공식 마법사 모임의 이름 **이음새**는 확정이다. 서로 다른 사람을 잇는 연결과 방황하는 마법사의 머물 틈새라는 중의성을 가진다. 스테인드글라스 접합은 비유이며 공식 엠블럼으로 확정하지 않았다.
- **엘로이 낙원:** 흐릿하거나 눈부신 드림코어보다 색채와 윤곽이 비정상적으로 또렷하고 인위적으로 완벽해서 이질적인 풍경을 지향한다. 미술 방향이며 정식 지형·장르 분류를 확정하지 않았다.
- 탐색한 과학 용어, 명칭 아나그램, 이전 후보는 참고 기록으로만 관리한다. 서사의 기존 사건·연대표·연결 ID와 데이터 스키마는 보존한다.
