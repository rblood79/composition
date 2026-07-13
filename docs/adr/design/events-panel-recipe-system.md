# Events Panel Recipe System Design

## Purpose

이 문서는 `Events Panel`에서 사용할 recipe 시스템의 상세 설계를 정의한다.

관련 문서:

- [ADR-032](../completed/032-events-data-integration.md)
- [ADR-034](../completed/034-events-panel-renovation.md)

---

## Why Recipe

추천 event 단위는 너무 작고,
초보자가 실제로 원하는 것은 "의도 단위의 자동 생성"이다.

예:

- 버튼 클릭 시 이동
- 리스트 선택 시 상세 모달 열기
- 검색 입력 시 컬렉션 필터링
- 폼 제출 시 검증 후 API 호출

이것들은 개별 이벤트가 아니라
이벤트 + 조건 + 효과 조합으로 구성된 패턴이다.

따라서 추천 단위는 `recipe`가 되어야 한다.

---

## Recipe Definition

recipe는 특정 capability/data context에서
추천하거나 자동 생성할 수 있는 이벤트 흐름 템플릿이다.

예시 구조:

```ts
interface RecipeSpec {
  id: string;
  label: string;
  description: string;
  priority: number;
  when: {
    capabilities?: string[];
    hasDataBinding?: boolean;
    componentTypes?: string[];
  };
  build: (ctx: RecipeContext) => EventHandlerDraft[];
}
```

---

## Recipe Categories

### 1. Interaction Recipes

예:

- press -> navigate
- press -> show modal

### 2. Selection Recipes

예:

- selection -> set selected item
- selection -> open details

### 3. Filter Recipes

예:

- input change -> filter collection
- selection change -> filter dependent view

### 4. Form Recipes

예:

- submit -> validate -> api call
- submit -> save -> toast

### 5. Synchronization Recipes

예:

- table selection -> detail panel sync
- tabs selection -> data reload

---

## Recipe Lifecycle

### Stage 1. Recommend

패널은 현재 capability와 data context를 바탕으로
추천 가능한 recipe를 계산한다.

### Stage 2. Apply

사용자가 recipe를 적용하면
handler graph 초안이 생성된다.

### Stage 3. Track

생성된 handler에는 `recipeId`와 source metadata를 남긴다.

### Stage 4. Drift Detect

사용자가 수동 수정하거나 data schema가 바뀌면
원본 recipe와의 drift 여부를 판단한다.

### Stage 5. Repair or Reapply

사용자는 다음 중 선택할 수 있다.

- 현재 편집 상태 유지
- recipe 다시 적용
- recipe 기준으로 복원

---

## Recommendation Rules

추천은 다음 입력을 본다.

- component capabilities
- data binding 여부
- selection 가능 여부
- form context 여부
- 이미 적용된 recipe 목록

추천 제한 규칙:

- 이미 동일한 의도의 recipe가 적용된 경우 우선순위를 낮춘다.
- 현재 상태와 충돌하는 recipe는 추천하지 않는다.
- broken state 수리가 더 시급하면 repair suggestion을 recipe보다 위에 둔다.

---

## Recipe Metadata For UX

각 recipe는 UI 표시를 위해 추가 메타데이터를 가진다.

- 예상 생성 handler 수
- 예상 생성 effect 수
- data requirement
- beginner friendly 여부
- destructive 여부

이 메타데이터는 추천 카드와 preview에서 사용한다.

---

## Drift Model

recipe-generated handler가 수동으로 수정될 수 있으므로
drift를 추적해야 한다.

상태:

- `clean`
- `modified`
- `broken`
- `stale`

의미:

- `clean`: recipe 적용 직후와 동일
- `modified`: 사용자가 수동 편집함
- `broken`: 참조가 깨짐
- `stale`: recipe 정의 또는 context가 바뀌어 재검토 필요

---

## UX Rules

1. 추천 영역은 recipe를 event보다 앞에 둔다.
2. recipe-generated handler는 목록에서 배지로 표시한다.
3. drift가 발생하면 diagnostics에 노출한다.
4. reapply는 destructive할 수 있으므로 diff preview가 필요하다.

---

## Open Questions

1. recipe 적용 시 기존 handler와 merge할지 항상 append할지
2. 동일 recipe 재적용 시 중복 handler를 허용할지
3. recipe diff를 얼마나 자세히 보여줄지
