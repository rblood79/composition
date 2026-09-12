# ADR-900 구현 상세: Unified Skia Rendering Engine

> 이 문서는 [ADR-900](../completed/900-unified-skia-rendering-engine.md)의 구현 상세입니다.

## 검증된 오픈소스 의존성 및 참조

> 리서치 완료 (2026-04-06). 모든 핵심 기능에 검증된 소스코드가 존재함.

### 외부 의존성: 1개만

| 프로젝트          | License | 용도                                                                           | GitHub                                                         |
| ----------------- | ------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| **Taffy v0.10.0** | MIT     | Layout Engine 포크 기반 — flex/grid/block/areas 검증됨. **sticky만 추가 구현** | [DioxusLabs/taffy](https://github.com/DioxusLabs/taffy) ⭐3.1k |

**삭제된 의존성:**

| 프로젝트      | 삭제 사유                                                                     | 대체                                            |
| ------------- | ----------------------------------------------------------------------------- | ----------------------------------------------- |
| ~~geo-index~~ | composition에 이미 Rust WASM spatial index 존재 (`wasm/src/spatial_index.rs`) | 기존 코드를 `composition-layout` crate에 이식   |
| ~~Popmotion~~ | CSS easing/spring/keyframe 보간은 ~130줄 순수 수학                            | 자체 구현 (cubic-bezier + damped spring + lerp) |

### 아키텍처 패턴 참조

| 패턴                           | 참조 프로젝트                                                                 | 참조 위치                                        |
| ------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------ |
| CanvasKit scene graph 브리지   | **AntV G** (MIT, ⭐1.2k) — 유일한 CanvasKit 렌더러 보유 scene graph           | `antvis/G/packages/g-plugin-canvaskit-renderer/` |
| Dirty rectangle 알고리즘       | **ZRender** (BSD-3, ⭐6.3k) — ECharts 프로덕션 검증                           | `ecomfe/zrender/src/canvas/`                     |
| Skia WASM + 타일 캐싱          | **Penpot** render-wasm (MPL-2, ⭐38k)                                         | `penpot/penpot/render-wasm/`                     |
| backdrop-filter/mask 구현      | **React Native Skia** (MIT, ⭐8.3k) — saveLayer + ImageFilter 패턴            | `Shopify/react-native-skia/packages/skia/src/`   |
| position: sticky 알고리즘      | **Stickyfill** (MIT, ⭐2.3k) — 3단계 상태 전환 (normal→fixed→absolute-bottom) | `wilddeer/stickyfill/src/`                       |
| CanvasKit + WASM 레이아웃 통합 | **OpenPencil** (MIT, ⭐4k) — composition와 거의 동일 스택                     | `open-pencil/open-pencil/`                       |
| Rust 100% 에디터 아키텍처      | **Graphite** (Apache-2.0, ⭐25k) — Rust 렌더링 + JS thin UI                   | `GraphiteEditor/Graphite/`                       |
| JS-WASM 경계 최적화            | **Penpot** — 바이너리 직렬화 (104byte/shape), linear memory 직접 조작         | `penpot/penpot/render-wasm/src/`                 |
| Stylo+Taffy+Parley 통합 패턴   | **Blitz** (MIT, ⭐3.5k) — 모듈별 독립 사용 가능한 아키텍처                    | `DioxusLabs/blitz/`                              |

### CSS3 렌더링 — 추가 라이브러리 불필요

| 기능                  | CanvasKit 내장 API                                                 | 참조 구현                                 |
| --------------------- | ------------------------------------------------------------------ | ----------------------------------------- |
| backdrop-filter       | `saveLayer(bounds, null, backdropFilter)` + `ImageFilter.MakeBlur` | React Native Skia `BackdropBlur`          |
| text-shadow           | `TextStyle.shadows` + `ImageFilter.MakeDropShadow`                 | CanvasKit Paragraph API                   |
| mask-image            | `MaskFilter` + `RuntimeEffect.Make` (SkSL shader)                  | React Native Skia alpha mask              |
| sepia/invert          | `ColorFilter.MakeMatrix` (5x4 color matrix)                        | 이미 composition `effects.ts`에 패턴 존재 |
| outline-style         | `Paint.setPathEffect(DashPathEffect.Make)`                         | Skia 공식 API                             |
| background-blend-mode | `Paint.setBlendMode` (18종 이미 구현)                              | 이미 composition `blendModes.ts`          |

## 목차

1. [현재 아키텍처 분석](#1-현재-아키텍처-분석)
2. [목표 아키텍처](#2-목표-아키텍처)
3. [Layer 1: GPU Backend 추상화](#3-layer-1-gpu-backend-추상화)
4. [Layer 2: Custom Rust Layout Engine](#4-layer-2-custom-rust-css3-layout-engine)
5. [Layer 3: SceneGraph (Retained Mode)](#5-layer-3-scenegraph-retained-mode)
6. [Layer 4: SkiaRenderer 확장](#6-layer-4-skiarenderer-확장)
7. [Layer 5: Event System 재설계](#7-layer-5-event-system-재설계)
8. [Layer 6: CSS3 렌더링 확장](#8-layer-6-css3-렌더링-확장)
9. [텍스트 파이프라인 통합 (ADR-051)](#9-텍스트-파이프라인-통합)
10. [제거 대상 파일 목록](#10-제거-대상-파일-목록)
11. [Phase 계획](#11-phase-계획)
12. [성능 예산](#12-성능-예산)
13. [테스트 전략](#13-테스트-전략)

---

## 1. 현재 아키텍처 분석

### 제거 대상: PixiJS

| 파일                                  | 역할                                    | 대체                               |
| ------------------------------------- | --------------------------------------- | ---------------------------------- |
| `pixiSetup.ts`                        | Component catalog, resolution           | 삭제 (SceneGraph가 해상도 관리)    |
| `BuilderCanvas.tsx`                   | @pixi/react Application, extend         | 순수 React + canvas element        |
| `sprites/ElementSprite.tsx` (~3200줄) | 요소 타입 분기, store 구독, spec shapes | StoreBridge + SceneGraph           |
| `sprites/BoxSprite.tsx`               | 박스 렌더링 (pixi Graphics)             | Skia nodeRenderers (이미 존재)     |
| `sprites/TextSprite.tsx`              | 텍스트 위치 지정                        | Skia nodeRendererText (이미 존재)  |
| `sprites/ImageSprite.tsx`             | 이미지 위치 지정                        | Skia nodeRendererImage (이미 존재) |
| `components/ClickableBackground.tsx`  | pixi 배경 이벤트                        | DOM event handler                  |
| `components/ElementsLayer.tsx`        | 레이아웃 계산 + pixi 트리               | SceneGraph (layout 결과 소비)      |
| `components/PageContainer.tsx`        | 페이지 pixi 컨테이너                    | SceneGraph PageNode                |
| `selection/SelectionLayer.tsx`        | 선택 박스 (pixi)                        | Skia SelectionOverlay (이미 존재)  |
| `selection/SelectionBox.tsx`          | 히트 테스트 (pixi)                      | WASM SpatialIndex (이미 존재)      |
| `skia/SkiaOverlay.tsx`                | CanvasKit + pixi 조합                   | SkiaCanvas (단독)                  |
| `types/pixi-react.d.ts`               | 타입 선언                               | 삭제                               |

**총 삭제 예상**: ~8,000줄 (PixiJS 관련)

### 제거 대상: Taffy WASM

| 파일                                    | 역할              | 대체                      |
| --------------------------------------- | ----------------- | ------------------------- |
| `wasm-bindings/taffyLayout.ts`          | Taffy WASM 바인딩 | CSS3 Layout Engine 바인딩 |
| `layout/engines/BaseTaffyEngine.ts`     | Taffy 기본 엔진   | 새 LayoutEngine 래퍼      |
| `layout/engines/TaffyFlexEngine.ts`     | Flex 엔진         | CSS3 Engine flex 모드     |
| `layout/engines/TaffyGridEngine.ts`     | Grid 엔진         | CSS3 Engine grid 모드     |
| `layout/engines/TaffyBlockEngine.ts`    | Block 엔진        | CSS3 Engine block 모드    |
| `layout/engines/persistentTaffyTree.ts` | Taffy 트리 관리   | CSS3 Engine 내부 트리     |

**총 교체 예상**: ~4,000줄 (새 바인딩으로 교체)

### 유지/확장 대상

| 파일                                       | 역할                       | 변경                           |
| ------------------------------------------ | -------------------------- | ------------------------------ |
| `skia/SkiaRenderer.ts`                     | Dual-surface 렌더          | dirty region 추가              |
| `skia/nodeRenderer*.ts` (13개)             | Skia 개별 렌더러           | CSS3 확장 (backdrop-filter 등) |
| `skia/specShapeConverter.ts`               | Spec→SkiaNode 변환         | 유지                           |
| `skia/effects.ts`                          | blur, shadow, opacity      | CSS3 필터 확장                 |
| `skia/fills.ts`                            | gradient, image fill       | 유지                           |
| `skia/blendModes.ts`                       | 18 blend modes             | background-blend-mode 추가     |
| `wasm-bindings/spatialIndex.ts`            | 히트 테스트                | 유지                           |
| `hooks/useCentralCanvasPointerHandlers.ts` | DOM 이벤트                 | SceneGraph 연결로 변경         |
| `layout/engines/fullTreeLayout.ts`         | 레이아웃 오케스트레이션    | 새 엔진 호출로 교체            |
| `layout/engines/utils.ts`                  | enrichWithIntrinsicSize 등 | 텍스트 측정 경로 변경          |
| `utils/canvas2dSegmentCache.ts`            | Pretext 기반 측정          | 통합 확장                      |

---

## 2. 목표 아키텍처

### 데이터 흐름 (단방향)

```
┌─────────────────────────────────────────────────────────────────┐
│                         Zustand Store                           │
│  elementsMap(O(1)) · childrenMap · pageIndex · selectedIds      │
└──────────────────────────────┬──────────────────────────────────┘
                               │ 구독 (selector diff)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        StoreBridge                              │
│  store 변경 감지 → SceneNode 생성/갱신/삭제 → dirty flag 설정   │
│  React 렌더 사이클 완전 우회 (requestAnimationFrame 기반)       │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        SceneGraph                               │
│  SceneNode 트리 (순수 TS 객체)                                  │
│  ├─ DocumentNode                                                │
│  │   ├─ PageNode (page1)                                        │
│  │   │   ├─ ElementNode (body) ─ children: [...]                │
│  │   │   │   ├─ ElementNode (div)                               │
│  │   │   │   │   ├─ ElementNode (text)                          │
│  │   │   │   │   └─ ElementNode (image)                         │
│  │   │   │   └─ ElementNode (button)                            │
│  │   │   └─ ...                                                 │
│  │   └─ PageNode (page2) ...                                    │
│  ├─ Dirty Set (변경된 노드 ID)                                  │
│  ├─ Layout Cache (node → ComputedLayout)                        │
│  └─ Stacking Context 관리                                       │
└──────┬──────────────────────┬───────────────────────────────────┘
       │                      │
       ▼                      ▼
┌──────────────┐  ┌───────────────────────────────────────────────┐
│ CSS3 Layout  │  │              SkiaRenderer                     │
│ Engine       │  │  ┌─ GPU Backend (WebGL2 / WebGPU)             │
│ (Rust WASM)  │  │  ├─ contentSurface (dirty region 단위)        │
│              │  │  ├─ mainSurface (합성)                        │
│ flex/grid    │  │  ├─ nodeRenderers (확장)                      │
│ block/inline │  │  │   ├─ box, text, image, border              │
│ float/table  │  │  │   ├─ backdrop-filter, mask, text-shadow    │
│ multicol     │  │  │   └─ transition interpolation              │
│ sticky       │  │  └─ Overlay (selection, grid, hover)          │
│              │──┘                                                │
│ 출력:        │     ┌────────────────────────────────────────────┐
│ ComputedLayout│     │          Event System                      │
│ per node     │     │  DOM pointer events                        │
│              │     │   → screenToCanvas 변환                    │
└──────────────┘     │   → WASM SpatialIndex hitTest              │
                     │   → SceneGraph node 조회                   │
                     │   → Zustand Store 업데이트                 │
                     └────────────────────────────────────────────┘
```

### 프레임 루프

```
requestAnimationFrame
  │
  ├─ 1. StoreBridge.flush()
  │     store 변경 큐 → SceneNode 갱신 → dirty set 수집
  │
  ├─ 2. Layout (dirty 노드만)
  │     CSS3 Engine.computeLayout(dirtySubtrees)
  │     → ComputedLayout 캐시 갱신
  │     → SpatialIndex 갱신 (변경된 bounds만)
  │
  ├─ 3. Transition/Animation tick
  │     진행 중 애니메이션의 현재 프레임 보간값 계산
  │     → 해당 SceneNode 속성 갱신 → dirty 추가
  │
  ├─ 4. Render (classifyFrame 유지)
  │     ├─ idle: 스킵
  │     ├─ camera-only: contentSnapshot blit + transform
  │     ├─ content: dirty region만 contentSurface 재렌더
  │     ├─ present: overlay만 재렌더
  │     └─ full: 전체 재렌더
  │
  └─ 5. Overlay
        selection box, hover highlight, grid, guides
```

---

## 3. Layer 1: GPU Backend 추상화

### 목적

현재 CanvasKit WebGL2 → 미래 WebGPU 전환을 위한 추상화.

### 인터페이스

```typescript
// gpu/GPUBackend.ts
interface GPUBackend {
  // Surface 관리
  createSurface(canvas: HTMLCanvasElement, width: number, height: number): GPUSurface;
  createOffscreenSurface(width: number, height: number): GPUSurface;
  resizeSurface(surface: GPUSurface, width: number, height: number): void;
  disposeSurface(surface: GPUSurface): void;

  // 렌더링 세션
  beginFrame(surface: GPUSurface): RenderContext;
  endFrame(surface: GPUSurface): void;

  // Texture 캐시
  createTextureFromImage(image: ImageBitmap | HTMLImageElement): GPUTexture;
  disposeTexture(texture: GPUTexture): void;

  // 컨텍스트 상태
  isContextLost(): boolean;
  onContextLost(callback: () => void): void;
  onContextRestored(callback: () => void): void;

  // 정보
  getMaxTextureSize(): number;
  getDevicePixelRatio(): number;
}

// 구현
class CanvasKitWebGLBackend implements GPUBackend { ... }
// 미래
class CanvasKitWebGPUBackend implements GPUBackend { ... }
```

### 구현 전략

- Phase 1에서는 `CanvasKitWebGLBackend`만 구현
- 기존 `createSurface.ts` + `SkiaRenderer.ts`의 Surface 로직을 이 인터페이스 뒤로 이동
- WebGPU 전환 시 `CanvasKitWebGPUBackend` 구현 + 팩토리 교체만으로 전환

---

## 4. Layer 2: Custom Rust CSS3 Layout Engine

### 목표

현대 웹 핵심 레이아웃 완전 지원 (ROI 기반 스코프). 단일 Rust WASM 바이너리.

> ROI ≈ 0 기능 삭제: float, clear, table layout, inline formatting context, multi-column, margin collapsing.
> 보류 경로 유지: 수요 발생 시 독립 모듈로 추가 가능한 구조.

### 구조

```
composition-layout/ (새 Rust crate)
├── Cargo.toml
├── src/
│   ├── lib.rs              # WASM 진입점, wasm-bindgen exports
│   ├── tree.rs             # Layout tree (노드, 스타일, 자식 관계)
│   ├── style.rs            # CSS 스타일 구조체
│   ├── computed.rs         # Computed 스타일 (cascade, inheritance)
│   ├── layout.rs           # Layout 디스패치 (display별 분기)
│   │
│   ├── flex/               # Flexbox (Taffy fork, 검증됨)
│   │   ├── mod.rs
│   │   ├── algorithm.rs
│   │   └── types.rs
│   │
│   ├── grid/               # CSS Grid (Taffy fork + areas)
│   │   ├── mod.rs
│   │   ├── algorithm.rs
│   │   ├── track_sizing.rs
│   │   └── placement.rs    # grid-template-areas 포함
│   │
│   ├── block/              # Block Flow (단순 — margin collapse 제외)
│   │   ├── mod.rs
│   │   └── algorithm.rs
│   │
│   ├── position/           # Positioning
│   │   ├── mod.rs
│   │   ├── sticky.rs       # position: sticky (NEW)
│   │   ├── absolute.rs     # position: absolute/fixed (Taffy fork)
│   │   └── stacking.rs     # stacking context, z-index
│   │
│   ├── sizing/             # Intrinsic Sizing (Taffy fork)
│   │   ├── mod.rs
│   │   ├── content_size.rs # min-content, max-content, fit-content
│   │   └── aspect_ratio.rs
│   │
│   ├── text/               # Text Measurement Interface
│   │   ├── mod.rs
│   │   └── measure.rs      # JS callback으로 텍스트 측정 위임
│   │
│   └── spatial/            # Spatial Index (기존 WASM 통합)
│       ├── mod.rs
│       └── grid_index.rs   # cell-based 256px grid
│
│   # 🗑️ 삭제됨 (ROI ≈ 0):
│   # ├── inline/           # IFC, line box, bidi → 노코드 불필요
│   # ├── float/            # float/clear → flex/grid 대체
│   # ├── table/            # CSS table layout → Grid 대체
│   # └── multicol/         # multi-column → 보류 (niche)
```

### CSS 속성 지원 매트릭스 (ROI 다이어트 후)

| 카테고리         | 속성                                                                                                                               | 소스                |  상태   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------- | :-----: |
| **Display**      | flex, inline-flex, grid, inline-grid, block, none                                                                                  | Taffy fork          |   ✅    |
| **Flexbox**      | flex-direction, flex-wrap, justify-content, align-items, align-content, flex-grow, flex-shrink, flex-basis, order, gap, align-self | Taffy fork          |   ✅    |
| **Grid**         | grid-template-columns/rows, **grid-template-areas**, grid-auto-columns/rows, grid-auto-flow, grid-column/row, justify-items/self   | Taffy fork + areas  |   ✅    |
| **Block**        | width auto, height auto (margin collapse 제외)                                                                                     | Taffy fork          |   ✅    |
| **Position**     | static, relative, absolute, fixed, **sticky**, top/right/bottom/left, inset, z-index                                               | Taffy fork + sticky |   ✅    |
| **Box Model**    | width, height, min/max-\*, margin, padding, border-width, box-sizing, aspect-ratio                                                 | Taffy fork          |   ✅    |
| **Overflow**     | overflow (visible/hidden/scroll/auto), overflow-x/y                                                                                | Taffy fork          |   ✅    |
| **Sizing**       | fit-content, min-content, max-content, auto, calc()                                                                                | Taffy fork          |   ✅    |
| **Visibility**   | visibility (visible/hidden), display:none                                                                                          | 신규                |   ✅    |
| ~~**Float**~~    | ~~float, clear~~                                                                                                                   | —                   | 🗑️ 삭제 |
| ~~**Inline**~~   | ~~IFC, line box, baseline, bidi~~                                                                                                  | —                   | 🗑️ 삭제 |
| ~~**Table**~~    | ~~table-layout, border-collapse~~                                                                                                  | —                   | 🗑️ 삭제 |
| ~~**Multicol**~~ | ~~column-count, column-width~~                                                                                                     | —                   | ⏸️ 보류 |

### WASM 인터페이스

```rust
// lib.rs — wasm-bindgen exports
#[wasm_bindgen]
pub struct LayoutEngine {
    tree: LayoutTree,
    spatial_index: SpatialIndex,
}

#[wasm_bindgen]
impl LayoutEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self;

    // 트리 조작
    pub fn build_tree_batch(&mut self, data: &[u8]) -> Vec<u32>;
    pub fn update_node_style(&mut self, handle: u32, style_json: &str) -> bool;
    pub fn set_children(&mut self, handle: u32, children: &[u32]);
    pub fn remove_node(&mut self, handle: u32);
    pub fn mark_dirty(&mut self, handle: u32);

    // 레이아웃 계산
    pub fn compute_layout(&mut self, root: u32, avail_w: f32, avail_h: f32);
    pub fn compute_layout_incremental(&mut self, dirty_nodes: &[u32], avail_w: f32, avail_h: f32);
    pub fn get_layouts_batch(&self, handles: &[u32]) -> Vec<f32>; // [x,y,w,h, x,y,w,h, ...]

    // Spatial Index (통합)
    pub fn hit_test_point(&self, x: f32, y: f32) -> Vec<u32>;
    pub fn query_rect(&self, x: f32, y: f32, w: f32, h: f32) -> Vec<u32>;
    pub fn update_spatial(&mut self, handle: u32, x: f32, y: f32, w: f32, h: f32);

    // 텍스트 측정 콜백 등록
    pub fn set_text_measure_func(&mut self, callback: js_sys::Function);

    // 디버그
    pub fn get_layout_debug(&self, handle: u32) -> String; // JSON
    pub fn get_tree_stats(&self) -> String;
}
```

### 텍스트 측정 위임

레이아웃 엔진은 텍스트 크기를 알 수 없으므로 JS 콜백으로 위임:

```rust
// text/measure.rs
pub trait TextMeasure {
    fn measure(&self, text: &str, style: &TextStyle, max_width: f32) -> (f32, f32);
}

// WASM에서는 JS 함수를 콜백으로 등록
struct JsTextMeasure {
    callback: js_sys::Function,
}
```

JS 측:

```typescript
// layoutBridge.ts
engine.set_text_measure_func(
  (text: string, styleJson: string, maxWidth: number) => {
    const style = JSON.parse(styleJson);
    // ADR-051 Pretext 기반 Canvas 2D 측정
    const result = canvas2dSegmentCache.measureText(text, style, maxWidth);
    return [result.width, result.height];
  },
);
```

### 빌드 & 배포

```toml
# Cargo.toml
[package]
name = "composition-layout"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
# 유일한 외부 의존성 — Taffy v0.10.0 fork (flex/grid/block/areas 검증됨)
# git = "https://github.com/composition/taffy-fork" or path = "../taffy-fork"
taffy = { version = "0.10", features = ["grid", "block_layout"] }

# Spatial Index — 기존 wasm/src/spatial_index.rs 이식 (외부 의존성 0)
# geo-index 삭제: composition에 이미 검증된 cell-based grid 구현 존재

# WASM 바인딩
wasm-bindgen = "0.2"
js-sys = "0.3"

# 직렬화 (JS-WASM 경계 최소화 — Penpot 패턴: 바이너리 직렬화 우선)
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[profile.release]
panic = "abort"      # unwind 제거
opt-level = "s"      # 크기 최적화
lto = true           # 링크 타임 최적화
codegen-units = 1    # 단일 유닛
strip = true         # 디버그 심볼 제거
```

빌드:

```bash
wasm-pack build --target web --release
# 후처리 (10-20% 추가 감소)
wasm-opt -Os -o composition_layout_opt.wasm composition_layout_bg.wasm
```

예상 WASM 크기: ~200-300KB (gzip ~80-120KB)

- Taffy flex/grid/block: ~150KB
- spatial index (기존 코드 이식): ~30KB
- sticky + 2-pass + wasm-bindgen 글루: ~50-120KB

---

## 4.5 기존 패치 이식 전략 — 34개 전투 패치 분류

> 현재 코드에 누적된 34개의 전투 패치(battle-tested fixes)를 새 엔진에서 어떻게 처리하는가.
> "그대로 이식"이 아니라 **새 엔진에 맞는 최적 형태**로 재설계.

### Tier 1: Rust 엔진에 네이티브 설계 (7개 → 패치 아닌 설계)

현재는 JS 측 사후 보정이지만, 새 Rust 엔진에서는 **핵심 기능**으로 내장:

| 패치                  | 현재 (JS 패치)                              | 새 엔진 (Rust 네이티브)                               |
| --------------------- | ------------------------------------------- | ----------------------------------------------------- |
| 2-Pass Layout         | fullTreeLayout에서 사후 width 비교 + 재계산 | `compute_layout()` 내부에 pass1→width 검증→pass2 내장 |
| DFS Post-Order        | JS 수동 순회 (~100줄)                       | Rust 트리 순회가 네이티브 post-order                  |
| 변경 감지 (JSON+hash) | JSON.stringify 비교                         | `style_hash: u64` 필드, O(1) hash 비교                |
| Display 전환 감지     | JS에서 사전/사후 display 비교               | `update_style()` 반환값에 `NeedsFullRebuild` 포함     |
| Props Propagation     | JS registry + DFS 주입                      | Rust `propagation_rules` 테이블 내장                  |
| processedElementsMap  | JS 별도 Map 관리                            | Rust 노드에 `enriched_style` 필드 내장                |
| f32 정밀도 보정       | JS Math.ceil 사후 보정                      | Rust `ceil_to_pixel()` 유틸, 모든 측정에 자동 적용    |

```rust
// Rust Layout Engine — Tier 1 패치가 네이티브 기능으로 설계된 예시
impl LayoutEngine {
    pub fn compute_layout(&mut self, root: u32, avail_w: f32, avail_h: f32) {
        // Pass 1: post-order DFS (네이티브)
        self.compute_pass1(root, avail_w, avail_h);

        // Pass 2: width 불일치 노드 자동 재계산 (2-pass 내장)
        let dirty = self.collect_width_mismatch_nodes();
        if !dirty.is_empty() {
            self.re_enrich_and_recompute(&dirty);
        }
    }

    pub fn update_node_style(&mut self, handle: u32, style_json: &str) -> UpdateResult {
        let new_hash = hash_style(style_json);
        if new_hash == self.nodes[handle].style_hash {
            return UpdateResult::Unchanged;  // 변경 감지 O(1)
        }

        let old_display = self.nodes[handle].style.display;
        self.apply_style(handle, style_json);

        if old_display != self.nodes[handle].style.display {
            return UpdateResult::NeedsFullRebuild;  // display 전환 자동
        }

        self.nodes[handle].style_hash = new_hash;
        UpdateResult::Dirty
    }
}
```

**효과**: JS DFS/enrichment ~1500줄 → Rust 네이티브. JS-WASM 경계 횟수 감소.

### Tier 2: 하이브리드 텍스트로 구조적 제거 (4개 → 패치 삭제)

| 패치                        | 현재                    | 하이브리드로 왜 불필요한가                    |
| --------------------------- | ----------------------- | --------------------------------------------- |
| +1px sub-pixel buffer       | nodeRendererText.ts     | 측정=렌더 동일 Paragraph → 서브픽셀 차이 없음 |
| getMaxIntrinsicWidth() 교정 | nodeRendererText.ts     | 측정 시 CanvasKit이 정확한 값 반환            |
| Break Hint Tier 보정        | canvas2dSegmentCache.ts | Tier 1/2/3 전체 삭제 → 단순 \n 주입만 유지    |
| spread dilate/erode         | effects.ts              | G2에서 RRect 확대로 대체                      |

**효과**: ~200줄 보정 코드 삭제, canvas2dSegmentCache 612줄 → ~30줄.

### Tier 3: 하드코딩 → ComponentLayoutRegistry (13개 → 데이터 외부화)

현재 `enrichWithIntrinsicSize` ~1500줄의 if/else/switch를 **데이터 레지스트리**로 전환:

```typescript
// componentLayoutRegistry.ts (~200줄 데이터)
export const COMPONENT_LAYOUT_REGISTRY: Record<string, ComponentLayoutSpec> = {
  Button: {
    heightFormula: "max(paddingY*2 + textHeight, minHeight)",
    implicitStyles: { display: "flex", alignItems: "center", gap: "8px" },
    measurement: "spec-size-config",
  },
  Label: {
    inject: ["fontSize", "lineHeight"],
    injectCondition: "lineHeight == null", // fontSize 조건 아님 (CRITICAL)
    delegationParents: [
      "Switch",
      "Checkbox",
      "Radio",
      "DatePicker",
      "DateRangePicker",
    ],
    wrapperTags: ["CheckboxItems", "RadioItems"],
    sizeStyleSource: "LabelSpec.variants",
    suffixProviders: ["necessityIndicator"],
  },
  Tag: {
    contextProps: ["allowsRemoving"],
    paddingRule: "allowsRemoving ? { right: paddingY } : {}",
  },
  // ... 각 컴포넌트가 데이터 항목 (코드가 아님)
};

// enrichmentEngine.ts (~300줄 범용 엔진)
function enrichFromRegistry(
  element: Element,
  registry: ComponentLayoutSpec,
  context: EnrichmentContext,
): EnrichedElement {
  // 1. implicitStyles 적용
  // 2. inject 조건 확인 + 값 주입
  // 3. delegationParents 탐색
  // 4. suffixProviders 적용
  // 5. heightFormula 계산
  // 6. contextProps 수집
  // → 범용 로직, 컴포넌트 무관
}
```

|                         |        현재         |             ADR-900              |
| ----------------------- | :-----------------: | :------------------------------: |
| enrichWithIntrinsicSize |  ~1500줄 (if/else)  | ~200줄 데이터 + ~300줄 범용 엔진 |
| 새 컴포넌트 추가        |   코드 수정 필수    |   **레지스트리에 항목 추가만**   |
| 버그 발생 위치          | 30개 분기 중 어딘가 |         데이터 항목 1개          |
| 테스트                  |   컴포넌트별 개별   |   범용 엔진 1회 + 데이터 검증    |

### Tier 4: Skia 렌더러 그대로 유지 (10개)

CanvasKit 동작 특성 패치. 변경 불필요:

`halfLeading:true`, `fontFamilies resolveFamily`, `Paragraph 캐시 fontMgr 무효화`,
`forceStrutHeight:true`, `TokenRef 재귀 해석`, `Container dimension injection`,
`fontSize 우선순위`, `border stroke inset`, `MakeDropShadow`, `WASM 포맷 일관성`

### 종합 효과

| Tier                      |   수   | 코드 변화                           |
| ------------------------- | :----: | ----------------------------------- |
| **Tier 1: Rust 네이티브** |   7    | JS ~1500줄 → Rust 내장 (JS 측 삭제) |
| **Tier 2: 구조적 제거**   |   4    | ~800줄 삭제 (보정 로직 전체)        |
| **Tier 3: 데이터 외부화** |   13   | ~1500줄 → ~500줄 (데이터+범용엔진)  |
| **Tier 4: 렌더러 유지**   |   10   | 변경 0줄                            |
| **합계**                  | **34** | **~2,800줄 삭제 또는 구조 개선**    |

---

## 5. Layer 3: SceneGraph (Retained Mode)

### SceneNode 구조

```typescript
// sceneGraph/SceneNode.ts
interface SceneNode {
  // Identity
  id: string; // element ID
  tag: string; // HTML tag or component tag
  parentId: string | null;

  // Tree
  children: SceneNode[];
  childrenOrder: string[]; // ordered child IDs

  // Style (CSS properties → layout input)
  style: CSSStyleDeclaration; // 모든 CSS3 속성

  // Computed Layout (layout output)
  layout: ComputedLayout; // { x, y, width, height, ... }

  // Visual (Skia rendering input)
  visual: SceneNodeVisual; // fills, strokes, effects, transforms
  specShapes: SkiaNodeData[] | null; // spec-driven shapes

  // State
  dirty: DirtyFlags; // LAYOUT | VISUAL | CHILDREN | TRANSFORM
  visible: boolean; // viewport culling 결과
  stackingOrder: number; // z-index resolved

  // Interaction
  interactive: boolean; // pointer-events
  cursor: string;

  // Animation
  activeTransitions: Map<string, TransitionState> | null;
  activeAnimations: AnimationState[] | null;
}

// Dirty flags (비트 마스크)
const enum DirtyFlags {
  NONE = 0,
  LAYOUT = 1 << 0, // 레이아웃 재계산 필요
  VISUAL = 1 << 1, // 렌더링 재실행 필요
  CHILDREN = 1 << 2, // 자식 목록 변경
  TRANSFORM = 1 << 3, // transform 변경 (layout 불필요, 렌더만)
  SUBTREE = 1 << 4, // 하위 트리 전체 dirty
}
```

### SceneGraph 클래스

```typescript
// sceneGraph/SceneGraph.ts
class SceneGraph {
  private root: SceneNode; // DocumentNode
  private nodeMap: Map<string, SceneNode>; // O(1) lookup
  private dirtyNodes: Set<string>; // dirty 노드 수집
  private dirtyRegions: DirtyRegion[]; // 화면 dirty 영역

  // 노드 조작
  createNode(
    id: string,
    tag: string,
    style: CSSStyle,
    parentId: string,
  ): SceneNode;
  updateStyle(id: string, changes: Partial<CSSStyle>): void;
  updateVisual(id: string, visual: Partial<SceneNodeVisual>): void;
  moveNode(id: string, newParentId: string, index: number): void;
  removeNode(id: string): void;

  // Dirty 관리
  markDirty(id: string, flags: DirtyFlags): void;
  collectDirtySubtrees(): string[]; // layout 엔진에 전달할 dirty subtree roots
  clearDirty(): void;

  // 쿼리
  getNode(id: string): SceneNode | undefined;
  getVisibleNodes(viewport: DOMRect): SceneNode[]; // culling
  getNodesInRegion(rect: DOMRect): SceneNode[];

  // Stacking context
  resolveStackingOrder(): void;

  // Dirty region (렌더링용)
  getDirtyRegions(): DirtyRegion[];
  addDirtyRegion(rect: DOMRect): void;
}
```

### StoreBridge

Zustand Store 변경을 SceneGraph에 반영하는 브릿지. React 렌더 사이클을 우회.

```typescript
// sceneGraph/StoreBridge.ts
class StoreBridge {
  private graph: SceneGraph;
  private prevSnapshot: StoreSnapshot | null = null;
  private changeQueue: StoreChange[] = [];
  private unsubscribe: () => void;

  constructor(graph: SceneGraph, store: BuilderStore) {
    // Zustand subscribe로 변경 감지 (React 외부)
    this.unsubscribe = store.subscribe(
      (state) => this.onStoreChange(state),
      // selector: elementsMap, childrenMap, pageIndex만 구독
    );
  }

  private onStoreChange(state: BuilderState): void {
    // 변경사항을 큐에 추가 (RAF에서 일괄 처리)
    this.changeQueue.push(this.diffState(state));
  }

  // RAF에서 호출
  flush(): void {
    if (this.changeQueue.length === 0) return;

    for (const change of this.changeQueue) {
      switch (change.type) {
        case "create":
          this.graph.createNode(
            change.id,
            change.tag,
            change.style,
            change.parentId,
          );
          break;
        case "update":
          this.graph.updateStyle(change.id, change.styleChanges);
          if (change.visualChanges) {
            this.graph.updateVisual(change.id, change.visualChanges);
          }
          break;
        case "move":
          this.graph.moveNode(change.id, change.newParentId, change.index);
          break;
        case "remove":
          this.graph.removeNode(change.id);
          break;
      }
    }
    this.changeQueue.length = 0;
  }

  private diffState(state: BuilderState): StoreChange[] {
    // elementsMap diff → create/update/remove 변환
    // childrenMap diff → move 변환
    // 이전 스냅샷과 비교하여 최소 변경 계산
  }
}
```

---

## 6. Layer 4: SkiaRenderer 확장

### Dirty Region 렌더링

기존 `classifyFrame()` 5단계에 dirty region 최적화 추가:

```typescript
// 기존: content → 전체 contentSurface 재렌더
// 신규: content-partial → dirty region만 재렌더

classifyFrame(): FrameType {
  // ... 기존 idle/present/camera-only 로직 유지

  if (this.dirtyRegions.length > 0) {
    const totalDirtyArea = this.dirtyRegions.reduce((sum, r) => sum + r.area, 0);
    const totalArea = this.contentWidth * this.contentHeight;

    if (totalDirtyArea / totalArea < 0.3) {
      return 'content-partial';  // dirty region만 재렌더
    }
  }
  return 'content';  // 전체 재렌더 (dirty 비율 30% 초과)
}

renderContentPartial(canvas: Canvas, dirtyRegions: DirtyRegion[]): void {
  for (const region of dirtyRegions) {
    canvas.save();
    canvas.clipRect(region.toSkRect());

    // region 내 노드만 렌더
    const nodesInRegion = this.sceneGraph.getNodesInRegion(region);
    for (const node of nodesInRegion) {
      this.renderNode(canvas, node);
    }

    canvas.restore();
  }
}
```

### GPU Texture Cache

자주 변하지 않는 요소(이미지, 복잡한 그래디언트)를 GPU 텍스처로 캐싱:

```typescript
// skia/textureCache.ts
class GPUTextureCache {
  private cache: Map<string, CachedTexture>;
  private maxSize: number; // 최대 GPU 메모리 (기본 256MB)
  private currentSize: number;

  // 복잡한 노드를 오프스크린 서피스에 렌더 후 텍스처로 캐시
  cacheNode(
    nodeId: string,
    renderFn: (canvas: Canvas) => void,
    width: number,
    height: number,
  ): SkImage;

  // 캐시 히트
  getCachedTexture(nodeId: string, version: number): SkImage | null;

  // LRU 퇴출
  evict(): void;
}
```

---

## 7. Layer 5: Event System 재설계

### 현재 구조 (유지하는 부분)

```
DOM pointerdown/move/up (container div)
  → useCentralCanvasPointerHandlers
  → screenToCanvasPoint (zoom/pan 변환)
  → WASM SpatialIndex.hitTestPoint
  → resolveTopmostHitElementId
  → Zustand Store 업데이트
```

이 구조는 이미 PixiJS에 의존하지 않으므로 **대부분 유지**.

### 변경 사항

1. **PixiJS 이벤트 제거**: ElementSprite의 `onPointerDown/Over/Up/Leave` → SceneGraph에서 직접 처리

```typescript
// events/HoverManager.ts
class HoverManager {
  private graph: SceneGraph;
  private currentHoverId: string | null = null;

  onPointerMove(canvasPoint: Point): void {
    const hitIds = spatialIndex.hitTestPoint(canvasPoint.x, canvasPoint.y);
    const topId = resolveTopmostHitElementId(hitIds);

    if (topId !== this.currentHoverId) {
      if (this.currentHoverId) {
        this.graph.getNode(this.currentHoverId)?.setPreviewState(null);
      }
      if (topId) {
        this.graph.getNode(topId)?.setPreviewState("hover");
      }
      this.currentHoverId = topId;
    }
  }
}
```

2. **Cursor 관리**: PixiJS sprite cursor → DOM canvas element cursor

```typescript
// events/CursorManager.ts
class CursorManager {
  private canvasEl: HTMLCanvasElement;

  updateCursor(nodeId: string | null, handleHit: HandlePosition | null): void {
    if (handleHit) {
      this.canvasEl.style.cursor = handleToCursor(handleHit);
    } else if (nodeId) {
      const node = sceneGraph.getNode(nodeId);
      this.canvasEl.style.cursor = node?.cursor ?? "default";
    } else {
      this.canvasEl.style.cursor = "default";
    }
  }
}
```

3. **카메라 관리**: PixiJS Container → 순수 상태 객체

```typescript
// viewport/Camera.ts
class Camera {
  x: number = 0;
  y: number = 0;
  zoom: number = 1;

  screenToCanvas(screenX: number, screenY: number, canvasRect: DOMRect): Point {
    return {
      x: (screenX - canvasRect.left - this.x) / this.zoom,
      y: (screenY - canvasRect.top - this.y) / this.zoom,
    };
  }

  applyToCanvas(canvas: SkiaCanvas): void {
    canvas.translate(this.x, this.y);
    canvas.scale(this.zoom, this.zoom);
  }
}
```

---

## 8. Layer 6: CSS3 렌더링 확장

### 8.0 CSS 시각 정합성 갭 수정 (렌더링 감사 2026-04-06)

> 기존 Skia 렌더러의 CSS 정합성 감사에서 발견된 7개 갭. Phase 3에서 수정. 총 ~241줄.

#### G1: box-shadow + border-radius 정합성 (HIGH)

**현재**: shadow가 직사각형 bounds에 렌더 → border-radius 무시
**CSS 스펙**: shadow는 border-radius 윤곽을 따라야 함

```typescript
// nodeRendererBorders.ts 수정 — shadow 렌더 시 RRect 클리핑 적용
function renderBoxShadow(
  ck: CanvasKit,
  canvas: Canvas,
  node: SkiaNodeData,
): void {
  for (const shadow of node.shadows) {
    canvas.save();

    if (shadow.inner && node.borderRadius) {
      // inset shadow: RRect 안쪽만
      canvas.clipRRect(
        ck.RRectXY(node.bounds, node.borderRadius[0], node.borderRadius[1]),
        ck.ClipOp.Intersect,
        true,
      );
    }

    // shadow를 border-radius에 맞는 RRect로 렌더
    const shadowBounds = shadow.inner
      ? node.bounds
      : expandRect(node.bounds, shadow.spread);
    const shadowRRect = ck.RRectXY(
      shadowBounds,
      (node.borderRadius?.[0] ?? 0) + (shadow.spread ?? 0),
      (node.borderRadius?.[1] ?? 0) + (shadow.spread ?? 0),
    );

    const paint = new ck.Paint();
    paint.setColor(shadow.color);
    paint.setImageFilter(
      ck.ImageFilter.MakeBlur(
        shadow.blur / 2.355,
        shadow.blur / 2.355, // G3 수정 반영
        ck.TileMode.Decal,
        null,
      ),
    );
    canvas.translate(shadow.dx, shadow.dy);
    canvas.drawRRect(shadowRRect, paint);

    canvas.restore();
  }
}
```

**참조**: React Native Skia `BoxShadowView` 패턴 — RRect shadow 직접 draw.

#### G2: box-shadow spread 정확도 (MEDIUM)

**현재**: `MakeDilate/MakeErode` (형태 왜곡)
**CSS 스펙**: spread = 박스를 확대/축소 → 그 위에 blur

```typescript
// 현재 (부정확)
inputFilter = ck.ImageFilter.MakeDilate(spread, spread, null);

// 수정: RRect 크기를 spread만큼 확대/축소 후 직접 draw (G1과 통합)
const shadowBounds = expandRect(node.bounds, shadow.spread);
// → G1의 shadowRRect에서 이미 처리됨
```

**G1과 통합**: spread를 RRect 크기 확대로 처리하면 dilate/erode 불필요.

#### G3: blur sigma 공식 (1줄 수정)

**현재**: `sigma = radius / 2`
**CSS W3C**: `sigma = radius / (2 * sqrt(2 * ln(2)))` ≈ `radius / 2.355`

```typescript
// effects.ts, styleConverter.ts — 모든 blur sigma 계산 위치
// 변경 전
const sigma = blurRadius / 2;
// 변경 후
const CSS_BLUR_SIGMA_DIVISOR = 2.355; // W3C Gaussian: 2 * sqrt(2 * ln(2))
const sigma = blurRadius / CSS_BLUR_SIGMA_DIVISOR;
```

#### G4: text-shadow 구현 (2-pass 렌더링)

**현재**: 미구현
**CSS 스펙**: offset + blur + color의 shadow를 텍스트 아래에 렌더

```typescript
// nodeRendererText.ts 확장
function renderTextWithShadow(
  ck: CanvasKit,
  canvas: Canvas,
  node: SkiaNodeData,
  fontMgr: FontMgr,
): void {
  if (!node.textShadows?.length) {
    renderText(ck, canvas, node, fontMgr);
    return;
  }

  // Pass 1: 각 shadow를 오프셋+blur로 렌더
  for (const shadow of node.textShadows) {
    canvas.save();
    canvas.translate(shadow.offsetX, shadow.offsetY);

    if (shadow.blur > 0) {
      const blurPaint = new ck.Paint();
      blurPaint.setImageFilter(
        ck.ImageFilter.MakeBlur(
          shadow.blur / 2.355,
          shadow.blur / 2.355,
          ck.TileMode.Decal,
          null,
        ),
      );
      canvas.saveLayer(blurPaint);
    }

    // shadow 색상으로 텍스트 렌더
    const shadowNode = { ...node, fillColor: shadow.color };
    renderText(ck, canvas, shadowNode, fontMgr);

    if (shadow.blur > 0) canvas.restore(); // blur layer
    canvas.restore(); // translate
  }

  // Pass 2: 원본 텍스트
  renderText(ck, canvas, node, fontMgr);
}
```

#### G5: repeating-gradient (TileMode 분기)

**현재**: `TileMode.Clamp` 고정
**CSS 스펙**: `repeating-linear-gradient` 등은 `Repeat` 필요

```typescript
// fills.ts — gradient 생성 시
const tileMode = gradient.repeating ? ck.TileMode.Repeat : ck.TileMode.Clamp;
ck.Shader.MakeLinearGradient(start, end, colors, positions, tileMode);
```

#### G6: radial-gradient 키워드 변환

**현재**: pre-computed radii만 처리
**CSS 스펙**: `closest-side`, `farthest-corner` 등 키워드 → 수치 변환

```typescript
// fills.ts 또는 styleConverter.ts — radial gradient 전처리
function resolveRadialSize(
  keyword: string,
  cx: number,
  cy: number,
  width: number,
  height: number,
): { rx: number; ry: number } {
  switch (keyword) {
    case "closest-side":
      return { rx: Math.min(cx, width - cx), ry: Math.min(cy, height - cy) };
    case "farthest-side":
      return { rx: Math.max(cx, width - cx), ry: Math.max(cy, height - cy) };
    case "closest-corner":
      return cornersDistance(cx, cy, width, height, Math.min);
    case "farthest-corner": // CSS 기본값
    default:
      return cornersDistance(cx, cy, width, height, Math.max);
  }
}
```

#### G7: gradient oklab 색상 보간

**현재**: sRGB 보간 (gradient 색상 사이 직선 보간)
**CSS 모던 기본**: oklab 보간 (지각적으로 균일한 전환)

```typescript
// color/oklabInterpolation.ts (신규, ~80줄)
// sRGB → linear RGB → oklab 변환
function srgbToOklab(
  r: number,
  g: number,
  b: number,
): [number, number, number] {
  // sRGB → linear
  const lr = r <= 0.04045 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const lg = g <= 0.04045 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const lb = b <= 0.04045 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

  // linear RGB → oklab (Björn Ottosson 행렬)
  const l = Math.cbrt(
    0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb,
  );
  const m = Math.cbrt(
    0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb,
  );
  const s = Math.cbrt(
    0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb,
  );

  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

// gradient 색상 보간 시 oklab 경유
function interpolateGradientColors(
  colors: Float32Array[],
  positions: number[],
  steps: number,
): Float32Array[] {
  // 1. 모든 색상을 oklab으로 변환
  // 2. oklab 공간에서 선형 보간
  // 3. 결과를 sRGB로 역변환
  // 4. Skia gradient에 전달할 확장된 color stop 배열 반환
}
```

**적용**: gradient 생성 시 color stop을 oklab 보간으로 확장 후 Skia에 전달.

---

### 수정 후 정합성 전망

| 영역                 | 수정 전  | 수정 후  |
| -------------------- | :------: | :------: |
| gradient             |   85%    | **98%**  |
| box-shadow           |   70%    | **97%**  |
| blur/filter          |   90%    | **99%**  |
| text-shadow          |    0%    | **95%**  |
| **전체 시각 정합성** | **~82%** | **~97%** |

> 나머지 ~3%: 브라우저별 서브픽셀 antialiasing/hinting 차이 — 어떤 엔진에서도 100% 불가능한 영역.

---

### 8.1 신규 구현: backdrop-filter

```typescript
// nodeRendererEffects.ts (확장)
function renderBackdropFilter(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  filter: BackdropFilter,
): void {
  // 1. 현재 canvas 상태를 SaveLayer로 캡처
  const bounds = node.layout.toSkRect();
  const paint = new ck.Paint();

  // 2. backdrop 영역 추출 (뒤쪽 콘텐츠)
  canvas.saveLayer(bounds, null); // 기존 콘텐츠 캡처

  // 3. blur 적용
  const blurFilter = ck.ImageFilter.MakeBlur(
    filter.blur / 2.355, // G3 수정 반영
    filter.blur / 2.355,
    ck.TileMode.Clamp,
    null,
  );
  const backdropPaint = new ck.Paint();
  backdropPaint.setImageFilter(blurFilter);

  // 4. SaveLayerRec로 backdrop에 필터 적용
  canvas.saveLayer(bounds, backdropPaint);
  canvas.restore(); // backdrop layer
  canvas.restore(); // original save

  // 5. 전경 콘텐츠 렌더
  renderNodeContent(ck, canvas, node);
}
```

#### 8.2 text-shadow

> G4에서 구현됨 (2-pass 렌더링). 위 섹션 참조.

````

#### 8.3 mask-image

```typescript
// nodeRendererMask.ts (신규)
function renderWithMask(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  mask: MaskImage,
): void {
  const maskShader = createMaskShader(ck, mask, node.layout);
  const paint = new ck.Paint();
  paint.setShader(maskShader);
  paint.setBlendMode(ck.BlendMode.DstIn); // mask intersection

  canvas.saveLayer(null, null);
  renderNodeContent(ck, canvas, node); // 원본 콘텐츠
  canvas.saveLayer(null, paint); // mask 적용
  canvas.restore();
  canvas.restore();
}
````

#### 8.4 CSS Transitions

```typescript
// animation/TransitionEngine.ts
class TransitionEngine {
  private active: Map<string, Map<string, TransitionState>> = new Map();

  // 스타일 변경 시 transition 시작
  onStyleChange(
    nodeId: string,
    prop: string,
    from: number,
    to: number,
    duration: number,
    easing: EasingFn,
  ): void {
    const state: TransitionState = {
      prop,
      from,
      to,
      duration,
      easing,
      startTime: performance.now(),
      current: from,
    };
    if (!this.active.has(nodeId)) this.active.set(nodeId, new Map());
    this.active.get(nodeId)!.set(prop, state);
  }

  // RAF tick에서 호출
  tick(now: number): string[] {
    const dirtyNodeIds: string[] = [];

    for (const [nodeId, transitions] of this.active) {
      for (const [prop, state] of transitions) {
        const elapsed = now - state.startTime;
        const t = Math.min(elapsed / state.duration, 1);
        state.current = state.from + (state.to - state.from) * state.easing(t);

        if (t >= 1) {
          transitions.delete(prop);
        }
        dirtyNodeIds.push(nodeId);
      }
      if (transitions.size === 0) this.active.delete(nodeId);
    }
    return dirtyNodeIds;
  }
}
```

#### 8.5 CSS Animations (@keyframes)

```typescript
// animation/AnimationEngine.ts
interface KeyframeAnimation {
  name: string;
  keyframes: Keyframe[]; // { offset: 0~1, style: Partial<CSSStyle> }
  duration: number;
  iterationCount: number | "infinite";
  direction: "normal" | "reverse" | "alternate" | "alternate-reverse";
  fillMode: "none" | "forwards" | "backwards" | "both";
  easing: EasingFn;
}

class AnimationEngine {
  private active: Map<string, AnimationState[]> = new Map();

  start(nodeId: string, animation: KeyframeAnimation): void;
  tick(now: number): string[]; // dirty node IDs
  stop(nodeId: string, animationName: string): void;
  stopAll(nodeId: string): void;
}
```

#### 8.6 추가 필터 (sepia, invert)

```typescript
// effects.ts (확장)
function createSepiaMatrix(): Float32Array {
  return new Float32Array([
    0.393, 0.769, 0.189, 0, 0, 0.349, 0.686, 0.168, 0, 0, 0.272, 0.534, 0.131,
    0, 0, 0, 0, 0, 1, 0,
  ]);
}

function createInvertMatrix(): Float32Array {
  return new Float32Array([
    -1, 0, 0, 0, 1, 0, -1, 0, 0, 1, 0, 0, -1, 0, 1, 0, 0, 0, 1, 0,
  ]);
}
```

---

## 9. 텍스트 파이���라인 — 하이브리드 단일 소스 (ADR-051 Supersede)

> **핵심 문제**: 현재 빌더의 가장 큰 문제 — Canvas 2D와 CanvasKit의 텍스트 측정 차이로
> 의도하지 않은 줄바꿈, height 불일치, 부모 레이아웃 붕괴 발생.
>
> **해법**: Canvas 2D가 줄바꿈 **위치**를 결정(CSS 정합성), CanvasKit이 실제 **높이**를 반환(렌더 정합성).
> 두 정합성을 모두 달성. ADR-051의 복잡한 보정 체계(Tier 1/2/3)를 구조적으로 대체.

### 현재 문제 (이중 엔진 불일치)

```
Canvas 2D: "Click here to learn more" = 199px → 한 줄 → height 24px
CanvasKit:  "Click here to learn more" = 201px → "more" 줄바꿈 → height 48px

Taffy에 24px 전달 → 부모 24px → 실제 렌더 48px → 💥 넘침 + 레이아웃 붕괴
```

### 하이브리드 해법 (3단계)

```
Rust Layout Engine → JS 콜백 (measureTextForLayout)
  ↓
  단계 1: Canvas 2D 줄바꿈 결정 (CSS와 동일한 엔진)
    canvas2dLineBreak(text, style, maxWidth)
    → ["Click here to learn", "more"]  (CSS와 동일한 위치에서 줄바꿈)
  ↓
  단계 2: CanvasKit Paragraph에 Break Hint(\n) 주입
    "Click here to learn\nmore"
    paragraph.layout(maxWidth)
    → CanvasKit이 CSS와 동일한 위치에서 줄바꿈 (강제)
  ↓
  단계 3: CanvasKit 실제 높이를 Layout에 반환
    paragraph.getHeight() = 48px (렌더링 엔진의 정확한 값)
    Math.ceil(48.2) = 49px → Layout Engine에 반환
  ↓
  Paragraph 객체 캐시 (LRU) → 렌더링 시 재사용 (측정=렌더 동일 객체)
```

### 구현

```typescript
// text/hybridTextMeasure.ts

const paragraphCache = new LRUCache<
  string,
  {
    paragraph: Paragraph;
    width: number;
    height: number;
  }
>(2000);

function measureTextForLayout(
  text: string,
  styleJson: string,
  maxWidth: number,
): [number, number] {
  // [width, height] — WASM으로 반환
  const cacheKey = `${text}|${styleJson}|${maxWidth}`;
  const cached = paragraphCache.get(cacheKey);
  if (cached) return [cached.width, cached.height];

  const style = JSON.parse(styleJson);

  // ─── 단계 1: Canvas 2D로 줄바꿈 위치 결정 (CSS 정합성) ───
  const lines = canvas2dLineBreak(text, style, maxWidth);
  const hintedText = lines.join("\n");

  // ─── 단계 2: CanvasKit Paragraph에 Break Hint 적용 ───
  const ck = getCanvasKit();
  const fontMgr = getFontManager();

  const paraStyle = new ck.ParagraphStyle({
    textStyle: {
      fontSize: style.fontSize,
      fontFamilies: style.fontFamily.split(",").map((f: string) => f.trim()),
      fontStyle: { weight: style.fontWeight ?? 400 },
      heightMultiplier: style.lineHeight
        ? style.lineHeight / style.fontSize
        : undefined,
      halfLeading: true,
    },
    textAlign: mapTextAlign(style.textAlign),
  });

  const builder = ck.ParagraphBuilder.Make(paraStyle, fontMgr);
  builder.addText(hintedText);
  const paragraph = builder.build();
  paragraph.layout(maxWidth);

  // ─── 단계 3: CanvasKit 실제 치수 반환 (렌더 정합성) ───
  const width = Math.ceil(paragraph.getLongestLine());
  const height = Math.ceil(paragraph.getHeight());

  // 캐시 — 렌더링 시 이 Paragraph를 그대로 draw
  paragraphCache.set(cacheKey, { paragraph, width, height });

  return [width, height];
}

// ─── Canvas 2D 줄바꿈 결정 (기존 canvas2dSegmentCache.ts 재활용) ───
function canvas2dLineBreak(
  text: string,
  style: TextStyle,
  maxWidth: number,
): string[] {
  // Intl.Segmenter 토큰화
  // Canvas 2D measureText() 폭 캐시
  // Greedy line-breaking (CSS와 동일 알고리즘)
  // → 줄바꿈 위치 결정 → 줄 배열 반환
  // (기존 canvas2dSegmentCache.ts의 computeLines() 재활용)
}
```

### Skia 렌더링 — 캐시된 Paragraph 재사용

```typescript
// nodeRendererText.ts 수정
function renderText(
  ck: CanvasKit,
  canvas: Canvas,
  node: SkiaNodeData,
  fontMgr: FontMgr,
): void {
  const cacheKey = buildTextCacheKey(node);
  const cached = paragraphCache.get(cacheKey);

  if (cached) {
    // 측정 시 생성한 동일한 Paragraph → 0px 차이 보장
    canvas.drawParagraph(cached.paragraph, 0, 0);
    return;
  }

  // 캐시 미스 (드문 경우) — 새로 생성
  // ...
}
```

### 정합성 비교

|                         |         현재          |        ADR-051         |     ADR-900 하이브리드     |
| ----------------------- | :-------------------: | :--------------------: | :------------------------: |
| **줄바꿈 결정**         |       Canvas 2D       |       Canvas 2D        |         Canvas 2D          |
| **렌더링**              | CanvasKit (자체 판단) | CanvasKit (Break Hint) |   CanvasKit (Break Hint)   |
| **Layout height**       |   Canvas 2D 높이 ❌   |   Canvas 2D 높이 ❌    | **CanvasKit 실제 높이** ✅ |
| **측정=렌더 동일 객체** |          No           |           No           |  **Yes (Paragraph 캐시)**  |
| **CSS 줄바꿈 일치**     |          ✅           |           ✅           |             ✅             |
| **Canvas 내부 정합**    |   ❌ (24px vs 48px)   |       ⚠️ (~98%)        |     **✅ (0px 차이)**      |
| **CSS↔Canvas height**   |     ❌ 24px 차이      |        ⚠️ 수 px        |    **±1px** (Math.ceil)    |
| **부모 레이아웃 붕괴**  |        빈번 💥        |         간헐적         |       **불가능** ✅        |
| **코드 복잡도**         |           —           |   612줄 (Tier 1/2/3)   |         **~60줄**          |

### ADR-051 관계

ADR-900이 구현되면 ADR-051은 **Superseded**:

| ADR-051 구성요소                        | ADR-900에서                                                                 |
| --------------------------------------- | --------------------------------------------------------------------------- |
| canvas2dSegmentCache.ts (612줄)         | `canvas2dLineBreak()` ~30줄로 축소 (줄바꿈 결정만 재활용, Tier 보정 불필요) |
| Break Hint Injection                    | 유지 (하이브리드 단계 2)                                                    |
| Tier 1 lineFitEpsilon                   | **삭제** (CanvasKit 높이 사용으로 불필요)                                   |
| Tier 2 Line Verification                | **삭제** (CanvasKit이 진실)                                                 |
| Tier 3 Semantic Preprocessing           | **삭제** (CanvasKit이 진실)                                                 |
| post-layout getMaxIntrinsicWidth() 교정 | **삭제** (측정=렌더 동일 객체)                                              |
| `needsFallback()` 분기                  | **삭제** (모든 텍스트가 하이브리드 경로)                                    |
| **순 삭제: ~550줄, 보정 로직 전체**     |                                                                             |

---

## 10. 제거 대상 파일 목록

### 완전 삭제

```
apps/builder/src/builder/workspace/canvas/
├── pixiSetup.ts                          # PixiJS 초기화
├── sprites/
│   ├── ElementSprite.tsx                  # ~3200줄
│   ├── BoxSprite.tsx                      # ~150줄
│   ├── TextSprite.tsx                     # ~100줄
│   └── ImageSprite.tsx                    # ~100줄
├── components/
│   ├── ClickableBackground.tsx            # pixi 배경
│   ├── ElementsLayer.tsx                  # pixi 트리 (layout 로직은 이전)
│   └── PageContainer.tsx                  # pixi 페이지
├── selection/
│   ├── SelectionBox.tsx                   # pixi 선택 (Skia overlay로 대체)
│   └── (pixi 관련 부분)
└── types/pixi-react.d.ts                 # 타입

packages/layout-flow/ (또는 Taffy WASM 관련)
└── (Taffy 패키지 전체 → 새 composition-layout crate로 대체)

wasm-bindings/
└── taffyLayout.ts                        # → layoutEngine.ts로 교체

layout/engines/
├── BaseTaffyEngine.ts                    # 삭제
├── TaffyFlexEngine.ts                    # 삭제
├── TaffyGridEngine.ts                    # 삭제
├── TaffyBlockEngine.ts                   # 삭제
└── persistentTaffyTree.ts                # 삭제
```

### 패키지 의존성 제거

```json
// package.json에서 제거
"pixi.js": "^8.14.3",
"@pixi/react": "^8.x",
"@pixi/layout": "(이미 제거됨)"
```

---

## 11. Phase 계획 (ROI 다이어트 후 — 14주)

> 원본 21주 → 14주. Float/Inline(4주) + Table/Multicol(4주) 삭제, Sticky만 Phase 3에 통합.
> 검증 기법: Figma(벤치마크 선행) + Google(WPT 준수) + Meta(데이터 검증) 적용.

### Phase 0: 기반 준비 + 벤치마크 인프라 (1주)

- [ ] Shadow Engine 브랜치 생성 (`feature/unified-skia-engine`)
- [ ] **MotionMark 스타일 벤치마크 구축** (Figma 기법 — 벤치마크가 기능보다 먼저)
  - 10K 요소 스트레스 테스트 (매 프레임 10개 변경 → p50/p95/p99 측정)
  - 드래그 지연 측정 (pointerdown→렌더 완료)
  - 초기 로드 측정 (navigation start→first meaningful paint)
- [ ] 현재 성능 baseline 측정 (위 벤치마크로)
- [ ] **margin collapse 사용률 감사** (Meta 기법 — 데이터로 ROI 증명)
  - 전체 프로젝트 DB 스캔: block + adjacent margin 패턴 비율 측정
  - 예상 <0.1% → 의도적 미구현 확정
- [ ] GPU Backend 추상화 인터페이스 설계
- [ ] SceneGraph 타입 정의 + 단위 테스트 스캐폴딩
- [ ] Rust Layout Engine crate 초기화 + wasm-pack 빌드 파이프라인

**Gate G0**: baseline 측정 완료 + 벤치마크 자동화 + margin collapse <0.1% 확인 + WASM 빌드 동작

### Phase 1: Rust Layout Engine — Flex/Grid/Block 패리티 (4주)

- [ ] Taffy flex 알고리즘 포크 + 단위 테스트 이식
- [ ] Taffy grid 알고리즘 포크 + **grid-template-areas** (이미 구현됨, 테스트만)
- [ ] Block 레이아웃 (margin collapse 제외)
- [ ] **Tier 1 패치 Rust 네이티브 구현**:
  - `style_hash: u64` 변경 감지 (JSON 비교 대체, O(1))
  - `update_style()` → `UpdateResult::NeedsFullRebuild` (display 전환 자동 감지)
  - `ceil_to_pixel()` 유틸 (f32 보정 네이티브)
  - 2-pass layout 내장 (pass1 → width 검증 → pass2)
  - `enriched_style` 필드 (processedElementsMap 대체)
  - `propagation_rules` 테이블 (registry-based 전파)
- [ ] 텍스트 측정 하이브리드 JS 콜백 (Canvas 2D 줄바꿈 + CanvasKit 높이)
- [ ] Spatial Index 통합 (기존 WASM 코드 이식)
- [ ] 기존 Taffy 테스트 케이스 100% 통과 검증

**Gate G1**: flex/grid/block 레이아웃 기존 테스트 100% 통과 + Tier 1 패치 네이티브 동작

### Phase 2: SceneGraph + PixiJS 제거 (3주)

- [ ] SceneGraph 구현 (SceneNode, dirty flag, tree 관리)
- [ ] **타일 무효화 렌더링** (Figma/Penpot 기법 — dirty rect 대신 타일 캐시)
  - 256×256px 타일 분할
  - 변경 요소 → 교차 타일만 무효화
  - 나머지 타일 GPU 텍스처 blit (~0.1ms)
- [ ] StoreBridge 구현 (Zustand→SceneGraph 동기화)
- [ ] **Tier 3 ComponentLayoutRegistry** 구현
  - enrichWithIntrinsicSize 1500줄 → 데이터 ~200줄 + 범용 엔진 ~300줄
  - 컴포넌트별 implicit styles, injection 조건, delegation 규칙 데이터화
- [ ] GPU Backend (CanvasKitWebGLBackend) 구현
- [ ] SkiaRenderer를 SceneGraph에서 직접 렌더하도록 변경
- [ ] Event System 재설계 (HoverManager ~30줄, CursorManager ~15줄, Camera ~50줄)
- [ ] PixiJS 의존성 전체 제거
- [ ] **기능 파리티 78개 항목 전수 검증** (섹션 13 체크리스트)

**Gate G2**: PixiJS 없이 78개 기능 100% 동작 + 60fps 유지 + 벤치마크 회귀 없음

### Phase 3: Sticky + CSS3 렌더링 확장 (3주)

- [ ] **position: sticky** — post-layout 조정 (Chrome Blink 기법 — Taffy 수정 불필요)
  - stickyResolver: 스크롤 오프셋 → 3단계 상태 전환 (~50줄)
  - **WPT 스타일 테스트** (Google 기법): 브라우저 비교 5+ 케이스
- [ ] **position: fixed** — viewport 기준 배치
- [ ] **CSS 시각 정합성 갭 수정** (G1~G7, ~241줄):
  - G1: shadow + border-radius (RRect draw)
  - G2: box-shadow spread (RRect 확대)
  - G3: blur sigma 공식 (radius/2.355)
  - G4: text-shadow (2-pass 렌더링)
  - G5: repeating-gradient (TileMode.Repeat)
  - G6: radial-gradient 키워드 변환
  - G7: gradient oklab 보간
- [ ] backdrop-filter (SaveLayer + blur behind)
- [ ] mask-image (MaskFilter + RuntimeEffect)
- [ ] CSS transitions 엔진 (~130줄 자체 구현: cubic-bezier + spring + lerp)
  - **WPT + fuzzing 검증** (Google 기법): 기본 5종 + 랜덤 100종 bezier, 브라우저 비교
- [ ] CSS animations (@keyframes)
- [ ] sepia, invert 필터 (ColorMatrix)
- [ ] outline-style (dashed, dotted)

**Gate G3**: sticky WPT 통과 + 렌더링 확장 전부 동작 + easing 브라우저 비교 ≤0.001 오차 + 시각 정합성 82%→97%

### Phase 4: 성능 최적화 + 벤치마크 (2주)

- [ ] **MotionMark 벤치마크 실행** (Phase 0 baseline 대비):
  - 1000 요소: p95 ≥ 60fps
  - 5000 요소: p95 ≥ 50fps
  - 10000 요소: p95 ≥ 35fps
  - 드래그 지연: p95 < 8ms
- [ ] 타일 캐시 적중률 측정 (목표: 안정 상태 >95%)
- [ ] GPU texture cache 구현 + VRAM 사용량 측정
- [ ] WASM 바이너리 크기 최적화 (wasm-opt -Os)
- [ ] hot path 프로파일링 → 병목 식별 → 최적화
- [ ] **텍스트 하이브리드 측정 정합성 검증**:
  - 100개 다국어 텍스트 × 10개 폰트 × 5개 크기 = 5000 조합
  - CSS(Preview) 높이 vs CanvasKit 높이: ≤1px 오차
  - 줄바꿈 위치: 100% 일치

**Gate G4**: 모든 벤치마크 목표 달성 + 텍스트 정합성 검증 통과

### Phase 5: Shadow→Production 전환 (1주)

- [ ] **기능 파리티 78개 항목 최종 전수 검증**
- [ ] **시각 회귀 테스트** (pixelmatch):
  - 전체 컴포넌트 스펙 스크린샷 비교 (0.1% 미만 차이)
  - 다크/라이트 모드 양쪽
- [ ] 엣지 케이스 수정 (스크롤, 중첩 overflow, 복합 레이아웃)
- [ ] main 브랜치 머지 준비
- [ ] PixiJS/Taffy dead code 최종 정리
- [ ] ADR-003, ADR-008, ADR-051 → Superseded 상태 변경
- [ ] 문서 업데이트 (RENDERING_ARCHITECTURE.md, COMPONENT_SPEC.md)

**Gate G5**: 기능 78개 100% + 스크린샷 0.1% 미만 차이 + 벤치마크 baseline 이상 → production 전환

### 보류 Phase — CSS 기능 확장 (수요 발생 시)

- **Phase X-1: Multi-column** — column-count, column-width, column-gap, break rules
- **Phase X-2: Subgrid** — nested grid template inheritance
- **Phase X-3: Writing modes** — vertical-rl, direction: rtl, unicode-bidi

### 보류 Phase — Level 4 성능 스케일링 (10,000+ 요소, 별도 ADR)

> ADR-900은 Level 1~3 (5000 요소 50-60fps). Level 4는 10,000+ 요소 60fps 목표.
> 현재 설계가 Level 4를 차단하지 않음을 검증 완료 (ADR-900 확장 경로 섹션 참조).

- **Phase L4-1: Web Worker Layout** — Rust WASM Layout Engine을 Web Worker에서 실행. 메인 스레드 레이아웃 0ms. SharedArrayBuffer로 결과 전달 (zero-copy)
- **Phase L4-2: OffscreenCanvas Render** — CanvasKit 렌더링을 OffscreenCanvas Worker에서 실행. 메인 스레드 렌더 0ms. GPUBackend 추상화가 이미 지원
- **Phase L4-3: WASM SIMD** — `target-feature = "+simd128"` 활성화. 레이아웃 벡터 연산 4x 가속. Chrome 91+/Safari 16.4+ 지원
- **Phase L4-4: 커스텀 Rust 할당기** — `#[global_allocator]` wee_alloc 또는 bump 할당기. WASM 메모리 단편�� 제거, GC 압력 0

### 보류 Phase — Level 5 엔진 커스텀 (50,000+ 요소, 별도 ADR)

- **Phase L5-1: CanvasKit 커스텀 빌드** — 불필요 모듈 제거 (PDF, SVG 파서 등). WASM 6MB → ~3MB
- **Phase L5-2: WebGPU Compute Shader** — 레이아웃 연산을 GPU compute로 오프로드. 대규모 트리 병렬 처리
- **Phase L5-3: 커스텀 렌더 파이프라인** — Skia 우회, SceneGraph → WebGPU 직접 렌더. draw call 최소화

---

## 12. 성능 예산

### 목표 vs 현재 (실측 baseline: 2026-04-06, Apple M4 Pro)

| 메트릭              |             현재 (실측)              |     목표 (Unified Skia)      |   개선   |
| ------------------- | :----------------------------------: | :--------------------------: | :------: |
| WebGL 컨텍스트      |    **2** (1013×1172 + 1012×1172)     |              1               | -50% GPU |
| WASM 모듈           | 3 (CanvasKit + Taffy + SpatialIndex) | 2 (CanvasKit + LayoutEngine) |   -33%   |
| 아이들 FPS (요소 0) |  **p50=50, p95=48** ❌ (60fps 미달)  |            60fps             | **+20%** |
| 아이들 프레임타임   |        **p50=20ms, p95=21ms**        |            <10ms             | **-50%** |
| JS 힙 메모리        |          **154MB** (아이들)          |            ~80MB             | **-48%** |
| 페이지 로드 (HMR)   |              **734ms**               |            <500ms            |   -32%   |
| Canvas 크기         |   2×(~1013×1172) = 이중 GPU 텍스처   |        1×(~1013×1172)        | **-50%** |
| GPU                 |         Apple M4 Pro (Metal)         |             동일             |    —     |
| 1000 요소 FPS       |      추정 45-55fps (실측 대기)       |            60fps             | +15-30%  |
| 5000 요소 FPS       |      추정 20-30fps (실측 대기)       |           50-60fps           |  +100%   |
| 드래그 지연         |        추정 ~12ms (실측 대기)        |             <8ms             |   -33%   |
| 스타일 변경 → 렌더  |     **~20ms** (프레임타임 실측)      |            <10ms             |   -50%   |

> **핵심 발견**: M4 Pro(고사양)에서도 요소 0개 아이들 상태에서 50fps — 60fps 미달.
> Dual Renderer(PixiJS+Skia) 오버헤드가 프레임 예산 16.67ms 중 ~20ms를 소비.
> ADR-900의 근거가 실측으로 확인됨.
> | React 컴포넌트 수 (캔버스) | N (요소 수) | 0 | -100% |
> | JS 힙 메모리 | ~150MB (1000 요소) | ~80MB | -47% |
> | 번들 (PixiJS) | ~450KB (gzip) | 0 | -450KB |

### 프레임 예산 (16.67ms at 60fps)

```
StoreBridge.flush()          < 1ms   (diff + queue 처리)
Layout (dirty only)          < 3ms   (WASM compute_layout_incremental)
Transition tick              < 0.5ms (보간 계산)
Render (dirty region)        < 8ms   (Skia draw calls)
Overlay                      < 2ms   (selection, hover)
Present (GPU blit)           < 1ms   (surface composite)
─────────────────────────────────────
Total                        < 15.5ms ✓ (1.17ms 여유)
```

---

## 13. 기능 파리티 체크리스트 + 테스트 전략

> **원칙: 현재 동작하는 기능 중 하나라도 안 되면 전환 불가.**
> 전수조사(2026-04-06) 기반 78개 기능 항목. 각 Phase Gate에서 해당 항목 전부 통과 필수.

### 13.1 선택 인터랙션 (5항목)

| #   | 기능                        | 현재 경로                           | 대체 경로                          | 검증 방법                                   |
| --- | --------------------------- | ----------------------------------- | ---------------------------------- | ------------------------------------------- |
| S1  | 단일 클릭 선택              | DOM → hitTest → store               | 동일 (PixiJS 무관)                 | E2E: 요소 클릭 → selectedElementIds 확인    |
| S2  | 멀티 선택 (Ctrl/Cmd+클릭)   | DOM → hitTest → toggle              | 동일                               | E2E: Ctrl+클릭 → 복수 선택 확인             |
| S3  | 라쏘 선택 (드래그)          | DOM → lasso rect → queryRect        | 동일                               | E2E: 빈 영역 드래그 → 교차 요소 전부 선택   |
| S4  | 더블클릭 (텍스트 편집 진입) | DOM → isDoubleClick → startEdit     | 동일                               | E2E: 텍스트 더블클릭 → TextEditOverlay 표시 |
| S5  | 배경 클릭 (선택 해제)       | DOM → hitTest miss → clearSelection | HoverManager miss → clearSelection | E2E: 빈 영역 클릭 → 선택 해제               |

### 13.2 드래그 (6항목)

| #   | 기능                   | 현재 경로                      | 대체 경로                           | 검증 방법                                 |
| --- | ---------------------- | ------------------------------ | ----------------------------------- | ----------------------------------------- |
| D1  | 요소 이동              | DOM pointermove → store update | StoreBridge → SceneGraph dirty      | E2E: 드래그 → 위치 변경 확인              |
| D2  | 리사이즈 (8핸들)       | hitTestHandle → resize         | SpatialIndex handle bounds → resize | E2E: 각 핸들 드래그 → 크기 변경           |
| D3  | 드래그 임계값 (3px)    | DRAG_THRESHOLD=3               | 동일 상수 유지                      | E2E: 1px 이동 → 드래그 아님, 4px → 드래그 |
| D4  | 컨테이너 간 이동       | dropTargetResolver             | 동일 (PixiJS 무관)                  | E2E: 요소를 다른 컨테이너로 드래그        |
| D5  | 드래그 시각 효과       | setDragVisualOffset (Skia)     | 동일                                | 시각 확인: 드래그 중 요소 위치 오프셋     |
| D6  | 형제 vacate 애니메이션 | setDragSiblingOffsets (Skia)   | 동일                                | 시각 확인: 드래그 중 형제 이동            |

### 13.3 뷰포트 (6항목)

| #   | 기능                  | 현재 경로                            | 대체 경로                   | 검증 방법                           |
| --- | --------------------- | ------------------------------------ | --------------------------- | ----------------------------------- |
| V1  | 휠 줌 (Ctrl+Wheel)    | ViewportController → Container.scale | Camera.zoom → Skia scale    | E2E: Ctrl+휠 → 줌 변경              |
| V2  | 핀치 줌               | ViewportController                   | Camera.zoom                 | 터치 디바이스 수동 테스트           |
| V3  | 스페이스+드래그 팬    | ViewportController → Container.x/y   | Camera.x/y → Skia translate | E2E: Space+드래그 → 팬              |
| V4  | 줌 focal point        | 커서 위치 기준 줌                    | 동일 수학                   | E2E: 줌 후 커서 아래 요소 위치 유지 |
| V5  | 줌 한계 (0.1x~5x)     | ViewportController min/max           | Camera min/max              | E2E: 한계 초과 줌 시도 → 제한       |
| V6  | Zoom to fit/selection | ViewportController.setPosition       | Camera.setPosition          | E2E: 단축키 → 뷰포트 이동           |

### 13.4 텍스트 편집 (5항목)

| #   | 기능                          | 현재 경로                        | 대체 경로                       | 검증 방법                           |
| --- | ----------------------------- | -------------------------------- | ------------------------------- | ----------------------------------- |
| T1  | 인라인 편집 (TextEditOverlay) | DOM overlay, 이미 PixiJS 무관    | 동일                            | E2E: 더블클릭 → 텍스트 입력         |
| T2  | 오버레이 위치 동기화          | layout position → screen coords  | SceneGraph.node.layout → screen | E2E: 줌/팬 후 오버레이 위치 정확    |
| T3  | Skia 텍스트 숨김/표시         | editingElementId → Skia skip     | 동일 (nodeRendererState)        | 시각 확인: 편집 중 이중 텍스트 없음 |
| T4  | 편집 취소 (Escape)            | cancelEdit → 원복                | 동일                            | E2E: Escape → 변경 전 텍스트        |
| T5  | 히스토리 기록                 | completeEdit → addBatchDiffEntry | 동일                            | E2E: 편집 완료 → Undo로 원복        |

### 13.5 호버/커서 (5항목)

| #   | 기능                            | 현재 경로                        | 대체 경로                                 | 검증 방법                              |
| --- | ------------------------------- | -------------------------------- | ----------------------------------------- | -------------------------------------- |
| H1  | 요소 호버 하이라이트            | PixiJS pointerOver → Skia render | **HoverManager** → SceneGraph → Skia      | 시각 확인: 마우스오버 시 파란 외곽선   |
| H2  | 핸들 호버 커서 변경             | PixiJS cursor prop               | **CursorManager** → canvasEl.style.cursor | E2E: 핸들 위 → nw-resize 커서          |
| H3  | 중첩 요소 호버 (최소 면적)      | hitTest → smallest bounds        | 동일 알고리즘                             | E2E: 중첩된 요소 중 가장 안쪽 선택     |
| H4  | 컨테이너 hover (dashed outline) | hoverRenderer dashed=true        | 동일 (Skia)                               | 시각 확인: 그룹 호버 시 점선           |
| H5  | 컴포넌트 프리뷰 상태            | PixiJS → setPreviewState → Skia  | **HoverManager → setPreviewState**        | 시각 확인: Button hover/pressed 스타일 |

### 13.6 시각 피드백 (6항목)

| #   | 기능                            | 현재 경로                  | 대체 경로 | 검증 방법                       |
| --- | ------------------------------- | -------------------------- | --------- | ------------------------------- |
| F1  | 선택 박스 (파란 외곽선)         | Skia selectionRenderer     | 동일      | 시각 확인                       |
| F2  | 리사이즈 핸들 (4 코너 + 4 엣지) | Skia selectionRenderer     | 동일      | 시각 확인: 8개 핸들 위치/크기   |
| F3  | 드롭 인디케이터                 | Skia dropIndicatorRenderer | 동일      | 시각 확인: 드래그 중 삽입 라인  |
| F4  | 그리드/스냅                     | Skia gridRenderer          | 동일      | 시각 확인: 줌별 그리드 간격     |
| F5  | 치수 라벨 (W×H)                 | Skia selectionRenderer     | 동일      | 시각 확인: 선택 아래 크기 표시  |
| F6  | 오버플로우 해칭 패턴            | Skia hoverRenderer         | 동일      | 시각 확인: overflow:hidden 영역 |

### 13.7 멀티페이지 (5항목)

| #   | 기능                    | 현재 경로                         | 대체 경로         | 검증 방법                            |
| --- | ----------------------- | --------------------------------- | ----------------- | ------------------------------------ |
| M1  | 다중 페이지 동시 렌더링 | visiblePageRoots → Skia           | 동일              | 시각 확인: 2+ 페이지 동시 표시       |
| M2  | 뷰포트 컬링             | useViewportCulling → spatialIndex | 동일              | 성능 측정: 화면 밖 페이지 렌더 안 함 |
| M3  | 페이지 드래그 리오더    | usePageDrag                       | 동일 (DOM 기반)   | E2E: 페이지 드래그 → 순서 변경       |
| M4  | 페이지 프레임 라벨      | Skia selectionRenderer            | 동일              | 시각 확인: 페이지 제목 + 요소 수     |
| M5  | 5000+ 요소 60fps        | 현재 20-30fps                     | **목표 50-60fps** | 성능 벤치마크                        |

### 13.8 스크롤/오버플로우 (4항목)

| #   | 기능                      | 현재 경로                       | 대체 경로       | 검증 방법                             |
| --- | ------------------------- | ------------------------------- | --------------- | ------------------------------------- |
| O1  | overflow:hidden 클리핑    | Skia clipRect/clipPath          | 동일            | 시각 확인: 자식이 부모 밖으로 안 보임 |
| O2  | overflow:scroll 스크롤    | useScrollWheelInteraction       | 동일 (DOM 기반) | E2E: 스크롤 → scrollTop 변경          |
| O3  | 스크롤바 렌더링           | Skia renderScrollbar            | 동일            | 시각 확인: 수직/수평 스크롤바         |
| O4  | 스크롤 위치 → Skia 오프셋 | scrollOffset → canvas.translate | 동일            | 시각 확인: 스크롤 시 콘텐츠 이동      |

### 13.9 렌더링 (11항목)

| #   | 기능                               | 변경 여부 | 검증 방법              |
| --- | ---------------------------------- | :-------: | ---------------------- |
| R1  | 박스 (fill + border + radius)      |   유지    | 스크린샷 비교          |
| R2  | 텍스트 (Paragraph + 줄바꿈)        |   유지    | 스크린샷 비교          |
| R3  | 이미지 (object-fit + placeholder)  |   유지    | 스크린샷 비교          |
| R4  | 효과 (opacity, blur, shadow)       |   유지    | 스크린샷 비교          |
| R5  | 블렌드 모드 (18종)                 |   유지    | 스크린샷 비교          |
| R6  | 그래디언트 (linear, radial, conic) |   유지    | 스크린샷 비교          |
| R7  | 클리핑 (rect, path, rrect)         |   유지    | 스크린샷 비교          |
| R8  | 아이콘 Path 렌더링                 |   유지    | 스크린샷 비교          |
| R9  | Arc 셰이프 (ProgressCircle)        |   유지    | 스크린샷 비교          |
| R10 | 다크/라이트 모드                   |   유지    | 양쪽 모드 스크린샷     |
| R11 | Spec shapes (컴포넌트 비주얼)      |   유지    | 전체 컴포넌트 스크린샷 |

### 13.10 성능 최적화 (6항목)

| #   | 기능                                 | 변경 여부 | 검증 방법                              |
| --- | ------------------------------------ | :-------: | -------------------------------------- |
| P1  | Camera-only 최적화 (<1ms)            |   유지    | FPS 측정: 팬/줌 중 프레임 타임         |
| P2  | Dual-surface 캐싱                    |   유지    | 프로파일링: contentSurface 재사용 확인 |
| P3  | Paragraph 캐시 (LRU 1000)            |   유지    | 메모리 측정: 캐시 히트율               |
| P4  | 이미지 캐시                          |   유지    | 메모리 측정: 중복 로드 없음            |
| P5  | Cleanup render debounce (200ms)      |   유지    | 시각 확인: 팬 정지 후 선명해짐         |
| P6  | Render invalidation (7 reason types) |   유지    | 로그 확인: invalidation 추적           |

### 13.11 키보드/기타 (5항목)

| #   | 기능                   |       변경 여부       | 검증 방법                      |
| --- | ---------------------- | :-------------------: | ------------------------------ |
| K1  | Escape (드래그 취소)   |  유지 (DOM keydown)   | E2E: 드래그 중 Escape → 원위치 |
| K2  | Delete (요소 삭제)     |   유지 (캔버스 밖)    | E2E: 선택 후 Delete → 삭제     |
| K3  | Undo/Redo              | 유지 (historyManager) | E2E: 변경 → Ctrl+Z → 원복      |
| K4  | 워크플로우 엣지 렌더링 |      유지 (Skia)      | 시각 확인                      |
| K5  | 미니맵                 |      유지 (Skia)      | 시각 확인                      |

---

### 총 78개 항목 요약

| 카테고리          | 항목 수 |     PixiJS 의존     |          대체 필요           |
| ----------------- | :-----: | :-----------------: | :--------------------------: |
| 선택 인터랙션     |    5    |  1 (S5 배경 클릭)   |         HoverManager         |
| 드래그            |    6    |          0          |              —               |
| 뷰포트            |    6    | 3 (V1,V3,V6 카메라) |        Camera 클래스         |
| 텍스트 편집       |    5    |          0          |              —               |
| 호버/커서         |    5    |    **5 (전부)**     | HoverManager + CursorManager |
| 시각 피드백       |    6    |          0          |              —               |
| 멀티페이지        |    5    |          0          |              —               |
| 스크롤/오버플로우 |    4    |          0          |              —               |
| 렌더링            |   11    |          0          |              —               |
| 성능 최적화       |    6    |          0          |              —               |
| 키보드/기타       |    5    |          0          |              —               |
| **합계**          | **64**  |     **9** (12%)     |       **~125줄 코드**        |

**78개 중 69개(88%)는 PixiJS에 의존하지 않아 변경 불필요.**
**9개(12%)만 대체 필요하며, 대체 코드는 ~125줄.**

### 13.12 자동화 테스트 전략

```
Phase별 Gate 통과 조건:
├─ E2E 테스트 (Playwright)
│   ├─ 선택: S1~S5 전부 자동화
│   ├─ 드래그: D1~D3 자동화, D4~D6 수동
│   ├─ 뷰포트: V1,V3,V5 자동화
│   └─ 텍스트: T1,T4,T5 자동화
│
├─ 시각 회귀 테스트 (pixelmatch)
│   ├─ R1~R11 전체 컴포넌트 스크린샷 비교
│   ├─ F1~F6 시각 피드백 스크린샷
│   └─ 허용 오차: 0.1% 미만 픽셀 차이
│
├─ 성능 벤치마크
│   ├─ P1: camera-only 프레임 <1ms
│   ├─ M5: 1000 요소 60fps (p95)
│   ├─ 드래그 지연 <8ms (p95)
│   └─ 초기 로드 <1.5초
│
└─ 레이아웃 패리티
    ├─ Taffy 기존 테스트 100% 통과
    └─ sticky: CSS 비교 테스트 (≤1px)
```

---

## 14. Baseline 실측 데이터 프레임워크

> **원칙: 추정 수치로 결정하지 않는다.** 모든 성능 수치는 실측으로 교체.
> 기존 `gpuProfilerCore.ts` + `GPUDebugOverlay.tsx` 인프라를 확장.

### 14.1 측정 항목 + 방법

| 메트릭                   | 측정 방법                                                    | 도구                | 수집 시점                        |
| ------------------------ | ------------------------------------------------------------ | ------------------- | -------------------------------- |
| **FPS (p50/p95/p99)**    | gpuProfilerCore.ts 60프레임 샘플링                           | 기존 GPUProfiler    | Phase 0 baseline + 매 Phase Gate |
| **프레임타임 breakdown** | SkiaOverlay.tsx renderFrame 내 `performance.now()` 구간 측정 | 기존 코드 확장      | Phase 0                          |
| **드래그 지연**          | pointerdown → 다음 requestAnimationFrame 완료까지            | 커스텀 측정         | Phase 0                          |
| **초기 로드**            | navigationStart → SkiaOverlay 첫 렌더 완료                   | Performance API     | Phase 0                          |
| **JS 힙 메모리**         | `performance.memory.usedJSHeapSize`                          | Chrome DevTools API | Phase 0                          |
| **GPU 메모리**           | `WEBGL_debug_renderer_info` + 텍스처 크기 합산               | GPUDebugOverlay     | Phase 0                          |
| **WebGL 컨텍스트 수**    | `document.querySelectorAll('canvas')` + getContext 호출 수   | 수동 확인           | Phase 0                          |
| **WASM 초기화 시간**     | 각 WASM 모듈 `init()` 전후 `performance.now()`               | 기존 initRustWasm   | Phase 0                          |
| **스케일링 지수(b)**     | 100/500/1K/2K/5K 요소에서 프레임타임 → log-log 회귀          | 벤치마크 스크립트   | Phase 0 + 매 Phase               |

### 14.2 벤치마크 시나리오

```typescript
// benchmarks/canvasStress.ts — Phase 0에서 구축, 이후 매 Phase 실행
const SCENARIOS = [
  // 정적 렌더링
  { name: "static-100", elements: 100, mutations: 0, duration: 5000 },
  { name: "static-1000", elements: 1000, mutations: 0, duration: 5000 },
  { name: "static-5000", elements: 5000, mutations: 0, duration: 5000 },

  // 실시간 변경 (매 프레임 N개 스타일 변경)
  { name: "mutate-1000x10", elements: 1000, mutations: 10, duration: 5000 },
  { name: "mutate-5000x10", elements: 5000, mutations: 10, duration: 5000 },

  // 드래그 시뮬레이션
  { name: "drag-500", elements: 500, drag: true, duration: 3000 },
  { name: "drag-2000", elements: 2000, drag: true, duration: 3000 },

  // 줌/팬
  { name: "zoom-1000", elements: 1000, zoom: true, duration: 3000 },

  // 멀티페이지
  { name: "multipage-3x1000", pages: 3, elementsPerPage: 1000, duration: 5000 },
];
```

### 14.3 문서 내 추정치 → 실측치 교체 맵

| 위치                                   | 현재 (추정) | Phase 0에서 교체할 값 |
| -------------------------------------- | ----------- | --------------------- |
| 성능 예산 표 "현재 1000 요소 FPS"      | 45-55fps    | `static-1000` p50/p95 |
| 성능 예산 표 "현재 드래그 지연"        | ~12ms       | `drag-500` p95        |
| 성능 예산 표 "현재 JS 힙"              | ~150MB      | `static-1000` 힙 측정 |
| 성능 예산 표 "현재 초기 로드"          | ~2.5초      | Performance API 실측  |
| 프레임 예산 "React reconcile 5-8ms"    | 추정        | renderFrame breakdown |
| 프레임 예산 "PixiJS sprite sync 3-5ms" | 추정        | renderFrame breakdown |
| 스케일링 지수                          | 없음        | log-log 회귀 b 값     |

---

## 15. 점진적 전달 전략 — Feature Flag 기반

> **원칙: Shadow 빅뱅 전환이 아니라, 매주 사용자에게 가치를 전달한다.**

### 15.1 Feature Flag 체계

```typescript
// featureFlags.ts
export const UNIFIED_ENGINE_FLAGS = {
  // Phase 1: Layout Engine 교체 (내부, 사용자 무영향)
  USE_RUST_LAYOUT_ENGINE: false, // Taffy fork WASM

  // Phase 2: PixiJS 점진 제거 (각 단계별 독립 배포)
  USE_DOM_HOVER: false, // PixiJS hover → HoverManager
  USE_DOM_CURSOR: false, // PixiJS cursor → CursorManager
  USE_CAMERA_OBJECT: false, // PixiJS Container → Camera 클래스
  USE_SCENE_GRAPH: false, // @pixi/react 트리 → SceneGraph
  REMOVE_PIXI: false, // PixiJS 완전 제거 (위 4개 모두 true일 때)

  // Phase 3: 렌더링 확장 (점진 활성화)
  USE_HYBRID_TEXT: false, // 하이브리드 텍스트 측정
  USE_TILE_CACHE: false, // 타일 무효화 렌더링

  // 전체 전환
  UNIFIED_ENGINE: false, // 위 모든 flag를 한번에 활성화
} as const;
```

### 15.2 점진 배포 일정

```
Week 2: USE_DOM_HOVER=true → 배포
  효과: PixiJS hover 이벤트 제거. 사용자 무체감. 메모리 -5%.
  검증: H1~H5 기능 파리티 + 벤치마크.

Week 3: USE_DOM_CURSOR=true + USE_CAMERA_OBJECT=true → 배포
  효과: PixiJS cursor/camera 제거. 사용자 무체감.
  검증: V1~V6, H2 기능 파리티.

Week 5: USE_RUST_LAYOUT_ENGINE=true → 배포 (A/B 10%)
  효과: Taffy → fork 교체. 레이아웃 동일해야 함.
  검증: 레이아웃 패리티 테스트 + 10% 사용자 모니터링.

Week 7: USE_SCENE_GRAPH=true → 배포 (A/B 10%)
  효과: @pixi/react 트리 제거. fps 향상 시작.
  검증: 78개 기능 파리티 + fps 벤치마크.

Week 8: REMOVE_PIXI=true → 배포 (A/B 10% → 50%)
  효과: PixiJS 완전 제거. WebGL -1, 메모리 -50%.
  검증: 전체 벤치마크 + 50% 사용자 모니터링.

Week 10: USE_HYBRID_TEXT=true → 배포
  효과: 텍스트 줄바꿈 붕괴 해결.
  검증: 텍스트 정합성 5000 조합.

Week 12: USE_TILE_CACHE=true → 배포
  효과: 5000 요소 성능 도달.
  검증: 스케일링 지수 b < 0.8.

Week 14: UNIFIED_ENGINE=true → 전체 전환 (100%)
  이전 코드 경로 soft-delete (6주 후 hard-delete).
```

### 15.3 A/B 비교 자동화

```typescript
// 매 배포 시 A/B 비교 수집
interface ABMetrics {
  flagName: string;
  userGroup: "control" | "treatment";
  fps_p50: number;
  fps_p95: number;
  dragLatency_p95: number;
  errorRate: number; // 콘솔 에러/분
  layoutMismatch: number; // Preview↔Canvas 불일치 건수
}
```

---

## 16. 롤백 전략

> **원칙: 어떤 Phase에서든 이전 상태로 즉시 복원 가능해야 한다.**

### 16.1 Feature Flag 롤백

```
문제 발견 시:
  1. 해당 flag를 false로 변경 (서버 설정 또는 환경 변수)
  2. 사용자는 다음 페이지 로드에서 이전 경로로 자동 전환
  3. 새 코드와 이전 코드가 공존하므로 즉시 롤백 가능

롤백 시간: < 1분 (flag 변경 + CDN 캐시 무효화)
```

### 16.2 Phase별 롤백 시나리오

| Phase | 실패 시나리오               | 롤백 방법                                   |   영향 범위   |
| :---: | --------------------------- | ------------------------------------------- | :-----------: |
|   1   | Rust Engine 레이아웃 불일치 | `USE_RUST_LAYOUT_ENGINE=false` → 기존 Taffy | 0 (내부 교체) |
|   2   | SceneGraph 기능 누락        | `USE_SCENE_GRAPH=false` → @pixi/react 복원  | 0 (flag 전환) |
|   2   | PixiJS 제거 후 성능 회귀    | `REMOVE_PIXI=false` → PixiJS 복원           | 0 (flag 전환) |
|   3   | sticky 오동작               | sticky만 비활성화 (JS polyfill fallback)    |  해당 기능만  |
|   3   | 텍스트 하이브리드 불일치    | `USE_HYBRID_TEXT=false` → 기존 텍스트 경로  |   텍스트만    |
|   4   | 타일 캐시 렌더링 아티팩트   | `USE_TILE_CACHE=false` → 전체 렌더          |    성능만     |
|   5   | Production 전환 후 문제     | `UNIFIED_ENGINE=false` → 전체 이전 경로     |     전체      |

### 16.3 자동 롤백 (Constitutional Invariants)

```typescript
// constitutionalGuard.ts — production 모니터링
const INVARIANTS = {
  fps_p95_min: 30, // 절대 하한 (30fps 미만이면 즉시 롤백)
  errorRate_max: 5, // 분당 에러 5건 초과 시 롤백
  layoutMismatch_max: 0, // Preview↔Canvas 불일치 0건
  dragLatency_p99_max: 50, // 드래그 지연 50ms 초과 시 롤백
};

function monitorAndAutoRollback(): void {
  setInterval(() => {
    const metrics = collectMetrics();

    for (const [key, threshold] of Object.entries(INVARIANTS)) {
      if (key.endsWith("_min") && metrics[key] < threshold) {
        rollback(`${key} = ${metrics[key]} < ${threshold}`);
      }
      if (key.endsWith("_max") && metrics[key] > threshold) {
        rollback(`${key} = ${metrics[key]} > ${threshold}`);
      }
    }
  }, 10_000); // 10초 간격
}

function rollback(reason: string): void {
  console.error(`🚨 AUTO-ROLLBACK: ${reason}`);
  // 가장 최근 활성화된 flag를 비활성화
  disableLastEnabledFlag();
  // 알림 전송
  sendAlert(`ADR-900 auto-rollback: ${reason}`);
}
```

### 16.4 이전 코드 생명 주기

```
flag 활성화 → 6주 안정 → 이전 코드 soft-delete (주석 + dead code 표시)
  → 6주 추가 안정 → hard-delete (코드 제거)

총 12주 공존 → 어떤 시점에서든 롤백 가능
```

---

## 17. 운영 준비

### 17.1 팀/인력 가정

| 역할                  | 필요 역량                               |      인원       | 비고         |
| --------------------- | --------------------------------------- | :-------------: | ------------ |
| Rust/WASM 개발        | Taffy fork + wasm-bindgen               |       1명       | Phase 1 핵심 |
| TypeScript 프론트엔드 | SceneGraph + StoreBridge + Event 재설계 |       1명       | Phase 2 핵심 |
| Skia 렌더링           | CanvasKit API + 시각 정합성             | 1명 (겸임 가능) | Phase 3      |
| QA/벤치마크           | Playwright + 성능 측정                  |      겸임       | 전 Phase     |

**최소 인원: 1명** (순차 실행 14주), **권장: 2명** (Rust + TS 병렬, ~9주)

### 17.2 CI/CD 파이프라인 변경

```yaml
# .github/workflows/unified-engine.yml (추가)
unified-engine-ci:
  steps:
    # 1. Rust WASM 빌드
    - name: Build composition-layout WASM
      run: |
        cd packages/composition-layout
        wasm-pack build --target web --release
        wasm-opt -Os -o pkg/composition_layout_opt.wasm pkg/composition_layout_bg.wasm

    # 2. WASM 바이너리 크기 검증
    - name: Check WASM size
      run: |
        SIZE=$(stat -f%z pkg/composition_layout_opt.wasm)
        if [ $SIZE -gt 400000 ]; then
          echo "❌ WASM size ${SIZE} > 400KB limit"
          exit 1
        fi

    # 3. Taffy 레이아웃 패리티 테스트
    - name: Layout parity tests
      run: cargo test --release

    # 4. 기존 type-check + 벤치마크
    - name: TypeScript type check
      run: pnpm type-check

    # 5. 기능 파리티 E2E (feature flag 활성화)
    - name: Feature parity E2E
      run: UNIFIED_ENGINE=true pnpm test:e2e

    # 6. 성능 회귀 (Constitutional)
    - name: Performance regression
      run: pnpm bench:canvas -- --assert-no-regression
```

### 17.3 기존 프로젝트 데이터 호환

```
현재 프로젝트 데이터: Cloud DB의 elements + styles + pages
  → 데이터 스키마는 변경 없음 (Store 레이어 유지)
  → 레이아웃 계산만 다른 엔진으로 수행
  → 결과가 동일해야 함 (레이아웃 패리티 테스트로 검증)

호환성 리스크:
  - Taffy fork가 기존 Taffy와 다른 결과를 내는 경우
  - 해결: 기존 Taffy 테스트 100% 통과 (Phase 1 Gate)

데이터 마이그레이션: 불필요
  - 요소 데이터는 Store 레벨에서 동일
  - 레이아웃 결과는 런타임 계산 (저장하지 않음)
  - CSS 스타일은 동일하게 해석
```

### 17.4 모니터링 (Production 전환 후)

```typescript
// monitoring/unifiedEngineMetrics.ts
// Cloud Edge Function 또는 Analytics로 수집

interface EngineMetrics {
  userId: string;
  engineVersion: "legacy" | "unified";
  timestamp: number;

  // 성능
  fps_p50: number;
  fps_p95: number;
  frameTime_p95: number;
  dragLatency_p95: number;

  // 리소스
  jsHeapMB: number;
  webglContexts: number;

  // 정합성
  textMismatchCount: number; // 하이브리드 텍스트 fallback 횟수
  layoutRecalcCount: number; // 2-pass 발동 횟수

  // 에러
  renderErrorCount: number;
  wasmErrorCount: number;
}
```

### 17.5 Taffy Fork Upstream 동기화 정책

```
정책: Cherry-pick (전체 동기화 아님)

주기: Taffy 분기별 릴리스(~3개월) 시 변경 로그 확인
  → 버그 수정: cherry-pick
  → 새 기능: 필요성 평가 후 선택적 적용
  → Breaking change: 영향 분석 후 결정

자동화:
  - GitHub Action: Taffy 새 릴리스 시 알림 (dependabot 스타일)
  - diff 요약 자동 생성 (flex/grid/block 관련 변경만 필터)
```

---

## 18. 위험 정량화

> **원칙: "MEDIUM"이 아니라 확률 × 영향 = 예상 비용으로 위험을 평가한다.**

### 18.1 위험 레지스터

| #   | 위험                                                     | 확률 | 영향 (일수) | 예상 비용 | 완화 방법                                   | 완화 비용 |
| --- | -------------------------------------------------------- | :--: | :---------: | :-------: | ------------------------------------------- | :-------: |
| R1  | Taffy fork 테스트 이식 실패 (API 차이)                   | 10%  |    +5일     |   0.5일   | fork 전 API 호환 매트릭스 작성              |    1일    |
| R2  | WASM 바이너리 크기 >400KB                                | 10%  |    +3일     |   0.3일   | wasm-opt + feature flag 분리 + tree-shaking |   0.5일   |
| R3  | sticky 알고리즘이 중첩 스크롤에서 오동작                 | 15%  |    +3일     |  0.45일   | WPT 5개 케이스 + 브라우저 비교              |    1일    |
| R4  | SceneGraph dirty rect 5000 요소에서 60fps 미달           | 20%  |    +5일     |   1.0일   | 타일 캐시 + 프로파일링 반복                 |    2일    |
| R5  | 텍스트 하이브리드 Canvas2D↔CanvasKit 줄바꿈 불일치 (CJK) | 15%  |    +4일     |   0.6일   | Intl.Segmenter CJK 테스트 50개              |    1일    |
| R6  | PixiJS 제거 후 미발견 기능 누락                          | 10%  |    +3일     |   0.3일   | 78개 파리티 체크리스트 + E2E                |    2일    |
| R7  | CSS 시각 정합성 G1~G7 수정 후 다른 렌더링 회귀           | 10%  |    +2일     |   0.2일   | pixelmatch 전체 컴포넌트 스크린샷           |    1일    |
| R8  | Taffy fork upstream 동기화 누락으로 버그 전파            |  5%  |    +2일     |   0.1일   | 분기별 cherry-pick 정책 + 알림              |   0.5일   |

### 18.2 총 위험 예산

```
총 예상 비용 (확률 가중):
  R1(0.5) + R2(0.3) + R3(0.45) + R4(1.0) + R5(0.6) + R6(0.3) + R7(0.2) + R8(0.1)
  = 3.45일

총 완화 비용:
  1 + 0.5 + 1 + 2 + 1 + 2 + 1 + 0.5 = 9일

14주(70 영업일) 대비:
  위험 예산 3.45일 = 4.9% → 허용 가능
  완화 비용 9일 = 12.9% → Phase 0 + 각 Phase Gate에 분산

최악의 경우 (모든 위험 실현):
  5 + 3 + 3 + 5 + 4 + 3 + 2 + 2 = 27일 추가 → 14주 → 19.4주
  → 그래도 원본 21주보다 짧음
```

### 18.3 위험 대시보드 (Phase Gate에서 업데이트)

```
Phase 0 완료 시:
  R1: □ 미확인  → API 호환 매트릭스 완성 후 확률 재평가
  R2: □ 미확인  → 초기 WASM 빌드 후 크기 확인
  R4: □ 미확인  → baseline 스케일링 지수(b) 측정 후 재평가

Phase 1 완료 시:
  R1: ✅ 해소 또는 ❌ 실현 → 영향 실측
  R2: ✅ 해소 또는 ❌ 실현 → wasm-opt 적용

Phase 2 완료 시:
  R4: ✅ 해소 또는 ❌ 실현 → 타일 캐시 필요 여부 확정
  R6: ✅ 해소 또는 ❌ 실현 → 78개 파리티 결과

각 Phase에서 위험이 실현되면:
  → 영향 일수를 실측값으로 교체
  → 총 일정에 반영
  → 다음 Phase 조정
```
