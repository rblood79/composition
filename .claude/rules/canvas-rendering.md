---
description: Canvas/Skia 렌더링 관련 파일 작업 시 적용 (ADR-100 PixiJS 제거 완료)
globs:
  - "apps/builder/src/builder/canvas/**"
  - "packages/specs/**"
  - "**/nodeRenderers*"
  - "**/ElementSprite*"
  - "**/useCentralCanvasPointerHandlers*"
  - "**/useDragInteraction*"
---

# Canvas 렌더링 규칙

> **SSOT 체인 연계 (CRITICAL)**: Skia 렌더는 [ssot-hierarchy.md](ssot-hierarchy.md) **D3(시각 스타일)의 direct consumer**. CSS/DOM consumer와 **대등(symmetric)** — 한쪽이 다른 쪽 기준 아님. 대칭 = "시각 결과의 동일성" (구현 방법 자유). Spec이 D1(DOM) 침범 금지.
>
> 구현 상세는 [canvas-details.md](../skills/composition-patterns/reference/canvas-details.md) 참조

## 1. Skia 단일 렌더러 핵심 (ADR-100)

- ADR-100 Unified Skia Engine — Skia 가 화면 + 이벤트 (EventBoundary) 통합 처리. PixiJS 완전 제거됨
- DirectContainer 패턴: 엔진 계산 결과(x/y/w/h)로 직접 배치. **Why**: @pixi/layout 및 PixiJS 모두 제거 (ADR-100)
- CanvasKit `heightMultiplier`에 `halfLeading: true` 필수. **Why**: CSS line-height 상하 균등 분배

## 2. Component Spec 규칙

- TokenRef 숫자 연산 시 `resolveToken()` 변환 필수. **Why**: 미변환 시 NaN 전파
- `_hasChildren` 체크: 배경 shapes 직후, standalone shapes 직전 배치. **Why**: 자식 유무에 따라 shapes 분기
- Child Spec 추가 → `packages/specs/src/index.ts` + `components/index.ts` export + `pnpm build:specs` + `TAG_SPEC_MAP` 등록
- Spec fontSize 우선순위: `props.size` 명시 시 `size.fontSize` 우선. **Why**: Propagation은 size prop만 변경, style.fontSize 미갱신
- Spec Container Dimension Injection: `_containerWidth`/`_containerHeight` props 주입 (ElementSprite → specProps). `CONTAINER_DIMENSION_TAGS` Set 등록 필수. **Why**: Spec shapes가 Taffy 결과를 모르면 우측/중앙 배치 불가

## 2.5.5. Fill Spec Schema SSOT (ADR-908 Implemented 2026-04-24)

VariantSpec 의 배경 계열 10+ 필드 + IndicatorModeSpec 의 background\* 는 `FillTokenSpec` (fillStyle × state 2축) + `FillStateTokens` 로 **단일 소스 통합**. legacy `background / backgroundHover / backgroundPressed / backgroundAlpha / selectedBackground* / emphasizedSelectedBackground / outlineBackground / subtleBackground` 필드는 전수 삭제됨.

### Fill token 구조

```ts
interface FillStateTokens {
  base: TokenRef; // required — 해당 fillStyle 의 default state
  hover?: TokenRef;
  pressed?: TokenRef;
  selected?: TokenRef;
  selectedHover?: TokenRef;
  selectedPressed?: TokenRef;
  emphasizedSelected?: TokenRef; // data-emphasized + data-selected
}

interface FillTokenSpec {
  default: FillStateTokens; // required
  outline?: Partial<FillStateTokens>; // [data-fill-style="outline"]
  subtle?: Partial<FillStateTokens>; // [data-fill-style="subtle"]
  alpha?: number; // 0-1
}
```

### Spec 작성 규약

- 모든 `variants[name]` 은 `fill: { default: { base, hover?, pressed?, ... } }` 선언 필수 — `fill` 은 VariantSpec 에서 required.
- IndicatorModeSpec 은 `fill: { base, pressed? }` (selection indicator 는 `pressed` 만 emit 됨, `base` 는 컨테이너 `background: transparent` 하드코딩 탓 dead).
- 비-background 색상 (`text / border / textHover / borderHover / selectedText / outlineText / subtleText / selectedBorder / emphasizedSelectedText / emphasizedSelectedBorder`) 는 VariantSpec 직접 필드 유지.

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
- **Layer C — Renderer root style 계약**: `packages/shared/src/renderers/__tests__/rendererStyleContract.test.ts` 가 11 renderer 의 root JSX props 에 `style={element.props.style as React.CSSProperties | undefined}` 전달을 runtime 검증. **allowlist 는 빈 Set** (2026-04-24 Phase 5 도달). 신규 collection renderer 추가 시 `RENDERERS` 배열 추가만으로 동일 Gate 자동 적용
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

컨테이너 spec은 `buildSpecNodeData.ts`의 **3-branch 로직**에 따라 `_hasChildren` 주입을 받는다. 신규 컨테이너 추가 시 아래 판정 절차를 따른다.

### 3분류 정의

| 분류                | Set                               | `_hasChildren=true` 주입 | 예시                                                                                                                                       |
| ------------------- | --------------------------------- | :----------------------: | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Shell-only**      | `SHELL_ONLY_CONTAINER_TAGS`       |  **자식 수 무관 항상**   | Calendar, Card, Dialog, Section, DisclosureGroup, Button/Checkbox/Radio/ToggleButtonGroup, Disclosure, Form, Popover, Tooltip, ColorPicker |
| **Synthetic-merge** | `SYNTHETIC_CHILD_PROP_MERGE_TAGS` |         **차단**         | Breadcrumbs, ComboBox, GridList, ListBox, Select, Table, Tabs, TagGroup, Toolbar, Tree                                                     |
| **Plain**           | (양쪽 다 미포함)                  |      자식 있을 때만      | TabPanel, TabPanels (shapes=[]) 및 대부분의 일반 컨테이너                                                                                  |

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

ParagraphStyle 변경 시 **3곳 동시 업데이트** 필수: canvaskitTextMeasurer.ts, nodeRenderers.ts, TextMeasureStyle 인터페이스

- fontFamilies: 측정기와 렌더러가 **동일한 배열** 사용. CSS 체인 전체를 `split(",")` → `resolveFamily()` 매핑. **Why**: font 설정 불일치 → 텍스트 줄바꿈 위치 어긋남
- strutStyle: `heightMultiplier > 0` 시 `forceStrutHeight: true` — 측정기/렌더러 양쪽 동일 적용
- Spec-Driven Text Style: `extractSpecTextStyle(tag, props)` 사용. **텍스트 props(children/text/label) 없이 호출 금지** → null 반환 → fallback 측정 불일치
- Paragraph API: 콘텐츠 폭=`getLongestLine()`, max-content=`getMaxIntrinsicWidth()`. `getMaxWidth()` 사용 금지
- WASM Paragraph 객체 캐싱 금지 (메모리 누수). 결과값 `{width, height}` 만 LRU 캐싱
- **Layout 보정 금지**: `calculateContentWidth`, `enrichWithIntrinsicSize` 등 layout 경로에서 `+2/+4px` Canvas 2D→CanvasKit 보정 사용 금지. **Why**: Layout = Canvas 2D = CSS 정합이 원칙. Canvas 2D↔CanvasKit sub-pixel 차이는 **렌더링 단**(nodeRendererText.ts)에서 post-layout `getMaxIntrinsicWidth()` 교정으로 처리. layout에 보정 적용 시 CSS와 불일치.
- **CanvasKit 오발 줄바꿈 교정**: nodeRendererText.ts에서 `paragraph.layout()` 후 `\n` 없는 단일줄 텍스트가 줄바꿈되면 `getMaxIntrinsicWidth() + 1`로 재layout. **Why**: Canvas 2D↔CanvasKit 엔진 차이로 같은 텍스트가 다른 폭으로 측정됨. CanvasKit 자체 측정 기반 교정이므로 경험적 tolerance 불필요.

## 4. Spec-CSS 경계

- Leaf 컴포넌트: Spec이 CSS 자동 생성 (Preview ↔ Canvas 정합성)
- Container/Composite: `skipCSSGeneration: true` — 수동 CSS가 구조 담당, Spec shapes는 Skia 전용
- Generated CSS는 `@layer components { ... }` 래핑 필수. **Why**: unlayered 시 수동 CSS override 실패
- Label은 spec shapes 경로로 렌더링 (TEXT_TAGS 아님). **Why**: 중복 등록 시 이중 렌더링
- Label 기본 크기: fit-content (CSS + Factory + Taffy 3경로 동기화 필수)
- Label size delegation: LabelSpec 단일 소스. DFS 주입 조건은 `lineHeight == null` 기준. **Why**: fontSize 조건 사용 시 factory 기본값과 충돌

## 5. 토큰/테마 정합성

- Field 컴포넌트 입력 영역 배경: CSS `--bg-inset` / Spec `{color.layer-2}` 통일. **Why**: 시각적 일관성
- Select/ComboBox/SearchField gap: 모든 경로에서 고정 4px
- Dark Mode Token: adaptive 배경(`{color.neutral}`) → 텍스트에 `{color.base}` (not `{color.white}`). **Why**: dark mode에서 반전
- Skia color-mix: `mixWithBlackSrgb()` 사용 (oklch 근사 금지). **Why**: srgb 혼합과 수학적으로 다른 결과
- Necessity Indicator: 3경로 동기화 (CSS renderNecessityIndicator / Taffy Label DFS / Skia specProps)

## 6. 레이아웃 통합

- Size Delegation: 부모 size → 자식 직접 참조 (parentDelegatedSize). useMemo deps 포함 필수. **Why**: Store가 자식 size 미저장
- CalendarGrid/CalendarHeader: 다중 줄 보정 스킵 + skipCSSGeneration 필수. **Why**: 절대 좌표 텍스트에 보정 간섭
- Popover 자식(Calendar/RangeCalendar): Taffy 레이아웃에서 제외. **Why**: Preview Popover 표시
- Collection Item Font: ElementSprite selector로 부모 기반 font 주입 (implicitStyles만으로는 TextSprite 미반영)
- Arc Shape: `type: "box"` + `arc` 데이터로 변환. 트랙도 arc(360°)로 렌더링. **Why**: renderSolidBorder inset 차이
- Pointer → Move: store의 `selectedElementIds`에서 읽기. `hitElementId` 직접 전달 금지. **Why**: 내부 자식 의도치 않은 이동

## 6.5 Drag-and-Drop 원칙

- 시각적 offset 변경 금지 → **데이터 모델(store) mutation** 필수. **Why**: visual hack은 drop 시 원위치 + Skia 미동기화
- 좌표 변환: DOM clientX/Y → canvas 좌표 시 viewport offset + zoom 반영 필수. **Why**: pan/zoom 적용된 canvas와 DOM은 1:1 아님
- 이벤트 리스너: `useRef`로 핸들러 참조 유지. **Why**: 드래그 중 리렌더 → addEventListener 소실
- 드래그 상태 변수에 `eslint-disable` 주석. **Why**: 이벤트 핸들러 내에서만 참조되어 linter가 미사용으로 오판

## 7. 금지 패턴 종합

- ❌ TEXT_TAGS에 "Label" 재추가 (이중 렌더링)
- ❌ Label factory에 `width/height: "fit-content"` 누락 (WebGL auto와 다름)
- ❌ Label generated CSS 부활 (부모 CSS 변수 상속 깨짐)
- ❌ CSS `var(--text-md)` 사용 (미정의 → `var(--text-base)` 사용)
- ❌ Label lineHeight를 숫자로 전달 (parseLineHeight가 배율로 해석 → `"20px"` 문자열 필수)
- ❌ DFS injection 조건에 `fontSize == null` 사용 (`lineHeight == null` 필수)
- ❌ Label height에 `Math.ceil(fontSize * 1.5)` 사용 (LABEL_SIZE_STYLE 역참조 필수)
- ❌ PARENT_VARIANT_TO_LABEL_TOKEN 방식 부활 (LabelSpec.variants 사용)
- ❌ fontFamily 문자열을 단일 배열 요소로 전달 (`split(",")` 필수)
- ❌ `getMaxWidth()`로 콘텐츠 폭 계산 (`getLongestLine()` 사용)
- ❌ `type: "arc"` 별도 사용 (HMR 이슈 → box + arc 데이터)
- ❌ 트랙에 circle + stroke (inset 차이 → arc 360° 사용)
- ❌ `size.height/2`로 세로 중앙 (`containerHeight/2` 사용)
- ❌ publishLayoutMap 타이밍 해킹, notifyLayoutChange() 강제 호출
- ❌ parentElement를 useMemo 내 직접 참조 (stale closure)
- ❌ hitElementId를 startMove에 직접 전달 (selectedElementIds 사용)
- ❌ `calculateContentWidth`에 `isCanvasKitMeasurer() ? 0 : +N` 보정 추가 (CSS 정합 파괴 → nodeRendererText `+1` 마진 사용)
- ❌ `enrichWithIntrinsicSize`에서 flex 자식 width 주입 시 minWidth 미설정 (CSS min-width:auto 누락 → 자식 0px 축소)
- ❌ overflow flexShrink 보정에서 `scroll/auto`만 체크 (`hidden/clip` 누락 → `!== "visible"` 필수)

## 8. Overflow Scroll 가이드라인 동기화

- `buildTreeBoundsMap` (Tree 경로): traverse 시 부모의 `scrollOffset`을 자식 좌표에서 차감 필수. **Why**: 미반영 시 hover outline이 스크롤 전 위치에 고정
- `renderCommands.ts` (Command Stream 경로): `visitElement`에서 자식 boundsMap 좌표에 부모 `scrollOffset` 차감 필수. **Why**: boundsMap은 절대 좌표 → 렌더링의 `canvas.translate`와 동기화 필요
- `scrollState.scrollVersion`: 스크롤 변경 시 `getCachedTreeBoundsMap` 캐시 무효화용 카운터. **Why**: `registryVersion`/`pagePosVersion`만으로는 스크롤 변경 미감지

## 상세 레퍼런스

- [Canvas 렌더링 구현 상세](../skills/composition-patterns/reference/canvas-details.md)
- [SPEC_CSS_BOUNDARY.md](../../docs/reference/components/SPEC_CSS_BOUNDARY.md)
