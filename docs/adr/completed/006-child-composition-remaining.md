# Child Composition Pattern — 전환 완료 보고서

> **작성일**: 2026-02-24
> **상태**: Implemented — 전환 완료 (Table, Tree 2개 보류)
> **관련**: `docs/reference/components/COMPONENT_SPEC.md` §9.13

---

## 배경

자식 조합 패턴(Child Composition Pattern)은 UI 컴포넌트 spec이 자체 콘텐츠(레이블, 텍스트)를
spec shapes로 직접 그리는 대신, 자식 Element가 해당 콘텐츠를 담당하게 하는 패턴이다.
이를 통해 Figma/HTML 구조와 일치하는 컴포넌트 트리를 구성하고,
자식 텍스트의 독립적인 스타일 편집을 가능하게 한다.

이 보고서는 전체 **62개 spec**에 대한 분류 및 전환 완료 현황을 기록한다.

| 구분 | 개수 | 설명 |
|------|------|------|
| `_hasChildren` 적용 | **49개** | 기존 42 + 신규 7 (Button, Badge, ToggleButton, Slot, Panel, ProgressBar, Meter) |
| 전환 불필요 (NON_CONTAINER_TAGS) | **~21개** | TEXT_TAGS 14 + Void/Visual 3 + Color Sub-component 4 |
| 합성 prop 유지 (EXCLUDE_TAGS) | **3개** | Tabs, Breadcrumbs, TagGroup |
| 보류 (EXCLUDE_TAGS) | **2개** | Table, Tree (다단계 중첩) |

> 주의: 62개는 spec 파일 기준이며, NON_CONTAINER_TAGS에 포함된 일부 태그(Text, Heading 등)는
> 별도 spec 파일 없이 TextSprite로 처리된다.

**패턴 통합**: `_hasLabelChild` 플래그 완전 제거 → `_hasChildren` 단일 메커니즘으로 통합 완료 (`0cd704f2`).

---

## 아키텍처: Opt-Out (블랙리스트) 모델

### 배경 — Opt-In에서 Opt-Out으로

초기 구현은 `CHILD_COMPOSITION_TAGS`(42개 화이트리스트)로 허용 태그를 명시적으로 관리했다.
새 컴포넌트를 추가할 때마다 두 곳(spec + `CHILD_COMPOSITION_TAGS`)을 동시에 갱신해야 했고,
누락 시 자식이 있음에도 spec shapes가 레이블을 덮어 그리는 버그가 발생했다.

Opt-out 모델은 이 문제를 역전한다: **기본적으로 모든 컴포넌트는 자식 조합 패턴을 지원**하며,
명시적으로 제외된 컴포넌트만 기존 방식을 유지한다.

### _hasChildren 주입 로직 — 3단계 판단

`ElementSprite.tsx`의 `_hasChildren` 주입은 세 단계를 순서대로 거친다.

```
1단계: CHILD_COMPOSITION_EXCLUDE_TAGS (5개 블랙리스트)
   → 포함되면 _hasChildren 주입 자체를 건너뜀 (이하 단계 미실행)

2단계: COMPLEX_COMPONENT_TAGS (전체 40개, EXCLUDE 제외 순수 complex 36개)
   → 포함되면 자식 유무와 관계없이 항상 _hasChildren=true
   → (Factory가 자식을 생성하는 컴포넌트. 자식 0개인 비정상 상태에서도 standalone 복귀 방지)

3단계: childElements.length > 0 (일반 컨테이너)
   → COMPLEX에 미포함이고 실제 자식이 있으면 _hasChildren=true
   → (Button, Section 등 non-complex 컴포넌트의 일반적인 경로)
```

```typescript
// apps/builder/src/builder/workspace/canvas/sprites/ElementSprite.tsx

if (!CHILD_COMPOSITION_EXCLUDE_TAGS.has(tag)) {
  // Complex component: 자식 유무와 관계없이 항상 _hasChildren=true
  // (자식 삭제 시 standalone 렌더링 복귀 방지)
  // Non-complex (Button 등): 자식이 실제로 있을 때만 _hasChildren=true
  if (COMPLEX_COMPONENT_TAGS.has(tag) || (childElements && childElements.length > 0)) {
    specProps = { ...specProps, _hasChildren: true };
  }
}
```

이 설계의 핵심: **Complex component는 자식이 0개여도 `_hasChildren=true`를 유지**한다.
TextField 등은 Factory가 자식(Input, Label)을 생성하도록 설계되어 있으므로,
모든 자식이 삭제된 비정상 상태에서도 spec이 standalone 렌더링으로 되돌아가면 안 된다.

### CHILD_COMPOSITION_EXCLUDE_TAGS (5개)

`ElementSprite.tsx`에 정의. 이 태그들은 `_hasChildren` 주입에서 제외된다.

```typescript
// apps/builder/src/builder/workspace/canvas/sprites/ElementSprite.tsx
const CHILD_COMPOSITION_EXCLUDE_TAGS = new Set([
  'Tabs',        // _tabLabels synthetic prop — 자식 Tab 레이블을 데이터로 주입
  'Breadcrumbs', // _crumbs synthetic prop — 자식 Breadcrumb 텍스트를 데이터로 주입
  'TagGroup',    // _tagItems synthetic prop — 자체 BoxSprite 메커니즘
  'Table',       // 3단계 중첩 (별도 작업)
  'Tree',        // 다단계 중첩 (별도 작업)
]);
```

### COMPLEX_COMPONENT_TAGS (전체 40개) — 공유 상수

`factories/constants.ts`에 정의. `ElementSprite.tsx`와 `useElementCreator.ts` 두 곳에서 공유한다.

```typescript
// apps/builder/src/builder/factories/constants.ts

/**
 * Factory가 자식 Element를 생성하는 컴포넌트 태그.
 * 이 태그들은 자식 유무와 관계없이 항상 _hasChildren=true로 처리되어
 * 자식 삭제 시에도 standalone spec 렌더링으로 돌아가지 않음.
 *
 * 사용처:
 * - useElementCreator.ts: Factory 경로 분기
 * - ElementSprite.tsx: _hasChildren prop 주입
 */
export const COMPLEX_COMPONENT_TAGS = new Set([
  // Form Input
  'TextField', 'TextArea', 'NumberField', 'SearchField',
  'DateField', 'TimeField', 'ColorField',
  // Selection
  'Select', 'ComboBox', 'ListBox', 'GridList', 'List',
  // Control
  'Checkbox', 'Radio', 'Switch', 'Slider',
  'ToggleButtonGroup', 'Switcher',
  // Group
  'CheckboxGroup', 'RadioGroup',
  // Layout
  'Card',
  // Navigation
  'Menu', 'Disclosure', 'DisclosureGroup', 'Pagination',
  // Overlay
  'Dialog', 'Popover', 'Tooltip',
  // Feedback
  'Form', 'Toast', 'Toolbar',
  // Date & Color
  'DatePicker', 'DateRangePicker', 'Calendar', 'ColorPicker',
  'ColorSwatchPicker',
  // CHILD_COMPOSITION_EXCLUDE_TAGS 태그 (synthetic prop 메커니즘 사용)
  // ElementSprite에서 EXCLUDE 가드에 의해 _hasChildren 주입 차단되므로 안전.
  // useElementCreator의 Factory 경로 분기용.
  'Tabs', 'Tree', 'TagGroup', 'Table',
]);
```

**공유 상수 도입 이유**: 이전에는 `useElementCreator.ts`가 자체 로컬 배열로 complex component를
판별했다. 두 파일이 독립적으로 목록을 관리하면 한쪽만 갱신되는 누락 버그가 발생하므로,
`factories/constants.ts`에 단일 진실 공급원(Single Source of Truth)을 두고 두 파일이 import한다.

**개수 해설**:
- 전체 40개 = 순수 complex 36개 + EXCLUDE_TAGS와 중복 4개(Tabs, Tree, TagGroup, Table)
- 중복 4개는 `ElementSprite.tsx`에서 1단계 EXCLUDE 가드에 의해 _hasChildren 주입이 차단되므로, 실제로 `_hasChildren=true`를 주입받는 complex는 36개다.
- 중복 4개가 COMPLEX에 포함된 이유는 `useElementCreator.ts`의 Factory 경로 분기에서도 동일 상수를 사용하기 때문이다.

### NON_CONTAINER_TAGS (~21개)

`BuilderCanvas.tsx`에 정의. 이 태그들은 자식을 내부에 렌더링하지 않는 컴포넌트로,
`childElements`가 전달되지 않아 `_hasChildren`이 주입될 기회 자체가 없다.

```typescript
// apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx
const NON_CONTAINER_TAGS = useMemo(() => new Set([
  // TEXT_TAGS: TextSprite 렌더링, 컨테이너 불가
  'Text', 'Heading', 'Description', 'Label', 'Paragraph',
  'Link', 'Strong', 'Em', 'Code', 'Pre', 'Blockquote',
  'ListItem', 'ListBoxItem', 'GridListItem',
  // Void/Visual: 자식 없는 단일 요소
  'Input', 'Separator', 'Skeleton',
  // Color Sub-component: 부모 ColorPicker의 내부 요소
  'ColorSwatch', 'ColorWheel', 'ColorArea', 'ColorSlider',
]), []);
```

### isContainerTagForLayout() 동작

```typescript
function isContainerTagForLayout(tag: string, style?: Record<string, unknown>): boolean {
  if (tag === 'Section') {
    // Section은 flex 레이아웃일 때만 컨테이너로 동작
    return style?.display === 'flex' || style?.flexDirection !== undefined;
  }
  // Opt-out: NON_CONTAINER_TAGS에 없으면 기본적으로 컨테이너
  return !NON_CONTAINER_TAGS.has(tag);
}
```

---

## 버그 수정: 자식 삭제 시 standalone 렌더링 복귀 버그

### 문제

TextField 등 complex component에서 모든 자식 Element를 삭제하면,
`childElements.length === 0`이 되어 `_hasChildren`이 주입되지 않았다.
결과적으로 spec이 내부적으로 레이블/텍스트를 직접 그리는 standalone 렌더링으로 되돌아갔다.

### 원인

`ElementSprite.tsx`의 기존 주입 로직:

```typescript
// 수정 전
if (!CHILD_COMPOSITION_EXCLUDE_TAGS.has(tag) && childElements && childElements.length > 0) {
  specProps = { ...specProps, _hasChildren: true };
}
```

자식이 모두 삭제된 complex component는 조건 `childElements.length > 0`을 충족하지 못해
`_hasChildren`이 주입되지 않는다. Complex component는 Factory가 자식을 생성하도록
설계된 컴포넌트이므로, 자식이 없는 상태는 비정상이며 이때도 spec은 자체 렌더링을 해서는 안 된다.

### 수정

`COMPLEX_COMPONENT_TAGS` 공유 상수를 도입하고, 이 태그에 해당하는 컴포넌트는
자식 유무와 관계없이 항상 `_hasChildren=true`를 주입한다.

```typescript
// 수정 후
if (!CHILD_COMPOSITION_EXCLUDE_TAGS.has(tag)) {
  if (COMPLEX_COMPONENT_TAGS.has(tag) || (childElements && childElements.length > 0)) {
    specProps = { ...specProps, _hasChildren: true };
  }
}
```

동시에 `useElementCreator.ts`의 로컬 `complexComponents` 배열을 `COMPLEX_COMPONENT_TAGS`
공유 상수로 교체하여, 두 파일이 동일한 목록을 참조하도록 통합했다.

---

## 핵심 인프라 파일

| 파일 | 역할 |
|------|------|
| `apps/builder/src/builder/factories/constants.ts` | `COMPLEX_COMPONENT_TAGS` 공유 상수 정의 |
| `apps/builder/src/builder/workspace/canvas/sprites/ElementSprite.tsx` | `_hasChildren` 주입 로직 (3단계 판단) |
| `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx` | `NON_CONTAINER_TAGS` 정의, `isContainerTagForLayout()` |
| `apps/builder/src/builder/hooks/useElementCreator.ts` | Factory 경로 분기 (`COMPLEX_COMPONENT_TAGS` 사용) |

---

## 전수 검증 결과

전환 완료 후 전체 컴포넌트에 대해 `_hasChildren` 주입 동작을 검증했다.

### COMPLEX_COMPONENT_TAGS 검증 (36개 순수 complex)

EXCLUDE_TAGS와 중복되지 않는 36개 전원에 대해 spec 내 `_hasChildren` 체크 구현을 확인했다.
모두 자식 0개 상태에서도 `_hasChildren=true`가 주입되어 standalone 렌더링으로 복귀하지 않는다.

| 카테고리 | 태그 | 개수 |
|---------|------|------|
| Form Input | TextField, TextArea, NumberField, SearchField, DateField, TimeField, ColorField | 7 |
| Selection | Select, ComboBox, ListBox, GridList, List | 5 |
| Control | Checkbox, Radio, Switch, Slider, ToggleButtonGroup, Switcher | 6 |
| Group | CheckboxGroup, RadioGroup | 2 |
| Layout | Card | 1 |
| Navigation | Menu, Disclosure, DisclosureGroup, Pagination | 4 |
| Overlay | Dialog, Popover, Tooltip | 3 |
| Feedback | Form, Toast, Toolbar | 3 |
| Date & Color | DatePicker, DateRangePicker, Calendar, ColorPicker, ColorSwatchPicker | 5 |
| **합계** | | **36** |

### Non-complex 컴포넌트 검증 (13개) — standalone 복귀 정상 동작

이 13개는 `COMPLEX_COMPONENT_TAGS`에 포함되지 않으며, 자식이 없으면 standalone spec 렌더링으로 복귀한다.
이는 의도된 동작이다 — Factory가 자식을 생성하지 않는 컴포넌트이므로, 자식 없는 상태가 정상이다.

| 컴포넌트 | Factory 생성 여부 | standalone 복귀 이유 |
|---------|----------------|---------------------|
| **Button** | 미생성 | 자체 레이블을 spec shapes로 렌더링 (의도됨) |
| **Badge** | 미생성 | 자체 레이블을 spec shapes로 렌더링 (의도됨) |
| **ToggleButton** | 미생성 | 자체 레이블을 spec shapes로 렌더링 (의도됨) |
| **Panel** | 미생성 | 콘텐츠 없는 빈 컨테이너로 렌더링 (의도됨) |
| **ProgressBar** | 미생성 | 자체 레이블+트랙을 spec shapes로 렌더링 (의도됨) |
| **Meter** | 미생성 | 자체 레이블+트랙을 spec shapes로 렌더링 (의도됨) |
| **DropZone** | 미생성 | 자체 배경+점선 테두리를 spec shapes로 렌더링 (의도됨) |
| **FileTrigger** | 미생성 | 자체 배경+테두리를 spec shapes로 렌더링 (의도됨) |
| **ScrollBox** | 미생성 | 자체 배경+스크롤바를 spec shapes로 렌더링 (의도됨) |
| **MaskedFrame** | 미생성 | 자체 마스크+테두리를 spec shapes로 렌더링 (의도됨) |
| **Section** | 미생성 | 자체 배경+테두리를 spec shapes로 렌더링 (의도됨) |
| **Slot** | Factory 있음 | placeholder spec 렌더링 복귀가 적절 |
| **Group** | Factory 있음 | 빈 컨테이너 spec 렌더링 복귀가 적절 |

> **주의: Non-complex 컴포넌트를 COMPLEX_COMPONENT_TAGS에 추가하지 말 것.**
>
> 이 13개를 COMPLEX에 추가하면 자식이 0개인 정상 상태에서도 `_hasChildren=true`가 주입된다.
> Button을 예로 들면, 자식 없는 단독 Button이 레이블 텍스트를 spec으로 그리지 못하게 되어
> 빈 버튼만 렌더링된다. Non-complex 컴포넌트는 자식이 있을 때만 자식 조합 패턴으로
> 전환되는 것이 올바른 동작이며, 3단계(childElements.length > 0)로 자연스럽게 처리된다.

---

## 분류 기준

| 분류 | 설명 | 상태 |
|------|------|------|
| A. 자체 메커니즘 | 합성 prop 주입 (`_tabLabels`/`_crumbs`) 또는 자체 렌더링 | Card 통합, 3개 유지 |
| B. NON_CONTAINER_TAGS | 텍스트/void/color sub 요소 — 컨테이너 불가 | 전환 불필요 |
| C. Inline Form | indicator + label 구조 | 완료 |
| D. Sub-component | 다른 컴포넌트의 자식 요소, NON_CONTAINER_TAGS에서 관리 | 전환 불필요 |
| E. 신규 전환 대상 | 이번 작업에서 `_hasChildren` 추가 | 15개 완료, Table/Tree 보류 |
| F. 기존 적용 완료 | 이전 작업에서 이미 `_hasChildren` 적용 | 기 적용 |

---

## A. 자체 메커니즘 (4개) — Card 통합, 3개 유지

| 컴포넌트 | 메커니즘 | 상태 |
|---------|---------|------|
| **Card** | `_hasChildren` → bg+shadow+border 유지, container 스킵 | `_hasChildren` 통합 (`0cd704f2`) |
| **Tabs** | `_tabLabels` 합성 prop 주입 → spec shapes가 탭 바 렌더링 | `CHILD_COMPOSITION_EXCLUDE_TAGS` 유지 |
| **Breadcrumbs** | `_crumbs` 합성 prop 주입 → spec shapes가 크럼 렌더링 | `CHILD_COMPOSITION_EXCLUDE_TAGS` 유지 |
| **TagGroup** | `_tagItems` 자체 메커니즘 (BoxSprite) | `CHILD_COMPOSITION_EXCLUDE_TAGS` 유지 |

---

## B. NON_CONTAINER_TAGS (~21개) — 전환 불필요

### B-1. TEXT_TAGS (14개)

컨테이너로 동작하지 않으며 TextSprite로 직접 렌더링된다. 별도 spec 파일 없음.

| 태그 | 비고 |
|------|------|
| **Text** | 일반 텍스트 노드 |
| **Heading** | 제목 텍스트 |
| **Description** | 설명 텍스트 |
| **Label** | 라벨 텍스트 |
| **Paragraph** | 단락 텍스트 |
| **Link** | 인라인 링크 (TextSprite 처리) |
| **Strong** | 굵은 텍스트 |
| **Em** | 기울임 텍스트 |
| **Code** | 코드 텍스트 |
| **Pre** | 서식 있는 텍스트 |
| **Blockquote** | 인용 텍스트 |
| **ListItem** | 리스트 항목 |
| **ListBoxItem** | ListBox 항목 |
| **GridListItem** | GridList 항목 |

### B-2. Void / Visual (3개)

자식이 없는 단일 요소. spec shapes로 자체 렌더링.

| 컴포넌트 | 이유 |
|---------|------|
| **Input** | TextField 자식 요소, 자체가 leaf |
| **Separator** | 선 하나만 렌더링 |
| **Skeleton** | 플레이스홀더 시각 요소 |

### B-3. Color Sub-component (4개)

부모 ColorPicker의 내부 구성 요소. 독립 컨테이너로 동작하지 않음.

| 컴포넌트 | 부모 | 비고 |
|---------|------|------|
| **ColorArea** | ColorPicker | 2D 그래디언트 영역 |
| **ColorSlider** | ColorPicker | 색상 슬라이더 |
| **ColorSwatch** | ColorSwatchPicker | 단일 색상 칩 |
| **ColorWheel** | ColorPicker | 색상 휠 |

---

## C. Inline Form 컴포넌트 (3개) — 완료

`_hasChildren` 패턴 적용. indicator는 spec shapes 유지, label만 자식 Element로 분리.

| 컴포넌트 | spec 유지 shapes | 스킵 | 커밋 |
|---------|-----------------|------|------|
| **Checkbox** | box + checkmark + indeterminate | label text | `dfae0947` → `0cd704f2` |
| **Radio** | ring + dot | label text | `dfae0947` → `0cd704f2` |
| **Switch** | track + thumb | label text | `dfae0947` → `0cd704f2` |

---

## D. Sub-component (Panel 재분류)

> `0cd704f2` 이전 분류에서 Panel은 D. Sub-component에 포함됐으나,
> Phase 1에서 `_hasChildren`을 추가하여 컨테이너로 전환됐다 (아래 Phase 1 섹션 참조).

기존 Sub-component 분류는 B-3. Color Sub-component로 통합됨.

---

## E. 신규 전환 대상 (17개) — 15개 완료, 2개 보류

### E-1. 높은 우선순위 (4개) — 완료

| 컴포넌트 | 패턴 | spec 유지 shapes | 커밋 |
|---------|------|-----------------|------|
| **TextArea** | TRANSPARENT → `return []` | (없음, 자식 전담) | `ea23d5fa` |
| **Form** | NON-TRANSPARENT | bg + border | `ea23d5fa` |
| **ToggleButtonGroup** | NON-TRANSPARENT | bg + border | `ea23d5fa` |
| **Switcher** | NON-TRANSPARENT | track + border + active indicator | `ea23d5fa` |

### E-2. 중간 우선순위 (7개) — 5개 완료, 2개 보류

| 컴포넌트 | 패턴 | spec 유지 shapes | 상태 |
|---------|------|-----------------|------|
| **List** | NON-TRANSPARENT | bg + container | `c7a215c6` |
| **ListBox** | NON-TRANSPARENT | bg + border | `c7a215c6` |
| **GridList** | NON-TRANSPARENT | bg + border | `c7a215c6` |
| **Pagination** | NON-TRANSPARENT | container | `c7a215c6` |
| **ColorSwatchPicker** | NON-TRANSPARENT | bg | `c7a215c6` |
| **Table** | 3단계 중첩 + PixiTable 파이프라인 | — | 보류 (`CHILD_COMPOSITION_EXCLUDE_TAGS`) |
| **Tree** | 다단계 중첩 (TreeItem 재귀) | — | 보류 (`CHILD_COMPOSITION_EXCLUDE_TAGS`) |

### E-3. 낮은 우선순위 (6개) — 완료

| 컴포넌트 | 패턴 | spec 유지 shapes | 커밋 |
|---------|------|-----------------|------|
| **Group** | TRANSPARENT → `return []` | (없음) | `1f49424a` |
| **Section** | NON-TRANSPARENT | bg + border | `1f49424a` |
| **ScrollBox** | NON-TRANSPARENT | bg + border + scrollbar | `1f49424a` |
| **DropZone** | NON-TRANSPARENT | bg + dashed border | `1f49424a` |
| **FileTrigger** | NON-TRANSPARENT | bg + border | `1f49424a` |
| **MaskedFrame** | NON-TRANSPARENT | mask + border | `1f49424a` |

---

## F. 기존 적용 완료 (23개)

이전 작업에서 이미 `_hasChildren` 패턴이 적용됐던 컴포넌트.
`0cd704f2`에서 `_hasLabelChild` → `_hasChildren` 통합 정리 포함.

### F-1. Complex Containers (8개)

| 컴포넌트 | 패턴 |
|---------|------|
| **Dialog** | NON-TRANSPARENT |
| **Menu** | NON-TRANSPARENT |
| **Popover** | NON-TRANSPARENT |
| **Tooltip** | NON-TRANSPARENT |
| **Toast** | NON-TRANSPARENT |
| **Toolbar** | NON-TRANSPARENT |
| **Disclosure** | NON-TRANSPARENT |
| **DisclosureGroup** | NON-TRANSPARENT |

### F-2. Form Groups (2개)

| 컴포넌트 | 패턴 |
|---------|------|
| **CheckboxGroup** | NON-TRANSPARENT |
| **RadioGroup** | NON-TRANSPARENT |

### F-3. Pickers / Calendar (4개)

| 컴포넌트 | 패턴 |
|---------|------|
| **ColorPicker** | NON-TRANSPARENT |
| **DatePicker** | NON-TRANSPARENT |
| **DateRangePicker** | NON-TRANSPARENT |
| **Calendar** | NON-TRANSPARENT |

### F-4. Complex Inputs (3개) — `0cd704f2`에서 통합 정리

| 컴포넌트 | 변경 내용 |
|---------|----------|
| **ComboBox** | `_hasLabelChild` → `_hasChildren` (interface + 체크) |
| **Select** | `_hasLabelChild` → `_hasChildren` (interface + 체크) |
| **Slider** | `_hasLabelChild` → `_hasChildren` |

### F-5. Input Fields (6개) — `0cd704f2`에서 통합 정리

| 컴포넌트 | 변경 내용 |
|---------|----------|
| **TextField** | dual-check `_hasLabelChild \|\| _hasChildren` → 단일 `_hasChildren` |
| **NumberField** | 동일 |
| **SearchField** | 동일 |
| **DateField** | 동일 |
| **TimeField** | 동일 |
| **ColorField** | 동일 |

---

## 신규: Phase 1 — Spec `_hasChildren` 추가 (7개)

`0cd704f2` 이전까지 B. Leaf 컴포넌트로 분류됐던 컴포넌트들.
미커밋 변경사항으로, opt-out 아키텍처 전환과 함께 `_hasChildren` 지원이 추가됐다.

### 전환 배경

Opt-out 모델에서는 이들 컴포넌트에 자식이 붙으면 자동으로 `_hasChildren: true`가 주입된다.
그러나 spec의 `shapes()` 함수가 이 prop을 인식하지 못하면 여전히 내부 텍스트를 그린다.
따라서 spec 측에도 `_hasChildren` 체크를 추가하여 텍스트 shapes를 조건부로 제거해야 한다.

### 적용 컴포넌트

| 컴포넌트 | spec 유지 shapes | 스킵 shapes | 이전 분류 |
|---------|-----------------|------------|----------|
| **Button** | bg + border | label text | B. Leaf |
| **Badge** | bg + border | label text | B. Leaf |
| **ToggleButton** | bg + border | label text | B. Leaf |
| **Slot** | placeholder border | placeholder text | B. Leaf |
| **Panel** | bg + border | — (content 전담) | D. Sub-component |
| **ProgressBar** | track + fill | label text | B. Leaf |
| **Meter** | track + fill + segments | label text | B. Leaf |

### spec 변경 패턴

모든 7개 spec에 동일한 패턴 적용:

```typescript
// 예시: Button.spec.ts
shapes(props, variantSpec, sizeSpec, state) {
  const hasChildren = !!(props as Record<string, unknown>)._hasChildren;
  // ...
  if (!hasChildren) {
    result.push({
      type: 'text',
      text: String(props.children || props.label || 'Button'),
      // ...
    });
  }
  return result;
}
```

---

## 패턴 통합: `_hasLabelChild` → `_hasChildren` 단일화

커밋 `0cd704f2`에서 `_hasLabelChild` 플래그를 전면 제거하고 `_hasChildren` 단일 패턴으로 통합.

| 변경 대상 | 변경 내용 | 파일 수 |
|----------|----------|--------|
| Inline Form specs | `_hasLabelChild` → `_hasChildren` | 3 (Checkbox, Radio, Switch) |
| Complex Input specs | interface + 체크 변경 | 2 (ComboBox, Select) |
| Slider spec | `_hasLabelChild` → `_hasChildren` | 1 |
| Input Field specs | dual-check `_hasLabelChild \|\| _hasChildren` → 단일 `_hasChildren` | 7 |
| Card spec | `_hasChildren` 체크 신규 추가 | 1 |
| ElementSprite.tsx | `CHILD_COMPOSITION_TAGS` 9개 추가 + `_hasLabelChild` 주입 코드 삭제 | 1 |
| **합계** | | **15 specs + 1 인프라** |

---

## 최종 요약

| 분류 | 개수 | 상태 |
|------|------|------|
| A. 자체 메커니즘 | 4 | Card 통합, Tabs/Breadcrumbs/TagGroup은 `CHILD_COMPOSITION_EXCLUDE_TAGS` 유지 |
| B. NON_CONTAINER_TAGS | ~21 | TEXT_TAGS 14 + Void/Visual 3 + Color Sub 4 — 전환 불필요 |
| C. Inline Form | 3 | 완료 |
| E. 신규 전환 대상 | 17 | 15개 완료, Table/Tree 보류 |
| F. 기존 적용 완료 | 23 | 기 적용 (`0cd704f2`에서 통합 정리) |
| Phase 1 신규 | 7 | Button, Badge, ToggleButton, Slot, Panel, ProgressBar, Meter — 미커밋 |

**`_hasChildren` 적용 완료**: 49개 (기존 42 + 신규 7)
**전환 불필요 (NON_CONTAINER_TAGS)**: ~21개
**합성 prop 주입 유지 (EXCLUDE_TAGS)**: 3개 (Tabs, Breadcrumbs, TagGroup)
**보류 (EXCLUDE_TAGS)**: 2개 (Table, Tree — 다단계 중첩 별도 작업)

---

## 커밋 이력

| 커밋 | 내용 |
|------|------|
| `ea23d5fa` | E-1: TextArea, Form, ToggleButtonGroup, Switcher |
| `dfae0947` | C: Checkbox, Radio, Switch (`_hasLabelChild` 초기 구현) |
| `c7a215c6` | E-2: List, ListBox, GridList, Pagination, ColorSwatchPicker |
| `1f49424a` | E-3: Group, Section, ScrollBox, DropZone, FileTrigger, MaskedFrame |
| `0cd704f2` | 패턴 통합: `_hasLabelChild` 전면 제거 → `_hasChildren` 단일화 (15 specs + Card + ElementSprite) |
| 미커밋 | Phase 1: 7 specs (`_hasChildren`) + ElementSprite.tsx (`CHILD_COMPOSITION_EXCLUDE_TAGS` opt-out 전환 + `COMPLEX_COMPONENT_TAGS` 3단계 주입) + BuilderCanvas.tsx (`NON_CONTAINER_TAGS` opt-out 전환) + `factories/constants.ts` (`COMPLEX_COMPONENT_TAGS` 공유 상수 신규) + `useElementCreator.ts` (로컬 배열 → 공유 상수 교체) |

---

## 잔여 작업

1. **Table** — `CHILD_COMPOSITION_EXCLUDE_TAGS`에서 제외 후 `_hasChildren` 체크 추가 필요.
   3단계 중첩(Table → TableRow → TableCell) + PixiTable 특수 렌더 파이프라인으로 별도 설계 필요.

2. **Tree** — `CHILD_COMPOSITION_EXCLUDE_TAGS`에서 제외 후 `_hasChildren` 체크 추가 필요.
   다단계 중첩(Tree → TreeItem 재귀) + expand/collapse 상태 관리로 `_hasChildren` 미적용 상태.

---

## Phase 3: Property Editor 리팩터링 완료 (2026-02-25)

> **완료일**: 2026-02-25
> **범위**: Child Composition Pattern을 Property Editor 레이어까지 확장
> **관련 커밋**: `e9316b5b`, `15810c83`

### 개요

Child Composition Pattern의 spec/canvas 계층 전환에 이어,
Property Editor에서 발생하던 부모-자식 props 이중 히스토리 문제를 해결했다.
인라인 `syncChildProp` 코드를 커스텀 훅으로 추출하고,
store 메서드를 통해 부모+자식 변경을 단일 batch 히스토리로 통합했다.

### 신규 파일

| 파일 | 역할 |
|------|------|
| `apps/builder/src/builder/hooks/useSyncChildProp.ts` | 직계 자식 동기화 — `BatchPropsUpdate[]` 빌더 훅 |
| `apps/builder/src/builder/hooks/useSyncGrandchildProp.ts` | 손자 동기화 훅 (Select, ComboBox 전용) |

### store 메서드 추가

`apps/builder/src/builder/stores/inspectorActions.ts`에 `updateSelectedPropertiesWithChildren` 메서드 추가.

```typescript
// Before: 2회 호출 → 2개 히스토리 엔트리
onUpdate(parentProps);
syncChildProp('Label', 'children', value);

// After: 1회 호출 → 1개 batch 히스토리 엔트리
updateSelectedPropertiesWithChildren(parentProps, buildChildUpdates([
  { tag: 'Label', prop: 'children', value },
]));
```

`batchUpdateElementProps` 기반으로 구현되어, 부모 요소와 지정된 자식 요소들의 prop 변경이
하나의 히스토리 트랜잭션으로 묶인다. Ctrl+Z 1회로 부모+자식이 동시에 원복된다.

### 적용된 에디터 (10개)

| 에디터 | 동기화 대상 자식 |
|--------|----------------|
| TextFieldEditor | Label(children), Input(placeholder, isDisabled, isRequired) |
| NumberFieldEditor | Label(children), Input(placeholder, isDisabled, isRequired) |
| SearchFieldEditor | Label(children), Input(placeholder, isDisabled, isRequired) |
| CheckboxEditor | Label(children), Checkbox(isDisabled, isRequired) |
| RadioEditor | Label(children), Radio(isDisabled) |
| SwitchEditor | Label(children), Switch(isDisabled) |
| SelectEditor | Label(children), Select(isDisabled, isRequired) — 손자 동기화 포함 |
| ComboBoxEditor | Label(children), ComboBox(isDisabled, isRequired) — 손자 동기화 포함 |
| CardEditor | 자식 컨테이너 레이아웃 동기화 |
| SliderEditor | Label(children), Slider(isDisabled, step, minValue, maxValue) |

### DRY 개선 효과

| 지표 | 이전 | 이후 |
|------|------|------|
| 중복 syncChildProp 코드 | 10개 파일 × 8~26줄 | 2개 훅으로 통합 |
| 히스토리 엔트리 수 (prop 변경 1회) | 2개 (부모 + 자식 별개) | 1개 (batch) |
| Undo 횟수 (변경 원복) | 2회 | 1회 |

### 히스토리 단일화 원칙

Child Composition Pattern에서 부모 컴포넌트와 자식 컴포넌트는 의미적으로 하나의 단위다.
TextField의 `label` prop 변경은 Label 자식의 `children`과 항상 함께 변경되어야 하며,
이 두 변경을 별개의 히스토리 엔트리로 기록하면 Undo 시 UI가 불일치 상태에 빠진다.
`updateSelectedPropertiesWithChildren`은 이 원자성(atomicity)을 store 레벨에서 보장한다.

---

## Phase 4: WebGL Spec 패턴 일관성 감사 (2026-02-25)

> **작성일**: 2026-02-25
> **상태**: 코드 수정 완료 — Canvas 수동 확인 필요
> **범위**: 63개 전체 spec 파일의 fontSize TokenRef 해결 패턴 + label 오프셋 일관성 검사

### 배경

`size.fontSize`는 `'{typography.text-md}'` 형식의 TokenRef 문자열이다.
`as unknown as number` 캐스팅은 TypeScript 컴파일러만 만족시키고, 런타임에서는 문자열이 그대로 통과한다.
이 값으로 산술 연산(`fontSize - 2`)을 수행하면 NaN이 발생하여 Canvas 텍스트가 렌더링되지 않는다.

올바른 패턴은 `resolveToken()`을 사용하여 TokenRef → 숫자 변환 후 산술 연산을 수행하는 것이다.

### 감사 결과 요약

| 구분 | 개수 | 설명 |
|------|------|------|
| ✅ 정상 | **38개** | resolveToken 적용 완료 또는 fontSize 미사용 |
| ❌ 수정 필요 | **17개** | `as unknown as number` 캐스팅, resolveToken 미사용 |
| ⚠️ 주의 필요 | **4개** | 부분 적용, 하드코딩 오프셋, 혼합 패턴 |

### ❌ 수정 필요 — fontSize `as unknown as number` 캐스팅 (17개)

| # | 파일 | 줄 | 문제 |
|---|------|-----|------|
| 1 | `Badge.spec.ts` | 167 | resolveToken 미사용, `fontSize as unknown as number` |
| 2 | `Button.spec.ts` | 255 | resolveToken 미사용, `fontSize as unknown as number` |
| 3 | `Checkbox.spec.ts` | 240 | resolveToken 미사용, `fontSize as unknown as number` |
| 4 | `Radio.spec.ts` | 204 | resolveToken 미사용, `fontSize as unknown as number` |
| 5 | `Switch.spec.ts` | 194 | resolveToken 미사용, `fontSize as unknown as number` |
| 6 | `ColorPicker.spec.ts` | 259 | resolveToken 미사용, `fontSize as unknown as number` |
| 7 | `DropZone.spec.ts` | 167 | resolveToken 미사용, `fontSize as unknown as number` |
| 8 | `FileTrigger.spec.ts` | 175 | resolveToken 미사용, `fontSize as unknown as number` |
| 9 | `Input.spec.ts` | 130 | `size.fontSize as unknown as number` 직접 대입 |
| 10 | `Link.spec.ts` | 127 | resolveToken 미사용, `fontSize as unknown as number` |
| 11 | `Menu.spec.ts` | 135 | `size.fontSize as unknown as number` 인라인 캐스팅 |
| 12 | `Pagination.spec.ts` | 165 | resolveToken 미사용, `fontSize as unknown as number` |
| 13 | `Slot.spec.ts` | 142 | resolveToken 미사용, `fontSize as unknown as number` |
| 14 | `Switcher.spec.ts` | 184 | resolveToken 미사용, `fontSize as unknown as number` |
| 15 | `Table.spec.ts` | 206, 258 | 다중 캐스팅 (헤더 셀 + 데이터 셀) |
| 16 | `Toast.spec.ts` | 196 | resolveToken 미사용, `fontSize as unknown as number` |
| 17 | `ToggleButton.spec.ts` | 253 | resolveToken 미사용, `fontSize as unknown as number` |

### ⚠️ 주의 필요 (4개)

| # | 파일 | 문제 |
|---|------|------|
| 1 | `ComboBox.spec.ts` | resolveToken 없이 `typeof === 'number' ? : 14` fallback → 토큰 값 미반영 |
| 2 | `Select.spec.ts` | 동일 패턴 — resolveToken 없이 하드코딩 fallback=14 |
| 3 | `Slider.spec.ts` | 혼합 — label/showValue 텍스트는 `as unknown as number`, offsetY만 resolveToken 사용 |
| 4 | `Tabs.spec.ts` | `size.height` 기반 fontSize 하드코딩 (`height === 25 ? 12 : height === 35 ? 16 : 14`) |

### ⚠️ label 오프셋 하드코딩 (2개)

| # | 파일 | 줄 | 현재 코드 | 올바른 패턴 |
|---|------|-----|----------|-----------|
| 1 | `TextArea.spec.ts` | 186, 210, 228 | `props.label ? 20 : 0` | `labelOffset` 동적 계산 |
| 2 | `ListBox.spec.ts` | 152 | `props.label ? 20 : 0` | `labelOffset` 동적 계산 |

### 수정 패턴

모든 대상 파일에 동일한 3단계 수정을 적용한다:

**Step 1 — import 추가**
```typescript
import { resolveToken } from '../renderers/utils/tokenResolver';
```

**Step 2 — shapes 함수 상단 fontSize 해결 블록 교체**
```typescript
// ❌ Before (잘못된 패턴들)
const fontSize = props.style?.fontSize ?? size.fontSize;                    // 미해결
const fontSize = typeof rawFontSize === 'number' ? rawFontSize : 14;       // 부분 해결
fontSize: size.fontSize as unknown as number,                               // 인라인 캐스팅

// ✅ After (올바른 3단계 패턴)
const rawFontSize = props.style?.fontSize ?? size.fontSize;
const resolvedFs = typeof rawFontSize === 'number'
  ? rawFontSize
  : (typeof rawFontSize === 'string' && rawFontSize.startsWith('{')
      ? resolveToken(rawFontSize as TokenRef)
      : rawFontSize);
const fontSize = typeof resolvedFs === 'number' ? resolvedFs : 16;
```

**Step 3 — shape 객체 필드에서 캐스팅 제거**
```typescript
// ❌ Before
fontSize: fontSize as unknown as number,

// ✅ After
fontSize,  // 이미 number 타입
```

**label 오프셋 수정 패턴**
```typescript
// ❌ Before — 하드코딩
y: props.label ? 20 : 0,

// ✅ After — 동적 계산
const labelFontSize = fontSize - 2;
const labelHeight = Math.ceil(labelFontSize * 1.2);
const labelGap = size.gap ?? 8;
const labelOffset = props.label ? labelHeight + labelGap : 0;
// ...
y: labelOffset,
```

### 에이전트 위임 시 주의사항

이전 세션에서 병렬 에이전트에 fontSize 수정을 위임했을 때, 에이전트들이 `_hasChildren` 패턴을
무단으로 삭제하는 사고가 발생했다. 이 작업을 에이전트에 위임할 때는 반드시 다음을 프롬프트에 포함:

```
⚠️ 수정 금지 패턴 — 아래 코드는 절대 변경/삭제/이동하지 마세요:

1. _hasChildren 패턴:
   const hasChildren = !!(props as Record<string, unknown>)._hasChildren;
   if (hasChildren) return shapes;

2. shapes 함수의 early return 구조
3. 요청 범위 외 리팩토링
```

상세 가이드: `SKILL.md` > "서브에이전트 위임 가이드라인" 참조

### 완료 기준

- [x] 17개 ❌ 파일에 resolveToken 3단계 패턴 적용
- [x] 4개 ⚠️ 파일 수정 (ComboBox, Select, Slider, Tabs)
- [x] 2개 label 오프셋 하드코딩 수정 (TextArea, ListBox)
- [x] `npx tsc --noEmit` 타입 체크 통과
- [x] `pnpm build` (specs 빌드) 성공
- [ ] Canvas에서 각 컴포넌트 텍스트 렌더링 정상 확인

---

## Phase 5: `_hasChildren` 적용 검증 감사 (2026-02-25)

> **작성일**: 2026-02-25
> **상태**: 코드 수정 완료 — Canvas 수동 확인 필요
> **범위**: 인프라 파일 4개 + spec 파일 49개 전수 검증
> **Phase 4와의 관계**: 별개 문제 (원인·수정 대상·영향 파일 모두 다름, 독립 수정 가능)

### 배경

문서에 기술된 `_hasChildren` 3단계 주입 로직과 49개 spec 적용 현황이
실제 코드와 일치하는지 전수 검증을 수행했다.

### 감사 결과 요약

| 구분 | 대상 | 결과 |
|------|------|------|
| 인프라 — `factories/constants.ts` | COMPLEX_COMPONENT_TAGS 40개 | ✅ 일치 |
| 인프라 — `BuilderCanvas.tsx` | NON_CONTAINER_TAGS 21개 | ✅ 일치 |
| 인프라 — `useElementCreator.ts` | 공유 상수 import | ✅ 일치 |
| 인프라 — `ElementSprite.tsx` | 3단계 주입 로직 | ❌ 불일치 |
| Spec — COMPLEX (36개) | `_hasChildren` 체크 | ❌ 6개 누락 |
| Spec — Non-complex (13개) | `_hasChildren` 체크 | ✅ 전원 적용 |
| Spec — 패턴 일관성 | 변수명·참조 방식 통일 | ⚠️ 6개 비표준 |

### ❌ P1: ElementSprite.tsx — 3단계 주입 로직 미구현

**문서 기술 (의도된 로직):**
```typescript
if (!CHILD_COMPOSITION_EXCLUDE_TAGS.has(tag)) {
  if (COMPLEX_COMPONENT_TAGS.has(tag) || (childElements && childElements.length > 0)) {
    specProps = { ...specProps, _hasChildren: true };
  }
}
```

**실제 코드:**
```typescript
if (!CHILD_COMPOSITION_EXCLUDE_TAGS.has(tag)) {
  if (childElements && childElements.length > 0) {  // ← COMPLEX 체크 누락
    specProps = { ...specProps, _hasChildren: true };
  }
}
```

**영향**: COMPLEX 컴포넌트(TextField 등)에서 모든 자식을 삭제하면
`_hasChildren`이 주입되지 않아 standalone 렌더링으로 복귀하는 버그 잔존.

**수정**: `COMPLEX_COMPONENT_TAGS` import 후 조건에 추가.

### ❌ P1: Spec 파일 6개 — `_hasChildren` 패턴 누락

모두 COMPLEX_COMPONENT_TAGS에 포함된 Input Field 계열이며,
spec의 `shapes()` 함수에 `_hasChildren` 체크 코드가 없다.

| # | 파일 | 비고 |
|---|------|------|
| 1 | `TextArea.spec.ts` | TextField과 유사 구조, 패턴 누락 |
| 2 | `NumberField.spec.ts` | 동일 |
| 3 | `SearchField.spec.ts` | 동일 |
| 4 | `DateField.spec.ts` | 동일 |
| 5 | `TimeField.spec.ts` | 동일 |
| 6 | `ColorField.spec.ts` | 동일 |

**증상**: 자식 Element가 라벨을 담당하는데도 spec이 라벨을 직접 그려 이중 렌더링 발생.

**수정 패턴** (TextField.spec.ts 기존 패턴과 동일):
```typescript
const hasChildren = !!(props as Record<string, unknown>)._hasChildren;
if (hasChildren) return shapes;
```

### ⚠️ P2: Spec 패턴 비표준 — 변수명·참조 방식 불일치 (6개)

기능상 정상이나 코드 일관성 개선 권고.

**구패턴 변수명 `hasLabelChild` (4개):**

| # | 파일 | 현재 코드 | 권고 |
|---|------|----------|------|
| 1 | `Checkbox.spec.ts` | `const hasLabelChild = !!(props as Record<string, unknown>)._hasChildren;` | `hasChildren`으로 변수명 통일 |
| 2 | `Radio.spec.ts` | 동일 | 동일 |
| 3 | `Switch.spec.ts` | 동일 | 동일 |
| 4 | `Slider.spec.ts` | 동일 | 동일 |

**직접 prop 참조 (2개):**

| # | 파일 | 현재 코드 | 권고 |
|---|------|----------|------|
| 1 | `Select.spec.ts` | `if (props.label && !props._hasChildren)` | `const hasChildren = !!()` 변수화 |
| 2 | `ComboBox.spec.ts` | 동일 | 동일 |

### Phase 4와의 관계

| | Phase 5 (`_hasChildren` 누락) | Phase 4 (fontSize TokenRef) |
|---|---|---|
| **원인** | spec에 `_hasChildren` 체크 코드 부재 | `resolveToken()` 미사용, `as unknown as number` 캐스팅 |
| **증상** | 자식 있어도 spec이 라벨 직접 렌더링 (이중) | 산술 연산 NaN → 텍스트 미표시 |
| **수정** | `hasChildren` 체크 + 조건부 shapes 스킵 | `resolveToken()` 3단계 패턴 |
| **파일 겹침** | 없음 (6개 vs 17+4개, 대상 파일 상이) | — |

두 Phase는 독립적이며 수정 순서에 의존성이 없다.

### 완료 기준

- [x] ElementSprite.tsx에 `COMPLEX_COMPONENT_TAGS` 체크 추가
- [x] 6개 spec에 `_hasChildren` 패턴 추가 (TextArea, NumberField, SearchField, DateField, TimeField, ColorField)
- [x] (P2) 4개 spec 변수명 통일: `hasLabelChild` → `hasChildren`
- [x] (P2) 2개 spec 직접 참조 → 변수화 (Select, ComboBox)
- [x] `npx tsc --noEmit` 타입 체크 통과
- [ ] Canvas에서 자식 있는 상태의 이중 렌더링 해소 확인
- [ ] Canvas에서 COMPLEX 컴포넌트 자식 삭제 시 standalone 미복귀 확인
