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
   ├─ app.js
   ├─ styles.css
   ├─ favicon.svg
   └─ data/
      └─ project.json     # 현재 설계 데이터의 source of truth
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
