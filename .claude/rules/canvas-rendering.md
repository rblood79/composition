---
description: Canvas/Skia 렌더링 관련 파일 작업 시 적용 (ADR-900 PixiJS 제거 완료)
globs:
  - "apps/builder/src/builder/canvas/**"
  - "packages/specs/**"
  - "**/nodeRenderers*"
  - "**/ElementSprite*"
  - "**/useCentralCanvasPointerHandlers*"
  - "**/useDragInteraction*"
---

# Canvas 렌더링 규칙

> **SSOT 체인 연계 (CRITICAL)**: Skia 렌더는 [ssot-hierarchy.md](ssot-hierarchy.md) **D3(시각 스타일)의 direct consumer**. CSS/DOM consumer와 **대등(symmetric)** — 한쪽이 다른 쪽 기준 아님. 대칭 = "시각 결과의 동일성" (구현 방법 자유). catalog/spec 이 D1(DOM) 침범 금지.
>
> **2026-07-08**: D3 SSOT 는 [ADR-142](../../docs/adr/completed/142-starter-spec-component-system-cutover.md)(Implemented) 로 catalog(`COMPONENT_RULES_TABLE`) + theme/tokens 로 전환됨. 본 문서의 "Spec" 서술은 **잔존 spec 3개(Frame/Group/Slot) 한정** — 일반 컴포넌트는 catalog 경로 (ADR-036 은 Superseded by ADR-142).
>
> 구현 상세는 [canvas-details.md](../skills/composition-patterns/reference/canvas-details.md) 참조

## 1. Skia 단일 렌더러 핵심 (ADR-900)

- ADR-900 Unified Skia Engine — Skia 가 화면 + 이벤트 (EventBoundary) 통합 처리. PixiJS 완전 제거됨
- DirectContainer 패턴: 엔진 계산 결과(x/y/w/h)로 직접 배치. **Why**: @pixi/layout 및 PixiJS 모두 제거 (ADR-900)
- CanvasKit `heightMultiplier`에 `halfLeading: true` 필수. **Why**: CSS line-height 상하 균등 분배

## 2. Component Spec 규칙

- TokenRef 숫자 연산 시 `resolveToken()` 변환 필수. **Why**: 미변환 시 NaN 전파
- `_hasChildren` 체크: 배경 shapes 직후, standalone shapes 직전 배치. **Why**: 자식 유무에 따라 shapes 분기
- Child Spec 추가 → `packages/specs/src/index.ts` + `components/index.ts` export + `pnpm build:specs` + `TAG_SPEC_MAP` 등록 (신규 child spec 은 D1 예외 컴포넌트만 — 일반 컴포넌트는 catalog)
- Spec fontSize 우선순위: `props.size` 명시 시 `size.fontSize` 우선. **Why**: Propagation은 size prop만 변경, style.fontSize 미갱신
- Spec Container Dimension Injection: `_containerWidth`/`_containerHeight` props 주입 (buildSpecNodeData → specProps). `CONTAINER_DIMENSION_TAGS` Set 등록 필수. **Why**: Spec shapes가 레이아웃 엔진 결과를 모르면 우측/중앙 배치 불가

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

| 분류                | Set                               | `_hasChildren=true` 주입 | 예시                                                                                                                                                                                    |
| ------------------- | --------------------------------- | :----------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Shell-only**      | `SHELL_ONLY_CONTAINER_TAGS`       |  **자식 수 무관 항상**   | Calendar/RangeCalendar, Card, Dialog, Section, DisclosureGroup, Button/Checkbox/Radio/ToggleButtonGroup, Disclosure, Form, Popover, Tooltip, ColorPicker/ColorSwatchPicker, body (17개) |
| **Synthetic-merge** | `SYNTHETIC_CHILD_PROP_MERGE_TAGS` |         **차단**         | Breadcrumbs, ComboBox, GridList, Select, Table, Tabs, TagGroup, Toolbar, Tree (9개)                                                                                                     |
| **Plain**           | (양쪽 다 미포함)                  |      자식 있을 때만      | TabPanel, TabPanels (shapes=[]), Frame (ADR-130 — canonical layout container) 및 대부분의 일반 컨테이너                                                                                 |

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
- Label 기본 크기: fit-content (CSS + Factory + 레이아웃 엔진 3경로 동기화 필수)
- Label size delegation: `LABEL_SIZE_STYLE` 단일 소스 (fullTreeLayout.ts — catalog `COMPONENT_RULES_TABLE.Label` 정합). DFS 주입 조건은 `lineHeight == null` 기준. **Why**: fontSize 조건 사용 시 factory 기본값과 충돌

## 5. 토큰/테마 정합성

- Field 컴포넌트 입력 영역 배경: CSS `--bg-inset` / Spec `{color.layer-2}` 통일. **Why**: 시각적 일관성
- Select/ComboBox/SearchField gap: 모든 경로에서 고정 4px
- Dark Mode Token: adaptive 배경(`{color.neutral}`) → 텍스트에 `{color.base}` (not `{color.white}`). **Why**: dark mode에서 반전
- Skia color-mix: `mixWithBlackSrgb()` 사용 (oklch 근사 금지). **Why**: srgb 혼합과 수학적으로 다른 결과
- Necessity Indicator: 3경로 동기화 (CSS renderNecessityIndicator / 레이아웃 엔진 Label DFS / Skia specProps)

## 6. 레이아웃 통합

- Size Delegation: 부모 size → 자식 직접 참조 (`resolveParentDelegatedSize`, buildSpecNodeData.ts). **Why**: Store가 자식 size 미저장
- Calendar 계열 (CalendarGrid/CalendarHeader): catalog 경로 렌더 — CalendarHeader 는 `CONTAINER_DIMENSION_TAGS`, Calendar/RangeCalendar 는 Shell-only. 상세: canvas-details.md
- Popover 자식(Calendar/RangeCalendar): 레이아웃 엔진 계산에서 제외. **Why**: Preview Popover 표시
- Collection Item Font: layout 경로 `injectCollectionItemFontStyles` (implicitStyles.ts) + Skia 는 catalog rule (GridListItem/ListBoxItem) — 상세: layout-details.md
- Arc Shape: `type: "box"` + `arc` 데이터로 변환. 트랙도 arc(360°)로 렌더링. **Why**: renderSolidBorder inset 차이
- Pointer → Move: store의 `selectedElementIds`에서 읽기. `hitElementId` 직접 전달 금지. **Why**: 내부 자식 의도치 않은 이동

## 6.5 Drag-and-Drop 원칙

- 시각적 offset 변경 금지 → **데이터 모델(store) mutation** 필수. **Why**: visual hack은 drop 시 원위치 + Skia 미동기화
- 좌표 변환: DOM clientX/Y → canvas 좌표 시 viewport offset + zoom 반영 필수. **Why**: pan/zoom 적용된 canvas와 DOM은 1:1 아님
- 이벤트 리스너: `useRef`로 핸들러 참조 유지. **Why**: 드래그 중 리렌더 → addEventListener 소실
- 드래그 상태 변수에 `eslint-disable` 주석. **Why**: 이벤트 핸들러 내에서만 참조되어 linter가 미사용으로 오판

## 7. 금지 패턴 종합

- ❌ TEXT_TAGS에 "Label" 재추가 (이중 렌더링)
- ❌ Label factory에 `width/height: "fit-content"` 누락 (레이아웃 엔진 auto 와 다름)
- ❌ Label generated CSS 부활 (부모 CSS 변수 상속 깨짐)
- ❌ CSS `var(--text-md)` 사용 (미정의 → `var(--text-base)` 사용)
- ❌ Label lineHeight를 숫자로 전달 (parseLineHeight가 배율로 해석 → `"20px"` 문자열 필수)
- ❌ DFS injection 조건에 `fontSize == null` 사용 (`lineHeight == null` 필수)
- ❌ Label height에 `Math.ceil(fontSize * 1.5)` 사용 (LABEL_SIZE_STYLE 역참조 필수)
- ❌ PARENT_VARIANT_TO_LABEL_TOKEN 방식 부활 (catalog `COMPONENT_RULES_TABLE.Label` variants 사용)
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
- `executeRenderCommands` AABB 컬링 (`translateStack`): `CMD_CHILDREN_BEGIN` 의 scroll translate 를 컬링 절대좌표 스택에도 반영 필수 (`scrollDeltaStack` push → `CMD_CHILDREN_END` 복원). **Why**: 미반영 시 스크롤로 뷰포트에 들어온 자식이 스크롤 전 좌표로 판정되어 오컬링 — hover outline (boundsMap 경로) 만 보이고 본체 미렌더 (2026-07-16 수정)
- `scrollState.scrollVersion`: 스크롤 변경 시 `getCachedTreeBoundsMap` 캐시 무효화용 카운터. **Why**: `registryVersion`/`pagePosVersion`만으로는 스크롤 변경 미감지

## 8.5 Clip-Aware Hit Bounds — 원본 박스 ↔ 히트 영역 분리 (2026-07-24)

포인터 판정(클릭 선택 / 호버 아웃라인 / 휠 스크롤 타깃 / 드롭 타깃)은 **렌더러가 실제로 그린 영역만** 대상으로 해야 한다. `renderCommands.buildRenderCommandStream` 은 이를 위해 **두 맵**을 낸다.

| 맵                                   | 내용                             | 소비자                                                                                       |
| ------------------------------------ | -------------------------------- | -------------------------------------------------------------------------------------------- |
| `boundsMap` (`getSceneBounds`)       | 요소 **원본 박스** (클립 미적용) | 선택 오버레이 / TextEditOverlay / AI 이펙트 / overflowInfoMap / 측정                         |
| `hitBoundsMap` (`getSceneHitBounds`) | 원본 박스 ∩ **조상 clip rect**   | SpatialIndex(`syncSpatialIndex`) / 호버 AABB / 휠 스크롤 타깃 / **콘텐츠성 오버레이 chrome** |

**오버레이 chrome 의 갈림 기준 — "요소를 가리키는가" vs "내용 자리를 그리는가"**: 오버레이 패스는 씬의 clip save/restore **밖**에서 돌기 때문에 어떤 맵을 넘기느냐가 곧 클립 여부다.

| chrome                                                                                                                                                | 맵             | 이유                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------- |
| 선택 박스 / 리사이즈 핸들 / 프레임 타이틀                                                                                                             | `boundsMap`    | 요소를 **가리키는** 표식 — 일부가 잘려도 전체 범위를 보여야 조작 가능      |
| slot 해치·테두리 (`buildSlotMarkerTargets`), collection remainder (`buildCollectionRemainderTargets`), 자식 가이드라인 (`buildHoverHighlightTargets`) | `hitBoundsMap` | **내용이 놓일 자리**를 그리는 콘텐츠성 chrome — 실제 내용과 같이 잘려야 함 |

- 클립 교차는 `intersectBoxes()` (`selection/types.ts`) 단일 수식. 렌더 커맨드의 조상 clip 교차와 오버레이 가시 영역 산출이 같은 함수를 쓴다.
- padding inset 같은 **요소 상대** 변환은 원본 박스 기준으로 먼저 하고, 가시 영역 클립은 **그 다음**이다. 순서를 바꾸면 잘린 요소의 inset 이 잘린 박스 기준이 돼 어긋난다.
- **Why (2026-07-24 실측)**: `renderSlotHatchPattern` 은 자기 bounds 로만 `clipRect` 를 걸어서 원본 박스를 넘기면 조상 클립을 전혀 받지 않았다. page body(`overflow:auto`, 390x844) 를 스크롤해 프레임 밖으로 나간 ListBox 해치가 프레임 상단 경계 **위로 66px** 캔버스 배경에 그려졌다. 같은 요소의 히트 영역은 이미 클립돼 있어 **"보이는데 클릭은 안 되는"** 비대칭이 됐다.

- clip rect 계약은 렌더러와 **1:1 미러**: `CMD_CHILDREN_BEGIN` 이 `clipChildren` 일 때 `(0,0,clipWidth,clipHeight)` 로 클립하므로, 절대 좌표 clip rect = `(absX, absY, clipWidth, clipHeight)`. **자기 자신은 클립되지 않고 자식만** 클립된다.
- scroll translate 는 clip **뒤**에 적용되므로 clip rect 원점에는 `scrollOffset` 을 반영하지 않는다 (자식 절대 좌표에는 이미 차감돼 있음).
- 교차 결과가 비면 `hitBoundsMap` 에 **미등재** = 히트 불가. 조상 clip 이 완전히 비면 서브트리에 `EMPTY_CLIP`(크기 0)을 전파한다 — `null`(=클립 없음)로 되돌리면 전부 잘린 서브트리가 오히려 무제한 히트 가능해진다.
- drag top-layer 재방문(`renderAsTopLayer`)은 clip save/restore **밖**에서 그려지므로 clip 미적용(`clipRect = null`)으로 재방문한다.
- **Why (2026-07-24)**: `boundsMap` 만으로 SpatialIndex 를 채우면 화면에 없는 영역이 히트된다. 실측 — ListBox 인스턴스 `maxHeight:300 + overflow:auto` 에서 owner 아래 10px(local y=310) 클릭 시 body 대신 ListBox 가 선택 (row projection → `projection.listBoxId` owner redirect). page body(`overflow:auto`, 844) 아래로 밀려난 형제도 프레임 밖 빈 캔버스에서 선택됨. 컨테이너 전반 공통 결함이라 컴포넌트별 우회가 아니라 bounds 생성 지점에서 차단.

### 금지 패턴

- ❌ 포인터 판정에 `boundsMap` / `getSceneBounds` 사용 → `hitBoundsMap` / `getSceneHitBounds` 필수
- ❌ **선택 박스·핸들·프레임 타이틀**·측정에 `hitBoundsMap` 사용 → 부분 클립 요소의 선택 박스·텍스트 편집 위치가 잘림
- ❌ **콘텐츠성 오버레이 chrome**(slot 해치/테두리, collection remainder, 자식 가이드라인)에 `boundsMap` 사용 → 오버레이 패스는 씬 clip 밖이라 프레임·overflow 컨테이너를 뚫고 그려진다
- ❌ 오버레이 chrome 에서 요소 상대 변환(padding inset 등)을 클립 **뒤**에 적용 → 잘린 박스 기준 inset 으로 어긋남
- ❌ 클립 교차를 지역 헬퍼로 재구현 → `intersectBoxes()` (`selection/types.ts`) 단일 수식 사용
- ❌ `visitElement` 에 clip 파라미터를 추가하면서 자식 재귀에 전달 누락 → 조상 clip 이 한 단계에서 끊김
- ❌ clip 교차 결과가 빈 경우 `null` 로 폴백 (= 클립 해제) → `EMPTY_CLIP` 전파 필수

## 8.6 Hover 그룹 하이라이트 — body 는 확장 대상 아님 (2026-07-24)

`useElementHoverInteraction` 은 컨테이너를 호버하면 리프 자손을 모아 점선 자식 가이드라인을 그린다 (Pencil deep-hover 패턴). 확장 판정은 `resolveHoverGroupState()` **단일 진입점**.

- 호버 후보(`candidates`)는 **editingContext 직계 자식 또는 body 직계 자식**이라 body 자신은 AABB 히트로 context 가 되지 않는다. body 가 context 가 되는 경로는 빈 영역 fallback (`resolvePageBodyHoverTarget` / `resolveFrameBodyHoverTarget`) **뿐**이며, 이는 "여기엔 요소가 없다" 신호다.
- 따라서 **body context 는 리프 확장 금지** — `hoveredLeafIds: []`, `isGroupHover: false`. context 자체의 실선 아웃라인은 유지해 "클릭하면 body 선택" affordance 를 남긴다.
- **Why (2026-07-24)**: 확장 분기가 context 종류를 구분하지 않아, 페이지의 요소 없는 빈 공간에 마우스를 올리면 `collectLeafDescendants(body)` 가 **페이지 전체 리프**를 반환 → `buildHoverHighlightTargets` 가 모든 리프에 점선을 그렸다 (ListBox 2개의 전 행이 동시에 가이드라인 표시).

### 캐시 계층 분리 — "무엇을 호버 중인가" ↔ "지금 어디에 그리는가"

| 계층                                                | 내용                                       | 갱신 시점                           |
| --------------------------------------------------- | ------------------------------------------ | ----------------------------------- |
| hover state (`hoveredElementId` / `hoveredLeafIds`) | **구조적** — childrenMap 만으로 산출       | hover context 변경 시 (pointermove) |
| overlay target (`buildHoverHighlightTargets`)       | **기하** — `hitBoundsMap` 으로 가시성 판정 | 프레임마다                          |

- `collectLeafDescendants` 는 bounds 로 거르지 않는다. 가시성(클립/스크롤)은 프레임마다 달라지는데 hover state 는 context 가 그대로면 재계산되지 않으므로, 여기서 걸러 캐시하면 **최초 가시 집합이 고착**된다.
- 자식 점선 가이드라인의 가시성 판정은 `buildHoverHighlightTargets` 가 `hitBoundsMap` 조회로 수행 — 전부 잘린 리프는 건너뛰고, 부분 가시 리프는 보이는 구간에만 그린다.
- **Why (2026-07-24)**: 스크롤 가능한 ListBox 를 호버하면 처음 보이는 행만 가이드라인이 잡히고, 휠 스크롤로 새 행이 들어와도(포인터 미이동 → hover 재계산 없음) 가이드라인이 안 나왔다. 마우스를 뺐다 다시 넣어야 갱신되던 증상.

### 금지 패턴

- ❌ hover 확장 판정을 훅 내부에 인라인 (테스트 불가 + 조건 누락) → `resolveHoverGroupState()` 경유
- ❌ 빈 영역 fallback 으로 잡힌 context 를 일반 컨테이너 호버와 동일 취급 → 페이지 전체 가이드라인
- ❌ `hoveredLeafIds` 를 bounds/가시성으로 필터링해 캐시 → 스크롤 후 stale (재계산 trigger 가 context 변경뿐)
- ❌ 자식 가이드라인을 `treeBoundsMap`(원본 박스) 으로 조회 → 잘려 안 보이는 리프에도 점선

## 8.7 선택 박스 좌표계 — scene 단일계 (2026-07-24)

포인터 판정에 쓰이는 값은 **전부 scene 좌표**다. 클릭 좌표(`screenToCanvasPoint` 결과), 히트 bounds(`getSceneHitBounds`), 선택 박스(`computeSelectionBounds`) 셋이 같은 계여야 한다.

- `getElementBoundsSimple` / `getSceneBounds` 는 **이미 scene 좌표**를 반환한다. 여기에 `panOffset` 을 빼거나 `zoom` 으로 나누는 보정을 **추가하지 않는다** — PixiJS `getBounds()` 가 screen 좌표를 주던 시절의 잔재다.
- `computeSelectionBounds` 의 body 분기는 raw 페이지 좌표를 쓴다. 요소 분기도 동일해야 하며, 한 함수 안에서 두 좌표계가 섞이면 안 된다.
- **Why (2026-07-24, 40클릭 실측)**: 요소 분기만 `(bounds - panOffset) / zoom` 보정을 하고 있었다. zoom=1 에서도 선택 박스가 `panOffset` 만큼 통째로 이동 — 실측 `component-listbox` scene `20,188 350x110` → 계산값 `-195,-40 350x110`. 그 유령 박스에 걸린 클릭이 `inSelectionBounds` 로 판정돼 **선택이 통째로 무시**됐다(실패 10/40, 그 중 9건이 `inSelectionBounds=true`). 유령 박스 위치가 pan 과 선택 요소 위치의 조합에 좌우돼 **컴포넌트와 무관하게 불특정**하게 재현됐다. 노드 트리 선택은 이 경로를 안 거쳐 항상 정상 — 비대칭이 진단 단서였다.

### 금지 패턴

- ❌ scene 좌표 bounds 에 `panOffset` 감산 / `zoom` 제산 추가 (`computeSelectionBounds` 에서 `panOffset` 파라미터는 삭제됨 — 재도입 시 컴파일 에러)
- ❌ 한 bounds 계산 함수 안에서 body 분기와 요소 분기가 다른 좌표계 사용
- ❌ 선택이 "가끔" 안 되는 증상을 히트 테스트 문제로 단정 — `inSelectionBounds` 가드가 먼저 삼키는지 확인 (히트는 성공하고 그 뒤 단계에서 버려질 수 있다)

## 8.8 드래그 의도 판정 — bbox 아닌 계층 정규화 타깃 (2026-07-24)

pointerdown 을 "현재 선택을 잡아 끄는 동작" 으로 볼지의 판정은 **선택 박스 안인가**가 아니라 **커서 아래 요소를 현재 editingContext 깊이로 정규화한 결과가 지금 선택된 요소인가**로 한다. 단일 진입점은 `resolveSelectionDragIntent()` (`interaction/selectionModel.ts`).

| 클릭 대상                                  | 드래그 의도 | 결과                                                   |
| ------------------------------------------ | :---------: | ------------------------------------------------------ |
| 선택 요소 자신                             |     ✅      | 선택 유지 + `pendingDrag`                              |
| 선택 요소의 자손 (정규화 결과가 선택 요소) |     ✅      | 선택 유지 + `pendingDrag`                              |
| **선택 박스에 겹쳤을 뿐인 다른 요소**      |     ❌      | **그 요소를 새로 선택**                                |
| body 선택 상태                             |     ❌      | 자식 클릭이 정상 선택                                  |
| 히트 없음 (`hitElementId === null`)        |     ✅      | 기존 동작 보존 — 빈 영역이어도 박스 안이면 드래그 핸들 |

- 깊이 진입은 **더블클릭 + `editingContext`** (`resolveClickTarget` / `handleElementDoubleClick`) 가 전담한다. 드래그 의도 판정이 깊이 모델을 겸하면 안 된다 — 두 축이 섞이면 겹친 형제 클릭이 삼켜진다.
- body 예외를 판정 함수 **바깥**에 특수 분기로 두지 않는다. body 선택 박스는 페이지 전체를 덮어 bbox 판정이면 모든 클릭이 무시되므로, 같은 결함의 국소 우회가 재발한다.
- **Why (2026-07-24 실측 + 외부 도구 대조)**: 판정이 bbox 였을 때 `component-gridlist` 선택 상태에서 그 박스(`20,374 350x340`) 안으로 들어온 `component-form__field-1-input` 클릭이 무반응이었다. Figma 는 실제 객체 지오메트리로 판정해 그 객체를 선택하고(공식 문서), Pencil 도 동일 — 실측 확인: 파랑 프레임 선택 → 파랑 bbox 안의 주황 프레임 클릭 → **주황 선택**. 깊이 진입은 두 도구 모두 더블클릭이라 composition 과 이미 일치했고, 발산 지점은 이 판정 하나였다.

### 금지 패턴

- ❌ `hitTestSelectionBounds` 결과(`inSelectionBounds`) 단독으로 드래그 의도 판정 — `resolveSelectionDragIntent()` 와 **AND** 로만 사용
- ❌ 드래그 의도를 "선택 요소의 자손인가" 로 판정 — body 는 모든 요소의 조상이라 body 선택 시 전 클릭이 삼켜진다 (정규화 결과 비교여야 함)
- ❌ body 선택 특수 분기를 호출부에 재도입 (`resolveSelectionDragIntent` 내부가 유일한 거처)
- ❌ 깊이 진입 규칙을 드래그 의도 판정에 얹기 (더블클릭 + editingContext 가 전담)

## 9. Render-Space Interaction Boundary (ADR-135/136 Implemented 2026-05-14/15)

> Page Frame projection 도입 후, hit-test/그리기 ID 공간과 canonical document ID 공간을 분리. 위반 시 데이터 corruption 또는 split-brain 인터랙션 발생.

- **ID 공간 분리**: hit-test/그리기 authoritative source 는 `renderNodesMap` / `interactionNodesMap`. `sceneNodesMap` 은 diagnostic/inspection 전용 — `renderNodesMap.get(x) ?? sceneNodesMap.get(x)` 류 render fallback **금지** (static gate 0건)
- **projected ID 비영속**: `::page-frame::` projected ID 는 canonical document / IndexedDB / history payload 에 저장 금지. refresh 후 `elementsMap` 에 synthetic projected ID 0건이어야 함
- **canonical move target**: projected Slot 으로의 drag/drop 은 `resolveCanonicalMoveTarget` → `moveElementToCanonicalTarget` 단일 mutation entry. **금지**: projected render ID 를 canonical mutation 의 `containerId`/target 으로 직접 전달
- **Slot roundtrip 무손실**: Frame apply/remove/apply 반복 후 header/content/footer/custom Slot 의 `RefNode.descendants[path].children` 순서 보존. unapply 시 Slot mirror metadata 보존 → reapply 시 path 복원
- **bootstrap canonical-only**: store mirror hydrate 는 canonical traversal 만 (`canonicalDocumentToElements()` 등). `deriveProjectRenderModelFromDocument()` elements 는 Skia 그리기 전용 — mirror hydrate source 로 사용 금지
- **sceneVersion signature (ADR-136)**: `sceneVersion` = layoutVersion + pagePositionsVersion + **projection content signature** (node id/type/parent/page/layout id, ref·reusable·deleted state, stable props, ADR-135 projection metadata). signature 계산은 `buildSceneStructureSnapshot()` 시점만 (pointer hot path 금지)
- **projection-relevant field 추가 규칙**: frame metadata / projection prop / ref state / 신규 canonical schema field 추가 시 signature input 목록 **동시 갱신** — `layoutVersion` 5-심볼 2계층 체인 (layout-engine.md) 과 동급 보수 의무. 누락 시 same-count phantom change 미감지 (signature false negative)

## 상세 레퍼런스

- [Canvas 렌더링 구현 상세](../skills/composition-patterns/reference/canvas-details.md)
- [SPEC_CSS_BOUNDARY.md](../../docs/reference/components/SPEC_CSS_BOUNDARY.md)
