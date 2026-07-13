# Events Panel State Model

## Purpose

이 문서는 `Events Panel`이 UI에서 다뤄야 하는 상태 모델을 정의한다.

관련 문서:

- [ADR-034](../completed/034-events-panel-renovation.md)

---

## State Domains

패널 상태는 크게 5개 도메인으로 나눈다.

1. `panel chrome state`
2. `selection state`
3. `handler graph state`
4. `connection state`
5. `diagnostics state`

---

## 1. Panel Chrome State

패널 껍데기와 disclosure 상태를 담당한다.

예:

- 어떤 섹션이 펼쳐져 있는가
- preview가 열려 있는가
- 추천 recipe 영역이 접혀 있는가

필수 상태:

- `expandedSections`
- `activeTab`가 있다면 그 값
- `lastFocusedSection`

---

## 2. Selection State

사용자가 지금 무엇을 편집 중인지 정의한다.

필수 상태:

- `selectedHandlerId`
- `selectedActionId`
- `selectedRecipeId`
- `selectedDiagnosticId`

원칙:

- handler는 하나만 선택 가능
- action은 선택된 handler 안에서만 유효
- recipe 선택은 preview와 연결

---

## 3. Handler Graph State

핸들러 자체의 편집 상태다.

핵심 엔티티:

- `EventHandler`
- `EventAction`
- `ConditionNode`

파생 상태:

- `hasHandlers`
- `hasRecipeGeneratedHandlers`
- `hasBrokenHandlers`
- `hasDisabledHandlers`

UI 전용 파생 상태:

- `handlerBadgeState`
- `handlerSummaryText`
- `isDirty`

---

## 4. Connection State

데이터와의 연결 상태를 담당한다.

필수 상태:

- `dataSourceId`
- `dataSourceName`
- `hasDataBinding`
- `hasSelectionBinding`
- `hasVariableBindings`
- `appliedRecipeIds`

파생 상태:

- `connectionSummary`
- `canRecommendRecipes`
- `shouldShowQuickConnect`

---

## 5. Diagnostics State

패널에서 노출할 문제 상태다.

진단 항목 구조 예시:

```ts
interface DiagnosticItem {
  id: string;
  severity: "info" | "warning" | "error";
  type: string;
  title: string;
  message: string;
  handlerId?: string;
  actionId?: string;
  fixAction?: string;
}
```

파생 상태:

- `errorCount`
- `warningCount`
- `hasBlockingIssues`

---

## State Transitions

### T1. Recipe 적용

입력:

- recipe 선택

결과:

- handler graph 생성 또는 갱신
- `selectedHandlerId` 갱신
- `appliedRecipeIds` 갱신
- diagnostics 재계산

### T2. Handler 선택

입력:

- handlers list item click

결과:

- `selectedHandlerId` 갱신
- editor focus 이동

### T3. Binding 깨짐

입력:

- data source/schema 변경

결과:

- diagnostics 증가
- 해당 handler badge를 broken으로 갱신

### T4. Empty to Configured

입력:

- 첫 handler 생성

결과:

- empty state 종료
- handlers list와 editor가 주 흐름이 됨

---

## Derived UI States

### Handler Badge Resolution

우선순위:

1. `Broken`
2. `Warning`
3. `Disabled`
4. `Recipe`
5. `Manual`

### Panel Entry State

초기 진입 시 결정해야 하는 상태:

- 이벤트 없음 + 데이터 없음
- 이벤트 없음 + 데이터 있음
- 이벤트 있음 + 선택 없음
- 이벤트 있음 + broken 있음

이 4가지가 주요 entry state가 된다.

---

## Persistence Boundary

저장 대상:

- handler graph
- recipe source metadata

저장 비대상:

- 펼침/접힘 상태
- preview open 여부
- 임시 선택 상태

---

## Open Questions

1. `selectedRecipeId`를 panel-local로 둘지 상위 store로 올릴지
2. diagnostics 계산 시점이 eager인지 lazy인지
3. preview 관련 상태를 별도 도메인으로 분리할지
