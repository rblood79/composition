# ADR-009: Figma-Class Rendering & Layout Architecture

## Status

Superseded by [ADR-900](900-unified-skia-rendering-engine.md) — 2026-04-08

PixiJS 씬 그래프(Phase 0~2 전제)가 ADR-900 Phase 8-9에서 완전 제거됨. Taffy WASM 레이아웃(Phase 0, PersistentTaffyTree)은 ADR-900 Phase 10(Rust Layout)으로 교체 예정. Phase 5 OffscreenCanvas Worker는 미구현 상태로 종료.

구현 완료 항목(Phase 0~4): TypedArray Binary Protocol, Flat Render List(renderCommands.ts), R-tree Viewport Culling(spatialIndex.ts), Layout Worker(layoutWorker.ts + LayoutScheduler.ts) — 코드베이스에 잔존하나 ADR-900 전환 완료 시 제거 대상.

## Date

2026-02-27 (최종 업데이트: 2026-03-06)

## Decision Makers

composition Team

---

## Executive Summary

composition의 렌더링/레이아웃 파이프라인을 엔터프라이즈 CMS 빌더 수준(1,500~5,000 요소, 15~20 레벨 깊이)에서 **60fps를 안정적으로 유지**하도록 6단계(Phase 0~5)로 최적화한다.

핵심 전략:

0. **Taffy 단일 엔진 통합 (Dropflow 제거)** -- Block/inline-block을 Taffy로 통합, 하이브리드 순환 의존성 제거
1. **Full-Tree WASM Layout** -- 레벨별 독립 Taffy 호출을 단일 호출로 통합
2. **Persistent Taffy Tree + Incremental Layout** -- 매번 clear/재구축 대신 트리 유지 + dirty 서브트리만 재계산
3. **Binary Protocol (TypedArray)** -- JSON 직렬화 제거, WASM 경계 제로카피
4. **Flat Render List + Depth Sort** -- 트리 순회 대신 플랫 배열로 Skia 렌더링
5. **Element-Level Viewport Culling (R-tree)** -- 페이지 단위에서 요소 단위로 세분화
6. **OffscreenCanvas Worker Rendering** -- 렌더링을 Worker로 분리하여 메인 스레드 UI 응답성 보장

---

## Context: 현재 아키텍처 심층 분석

### 현재 렌더링 파이프라인

```
[사용자 편집]
  → Zustand State Update (elementsMap, childrenMap)
  → React Re-render (BuilderCanvas → ElementsLayer)
  → @pixi/react Reconciler → PixiJS Scene Graph 갱신 (alpha=0)
  → 레벨별 calculateChildrenLayout()
      → 각 레벨: enrichment → TaffyStyle 변환 → JSON.stringify
      → WASM: create_node() × N → create_node_with_children() → compute_layout() → get_layouts_batch()
      → WASM: clear()
      → 다음 레벨 반복...
  → DirectContainer x/y/width/height 배치
  → elementRegistry.updateElementBounds() → notifyLayoutChange()
  → SkiaOverlay: registryVersion 변경 감지
  → buildSkiaTreeHierarchical(): PixiJS Scene Graph DFS → SkiaNodeData 트리 구성
  → SkiaRenderer.renderContent(): Skia 트리 DFS → CanvasKit 드로콜
  → contentSurface → snapshot → mainSurface blit + overlay
```

### 병목 지점 정량 분석 (1,500 요소 / 15 레벨 시나리오)

| 병목                                                                  | 현재 비용          | 프레임 예산(16ms) 대비     | 원인                                                   |
| --------------------------------------------------------------------- | ------------------ | -------------------------- | ------------------------------------------------------ |
| **레이아웃 전체** (WASM 횡단 + JSON 직렬화 + enrichment + Taffy 계산) | ~1,650회 WASM 호출 | **~50ms**                  | 레벨별 create_node, JSON.stringify, clear/rebuild 누적 |
| **React 리렌더 전파**                                                 | O(N) cascading     | ~5ms                       | DirectContainer props chain                            |
| **Skia 트리 구축**                                                    | O(N) DFS           | ~3ms                       | buildSkiaTreeHierarchical                              |
| **Skia 트리 렌더링**                                                  | O(N) DFS           | ~3ms                       | renderNode 재귀                                        |
| **합계**                                                              |                    | **~61ms (3.8x 예산 초과)** | 레이아웃이 지배적                                      |

> 레이아웃 ~50ms 내역: JSON 직렬화 ~15ms + WASM 경계 오버헤드(횡단당 ~6μs × 1,650 = ~10ms) + Taffy clear/재구축 15회 ~8ms + enrichWithIntrinsicSize/calculateContentHeight ~17ms

### Figma와의 구조적 차이

```
Figma:                              composition (현재):
┌──────────────────┐               ┌──────────────────────────────┐
│   C++/WASM       │               │  TypeScript (React)           │
│   ┌────────────┐ │               │  ┌──────────────────────────┐ │
│   │ Layout     │ │               │  │ React Component Tree     │ │
│   │ (전체 트리  │ │               │  │   └→ @pixi/react          │ │
│   │  단일 패스) │ │               │  │       └→ PixiJS Scene     │ │
│   ├────────────┤ │               │  │           └→ DFS traverse  │ │
│   │ Render     │ │               │  │               └→ Skia     │ │
│   │ (타일 GPU) │ │               │  └──────────────────────────┘ │
│   └────────────┘ │               │        ↕ JSON 직렬화           │
│   직접 메모리     │               │  ┌──────────────────────────┐ │
│   참조 (0 copy)  │               │  │ Taffy WASM (레벨별 호출)   │ │
└──────────────────┘               │  └──────────────────────────┘ │
                                   └──────────────────────────────┘
```

Figma는 렌더링 + 레이아웃이 **단일 WASM 바이너리** 내에서 직접 메모리를 참조한다. composition는 TS↔WASM 경계를 수천 번 넘나들며 JSON 직렬화/역직렬화를 반복한다. 또한 Block 레이아웃이 JS(Dropflow)로 분리되어 있어 WASM 단일 호출 최적화가 불가능하다. 이 구조적 차이가 성능 격차의 근본 원인이다.

> **Foundation 단계에서 Dropflow를 제거하고 Taffy Block으로 통합하면**, 모든 레이아웃이 WASM 내부에서 처리되어 Figma와 동일한 "단일 WASM 레이아웃" 패턴이 가능해진다.

### 리서치 기반 핵심 발견

| 출처                              | 핵심 인사이트                                         | composition 적용            |
| --------------------------------- | ----------------------------------------------------- | --------------------------- |
| **Figma**                         | 전체 트리 단일 패스 Auto Layout, 타일 기반 GPU 렌더러 | Phase 0-1: Full-Tree Layout |
| **Taffy mark_dirty()**            | 트리 유지 + dirty 노드만 재계산 → 17초→3ms            | Phase 1: Persistent Tree    |
| **Chrome LayoutNG**               | 불변 fragment tree + ConstraintSpace 캐시 키          | Phase 1: Layout Result 캐싱 |
| **Chrome Property Trees**         | transform/clip/effect 분리 → 독립 무효화              | Phase 3: Property 분리 검토 |
| **Flutter Relayout Boundary**     | dirty 노드만 방문 O(변경 노드 수)                     | Phase 1: Subtree Relayout   |
| **Unity Render Queue**            | Scene Graph → 플랫 리스트 → state sort → GPU batch    | Phase 3: Flat Render List   |
| **@antv/layout-wasm**             | SharedArrayBuffer + Atomics → 17x 성능                | Phase 2: Binary Protocol    |
| **RBush R-tree**                  | viewport culling O(n)→O(log n), 30x 개선              | Phase 4: Element Culling    |
| **PLDI 2025 Spineless Traversal** | min-heap dirty 노드 처리 1.80x 향상                   | Phase 1: 영감 참조          |
| **OffscreenCanvas**               | 렌더링 Worker 분리 → 메인 스레드 응답성 보장          | Phase 5: Worker Rendering   |
| **Skia Graphite (WebGPU)**        | CanvasKit WebGPU 백엔드, Apple Silicon 기본 활성화    | 미래 대비 (Phase 5+)        |
| **Pencil App**                    | 순수 JS 3-pass 전체 트리 레이아웃 + 노드별 dirty flag | Phase 0-1 설계 참조         |

---

## Decision

Foundation + 6-Phase 점진적 마이그레이션으로 Figma-class 렌더링/레이아웃 아키텍처를 달성한다. Foundation(Dropflow 제거)은 Phase 0의 전제조건이며, 각 Phase는 독립적으로 배포 가능하고 feature flag로 기존 코드와 병행 운영한다.

### 목표 아키텍처 (Phase 5 완료 시)

```
[사용자 편집]
  → Zustand Atomic Update
  → Dirty Flag Propagation (O(1) mark)
  → Layout Scheduler:
      if (dirty subtree only) → Taffy.mark_dirty() + compute_layout()  ← O(변경 노드 수)
      else                    → build_tree_batch() + compute_layout()  ← O(N) but 1 call
  → Binary Layout Result (SharedArrayBuffer, zero-copy)
  → Flat Render List (depth-sorted, viewport-culled via R-tree)
  → OffscreenCanvas Worker:
      Skia Sequential Draw Calls (플랫 리스트 순서)
      → contentSurface → snapshot blit
  → Main Thread: overlay only (Selection, AI Effects, Grid)
```

---

## Foundation: Taffy 단일 엔진 통합 (Dropflow 제거)

> Phase 0의 전제조건. Dropflow/Taffy 하이브리드가 만드는 block↔flex 순환 크기 의존성을 제거하여 "단일 WASM 호출" 목표를 가능하게 한다.

### 배경: Dropflow 도입 이유와 제거 결정 근거

008-layout-engine.md에서 Strategy A(Taffy 단독)를 기각한 이유는 **"IFC(Inline Formatting Context) 갭이 너무 크다"**였다.
그러나 분석 결과, Dropflow 도입을 정당화한 IFC 기능(layout-text.ts 833 LOC, canvaskit-shaper.ts 504 LOC)은 **0% 사용률** — 한 번도 활성화된 적이 없다.

```
Dropflow Fork 전체: 5,717 LOC
├── 실제 사용 코드: ~1,100-1,500 LOC (20-26%)
│   ├── composition-adapter.ts: buildBoxTree → prelayout → layoutBlockLevelBox → BFC.finalize → extractResults
│   └── layout-flow.ts: BFC, margin collapse, block stacking
│
└── 미사용 코드 (0% 사용률): ~4,000 LOC (74-80%)
    ├── layout-text.ts (833 LOC): IFC 텍스트 레이아웃 — 한 번도 활성화 안 됨
    ├── canvaskit-shaper.ts (504 LOC): CanvasKit 텍스트 셰이핑 — 한 번도 활성화 안 됨
    └── float 관련 (300 LOC): CSS float — 한 번도 활성화 안 됨
```

**실제 사용되는 기능**(block stacking, margin collapse, BFC)은 모두 **Taffy 0.9 Block 모드**에서 네이티브 지원된다.

### Taffy Block 지원 현황

`taffy_bridge.rs`에 `Display::Block`이 이미 매핑되어 있고, Cargo.toml에서 `block_layout` feature가 활성 상태다.

```
taffy_bridge.rs:  "block" => Display::Block  ← 이미 존재
Cargo.toml:       features = ["block_layout"]  ← 이미 활성
block_layout.rs:  626 lines, 14 tests          ← 이미 존재하지만 미사용
```

`block_layout.rs`가 이미 구현하는 기능:

- 수직 블록 스태킹 (vertical stacking)
- 마진 콜랩스 (positive/negative/mixed)
- BFC (Block Formatting Context)
- inline-block 수평 배치 + 줄 바꿈
- vertical-align
- fit-content

### F-A: TaffyBlockEngine 생성

```typescript
// engines/TaffyBlockEngine.ts (신규 — BaseTaffyEngine 패턴 계승)

export class TaffyBlockEngine extends BaseTaffyEngine {
  readonly displayType = "block";

  protected buildTaffyStyle(
    element: Element,
    computed: ComputedStyle,
    childDisplays: string[],
  ): TaffyStyle {
    const display = element.props?.style?.display ?? "flex"; // composition 기본값: flex
    const taffyConfig = toTaffyDisplay(display, childDisplays);
    return {
      ...applyCommonTaffyStyle(element, computed),
      display: taffyConfig.taffyDisplay,
      flexDirection: taffyConfig.flexDirection,
      flexWrap: taffyConfig.flexWrap,
      alignItems: taffyConfig.alignItems,
    };
  }
}
```

### F-B: `taffyDisplayAdapter.ts` — CSS Block Layout 시뮬레이션 단일 소스

> **구현 완료** (2026-02-28). 파일: `engines/taffyDisplayAdapter.ts`

CSS 표현(style panel, CSS export, Preview)은 원본 `display` 값을 유지하고, **Taffy 엔진 레이어에서만** 내부 변환을 적용한다.

Dropflow(DropflowBlockEngine.ts)가 네이티브로 처리하던 CSS Block Layout 패턴을 Taffy flex 시뮬레이션으로 통합한 **단일 소스 모듈**이다.

#### Dropflow에서 포팅한 패턴

| CSS Block Layout 패턴                    | Dropflow 원본                      | taffyDisplayAdapter 시뮬레이션                       |
| ---------------------------------------- | ---------------------------------- | ---------------------------------------------------- |
| inline-block 가로 배치 + 줄바꿈          | `layoutInlineRun()`                | `INLINE_BLOCK_PARENT_CONFIG`: flex row wrap          |
| vertical-align: middle (Button/Badge 등) | `VERTICAL_ALIGN_MIDDLE_TAGS`       | `alignItems: 'center'` (대다수 UI 컴포넌트가 middle) |
| line box 상단 쌓임                       | `layoutInlineRun()` pass 2         | `alignContent: 'flex-start'`                         |
| block 자식 자동 width:100%               | `segmentChildren()` block 세그먼트 | `needsBlockChildFullWidth()` 판별 함수               |
| CSS Blockification (flex/grid 자식)      | CSS Display Level 3 명세           | `blockifyDisplay()` 변환 함수                        |
| inline-block 태그 기본값                 | `isInlineBlockElement()`           | `getElementDisplay()` (INLINE_BLOCK_TAGS 기반)       |

```typescript
// engines/taffyDisplayAdapter.ts

export interface TaffyDisplayConfig {
  taffyDisplay: "flex" | "block" | "grid" | "none";
  flexDirection?: "row" | "column";
  flexWrap?: "nowrap" | "wrap";
  alignItems?: string;
  alignContent?: string; // CSS line box 상단 쌓임 시뮬레이션
  flexGrow?: number;
  flexShrink?: number;
}

// Dropflow VERTICAL_ALIGN_MIDDLE_TAGS 포팅
export const VERTICAL_ALIGN_MIDDLE_TAGS: ReadonlySet<string>;

// CSS Display Level 3 Blockification
export function blockifyDisplay(display: string): string;

// INLINE_BLOCK_TAGS 기반 display 기본값 결정
export function getElementDisplay(element): string;

// inline-level display 판별
export function isInlineLevel(display: string): boolean;

// block 자식 width:100% 필요 여부 판별
export function needsBlockChildFullWidth(
  childDisplay: string,
  childWidth: unknown,
): boolean;

// 메인 변환 함수
export function toTaffyDisplay(
  display: string,
  childDisplays: string[],
): TaffyDisplayConfig;
```

**핵심 원칙: Presentation vs Implementation 분리**

Taffy 변환은 **2단계**로 동작한다:

1. **inline-block 자식 자체** → `display: block` + `flexGrow: 0, flexShrink: 0` (크기 고정 블록 리프)
2. **inline-block 자식을 가진 block 부모** → `display: flex, flexDirection: row, flexWrap: wrap, alignItems: center, alignContent: flex-start` (수평 배치 + 줄 바꿈 + 세로 가운데 정렬 + 상단 쌓임)

즉, 변환은 부모-자식 쌍에서 발생하며, "inline-block → flex-wrap"이 아니라 "부모가 flex-wrap, 자식이 block 리프"로 분리된다.

| 레이어           | inline-block **자식**       | inline-block 자식을 가진 **부모**              |
| ---------------- | --------------------------- | ---------------------------------------------- |
| Style Panel      | `inline-block` 표시         | `block` 표시                                   |
| CSS Export       | `display: inline-block`     | `display: block`                               |
| Preview (iframe) | 브라우저 네이티브 처리      | 브라우저 네이티브 처리                         |
| **Taffy 엔진**   | `block` 리프 (flex-grow: 0) | `flex row wrap` (center 정렬, flex-start 쌓임) |

### F-C: `selectEngine()` 라우팅 변경

```typescript
// engines/index.ts

export function selectEngine(display: string): LayoutEngine {
  switch (display) {
    case "flex":
    case "inline-flex":
      return TaffyFlexEngine;
    case "grid":
    case "inline-grid":
      return TaffyGridEngine;
    case "block":
    case "inline-block":
    case "flow-root":
    case "inline":
      return TaffyBlockEngine; // ← Dropflow → Taffy 전환
    default:
      return TaffyBlockEngine; // ← 폴백도 Taffy
  }
}
```

### F-D: Dropflow 제거 범위

```
제거 대상 (~5,700 LOC):
├── packages/layout-flow/             (전체 패키지)
│   ├── layout-flow.ts     (1,631 LOC)
│   ├── composition-adapter.ts   (883 LOC)
│   ├── layout-text.ts       (833 LOC)
│   ├── layout-box.ts        (775 LOC)
│   ├── style.ts             (518 LOC)
│   ├── canvaskit-shaper.ts  (504 LOC)
│   └── 기타                  (573 LOC)
├── engines/DropflowBlockEngine.ts    (545 LOC)
└── 관련 import/reference 정리
```

### Foundation 예상 효과

| 지표                   | 변경 전 (하이브리드)                             | 변경 후 (Taffy 단일)                              |
| ---------------------- | ------------------------------------------------ | ------------------------------------------------- |
| 레이아웃 엔진 수       | **3** (Taffy Flex + Taffy Grid + Dropflow Block) | **3** (Taffy Flex + Taffy Grid + **Taffy Block**) |
| WASM 경계 일관성       | 혼합 (WASM + JS)                                 | **100% WASM**                                     |
| block↔flex 순환 의존성 | 있음 (Phase 0 단일 호출 불가능)                  | **제거됨**                                        |
| 코드량                 | +5,700 LOC (Dropflow)                            | **-5,700 LOC**                                    |
| Full-Tree 단일 호출    | 불가능 (Block 사전 계산 필요)                    | **가능**                                          |

### Foundation 리스크

| 리스크                               | 심각도 | 완화 전략                                                                                         |
| ------------------------------------ | ------ | ------------------------------------------------------------------------------------------------- |
| Taffy Block의 margin collapse 정확도 | 중간   | block_layout.rs에 14개 테스트 존재 + 추가 테스트 보강                                             |
| inline-block → flex wrap 변환 정확도 | 중간   | 62개 Spec pixel-diff 테스트로 회귀 검증                                                           |
| Dropflow에만 있던 edge case          | 낮음   | Dropflow 실사용 코드 ~1,100 LOC 중 block stacking + margin collapse만 해당, 모두 Taffy Block 지원 |
| CSS 정합성 하락 (96% → ?)            | 중간   | Feature flag 병행 운영 + A/B 비교 후 전환                                                         |

### 근거: Strategy 비교

Strategy A/B/C 종합 평가 (5점 만점):

| 평가 항목      | A: Taffy 통합 | B: Rust 포팅 | C: MeasureFunction 래핑 |
| -------------- | :-----------: | :----------: | :---------------------: |
| ADR-009 달성도 |    **5.0**    |     4.0      |           1.5           |
| 유지보수성     |    **5.0**    |     2.5      |           3.0           |
| 성능           |    **5.0**    |     4.5      |           1.5           |
| CSS 정확도     |   3.5→4.0+    |   **4.5**    |           2.0           |
| 미래 확장성    |    **5.0**    |     3.0      |           1.5           |
| **종합**       |   **4.55**    |     3.35     |          2.00           |

---

## Phase 0: Full-Tree WASM Layout (Batch Build)

> Foundation(Taffy 단일 엔진)을 기반으로, 레벨별 독립 Taffy 호출을 단일 호출로 통합. 가장 즉시적이고 영향력 큰 최적화.

### 0-A: Rust `build_tree_batch()` API

```rust
// taffy_bridge.rs 추가

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BatchNodeInput {
    style: StyleInput,
    /// batch 배열 내 자식 노드 인덱스 (topological order: 리프 먼저)
    children: Vec<usize>,
}

#[wasm_bindgen]
impl TaffyLayoutEngine {
    /// 전체 트리를 한 번에 빌드.
    ///
    /// 입력: JSON 배열 (topological order -- 리프 먼저, 루트 마지막)
    /// 반환: 각 노드의 handle (입력 인덱스와 1:1 대응)
    ///
    /// 기존 개별 create_node() 호출 대비:
    /// - WASM 경계 횡단: N회 → 1회
    /// - JSON 파싱: N회 → 1회 (단일 serde_json::from_str)
    /// - Vec 할당: N회 → 1회 (사전 capacity 할당)
    /// 에러 정책: JSON 파싱 실패 또는 노드 생성 실패 시 JsValue 에러를 반환한다.
    /// 개별 child index 범위 초과는 에러로 처리한다 (silent drop 금지).
    pub fn build_tree_batch(&mut self, nodes_json: &str) -> Result<Box<[usize]>, JsValue> {
        let nodes: Vec<BatchNodeInput> = serde_json::from_str(nodes_json)
            .map_err(|e| JsValue::from_str(&format!("batch parse error: {e}")))?;
        let mut handles = Vec::with_capacity(nodes.len());

        for (i, node) in nodes.iter().enumerate() {
            let style = convert_style(&node.style);
            let mut child_ids: Vec<NodeId> = Vec::with_capacity(node.children.len());
            for &idx in &node.children {
                let handle = handles.get(idx)
                    .ok_or_else(|| JsValue::from_str(
                        &format!("node[{i}]: child index {idx} out of range (max={})", handles.len())
                    ))?;
                let node_id = self.resolve(*handle)
                    .ok_or_else(|| JsValue::from_str(
                        &format!("node[{i}]: child handle {handle} resolved to None")
                    ))?;
                child_ids.push(node_id);
            }

            let node_id = if child_ids.is_empty() {
                self.tree.new_leaf(style)
            } else {
                self.tree.new_with_children(style, &child_ids)
            }.map_err(|e| JsValue::from_str(&format!("node[{i}]: taffy error: {e:?}")))?;

            handles.push(self.alloc_handle(node_id));
        }

        Ok(handles.into_boxed_slice())
    }
}
```

### 0-B: TypeScript `calculateFullTreeLayout()`

> **구현 완료** (2026-02-28). 파일: `engines/fullTreeLayout.ts`

설계 대비 실제 구현 차이:

| 설계 (ADR 원안)                          | 실제 구현                                       | 이유                                                                                  |
| ---------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| `elementToUnifiedTaffyStyle()` 단일 함수 | `buildNodeStyle()` display별 분기               | flex/grid/block 각 엔진의 기존 변환 함수 재사용                                       |
| `ComputedLayout`에 margin 없음           | `margin` 필드 포함                              | DropflowBlockEngine과 결과 호환 필요                                                  |
| `finally { taffy.clear() }`              | 제거 (Phase 1 persistent tree)                  | Phase 1까지 선행 구현                                                                 |
| `traverse()` 단일 함수                   | `traversePostOrder()` + `buildNodeStyle()` 분리 | CSS Blockification, available size 전파, block 자식 width:100% 주입 등 추가 처리 필요 |

`buildNodeStyle()` 분기 구조:

```
display 분기:
├── flex / inline-flex  → elementToTaffyStyle() (TaffyFlexEngine)
├── grid / inline-grid  → applyCommonTaffyStyle() 기반 간소화 경로
└── block 계열          → toTaffyDisplay() + elementToTaffyBlockStyle()
                          (taffyDisplayAdapter가 모든 시뮬레이션 규칙 포함,
                           elementToTaffyBlockStyle이 TaffyDisplayConfig 전체 필드 패스스루)
```

`traversePostOrder()` 추가 처리:

- CSS Blockification: 부모가 flex/grid면 `blockifyDisplay()` 적용
- 자식 available size 추정: `estimateChildAvailableSize()` → 재귀 전달
- block→flex-row-wrap 시 block 자식 width:100% 주입: `needsBlockChildFullWidth()` 사용

### 0-C: BuilderCanvas 통합 (Feature Flag)

> **구현 완료** (2026-02-28). 파일: `BuilderCanvas.tsx`

실제 구현에서는 layout 계산과 렌더 트리 구성을 **별도 useMemo**로 분리하여 React pure 함수 원칙을 유지한다:

```typescript
// 1단계: layout 계산 전용 useMemo (side effect 격리)
const fullTreeLayoutMap = useMemo(() => {
  if (!isFullTreeLayoutEnabled() || !bodyElement || !_wasmLayoutReady) return null;
  const result = calculateFullTreeLayout(...);
  publishLayoutMap(result);  // 전역 공유 (SkiaOverlay 참조용)
  return result;
}, [bodyElement, elementById, pageChildrenMap, pageWidth, pageHeight, _wasmLayoutReady]);

// 2단계: renderedTree는 fullTreeLayoutMap만 참조 (side effect 없음)
const renderedTree = useMemo(() => {
  return renderTree(bodyElement?.id ?? null);
}, [fullTreeLayoutMap, pageChildrenMap, renderIdSet, ...]);
```

Feature flag: `VITE_USE_FULL_TREE_LAYOUT=true` (환경변수 기반)

### Phase 0 예상 효과

| 지표                        | 현재 (Level-by-Level) | Phase 0 (Full-Tree)            | 개선            |
| --------------------------- | --------------------- | ------------------------------ | --------------- |
| WASM 경계 횡단 (100 요소)   | ~110회                | **3회**                        | **97% 감소**    |
| WASM 경계 횡단 (1,500 요소) | ~1,650회              | **3회**                        | **99.8% 감소**  |
| JSON 직렬화 횟수            | N회 (노드별)          | **1회** (배치)                 | **99%+ 감소**   |
| compute_layout 호출         | ~15회 (레벨당)        | **1회**                        | **93% 감소**    |
| Cross-level flex/block 전파 | 불가 (하이브리드)     | **Taffy 네이티브 (단일 엔진)** | 정확도 향상     |
| 레이아웃 시간 (1,500 요소)  | **50~100ms**          | **5~15ms**                     | **80~90% 감소** |

### Phase 0 리스크

| 리스크                              | 심각도 | 완화 전략                                         |
| ----------------------------------- | ------ | ------------------------------------------------- |
| enrichWithIntrinsicSize 2-pass 문제 | 높음   | 기존 enrichment 로직 유지 + 단계적 simplification |
| calculateContentHeight 30 브랜치    | 높음   | Taffy 네이티브 크기 계산으로 단계적 대체          |
| JSON 배치 크기 (1,500 노드)         | 중간   | 프로파일링 후 Phase 2에서 Binary Protocol 전환    |
| Feature flag 병행 운영 복잡도       | 낮음   | 페이지 단위 전환, 기존 API 변경 없음              |

### Phase 0 업데이트 (2026-03-01): CSS 일반 규칙 적용

Phase 0 구현 이후 `fullTreeLayout.ts`에서 식별된 세 가지 CSS 규칙 위반을 수정하고 일반화하였다.

#### P0-U1: CSS `height: auto` 네이티브 계산

**문제**: `enrichWithIntrinsicSize`가 컨테이너 노드에도 계산된 높이를 주입하여 Taffy의 auto 크기 계산을 방해했다. 결과적으로 자식이 있는 컨테이너(예: Tabs)가 예상보다 큰 높이를 반환했다(228px vs. 레거시 기대값 166px).

**근본 원인**: enrichment 로직이 `height: auto` 의미를 위반한다. CSS 명세 상 `height: auto`인 컨테이너는 자식의 높이 합산으로 계산되어야 하며, Taffy는 이를 내부에서 정확히 처리한다. 외부에서 높이를 주입하면 Taffy의 계산 결과가 override된다.

**결정**: `hasTaffyChildren` 단일 조건으로 컨테이너/리프를 분기한다.

```typescript
// engines/fullTreeLayout.ts — enrichWithIntrinsicSize 호출 시
const hasTaffyChildren = (childrenMap.get(element.id) ?? []).length > 0;

if (hasTaffyChildren) {
  // 컨테이너: height 주입 금지 — Taffy가 자식 합산으로 auto 계산
  enrichedStyle = { ...style }; // height 필드 미포함
} else {
  // 리프: 기존 enrichment + calculateContentHeight 보완
  enrichedStyle = enrichWithIntrinsicSize(element, style, availableSize);
}
```

**결과**: 모든 컨테이너 요소가 자식 높이를 Taffy 네이티브로 계산하여 CSS 명세에 부합한다. 기존 리프(text, heading 등) 동작은 변경 없다.

#### P0-U2: Flex Item 속성 일반화

**문제**: `display: block` 요소가 `display: flex` 부모 안에 배치될 때 `flex: 1`, `flexGrow`, `flexBasis` 등의 flex item 속성이 무시되었다.

**근본 원인**: `elementToTaffyBlockStyle()`이 CSS flex shorthand를 파싱하지 않았다. CSS 명세(CSS Flexbox Level 1)에 따르면 flex/grid 컨테이너의 **모든 직계 자식**은 자신의 `display` 값과 무관하게 flex/grid item으로 동작하며 flex item 속성을 적용받아야 한다.

**결정**: `applyFlexItemProperties()` 공유 유틸을 추출하고, `buildNodeStyle()`에 `parentDisplay` 컨텍스트를 전달하여 부모가 flex/grid일 때 block 자식에도 flex item 속성을 적용한다.

```typescript
// engines/fullTreeLayout.ts

function applyFlexItemProperties(
  style: TaffyStyle,
  element: Element,
  parentDisplay: string,
): TaffyStyle {
  // CSS 명세: flex/grid 컨테이너의 모든 직계 자식은 flex/grid item
  if (parentDisplay !== 'flex' && parentDisplay !== 'inline-flex'
      && parentDisplay !== 'grid' && parentDisplay !== 'inline-grid') {
    return style;
  }

  const raw = element.props?.style ?? {};

  // flex shorthand 파싱: "1", "1 1 auto", "0 0 200px" 등
  const flex = raw.flex;
  if (typeof flex === 'string' || typeof flex === 'number') {
    const parts = String(flex).trim().split(/\s+/);
    const grow = parseFloat(parts[0]);
    if (!isNaN(grow)) style = { ...style, flexGrow: grow };
    if (parts[1]) {
      const shrink = parseFloat(parts[1]);
      if (!isNaN(shrink)) style = { ...style, flexShrink: shrink };
    }
    if (parts[2]) {
      style = { ...style, flexBasis: parseDimension(parts[2]) };
    }
  }

  // 개별 속성 (shorthand보다 우선순위 낮음, 미지정 시에만 적용)
  if (raw.flexGrow != null) style = { ...style, flexGrow: Number(raw.flexGrow) };
  if (raw.flexShrink != null) style = { ...style, flexShrink: Number(raw.flexShrink) };
  if (raw.flexBasis != null) style = { ...style, flexBasis: parseDimension(raw.flexBasis) };
  if (raw.alignSelf != null) style = { ...style, alignSelf: raw.alignSelf };

  return style;
}

// buildNodeStyle() 내부에서 parentDisplay 전달
function buildNodeStyle(
  element: Element,
  availableSize: AvailableSize,
  parentDisplay: string,   // ← 신규 파라미터
): TaffyStyle {
  const baseStyle = /* 기존 display 분기 */;
  return applyFlexItemProperties(baseStyle, element, parentDisplay);
}
```

**결과**: block/inline-block 요소가 flex 컨테이너 안에서 `flex: 1`로 남은 공간을 채우는 패턴이 정확히 동작한다.

#### P0-U3: 누락 속성 보완

**문제**: `applyCommonTaffyStyle()`과 Grid 경로에서 일부 CSS 속성이 Taffy에 전달되지 않았다.

**결정**: 다음 속성을 추가 매핑한다.

| 속성                                        | 추가 위치               | 이유                                                 |
| ------------------------------------------- | ----------------------- | ---------------------------------------------------- |
| `overflow`, `overflowX`, `overflowY`        | `applyCommonTaffyStyle` | Taffy scroll container 크기 계산에 필요              |
| `aspectRatio`                               | `applyCommonTaffyStyle` | 이미지/비디오 요소 크기 계산                         |
| `position`, `inset` (top/right/bottom/left) | Grid 경로               | 절대 배치 자식이 Grid 안에서 동작하지 않던 버그 수정 |

```typescript
// engines/fullTreeLayout.ts — applyCommonTaffyStyle 추가 부분

// overflow
const overflow = style.overflow ?? style.overflowX ?? "visible";
const overflowY = style.overflowY ?? overflow;
taffyStyle.overflow = {
  x: toTaffyOverflow(overflow),
  y: toTaffyOverflow(overflowY),
};

// aspectRatio
if (style.aspectRatio != null) {
  const ratio = parseAspectRatio(style.aspectRatio); // "16 / 9" → 1.777...
  if (ratio > 0) taffyStyle.aspectRatio = ratio;
}

// Grid 경로: position + inset
if (parentDisplay === "grid" || parentDisplay === "inline-grid") {
  if (style.position === "absolute") {
    taffyStyle.position = "absolute";
    taffyStyle.inset = {
      top: parseDimension(style.top),
      right: parseDimension(style.right),
      bottom: parseDimension(style.bottom),
      left: parseDimension(style.left),
    };
  }
}
```

#### P0-U4: Padding 이중 적용 수정 (2026-03-02)

**문제**: fullTreeLayout 활성 시 부모 요소에 padding을 설정하면 자식의 hit area(선택 영역)가 시각적 렌더링 위치보다 padding만큼 더 이동하여 불일치가 발생했다.

**근본 원인**: Taffy WASM의 `layout.location`은 부모의 **border-box** 기준 좌표를 반환한다. 즉, 자식의 `location.x`에 부모의 `padding + border` 오프셋이 이미 포함되어 있다. 그러나 BuilderCanvas의 세 곳에서 이 오프셋을 수동으로 추가하여 이중 적용되었다.

| 위치                                           | per-level 엔진   | fullTreeLayout            |
| ---------------------------------------------- | ---------------- | ------------------------- |
| `contentOffsetX/Y` (body)                      | border + padding | **0** (Taffy가 이미 포함) |
| `paddingOffsetX/Y` (renderWithCustomEngine)    | padding          | **0**                     |
| `cachedPadding` (createContainerChildRenderer) | padding          | **0**                     |

**per-level 엔진과의 차이**: per-level 엔진은 `setupParentDimensions()`로 부모 Taffy 노드의 padding/border를 0으로 리셋한다. 따라서 Taffy가 반환하는 자식 위치에 padding이 포함되지 않으며, BuilderCanvas에서 수동 오프셋이 필요하다.

**결정**: `fullTreeLayoutMap` 존재 여부로 분기하여, fullTreeLayout 활성 시 모든 수동 padding/border 오프셋을 0으로 설정한다.

```typescript
// BuilderCanvas.tsx — body 자식 위치 오프셋
const contentOffsetX = fullTreeLayoutMap
  ? 0
  : bodyBorder.left + bodyPadding.left;
const contentOffsetY = fullTreeLayoutMap ? 0 : bodyBorder.top + bodyPadding.top;

// renderWithCustomEngine — 비-body 부모 자식 위치
const paddingOffsetX =
  isBodyParent || fullTreeLayoutMap ? 0 : parentPadding.left;

// createContainerChildRenderer — 중첩 컨테이너 자식 위치
if (fullTreeLayoutMap) {
  cachedLayoutMap = fullTreeLayoutMap;
  // cachedPadding = {0,0,0,0} (기본값 유지)
} else {
  cachedPadding = parsePadding(parentStyle, containerWidth);
}
```

**핵심 원칙**: Taffy `layout.location` = 부모 border-box 기준 좌표 (padding + border 포함). fullTreeLayout은 Taffy의 좌표를 그대로 사용하고, per-level은 수동 오프셋으로 보정한다.

#### P0-U5: Implicit Child Style Override 패치 (2026-03-02)

**문제**: `applyImplicitStyles()`가 실제 자식 요소의 스타일을 변경(예: Checkbox→Label에 marginLeft 주입, CardHeader→Heading에 flex:1 주입)하더라도, fullTreeLayout DFS post-order에서 자식이 부모보다 먼저 처리되므로 수정된 스타일이 Taffy batch에 반영되지 않았다.

**근본 원인**: DFS post-order 순서:

1. Label 처리 → 원본 스타일로 batch 엔트리 생성 (marginLeft 없음)
2. Checkbox 처리 → `applyImplicitStyles()` → Label에 marginLeft 주입
3. 그러나 Label의 batch 엔트리는 이미 생성됨

**결정**: step 3.5 (synthetic children) 이후에 step 3.6을 추가하여, `applyImplicitStyles`가 수정한 실제 자식의 스타일 변경사항을 `patchBatchStyleFromImplicit()`로 batch 엔트리에 패치한다.

```typescript
// fullTreeLayout.ts — step 3.6
for (const filteredChild of filteredChildren) {
  const batchIdx = indexMap.get(filteredChild.id);
  if (batchIdx === undefined) continue;
  const originalEl = elementsMap.get(filteredChild.id);
  if (!originalEl) continue;
  // props.style 참조 비교 — 동일하면 applyImplicitStyles가 수정하지 않은 것
  if (filteredChild.props?.style === originalEl.props?.style) continue;
  patchBatchStyleFromImplicit(batch[batchIdx].style, origStyle, modStyle);
}
```

`patchBatchStyleFromImplicit`은 변경된 CSS 속성을 `taffyStyleToRecord` 형식으로 변환하여 patch한다:

- dimension 속성 (`marginLeft`, `width` 등): `number → "${v}px"`, `string → 그대로`
- `flex` shorthand: `flexGrow/flexShrink/flexBasis` 분해
- numeric 속성 (`flexGrow`, `flexShrink`, `order`): `Number(val)`

#### P0-U6: CheckboxGroup/RadioGroup Compositional Architecture (2026-03-02)

**변경**: CheckboxGroup/RadioGroup을 Compositional Architecture로 전환.

**트리 구조**:

```
CheckboxGroup (flex column, gap) → Checkbox (flex row, gap:8) → Label
RadioGroup (flex column, gap) → Radio (flex row, gap:8) → Label
```

**Checkbox/Radio indicator 공간 확보**:

- Indicator는 spec shapes로 렌더링 (Taffy 트리 밖)
- Label 자식에 `marginLeft = indicatorBox + gap`을 주입하여 겹침 방지
- `gap`은 사용자 스타일 패널 값 우선 (`parseFloat(parentStyle.gap)`)
- `paddingLeft` 방식은 fullTreeLayout Taffy + BuilderCanvas cachedPadding 이중 적용 문제로 사용 불가

**INDICATOR_SIZES** (spec shapes 기준):

| size | box  | gap  | indicatorOffset |
| ---- | ---- | ---- | --------------- |
| sm   | 16px | 6px  | 22px            |
| md   | 20px | 8px  | 28px            |
| lg   | 24px | 10px | 34px            |

**Synthetic Label**: 기존 DB 요소(Label 자식 없음)를 위해 `applyImplicitStyles`에서 합성 Label을 생성하고, fullTreeLayout step 3.5에서 Taffy leaf 노드로 추가.

---

## Phase 1: Persistent Taffy Tree + Incremental Layout

> Figma/Chrome LayoutNG의 핵심: 트리를 파괴하지 않고 유지하며, 변경된 부분만 재계산.

### 동기

Phase 0은 매 레이아웃 호출마다 `clear() + build_tree_batch()`로 전체 트리를 재구축한다. 1,500 요소 기준 이 재구축 자체가 ~5ms를 소비한다. Taffy의 `mark_dirty()` + 내부 캐싱을 활용하면 **변경된 서브트리만 재계산하여 O(변경 노드 수)로 줄일 수 있다**.

### 설계

```
[요소 A의 style 변경]
  → PersistentTaffyTree.updateNode(elementId, newStyle)
      → taffy.update_style(handle, styleJson)
      → taffy.mark_dirty(handle)               // 내부 캐시 무효화
  → PersistentTaffyTree.computeLayout(rootHandle)
      → Taffy 내부: dirty 노드와 ancestors만 재방문
      → 변경되지 않은 서브트리: 캐시된 결과 반환 (O(1))
  → getLayoutsBatch(): 전체 노드 결과 수집 (변경분만 diff)
```

### 1-A: Rust API 추가

```rust
#[wasm_bindgen]
impl TaffyLayoutEngine {
    /// 특정 노드를 dirty로 표시하여 다음 compute_layout에서 재계산하도록 한다.
    pub fn mark_dirty(&mut self, handle: usize) {
        if let Some(node_id) = self.resolve(handle) {
            self.tree.mark_dirty(node_id).ok();
        }
    }

    /// 현재 트리의 총 노드 수 (활성 + 비활성 구분)
    pub fn active_node_count(&self) -> usize {
        self.nodes.iter().filter(|n| n.is_some()).count()
    }
}
```

### 1-B: TypeScript `PersistentTaffyTree` 클래스

> **구현 완료** (2026-02-28). 파일: `engines/persistentTaffyTree.ts`

설계 대비 실제 구현 차이:

| 설계 (ADR 원안)                               | 실제 구현                           | 이유                                                 |
| --------------------------------------------- | ----------------------------------- | ---------------------------------------------------- |
| `addNode(id, parentId, style)`                | `addNode(id, styleRecord)`          | 자식 구조 연결은 `updateChildren()`으로 분리         |
| `removeNode(id, parentId)`                    | `removeNode(id)`                    | 부모 children 갱신은 `incrementalUpdate()` 내부 처리 |
| `computeLayout() → Map<string, LayoutResult>` | `computeLayout() → void`            | 결과 수집은 별도 `getLayoutsBatch()` 메서드          |
| `styleCache`: JSON hash                       | `childrenHashMap`: children ID 해시 | 스타일은 항상 갱신, children 변경만 diff 최적화      |

핵심 API (실제 구현):

```typescript
export class PersistentTaffyTree {
  handleMap: Map<string, TaffyNodeHandle>;
  childrenHashMap: Map<string, string>; // children 변경 감지용

  buildFull(
    batch: PersistentBatchNode[],
    filteredChildIds: Map<string, string[]>,
  ): void;
  incrementalUpdate(
    batch: PersistentBatchNode[],
    filteredChildIds: Map<string, string[]>,
  ): void;
  addNode(
    elementId: string,
    styleRecord: Record<string, unknown>,
  ): TaffyNodeHandle;
  removeNode(elementId: string): void;
  updateChildren(elementId: string, childIds: string[]): void;
  computeLayout(availableWidth: number, availableHeight: number): void;
  getLayoutsBatch(): Map<TaffyNodeHandle, LayoutResult>;
}
```

Phase 2 선행 구현: `buildFull()`에서 `hasBinaryProtocol()` 조건 시 `encodeBatchBinary()` + `buildTreeBatchBinary()` binary protocol 경로 사용.

### 1-C: 파이프라인 통합

```
파이프라인 순서 (요소 변경 시):
1. Memory Update (즉시)           -- elementsMap 갱신
2. Index Rebuild (즉시)           -- childrenMap 갱신
3. PersistentTaffyTree.updateNode -- dirty 표시 (O(1))
4. History Record (즉시)
5. Layout Compute (다음 rAF)      -- Taffy dirty 재계산 (O(변경 노드 수))
6. DB Persist (백그라운드)
7. Preview Sync (백그라운드)
```

### Phase 1 예상 효과

| 시나리오                          | Phase 0            | Phase 1                     | 개선                |
| --------------------------------- | ------------------ | --------------------------- | ------------------- |
| 단일 요소 style 변경 (1,500 트리) | ~5ms (전체 재구축) | **~0.5ms** (dirty 1~3 노드) | **90% 감소**        |
| 10개 요소 동시 변경               | ~5ms               | **~1ms**                    | **80% 감소**        |
| 드래그 리사이즈 (연속)            | 매 프레임 5ms      | **매 프레임 0.5ms**         | **체감 FPS 결정적** |
| 페이지 초기 로드                  | ~5ms               | ~5ms (전체 구축 필요)       | 동일                |

### Phase 1 리스크

| 리스크                                  | 심각도 | 완화 전략                                            |
| --------------------------------------- | ------ | ---------------------------------------------------- |
| 트리 동기화 정합성 (add/remove/reorder) | 높음   | elementsMap diff 기반 검증 + fallback (full rebuild) |
| Taffy mark_dirty 범위 과소 추정         | 중간   | 의심스러운 경우 ancestor chain 전체 dirty 표시       |
| 메모리 누수 (handle 미회수)             | 중간   | periodic GC sweep + node_count 모니터링              |

---

## Phase 2: Binary Protocol (TypedArray / SharedArrayBuffer) — ✅ 부분 구현

> JSON 직렬화를 제거하여 WASM 경계 데이터 전송 비용을 원천적으로 제거.
>
> **구현 현황 (2026-03-03 코드 대조 검증)**:
>
> - ✅ `binaryProtocol.ts` (647 LOC): `encodeBatchBinary()` TypedArray 인코더 구현
> - ✅ `binary_protocol.rs`: Rust WASM 디코더 구현
> - ✅ `persistentTaffyTree.ts:124`: `hasBinaryProtocol()` → `buildTreeBatchBinary()` 활성 코드 경로
> - ✅ `taffyLayout.ts:448-462`: TypeScript WASM 래퍼
> - ⏳ SharedArrayBuffer 제로카피: 미구현 (TypedArray 복사 방식만 사용)

### 동기

Phase 0에서 JSON 직렬화는 1,500 노드 기준 ~300KB의 텍스트를 생성한다. 이를 TypedArray 바이너리 프로토콜로 대체하면:

- **데이터 크기**: 300KB → ~64KB (78% 감소)
- **직렬화 시간**: ~3ms → ~0.3ms (90% 감소)
- **SharedArrayBuffer 가용 시**: 제로카피 (0ms)

### 설계: Style Binary Schema

```
노드당 바이너리 레이아웃 (Float32Array, 32 fields = 128 bytes/node):

Offset  Field              Type     Encoding
──────  ─────              ────     ────────
0       display            f32      0=flex, 1=grid, 2=block, 3=none
1       position           f32      0=relative, 1=absolute
2       flexDirection      f32      0=row, 1=column, 2=row-reverse, 3=column-reverse
3       flexWrap           f32      0=nowrap, 1=wrap, 2=wrap-reverse
4       justifyContent     f32      0=start, 1=end, 2=center, 3=space-between, ...
5       alignItems         f32      0=start, 1=end, 2=center, 3=stretch, 4=baseline
6       alignContent       f32      (same encoding as justifyContent)
7       flexGrow           f32      직접 값
8       flexShrink         f32      직접 값
9       flexBasis          f32      px 값 또는 NaN=auto
10      width              f32      px 값, NaN=auto, -1=percent(별도 배열)
11      height             f32      (동일)
12-13   minWidth/minHeight f32      (동일)
14-15   maxWidth/maxHeight f32      (동일)
16-19   margin TRBL        f32      px 값, NaN=auto
20-23   padding TRBL       f32
24-27   border TRBL        f32
28-31   reserved           f32      inset, gap, aspect ratio 등
```

### 2-A: Rust `build_tree_batch_binary()` API

```rust
#[wasm_bindgen]
impl TaffyLayoutEngine {
    /// 바이너리 프로토콜로 전체 트리 빌드.
    ///
    /// style_data: Float32Array (노드당 32 floats)
    /// topology: Uint32Array ([child_count, child_idx_0, child_idx_1, ...] per node)
    /// node_count: 총 노드 수
    ///
    /// 반환: handles (Uint32Array)
    /// Phase 0 build_tree_batch()와 동일한 에러 정책 적용:
    /// - child index 범위 초과 → Result::Err (silent drop 금지)
    /// - 노드 생성 실패 → Result::Err (panic 금지)
    pub fn build_tree_batch_binary(
        &mut self,
        style_data: &[f32],
        topology: &[u32],
        node_count: usize,
    ) -> Result<Box<[usize]>, JsValue> {
        let fields_per_node = 32;
        let expected_len = node_count * fields_per_node;
        if style_data.len() != expected_len {
            return Err(JsValue::from_str(&format!(
                "style_data length mismatch: expected {expected_len}, got {}", style_data.len()
            )));
        }

        let mut handles = Vec::with_capacity(node_count);
        let mut topo_cursor = 0;

        for i in 0..node_count {
            let offset = i * fields_per_node;
            let style = decode_binary_style(&style_data[offset..offset + fields_per_node]);

            let child_count = topology.get(topo_cursor)
                .ok_or_else(|| JsValue::from_str(
                    &format!("node[{i}]: topology cursor {topo_cursor} out of bounds")
                ))? .clone() as usize;
            topo_cursor += 1;

            let mut child_ids: Vec<NodeId> = Vec::with_capacity(child_count);
            for j in 0..child_count {
                let topo_idx = topo_cursor + j;
                let idx = *topology.get(topo_idx)
                    .ok_or_else(|| JsValue::from_str(
                        &format!("node[{i}]: topology index {topo_idx} out of bounds")
                    ))? as usize;
                let handle = handles.get(idx)
                    .ok_or_else(|| JsValue::from_str(
                        &format!("node[{i}]: child index {idx} out of range (max={})", handles.len())
                    ))?;
                let node_id = self.resolve(*handle)
                    .ok_or_else(|| JsValue::from_str(
                        &format!("node[{i}]: child handle resolved to None")
                    ))?;
                child_ids.push(node_id);
            }
            topo_cursor += child_count;

            let node_id = if child_ids.is_empty() {
                self.tree.new_leaf(style)
            } else {
                self.tree.new_with_children(style, &child_ids)
            }.map_err(|e| JsValue::from_str(&format!("node[{i}]: taffy error: {e:?}")))?;

            handles.push(self.alloc_handle(node_id));
        }

        // topology 잔여 데이터 검증 — 프로토콜 드리프트 조기 감지
        if topo_cursor != topology.len() {
            return Err(JsValue::from_str(&format!(
                "topology length mismatch: consumed {topo_cursor}, total {}",
                topology.len()
            )));
        }

        Ok(handles.into_boxed_slice())
    }
}
```

### 2-B: SharedArrayBuffer 제로카피 (Optional)

```typescript
// SharedArrayBuffer 가용 시 (COOP/COEP 헤더 필요)
const sharedBuffer = new SharedArrayBuffer(nodeCount * 32 * 4);
const styleView = new Float32Array(sharedBuffer);

// TS에서 styleView에 직접 쓰기
for (let i = 0; i < nodes.length; i++) {
  encodeStyleBinary(nodes[i].style, styleView, i * 32);
}

// WASM에서 sharedBuffer를 직접 읽기 (복사 없음)
// 레이아웃 결과도 SharedArrayBuffer에 직접 쓰기
const resultBuffer = new SharedArrayBuffer(nodeCount * 4 * 4); // x,y,w,h
taffy.computeLayoutShared(
  rootHandle,
  availableWidth,
  availableHeight,
  resultBuffer,
);

// TS에서 결과 직접 읽기 (복사 없음)
const results = new Float32Array(resultBuffer);
```

### Phase 2 예상 효과

| 지표                     | Phase 0 (JSON)           | Phase 2 (Binary)    | Phase 2 (SAB)    | 개선    |
| ------------------------ | ------------------------ | ------------------- | ---------------- | ------- |
| 직렬화 시간 (1,500 노드) | ~3ms                     | **~0.3ms**          | **~0ms**         | 90~100% |
| 데이터 크기              | ~300KB                   | **~64KB**           | **0 (제로카피)** | 78~100% |
| 역직렬화 시간 (Rust)     | ~2ms (serde_json)        | **~0.1ms** (memcpy) | **~0ms**         | 95~100% |
| 결과 수집 시간           | ~1ms (Float32Array 복사) | ~1ms                | **~0ms**         | 0~100%  |

### Phase 2 리스크

| 리스크                           | 심각도 | 완화 전략                                     |
| -------------------------------- | ------ | --------------------------------------------- |
| Binary protocol 디버깅 어려움    | 중간   | DEV 모드에서 JSON fallback + binary diff 검증 |
| SharedArrayBuffer COOP/COEP 제약 | 중간   | TypedArray fallback (SAB 없이도 78% 개선)     |
| Percent 값 인코딩 복잡도         | 낮음   | 별도 percent flag 배열 또는 특수 NaN 인코딩   |

---

## Phase 3: Flat Render List + Depth Sort

> Unity/Flutter의 핵심 패턴: Scene Graph는 데이터로만 유지, 렌더링은 플랫 배열로.

### 동기

현재 `buildSkiaTreeHierarchical()`은 PixiJS Scene Graph를 DFS로 순회하여 계층적 Skia 트리를 구성한 후, `renderNode()`가 다시 DFS로 순회하며 CanvasKit 드로콜을 발행한다. 이 이중 DFS는:

1. **캐시 비효율**: 포인터 체이싱으로 L1/L2 캐시 미스 증가
2. **배칭 불가**: 동일 셰이더/텍스처의 요소가 z-order에 의해 분리
3. **불필요한 재구성**: 변경 없는 서브트리도 매번 트리 형태로 재조립

### 설계

```
Phase 3 렌더링 파이프라인:

[Layout Result (Map<elementId, ComputedLayout>)]
  → buildFlatRenderList():
      DFS 1회 순회 (elementsMap + childrenMap 기반, PixiJS 불필요)
      → 각 노드: absoluteTransform 계산 (부모 누적)
      → depthIndex 부여 (CSS stacking context 반영)
      → RenderItem[] 플랫 배열 생성
  → depthSort(renderItems):
      stable sort by (stackingContext, zIndex, treeOrder)
  → viewportCull(renderItems, viewportBounds):
      R-tree 쿼리로 가시 요소만 필터
  → Skia Sequential Draw:
      for (item of culledItems):
        applyTransform(item.absoluteTransform)
        renderShape(item.skiaData)   // box, text, image, line
      → 배치 가능 요소는 연속 드로콜
```

### `RenderItem` 타입

```typescript
interface RenderItem {
  elementId: string;
  // 절대 좌표 (부모 오프셋 누적)
  absoluteX: number;
  absoluteY: number;
  width: number;
  height: number;
  // z-order
  depthIndex: number;
  stackingContextId: number;
  zIndex: number;
  // 렌더 데이터 (Skia)
  skiaData: SkiaNodeData;
  // 클리핑 (overflow:hidden 부모)
  clipRect: DOMRect | null;
  // opacity 누적
  opacity: number;
}
```

### PixiJS Scene Graph 역할 축소

```
Phase 3 이후:
- PixiJS: 히트 테스팅(EventBoundary) 전용 → 변경 없음
- Skia 렌더링: elementsMap → Flat Render List → CanvasKit (PixiJS 순회 제거)
- Flat Render List는 elementsMap/childrenMap/layoutMap에서 직접 구성
```

### Phase 3 예상 효과

| 지표             | Phase 1 (계층적 Skia 트리) | Phase 3 (Flat Render List)  | 개선               |
| ---------------- | -------------------------- | --------------------------- | ------------------ |
| Skia 트리 구축   | ~3ms (DFS 2회)             | **~1.5ms** (DFS 1회)        | **50% 감소**       |
| 렌더링 순회      | 재귀 DFS + save/restore    | 선형 순회                   | **캐시 친화적**    |
| 배칭 기회        | 제한적 (z-order 트리 종속) | depth sort로 동일 타입 연속 | **GPU batch 가능** |
| 변경 없는 프레임 | 트리 전체 캐시 (현재)      | 리스트 전체 캐시 (동일)     | 동일               |

### Phase 3 리스크

| 리스크                                | 심각도 | 완화 전략                                        |
| ------------------------------------- | ------ | ------------------------------------------------ |
| CSS stacking context 정확도           | 높음   | Chrome 소스 기반 cssStackingContext.ts 정밀 구현 |
| overflow:hidden 클리핑 정확도         | 중간   | 부모 clipRect 누적 계산                          |
| 디버깅 어려움 (플랫 배열)             | 중간   | DEV 모드 시각적 depthIndex 오버레이              |
| 기존 aiEffects/selectionRenderer 호환 | 중간   | buildNodeBoundsMap을 layoutMap 기반으로 대체     |

---

## Phase 4: Element-Level Viewport Culling (R-tree)

> 페이지 단위 culling을 요소 단위로 세분화. 대형 페이지에서 화면 밖 요소를 O(log n)으로 제외.

### 동기

현재 `visiblePageIds`는 **페이지 단위** culling이다. 단일 페이지에 1,500 요소가 있고 화면에 200개만 보이는 경우, 나머지 1,300개도 레이아웃/렌더링에 포함된다.

### 설계

기존 Rust WASM `SpatialIndex`(grid-cell 기반)를 **R-tree 기반**으로 교체하여:

```
현재 (SpatialIndex, grid-cell):
  - updateElement(): O(1) amortized
  - queryViewport(): O(cells_in_viewport × elements_per_cell)
  - 문제: 대형 요소가 여러 셀에 걸치면 중복 보고

Phase 4 (R-tree, e.g., rstar crate):
  - insert/update: O(log n)
  - queryViewport: O(log n + k)  (k = 결과 수)
  - 장점: 크기 무관 정확한 쿼리, 대형 요소 문제 없음
```

### elementId ↔ numericId 매핑 레이어

WASM R-tree는 `u32` 키를 사용하고, TS 레이어는 `string` elementId를 사용한다.
`ElementIdRegistry`가 양방향 매핑을 관리한다.

```typescript
// elementIdRegistry.ts
class ElementIdRegistry {
  private stringToNum = new Map<string, number>();
  private numToString = new Map<number, string>();
  private nextId = 1;

  getNumericId(elementId: string): number {
    let num = this.stringToNum.get(elementId);
    if (num === undefined) {
      num = this.nextId++;
      this.stringToNum.set(elementId, num);
      this.numToString.set(num, elementId);
    }
    return num;
  }

  getElementId(numericId: number): string | undefined {
    return this.numToString.get(numericId);
  }

  remove(elementId: string): void {
    const num = this.stringToNum.get(elementId);
    if (num !== undefined) {
      this.stringToNum.delete(elementId);
      this.numToString.delete(num);
    }
  }
}
```

### Rust 구현 (rstar crate)

```rust
use rstar::{RTree, AABB, PointDistance};

#[wasm_bindgen]
pub struct SpatialIndexV2 {
    tree: RTree<ElementEntry>,
    entries: HashMap<u32, ElementEntry>,
}

#[derive(Clone)]
struct ElementEntry {
    id: u32,                    // ElementIdRegistry의 numericId
    aabb: AABB<[f32; 2]>,
}

impl rstar::RTreeObject for ElementEntry {
    type Envelope = AABB<[f32; 2]>;
    fn envelope(&self) -> Self::Envelope { self.aabb }
}

#[wasm_bindgen]
impl SpatialIndexV2 {
    pub fn query_viewport(&self, left: f32, top: f32, right: f32, bottom: f32) -> Box<[u32]> {
        let query_aabb = AABB::from_corners([left, top], [right, bottom]);
        self.tree.locate_in_envelope(&query_aabb)
            .map(|e| e.id)
            .collect::<Vec<_>>()
            .into_boxed_slice()
    }
}
```

### Skia 렌더링 통합

```typescript
// Flat Render List에서 viewport culling 적용
function renderFrame(
  renderItems: RenderItem[],
  viewportBounds: ViewportBounds,
  idRegistry: ElementIdRegistry,
) {
  // WASM R-tree에서 u32 ID 배열 반환
  const visibleNumericIds = spatialIndexV2.queryViewport(
    viewportBounds.left,
    viewportBounds.top,
    viewportBounds.right,
    viewportBounds.bottom,
  );
  // u32 → string elementId 변환 후 Set 구성
  const visibleSet = new Set<string>();
  for (const numId of visibleNumericIds) {
    const elementId = idRegistry.getElementId(numId);
    if (elementId) visibleSet.add(elementId);
  }

  for (const item of renderItems) {
    if (!visibleSet.has(item.elementId)) continue;
    renderSkiaItem(item);
  }
}
```

### Phase 4 예상 효과

| 시나리오                           | Phase 3 (페이지 culling) | Phase 4 (요소 culling) | 개선             |
| ---------------------------------- | ------------------------ | ---------------------- | ---------------- |
| 1,500 요소, 200개 가시             | 1,500개 렌더             | **200개 렌더**         | **87% 감소**     |
| 드래그 리사이즈 (줌아웃)           | 전체 요소 재렌더         | 가시 요소만            | **O(k) vs O(N)** |
| 멀티페이지 (3페이지, 1페이지 가시) | 1페이지 렌더 (현재)      | 가시 요소만            | 추가 세분화      |
| Skia 드로콜 수                     | O(N)                     | **O(k)** where k << N  | 비례 감소        |

### Phase 4 리스크

| 리스크                            | 심각도 | 완화 전략                                             |
| --------------------------------- | ------ | ----------------------------------------------------- |
| R-tree bulk insert 성능           | 낮음   | rstar crate의 bulk_load() O(n log n)                  |
| 레이아웃 변경 시 R-tree 갱신 비용 | 중간   | 레이아웃 결과 diff → 변경 요소만 update               |
| 클리핑된 자식의 부모 경계 불일치  | 중간   | overflow:hidden 부모의 경계를 자식 cull 기준으로 사용 |

---

## Phase 5: OffscreenCanvas + Worker Rendering

> 렌더링을 Worker로 분리하여 메인 스레드의 UI 응답성을 보장.

### 동기

Phase 0~4로 레이아웃+렌더링 비용을 대폭 줄이지만, 극대규모(5,000 요소)에서 content 렌더링이 여전히 ~8ms를 소비할 수 있다. 이를 Worker로 분리하면 메인 스레드는 항상 16ms 예산 내에서 동작한다.

### 설계

```
Main Thread:                          Worker Thread:
─────────────                         ─────────────
[사용자 입력]
  → State Update
  → Layout (PersistentTaffy)
  → Flat Render List 생성
  → postMessage(renderList)  ───────→  [OffscreenCanvas]
  → Overlay 렌더 (Selection 등)          → CanvasKit 초기화
  ← ImageBitmap 수신 ←──────────────    → renderFrame(list)
  → mainCanvas.drawImage(bitmap)          → transferToImageBitmap()
                                          → postMessage(bitmap)
```

### Worker 통신 프로토콜

```typescript
// main → worker
interface RenderCommand {
  type: "render";
  frameId: number; // 프레임 식별자 (응답 매칭용)
  width: number; // OffscreenCanvas 폭 (DPR 반영)
  height: number; // OffscreenCanvas 높이 (DPR 반영)
  renderItems: ArrayBuffer; // Binary-encoded RenderItem[]
  camera: CameraState;
  viewportBounds: ViewportBounds;
}

// worker → main
interface RenderResult {
  type: "frame";
  bitmap: ImageBitmap; // transferable
  frameId: number; // 요청 RenderCommand.frameId와 매칭
}
```

### CanvasKit Worker 초기화

```typescript
// renderWorker.ts
import CanvasKitInit from "canvaskit-wasm";

let ck: CanvasKit;
let offscreen: OffscreenCanvas;
let surface: Surface;
let currentWidth = 0;
let currentHeight = 0;

/** CanvasKit 초기화 또는 캔버스 리사이즈 */
function ensureSurface(width: number, height: number): void {
  if (offscreen && width === currentWidth && height === currentHeight) return;

  // 기존 surface 정리 (리사이즈/DPR 변경 시)
  if (surface) surface.delete();

  offscreen = new OffscreenCanvas(width, height);
  surface = ck.MakeWebGLCanvasSurface(offscreen)!;
  currentWidth = width;
  currentHeight = height;
}

self.onmessage = async (e: MessageEvent<RenderCommand>) => {
  if (!ck) {
    ck = await CanvasKitInit({ locateFile: (file) => `/wasm/${file}` });
  }

  // 매 프레임 크기 비교 — 변경 시 surface 재생성
  ensureSurface(e.data.width, e.data.height);

  const canvas = surface.getCanvas();
  canvas.clear(ck.WHITE);

  // Flat render list 순서대로 렌더링
  renderFlatList(ck, canvas, e.data.renderItems);

  surface.flush();
  const bitmap = offscreen.transferToImageBitmap();
  self.postMessage({ type: "frame", bitmap, frameId: e.data.frameId }, [
    bitmap,
  ]);
};
```

### Phase 5 예상 효과

| 지표                          | Phase 4 (메인 스레드) | Phase 5 (Worker)             | 개선              |
| ----------------------------- | --------------------- | ---------------------------- | ----------------- |
| 메인 스레드 content 렌더 시간 | ~8ms (5,000 요소)     | **~0ms** (Worker 분리)       | **100% 오프로드** |
| 프레임 레이턴시               | 동기                  | 1프레임 지연 (double buffer) | 허용 가능         |
| UI 응답성 (input latency)     | 16ms+ 가능            | **항상 < 8ms**               | **체감 개선**     |
| Camera-only 프레임            | snapshot blit (현재)  | 동일 (Worker 불필요)         | 변경 없음         |

### Phase 5 리스크

| 리스크                       | 심각도 | 완화 전략                                              |
| ---------------------------- | ------ | ------------------------------------------------------ |
| CanvasKit Worker 초기화 시간 | 중간   | 페이지 로드 시 preload, 초기화 중 메인 스레드 fallback |
| 1-frame 레이턴시             | 낮음   | 카메라 변경은 메인 스레드 blit (현재 패턴 유지)        |
| Worker↔Main 데이터 전송 비용 | 중간   | Transferable objects (ImageBitmap, ArrayBuffer)        |
| 디버깅 복잡도                | 중간   | Worker DevTools + structured logging                   |
| 폰트/이미지 리소스 공유      | 높음   | SharedArrayBuffer 또는 Worker 내 독립 캐시             |

---

## Phase 간 의존 관계

```
Foundation: Taffy 단일 엔진 통합 (Dropflow 제거)
    ↓ (전제조건)
Phase 0: Full-Tree Batch Layout
    ↓
Phase 1: Persistent Tree + Incremental Layout
    ↓
Phase 2: Binary Protocol (TypedArray / SharedArrayBuffer)
    ↓ (독립적 — Phase 3과 병행 가능)
Phase 3: Flat Render List + Depth Sort
    ↓
Phase 4: Element-Level Viewport Culling (R-tree)
    ↓
Phase 5: OffscreenCanvas + Worker Rendering
```

- **Foundation → Phase 0**: 순차 필수 (Dropflow 제거 없이는 단일 WASM 호출 불가)
- Phase 0 → 1: 순차 필수 (Persistent Tree는 Full-Tree 기반)
- Phase 2: Phase 1 이후 언제든 적용 가능 (독립)
- Phase 3: Phase 1 이후 언제든 적용 가능 (독립, Phase 2와 병행 가능)
- Phase 4: Phase 3 이후 권장 (Flat Render List에 culling 적용)
- Phase 5: Phase 3~4 이후 권장 (플랫 리스트를 Worker로 전송)

---

## 종합 성능 예측 (엔터프라이즈 CMS: 1,500 요소 / 15 레벨)

### 레이아웃 비용

| Phase       | 전체 재계산      | 단일 요소 변경 | 드래그 리사이즈     |
| ----------- | ---------------- | -------------- | ------------------- |
| **현재**    | 50~100ms         | 50~100ms       | 50~100ms/frame      |
| **Phase 0** | **5~15ms**       | 5~15ms         | 5~15ms/frame        |
| **Phase 1** | 5~15ms (초기)    | **0.3~1ms**    | **0.3~1ms/frame**   |
| **Phase 2** | **3~8ms** (초기) | 0.2~0.5ms      | **0.2~0.5ms/frame** |

### 렌더링 비용 (content 프레임)

| Phase       | 전체 1,500 요소  | 200개 가시              | 메인 스레드 점유 |
| ----------- | ---------------- | ----------------------- | ---------------- |
| **현재**    | ~6ms             | ~6ms (페이지 culling만) | 6ms              |
| **Phase 3** | ~4ms (선형 순회) | ~4ms                    | 4ms              |
| **Phase 4** | ~4ms             | **~1ms** (요소 culling) | 1ms              |
| **Phase 5** | ~4ms (Worker)    | ~1ms (Worker)           | **~0ms**         |

### 프레임 예산 (16ms) 분배

```
현재:        [████████████████████████████████████████████████████████████] ~61ms = 레이아웃 ~50ms + React ~5ms + 렌더링 ~6ms
Phase 0:     [████████████████]                                            16ms = 레이아웃 10ms + 렌더링 6ms (경계)
Phase 1:     [███████]                                                     7ms  = 레이아웃 1ms + 렌더링 6ms (여유)
Phase 2:     [█████]                                                       5ms  = 레이아웃 0.5ms + 렌더링 4ms + overhead
Phase 3+4:   [██]                                                          2ms  = 레이아웃 0.5ms + 렌더링 1ms + overhead
Phase 5:     [█]                                                           1ms  = 레이아웃 0.5ms + overlay 0.5ms (Worker 분리)
```

---

## Rationale

### 왜 이 순서인가

1. **Foundation이 최우선**: Dropflow 제거로 하이브리드 순환 의존성을 해소해야 Phase 0의 "단일 WASM 호출"이 가능하다. 동시에 ~5,700 LOC를 제거하여 유지보수 부담을 대폭 줄인다.

2. **Phase 0이 Foundation 직후**: 가장 적은 추가 코드 변경(Rust API 1개 + TS 함수 1개)으로 가장 큰 효과(WASM 호출 97% 감소). 기존 코드와 feature flag로 병행 운영 가능.

3. **Phase 1이 Phase 0 직후**: Phase 0의 `clear() + rebuild`를 제거하여 드래그/리사이즈 같은 연속 인터랙션에서의 성능을 결정적으로 개선. Figma가 "느린 빌더"와 구분되는 핵심 차이점.

4. **Phase 2는 선택적 가속기**: JSON 직렬화 제거는 중요하지만, Phase 1까지만으로도 대부분의 시나리오에서 프레임 예산 내. 프로파일링 결과에 따라 우선순위 조정.

5. **Phase 3은 아키텍처 전환점**: PixiJS Scene Graph 의존성을 렌더링에서 완전히 제거. 이후 최적화(Phase 4, 5)의 기반.

6. **Phase 4~5는 극대규모 대비**: 5,000 요소 시나리오에서만 의미 있는 최적화. 엔터프라이즈 시장 진입 시 적용.

### 왜 Figma 방식(단일 바이너리)을 따르지 않는가

Figma는 렌더링+레이아웃을 단일 C++/WASM 바이너리로 통합한다. composition가 이 접근을 그대로 따르지 않는 이유:

1. **Compositional Architecture**: composition의 UI 컴포넌트(62개+)는 React Spec 기반으로 정의된다. 이를 WASM에 내장하면 Spec 변경마다 WASM 재빌드가 필요하여 개발 속도가 크게 저하된다.

2. **점진적 마이그레이션**: 기존 코드베이스를 한 번에 교체하는 것은 6개월+ 소요 + 높은 리스크. Phase별 점진 적용이 현실적.

3. **Taffy의 성숙도**: Taffy 0.9는 Figma Auto Layout과 동등한 Flex/Grid 지원 + **네이티브 Block 레이아웃**(margin collapse, BFC, inline-block)을 제공한다. Dropflow 없이 Taffy 단일 엔진으로 모든 레이아웃 모드를 처리할 수 있으며, 호출 패턴 최적화로 충분하다.

4. **CanvasKit 활용**: CanvasKit은 이미 GPU 렌더링을 제공한다. 커스텀 GPU 렌더러 개발 대비 ROI가 낮다.

### Pencil App과의 비교

Pencil은 순수 JS 3-pass 레이아웃으로 수백 요소를 처리한다. composition가 Pencil 방식 대신 WASM Full-Tree를 선택하는 이유:

| 항목                   | Pencil (JS 3-pass) | composition (WASM Full-Tree) |
| ---------------------- | ------------------ | ---------------------------- |
| 요소 수                | 수십~수백          | **1,500~5,000**              |
| 레이아웃 모델          | Flexbox-like       | **CSS Flex + Grid + Block**  |
| 계산 시간 (1,500 요소) | ~30ms (JS 한계)    | **~5ms (WASM 네이티브)**     |
| 확장성                 | 선형 열화          | 로그 수준 열화 (Taffy 캐싱)  |

### 미래 기술 대비

- **Skia Graphite (WebGPU)**: Phase 5의 OffscreenCanvas Worker는 WebGPU 백엔드로 전환 시에도 동일 아키텍처 유지. Chrome Apple Silicon에서 이미 기본 활성화.
- **Vello (GPU compute)**: Taffy와 동일 Rust 생태계. Phase 2의 Binary Protocol이 Vello 통합의 기반이 될 수 있음.
- **SharedArrayBuffer 보편화**: COOP/COEP 헤더 지원이 확대되면 Phase 2의 제로카피 경로가 기본값.

---

## Migration Strategy

### Foundation: Taffy 단일 엔진 통합 (2.5주)

```
Week 1: ✅ 완료
  - [x] TaffyBlockEngine 생성 (BaseTaffyEngine 패턴 계승)
  - [x] toTaffyDisplay() 변환 레이어 구현 → taffyDisplayAdapter.ts (~320 LOC, Dropflow 패턴 통합)
  - [x] selectEngine() 라우팅: block/inline-block → TaffyBlockEngine
  - [x] block_layout.rs inline-block 경로 활성화 (기존 14 테스트 확인)
  - [x] Feature flag: VITE_USE_FULL_TREE_LAYOUT (기존 Dropflow와 병행)

Week 2: ✅ 완료
  - [x] 62개 컴포넌트 Spec pixel-diff 테스트
  - [x] calculateContentHeight 브랜치별 Taffy Block 호환 검증
  - [x] enrichWithIntrinsicSize block 경로 검증

Week 2.5: ✅ 완료 (2026-03-01)
  - [x] Dropflow 전체 제거 (~5,700 LOC) — packages/layout-flow/, DropflowBlockEngine.ts
  - [x] Feature flag 제거 (VITE_USE_TAFFY_BLOCK, VITE_USE_FULL_TREE_LAYOUT)
  - [x] 관련 import/reference 정리 (canvaskit-shaper.ts, per-level 폴백 경로)
```

### Phase 0 (2주) ✅ 완료

```
Week 3: ✅ 완료
  - [x] taffy_bridge.rs: build_tree_batch() + build_tree_batch_binary() 구현
  - [x] wasm-pack build + taffyLayout.ts: buildTreeBatch() / buildTreeBatchBinary() 래퍼
  - [x] engines/fullTreeLayout.ts: calculateFullTreeLayout() 구현

Week 4: ✅ 완료
  - [x] BuilderCanvas.tsx: VITE_USE_FULL_TREE_LAYOUT feature flag 분기
  - [x] useMemo 분리: 레이아웃 → computedLayouts, 변환 → layoutMap (_wasmLayoutReady 의존)
  - [x] traversePostOrder(): margin/block-child-width:100% 사후 보정

Week 4 추가 (2026-03-01): ✅ 완료
  - [x] enrichWithIntrinsicSize: hasTaffyChildren 조건 분기 — 컨테이너 height 주입 제거
  - [x] applyFlexItemProperties(): flex shorthand 파싱 공유 유틸 추출
  - [x] buildNodeStyle(): parentDisplay 파라미터 추가 — block 자식 flex item 속성 적용
  - [x] applyCommonTaffyStyle(): overflow/overflowX/overflowY, aspectRatio 추가
  - [x] Grid 경로: position + inset 누락 속성 수정
```

### Phase 1 (3주) — 부분 구현

```
Week 5: ⬜ 미완료
  - [ ] Rust: mark_dirty() wasm_bindgen 노출
  - [x] PersistentTaffyTree 클래스 설계 (addNode/updateNode/removeNode/computeLayout/getLayoutsBatch)
  - [ ] Zustand 파이프라인 통합: elementUpdate → PersistentTree.updateNode

Week 6: ⬜ 미완료
  - [ ] add/remove/reorder 동기화 로직
  - [x] childrenHashMap 기반 정합성 검증 설계
  - [ ] Fallback: 정합성 실패 시 full rebuild trigger

Week 7: ⬜ 미완료
  - [ ] 프로파일링: 드래그 리사이즈 60fps 검증
  - [ ] 메모리 모니터링: handle 누수 감지
  - [ ] Feature flag rollout (Phase 0 제거, Phase 1 활성화)
```

### Phase 2 (2주) — 부분 구현

```
Week 8: ✅ 부분 완료
  - [x] Binary style schema 설계 + encodeBatchBinary() TS 구현
  - [x] build_tree_batch_binary() Rust 구현
  - [ ] Rust 유닛 테스트 보강

Week 9: ⬜ 미완료
  - [ ] SharedArrayBuffer 경로 (optional, COOP/COEP 감지)
  - [ ] DEV 모드 JSON fallback + binary diff 검증
  - [ ] 프로파일링: JSON vs Binary 비교
```

### Phase 3 (3주)

```
Week 10-11:
  - [ ] RenderItem 타입 설계
  - [ ] buildFlatRenderList(): DFS 1회 → 플랫 배열
  - [ ] CSS stacking context 정밀 구현 (cssStackingContext.ts 확장)
  - [ ] depthSort: stable sort 구현

Week 12:
  - [ ] Skia sequential draw: 플랫 리스트 기반 렌더링
  - [ ] aiEffects/selectionRenderer: layoutMap 기반 좌표 계산으로 대체
  - [ ] 시각적 회귀 테스트 (스크린샷 비교)
```

### Phase 4 (2주)

```
Week 13:
  - [ ] Rust: rstar crate 기반 SpatialIndexV2
  - [ ] 레이아웃 결과 → R-tree 일괄 삽입/갱신

Week 14:
  - [ ] Flat Render List + R-tree viewport culling 통합
  - [ ] 프로파일링: 1,500 요소 줌아웃 시나리오
  - [ ] 기존 SpatialIndex 제거
```

### Phase 5 (3주)

```
Week 15-16:
  - [ ] renderWorker.ts: CanvasKit 초기화 + OffscreenCanvas
  - [ ] Worker 통신 프로토콜: RenderCommand / RenderResult
  - [ ] 메인 스레드: ImageBitmap 수신 + mainCanvas.drawImage

Week 17:
  - [ ] 폰트/이미지 리소스 Worker 전달 전략
  - [ ] Camera-only 프레임: 메인 스레드 blit (Worker 불필요)
  - [ ] Fallback: Worker 미지원 시 메인 스레드 렌더링
  - [ ] 프로파일링: 5,000 요소 메인 스레드 input latency
```

---

## Consequences

### Positive

- **60fps 안정 달성**: 1,500 요소에서 프레임 예산(16ms) 내 레이아웃+렌더링
- **엔터프라이즈 CMS 지원**: 데이터 테이블, 대시보드, 복합 관리 패널 실시간 편집
- **Figma-class UX**: 드래그 리사이즈, 컬럼 추가/삭제 시 즉각 반응
- **아키텍처 단순화**: PixiJS Scene Graph → 렌더링 의존 제거 (Phase 3)
- **확장성**: 5,000 요소까지 선형 열화 없이 지원 (Phase 4~5)
- **미래 대비**: WebGPU(Skia Graphite), Vello 통합 가능한 구조

### Negative

- **Rust WASM 빌드 복잡도 증가**: Foundation, Phase 0, 1, 2, 4에서 Rust 코드 변경 필요
- **디버깅 난이도 증가**: Binary Protocol(Phase 2), Worker(Phase 5)에서 가시성 저하
- **inline-block 변환 정확도**: `toTaffyDisplay()` 2단계 변환(자식→block 리프, 부모→flex-wrap)이 CSS native inline-block의 IFC 동작과 미세 차이 가능 (Foundation)
- **마이그레이션 기간**: ~17주 (전체, Foundation 2.5주 포함), feature flag 병행 운영 동안 두 경로 유지보수
- **메모리 사용량 증가**: Persistent Tree(Phase 1) + R-tree(Phase 4) 추가 구조체

### Risks

| 리스크                                  | 확률 | 영향 | 완화                                                  |
| --------------------------------------- | ---- | ---- | ----------------------------------------------------- |
| Taffy Block margin collapse 정확도      | 낮음 | 중간 | block_layout.rs 14개 테스트 + 62 Spec pixel-diff 검증 |
| inline-block → flex-wrap 변환 edge case | 중간 | 중간 | 62개 Spec 회귀 테스트 + feature flag 병행             |
| SharedArrayBuffer 브라우저 제약         | 낮음 | 중간 | TypedArray fallback (SAB 없이도 78% 개선)             |
| OffscreenCanvas Worker 리소스 공유 문제 | 중간 | 중간 | Worker 내 독립 캐시 + 초기화 시 리소스 전송           |
| Phase 3 stacking context 버그           | 중간 | 높음 | 기존 계층적 렌더링 fallback (feature flag)            |
| 전체 마이그레이션 기간 초과             | 중간 | 중간 | Phase별 독립 배포, 가치순 우선순위                    |

---

## 성능 목표 요약

| 시나리오            | 지표                      | 현재     | 목표 (Phase 2+) | 목표 (Phase 5)     |
| ------------------- | ------------------------- | -------- | --------------- | ------------------ |
| 100 요소, 5 레벨    | 레이아웃                  | ~10ms    | **< 1ms**       | < 1ms              |
| 100 요소, 5 레벨    | 렌더링 (content)          | ~2ms     | < 2ms           | < 1ms (Worker)     |
| 1,500 요소, 15 레벨 | 레이아웃 (전체)           | ~75ms    | **< 8ms**       | < 5ms              |
| 1,500 요소, 15 레벨 | 레이아웃 (증분)           | ~75ms    | **< 1ms**       | < 0.5ms            |
| 1,500 요소, 15 레벨 | 렌더링 (content)          | ~6ms     | < 4ms           | **< 1ms** (Worker) |
| 1,500 요소, 15 레벨 | 드래그 리사이즈 FPS       | 10~20fps | **60fps**       | 60fps              |
| 5,000 요소, 20 레벨 | 레이아웃 (전체)           | 200ms+   | < 25ms          | < 15ms             |
| 5,000 요소, 20 레벨 | 드래그 리사이즈 FPS       | < 5fps   | **30fps+**      | **60fps**          |
| 모든 시나리오       | 메인 스레드 input latency | 가변     | < 8ms           | **< 4ms**          |

---

## References

### 내부 문서

- [ADR-003: Canvas Rendering](003-canvas-rendering.md) -- CanvasKit/Skia + PixiJS 이중 렌더러
- [ADR-001: State Management](001-state-management.md) -- Zustand 슬라이스 패턴
- [ADR-004: Preview Isolation](004-preview-isolation.md) -- Builder↔Preview 분리
- [ADR-008](008-layout-engine.md) -- Taffy 단일 엔진 (TaffyBlock/Flex/Grid) 전략
- [RENDERING_ARCHITECTURE.md](../../legacy/RENDERING_ARCHITECTURE.md) -- WASM 아키텍처 상세
- [MULTIPAGE.md](../../reference/architecture/MULTIPAGE.md) -- Multi-page Canvas 렌더링

### 코드베이스

- `apps/builder/src/.../wasm/src/taffy_bridge.rs` -- Rust Taffy 바인딩
- `apps/builder/src/.../wasm/src/block_layout.rs` -- Rust Block 레이아웃 (626 LOC, 14 tests)
- `apps/builder/src/.../wasm-bindings/taffyLayout.ts` -- TypeScript Taffy 래퍼
- `apps/builder/src/.../layout/engines/BaseTaffyEngine.ts` -- Taffy 공통 추상 클래스
- `apps/builder/src/.../layout/engines/TaffyFlexEngine.ts` -- Flex 레이아웃 엔진
- `apps/builder/src/.../layout/engines/TaffyBlockEngine.ts` -- Block 레이아웃 엔진 (Foundation에서 신규 생성)
- `apps/builder/src/.../layout/engines/taffyDisplayAdapter.ts` -- Dropflow CSS Block Layout 패턴 통합 변환 레이어 (Foundation에서 신규 생성, 2026-02-28 Dropflow 패턴 통합)
- `apps/builder/src/.../layout/engines/fullTreeLayout.ts` -- Full-Tree 레이아웃 (Phase 0, calculateFullTreeLayout + traversePostOrder)
- `apps/builder/src/.../layout/engines/index.ts` -- 레이아웃 엔진 디스패처
- `apps/builder/src/.../skia/SkiaRenderer.ts` -- Skia 렌더 루프
- `apps/builder/src/.../skia/SkiaOverlay.tsx` -- Skia 오버레이 컴포넌트
- `apps/builder/src/.../skia/nodeRenderers.ts` -- Skia 노드별 렌더 함수
- `apps/builder/src/.../wasm-bindings/spatialIndex.ts` -- Rust WASM Spatial Index
- `apps/builder/src/.../elementRegistry.ts` -- Element Bounds Registry
- `apps/builder/src/.../BuilderCanvas.tsx` -- 메인 캔버스 컴포넌트

### 외부 참조

- [Taffy Documentation](https://github.com/DioxusLabs/taffy) -- Taffy Rust layout engine
- [Figma Engineering Blog](https://www.figma.com/blog/building-a-professional-design-tool-on-the-web/) -- Figma 아키텍처
- [Chrome RenderingNG](https://developer.chrome.com/articles/renderingng/) -- Chrome 렌더링 파이프라인
- [Flutter Layout Algorithm](https://docs.flutter.dev/resources/architectural-overview#layout-and-rendering) -- Flutter Relayout Boundary
- [rstar crate](https://docs.rs/rstar/) -- Rust R-tree implementation
- [Spineless Traversal (PLDI 2025)](https://dl.acm.org/doi/10.1145/3656463) -- Priority-queue 기반 dirty 노드 처리
- [RBush](https://github.com/mourner/rbush) -- JavaScript R-tree (참고)
- [Skia Graphite](https://skia.org/docs/dev/design/graphite/) -- WebGPU 백엔드

---

## 코드 대조 검증 (2026-03-03)

| Phase      | 상태         | 핵심 파일                                           | 비고                                                                            |
| ---------- | ------------ | --------------------------------------------------- | ------------------------------------------------------------------------------- |
| Foundation | ✅ 완료      | `TaffyBlockEngine.ts`, `taffyDisplayAdapter.ts`     | Dropflow 완전 제거, Taffy Block 통합                                            |
| Phase 0    | ✅ 완료      | `fullTreeLayout.ts` (1046 LOC)                      | `calculateFullTreeLayout()` + `traversePostOrder()` DFS                         |
| Phase 1    | ✅ 완료      | `persistentTaffyTree.ts`                            | `incrementalUpdate()` JSON 비교 기반, `buildFull()` 초기 빌드                   |
| Phase 2    | ✅ 부분 완료 | `binaryProtocol.ts` (647 LOC), `binary_protocol.rs` | TypedArray 인코딩 활성, SharedArrayBuffer 미구현                                |
| Phase 3    | ❌ 미구현    | (파일 미존재)                                       | Flat Render List + Depth Sort                                                   |
| Phase 4    | ❌ 미구현    | (파일 미존재)                                       | Element-Level Viewport Culling (R-tree) — `spatialIndex.ts` 기존 Rust WASM 존재 |
| Phase 5    | ❌ 미구현    | (파일 미존재)                                       | OffscreenCanvas Worker Rendering                                                |

**추가 확인사항**:

- `_perPageLayoutMaps`: 페이지별 레이아웃 캐싱 구현됨 (fullTreeLayout.ts:91)
- `sanitizeLayoutValue()`: NaN/Infinity 가드 구현됨 (fullTreeLayout.ts:35-42)
- `MAX_TREE_DEPTH=100`: DFS 깊이 가드 구현됨 (fullTreeLayout.ts:33)
- CSS `order` 속성: TS 레벨 sort 구현됨 (fullTreeLayout.ts:541-553)
