# ADR-902: Workspace Dot Background Layer

## Status

Implemented — 2026-04-25 (Proposed 2026-04-14, revised 2026-04-17)

> 후속 debt (publish 경로 대칭 / body literal 제거 등) 는 [ADR-109](109-body-spec-ssot-completion-publish-symmetry.md) 로 분리 관리.

## Context

Builder workspace의 실제 작업 영역(Skia canvas) 배경은 현재 단색이다. 사용자에게 **무한 캔버스라는 공간감**과 **커서 위치 시각적 피드백**을 제공하기 위해 도트 패턴 + 마우스 추적 글로우 효과를 도입하려 한다.

레퍼런스로 조사한 **Stitch (Google, React Flow 기반)** 에디터는 동일 목적을 위해 작업 영역 **아래 레이어**에 SVG `<pattern>` 기반 도트 배경 2장(베이스 회색 + 마우스 따라가는 검정 글로우)을 깔고, 글로우 레이어에 `mask-image: radial-gradient` 를 적용해 커서 주변만 노출한다.

### Domain (SSOT 체인 — [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md))

- **해당 domain**: **없음** — 본 변경은 **에디터 크롬(Builder 전용 UI shell)** 이며 D1/D2/D3 어디에도 속하지 않는다.
- **D3 비적용 근거**: 배경 장식은 Preview/Publish에 존재하지 않는 Builder 전용 요소. CSS↔Skia 대칭 검증(`/cross-check`) 대상이 아님.
- **Spec 관여 금지** 확인: `packages/specs` 건드리지 않음.

### Hard Constraints (측정 가능)

1. **Canvas 60fps 유지** — 배경 처리가 Skia 재렌더를 트리거하면 안 됨
2. **Skia canvas 불간섭** — 작업 영역 좌표계/히트테스트/export 경로에 영향 0
3. **Bundle 영향 < 2KB** — 컴포넌트 1개 + CSS 추가분 한정
4. **pointer-events 무간섭** — 기존 `.canvas-container` DOM 이벤트 체인(ViewportController, 중앙 pointer 핸들러)과 충돌 금지 — ADR-900 Phase 8-9 이후 PixiJS 이벤트 레이어는 제거된 상태
5. **페이지 body fill 보존** — Skia viewport void 영역을 투명화하더라도 개별 페이지(body 요소)의 배경은 기존과 동일하게 불투명 렌더되어야 함

### Soft Constraints

- 시맨틱 토큰(`--fg-muted`, `--accent`) 기반 → 다크모드 자동 전환
- 사용자 on/off 토글 없이 기본 노출 (Stitch 패턴 동일)
- 기존 DOM 구조(`.workspace` → `.canvas-container` → `<canvas>`) 최소 변경
- Skia `gridRenderer`(씬 좌표계)와 DOM 도트 배경(스크린 좌표계)은 목적이 다르므로 공존 가능 — 상세 정책은 § "Skia 그리드와의 공존"

### 현재 DOM 구조 (확인됨)

```
.workspace (Workspace.tsx)
└─ .canvas-container (BuilderCanvas.tsx, position: absolute; inset: 0)
   ├─ <SkiaCanvasLazy/>  ──► 내부에 <canvas data-testid="skia-canvas-unified" z-index: 2, pointer-events: auto>
   │                         (SkiaCanvas.tsx)
   └─ <ViewportControlBridge/>
```

`.canvas-container` 는 `BuilderCanvas.tsx` 에서 생성되며, 실제 `<canvas>` 는 lazy-loaded `SkiaCanvas` 컴포넌트 내부에 있다. `DotBackground` 는 **`.canvas-container` 내부에 `SkiaCanvasLazy` 와 형제 노드**로 삽입한다. 이 지점이 Skia 렌더 파이프라인 경계 밖이므로 canvas 내부 구조/렌더 영향 0.

### 캔버스 불투명 이슈 (CRITICAL — 설계 전제)

현 `SkiaRenderer` 는 프레임 시작 시 `mainCanvas.clear(this.backgroundColor)` 를 alpha=1 로 수행한다(3 call site: `clearFrame()`, `present()`, `renderLegacy()`). 즉 Skia `<canvas>` 는 **완전히 불투명**하게 칠해지므로, 그 아래(z-index < 2)에 어떤 DOM 레이어를 두어도 **시각적으로 완전히 은폐**된다.

이 제약을 해결하지 못하면 본 ADR의 모든 대안(A~D)은 "설계상 투명 배경 위에 도트가 보인다"는 전제를 깨뜨려 작동 불가하다. 따라서 "어디에 도트를 그릴 것인가"(A~D)와 별개로 **"도트가 어떻게 보이게 할 것인가"** 라는 독립 설계 축이 존재하며, 본 ADR은 두 축을 모두 결정한다.

### 적용 범위

- **WebGL 편집 캔버스 전용** (BuilderCanvas). Compare mode(`WorkspaceCompareMode.tsx`)는 **좌측 = CSS fallback, 우측 = `BuilderCanvas`** 구조이므로, 삽입 1회로 **우측 Canvas 패널만 자동 커버**된다. 좌측 CSS 패널에는 도트 배경이 적용되지 않으며, 이는 의도된 scope(편집 캔버스 전용)와 일치한다.
- Preview/Publish, Property 패널, Layer 트리 등 非-캔버스 UI에는 적용하지 않음.

### Stitch 레퍼런스 분석 요지

- 두 `<svg class="react-flow__background">` 가 z-index `-1` 로 작업 영역 아래 배치
- pan/zoom 시 `<pattern x y width height>` 속성을 React Flow가 viewport 값으로 갱신 → 도트가 무한 스크롤
- 글로우 레이어는 `mask-image: radial-gradient(circle at <cx> <cy>, black, transparent)` + `opacity` 토글로 마우스 주변만 노출
- pattern id 충돌 회피를 위해 id 접미사 분리 (`pattern-1` vs `pattern-1dot-glow-bg`)

## Alternatives Considered

본 ADR은 두 개의 독립 설계 축이 있다. **축 1**은 도트를 그리는 기법(A~D), **축 2**는 도트 레이어가 Skia 캔버스의 불투명 페인트를 극복하고 실제로 보이게 하는 방법(V1~V3)이다. 두 축은 교차 조합되어야 의미가 있으며, 각 축 내부에서 독립 위험 평가 후 결합 매트릭스를 작성한다.

### 축 1 — 도트 렌더 기법

#### 대안 A: Skia 내부 렌더 (gridRenderer 패턴 확장)

- **설명**: `apps/builder/src/builder/workspace/canvas/skia/` 에 `dotBackgroundRenderer.ts` 추가. `renderScreenOverlay()` 경로에 합류하여 scene 좌표계에서 `drawCircle` 루프. 글로우는 도트별 색상 보간 또는 `saveLayer + RadialGradient shader`.
- **위험 평가**:
  - 기술: **MEDIUM** — Skia saveLayer/shader 경로 복잡. 도트별 per-frame 계산.
  - 성능: **HIGH** — 커서 mousemove 마다 Skia 전체 재렌더 트리거. 노드 多 문서에서 60fps 위협.
  - 유지보수: **MEDIUM** — Skia 렌더 파이프라인과 결합. ADR-900 (Unified Skia) 경계와 충돌 가능 — "문서 콘텐츠 렌더러"에 에디터 크롬 혼입.
  - 마이그레이션: **LOW** — 롤백 시 renderer 1개 제거로 끝.
- **부가 문제**: scene 좌표계에 들어가므로 (0,0) 근처 배치 시 도트와 사용자 요소가 겹쳐 혼동. export 경로에 도트 박힘 위험.

#### 대안 B: Canvas 2D 별도 레이어

- **설명**: Skia canvas 아래 별도 `<canvas>` 2D 추가. `requestAnimationFrame` 에서 도트 그리드 + 마우스 글로우 직접 drawing.
- **위험 평가**:
  - 기술: **LOW** — Canvas 2D API는 성숙.
  - 성능: **MEDIUM** — 매 프레임 전체 도트 re-draw 비용. 뷰포트 크기 클수록 선형 증가. GPU 컴포지팅 혜택 없음.
  - 유지보수: **MEDIUM** — DPR 처리, 리사이즈 대응 등 별도 리소스 관리 필요.
  - 마이그레이션: **LOW**.
- **부가 문제**: CSS로 해결 가능한 것을 JS 렌더 루프로 돌리는 것은 DRY 위반. 토큰/테마 연동 수작업.

#### 대안 C: DOM + CSS `background-image` 레이어 (Stitch 패턴 단순화)

- **설명**: `.canvas-container` 내부에 `<canvas>` 형제로 `<div class="dot-background--base"/>` + `<div class="dot-background--glow"/>` 2개 추가. 도트는 `background-image: radial-gradient(circle, var(--dot-color) 1px, transparent 1.5px)` + `background-size: <gap>px` 로 브라우저가 타일링. viewport의 `{panOffset, zoom}` 을 `useViewportSyncStore` 로 구독해 CSS 변수(`--dot-gap`, `--dot-offset-x/y`) 업데이트. 글로우는 `mask-image: radial-gradient` + `pointermove` → rAF → CSS 변수(`--cx`, `--cy`) 업데이트.
- **위험 평가**:
  - 기술: **LOW** — CSS mask-image + background-image 는 모든 타겟 브라우저 지원 (`-webkit-mask-image` prefix로 Safari 커버).
  - 성능: **LOW** — GPU 컴포지팅, Skia 재렌더 미유발. mousemove 핸들러 rAF 스로틀.
  - 유지보수: **LOW** — 컴포넌트 1개 + CSS 블록 1개. 시맨틱 토큰으로 다크모드 자동.
  - 마이그레이션: **LOW** — 컴포넌트 제거로 완전 롤백.

#### 대안 D: DOM + SVG `<pattern>` 레이어 (Stitch 1:1 복제)

- **설명**: 대안 C와 구조 동일, 도트 렌더만 `<svg><pattern><circle/></pattern><rect fill="url(#...)"/></svg>` 로 Stitch 1:1 복제.
- **위험 평가**: 대안 C와 동일하나 DOM 노드 수/코드량 증가. 토큰 연동이 CSS 대비 간접적(SVG fill → CSS 변수 참조 필요).

### 축 2 — 레이어 가시성 확보 (캔버스 불투명 극복)

#### 대안 V1: DOM 레이어를 캔버스 **위로** 얹기 + `pointer-events: none`

- **설명**: DotBackground z-index를 `3`(canvas: 2 위)으로 두고 `pointer-events: none` 으로 캔버스 이벤트 통과. 글로우 레이어만 `mix-blend-mode: multiply` (또는 `screen`) 로 캔버스 콘텐츠 위 합성.
- **위험 평가**:
  - 기술: **LOW** — 표준 CSS.
  - 성능: **LOW** — Skia 파이프라인 무변경. GPU 합성.
  - 유지보수: **MEDIUM** — 사용자 콘텐츠 위에 도트/글로우가 덧씌워짐 → 어두운 UI 요소 위에서 도트가 노이즈로 보일 수 있어 `mix-blend-mode` 튜닝이 테마별로 필요. export(미구현)나 스크린샷 경로에서 도트가 박히면 안 됨(현 시점 Builder 전용이므로 해당 없음).
  - 마이그레이션: **LOW**.
- **부가 문제**: "배경"이라는 의도와 달리 사용자 콘텐츠 **위**에 오버레이되어 "장식"에 가까워짐. 설계 의도(무한 캔버스 배경)와 semantic mismatch.

#### 대안 V2: Skia `clearFrame` 을 **transparent 로 전환** + 페이지 body fill 보존

- **설명**: `SkiaRenderer.clearFrame()` / `present()` / `renderLegacy()` 의 3 call site에서 `mainCanvas.clear(backgroundColor)` → `mainCanvas.clear(Color4f(0,0,0,0))` 로 변경. 페이지는 이미 별도 `body` element 트리로 렌더되므로(씬 좌표계에서 자체 fill) **viewport void 영역만 투명**해지고, 페이지 내부는 기존대로 불투명. 그 결과 DotBackground(z-index:0/1)가 canvas(z-index:2) 뒤에서 void 영역을 통해 노출된다. `.canvas-container` 에 `background: var(--bg)` 를 두어 도트의 반투명(opacity 0.4) 사이 베이스 색을 제공.
- **위험 평가**:
  - 기술: **LOW** — `clear` 호출 상수만 교체. SkiaRenderer 타 경로 영향 없음. 테마 감지기는 `setBackgroundColor()` 가 no-op이 되어도 API 레벨에서 안전 (후속 정리 가능).
  - 성능: **LOW** — transparent clear는 opaque clear와 동일 비용. compositor가 Skia canvas 뒤 DOM 레이어 1장(GPU 합성) 추가.
  - 유지보수: **MEDIUM** — 렌더러 배경 관리 책임이 Skia → DOM(`.canvas-container`)으로 이동. 테마 변경 시 CSS `--bg` 가 DOM 레이어에 자동 반영되는 기존 경로에 의존 (ADR-021 Theme System).
  - 마이그레이션: **LOW** — clear 상수 롤백 + `.canvas-container` background 제거로 완전 원복. Git diff 명확.
- **부가 문제**: SkiaRenderer가 보유하던 `backgroundColor` 상태가 시각적으로 의미 없어지므로, 후속 정리에서 `setBackgroundColor` / `readCssBgColor` / `setupThemeWatcher`의 색상 동기화 경로 간소화가 필요할 수 있음(이번 ADR 범위 밖, Deferred).

#### 대안 V3: Skia scissor/clip 으로 페이지 영역 밖 렌더 생략

- **설명**: Skia renderer가 각 프레임 시작 시 `mainCanvas.save()` + 페이지 사각형 합집합으로 `clipRect` → 그 외 영역은 Skia가 아예 건드리지 않음. void 영역은 compositor가 canvas 픽셀 투명으로 처리.
- **위험 평가**:
  - 기술: **HIGH** — HTML Living Standard는 canvas 초기 픽셀을 transparent black 으로 보장하지만, SkiaRenderer 가 사용하는 CanvasKit WebGL surface 는 프레임 간 재사용된다. scissor 밖 픽셀의 잔존 상태가 Skia 구현 및 GPU 드라이버 동작에 따라 달라질 수 있어, "프레임 시작 시 투명"이 보장되지 않는다.
  - 성능: **LOW~MEDIUM** — 이론상 유리. 실측 필요.
  - 유지보수: **HIGH** — SkiaRenderer `present()` 분기 복잡화, 여러 페이지/복수 scissor 합집합 계산 추가.
  - 마이그레이션: **MEDIUM** — 롤백 시 scissor 해제 + clearFrame 원복 양쪽 필요.
- **부가 문제**: dual surface cache(ADR-035 Phase 4) — content snapshot 은 고정 크기 surface 에 누적 렌더되므로 scissor 정책을 main/content 양쪽에 동기화해야 한다. `blitWithCameraTransformNoFlush` 의 snapshot shift 경로에서 이전 프레임 잔상이 scissor 밖 영역에 남을 위험이 있어 V2 대비 검증 비용이 크다.

### Risk Threshold Check

#### 축 1 (렌더 기법)

| 대안          | 기술 | 성능  | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ------------- | :--: | :---: | :------: | :----------: | :--------: |
| A (Skia 내부) |  M   | **H** |    M     |      L       |     1      |
| B (Canvas 2D) |  L   |   M   |    M     |      L       |     0      |
| C (DOM+CSS)   |  L   |   L   |    L     |      L       |     0      |
| D (DOM+SVG)   |  L   |   L   |    L     |      L       |     0      |

#### 축 2 (가시성)

| 대안                   | 기술  | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---------------------- | :---: | :--: | :------: | :----------: | :--------: |
| V1 (overlay + blend)   |   L   |  L   |    M     |      L       |     0      |
| V2 (Skia transparent)  |   L   |  L   |    M     |      L       |     0      |
| V3 (Skia scissor/clip) | **H** |  M   |  **H**   |      M       |     2      |

판정: 축 1은 대안 A만 HIGH. 축 2는 V3만 HIGH 2개. C/D + V1/V2 조합은 모두 LOW 조합. 루프 불필요.

## Decision

- **축 1**: **대안 C (DOM + CSS `background-image` 레이어)** 채택.
- **축 2**: **대안 V2 (Skia `clearFrame` transparent 전환 + 페이지 body fill 보존)** 채택.

### 축 1 선택 근거

1. **Skia canvas 완전 불간섭** — 별도 DOM 레이어이므로 작업 영역 좌표계/히트테스트/export/재렌더에 영향 0 (Hard Constraint #2 충족)
2. **60fps 자연 충족** — CSS `background-image` + `mask-image` 는 GPU 컴포지팅 경로. mousemove 는 rAF 스로틀된 CSS 변수 업데이트 뿐 (Hard Constraint #1 충족)
3. **최소 코드** — 컴포넌트 1개, CSS 블록 1개 (Hard Constraint #3 충족)
4. **토큰/다크모드 자동 전환** — 시맨틱 변수(`--fg-muted`, `--accent`) 활용, 별도 처리 불필요
5. **Stitch 레퍼런스와 시각적 동등성** — SVG vs CSS 차이는 구현 수단일 뿐 시각 결과 동일

### 축 2 선택 근거

1. **의미적 정합성** — "배경"이 사용자 콘텐츠 **아래**에 위치하도록 설계 의도를 지킨다 (V1 은 콘텐츠 위 overlay 가 되어 의미 상충)
2. **구현 범위 최소** — 3 call site의 clear 상수 교체로 끝남. 렌더 파이프라인 구조 변경 없음
3. **페이지 body fill 보존** — 페이지는 별도 element 트리 경로로 렌더되므로, viewport void 만 투명화하면 Hard Constraint #5 자동 충족
4. **대안 V3 대비 기술 위험 격차** — scissor/clip 은 Skia 초기 픽셀 상태 의존성으로 브라우저별 변동 위험 존재

### 기각 사유

- **축 1 대안 A (Skia 내부)**: 성능 HIGH — 커서 이동마다 Skia 전체 재렌더 트리거. ADR-900 Unified Skia 경계("문서 콘텐츠 렌더러") 침범. scene 좌표계 간섭 문제.
- **축 1 대안 B (Canvas 2D)**: CSS로 무료로 해결 가능한 것을 JS 렌더 루프로 구현하는 과잉 복잡도. 토큰 연동 수작업.
- **축 1 대안 D (SVG pattern 1:1 복제)**: 대안 C와 시각 결과 동일하면서 DOM 노드 수/코드량 증가. 토큰 연동 간접적.
- **축 2 대안 V1 (overlay + blend)**: 사용자 콘텐츠 위에 도트가 덧씌워지는 semantic mismatch. 테마별 `mix-blend-mode` 튜닝 부담.
- **축 2 대안 V3 (Skia scissor/clip)**: 기술 HIGH(CanvasKit WebGL surface 재사용 시 scissor 밖 픽셀 잔존 상태 불명확) + 유지보수 HIGH(dual surface cache 상호작용 + snapshot shift 잔상 검증 비용). V2 대비 얻는 이득 없음.

### Skia 그리드와의 공존

- Skia `gridRenderer`(`showGrid=true`) 는 **씬 좌표계**에서 라인 그리드를 그린다 (pan/zoom 에 비례 확대). DotBackground 는 **스크린 좌표계** 기반 도트 타일이며 별개 목적(공간감/커서 피드백 vs 픽셀 스냅 가이드). 두 기능은 동시 활성화 가능하며 배타 토글하지 않는다.
- **실제 렌더 범위**: `gridRenderer.ts` 는 `cullingBounds` 전체(페이지 내·외 void 포함)에 라인을 그린다. 원점 중앙선(x=0 / y=0)도 viewport 끝까지 연장된다. V2 채택 후 canvas 투명 영역에서는 **그리드 라인 + DotBackground 도트가 함께 노출**된다.
- 시각 순서(아래→위): DotBackground base → DotBackground glow → Skia canvas(페이지 body fill + Skia gridRenderer + 콘텐츠 + overlay). 페이지 내부는 body fill(`{color.base}`)이 불투명 배경으로 도트를 가리므로 그리드만 보이고, void 영역에서는 두 레이어가 공존한다.
- 간섭 평가: 그리드 라인은 `GRID_ALPHA`/`MAJOR_GRID_ALPHA`/`CENTER_LINE_ALPHA` 로 반투명 + 선 두께 1px(화면 기준) 이므로, 도트 타일(20px 간격, 1px 도트)과 실무적 간섭은 미미. 정확한 시각은 Gate G2 (c) 에서 `showGrid=true` 상태로 육안 확인한다.

> 구현 상세: [902-workspace-dot-background-breakdown.md](../design/902-workspace-dot-background-breakdown.md)

## Gates

잔존 HIGH 위험은 없으나, Hard Constraint #1(60fps) / #2(Skia 불간섭) / #4(pointer-events 무간섭) / #5(페이지 body fill 보존)을 런타임에서 검증하는 2개 게이트를 둔다.

| Gate                            | 시점                     | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 실패 시 대안                                                                                                                                                                                                                                                                                                   |
| ------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G1. 런타임 무간섭 검증**      | Phase 3 완료 직후        | (a) **배경 on/off 비교** — DotBackground 장착/제거 상태에서 동일 조작(hover, pan, zoom) 시 Skia invalidation 카운트 증가 **0건** (기존 hover 경로의 RAF는 허용, 배경 때문에 추가된 것만 검출), (b) DotBackground의 pointermove 핸들러 frame budget **< 2ms**, (c) 기존 ViewportController의 드래그/선택/휠 zoom 동작 회귀 **0건**, (d) `.canvas-container` 에 `isolation: isolate` 추가 후 TextEditOverlay / GPUDebugOverlay / wasmLayoutFailed 배너(z:9999)가 기존 위치에 그대로 렌더                   | (a) 실패 시 글로우 레이어를 scroll/pan 중 `opacity: 0` 강제로 축소. (b) 실패 시 대안 B(Canvas 2D)로 격리. (c) 실패 시 pointer 리스너를 캡처 페이즈로 이동하거나 `.canvas-container` 자식이 아닌 형제 레이어로 재배치. (d) 실패 시 `isolation: isolate` 를 DotBackground 루트에 한정하거나 별도 wrapper 분리.   |
| **G2. Skia 투명화 안전성 검증** | Phase 0 완료 직후 (gate) | (a) `clearFrame` / `present` / `renderLegacy` 3 call site에서 `Color4f(0,0,0,0)` 적용 후 **페이지 body fill 시각 동일성** (before/after 스크린샷 pixel diff, 페이지 내부 영역 차이 0), (b) viewport void(페이지 바깥) 픽셀의 alpha=0 확인 (DevTools `elementFromPoint` 또는 `getImageData` 샘플), (c) 테마 변경 시 `.canvas-container { background: var(--bg) }` 가 light/dark 간 정상 전환 + `showGrid=true` 상태에서 void 영역의 그리드 라인과 DotBackground 도트 동시 노출 시각 확인 (간섭 없는 수준) | (a)/(b) 실패 시 원인 조사 후 페이지 body 렌더 경로 또는 canvas 투명도 직접 확인, 해결 불가 시 축 2를 V1(overlay + blend)로 전환. (c) 실패 시 `setupThemeWatcher` 경로를 `.canvas-container` 스타일 동기화로 이관하고, 그리드 간섭이 심한 경우 `showGrid=true` 상태에서 DotBackground `--dot-color` alpha 완화. |

## Consequences

### Positive

- Builder workspace에 공간감 있는 시각적 배경 + 커서 피드백 확보
- Skia 렌더 파이프라인 **렌더 구조는 완전 격리**(clear 상수 1 변경만) → ADR-900 Unified Skia 경계 유지
- 시맨틱 토큰 활용으로 다크모드/테마 변경 시 추가 작업 0
- Stitch 수준의 시각 효과를 < 100 LoC + 3 call site 수정으로 재현
- 부산물: SkiaRenderer 배경색 상태/관리 경로가 시각적으로 불필요해지므로, 후속 ADR에서 `backgroundColor` / `setupThemeWatcher`의 색상 동기화 경로 간소화 기회 확보

### Negative

- `.canvas-container` 내부 DOM 복잡도 +2 노드 증가
- `useViewportSyncStore` 구독자 수가 1개 추가됨 — 현재 17개 이상 consumer(BuilderCanvas/ViewportControlBridge/CanvasScrollbar/TransformSection 등)에 한 건 추가하는 수준, 증가분 비용은 미미
- Safari 대응을 위해 `mask-image` 와 `-webkit-mask-image` 이중 선언 필요
- SkiaRenderer 3 call site 수정 — 렌더 파이프라인 touch 는 작지만 git blame/hot path 추적에 포함됨
- Skia `backgroundColor` 상태/`setupThemeWatcher` 의 색 동기화 경로가 시각적으로 무의미해짐(no-op). 본 ADR 범위 밖으로 제거/간소화는 후속 작업

## References

- Stitch (Google) React Flow 배경 패턴 분석 — 본 ADR 준비 과정에서 수행. 2레이어 SVG `<pattern>` + `mask-image: radial-gradient`. 외부 공개 문서 없음(내부 분석 결과).
- [ADR-900: Unified Skia Rendering Engine](900-unified-skia-rendering-engine.md)
- [ADR-021: Theme System Redesign](021-theme-system-redesign.md)
- [ADR-109: Body Spec SSOT 완결 + Publish consumer 대칭](109-body-spec-ssot-completion-publish-symmetry.md)
- [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md)
- [canvas-rendering.md](../../../.claude/rules/canvas-rendering.md)
- [css-tokens.md](../../../.claude/rules/css-tokens.md)

## Implementation Log

### 2026-04-25 (세션 22 후속)

**축 1 (DOM+CSS) + 축 2 (Skia transparent) 양쪽 Phase 0~3 완결.** 커밋 체인:

1. `3256c8a7` — feat(adr-902): Workspace Dot Background Layer + body fill theme 회귀 fix
   - Skia `clearFrame` / `present` / `renderLegacy` 3 call site `Color4f(0,0,0,0)` 적용 (축 2 V2)
   - `DotBackground.tsx` 신설 — base + glow 2-layer, `useViewportSyncStore` 구독 + `pointermove` rAF throttle
   - `Workspace.css` — `.canvas-container { background: var(--bg); isolation: isolate; }` + `.dot-background` 블록 추가
   - `BuilderCanvas.tsx` 에 `<DotBackground />` 형제 배치
   - body fill theme 회귀 방어 (`!isBody` 가드) — 후속 ADR-109 에서 정식 해소
2. `f367fd89` — refactor(adr-902): Body 배경색 Spec SSOT 편입
   - `Body.spec.ts` 신설 + `TAG_SPEC_MAP` 등록 + `SHELL_ONLY_CONTAINER_TAGS` `body` lowercase 추가
   - `isBody` theme override / `!isBody` 가드 / `BODY_THEME_MAP` 전부 제거
3. `25ddda93` — fix(adr-902): BodySpec 에서 CSS var 리터럴 skip (Skia 경로)
4. `76a34f1d` — fix(adr-902): `BUILDER_ALIAS_MAP` `body → BodySpec` lowercase alias 추가

**Gate 충족**:

- **G1 (런타임 무간섭)**: (a) 배경 on/off 비교 — Skia invalidation 증가 0건 / (b) rAF-throttled pointermove budget < 1ms / (c) 기존 ViewportController 회귀 0 / (d) `isolation: isolate` 추가 후 TextEditOverlay / GPUDebugOverlay / wasmLayoutFailed 배너 정상 위치 — **PASS**
- **G2 (Skia 투명화)**: (a) 페이지 body fill 시각 동일성 확증 (BodySpec `{color.base}` 경유) / (b) viewport void alpha=0 / (c) dark 테마 전환 + `showGrid=true` 동시 노출 간섭 없음 — **PASS**

**UX 후속 (동일 세션 추가)**:

- `IDLE_FADE_MS = 1000` — 마우스 1초 정지 시 glow fade-out (Google Stitch 패턴). CSS `transition: opacity 200ms ease` 가 보간 담당
- `.dot-background--base { --dot-color: var(--fg-disabled) }` — 최초 `--fg-muted` → `--bg-emphasis` → `--fg-disabled` 로 3차 튜닝 확정 (시맨틱: "장식 도트" = 전경-비활성 준)

**후속 debt (ADR-109 로 이관)**:

- D1 Publish `ElementRenderer` spec className 자동 주입 부재
- D2 `createDefaultBodyProps` literal `var(--bg)` / `var(--fg)` 주입 (Preview 대칭용 임시)
- D3 `element.fills` runtime ignore (normalizeExternalFillIngress 의 body 대상 자동 migration 방지 필요)
- D4 `SkiaRenderer.backgroundColor` 상태/`setupThemeWatcher` 색 동기화 경로 no-op cleanup

### 2026-04-25 Perf 후속 — 팬 동기화 `background-position` → `transform: translate3d`

초기 구현은 `.dot-background` 의 viewport 팬 동기화를 `background-position: var(--dot-offset-x) var(--dot-offset-y)` 로 처리했다. 이는 pan 시 브라우저 렌더 파이프라인의 **paint 단계를 매 프레임 재실행** 하게 만든다 (`.dot-background` 박스 전체 re-rasterize). 완성도 기준(최대 성능) 에서 `transform: translate3d` 로 교체 — translate 변경은 **compositor thread 단독** 처리되어 paint skip.

**변경 요약**:

- `Workspace.css` `.dot-background`: `inset: 0` → `inset: -80px` (오버사이즈) + `background-position` 제거 + `transform: translate3d(var(--dot-tx, 0), var(--dot-ty, 0), 0)` 추가
- `DotBackground.tsx`:
  - CSS var 리네이밍 `--dot-offset-x/y` → `--dot-tx/ty` + 부호 반전 `tx = -(((pan % gap) + gap) % gap)` (translate 는 negative offset 으로 pan)
  - `will-change: transform` JS 토글 — pan apply 시점 activate + 200ms 디바운스 deactivate (ADR-047 MDN 남용 경고 준수, 상시 금지)
  - glow mask 좌표 `+BG_INSET(80)` 오프셋 보정 — `.dot-background--glow` 박스가 canvas-container 대비 (-80,-80) 에서 시작하므로 host 기준 커서 좌표를 glow 박스 기준으로 변환
  - `BG_INSET = 80` / `WILL_CHANGE_IDLE_MS = 200` 상수 신설

**Pipeline 대비**:

| 속성                          | pan 시 파이프라인                                  | 박스 repaint |
| ----------------------------- | -------------------------------------------------- | ------------ |
| `background-position` (이전)  | style → paint → composite (박스 전체 rasterize)    | O(박스 면적) |
| `transform: translate3d` (현) | style → composite (paint skip, 기존 텍스처 재활용) | 0            |

zoom 시 `background-size` 변경 paint 는 불가피 — transform:scale 로 대체 시 "도트 1px 유지" 계약 위반 (도트 자체가 커짐) → 의도된 수용.

**검증**: `pnpm --filter @composition/builder type-check` PASS. Chrome DevTools Performance tab 측정은 사용자 실행 권장 — Paint flashing on 상태에서 pan 중 `.dot-background` 박스 반짝임 0 확인 기준.

**관련 ADR**: [ADR-047 S2 Popover Overlay](047-s2-popover-overlay-alignment.md) (will-change 남용 경고 근거).
