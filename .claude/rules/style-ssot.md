---
description: Style SSOT — store longhand 정책과 element.props.style consumer 읽기 계약 (ADR-909)
paths:
  - "packages/specs/**"
  - "apps/builder/src/builder/panels/**"
  - "apps/builder/src/builder/stores/**"
  - "apps/builder/src/builder/components/property/**"
  - "apps/builder/src/builder/workspace/canvas/layout/**"
---

# Style SSOT 정책 — Store Longhand Policy ↔ Consumer Normalization

> **SSOT 체인 연계**: 본 규칙은 [ssot-hierarchy.md](ssot-hierarchy.md) **D3 (시각 스타일) 내부 경계 규칙**. Store ↔ Consumer 간 contract 를 정의.
>
> **공식 결정**: [ADR-909](../../docs/adr/completed/909-style-ssot-contract.md)

## 정책 (CRITICAL)

composition Inspector 의 `distributeShorthand` (inspectorActions.ts) 는 CSS shorthand 를 longhand 로 자동 분해하여 Zustand store 에 저장한다:

| Shorthand (편집 UI) | Longhand (store 저장)                                        |
| ------------------- | ------------------------------------------------------------ |
| `gap`               | `rowGap`, `columnGap`                                        |
| `padding`           | `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft` |
| `margin`            | `marginTop`, `marginRight`, `marginBottom`, `marginLeft`     |

**Why**: React inline-style shorthand+longhand 공존 시 rerender 경고 + 레이아웃 엔진 어댑터 `applyCommonEngineStyle` 순서 (gap → rowGap/columnGap override) 경합 방지.

**Consumer 제약**: `element.props.style` 을 읽는 모든 consumer (spec render.shapes, layout utils, Inspector UI) 는 **longhand 우선 + shorthand fallback** 으로 읽어야 한다.

## 필수 읽기 패턴

### Gap

```ts
// ❌ 금지 — store longhand 정책 위반, 편집 무시
const gap = parsePxValue(props.style?.gap, defaultGap);

// ✅ 필수 — longhand 우선, legacy shorthand fallback
const gap = parsePxValue(
  props.style?.rowGap ?? props.style?.columnGap ?? props.style?.gap,
  defaultGap,
);

// ✅ 권장 (container spacing 전체 resolve) — Layer B primitive 재사용
import { resolveContainerSpacing } from "@composition/specs";
const spacing = resolveContainerSpacing({
  style: props.style as Record<string, unknown> | undefined,
  defaults: { rowGap: size.gap, columnGap: size.gap, ... },
});
const gap = spacing.rowGap;
```

### Padding

```ts
// ❌ 금지 — padding shorthand 만 읽으면 편집 무시 (store 는 paddingTop 등만 저장)
const padding = parsePxValue(props.style?.padding, size.paddingY);

// ✅ 필수 (uniform 가정) — longhand 우선, shorthand fallback
const padding = parsePxValue(
  props.style?.paddingTop ?? props.style?.padding,
  size.paddingY,
);

// ✅ 권장 (4-way 비대칭) — Layer B primitive
const spacing = resolveContainerSpacing({
  style: props.style as Record<string, unknown> | undefined,
  defaults: { paddingTop, paddingRight, paddingBottom, paddingLeft },
});
// spacing.paddingTop/Right/Bottom/Left 4-way 개별 참조
```

### Layout utils

```ts
// ❌ 금지
const gap = parseNumericValue(style?.gap) ?? fallback;

// ✅ 필수 — helper 사용 (utils.ts 내부 readGapValue)
const gap = readGapValue(style) ?? fallback;
```

## Inspector "dirty" 판정 배열

Style 패널의 section header 우측 reset 버튼 활성화 로직 (`useHasDirtyStyles`) 이 검사하는 key 배열은 **store 가 저장하는 longhand 를 반드시 포함** 해야 한다.

```ts
// ❌ 금지 — shorthand 만 포함 → gap 편집 후 reset 버튼 dim
const LAYOUT_PROPS = [..., "gap", "padding", "paddingTop", ...];

// ✅ 필수 — shorthand + longhand 전체
const LAYOUT_PROPS = [
  ...,
  "gap", "rowGap", "columnGap",
  "padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "margin", "marginTop", "marginRight", "marginBottom", "marginLeft",
];
```

## PropertyUnitInput commit 조건

Inspector 의 `PropertyUnitInput` 은 편집 commit (onChange) 판정을 **`lastSavedValueRef` 기준 단독** 으로 해야 한다. `value` prop 기반 비교는 preview 경로가 `elementsMap` 을 mutate 하면서 value prop 이 편집값으로 미리 반영되면 "변경 없음" 으로 오판하여 commit 이 skip 되기 때문.

```ts
// ❌ 금지 — preview 가 elementsMap 을 mutate 하면 valueActuallyChanged=false → commit skip → DB 미저장
const valueActuallyChanged = parseUnitValue(value).numericValue !== num;
if (valueActuallyChanged && newValue !== lastSavedValueRef.current) {
  onChange(newValue);
}

// ✅ 필수 — lastSavedValueRef (이전 commit 결과) 단독 기준
const newValue = `${num}${effectiveUnit}`;
if (newValue !== lastSavedValueRef.current) {
  lastSavedValueRef.current = newValue;
  onChange(newValue);
}
```

또한 `useEffect` 가 value prop 변경 시 `lastSavedValueRef` 와 `inputValue` 를 리셋하는데, **focus 중 (같은 element)** 에는 skip 해야 한다. Preview 가 elementsMap 을 mutate 하면서 value prop 이 바뀌어도 사용자 편집 세션을 보존.

```ts
useEffect(() => {
  const currentSelectedId = selectedElementId ?? null;
  const isFocusedOnSameElement =
    focusedElementIdRef.current !== null &&
    focusedElementIdRef.current === currentSelectedId;
  if (isFocusedOnSameElement) return; // ← preview-induced value 변경 무시

  lastSavedValueRef.current = value;
  focusedElementIdRef.current = null;
  // ... inputValue 재세팅
}, [value, selectedElementId, parsed.numericValue, parsed.unit]);
```

## 신규 Consumer 추가 시 체크리스트

새로운 spec / layout utils 분기 / Inspector section 을 추가할 때:

- [ ] gap 읽기: `style.rowGap ?? style.columnGap ?? style.gap` 순서 (또는 `resolveContainerSpacing` / `readGapValue`).
- [ ] padding 읽기: `style.paddingTop ?? style.padding` (uniform) 또는 `resolveContainerSpacing` (4-way).
- [ ] margin 읽기: 동일 패턴.
- [ ] Inspector section 의 "dirty" 배열에 longhand 전체 포함.
- [ ] PropertyUnitInput 류 input 의 commit 조건은 `lastSavedValueRef` 기준 단독.

## 금지 패턴 요약

- ❌ `props.style?.gap` 단독 읽기 (longhand 저장된 경우 undefined → fallback 고정)
- ❌ `props.style?.padding` 단독 읽기 (동일)
- ❌ `LAYOUT_PROPS` 같은 배열에 shorthand 만 포함 (longhand 편집 미감지)
- ❌ PropertyUnitInput commit 판정을 `value` prop 기반 diff 로 처리
- ❌ `useEffect([value, ...])` 가 focus 중에도 `lastSavedValueRef` / `inputValue` 무조건 리셋

## 관련 primitive / helper

- `packages/specs/src/primitives/containerSpacing.ts::resolveContainerSpacing` (Layer B — 4-way padding + row/columnGap + borderWidth + fontSize 통합)
- `packages/specs/src/primitives/cssValueParser.ts::parsePxValue / parseGapValue / parsePadding4Way / parseBorderWidth` (Layer A)
- `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts::readGapValue` (layout utils 내부)
- `packages/specs/src/renderers/utils/collectionItemMetrics.ts::resolveListBoxSpacingMetric / resolveGridListSpacingMetric` (Layer D resolver)

## 관련 ADR

- [ADR-063](../../docs/adr/completed/063-ssot-chain-charter.md) — 3-domain 분할 charter
- [ADR-907](../../docs/adr/completed/907-collection-container-style-pipeline.md) — Collection container style pipeline (Layer B/C/D 도입)
- [ADR-909](../../docs/adr/completed/909-style-ssot-contract.md) — 본 규칙의 공식 결정
