# ADR-900: Unified Skia Rendering Engine — PixiJS/Taffy 제거 및 CSS3 단일 렌더러

## Status

Accepted — 2026-04-07 (Phase 8-9 Implemented, PixiJS 완전 제거)

Supersedes: [ADR-003](003-canvas-rendering.md) (PixiJS Canvas Rendering), [ADR-008](008-layout-engine.md) (Taffy WASM Layout Engine), [ADR-009](009-full-tree-wasm-layout.md) (Figma-Class Rendering & Layout — PixiJS/Taffy 파이프라인 최적화), [ADR-051](051-pretext-text-measurement-integration.md) (Pretext 텍스트 측정 — 하이브리드 단일 소스로 대체)

## Context

### 문제

composition Builder Canvas는 현재 **3개의 독립 엔진**이 동시 운영되는 Dual Renderer 아키텍처:

- **CanvasKit/Skia WASM**: 실제 화면 렌더링 (100%)
- **PixiJS v8.14.3**: 씬 그래프 + 이벤트 레이어 (alpha=0, WebGL 컨텍스트 #2)
- **Taffy WASM (Rust)**: Flex/Grid/Block 레이아웃 계산

이 구조의 근본적 문제:

1. **정합성 동기화 비용**: Skia↔PixiJS 위치 동기화, 카메라 변환 이중 적용, 레이아웃 결과 3곳 배포
2. **리소스 낭비**: WebGL 컨텍스트 2개, GPU 메모리 이중 점유, @pixi/react React 렌더 사이클
3. **CSS3 커버리지 한계**: Taffy는 flex/grid/block만 지원 (~75%), float/table/inline/multicol/sticky 미구현
4. **퍼포먼스 병목 복합**: 초기 WASM 3개 로딩, 대량 요소 시 3곳 갱신, 드래그 중 동기화 지연

### Hard Constraints

| 제약           | 값                                   | 근거                                        |
| -------------- | ------------------------------------ | ------------------------------------------- |
| Canvas FPS     | ≥ 60fps                              | 편집 반응성 (기존 성능 기준)                |
| 초기 로드      | < 3초                                | 사용자 이탈 임계                            |
| 번들 (초기)    | < 500KB (WASM 제외)                  | 네트워크 예산                               |
| CSS3 레이아웃  | Level 3 완전                         | 노코드 빌더 = 브라우저 결과물과 동일해야 함 |
| Preview 렌더링 | CSS 유지 (변경 없음)                 | Builder Canvas만 대상                       |
| 브라우저 호환  | Chrome 90+, Safari 16+, Firefox 100+ | 타겟 사용자                                 |

### Soft Constraints

- **Feature flag 기반 점진 전환** — Shadow 빅뱅이 아닌 매주 하나의 변경을 배포. A/B 비교(10%→50%→100%). Constitutional Invariants 위반 시 자동 롤백
- WebGPU 전환 경로를 추상화 레이어로 준비 (현재는 WebGL2)
- 텍스트 측정 하이브리드 단일 소스 — Canvas 2D(줄바꿈 결정, CSS 일치) + CanvasKit(실제 높이, 렌더 일치). ADR-051 Supersede
- 엔터프라이즈급 멀티페이지 동시 편집 (5000+ 요소 상시)

### CSS3 스코프 — ROI 기반 다이어트

> "The best part is no part." — 구현 비용 대비 사용률 0%인 기능은 삭제.

**삭제 (ROI ≈ 0):**

- `float` / `clear` — 2016년 이후 레이아웃 용도 사멸, flex/grid가 완전 대체
- `display: table-*` — CSS table layout은 레이아웃용으로 2010년대에 사멸, 데이터 테이블은 Grid로 대체
- `display: inline` / inline formatting context — 가장 복잡한 CSS 영역(IFC, line box, bidi), 노코드 빌더는 모든 요소가 block/flex/grid
- margin collapsing (복잡 규칙) — 현대 CSS에서도 기피, flex/grid 컨텍스트에서 미발생, 노코드는 gap/padding 사용
- `display: list-item` — 노코드에서 아이콘+텍스트 조합으로 대체
- `border-collapse`, `border-spacing`, `caption-side`, `empty-cells` — table 전용

**보류 (미래 필요시 Phase 추가):**

- multi-column (`column-count`, `column-width`) — 매거진/블로그 niche, 필요 시 추가
- `subgrid` — 사용률 극히 낮음, grid-template-areas가 더 직관적
- `writing-mode` (vertical), `direction: rtl` — i18n 확장 시 추가
- `display: contents` — 유용하나 Taffy도 미지원, 보류

**유지 (핵심):**

- Flexbox 전체 (Taffy fork, 검증됨)
- Grid 전체 + `grid-template-areas` (Taffy fork + 네이밍 영역 변환)
- Block (단순, margin collapse 제외)
- `position: static/relative/absolute/fixed/sticky`
- Box model 전체, `overflow`, intrinsic sizing, `gap`

## Alternatives Considered

### 대안 A: Retained Mode Scene Graph + Custom Rust CSS3 Engine (추천)

PixiJS와 Taffy를 모두 제거하고, 순수 TypeScript SceneGraph + 커스텀 Rust WASM CSS3 레이아웃 엔진으로 대체.

**구조:**

```
Zustand Store
  → StoreBridge (구독, diff 감지)
  → SceneGraph (순수 TS retained mode, dirty flag)
  → CSS3 Layout Engine (Rust WASM, Taffy fork 기반 확장)
  → SkiaRenderer (dirty region 기반 부분 렌더)
  → DOM Events → WASM SpatialIndex → SceneGraph → Store
```

**Layout Engine 전략 (ROI 다이어트 + 리서치 기반):**

- [Taffy v0.10.0](https://github.com/DioxusLabs/taffy) (MIT, ⭐3.1k) **포크** — flex/grid/block + `grid-template-areas` 이미 구현됨
- `position: sticky` 추가 — [Stickyfill](https://github.com/wilddeer/stickyfill) (MIT) 3단계 상태 전환 알고리즘 참조
- Spatial Index — 기존 composition WASM spatial index(`wasm/src/spatial_index.rs`)를 crate에 이식 (외부 의존성 0)
- ~~float/clear, table, inline, multicol~~ — **삭제** (ROI ≈ 0)
- **텍스트 측정 하이브리드**: Canvas 2D(줄바꿈 위치 결정 = CSS 일치) → Break Hint(\n) 주입 → CanvasKit Paragraph(실제 높이 반환 = 렌더 일치) → Paragraph 캐시 공유(측정=렌더 동일 객체). **현재의 줄바꿈 붕괴 문제를 구조적으로 제거.** ADR-051 Supersede
- 단일 WASM 바이너리 (`composition-layout.wasm`, ~250KB 예상) — **외부 Rust 의존성: Taffy fork 1개만**

**SceneGraph (자체 구현, 검증된 패턴 참조):**

- [AntV G `g-canvaskit`](https://github.com/antvis/G) (MIT) — **CanvasKit 렌더러를 가진 유일한 scene graph**. 브리지 패턴 참조
- [ZRender](https://github.com/ecomfe/zrender) (BSD-3, ⭐6.3k) — ECharts의 **dirty rectangle 알고리즘** (프로덕션 검증)
- [Penpot render-wasm](https://github.com/penpot/penpot) (MPL-2, ⭐38k) — **Skia WASM + 타일 캐싱** 패턴

**CSS3 렌더링 확장 (추가 라이브러리 불필요 — CanvasKit 내장 API):**

- backdrop-filter — `saveLayer` backdrop 인자 + `ImageFilter.MakeBlur`. [React Native Skia](https://github.com/Shopify/react-native-skia) (MIT, ⭐8.3k) 구현 패턴 참조
- text-shadow — 2-pass 렌더링 (shadow 레이어 + 원본 텍스트). ~50줄
- mask-image — `MaskFilter` + `RuntimeEffect` shader (CanvasKit 내장)
- CSS transitions/animations — 자체 구현 (~130줄 순수 수학: cubic-bezier + damped spring + keyframe lerp). [Popmotion](https://github.com/Popmotion/popmotion) 알고리즘 참조
- sepia, invert — `ColorFilter` ColorMatrix (CanvasKit 내장)
- outline-style — `Paint.setPathEffect` + `DashPathEffect` (CanvasKit 내장)

**기존 렌더러 CSS 정합성 갭 수정 (렌더링 감사 2026-04-06, ~241줄):**

- **G1 shadow+border-radius** (HIGH) — shadow를 RRect로 직접 draw. 현재 직사각형 bounds 렌더 → radius 윤곽 준수로 수정
- **G2 box-shadow spread** (MEDIUM) — dilate/erode 근사 → RRect 크기 확대로 정확한 spread 처리 (G1과 통합)
- **G3 blur sigma 공식** (1줄) — `radius/2` → `radius/2.355` (W3C Gaussian 정확 공식)
- **G4 text-shadow** (MEDIUM) — 미구현 → 2-pass 렌더링으로 구현 (~50줄)
- **G5 repeating-gradient** (LOW) — TileMode.Clamp → Repeat 분기 (~10줄)
- **G6 radial-gradient 키워드** (LOW) — closest-side/farthest-corner → 수치 변환 (~30줄)
- **G7 gradient oklab 보간** (LOW) — sRGB → oklab 색상 공간 보간 (~80줄)

수정 후 시각 정합성: **~82% → ~97%** (나머지 ~3%는 브라우저별 서브픽셀 차이로 100% 불가 영역)

**유사 제품 아키텍처 검증:**

- [OpenPencil](https://github.com/open-pencil/open-pencil) (MIT, ⭐4k) — CanvasKit + Yoga WASM + RBush. **composition와 거의 동일 스택**, 가장 직접적 참조
- [Graphite](https://github.com/GraphiteEditor/Graphite) (Apache-2.0, ⭐25k) — Rust 100% 아키텍처 (tiny-skia/Vello)
- [Penpot](https://github.com/penpot/penpot) (MPL-2, ⭐38k) — 바이너리 직렬화로 JS-WASM 경계 최소화

**위험:**

- 기술: **MEDIUM** — Taffy fork 기반이므로 flex/grid 검증 완료. 신규 구현은 sticky + grid-template-areas만
- 성능: **LOW** — React 렌더 사이클 제거 + dirty region + WebGL 컨텍스트 절반
- 유지보수: **LOW** — 삭제된 스코프로 엔진 복잡도 대폭 감소
- 마이그레이션: **MEDIUM** — Shadow Engine으로 기존 시스템과 병행 가능

### 대안 B: PixiJS 제거 + Taffy 유지 + CSS3 렌더링만 확장

PixiJS만 제거하고 Taffy는 유지. CSS3 레이아웃 갭(float/table/inline)은 구현하지 않음.

**구조:**

- SceneGraph + 기존 Taffy WASM + Skia 렌더링 확장
- 레이아웃은 현재 수준 유지 (flex/grid/block ~75%)

**위험:**

- 기술: **LOW** — 레이아웃 변경 없음, PixiJS 제거만
- ��능: **MEDIUM** — WebGL 절반이지만 React 트리 유지 시 한계
- 유지보수: **LOW** — 기존 Taffy 생태계 활용
- 마이그레이션: **LOW** — 변경 범위 최소

### 대안 C: 브라우저 위임 Layout + Skia 렌더링

숨겨진 offscreen DOM에 CSS 적용 → `getBoundingClientRect()`로 레이아웃 → Skia 렌더링.

**구조:**

- Shadow DOM으로 CSS3 100% 레이아웃 (브라우저 엔진 활용)
- 레이아웃 결과를 SceneGraph에 주입
- Skia는 렌더링만 담당

**위험:**

- 기술: **LOW** — 브라우저가 레이아웃 계산, 검증 불필요
- 성능: **HIGH** — DOM 조작 오버헤드, 수천 요소 시 reflow 비용, 60fps 위험
- 유지보수: **LOW** — 브라우저 CSS 엔진에 위임
- 마이그레이션: **LOW** — 기존 Preview CSS 코드 재활용 가능

### Risk Threshold Check

| 대안                            |  기술  |  성능  | 유지보수 | 마이그레이션 | HIGH+ 수 |
| ------------------------------- | :----: | :----: | :------: | :----------: | :------: |
| **A: SceneGraph + Rust Layout** | MEDIUM |  LOW   |   LOW    |    MEDIUM    |    0     |
| **B: PixiJS 제거 + Taffy 유지** |  LOW   | MEDIUM |   LOW    |     LOW      |    0     |
| **C: 브라우저 위임 Layout**     |  LOW   |  HIGH  |   LOW    |     LOW      |    1     |

- 대안 A: **HIGH 0개** (ROI 다이어트 후). float/table/inline/multicol 삭제로 기술 위험 HIGH→MEDIUM. Taffy fork 기반이므로 신규 구현은 sticky + grid-template-areas만.
- 대안 B: HIGH 0개 — 안전하지만 레이아웃 엔진 독립 제어 불가 + Taffy 외부 의존성 유지
- 대안 C: HIGH 1개 (성능) — DOM reflow가 60fps 제약과 직접 충돌. 엔터프라이즈급 멀티페이지(5000+ 요소)에서 구조적 한계

**루프 판정**: ROI 다이어트로 대안 A의 기술 위험이 MEDIUM으로 하락하여 HIGH 0개. 대안 B도 HIGH 0개이나 Taffy 외부 의존성과 레이아웃 확장 불가가 장기 리스크. 대안 C는 엔터프라이즈 5000+ 요소 요구사항에서 성능 HIGH로 탈락.

## Decision

**대안 A: Retained Mode Scene Graph + Custom Rust Layout Engine** 선택.

### 위험 수용 근거

ROI 다이어트 후 HIGH 위험 0개. 잔존 MEDIUM 위험에 대한 완화:

1. **Taffy v0.10.0 fork**: flex/grid/block + `grid-template-areas`가 이미 구현됨 (⭐3.1k, MIT, Servo/Blitz/Zed 등 프로덕션 사용). 신규 구현은 **sticky만** (~200줄, [Stickyfill](https://github.com/wilddeer/stickyfill) 알고리즘 참조)
2. **외부 의존성 최소화**: Rust 의존성 Taffy fork 1개만. Spatial index는 기존 composition WASM 코드 이식, transition 엔진은 ~130줄 자체 구현 (Popmotion 알고리즘 참조)
3. **CSS3 렌더링은 CanvasKit 내장 API만**: backdrop-filter, text-shadow, mask 모두 추가 라이브러리 불필요. [React Native Skia](https://github.com/Shopify/react-native-skia)(⭐8.3k) 구현 패턴 참조
4. **유사 제품 아키텍처 검증**: [OpenPencil](https://github.com/open-pencil/open-pencil)(CanvasKit+Yoga WASM)이 거의 동일 스택으로 동작 확인. [Penpot](https://github.com/penpot/penpot)(Skia WASM+타일 캐싱)이 대규모 캔버스 성능 검증
5. **SceneGraph 참조 패턴 풍부**: [AntV G](https://github.com/antvis/G)(CanvasKit 브리지), [ZRender](https://github.com/ecomfe/zrender)(dirty rect), [Penpot](https://github.com/penpot/penpot)(타일 캐싱) — 각 패턴이 프로덕션 검증됨
6. **Shadow Engine**: 기존 시스템과 병행 운영하므로 실패 시 롤백 가능
7. **보류 기능 확장 경로**: multi-column, subgrid 등은 수요 발생 시 독립 Phase로 추가 가능

### 기각 사유

- **대안 B (Taffy 유지)**: Taffy는 외부 의존성이며 composition 특화 확장(sticky, grid-template-areas, spatial index 통합)이 불가. 장기적으로 레이아웃 엔진을 자체 제어해야 엔터프라이즈 요구사항 대응 가능.
- **대안 C (브라우저 위임)**: 엔터프라이즈급 멀티페이지 동시 편집(5000+ 요소)에서 DOM reflow 비용이 60fps 제약과 구조적으로 충돌.

> 구현 상세: [900-unified-skia-engine-breakdown.md](../design/900-unified-skia-engine-breakdown.md)

## Gates

잔존 HIGH 위험 없음 (ROI 다이어트 후 모든 축 MEDIUM 이하).

안전망으로 Phase Gate 유지:

| Gate                             | 시점         | 통과 조건                                                             | 실패 시 대안                     |
| -------------------------------- | ------------ | --------------------------------------------------------------------- | -------------------------------- |
| G1: Rust 엔진 flex/grid 패리티   | Phase 1 완료 | Taffy 대비 flex/grid 레이아웃 결과 100% 일치 (기존 테스트 통과)       | Taffy 유지하고 래퍼만 교체       |
| G2: SceneGraph + Skia 단일 렌더  | Phase 2 완료 | PixiJS 없이 기존 캔버스 기능 100% 동작, 60fps 유지                    | PixiJS 이벤트 레이어만 유지      |
| G3: Sticky + grid-template-areas | Phase 3 완료 | sticky 스크롤 동작 + named areas 레이아웃 정상                        | 해당 기능만 JS polyfill          |
| G4: CSS3 렌더링 확장 + 성능      | Phase 4 완료 | backdrop-filter, text-shadow, mask, transitions 동작 + 1000요소 60fps | 프로파일링 후 hot path 최적화    |
| G5: Shadow→Production 전환       | Phase 5 완료 | 기존 기능 100% 동등성 + 성능 동등 이상                                | Shadow 엔진 계속 병행, 점진 전환 |

## Consequences

### Positive

- **WebGL 컨텍스트 1개 → GPU 메모리 ~50% 절감**, 모바일/저사양 디바이스 안정성 향상
- **React 렌더 사이클 제거** → 드래그/리사이즈 중 zero GC pressure, 프레임 드롭 제거
- **현대 CSS 핵심 완전 지원** → flex/grid/block/sticky + 시각 효과(backdrop-filter, mask, transitions) — 노코드 빌더에서 실제 사용되는 95%+ 커버
- **단일 레이아웃 WASM** (layout + spatial index) → WASM 초기화 횟수 3→1, 초기 로드 개선
- **Dirty Region 렌더링** → 대량 요소 시 O(changed) 성능, 5000+ 요소 멀티페이지에서도 60fps
- **WebGPU 마이그레이션 경로** → GPU 백엔드 추상화로 향후 WebGPU 전환 비용 최소화
- **코드 단순화** → @pixi/react + Taffy 제거로 ~12,000줄 삭제
- **ROI 다이어트로 일정 33% 단축** — 21주 → 14주. float/table/inline/multicol 삭제

### Negative

- **자체 레이아웃 엔진 유지 부담** — Taffy 업데이트를 직접 포팅해야 하나, fork 기반이므로 cherry-pick 가능
- **Feature flag 공존 기간** — 전환 완료 후 12주간 이전 코드 유지 (6주 soft-delete + 6주 hard-delete)
- **삭제된 CSS 기능 요청 시** — float/table/multicol 요청 시 추가 Phase 필요 (보류 경로 명시됨)
- **영향 범위 광범위** — Builder Canvas 전체 파일 (~50개) 수정/교체

## 확장 경로 — Level 4/5 성능 스케일링

> ADR-900은 Level 1~3 (아키텍처 최적화) 범위. Level 4/5는 수요 발생 시 별도 ADR.
> **현재 설계가 Level 4/5를 차단하지 않음을 검증 완료.**

### 최적화 5단계

| Level | 범위                                       |       목표 성능        | ADR-900 상태  |
| :---: | ------------------------------------------ | :--------------------: | :-----------: |
|   1   | PixiJS/Taffy 제거, WebGL -1                |    1000 요소 60fps     | ✅ Phase 1~2  |
|   2   | SceneGraph, dirty flag, React 제거         |    2000 요소 60fps     |  ✅ Phase 2   |
|   3   | 타일 캐시, Rust 네이티브, Paragraph 공유   |   5000 요소 50-60fps   | ✅ Phase 3~4  |
| **4** | **Web Worker + WASM SIMD + 커스텀 할당기** | **10,000+ 요소 60fps** | **경로 확보** |
| **5** | **Skia 포크 + WebGPU Compute Shader**      | **50,000+ 요소 60fps** | **경로 확보** |

### Level 4 차단 방지 설계 원칙

| Level 4 기법             | 차단 여부 | 확보된 경로                                                                                        |
| ------------------------ | :-------: | -------------------------------------------------------------------------------------------------- |
| Web Worker (Layout)      | ✅ 미차단 | Rust WASM은 Worker에서 실행 가능. 텍스트 측정 JS 콜백을 Worker에서도 호출 가능하게 인터페이스 분리 |
| OffscreenCanvas (Render) | ✅ 미차단 | GPUBackend 추상화가 OffscreenCanvas 지원. Surface 생성을 팩토리로 분리                             |
| WASM SIMD                | ✅ 미차단 | Cargo.toml `target-feature = "+simd128"` 추가만으로 활성화                                         |
| SharedArrayBuffer        | ✅ 미차단 | `build_tree_batch(data: &[u8])` 바이너리 프로토콜이 이미 SAB 호환                                  |
| 커스텀 Rust 할당기       | ✅ 미차단 | `#[global_allocator]` wee_alloc 또는 bump 할당기로 교체 가능                                       |

### Level 5 차단 방지 설계 원칙

| Level 5 기법            | 차단 여부 | 확보된 경로                                                            |
| ----------------------- | :-------: | ---------------------------------------------------------------------- |
| Skia 포크 (커스텀 빌드) | ✅ 미차단 | CanvasKit WASM 바이너리를 자체 빌드로 교체 가능 (locateFile 패턴 유지) |
| WebGPU Compute Shader   | ✅ 미차단 | GPUBackend 추상화의 `CanvasKitWebGPUBackend` 구현 경로 설계됨          |
| 커스텀 렌더 파이프라인  | ✅ 미차단 | SceneGraph → RenderCommand 패턴이 Skia 외 백엔드에도 적용 가능         |
