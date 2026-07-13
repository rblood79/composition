# ADR-050: Container Overflow 프로퍼티 — Preview CSS + Figma 스타일 WebGL 시각화

## Status

**Implemented** — 2026-04-03

## Related ADRs

- [ADR-008](008-layout-engine.md): 레이아웃 엔진 전환 — overflow/aspectRatio applyCommonTaffyStyle() 추가 기록
- [ADR-009](009-full-tree-wasm-layout.md): Phase E `overflow: scroll/auto` 완성 계획 — 본 ADR의 선행 인프라
- [ADR-035](035-workspace-canvas-refactor.md): Workspace Canvas Runtime — SharedSceneDerivedData, treeBoundsMap 인프라

## Context

### 문제

composition의 컨테이너 컴포넌트(Card, Form, GridList 등)에 CSS `overflow` 프로퍼티를 사용자가 직접 설정할 수 있는 UI가 없다. 현재 overflow는 Typography 섹션의 text truncation 프리셋(`truncate` → `overflow: hidden`)으로만 간접 설정 가능하며, 컨테이너 레이아웃 차원의 overflow 제어는 미제공 상태다.

### 요구사항

1. **에디터 UI**: Layout 패널에서 container의 overflow 값(visible, hidden, scroll, auto, clip)을 직접 선택
2. **Preview (CSS DOM)**: 선택한 overflow 값이 실제 CSS로 적용 — 브라우저 네이티브 동작
3. **WebGL (Skia Canvas)**: Figma 패턴 — overflow 컨테이너의 콘텐츠는 클리핑하되, **컨테이너 hover 시 초과 영역의 자식을 반투명으로 표시**
4. **레이아웃 크기 제외**: overflow != visible인 컨테이너에서 **초과 영역은 width/height 계산에서 제외** — 컨테이너가 자식을 수용하기 위해 확장하지 않음

### Figma 레퍼런스

Figma에서 Frame의 "Clip content" 설정 시:

- **평상시**: 자식이 Frame 경계로 클리핑, 초과 콘텐츠 보이지 않음
- **hover/선택 시**: 클리핑 영역 밖 자식이 **반투명(~30% opacity)**으로 표시 — 숨겨진 콘텐츠 위치 확인 가능
- **크기 계산**: Frame 크기는 설정된 dimensions 유지, 초과 자식은 크기에 영향 없음

composition에서는 hover 시 반투명 표시 + 크기 제외까지 구현한다.

### 기존 인프라 현황

| 레이어                       | 상태   | 구현 파일                                              | 비고                                         |
| ---------------------------- | ------ | ------------------------------------------------------ | -------------------------------------------- |
| Skia 클리핑 (hidden/clip)    | ✅     | `BoxSprite.tsx:338-342`, `nodeRendererTree.ts:206-210` | `clipChildren: true` → `canvas.clipRect()`   |
| Taffy overflow 전달          | ✅     | `utils.ts:3434-3440` applyCommonTaffyStyle()           | overflowX/Y Taffy 스타일 전달                |
| Scroll offset 렌더링         | ✅     | `nodeRendererTree.ts:212-221`                          | `canvas.translate(-scrollLeft, -scrollTop)`  |
| ScrollState store            | ✅     | `scrollState.ts`                                       | scrollTop/Left/max 관리, scrollBy()          |
| maxScroll 계산               | ✅     | `fullTreeLayout.ts:1924-1954`                          | scroll/auto 요소의 content bounds 계산       |
| Preview CSS 추출             | ✅     | `computedStyleExtractor.ts:89-91`                      | overflow/overflowX/overflowY 화이트리스트    |
| Hover 인프라                 | ✅     | `useElementHoverInteraction.ts` → `hoverRenderer.ts`   | hoveredElementId, outline 렌더링 파이프라인  |
| **에디터 UI (Container용)**  | **❌** | —                                                      | Typography 섹션에만 text truncation용 존재   |
| **Overflow content bounds**  | **❌** | —                                                      | 클리핑된 자식의 전체 영역 계산 없음          |
| **Figma 스타일 반투명 표시** | **❌** | —                                                      | hover 시 초과 자식 반투명 렌더링 미구현      |
| **Enrichment overflow 제외** | **❌** | `utils.ts` enrichWithIntrinsicSize()                   | overflow 무시 — auto height에 모든 자식 포함 |
| **히트 테스트 클리핑**       | **❌** | `useElementHoverInteraction.ts`                        | 클리핑 밖 자식도 AABB 히트 가능              |

---

## Decision

### 접근 방식: 기존 인프라 확장

기존 클리핑/hover 인프라를 최대한 재사용하고, 3가지 gap만 채운다:

1. Layout 패널 UI 추가
2. `overflowContentBoundsMap` 계산 (자식 union bounds)
3. hover overlay에 overflow outline 렌더러 연결

### 대안 검토

| 대안                                  | 장점                            | 단점                          | 결정      |
| ------------------------------------- | ------------------------------- | ----------------------------- | --------- |
| A. 기존 인프라 확장 (선택)            | 변경 최소, treeBoundsMap 재사용 | —                             | **채택**  |
| B. ADR-009 Phase E 스크롤바 먼저 구현 | 완전한 overflow 지원            | 스크롤바 UI 복잡, 당장 불필요 | 별도 후속 |
| C. PixiJS overlay layer에서 outline   | React 컴포넌트로 구현 가능      | Skia와 좌표계 이중 관리       | 기각      |

---

## Design Constraints (Codex 검증 반영)

### DC-1: Lazy 계산 — 매 프레임 O(N) 회피

`buildOverflowContentBoundsMap()`은 treeBoundsMap 전체 순회 O(N)이므로, **매 프레임 호출하면 병목**이 될 수 있다.

- **해결**: hover 대상(`hoveredElementId`) 변경 시에만 lazy 계산
- `overflowContentBoundsMap`을 `registryVersion` + `pagePosVersion` 기반 캐싱
- overlay 빌드 경로(`skiaOverlayBuilder.ts`)는 이미 hover/selection 변경 시에만 재계산되므로, 동일 주기에 맞춤

### DC-2: Tree 경로 전용 — Command Stream 경로 제한

오버레이 빌드는 **Tree 경로에서만** 실행된다. Command Stream 경로(`renderCommands.ts`)는 콘텐츠 렌더링 전용이며 오버레이를 별도 빌드하지 않는다.

- `buildOverflowContentBoundsMap()`은 Tree 경로의 `buildSkiaFrameContent()` 내부에서만 호출
- Command Stream 경로 지원은 본 ADR 범위 외

### DC-3: 사용자 명시값 vs implicit overflow 분리

`implicitStyles.ts`에서 GridList(`overflow: "hidden"`), SelectValue, ComboBoxInput 등에 이미 overflow를 주입 중이다. 에디터 UI와 충돌을 방지한다.

- **에디터 UI**: `element.props.style.overflow`(사용자 명시값)만 읽음
- **implicit overflow**: Taffy/렌더링 경로에서만 적용, 에디터 UI에 노출하지 않음
- **Typography truncation**: text truncation 프리셋(`overflow: hidden` + `textOverflow: ellipsis` + `whiteSpace: nowrap`)은 leaf 요소(Text)에 적용됨. Layout 섹션의 overflow 셀렉터는 container 요소 전용이므로 동일 요소에서 충돌하지 않음. 단, 사용자가 container에 text truncation 프리셋을 적용한 후 Layout overflow를 변경하면 Typography 프리셋이 풀림 — **UI에서 overflow 값 동기 표시**로 대응

### DC-4: LAYOUT_AFFECTING_PROPS 명시 등록

현재 `overflow`는 `LAYOUT_AFFECTING_PROPS`에 직접 등록되지 않고 `style` key의 간접 경로에 의존한다. Undo/Redo, batch update 등 모든 경로에서 안전하게 동작하도록 명시 등록한다.

- `inspectorActions.ts`의 `LAYOUT_AFFECTING_PROPS`에 `"overflow"` 추가
- `layoutCache.ts`의 `LAYOUT_STYLE_KEYS`에는 이미 `"overflow"` 포함 — 변경 불필요
- **검증**: overflow 변경 → Undo → Redo 시 layoutVersion 트리거 + 캔버스 반영 확인

### DC-5: childrenMap bounds 조회 안전성

`childrenMap`은 구조 변경 시에만 갱신되고 props 변경 시에는 갱신되지 않는다 (staleness).

- **overflow 판별**: `elementsMap`에서 `element.props.style.overflow` 읽기 — props 변경 반영됨, 안전
- **자식 bounds 조회**: `childrenMap`에서 자식 ID만 가져오고, 실제 bounds는 반드시 `treeBoundsMap`에서 조회 — bounds staleness 문제 없음
- **금지 패턴**: `childrenMap`의 Element 객체에서 직접 style/bounds를 읽는 것 금지

### DC-6: Overflow 콘텐츠 크기 제외 (CRITICAL)

**현재 문제**: `enrichWithIntrinsicSize()`가 overflow 속성을 전혀 확인하지 않음. `height: auto` + `overflow: hidden` 컨테이너에서 모든 자식 높이를 합산하여 컨테이너를 확장한 뒤, Taffy에 overflow를 전달하지만 크기는 이미 결정된 상태.

```
enrichWithIntrinsicSize() [overflow 무시] → 450px 주입
    ↓
applyCommonTaffyStyle() → overflow:hidden 전달 [이미 늦음]
    ↓
Taffy → 컨테이너 450px로 확정 (클립만 렌더링 시 적용)
```

**해결**: `enrichWithIntrinsicSize()`에서 overflow != visible이면 auto height/width 주입을 **availableHeight/Width로 cap**:

- 명시적 height/width가 있으면 → Taffy가 이미 올바르게 처리 (변경 불필요)
- height: auto + overflow != visible → `min(contentHeight, availableHeight)` 주입
- 이렇게 하면 컨테이너가 부모의 가용 공간을 넘어 확장하지 않음

### DC-7: 히트 테스트 클리핑

overflow != visible 컨테이너에서 클리핑된 자식은 컨테이너 경계 밖에서 히트 테스트 대상이 되면 안 됨.

- `useElementHoverInteraction.ts`의 AABB 히트 테스트에서 부모의 overflow + bounds를 확인
- 클리핑 밖 영역의 자식은 hover 후보에서 제외
- 구현 시점: Phase 4 이후 후속 개선으로 분리 가능

---

## Implementation Plan

### Phase 0: Layout Pipeline 등록 (DC-4)

**파일**: `apps/builder/src/builder/stores/inspectorActions.ts`

- `LAYOUT_AFFECTING_PROPS`에 `"overflow"` 명시 추가

### Phase 1: 에디터 UI — Layout 섹션 Overflow 셀렉터

#### Step 1.1: Jotai atom 확장

**파일**: `apps/builder/src/builder/panels/styles/hooks/useLayoutValuesJotai.ts`

- `LayoutStyleValues` 인터페이스에 `overflow: string` 필드 추가

**파일**: `apps/builder/src/builder/panels/styles/atoms/styleAtoms.ts`

- `layoutValuesAtom` selector에서 overflow 값 추출
- equality comparator에 `a.overflow === b.overflow` 추가

#### Step 1.2: 옵션 상수

**파일**: `apps/builder/src/builder/panels/styles/constants/styleOptions.ts`

```typescript
export const OVERFLOW_OPTIONS = [
  { value: "visible", label: "Visible" },
  { value: "hidden", label: "Hidden" },
  { value: "scroll", label: "Scroll" },
  { value: "auto", label: "Auto" },
  { value: "clip", label: "Clip" },
];
```

#### Step 1.3: LayoutSection 컨트롤 추가

**파일**: `apps/builder/src/builder/panels/styles/sections/LayoutSection.tsx`

- `LayoutSectionContent` 내부, padding/margin 영역 근처에 overflow select 추가
- `updateStyleImmediate("overflow", value)` 패턴 사용 (기존과 동일)
- `LAYOUT_PROPS` 배열(L546)에 `"overflow"` 추가 → reset 커버리지

---

### Phase 2: Preview CSS — 검증만

**변경 없음**. 이미 동작:

- `element.props.style.overflow` → Preview DOM style 직접 적용
- `computedStyleExtractor.ts` 화이트리스트에 overflow 등록 완료

검증: overflow: hidden 설정 → Preview iframe에서 클리핑 동작 확인.

---

### Phase 2b: 레이아웃 크기 제외 (DC-6)

**파일**: `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts`

`enrichWithIntrinsicSize()`에서 overflow != visible인 컨테이너의 auto height/width를 cap:

```typescript
// enrichWithIntrinsicSize() 내부, height 주입 직전
const overflow = (style?.overflow as string) ?? "visible";
const isOverflowClipped = overflow !== "visible";

if (needsHeight && childResolvedHeight > 0) {
  let injectHeight = childResolvedHeight;
  injectHeight += box.padding.top + box.padding.bottom;
  injectHeight += box.border.top + box.border.bottom;

  // DC-6: overflow 클리핑 시 availableHeight로 cap
  if (
    isOverflowClipped &&
    availableHeight > 0 &&
    injectHeight > availableHeight
  ) {
    injectHeight = availableHeight;
  }

  injectedStyle.height = injectHeight;
}
```

동일 로직을 width에도 적용:

```typescript
if (needsWidth && childResolvedWidth > 0) {
  let injectWidth = childResolvedWidth;
  // ... padding/border 추가
  if (isOverflowClipped && availableWidth > 0 && injectWidth > availableWidth) {
    injectWidth = availableWidth;
  }
  injectedStyle.width = injectWidth;
}
```

**핵심**: 명시적 height/width가 있으면 enrichment 자체가 스킵되므로 (needsHeight = false), 이 cap은 `height: auto` + `overflow: hidden` 조합에서만 동작한다.

---

### Phase 3: WebGL — Overflow Content Info 계산

#### Step 3.1: 데이터 구조 — OverflowContentInfo

**파일**: `apps/builder/src/builder/workspace/canvas/skia/skiaFrameHelpers.ts`

Figma 스타일 반투명 렌더링을 위해 **개별 자식 bounds**도 저장:

```typescript
/** overflow 컨테이너의 자식 전체 + 개별 bounds */
export interface OverflowContentInfo {
  /** 컨테이너 bounds (클리핑 영역) */
  containerBounds: BoundingBox;
  /** 모든 자식의 union bounds */
  contentBounds: BoundingBox;
  /** 컨테이너 밖으로 초과하는 개별 자식 bounds */
  overflowChildBounds: BoundingBox[];
}
```

#### Step 3.2: buildOverflowInfoMap() 함수

**파일**: `apps/builder/src/builder/workspace/canvas/skia/skiaFrameHelpers.ts`

```typescript
/**
 * overflow != visible인 컨테이너의 overflow 정보를 수집한다.
 * Figma 스타일 hover 렌더링에 필요한 컨테이너/자식 bounds를 사전 계산.
 *
 * [DC-1] registryVersion + pagePosVersion 기반 캐싱.
 * [DC-2] Tree 경로 전용.
 * [DC-5] childrenMap에서 자식 ID만 사용, bounds는 treeBoundsMap에서 조회.
 */
export function buildOverflowInfoMap(
  treeBoundsMap: Map<string, BoundingBox>,
  elementsMap: Map<string, Element>,
  childrenMap: Map<string, Element[]>,
): Map<string, OverflowContentInfo> {
  const result = new Map<string, OverflowContentInfo>();

  for (const [elementId, containerBounds] of treeBoundsMap) {
    const el = elementsMap.get(elementId);
    if (!el) continue;

    const overflow = (el.props?.style as Record<string, unknown>)?.overflow as
      | string
      | undefined;
    if (!overflow || overflow === "visible") continue;

    const children = childrenMap.get(elementId);
    if (!children || children.length === 0) continue;

    const cx = containerBounds.x,
      cy = containerBounds.y;
    const cr = cx + containerBounds.width,
      cb = cy + containerBounds.height;
    let minX = Infinity,
      minY = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity;
    const overflowChildBounds: BoundingBox[] = [];

    for (const child of children) {
      const b = treeBoundsMap.get(child.id);
      if (!b) continue;
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);

      // 컨테이너 밖으로 초과하는 자식만 수집
      if (b.x < cx || b.y < cy || b.x + b.width > cr || b.y + b.height > cb) {
        overflowChildBounds.push(b);
      }
    }

    if (minX === Infinity || overflowChildBounds.length === 0) continue;

    result.set(elementId, {
      containerBounds,
      contentBounds: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      },
      overflowChildBounds,
    });
  }

  return result;
}
```

#### Step 3.3: 캐싱 (DC-1)

`getCachedOverflowInfoMap()` — registryVersion + pagePosVersion 기반 모듈 캐시. 패턴은 기존 `getCachedTreeBoundsMap()`과 동일.

#### Step 3.4: SharedSceneDerivedData 확장

**파일**: `apps/builder/src/builder/workspace/canvas/skia/types.ts`

```typescript
export interface SharedSceneDerivedData {
  treeBoundsMap: Map<string, BoundingBox>;
  overflowInfoMap: Map<string, OverflowContentInfo>; // NEW
  cameraX: number;
  cameraY: number;
  cameraZoom: number;
}
```

#### Step 3.5: Frame Pipeline 연결

**파일**: `apps/builder/src/builder/workspace/canvas/skia/skiaFramePipeline.ts`

`buildSharedSceneDerivedData()`에 `overflowInfoMap` 파라미터 추가. `buildSkiaFrameContent()` 내부에서 빌드 후 전달 (Tree 경로만, DC-2).

---

### Phase 4: WebGL — Figma 스타일 Hover 반투명 렌더링

#### Step 4.1: renderOverflowContent() — Figma 패턴

**파일**: `apps/builder/src/builder/workspace/canvas/skia/hoverRenderer.ts`

Figma와 동일하게 **컨테이너 밖 영역에 자식 bounds를 반투명 fill + stroke로 렌더링**:

```typescript
// hover blue와 동일 색상, 낮은 alpha — Figma 스타일
const OVERFLOW_FILL_ALPHA = 0.08; // 반투명 fill
const OVERFLOW_STROKE_ALPHA = 0.25; // outline stroke

/**
 * Figma 스타일 overflow 시각화.
 * 컨테이너 경계 밖(ClipOp.Difference)에서만 자식 bounds를 반투명으로 렌더.
 */
export function renderOverflowContent(
  ck: CanvasKit,
  canvas: Canvas,
  info: OverflowContentInfo,
  zoom: number,
): void {
  const scope = new SkiaDisposable();
  try {
    const { containerBounds: c, overflowChildBounds } = info;

    // 컨테이너 밖 영역만 렌더 (Difference clipping)
    canvas.save();
    const clipRect = ck.LTRBRect(c.x, c.y, c.x + c.width, c.y + c.height);
    canvas.clipRect(clipRect, ck.ClipOp.Difference, true);

    // 1. 자식 bounds 반투명 fill
    const fillPaint = scope.track(new ck.Paint());
    fillPaint.setAntiAlias(true);
    fillPaint.setStyle(ck.PaintStyle.Fill);
    fillPaint.setColor(
      ck.Color4f(HOVER_R, HOVER_G, HOVER_B, OVERFLOW_FILL_ALPHA),
    );

    for (const b of overflowChildBounds) {
      const rect = ck.LTRBRect(b.x, b.y, b.x + b.width, b.y + b.height);
      canvas.drawRect(rect, fillPaint);
    }

    // 2. 자식 bounds outline
    const strokePaint = scope.track(new ck.Paint());
    strokePaint.setAntiAlias(true);
    strokePaint.setStyle(ck.PaintStyle.Stroke);
    strokePaint.setStrokeWidth(1 / zoom);
    strokePaint.setColor(
      ck.Color4f(HOVER_R, HOVER_G, HOVER_B, OVERFLOW_STROKE_ALPHA),
    );

    for (const b of overflowChildBounds) {
      const rect = ck.LTRBRect(b.x, b.y, b.x + b.width, b.y + b.height);
      canvas.drawRect(rect, strokePaint);
    }

    canvas.restore();
  } finally {
    scope.dispose();
  }
}
```

**핵심 기법**: `ck.ClipOp.Difference` — 컨테이너 rect의 **외부 영역만** 그리기. 컨테이너 내부는 정상 렌더링 유지, 밖으로 삐져나온 부분만 반투명 표시. HOVER_R/G/B는 기존 hover blue(0x3b, 0x82, 0xf6) 재사용.

#### Step 4.2: Overlay Builder 연결

**파일**: `apps/builder/src/builder/workspace/canvas/skia/skiaOverlayBuilder.ts`

1. `OverlayBuildInput`에 추가:

```typescript
overflowInfoMap?: Map<string, OverflowContentInfo>;
```

2. `buildOverlayNode()` hover 섹션에서 기존 hover highlight 뒤에 추가:

```typescript
// ── Hover Highlights ── (기존)
const hoverTargets = buildHoverHighlightTargets(
  treeBoundsMap,
  hoveredCtxId,
  hoveredLeafIds,
  isGroupHover,
);
for (const target of hoverTargets) {
  renderHoverHighlight(ck, canvas, target.bounds, cameraZoom, target.dashed);
}

// ── Overflow Content (Figma-style) ── (NEW)
if (hoveredCtxId && input.overflowInfoMap) {
  const overflowInfo = input.overflowInfoMap.get(hoveredCtxId);
  if (overflowInfo) {
    renderOverflowContent(ck, canvas, overflowInfo, cameraZoom);
  }
}
```

**변경점**: `buildHoverHighlightTargets()`는 수정하지 않음(기존 인터페이스 유지). overflow 렌더링은 hover highlight과 **별도 호출**로 분리하여 관심사 명확화.

#### Step 4.3: SkiaOverlay 데이터 전달

**파일**: `apps/builder/src/builder/workspace/canvas/skia/SkiaOverlay.tsx`

- `sharedScene.overflowInfoMap`을 `buildOverlayNode()` input에 전달

---

## 수정 파일 요약

| 파일                                          | Phase | 변경 내용                                                 | DC 참조 |
| --------------------------------------------- | ----- | --------------------------------------------------------- | ------- |
| `stores/inspectorActions.ts`                  | 0     | `LAYOUT_AFFECTING_PROPS`에 `"overflow"` 명시 추가         | DC-4    |
| `panels/styles/hooks/useLayoutValuesJotai.ts` | 1.1   | overflow 필드 추가                                        |         |
| `panels/styles/atoms/styleAtoms.ts`           | 1.1   | layoutValuesAtom에 overflow 추출/비교                     | DC-3    |
| `panels/styles/constants/styleOptions.ts`     | 1.2   | OVERFLOW_OPTIONS 상수                                     |         |
| `panels/styles/sections/LayoutSection.tsx`    | 1.3   | overflow select UI + LAYOUT_PROPS 등록                    | DC-3    |
| `layout/engines/utils.ts`                     | 2b    | enrichWithIntrinsicSize() overflow cap                    | DC-6    |
| `skia/skiaFrameHelpers.ts`                    | 3.1-3 | OverflowContentInfo + buildOverflowInfoMap() + 캐싱       | DC-1,5  |
| `skia/types.ts`                               | 3.4   | SharedSceneDerivedData.overflowInfoMap                    |         |
| `skia/skiaFramePipeline.ts`                   | 3.5   | buildSharedSceneDerivedData() 파라미터 확장 (Tree 경로만) | DC-2    |
| `skia/hoverRenderer.ts`                       | 4.1   | renderOverflowContent() — Figma 스타일 반투명 렌더링      |         |
| `skia/skiaOverlayBuilder.ts`                  | 4.2   | OverlayBuildInput + buildOverlayNode 연결                 |         |
| `skia/SkiaOverlay.tsx`                        | 4.3   | sharedScene → overlay input 전달                          |         |

---

## 의존 그래프

```
Phase 0 (LAYOUT_AFFECTING_PROPS 등록) ──┐
                                         │
Phase 1 (에디터 UI) ────────────────────┤
                                         │
Phase 2 (Preview CSS 검증) ────────────┤
                                         ├──→ 검증
Phase 2b (enrichment overflow cap) ────┤
                                         │
Phase 3 (Overflow Info 계산) ─────→ Phase 4 (Figma 반투명 렌더링)
```

- Phase 0은 선행 필수 (1줄 변경)
- Phase 1, 2, 2b, 3은 독립 병렬 가능
- Phase 4는 Phase 3 완료 후 진행

---

## Risk Assessment

| 리스크                                | 심각도 | 완화 전략                                                                                | DC 참조 |
| ------------------------------------- | ------ | ---------------------------------------------------------------------------------------- | ------- |
| overflowInfoMap 계산 비용             | 낮음   | registryVersion + pagePosVersion 캐싱, hover 변경 시에만 소비                            | DC-1    |
| Command Stream 경로 미지원            | 낮음   | overlay는 Tree 경로 전용 — ADR에 명시, 향후 필요 시 확장                                 | DC-2    |
| implicit overflow vs 사용자 설정      | 중간   | 에디터 UI는 `element.props.style.overflow`만 읽음, implicit 주입값 무시                  | DC-3    |
| Typography truncation 동기화          | 중간   | leaf(Text)와 container 대상 분리, 동일 요소 시 overflow 값 동기 표시                     | DC-3    |
| LAYOUT_AFFECTING_PROPS 간접 경로      | 중간   | `"overflow"` 명시 등록으로 Undo/Redo/batch 경로 안전 보장                                | DC-4    |
| childrenMap staleness                 | 낮음   | 자식 ID만 사용, bounds는 treeBoundsMap에서 조회, Element 직접 읽기 금지                  | DC-5    |
| enrichment cap으로 인한 레이아웃 변경 | 중간   | auto + overflow 조합에서만 동작, 명시적 크기는 영향 없음. 기존 컴포넌트 회귀 테스트 필수 | DC-6    |
| ClipOp.Difference 호환성              | 낮음   | CanvasKit 정식 API, composition 빌드에 포함됨                                            |         |
| 히트 테스트 클리핑 미구현             | 중간   | 후속 개선으로 분리 — 클리핑 밖 자식이 hover 가능하지만 기능적 문제 없음                  | DC-7    |
| 중첩 overflow 컨테이너                | 낮음   | 각 컨테이너가 독립적으로 자기 직계 자식의 union 계산                                     |         |
| scroll/auto 스크롤바 UI 미구현        | 중간   | 본 ADR 범위 외 — ADR-009 Phase E에서 후속                                                |         |

---

## Verification

1. **에디터 UI**: 컨테이너 선택 → Layout 패널에서 overflow 드롭다운 표시/변경 확인
2. **implicit overflow 비간섭**: GridList/SelectValue 등 implicit overflow 컴포넌트 선택 시 Layout 패널에 사용자 설정값만 표시 확인 (DC-3)
3. **Preview**: overflow: hidden 설정 → Preview iframe에서 CSS 클리핑 동작 확인
4. **WebGL 클리핑**: Canvas에서 overflow: hidden 컨테이너의 자식 잘림 확인 (기존 동작)
5. **Figma 반투명**: overflow 컨테이너 hover 시 컨테이너 밖 자식이 **반투명 fill + outline**으로 표시 확인 (ClipOp.Difference)
6. **크기 제외**: height: auto + overflow: hidden 컨테이너가 availableHeight를 넘지 않음 확인 (DC-6)
7. **크기 제외 회귀**: 기존 implicit overflow 컴포넌트(GridList 등)의 레이아웃이 변경되지 않았는지 확인
8. **Undo/Redo**: overflow 변경 → Undo → Redo → layoutVersion 트리거 + 캔버스 즉시 반영 확인 (DC-4)
9. **type-check**: `pnpm type-check` 통과
10. **브라우저**: Chrome MCP로 실제 동작 검증

---

## Future Work (본 ADR 범위 외)

- **ADR-009 Phase E**: `overflow: scroll/auto` 스크롤바 Skia 렌더링 + wheel/touch 이벤트 바인딩
- **히트 테스트 클리핑 (DC-7)**: overflow 컨테이너 밖 자식을 hover/click 후보에서 제외
- **Command Stream 경로 확장**: 필요 시 renderCommands.ts에서도 overflow info 계산
- **overflowX/overflowY 개별 설정**: 현재는 overflow 단일값만 UI 제공, 축별 분리는 후속
- **선택 시 반투명 강화**: hover뿐 아니라 selection 시에도 반투명 표시 (Figma 완전 패리티)

---

## Implementation Notes (실제 구현 결과 — 2026-04-03)

설계 대비 실제 구현에서 달라진 사항을 기록한다.

### UI 배치: Layout → Appearance 섹션

설계에서는 Layout 섹션에 overflow 셀렉터를 배치할 계획이었으나, **실제 구현에서는 Appearance 섹션으로 이동**되었다. overflow는 레이아웃 크기 계산보다 시각적 표현(콘텐츠 클리핑 여부)에 가깝다는 판단에 따른 결정이다.

### Body Spec 기본값

`body` 요소의 Spec에 `overflow: "auto"` 기본값이 추가되었다. 페이지 루트 컨테이너가 기본적으로 스크롤 가능한 영역으로 동작하도록 한다.

### 해칭 패턴: 설계 변경 (반투명 → 해칭)

설계 문서의 Figma 스타일 반투명 fill + outline 방식 대신, **해칭 패턴**으로 구현되었다.

| 항목              | 설계 (ADR 원안)                        | 실제 구현                               |
| ----------------- | -------------------------------------- | --------------------------------------- |
| 시각화 방식       | 반투명 fill (OVERFLOW_FILL_ALPHA=0.08) | 해칭 패턴 (우하향 45°, `\` 방향)        |
| 트리거 조건       | 컨테이너 hover 시                      | **자식 요소 선택** 시                   |
| 해칭 라인 수      | —                                      | MAX_HATCHING_LINES=200                  |
| 해칭 색상         | hover blue (0x3b, 0x82, 0xf6)          | `--focus-ring` 토큰 (blue-500)          |
| ClipOp.Difference | 컨테이너 밖 영역만 렌더                | 해칭은 컨테이너 클립 영역 외부에 그려짐 |

**해칭 트리거 변경 이유**: 컨테이너 hover보다 자식 요소 선택 시에 "이 자식이 부모 영역을 벗어났다"는 정보가 더 필요하다.

### 코드 리뷰 반영 — 구조 최적화

코드 리뷰 과정에서 다음 변경이 반영되었다:

- **구조체 배열**: `overflowChildBounds: BoundingBox[]` 대신 구조체 배열로 타입 개선
- **리터럴 유니온**: overflow 값 타입에 `"visible" | "hidden" | "scroll" | "auto" | "clip"` 리터럴 유니온 적용
- **`getCachedChildOverflowContextMap` 캐싱**: `getCachedOverflowInfoMap()` 패턴을 `getCachedChildOverflowContextMap()`으로 명명, registryVersion + pagePosVersion 기반 모듈 캐시 유지

### BodyLayer 특수 처리

`BodyLayer`에 `clipChildren` 속성이 추가되었다. body 요소는 일반 컨테이너와 달리 페이지 루트로서 특수 처리가 필요하다.

- `renderCommands.ts`: `clipChildren`이 설정된 경우 `skiaData` 원본 크기를 그대로 사용
- `skiaTreeBuilder.ts`: `adoptSiblingsIntoClipBody` 후처리를 통해 body의 clip 영역에 형제 노드를 포함시킴
