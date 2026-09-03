# 관계도 작성 규약

Systems 관계도는 **관계의 의미와 선의 표현을 1:1로 고정**한다. 새 시스템을 추가할 때 아래 규칙을 우회하지 않는다.

## 1. 실선 — `hierarchy`

`relationships.json > hierarchy`는 **진짜 상하위·포함 구조만** 기록한다.

허용하는 `type`:

- `subtype`: 상위 개념 아래의 세부 시스템/하위 모델
- `crosscutting`: 상위 구조 전체를 관통하는 전역 하위 요소
- `stage`: 한 시스템 내부의 구성 단계. `order` 필수
- `stat`: 스탯 묶음의 구성 항목. `order` 필수

금지:

- 기능 의존을 `hierarchy`에 넣지 않는다.
- `type: "dependency"`를 만들지 않는다.
- 단순히 가까이 배치하려는 목적으로 가짜 부모·자식 관계를 만들지 않는다.

## 2. 점선 — `system.dependencies`

한 시스템이 다른 시스템의 기능이나 정의를 전제로 할 때는 해당 시스템의 `dependencies` 배열에 부모 ID를 기록한다.

```json
{
  "id": "effect-graph",
  "dependencies": ["spell-grammar"]
}
```

관계도 모델이 이를 기능 의존 점선으로 변환한다.

작성 원칙:

- 직접적인 기능 의존만 기록한다.
- 이미 다른 경로로 명확히 전달되는 전이적 의존은 가급적 반복하지 않는다.
- 상하위 관계와 같은 방향의 dependency는 별도 선으로 중복 표현하지 않는다.
- 레이아웃을 맞추기 위해 dependency를 추가하지 않는다.

## 3. 파선 — `sequence`

`sequence`는 **실행·구성 순서가 실제 규칙인 경우에만** 사용한다.

현재 허용하는 대표 형식은 `stage-flow`다.

```json
{
  "from": "initiation",
  "to": "development",
  "type": "stage-flow",
  "order": 1
}
```

단순한 인과관계나 기능 의존을 순서선으로 표현하지 않는다.

## 4. `crossLinks`

레이아웃 계층에 영향을 주면 안 되는 보조 의미 관계에만 사용한다.

현재 용례:

- 같은 용어의 서로 다른 용례: `shared-concept`
- 구조와 자원의 연결: `resource`
- 구조와 수용 한계의 연결: `capacity`

`crossLinks`는 기본적으로 `layoutNeutral`한 dependency로 렌더링된다. 상하위 관계를 우회하기 위한 용도로 사용하지 않는다.

## 5. `virtualSystems`

동일한 실제 개념을 관계도에서 **별도 위치에 한 번 더 시각화해야 할 때만** 사용한다.

예: 구조 단위의 `서클`과 캐릭터 스탯으로 표시하는 `서클`.

새로운 독립 시스템을 `virtualSystems`에 넣어 `project.json` 등록을 피하지 않는다.

## 6. `hiddenSystems`

시스템 데이터에는 존재하지만 현재 관계도에서 의도적으로 감추는 설계 항목만 지정한다. 레이아웃 문제를 숨기기 위한 수단으로 사용하지 않는다.

## 7. `suppressedDependencies`

원본 시스템 정의에는 필요한 dependency지만 관계도에서는 중복·역방향·보조 관계 때문에 표시 가치가 없는 선을 억제할 때만 사용한다.

새 관계의 종류를 표현하기 위해 사용하지 않는다. 먼저 `hierarchy`, `dependencies`, `sequence`, `crossLinks` 중 올바른 컨테이너를 선택한다.

## 8. 순서와 중복

- `stage`, `stat`, `stage-flow`처럼 순서가 의미를 가지는 항목에는 `order`를 명시한다.
- 동일 방향의 관계를 같은 컨테이너에 두 번 작성하지 않는다.
- `hierarchy`는 순환하지 않는 방향 그래프여야 한다.
- 모든 관계의 양 끝은 실제 시스템 또는 의도적으로 등록된 virtual system으로 해석 가능해야 한다.

## 9. 현재 마법 이론 노드의 관계

현재 검토 중인 이론 노드는 다음 원칙으로 배치한다.

```text
사영도
  └─ 사영 연산자          ← 실선: 진짜 하위 모델
       ··· 마법 문법       ← 점선: 기능 의존
            ··· 효과 그래프
                 ├··· 구조적 상성
                 └··· 마법 명명 체계
```

`마법 문법`, `효과 그래프`, `구조적 상성`, `마법 명명 체계`는 서로의 **하위 개념이 아니라 기능적으로 이어지는 설계 시스템**이므로 hierarchy에 넣지 않는다.

## 10. 변경 시 검수

관계도 관련 변경에서는 최소한 다음을 확인한다.

1. 선 종류와 관계 의미가 일치하는가.
2. 불필요한 직접 dependency가 중복되어 있지 않은가.
3. hierarchy 순환이 없는가.
4. 미등록 endpoint가 없는가.
5. 기존 `graph-model.test.mjs`의 간선 교차·겹침 제약을 훼손하지 않는가.
6. `relationship-format.test.mjs`의 관계 양식 검사를 통과하는가.
