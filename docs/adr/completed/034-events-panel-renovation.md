# ADR-034: Events Panel Renovation

## Status

Deprecated — 2026-05-13 (Replaced by [ADR-133](133-events-panel-simplification.md))

### land 영역 (ADR-133 흡수)

- **Panel UX 전면 개편** — ADR-133 D1 가 4 depth + 2 overlay → 2 depth (default) + L4 expand toggle (power user) 로 단순화. RAC props list mental model 정합
- **canonical primary 전환** — ADR-133 D2 가 `selectedElement.events` legacy direct read 제거 + `useEventsForTarget` canonical hook 전환
- **Property Editor 자식 아이템 제거 (Collection items pattern)** — ADR-132 + ADR-013 Proposed (Quick Connect) 진행 중. ADR-133 scope 외 (별 영역)

### 미land 영역 (ADR-134 응용 이관)

- **7 섹션 IA renovation** — `ConnectionStatusSection` / `RecommendedRecipesSection` / `HandlersListSection` / `HandlerEditorSection` / `DiagnosticsSection` / `PreviewSection`. **ADR-133 의 RAC-props-list 모델로 대체** — 7 섹션 monolith 분해 framing 자체가 RAC 정통 매핑과 다른 방향이며 사용자 framing "뎁스 너무 복잡" + "1년차 신입 OK" baseline 부정합
- **recipe 중심 UX** — RecommendedRecipesSection / "Selection sync" / "Open detail modal" / "Search filter binding" 등 recipe id 기반 추천. ADR-032 의 RecipeRegistry 선행 필수
- **diagnostics / preview** — DiagnosticsSection (broken binding / invalid condition / recipe drift / auto-fix 제안) + PreviewSection (코드 출력 또는 intent 미리보기). ADR-032 의 BindingDiagnosticsService 선행
- **Property Editor 이벤트 설정 제거 (108 에디터)** — onClick / onChange / onPress 등 산재된 이벤트 바인딩 설정을 Events Panel 로 중앙 집중. ADR-133 scope 밖 — 별 ADR 발의 영역
- **Manual / Recipe / Broken 상태 모델** — handler 상태 배지 (Manual / Recipe / Warning / Broken / Disabled)

## Date

2026-03-12

## Decision Makers

composition Team

## Related ADRs

- [ADR-032](032-events-data-integration.md): Events Platform 재설계 - Capability, Effect, Recipe 기반 데이터 통합

---

## Context

현재 `Events Panel`은 기능이 많지만 사용성이 낮다.

핵심 문제는 다음과 같다.

1. 사용자가 무엇부터 시작해야 하는지 알기 어렵다.
2. 추천, 핸들러 목록, 블록 편집, 액션 추가, 디버깅 정보가 한 화면에 섞여 있다.
3. 데이터가 연결된 상태와 연결되지 않은 상태의 UX 차이가 거의 드러나지 않는다.
4. 자동 생성된 핸들러와 수동 핸들러가 같은 무게로 보인다.
5. 깨진 바인딩, 잘못된 조건식, 지원되지 않는 액션 조합이 늦게 드러난다.
6. 초보자에게는 너무 복잡하고, 숙련자에게도 스캔 비용이 높다.

즉 현재 패널은 "이벤트를 설계하는 도구"라기보다
"이벤트 내부 자료구조를 직접 편집하는 화면"에 가깝다.

---

## Decision

`Events Panel`을 하나의 거대한 편집 화면에서,
목적별 섹션과 단계형 흐름을 가진 패널로 전면 개편한다.

새 패널은 다음 7개 영역으로 구성한다.

1. `PanelHeader`
2. `ConnectionStatusSection`
3. `RecommendedRecipesSection`
4. `HandlersListSection`
5. `HandlerEditorSection`
6. `DiagnosticsSection`
7. `PreviewSection`

핵심 원칙은 다음과 같다.

1. 초보자는 추천 recipe 적용부터 시작할 수 있어야 한다.
2. 숙련자는 바로 handler/effect 편집으로 내려갈 수 있어야 한다.
3. 데이터 연결 상태, 자동 생성 상태, 진단 상태가 항상 visible 해야 한다.
4. 패널은 기능 나열이 아니라 작업 흐름을 중심으로 구성되어야 한다.

---

## Detailed Design Summary

### 1. Connection First

패널 상단에서는 먼저 현재 데이터 연결과 recipe 적용 상태를 보여준다.

예:

- `No data connected`
- `Connected to Users table`
- `2 recipes applied`
- `1 broken binding`

### 2. Recipe Before Raw Events

추천의 기본 단위는 event가 아니라 recipe다.

예:

- `Selection sync`
- `Open detail modal`
- `Search filter binding`
- `Submit form to API`

### 3. List Before Editor

핸들러 목록을 먼저 보고,
선택한 핸들러에 대해서만 상세 블록 편집을 제공한다.

핸들러 상태는 다음 배지로 즉시 구분한다.

- `Manual`
- `Recipe`
- `Warning`
- `Broken`
- `Disabled`

### 4. Diagnostics Inside The Panel

broken binding, invalid condition, drift는
별도 로그나 외부 패널이 아니라 `DiagnosticsSection`에서 직접 보여준다.

### 5. Preview As Intent

프리뷰는 코드 출력보다
"무슨 이벤트/효과가 생성되거나 실행될 것인가"를 먼저 설명한다.

---

## Consequences

### Positive

1. 시작점이 명확해진다.
2. 추천과 편집의 위계가 정리된다.
3. 데이터 연결 상태가 패널 전반에 드러난다.
4. broken state를 조기에 노출할 수 있다.
5. 초보자와 숙련자 모두에게 더 적합한 UX가 된다.

### Negative

1. 기존 패널 구조를 크게 다시 나눠야 한다.
2. 상태 정의와 섹션 간 책임을 다시 정리해야 한다.
3. 초기 리그레션 점검 범위가 넓다.

---

## Follow-up Design Docs

세부 설계는 아래 문서에서 이어진다.

- [events-panel-wireframe.md](design/events-panel-wireframe.md)
- [events-panel-state-model.md](design/events-panel-state-model.md)
- [events-panel-recipe-system.md](design/events-panel-recipe-system.md)
- [events-panel-binding-diagnostics.md](design/events-panel-binding-diagnostics.md)
- [events-panel-review-checklist.md](design/events-panel-review-checklist.md)

---

## Property Editor 역할 재정의

Events Panel이 이벤트/동작을 전담하게 되면, Property Editor의 역할이 **시각적 속성 전담**으로 축소된다.
현재 Property Editor에 혼재된 두 가지 책임을 분리해야 한다.

### 1. Child Item Management 제거 → React Aria `items` Collection 패턴

현재 10개 에디터에 자식 아이템 관리 UI(추가/삭제/정렬)가 개별 구현되어 있다.

| 에디터            | 관리 대상          |
| ----------------- | ------------------ |
| SelectEditor      | Select options     |
| ComboBoxEditor    | ComboBox options   |
| RadioGroupEditor  | Radio items        |
| TabsEditor        | Tab items          |
| TagEditor         | Tag items          |
| TableEditor       | Table columns/rows |
| ListBoxEditor     | ListBox items      |
| ListBoxItemEditor | Nested items       |
| GridListEditor    | GridList items     |
| BreadcrumbsEditor | Breadcrumb items   |

React Aria Components의 `items` prop 기반 data-driven Collection 패턴으로 전환하면,
자식 아이템은 **데이터 소스에서 자동 생성**되므로 Property Editor 내 수동 관리 UI가 불필요해진다.

- **현재**: Property Editor에서 아이템 추가/삭제/정렬 → Store에 자식 Element 생성
- **목표**: 데이터 소스(ADR-032 BindingRef) → Collection `items` → 자동 렌더링

### 2. 이벤트 설정 제거 → Events Panel 중앙 집중

현재 108개 에디터에 onClick, onChange, onPress 등 이벤트 핸들러 설정이 산재되어 있다.

- **현재**: 각 Property Editor에서 이벤트 바인딩 설정 (에디터마다 개별 구현)
- **목표**: Property Editor는 시각적 속성(size, variant, label, placeholder 등)만 담당.
  이벤트/동작은 Events Panel(본 ADR)이 전담

### 역할 경계 정리

```
Property Panel (시각적 속성 전담)
├── 컴포넌트 props: label, placeholder, size, variant, isDisabled 등
├── 스타일 props: color, spacing, typography 등
└── 데이터 표시: 바인딩된 데이터의 미리보기 (읽기 전용)

Events Panel (동작/이벤트 전담) — 본 ADR
├── 이벤트 핸들러: onPress, onChange, onSelectionChange 등
├── 데이터 바인딩: BindingRef 연결/해제
├── 자식 아이템 데이터 소스: Collection items 바인딩
└── 진단: broken binding, invalid condition 등
```

---

## Acceptance Criteria

1. 사용자는 패널을 열고 5초 안에 다음 행동을 이해할 수 있다.
2. 추천, 목록, 편집, 진단의 역할 구분이 명확하다.
3. manual / recipe / broken 상태 모델이 패널 전체에 일관되게 적용된다.
4. 데이터 연결 여부가 패널 흐름에 영향을 준다는 점이 드러난다.
