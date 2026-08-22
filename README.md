# Spellwright

마법진을 직접 구성하고 영창하는 로그라이트 게임 프로젝트입니다.

현재 저장소에는 게임 시스템 설계를 추적하기 위한 **Live Design Dashboard**가 먼저 올라가 있습니다.

## Live Dashboard

GitHub Pages용 정적 사이트는 `docs/`에 있습니다.

Pages 활성화 후 예상 주소:

`https://hix4123.github.io/spellwright/`

### GitHub Pages 설정

1. Repository **Settings** → **Pages**
2. **Build and deployment** → **Source: Deploy from a branch**
3. Branch: `main`
4. Folder: `/docs`
5. **Save**

대시보드는 `docs/data/project.json`을 프로젝트 설계 데이터의 현재 원본으로 읽습니다. 브라우저에서 한 편집은 로컬 초안으로 저장되며, 저장소의 원본 변경은 Git 커밋으로 관리합니다.
