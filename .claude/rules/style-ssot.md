---
description: Style SSOT — catalog typed field 저장 모델 (shorthand 분해 · gap 축) 과 consumer 읽기 계약 (ADR-909 → ADR-248 catalog runtime)
paths:
  - "packages/specs/**"
  - "apps/builder/src/builder/panels/styles/**"
  - "apps/builder/src/builder/panels/properties/**"
  - "apps/builder/src/builder/panels/design/**"
  - "apps/builder/src/builder/components/property/**"
  - "apps/builder/src/builder/catalogRuntime/styleFields.ts"
  - "apps/builder/src/builder/catalogRuntime/styleDirty.ts"
  - "apps/builder/src/builder/catalogRuntime/boxModel.ts"
  - "apps/builder/src/builder/catalogRuntime/editContract.ts"
  - "apps/builder/src/builder/workspace/canvas/layout/**"
---

# Style SSOT 정책 — typed field 저장 모델 ↔ Consumer 읽기 계약

> **SSOT 체인 연계**: [ssot-hierarchy.md](ssot-hierarchy.md) **D3 (시각 스타일) 내부 경계 규칙**. 저장 모델과 consumer 사이의 계약을 정의한다.
>
> **공식 결정**: [ADR-909](../../docs/adr/completed/909-style-ssot-contract.md) (shorthand / longhand 공존 금지 원칙). 저장 위치는 ADR-248 Phase 4 (2026-10-03) 로 바뀌었다 — 옛 `inspectorActions.distributeShorthand` 가 Zustand `props.style` 에 longhand 를 쓰던 경로는 삭제됐다. 상태 파이프라인 전체: [state-management.md](state-management.md).

## 1. 저장 모델 (CRITICAL)

Styles 패널의 CSS 키는 `NodeEntry` 의 **typed field** (`visual` · `layout` · `sizing`) 에 저장된다. 매핑의 유일한 정본은 `catalogRuntime/styleFields.ts` 의 `catalogStyleWrites` 다.

| CSS 키 (편집 UI)                                                                        | 저장 field                                                                                                     |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `padding` (shorthand)                                                                   | `visual.paddingTop/Right/Bottom/Left` 로 **분해** (px 숫자)                                                    |
| `margin` (shorthand)                                                                    | `layout.marginTop/Right/Bottom/Left` 로 **분해** (CSS 텍스트)                                                  |
| `gap`                                                                                   | `visual.gap` **단일 field** — 분해하지 않는다. Canvas 간격 핸들도 같은 field 를 쓴다                           |
| `rowGap` · `columnGap`                                                                  | `layout.rowGap` · `layout.columnGap` (별도 field)                                                              |
| `fontSize` · `borderWidth` · `border*Width` · `padding*` · `letterSpacing` · `zIndex` … | `visual` 의 px 숫자                                                                                            |
| `borderRadius` · `border*Radius`                                                        | `visual.radius` · `visual.radiusTopLeft` … (px 숫자)                                                           |
| `display` · `flex*` · `align*` · `justify*` · `grid*` · `position` · `verticalAlign`    | `layout` (CSS 텍스트)                                                                                          |
| `left` · `top` · `right` · `bottom`                                                     | `layout.insetLeft/Top/Right/Bottom` (절대 배치의 left/top 편집은 `catalogPlacementEditCommand` — placement 축) |
| `width` · `height` · `min*`                                                             | px 값이면 `sizing`, 그 밖의 길이 (`100%` · `fit-content` 등) 는 `visual`                                       |
| `maxWidth` · `maxHeight`                                                                | px 값이면 `sizing`, 그 밖은 `layout`                                                                           |
| `lineHeight`                                                                            | `visual.lineHeight` = **글자 크기 대비 비율**                                                                  |

- shorthand 분해는 `padding` · `margin` 둘뿐이다. typed field 가 담을 수 없는 값은 `CatalogStyleValueError` 를 던지고, host 가 toast 로 보여 준다 (값을 버리거나 `props.style` 로 우회하지 않는다).
- **Why (ADR-909 원칙 유지)**: 같은 축을 shorthand 와 longhand 두 곳에 두면 consumer 마다 우선순위가 갈려 패널 편집이 무시된다. catalog 는 축마다 field 를 하나로 정하고 (`padding` → 4변, `gap` → `visual.gap`), 그 위에 덧쓰는 longhand (`rowGap` · `columnGap`) 의 우선순위를 consumer 쪽에서 한 번 정한다 (§3).

## 2. 쓰기 · 미리보기 경로

| 편집                          | 경로                                                                                                                                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Styles 값 commit              | `panels/styles/catalog/catalogStylesHost.ts` `styleCommandOf` → `catalogStyleWritesOf` + `setFields` (활성 breakpoint 레이어) → `workspace.execute` 한 step                               |
| Styles 미리보기 (드래그 · 휠) | `previewStyle` / `previewFills` → `workspace.root.previewRecord` — **레이아웃까지 반영, 문서 · 히스토리 쓰기 0**. 손을 놓을 때 commit 한 번                                               |
| Fill                          | `setWholeField("fills")` + 파생 visual 제거                                                                                                                                               |
| Reset                         | `catalogResetStyleWrites` (`catalogRuntime/styleDirty.ts`)                                                                                                                                |
| Canvas 간격 핸들              | `catalogRuntime/canvasGesture.ts` — `visual.gap` / `visual.padding*`                                                                                                                      |
| Layout 섹션 Gap 필드          | 한 줄 flex 는 주축 longhand (row → `columnGap`, column → `rowGap`), 그 밖 (wrap · grid · block) 은 `gap` — `resolveGapAxisProperty` (ADR-222, `panels/styles/sections/LayoutSection.tsx`) |
| Props (컴포넌트 설정)         | `catalogSemanticPatchCommand` — style 과 별개 축                                                                                                                                          |

## 3. 읽기 계약

| Consumer                      | 위치                                                                           | 우선순위                                                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 상자 모델 (Canvas · DOM 공용) | `catalogRuntime/boxModel.ts` `catalogBoxModel`                                 | padding: `paddingTop` > `paddingY` > `padding` (4변 각각). gap: `visual.gap`                                                                                               |
| 레이아웃 엔진 입력            | `compositionRoot.ts` `styleOf`                                                 | `box.gap` 을 `rowGap`/`columnGap` 로 펼친 **뒤** `itemLayout` (`layout.rowGap` · `columnGap`) 이 덮는다 → **longhand 가 `visual.gap` 을 이긴다**                           |
| DOM 투영                      | `catalogRuntime/domBinding.tsx`                                                | 상자 모델의 gap 을 `rowGap` · `columnGap` longhand 로 낸다                                                                                                                 |
| 패널 표시                     | `styleFields.ts` `catalogStyleView` → `panels/styles/hooks/useLayoutValues.ts` | view 는 `visual.gap` 을 `gap`, `layout.rowGap`/`columnGap` 을 longhand 로 낸다. Gap 표시는 `axisGap ?? rowGap ?? columnGap ?? gap` (longhand 우선 — 엔진 입력과 같은 순서) |

- 새 consumer 는 typed field 를 직접 읽지 말고 위 함수 (`catalogBoxModel` · `catalogStyleView`) 를 거친다 — 우선순위가 한 곳에서만 정해지도록.
- **재확인 필요 (미재현)**: rule-backed 노드의 DOM 인라인 스타일에서 authored `gap` (`domBinding.tsx` `AUTHORED_CSS.gap`, shorthand) 과 `catalogLayoutCss` 의 `rowGap` / `columnGap` 이 함께 실리면 ADR-909 가 막으려던 React shorthand + longhand 공존 경고 조건이 다시 생길 수 있다. 증상이 보이면 여기부터 본다.

## 4. Dirty 판정 배열

Styles 섹션 reset 버튼 · 탭 dot 은 `catalogDirtyStyleProps` (`catalogRuntime/styleDirty.ts`) 가 판정한다. CSS 키마다 **그 키가 매핑되는 typed field 에 값이 있는지** 로 본다 (같은 field 를 longhand 가 이미 보고하면 shorthand 를 중복으로 세지 않는다). 그래서 섹션 키 목록 (`panels/styles/sections/styleSectionProps.ts`) 에 **longhand 를 전부** 넣어야 한다 — `rowGap` 이 목록에 없으면 `layout.rowGap` 편집을 감지하지 못한다.

```ts
// ✅ 필수 — shorthand + longhand 전체
const LAYOUT_PROPS = [
  ...,
  "gap", "rowGap", "columnGap",
  "padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "margin", "marginTop", "marginRight", "marginBottom", "marginLeft",
];
```

## 5. PropertyUnitInput commit 조건

정본: [state-management.md §7](state-management.md). 요지 — commit 판정은 `lastSavedValueRef` 기준 단독, value prop 동기화 `useEffect` 는 같은 요소에 focus 중이면 건너뛴다 (`components/property/PropertyUnitInput.tsx`). catalog 미리보기는 문서를 쓰지 않아 value prop 이 commit 값에 머물지만, 가드는 focus 중 외부 갱신으로부터 편집 세션을 지키는 방어로 유지한다.

## 6. 신규 Consumer · 키 추가 체크리스트

- [ ] 새 CSS 키는 `styleFields.ts` 의 키 집합 (`VISUAL_NUMBER` · `LAYOUT_TEXT` · `RADIUS` · `INSET` …) 에 넣어 typed field 를 정한다. 담을 수 없는 값은 `CatalogStyleValueError`.
- [ ] 레이아웃에 영향을 주는 키면 [layout-engine.md](layout-engine.md) 「새 레이아웃 키를 추가할 때」 체크리스트 (`styleOf` · `PAINT_ONLY_VISUAL_KEYS`) 를 같이 본다.
- [ ] gap · padding · margin 읽기는 `catalogBoxModel` / `catalogStyleView` 경유 (직접 `visual.gap` 단독 읽기 금지 — longhand 덮어쓰기를 놓친다).
- [ ] Styles 섹션 dirty 키 목록에 longhand 전체 포함.
- [ ] PropertyUnitInput 류 input 의 commit 조건은 `lastSavedValueRef` 기준 단독.

## 7. 금지 패턴

- ❌ `visual.gap` 단독 읽기 (`layout.rowGap` / `columnGap` 덮어쓰기 누락)
- ❌ typed field 가 담지 못하는 값을 `props.style` 등 다른 축으로 우회 저장
- ❌ dirty 키 배열에 shorthand 만 포함 (longhand 편집 미감지)
- ❌ 미리보기에서 `workspace.execute` 호출 (드래그 한 번에 히스토리 수십 개) — `previewRecord` 를 쓴다
- ❌ PropertyUnitInput commit 판정을 `value` prop 기반 diff 로 처리

## 8. parity 하니스 전용 helper (production 아님)

아래는 `fullTreeLayout.ts` parity 경로와 specs 내부 계산이 쓴다. production Canvas · 레이아웃은 위 §3 의 함수를 쓴다 — 여기에 고쳐도 화면은 바뀌지 않는다.

- `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts::readGapValue` · `resolveContainerSpacing` 호출부
- `packages/specs/src/primitives/containerSpacing.ts::resolveContainerSpacing` (Layer B) · `cssValueParser.ts::parsePxValue / parseGapValue / parsePadding4Way` (Layer A)
- `packages/specs/src/renderers/utils/collectionItemMetrics.ts::resolveListBoxSpacingMetric / resolveGridListSpacingMetric` (Layer D)

## 관련 ADR

- [ADR-063](../../docs/adr/completed/063-ssot-chain-charter.md) — 3-domain 분할 charter
- [ADR-907](../../docs/adr/completed/907-collection-container-style-pipeline.md) — Collection container style pipeline (Layer B/C/D)
- [ADR-909](../../docs/adr/completed/909-style-ssot-contract.md) — shorthand / longhand 계약 원칙
- [ADR-222](../../docs/adr/completed/222-canvas-padding-gap-direct-manipulation.md) — Canvas 간격 직접 조작 · Gap 필드 주축 longhand
- [ADR-248](../../docs/adr/248-unified-catalog-document.md) — catalog 문서 · typed field 저장 모델
