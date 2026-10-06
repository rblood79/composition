---
description: Canvas/Skia 렌더링 관련 파일 작업 시 적용 (ADR-900 PixiJS 제거 완료)
paths:
  - "apps/builder/src/builder/workspace/canvas/**"
  - "packages/specs/**"
  - "**/nodeRenderers*"
---

# Canvas 렌더링 규칙

> **SSOT 체인 연계**: Skia 렌더는 [ssot-hierarchy.md](ssot-hierarchy.md) **D3(시각 스타일)의 direct consumer**. CSS/DOM consumer와 **대등(symmetric)** — 한쪽이 다른 쪽 기준 아님. 대칭 = "시각 결과의 동일성" (구현 방법 자유). catalog/spec 이 D1(DOM) 침범 금지.
>
> **2026-07-08**: D3 SSOT 는 [ADR-142](../../docs/adr/completed/142-starter-spec-component-system-cutover.md)(Implemented) 로 catalog(`COMPONENT_RULES_TABLE`) + theme/tokens 로 전환됨. 본 문서의 "Spec" 서술은 **잔존 spec 3개(Frame/Group/Slot) 한정** — 일반 컴포넌트는 catalog 경로 (ADR-036 은 Superseded by ADR-142).
>
> 구현 상세는 [canvas-details.md](../skills/composition-patterns/reference/canvas-details.md) 참조

## 0. 렌더링 버그 수정 원칙 (CLAUDE.md 에서 이관 2026-08-31)

2개 렌더링 타겟 (CSS/Skia) × 5개 레이어 (spec/factory/CSS renderer/Skia renderer/editor). 한 경로만 수정 금지 → `/cross-check` 로 검증. factory → spec → renderer → editor 하류 파손 확인. 동일 패턴 이슈는 grep 배치 스윕. 요청 범위만 수정.

## 1. Skia 단일 렌더러 핵심 (ADR-900)

- ADR-900 Unified Skia Engine — Skia 가 화면 + 이벤트 (EventBoundary) 통합 처리. PixiJS 완전 제거됨
- DirectContainer 패턴: 엔진 계산 결과(x/y/w/h)로 직접 배치. **Why**: @pixi/layout 및 PixiJS 모두 제거 (ADR-900)
- CanvasKit `heightMultiplier`에 `halfLeading: true` 필수. **Why**: CSS line-height 상하 균등 분배

## 2. Component Spec 규칙

- TokenRef 숫자 연산 시 `resolveToken()` 변환 필수. **Why**: 미변환 시 NaN 전파
- `_hasChildren` 체크: 배경 shapes 직후, standalone shapes 직전 배치. **Why**: 자식 유무에 따라 shapes 분기
- Child Spec 추가 → `packages/specs/src/index.ts` + `components/index.ts` export + `pnpm build:specs` + `TAG_SPEC_MAP` 등록 (신규 child spec 은 D1 예외 컴포넌트만 — 일반 컴포넌트는 catalog)
- Spec fontSize 우선순위: `props.size` 명시 시 `size.fontSize` 우선. **Why**: Propagation은 size prop만 변경, style.fontSize 미갱신
- Spec Container Dimension Injection: `_containerWidth`/`_containerHeight` props 주입 (`catalogRuntime/ruleShapes.ts`). `BOX_SIZE_TYPES` Set 등록 필수 (옛 `buildSpecNodeData.ts` `CONTAINER_DIMENSION_TAGS` — Phase 4e-9-8 삭제). **Why**: Spec shapes가 레이아웃 엔진 결과를 모르면 우측/중앙 배치 불가

## 2.5.5. Fill Spec Schema SSOT (ADR-908 Implemented 2026-04-24)

VariantSpec 의 배경 계열 10+ 필드 + IndicatorModeSpec 의 background\* 는 `FillTokenSpec` (fillStyle × state 2축) + `FillStateTokens` 로 **단일 소스 통합**. legacy `background / backgroundHover / backgroundPressed / backgroundAlpha / selectedBackground* / emphasizedSelectedBackground / outlineBackground / subtleBackground` 필드는 전수 삭제됨.

### Fill token 구조

타입 정의는 소스가 정본 — `packages/specs/src/types/spec.types.ts` 의 `FillStateTokens` (state 축: `base` 필수, 나머지 선택) / `FillTokenSpec` (fillStyle 축: `default` 필수, `outline`/`subtle` 은 `Partial`, `alpha` 0-1). 여기에 복사본을 두지 않는다 (drift 방지).

### Spec 작성 규약

- 모든 `variants[name]` 은 `fill: { default: { base, hover?, pressed?, ... } }` 선언 필수 — `fill` 은 VariantSpec 에서 required.
- IndicatorModeSpec 은 `fill: { base, pressed? }` (selection indicator 는 `pressed` 만 emit 됨, `base` 는 컨테이너 `background: transparent` 하드코딩 탓 dead).
- 비-background 색상 (`text / border / textHover / borderHover / selectedText / outlineText / subtleText / selectedBorder / emphasizedSelectedText / emphasizedSelectedBorder`) 는 VariantSpec 직접 필드 유지 — fill preset 언어로의 확장은 후속 ADR 판정.

### Consumer 규약

- spec 내부 `render.shapes()` 및 외부 5 consumer (`CSSGenerator / ReactRenderer / variantColors / stateEffect / validate-specs`) 는 항상 `resolveFillTokens(variant)` / `resolveIndicatorFill(im)` 경유로 fill 접근. **Why**: 단일 진입점 유지 + 향후 merge/override 확장 포인트 보존
- `variant.background` / `variant.backgroundHover` 등 직접 property access **금지** (타입상 존재 안 함, compile error).
- hover / pressed 는 optional 이므로 consumer 에서 fallback 필요: `fill.default.hover ?? fill.default.base` 패턴.

### 금지 패턴 (ADR-908 Phase 4)

- ❌ VariantSpec / IndicatorModeSpec 에 `background` / `backgroundHover` / `backgroundPressed` / `selectedBackground*` / `outlineBackground` / `subtleBackground` / `backgroundAlpha` 개별 필드 신규 도입
- ❌ `variantSpec.background*` / `variant.background*` / `im.background*` property access — 타입 삭제됨, 단일 진입점만 사용
- ❌ `variantSpecToFillTokens()` 호출 — Phase 4-c 에서 삭제됨, `resolveFillTokens()` 만 사용
- ❌ local const 의 property 이름에 legacy naming 유지 (DropZone/Card 예시는 historical, 신규 금지)

## 2.6. Container style pipeline (ADR-907 Implemented)

collection/self-render 컨테이너 (`Breadcrumbs, ComboBox, GridList, ListBox, Menu, Select, Tabs, TagGroup, Table, Toolbar, Tree` 11 주대상) 의 `element.props.style` 은 **3경로** (Preview DOM / Skia `render.shapes()` / Layout `calculateContentHeight()`) 에 **동일 resolver** 로 반영되어야 한다. 4 layer 아키텍처:

- **Layer A — CSS value parser SSOT**: `packages/specs/src/primitives/cssValueParser.ts` 의 `parsePxValue / parsePadding4Way / parseGapValue / parseBorderWidth` 만 사용. **금지**: `parseFloat(String(x))` ad-hoc 파싱. **Why**: edge case (undefined/null/"" /"20px"/숫자/percentage) 일관 처리 + generic fallback (`parsePxValue<F>(value, fallback: F): number | F` — TokenRef passthrough 허용)
- **Layer B — Container spacing primitive**: `packages/specs/src/primitives/containerSpacing.ts` 의 `resolveContainerSpacing({ style, defaults })` 가 padding(4way)/gap(row+column)/borderWidth/fontSize 를 통합 resolve. 각 caller 는 `defaults` 에 spec 기본값 전달. **Why**: 7 공통 필드의 컴포넌트별 중복 파싱 제거
- **Layer C — DOM root style 계약**: 옛 Preview renderer (`packages/shared/src/renderers/`, 2026-10-07 삭제) 의 `rendererStyleContract.test.ts` 가 하던 검증은 catalog DOM binding (`packages/shared/src/catalog/runtime/domBinding.tsx` `catalogDomStyle` — 노드의 해석 값이 요소 inline style 로) 이 대신한다. 새 binding 은 `style` 을 요소에 전달해야 한다
- **Layer D — Spec metric SSOT**: `render.shapes()` 와 `calculateContentHeight()` 가 **동일 resolver 심볼** 호출. 예: `resolveGridListSpacingMetric()` (GridList), `resolveContainerSpacing()` 직접 호출 (Menu/Toolbar). **Hard Constraint**: root container spacing 과 item 내부 spacing 은 같은 속성명으로 섞지 않음 (예: Table `size.paddingX` 는 cell-level, 유지)

### 신규 collection 컴포넌트 추가 시 체크리스트

1. `render{Component}` 가 `<RootComponent>` root 에 `style={element.props.style}` 전달 (Layer C)
2. `{Component}.spec.ts` 의 `render.shapes()` 가 `resolveContainerSpacing({ style: props.style, defaults: { ...size } })` 경유 (Layer B + D)
3. 컴포넌트-specific 확장 (numCols / cardPadding 등) 필요 시 `resolve{Component}SpacingMetric()` wrapper 작성 (GridList 패턴)
4. `utils.ts` 의 `calculateContentHeight()` 분기 존재 시 동일 resolver 호출 (Layer D grep 검증)
5. `packages/specs/src/__tests__/{Component}.spacing.test.ts` 로 Layer D contract 확증
6. `rendererStyleContract.test.ts` 의 `RENDERERS` 배열에 추가

### 금지 패턴 (ADR-907)

- ❌ renderer root 에 `style={element.props.style}` 누락 (allowlist 가 빈 Set 이므로 자동 test FAIL)
- ❌ `render.shapes()` 에서 `size.paddingX` / `size.gap` 직접 하드코딩 (style.padding/gap 미소비 → Preview/Layout drift)
- ❌ `parseFloat(String(style.x))` ad-hoc 파싱 (`parsePxValue` 사용 필수)
- ❌ `calculateContentHeight()` GridList 분기에서 `paddingY * 2` (4-way padding 지원: `paddingTop + paddingBottom`)
- ❌ Layer D resolver wrapper 를 `apps/builder/**` 에 배치 (package boundary: specs ← shared ← builder)

## 2.5. `_hasChildren` 컨벤션 (ADR-072)

컨테이너 rule 은 `catalogRuntime/rulePaint.ts` 의 **3-branch 로직**에 따라 `_hasChildren` 주입을 받는다 (옛 `buildSpecNodeData.ts` 의 같은 로직이 이름만 바뀌어 옮겨졌다 — `TreeItem` 은 Plain 에서도 제외). 신규 컨테이너 추가 시 아래 판정 절차를 따른다.

### 3분류 정의

| 분류                | Set                      | `_hasChildren=true` 주입 | 예시                                                                                                                                                                                    |
| ------------------- | ------------------------ | :----------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Shell-only**      | `SHELL_ONLY_TYPES`       |  **자식 수 무관 항상**   | Calendar/RangeCalendar, Card, Dialog, Section, DisclosureGroup, Button/Checkbox/Radio/ToggleButtonGroup, Disclosure, Form, Popover, Tooltip, ColorPicker/ColorSwatchPicker, body (17개) |
| **Synthetic-merge** | `CHILD_PROP_MERGE_TYPES` |         **차단**         | Breadcrumbs, ComboBox, GridList, Select, Table, Tabs, TagGroup, Toolbar, Tree (9개)                                                                                                     |
| **Plain**           | (양쪽 다 미포함)         |      자식 있을 때만      | TabPanel, TabPanels (shapes=[]), Frame (ADR-130 — canonical layout container) 및 대부분의 일반 컨테이너                                                                                 |

### 판정 알고리즘 (신규 컨테이너 추가 시)

1. `spec.render.shapes`가 자식 props를 참조하여 shapes 구성 → **Synthetic-merge**
2. factory definition이 자식 Element를 자동 생성하고 spec standalone 분기가 `type:"container"` 빈 placeholder → **Shell-only**
3. standalone 분기에 text/gradient/arrow 등 실렌더 shape 존재 → factory가 해당 시각 요소를 자식 Element로 대체 커버하는지 확인 후 **Shell-only** (대체 불가 시 Plain 유지)
4. `spec.render.shapes`가 `() => []`로 shapes 자체가 빈 배열 → **Plain** (두 Set 모두 미포함)

### 금지 패턴

- ❌ Shell-only 이동 대상 태그가 factory 자식 자동 생성을 하지 않음 → 기본 상태 UI 소실
- ❌ Synthetic-merge에 shell-only 태그 혼입 → `_hasChildren` 주입 차단으로 standalone 분기가 실행되며, 자식 Element가 동시에 독립 Skia 노드로 렌더 → **UI 중복** (Calendar 2026-04-17 버그 유형)
- ❌ `_hasChildren` 주입 조건을 `childElements.length > 0`으로만 판단 → Shell-only 태그에서 자식 0개일 때 standalone 복귀 (ADR-072에서 3-branch로 해소)
- ❌ standalone 분기 ≥ 50줄 태그를 "빈 placeholder" 가정으로 이동 → 내용 정독 + factory definition 교차 확인 필수

## 3. 텍스트 측정 동기화

측정은 두 곳이다 (2026-10-04 개정). **레이아웃 측정** (엔진에 주는 텍스트 크기) 은 `catalogRuntime/textMeasure.ts` `catalogTextMeasure` — CanvasKit 이 준비되면 페인트와 같은 paragraph 로 재고 (기본 font feature 가 advance 를 바꾸므로), 준비 전에만 Canvas 2D (`utils/textMeasure.ts`) 로 잰다. **페인트 줄바꿈 hint** 는 `nodeRendererText.ts` 가 Canvas 2D 로 정한 줄바꿈을 `\n` 으로 넣어 CanvasKit 렌더에 강제한다 (ADR-051) — `needsFallback` 분기 (letterSpacing · wordSpacing · white-space≠normal · break-all) 는 hint 없이 CanvasKit paragraph 그대로. 두 기준이 다르므로 줄 수 발산은 둘을 나란히 대조한다. ParagraphStyle 변경 시 **동시 업데이트**: nodeRendererText.ts · specShapeConverter.ts · TextMeasureStyle 인터페이스. (`CanvasKitTextMeasurer` 클래스는 2026-04-07 배선이 끊긴 채 남아 있다가 2026-09-20 삭제)

- fontFamilies: 측정기와 렌더러가 **동일한 배열** 사용. CSS 체인 전체를 `split(",")` → `resolveFamily()` 매핑. **Why**: font 설정 불일치 → 텍스트 줄바꿈 위치 어긋남
- strutStyle: `heightMultiplier > 0` 시 `forceStrutHeight: true` — 측정기/렌더러 양쪽 동일 적용
- 측정 font: 텍스트 leaf 의 text · font 는 `textLeaf` (`compositionRoot.ts`) 가 catalog resolved record (`node.visual` · `catalogTextTypography`) 에서 읽는다 — 렌더와 같은 값. 옛 `extractSpecTextStyle` 은 2026-10-05 삭제
- Paragraph API: 콘텐츠 폭=`getLongestLine()`, max-content=`getMaxIntrinsicWidth()`. `getMaxWidth()` 사용 금지
- WASM Paragraph 객체 캐싱 금지는 **측정 경로 한정** (Canvas 2D 세그먼트 캐시는 결과값 폭만 보관). 렌더 측 paragraph 는 **텍스트 노드 소유 retained + deferred 폐기** (ADR-174 — 전역 content-키 LRU/상한 재도입 금지: 상한→퇴거→프레임 중 폐기가 텍스트 소실의 병인. paragraph 생성은 `MakeFromFontCollection` + 공유 FontCollection 경유만 — per-call `ParagraphBuilder.Make` 는 paragraph 마다 ~5.78MB variable font 인스턴스를 복제 보유시킨다, 정적 가드 `nodeRendererText.static.test.ts`)
- **Layout 보정 금지**: 측정 경로 (`catalogTextMeasure` · `utils.ts` 측정 함수) 에 `+2/+4px` 경험 보정 사용 금지. **Why**: 측정은 CanvasKit paragraph (준비 전 Canvas 2D) 의 값 그대로 엔진에 넘긴다. 남는 sub-pixel 차이는 **렌더링 단**(nodeRendererText.ts)에서 post-layout `getMaxIntrinsicWidth()` 교정으로 처리.
- **min/max-content 스칼라 경로 (ADR-165)**: 텍스트 leaf 폭 intrinsic 은 `styleOf` (`compositionRoot.ts`) 가 `catalogTextMeasure` (`catalogRuntime/textMeasure.ts`) 로 `contentMinWidth`(최장 단어)/`contentMaxWidth`(단일줄) 스칼라 2종을 측정해 엔진 NodeStyle 로 공급 — 엔진이 fit/min/max-content 공식과 §4.5 floor 를 소유. min-content 측정은 max-content 와 **동일 font 체인** (inline style 우선 fontFamily/fontWeight/fontSize) 필수 — 불일치 시 floor 가 다른 폰트 기준으로 어긋남. CanvasKit 준비 뒤에는 렌더와 같은 paragraph 로 재고, 준비 전에는 Canvas 2D (`utils.ts` `calculateMinContentWidth` · `calculateMaxContentWidth`) 로 잰다.
- **CanvasKit 오발 줄바꿈 교정**: nodeRendererText.ts에서 `paragraph.layout()` 후 `\n` 없는 단일줄 텍스트가 줄바꿈되면 `getMaxIntrinsicWidth() + 1`로 재layout. **Why**: Canvas 2D↔CanvasKit 엔진 차이로 같은 텍스트가 다른 폭으로 측정됨. CanvasKit 자체 측정 기반 교정이므로 경험적 tolerance 불필요.

## 4. Spec-CSS 경계

- 일반 컴포넌트의 CSS 는 catalog binding 이 만든다. Spec → CSS 생성 (`CSSGenerator`) 은 잔존 spec 3개(Frame/Group/Slot) 한정이며 `skipCSSGeneration` 은 각 spec 이 선언한다
- Generated CSS는 `@layer components { ... }` 래핑 필수. **Why**: unlayered 시 수동 CSS override 실패
- Label은 catalog `COMPONENT_RULES_TABLE.Label` 경로로 렌더링 (TEXT_TAGS 아님). **Why**: 중복 등록 시 이중 렌더링
- Label 기본 크기: fit-content (CSS + Factory + 레이아웃 엔진 3경로 동기화 필수)
- Label size delegation: catalog `COMPONENT_RULES_TABLE.Label` 의 size 블록 + `CATALOG_SIZE_PROPAGATION` (부모 size → Label). 옛 레이아웃 경로의 `LABEL_SIZE_STYLE` DFS 주입은 2026-10-05 삭제 (`packages/specs` `typography.ts` 의 같은 이름 상수는 specs 내부 계산용)

## 5. 토큰/테마 정합성

- Field 컴포넌트 입력 영역 배경: CSS `--bg-inset` / Spec `{color.layer-2}` 통일. **Why**: 시각적 일관성
- Select/ComboBox/SearchField gap: 모든 경로에서 고정 4px
- Dark Mode Token: adaptive 배경(`{color.neutral}`) → 텍스트에 `{color.base}` (not `{color.white}`). **Why**: dark mode에서 반전
- Skia color-mix: `mixWithBlackSrgb()` 사용 (oklch 근사 금지). **Why**: srgb 혼합과 수학적으로 다른 결과
- Necessity Indicator: CSS `renderNecessityIndicator` 와 catalog Canvas (`styleOf` 측정 `labelSuffix` · Skia 렌더) 가 같은 표시를 그린다

## 6. 레이아웃 통합

- Size Delegation: 부모 size → 자식 투영은 `CATALOG_SIZE_PROPAGATION` (`packages/shared/src/catalog/document/sizePropagation.ts`, catalog resolver 가 읽는다) 하나가 정본 — 옛 `propagationRegistry` 는 2026-10-05 삭제. catalog Canvas 대응: `rulePaint.ts` `SHELL_ONLY_TYPES` · `CHILD_PROP_MERGE_TYPES`, `ruleShapes.ts` `BOX_SIZE_TYPES`
- Calendar 계열 (CalendarGrid/CalendarHeader): catalog 경로 렌더 — CalendarHeader 는 `BOX_SIZE_TYPES`, Calendar/RangeCalendar 는 Shell-only. 상세: canvas-details.md
- Popover 자식(Calendar/RangeCalendar): 레이아웃 엔진 계산에서 제외. **Why**: Preview Popover 표시
- Collection Item Font: catalog rule (GridListItem/ListBoxItem) 하나가 레이아웃 측정과 Skia 렌더에 같이 쓰인다 (옛 `injectCollectionItemFontStyles` 는 2026-10-05 삭제)
- Arc Shape: `type: "box"` + `arc` 데이터로 변환. 트랙도 arc(360°)로 렌더링. **Why**: renderSolidBorder inset 차이
- Pointer → Move: 이동 대상은 `CatalogSession` 의 selection (`canvasGesture.ts` `beginMove`) — 판정은 현재 맥락 깊이로 정규화된 `picking.target` (`CatalogCanvas.tsx`). 히트한 원시 id 를 직접 넘기지 않는다. **Why**: 내부 자식 의도치 않은 이동

## 6.5 Drag-and-Drop 원칙

- 시각적 offset 변경 금지 → **문서 명령** (`moveNodes` → `host.execute` → `workspace.execute`, `canvasGesture.ts`) 필수. **Why**: visual hack은 drop 시 원위치 + Skia 미동기화
- 좌표 변환: DOM clientX/Y → canvas 좌표 시 viewport offset + zoom 반영 필수. **Why**: pan/zoom 적용된 canvas와 DOM은 1:1 아님
- 이벤트 리스너: `useRef`로 핸들러 참조 유지. **Why**: 드래그 중 리렌더 → addEventListener 소실
- 드래그 상태 변수에 `eslint-disable` 주석. **Why**: 이벤트 핸들러 내에서만 참조되어 linter가 미사용으로 오판

## 7. 금지 패턴 종합

- ❌ TEXT_TAGS에 "Label" 재추가 (이중 렌더링)
- ❌ Label factory에 `width/height: "fit-content"` 누락 (레이아웃 엔진 auto 와 다름)
- ❌ Label generated CSS 부활 (부모 CSS 변수 상속 깨짐)
- ❌ CSS `var(--text-md)` 사용 (미정의 → `var(--text-base)` 사용)
- ❌ Label lineHeight를 숫자로 전달 (parseLineHeight가 배율로 해석 → `"20px"` 문자열 필수)
- ❌ Label height에 `Math.ceil(fontSize * 1.5)` 같은 추정값 사용 (catalog `Label` size 블록 역참조 필수)
- ❌ PARENT_VARIANT_TO_LABEL_TOKEN 방식 부활 (catalog `COMPONENT_RULES_TABLE.Label` variants 사용)
- ❌ fontFamily 문자열을 단일 배열 요소로 전달 (`split(",")` 필수)
- ❌ `getMaxWidth()`로 콘텐츠 폭 계산 (`getLongestLine()` 사용)
- ❌ `type: "arc"` 별도 사용 (HMR 이슈 → box + arc 데이터)
- ❌ 트랙에 circle + stroke (inset 차이 → arc 360° 사용)
- ❌ `size.height/2`로 세로 중앙 (`containerHeight/2` 사용)
- ❌ publishLayoutMap 타이밍 해킹, notifyLayoutChange() 강제 호출
- ❌ parentElement를 useMemo 내 직접 참조 (stale closure)
- ❌ 히트한 원시 id 를 이동 대상으로 직접 전달 (session selection · 정규화된 `picking.target` 사용)
- ❌ `calculateContentWidth`에 측정기 종류별 `+N` 보정 추가 (CSS 정합 파괴 → nodeRendererText `+1` 마진 사용)
- ❌ 텍스트 leaf 에 width/minWidth 주입 재도입 (ADR-165 스칼라 계약과 이중 적용 — `contentMinWidth`/`contentMaxWidth` 공급이 정본. 비텍스트 leaf 의 width 주입 시 minWidth 동시 주입은 잔존 계약 유지)
- ❌ overflow 기준 flexShrink 주입 보정 (구 Step 5.7) TS 재도입 (automatic minimum size 는 엔진 소속 — `flex.rs` §4.5, ADR-164. layout-engine.md §"TS 잔존 계약" 참조)

## 8. Overflow Scroll 가이드라인 동기화

> **2026-08-14**: 구 Tree 경로 (`buildTreeBoundsMap` — PixiJS 씬 그래프 DFS fallback) 는 ADR-900 완결 후 도달 불가로 남았다가 제거됨. 렌더/bounds 산출은 Command Stream 단일 경로. `scrollState.scrollVersion` 카운터는 마지막 판독자(tree 경로 bounds 캐시)가 사라져 기록-전용으로 남았다가 제거됨 — 스크롤 무효화는 registryVersion 경유.

- `renderCommands.ts` (Command Stream 경로): `visitElement`에서 자식 boundsMap 좌표에 부모 `scrollOffset` 차감 필수. **Why**: boundsMap은 절대 좌표 → 렌더링의 `canvas.translate`와 동기화 필요
- `executeRenderCommands` AABB 컬링 (`translateStack`): `CMD_CHILDREN_BEGIN` 의 scroll translate 를 컬링 절대좌표 스택에도 반영 필수 (`scrollDeltaStack` push → `CMD_CHILDREN_END` 복원). **Why**: 미반영 시 스크롤로 뷰포트에 들어온 자식이 스크롤 전 좌표로 판정되어 오컬링 — hover outline (boundsMap 경로) 만 보이고 본체 미렌더 (2026-07-16 수정)

## 8.5–8.8 인터랙션 규칙 → [canvas-interaction.md](canvas-interaction.md)

히트 바운드(§8.5) · hover 그룹 하이라이트(§8.6) · 선택 박스 좌표계(§8.7) · 드래그 의도 판정(§8.8) 은 2026-08-31 분리 — `canvas/{interaction,selection}/**` · overlay/paint-order/pointer/drag 파일 작업 시 자동 로드.

## 9. 렌더 identity ↔ 편집 대상 분리 (ADR-248 catalog runtime — 2026-10-04 개정)

> 옛 Page Frame projection 경로 (ADR-135/136 — `::page-frame::` projected ID · `renderNodesMap` / `sceneNodesMap` · `resolveCanonicalMoveTarget` · `sceneVersion` signature · `canonicalDocumentToElements`) 는 ADR-248 Phase 4 에서 store 와 함께 삭제됐다. 원칙 (렌더 공간 id 를 문서에 쓰지 않는다) 은 아래 형태로 남는다.

- **identity 는 렌더 키, 문서 키가 아니다**: 해석된 노드의 `identity` = `instancePath` + `sourceId` (`packages/shared/src/catalog/resolution/positions.ts` `CatalogPosition`). composition root 레코드 · Canvas 명령 · overlay 가 이 키를 쓴다. 문서 · IndexedDB · 히스토리에는 저장하지 않는다.
- **편집은 `EditTarget` 으로**: 같은 position 의 `target` (소유 노드 또는 instance address 가 붙은 template position) 이 명령의 대상이다. identity 문자열을 쪼개 문서 id 로 쓰지 않는다. 이동 · 삽입은 `moveNodes` 등 catalog 명령 하나로 간다.
- **Canvas 무효화**: 전역 `sceneVersion` 카운터는 없다. `canvasBinding.ts` 가 `root.subscribeCanvas` dirty → rect diff 로 바뀐 subtree 만 다시 만든다 ([layout-engine.md](layout-engine.md) 「레이아웃 재계산 경로」 6단계).

## 9.5 페이지 레이아웃 적용 — 해석은 한 곳, consumer 는 둘 (2026-10-04 개정)

- 페이지는 레이아웃을 **body 를 레이아웃 정의 (`DefinitionEntry.usage: "layout"`) 의 instance 로 만들고 template slot 을 `fillSlot` override 로 채워** 적용한다 (`packages/shared/src/catalog/document/types.ts`, 생성 명령 `createLayout`).
- 펼침은 shared resolver (`catalog/resolution/resolver.ts` `resolveCatalogNode` · `positions.ts`) 한 곳이 한다. Canvas (`compositionRoot.ts`) 와 DOM (`domBinding.tsx`, Preview 는 `preview/catalog/catalogPreviewSession.ts`) 는 같은 해석 결과 (`CatalogConsumerNode`) 를 소비한다 — 옛 경로처럼 축마다 합성 층 (`resolvePageWithFrame` · `projectPageFrameNode` · `pageFrameProjection.ts`) 을 두지 않는다.
- `workspace.root.pageFrameRects()` 의 "page frame" 은 Canvas 위 페이지 사각형이며 레이아웃 투영과 무관하다.

### 금지 패턴

- ❌ identity (`instancePath` + `sourceId`) 를 문서 · 히스토리 payload 에 저장하거나 명령 대상 id 로 직접 사용
- ❌ 레이아웃 · slot 펼침을 Canvas 또는 DOM 한쪽에 따로 구현 (D3 symmetric consumer — 해석은 resolver 하나)
- ❌ 레이아웃 적용 변경을 한 consumer 에서만 확인하고 종결 — Canvas · Preview 양쪽 확인 (`/cross-check`)

## 10. 게이트/플래그 단일 registry (2026-08-15)

- Canvas 게이트/플래그의 유일 정의처는 `wasm-bindings/featureFlags.ts`. 파일 밖 boolean 게이트 상수 신설 금지 — `featureFlags.test.ts` 의 registry 계약이 기계 집행 (registry 밖 게이트 상수 0건 + 게이트별 코드 소비처 ≥1)
- 소비자 0건이 된 게이트는 **삭제**한다 — 전환 계획·완료 사실은 ADR/CHANGELOG 가 기록. 의도적 보존은 `INTENT_PRESERVED` allowlist 에 사유와 함께 등재
- **Why**: ADR-900 잔재 게이트 9개가 소비자 0건인 채 "토글할 수 있는 것" 으로 잘못 읽히며 수개월 잔존했고, 발견 수단이 수동 전수 스윕뿐이었다 (memory: `project-pixijs-removal-residue-gates-always-false`). 가드는 발견 시점을 커밋 시점으로 앞당긴다

## 상세 레퍼런스

- [Canvas 렌더링 구현 상세](../skills/composition-patterns/reference/canvas-details.md)
- [SPEC_CSS_BOUNDARY.md](../../docs/reference/components/SPEC_CSS_BOUNDARY.md)
