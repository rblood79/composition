---
description: Style SSOT — catalog typed field 저장 모델 (shorthand 분해 · gap 축) 과 consumer 읽기 계약 (ADR-909 → ADR-248 catalog runtime)
paths:
  - "apps/builder/src/builder/panels/styles/**"
  - "apps/builder/src/builder/panels/properties/**"
  - "apps/builder/src/builder/panels/design/**"
  - "apps/builder/src/builder/components/property/**"
  - "apps/builder/src/builder/catalogRuntime/styleFields.ts"
  - "apps/builder/src/builder/catalogRuntime/styleDirty.ts"
  - "apps/builder/src/builder/catalogRuntime/boxModel.ts"
  - "apps/builder/src/builder/catalogRuntime/editContract.ts"
  - "apps/builder/src/builder/catalogRuntime/effectiveStyle.ts"
  - "apps/builder/src/builder/catalogRuntime/drawnBoxModel.ts"
  - "apps/builder/src/builder/catalogRuntime/restoredWrites.ts"
  - "apps/builder/src/builder/catalogRuntime/panelTokens.ts"
  - "apps/builder/src/builder/catalogRuntime/canvasGesture.ts"
  - "packages/shared/src/catalog/runtime/domBinding.runtime.ts"
  - "packages/shared/src/catalog/runtime/boxModel.ts"
  - "packages/shared/src/catalog/runtime/rulePaint.ts"
  - "packages/shared/src/catalog/runtime/compositionRoot.ts"
  - "apps/builder/src/builder/workspace/canvas/layout/**"
---

# Style SSOT 정책 — typed field 저장 모델 ↔ Consumer 읽기 계약

> **SSOT 체인 연계**: [ssot-hierarchy.md](ssot-hierarchy.md) **D3 (시각 스타일) 내부 경계 규칙**. 저장 모델과 consumer 사이의 계약을 정의한다.
>
> **공식 결정**: [ADR-909](../../docs/adr/completed/909-style-ssot-contract.md) (shorthand / longhand 공존 금지 원칙). 저장 위치는 ADR-248 Phase 4 (2026-10-03) 로 바뀌었다 — 옛 `inspectorActions.distributeShorthand` 가 Zustand `props.style` 에 longhand 를 쓰던 경로는 삭제됐다. 상태 파이프라인 전체: [state-management.md](state-management.md).

## 1. 저장 모델 (CRITICAL)

Styles 패널의 CSS 키는 `NodeEntry` 의 **typed field** (`visual` · `layout` · `sizing`) 에 저장된다. 매핑의 유일한 정본은 `catalogRuntime/styleFields.ts` 의 `catalogStyleWrites` 다.

| CSS 키 (편집 UI)                                                                        | 저장 field                                                                                                                                                                  |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `padding` (shorthand)                                                                   | `visual.paddingTop/Right/Bottom/Left` 로 **분해** (px 숫자)                                                                                                                 |
| `margin` (shorthand)                                                                    | `layout.marginTop/Right/Bottom/Left` 로 **분해** (CSS 텍스트)                                                                                                               |
| `gap`                                                                                   | `visual.gap` **단일 field** — 분해하지 않는다. Canvas 간격 핸들도 같은 field 를 쓴다                                                                                        |
| `rowGap` · `columnGap`                                                                  | `layout.rowGap` · `layout.columnGap` (별도 field)                                                                                                                           |
| `fontSize` · `borderWidth` · `border*Width` · `padding*` · `letterSpacing` · `zIndex` … | `visual` 의 px 숫자                                                                                                                                                         |
| `borderRadius` · `border*Radius`                                                        | `visual.radius` · `visual.radiusTopLeft` … (px 숫자)                                                                                                                        |
| `display` · `flex*` · `align*` · `justify*` · `grid*` · `position` · `verticalAlign`    | `layout` (CSS 텍스트)                                                                                                                                                       |
| `left` · `top` · `right` · `bottom`                                                     | `layout.insetLeft/Top/Right/Bottom` — 저작 absolute 의 위치도 같은 field (ADR-275, 노드 `placement` 삭제). Canvas 이동 · 정렬은 제약 (`positionConstraint.ts`) 을 지켜 쓴다 |
| `width` · `height` · `min*`                                                             | px 값이면 `sizing`, 그 밖의 길이 (`100%` · `fit-content` 등) 는 `visual`                                                                                                    |
| `maxWidth` · `maxHeight`                                                                | px 값이면 `sizing`, 그 밖은 `layout`                                                                                                                                        |
| `lineHeight`                                                                            | `visual.lineHeight` = **글자 크기 대비 비율**                                                                                                                               |

- shorthand 분해는 `padding` · `margin` 둘뿐이다. typed field 가 담을 수 없는 값은 `CatalogStyleValueError` 를 던지고, host 가 toast 로 보여 준다 (값을 버리거나 `props.style` 로 우회하지 않는다).
- **Why (ADR-909 원칙 유지)**: 같은 축을 shorthand 와 longhand 두 곳에 두면 consumer 마다 우선순위가 갈려 패널 편집이 무시된다. catalog 는 축마다 field 를 하나로 정하고 (`padding` → 4변, `gap` → `visual.gap`), 그 위에 덧쓰는 longhand (`rowGap` · `columnGap`) 의 우선순위를 consumer 쪽에서 한 번 정한다 (§3).

## 2. 쓰기 · 미리보기 경로

| 편집                          | 경로                                                                                                                                                                                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Styles 값 commit              | `panels/styles/catalog/catalogStylesHost.ts` `styleCommandOf` → `catalogStyleWritesOf` + `setFields` (활성 breakpoint 레이어) → `workspace.execute` 한 step                                                                               |
| Styles 미리보기 (드래그 · 휠) | `previewStyle` / `previewFills` → `workspace.root.previewRecord` — **레이아웃까지 반영, 문서 · 히스토리 쓰기 0**. 손을 놓을 때 commit 한 번                                                                                               |
| Fill                          | `setWholeField("fills")` + 파생 visual 제거                                                                                                                                                                                               |
| Reset                         | `catalogResetStyleWrites` (`catalogRuntime/styleDirty.ts`)                                                                                                                                                                                |
| Canvas 간격 핸들              | `catalogRuntime/canvasGesture.ts` — `visual.gap` / `visual.padding*`. 기본은 Spacing 단계 스냅 → 토큰 commit, 드래그 중 ⌘/Ctrl = 1px 리터럴 (ADR-298 Phase 4 — 단계표 `components/property/propertyUnitSteps.ts` 를 입력기 scrub 과 공유) |
| Layout 섹션 Gap 필드          | 한 줄 flex 는 주축 longhand (row → `columnGap`, column → `rowGap`), 그 밖 (wrap · grid · block) 은 `gap` — `resolveGapAxisProperty` (ADR-222, `panels/styles/utils/gapAxis.ts`)                                                           |
| Props (컴포넌트 설정)         | `catalogSemanticPatchCommand` — style 과 별개 축                                                                                                                                                                                          |

- 미리보기도 commit 과 같은 맥락으로 쓰기를 만든다 — `catalogStyleWritesOf` 에 record 의 `visual` 을 넘겨 border companion (`catalogBorderCompanionWrites`) 이 노드에 이미 있는 축을 채우지 않게 한다. **Why (2026-10-15)**: 미리보기만 `visual` 없이 만들어 Width 드래그 중 색이 기본 회색 (`#d4d4d4`) 으로, Color 고르는 중 두께가 기본 1px 로 바뀌었다 (사용자 보고).
- **토큰 preset (Spacing · Radius · Border Width · Shadow · Font Size 의 단계) 은 노드에 토큰 참조 (`TokenUse`) 로 commit 된다 (ADR-298 Phase 2)** — 패널 값의 토큰 글자는 그 토큰의 CSS 변수 (`var(--spacing-md)` — `tokenToCSSVar`) 이고, `catalogRuntime/panelTokens.ts` 가 그 글자 ↔ `lib:token:<ref>` 를 잇는 유일한 자리다 (`catalogStyleWrites` 쓰기 · `catalogStyleView` 읽기). 칸은 칩 (단계 라벨) + **활성 테마 snapshot 의 해석값** 을 보인다 — `PropertyUnitInput.runtime.ts` `getCssVariableValue` · `panels/styles/utils/cssLengthPx.ts` 가 TokenRef 를 `resolveToken` 으로 푼다 (ADR-295 Decision 5). 숫자를 치면 리터럴, 토큰 값을 보기만 하고 떠나면 토큰 그대로 (D9). Gap 필드 (한 줄 flex 의 주축 longhand · grid Gap X · Y) 의 토큰은 그 longhand 의 토큰 참조다 (아래 Phase 3). **Why (2026-10-30 · 2026-11-01)**: 빌더 문서 root 의 computed value 로 풀면 chrome 고정값 (radius md 6) 이 사용자 문서에 들어간다 (295). 해석값을 commit 하던 동안은 테마 radius · 색 모드를 바꿔도 노드 값이 따라오지 않았다 (298 RED 1번).
- **색 · inset · gap longhand 도 토큰 참조다 (ADR-298 Phase 3)** — fill 색 층 · 그라데이션 스톱 (`CatalogFillColor`) 과 layout 의 inset 네 변 · `rowGap` · `columnGap` (`LayoutTokenField`) 은 `string | TokenUse` 이다. 패널 글자는 토큰의 CSS 변수 그대로 — 색은 테마 변수 이름이라 토큰 이름과 다를 수 있다 (`{color.base}` = `var(--bg)`), 그래서 commit 값은 반드시 `tokenToCSSVar(ref)` 로 만든다 (`var(--<이름>)` 을 손으로 조립하지 않는다). fill 은 `panelFillLayers` · `panelFillItems` (`panelTokens.ts`) 가 문서 ↔ 패널 항목을 잇고, 미리보기 record 는 `panelResolvedFillLayers` (활성 모드 hex). resolver 가 record 를 활성 모드 `#RRGGBBAA` · px 로 풀고 출처를 남겨 DOM 이 변수로 쓴다. **Why (2026-11-02)**: Theme 스와치가 `var(--<이름>)` 을 commit 해 이름 ≠ 변수인 8 토큰 (`base` · `raised` · `layer-1` · `layer-2` · `elevated` · `neutral` · `neutral-subtle` · `neutral-subdued`) 이 토큰이 아니라 해석 불가 글자로 떨어졌다 (live 재현 — 단위 테스트는 이름 = 변수인 `accent` 만 썼다). 게이트 `adr298Phase3.test.ts` 「every Theme palette swatch's variable writes its token」.
- **값 쓰기는 「보이던 값과 같으면 지움」 을 거친다** — Styles commit · Fill · 캔버스 글자 편집 · 캔버스 spacing/resize 손잡이는 `catalogDropRestoredWrites` (`catalogRuntime/restoredWrites.ts`) 로 감싼다: 바뀐 키마다 그 키를 지운 문서로 record 를 그 쓰기가 닿는 breakpoint (쓴 층과 그보다 좁은 층) 에서 다시 해석해 (`root.resolveRecordOver`) 값 · 토큰 출처 · fill 이 같으면 같은 step 에서 지운다. 새 값 쓰기 경로도 감싼다 (구조 명령은 제외 — pruned 해석이 지금 scene 의 경로를 읽는다). **Why (2026-11-11 사용자 보고 · 결정)**: 바꿨다가 원래 값으로 되돌려도 자기 값이 남아 instance Overrides 에 이력이 남았다. 원본에 적힌 값과만 비교하면 팔레트 컴포넌트 (값이 rule 에서 옴) 가 고쳐지지 않아 「보이던 값」 기준을 골랐다.
- 미리보기는 끌기가 끝난 뒤 다시 걸리지 않는다 — 섹션이 프레임에 미룬 미리보기는 host `previewEpoch` (확정 · `cancelPreview` 마다 증가) 가 바뀌었으면 버리고, host 는 `root.previewing(id)` 인 record 의 기록만 이어받는다. **Why (2026-10-19)**: 마지막 이동과 놓기가 한 프레임에 오면 확정 · 해제 뒤 미뤄 둔 미리보기가 다시 걸렸고, 확정 없이 끝난 끌기의 키가 다음 끌기에 섞였다 (code-review 후보 → 테스트 재현).

## 3. 읽기 계약

| Consumer                      | 위치                                                                                                                                                                           | 우선순위                                                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 상자 모델 (Canvas · DOM 공용) | shared `runtime/boxModel.ts` `catalogBoxModel` (Builder `catalogRuntime/boxModel.ts` 는 재수출)                                                                                | padding: `paddingTop` > `paddingY` > `padding` (4변 각각). gap: `visual.gap`                                                                     |
| 레이아웃 엔진 입력            | shared `runtime/compositionRoot.ts` `styleOf`                                                                                                                                  | `box.gap` 을 `rowGap`/`columnGap` 로 펼친 **뒤** `itemLayout` (`layout.rowGap` · `columnGap`) 이 덮는다 → **longhand 가 `visual.gap` 을 이긴다** |
| DOM 투영                      | `packages/shared/src/catalog/runtime/domBinding.runtime.ts`                                                                                                                    | 상자 모델의 gap 을 `rowGap` · `columnGap` longhand 로 낸다                                                                                       |
| 패널 표시                     | `styleFields.ts` `catalogStyleView` (작성값) → `catalogRuntime/effectiveStyle.ts` `catalogEffectiveStyle` (그려진 record 의 실효값) → `panels/styles/hooks/useLayoutValues.ts` | 작성값 → 실효값 → 패널 기본 (표 아래 「패널 표시」 세 항목)                                                                                      |

- 새 consumer 는 typed field 를 직접 읽지 말고 위 함수 (`catalogBoxModel` · `catalogStyleView`) 를 거친다 — 우선순위가 한 곳에서만 정해지도록.
- **패널 표시 — 실효값**: 실효값은 선택 record 를 `catalogBoxModel` + 같은 view 로 읽는다 (Canvas · DOM 과 같은 record). 기본값을 type · size 의 rule 로 다시 계산하지 않는다 — **Why (2026-10-09)**: 부모 part rule 이 배치하는 부품 (CheckboxButton) · 부모 size 전파를 받은 Label · 자식 Input 의 size padding 은 자기 rule 재계산에 없거나 거꾸로 있었다. record 에 없는 채널 (생성 CSS class 의 box-shadow) 만 Appearance · Text · Size 에서 자기 rule 을 뒤에 둔다.
- **패널 표시 — 그려진 값이 record 와 다르면 그려진 값** (`catalogRuntime/drawnBoxModel.ts` `catalogDrawnBoxDelta` — `root.getDrawnLayoutStyle`, Canvas 간격 손잡이 · 드래그도 같은 함수): Canvas 레이아웃이 record 밖에서 놓는 값 (part rule border · 묶음 gap · field 상자 · 배치 들여쓰기) 이 0 으로 보이던 것 (2026-11-13, 12 가족). flex 는 주축 gap 하나만 덮고 grid 의 행 · 열 gap 은 record longhand.
- **패널 표시 — Gap** (`useLayoutValues.ts`): 작성값은 한 줄 flex 면 `axisGap ?? gap` (주축 longhand 우선 — 교차축 longhand 는 주축 간격이 아니다), 그 밖은 `rowGap ?? columnGap ?? gap`. 작성값이 없으면 실효값 `axisGap ?? rowGap ?? columnGap ?? gap`.
- **패널의 rule 칠 표시는 Canvas · CSS 와 같은 조건 트리 (ADR-297)**: Fill · Border · 글자색 칸 (`useColorStyleValues.ts`) 은 실효값 (record — library 정의의 칠도 트리 평가, `codeCatalogLibrary.ts`) → `resolveStylePanelCatalogPaint` (`specPresetResolver.ts` — `resolveCatalogPaint`, `interactionState: "default"`) 순이다. 둘 다 같은 `paint` 트리라 prop 상태 (disabled · selected · emphasized) 는 반영, hover · pressed 상태 카드는 휴지 값. 칠 값을 패널 쪽 표로 따로 두지 않는다.
- **DOM 은 shorthand 를 longhand 로 낸다** (2026-10-04): `domBinding.runtime.ts` `AUTHORED_CSS` 가 `gap` → `rowGap` · `columnGap`, `padding` → 4변으로 펼치고, `AUTHORED_PRECEDENCE` 가 상자 모델과 같은 순서 (전체 → 축 → 변) 로 쓴다. 그전에는 authored `gap` 과 `layout.rowGap` 이 함께 인라인에 실렸고, `paddingTop` 이 키 순서상 `padding` 보다 먼저 오면 DOM 은 `padding` 이 이겨 Canvas (변 우선) 와 갈렸다 — 회귀 테스트 `catalogRuntime/__tests__/domGapLonghand.test.tsx`.

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

이 절이 정본이다 (구현 `components/property/PropertyUnitInput.components.tsx`).

- **선택 전환 보호**: focus 때 선택 id 를 ref (`focusedElementIdRef`) 로 잡고 blur 때 비교 — 다르면 onChange 를 건너뛴다. **Why**: mousedown → blur 순서라 blur 시점에 이미 새 요소가 선택돼 있다.
- **숫자 commit 판정은 `lastSavedValueRef` 기준 단독** — 숫자 blur · Enter · ▲▼ 와 목록의 preset 선택. `value` prop 과의 숫자 비교로 판정하지 않는다. **Why (ADR-909)**: 미리보기가 value prop 을 편집값으로 먼저 바꾸면 그 비교가 「변경 없음」 으로 판정해 저장이 빠졌다. ADR-909 가 고친 것은 이 숫자 경로다 — 친 글자가 preset · 키워드와 일치하는 blur · Enter 경로와 단위 메뉴에는 `value` prop 비교가 남아 있다.
- value prop 동기화 `useEffect` 는 같은 요소에 focus 중이면 건너뛴다. catalog 미리보기는 문서를 쓰지 않아 value prop 이 commit 값에 머물지만, 가드는 focus 중 외부 갱신으로부터 편집 세션을 지키는 방어로 유지한다.

- **↑/↓ 는 닫힌 칸에서 숫자 stepper 하나다** — `handleKeyDown` (capture) 이 `stopPropagation` 해 RAC ComboBox 로 보내지 않고, 목록이 열려 있을 때 (`menuOpenRef`) 만 RAC 의 항목 이동에 맡긴다. **Why (2026-11-02 /fix)**: `preventDefault` 만으로는 RAC `useComboBox` 의 ↑/↓ 가 닫힌 preset 목록을 열고 (`state.open('last')`) 가상 포커스를 옮겨, 이어진 Tab 이 그 항목을 commit 했다 (`if (state.isOpen) state.commit()`) — Gap 0 에서 ↑×3 Tab = M 토큰, ↑×30 Tab = Reset 으로 값 삭제 (Enter 는 정상). 회귀 테스트 `PropertyUnitInput.test.tsx` 「↑ on a preset field steps the number only」.
- **칸이 보이는 숫자는 한 곳에서 읽는다 (`shownNumber`)** — ▲▼ · label scrub 의 시작값 · 단위 변경의 숫자가 같은 함수를 지난다. 토큰 칸의 글자는 단계 이름 (「M」) 이라 `parseFloat(inputValue)` 는 NaN 이고 토큰의 `numericValue` 는 null 이다. **Why (2026-11-11 /fix)**: `1901c0507` 이 칸 글자를 단계 이름으로 바꾸며 ▲▼ 만 해석 px 를 읽게 고쳐, label scrub 은 0 에서 시작했다 — ⌥ 자유값 M(12)+4 → 4, 단계 끌기 M 한 칸 → L 이 아닌 0 기준 단계. 단위 변경 (Position inset 의 ▾ 메뉴 — 단계 뒤 px · %) 도 같은 결함이었다 — M → % 가 12% 가 아니라 기본값 100% (2026-11-11 /simplify). 회귀 테스트 `adr298TokenPreview.test.tsx` 「a step scrub on a token field walks from the token's step」 · 「a unit change on a token field keeps the token's number」 · token scrub 3 건.

## 6. 신규 Consumer · 키 추가 체크리스트

- [ ] 새 CSS 키는 `styleFields.ts` 의 키 집합 (`VISUAL_NUMBER` · `LAYOUT_TEXT` · `RADIUS` · `INSET` …) 에 넣어 typed field 를 정한다. 담을 수 없는 값은 `CatalogStyleValueError`.
- [ ] 레이아웃에 영향을 주는 키면 [layout-engine.md](layout-engine.md) 「새 레이아웃 키를 추가할 때」 체크리스트 (`styleOf` · `PAINT_ONLY_VISUAL_KEYS`) 를 같이 본다.
- [ ] gap · padding · margin 읽기는 `catalogBoxModel` / `catalogStyleView` 경유 (직접 `visual.gap` 단독 읽기 금지 — longhand 덮어쓰기를 놓친다).
- [ ] Styles 섹션 dirty 키 목록에 longhand 전체 포함.
- [ ] PropertyUnitInput 류 input 의 숫자 commit 조건은 `lastSavedValueRef` 기준 단독 (§5).

## 7. 금지 패턴

- ❌ `visual.gap` 단독 읽기 (`layout.rowGap` / `columnGap` 덮어쓰기 누락)
- ❌ typed field 가 담지 못하는 값을 `props.style` 등 다른 축으로 우회 저장
- ❌ dirty 키 배열에 shorthand 만 포함 (longhand 편집 미감지)
- ❌ 미리보기에서 `workspace.execute` 호출 (드래그 한 번에 히스토리 수십 개) — `previewRecord` 를 쓴다
- ❌ PropertyUnitInput 숫자 commit 판정을 `value` prop 기반 diff 로 처리

## 8. rendering primitive 내부 helper (production Canvas 판정 아님)

`packages/rendering/src/primitives` 의 CSS 값 helper 다. gap · padding 의 우선순위는 위 §3 의 함수가 정한다 — 여기를 고쳐도 그 판정은 바뀌지 않는다. 테스트 밖 소비처:

- `cssValueParser.ts::parseGapValue` (Layer A) — Breadcrumbs 접힘 개수 계산이 해석된 style 의 gap 을 읽는다 (`catalogBreadcrumbsVisibleCount` 호출 — Canvas shared `runtime/compositionRoot.ts` · DOM `delegatedDom.components.tsx`)
- `cssValueParser.ts::parsePadding4Way` (Layer A) — Chart scene (`packages/rendering/src/chart/computeChartScene.ts`)
- `cssValueParser.ts::parsePxValue` (Layer A) — shape 변환 (`renderers/buildCatalogShapes.ts` · `renderers/skiaPrimitives.ts`)
- `containerSpacing.ts::resolveContainerSpacing` (Layer B) — 테스트 외 호출처 없음

## 관련 ADR

- [ADR-063](../../docs/adr/completed/063-ssot-chain-charter.md) — 3-domain 분할 charter
- [ADR-907](../../docs/adr/completed/907-collection-container-style-pipeline.md) — Collection container style pipeline (Layer B/C/D)
- [ADR-909](../../docs/adr/completed/909-style-ssot-contract.md) — shorthand / longhand 계약 원칙
- [ADR-222](../../docs/adr/completed/222-canvas-padding-gap-direct-manipulation.md) — Canvas 간격 직접 조작 · Gap 필드 주축 longhand
- [ADR-248](../../docs/adr/completed/248-unified-catalog-document.md) — catalog 문서 · typed field 저장 모델
