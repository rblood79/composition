# ADR-102 Breakdown: Workspace Dot Background Layer — 구현 상세

> 본 문서는 [ADR-102](../completed/902-workspace-dot-background-layer.md) 의 구현 상세 분리본. ADR 본문에는 포인터만 둔다.

## Phase 구성

| Phase  | 목표                                      | 결과물                                                                              |
| ------ | ----------------------------------------- | ----------------------------------------------------------------------------------- |
| **P0** | **Skia canvas 투명화 (가시성 전제 확보)** | `SkiaRenderer` 3 call site 투명 clear + `.canvas-container { background: --bg }`    |
| **P1** | DotBackground 컴포넌트 + CSS 스캐폴딩     | 컴포넌트 1개, CSS 블록 1개, BuilderCanvas 통합                                      |
| **P2** | Viewport 동기화 (pan/zoom → CSS 변수)     | `useViewportSyncStore` 구독, gap/offset 계산                                        |
| **P3** | 커서 글로우 (pointermove → mask)          | rAF 스로틀 핸들러, opacity 페이드                                                   |
| **P4** | 다크모드/토큰/그리드 공존 검증            | 시맨틱 변수 매핑 확인, gridRenderer 동시 활성화 시 시각 확인, 테마 전환 시각 테스트 |

Phase 순서 엄수: **P0 먼저**. P0 없이 P1~P3 구현하면 도트 레이어가 완전히 은폐되어 전혀 보이지 않는다 (ADR Context § "캔버스 불투명 이슈" 참조).

## 파일 변경 목록

### 신규

| 경로                                                              | 내용                                               | LoC 추정 |
| ----------------------------------------------------------------- | -------------------------------------------------- | -------- |
| `apps/builder/src/builder/workspace/components/DotBackground.tsx` | 컴포넌트 본체 (viewport 구독 + pointermove 핸들러) | ~70      |

### 수정

| 경로                                                             | 변경                                                                                                                                                                                                    | LoC 추정      |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `apps/builder/src/builder/workspace/canvas/skia/SkiaRenderer.ts` | **P0**. `clearFrame()` (L145), `present()` (L459), `renderLegacy()` (L670) 3 call site 의 `mainCanvas.clear(this.backgroundColor)` → `mainCanvas.clear(this.ck.Color4f(0, 0, 0, 0))` 로 교체. 주석 갱신 | 3 line + 주석 |
| `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx`    | `.canvas-container` 내부 `<SkiaCanvasLazy/>` 와 형제로 `<DotBackground/>` 삽입                                                                                                                          | +2            |
| `apps/builder/src/builder/workspace/Workspace.css`               | `.canvas-container` 에 `background: var(--bg)` 와 `isolation: isolate` 추가 + `.dot-background`, `.dot-background--base`, `.dot-background--glow` 블록 추가                                             | ~45           |

### 건드리지 않음 (명시)

- `packages/specs/**` — D3 비적용
- `apps/preview/**`, `apps/publish/**` — Builder 전용 UI
- `apps/builder/src/builder/workspace/canvas/skia/SkiaRenderer.ts` 의 `backgroundColor` 필드/`setBackgroundColor()`/`setupThemeWatcher` 색 동기화 경로 — 시각적 no-op 이 되나 API 보존 (후속 정리는 별도 ADR)
- `ViewportController.ts`, `viewportActions.ts` — 기존 이벤트 경로 무변경
- `apps/builder/src/builder/workspace/canvas/skia/SkiaCanvas.tsx` — pointer-events/z-index 등 기존 설정 유지. 배경 resolveBg/setBackgroundColor 호출은 남겨두되 시각적으로 무의미해짐

## 핵심 구현

### P0. SkiaRenderer clear 투명화

```ts
// SkiaRenderer.ts L144~147 (clearFrame)
clearFrame(): void {
  // ADR-102: void 영역 투명화 — DotBackground 가 뒤에서 보이도록.
  // 페이지 body fill 은 element 트리 렌더 경로에서 유지됨.
  this.mainCanvas.clear(this.ck.Color4f(0, 0, 0, 0));
  this.mainSurface.flush();
}

// SkiaRenderer.ts L459 (present) / L670 (renderLegacy) 도 동일 치환
// 주석 추가: "ADR-102 투명 clear"
```

`this.backgroundColor` 필드와 `setBackgroundColor()` / `setupThemeWatcher → onThemeChange` 경로는 API/상태만 보존되고 시각적 no-op 이 된다 (clear 는 투명, 페이지 fill 은 element 트리가 담당). 제거 또는 간소화는 후속 작업으로 미룬다.

### DotBackground.tsx

```tsx
import { useEffect, useRef } from "react";
import {
  useViewportSyncStore,
  selectCanvasViewportSnapshot,
  isCanvasViewportSnapshotEqual,
} from "../canvas/stores/viewportSync";

const BASE_GAP = 20;
const DOT_SIZE = 1;
const GLOW_RADIUS = 140;

export function DotBackground() {
  const baseRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);

  // viewport → CSS 변수
  useEffect(() => {
    const apply = (s: {
      panOffset: { x: number; y: number };
      zoom: number;
    }) => {
      const gap = BASE_GAP * s.zoom;
      const ox = ((s.panOffset.x % gap) + gap) % gap;
      const oy = ((s.panOffset.y % gap) + gap) % gap;
      for (const el of [baseRef.current, glowRef.current]) {
        if (!el) continue;
        el.style.setProperty("--dot-gap", `${gap}px`);
        el.style.setProperty("--dot-offset-x", `${ox}px`);
        el.style.setProperty("--dot-offset-y", `${oy}px`);
        el.style.setProperty("--dot-size", `${DOT_SIZE * s.zoom}px`);
      }
    };
    apply(selectCanvasViewportSnapshot(useViewportSyncStore.getState()));
    return useViewportSyncStore.subscribe(selectCanvasViewportSnapshot, apply, {
      equalityFn: isCanvasViewportSnapshotEqual,
    });
  }, []);

  // 커서 글로우
  useEffect(() => {
    const host = baseRef.current?.parentElement;
    const glow = glowRef.current;
    if (!host || !glow) return;

    const onMove = (e: PointerEvent) => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        const r = host.getBoundingClientRect();
        glow.style.setProperty("--cx", `${e.clientX - r.left}px`);
        glow.style.setProperty("--cy", `${e.clientY - r.top}px`);
        glow.style.opacity = "1";
        rafRef.current = 0;
      });
    };
    const onLeave = () => {
      glow.style.opacity = "0";
    };

    host.addEventListener("pointermove", onMove, { passive: true });
    host.addEventListener("pointerleave", onLeave);
    return () => {
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <>
      <div
        ref={baseRef}
        className="dot-background dot-background--base"
        aria-hidden
      />
      <div
        ref={glowRef}
        className="dot-background dot-background--glow"
        style={{ "--glow-r": `${GLOW_RADIUS}px` } as React.CSSProperties}
        aria-hidden
      />
    </>
  );
}
```

### Workspace.css 추가 블록

```css
/* ============================================
 * Dot Background (ADR-102) — Builder workspace 전용
 * Skia canvas 아래 레이어, pointer-events 무간섭
 * P0에서 Skia clearFrame 투명화 전제
 * ============================================ */

/*
 * .canvas-container 에 두 가지 변경:
 *   1) background: var(--bg) — Skia void 투명화 후 도트 반투명 사이 베이스 색.
 *      테마 변경은 CSS 변수 경로로 자동 반영(ADR-021).
 *   2) isolation: isolate — DotBackground/Skia/자손 absolute 자식이
 *      자체 stacking context 내에서 안정적으로 z-index 적용되도록 격리.
 *      기존 TextEditOverlay(absolute)/GPUDebugOverlay/wasmLayoutFailed 배너(z:9999) 는
 *      .canvas-container 의 자손이므로 동일 컨텍스트에서 정상 렌더됨.
 */
.canvas-container {
  background: var(--bg);
  isolation: isolate;
}

.dot-background {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: radial-gradient(
    circle,
    var(--dot-color) var(--dot-size, 1px),
    transparent calc(var(--dot-size, 1px) + 0.5px)
  );
  background-size: var(--dot-gap, 20px) var(--dot-gap, 20px);
  background-position: var(--dot-offset-x, 0) var(--dot-offset-y, 0);
}

.dot-background--base {
  --dot-color: var(--fg-muted);
  opacity: 0.4;
  z-index: 0;
}

.dot-background--glow {
  --dot-color: var(--accent);
  opacity: 0;
  z-index: 1;
  transition: opacity 200ms ease;
  -webkit-mask-image: radial-gradient(
    circle var(--glow-r, 140px) at var(--cx, -9999px) var(--cy, -9999px),
    #000 0%,
    transparent 100%
  );
  mask-image: radial-gradient(
    circle var(--glow-r, 140px) at var(--cx, -9999px) var(--cy, -9999px),
    #000 0%,
    transparent 100%
  );
}
```

### BuilderCanvas.tsx 수정 지점

```tsx
// BuilderCanvas.tsx — .canvas-container 내부
// 기존: <SkiaCanvasLazy/> (내부에 실제 <canvas>), <ViewportControlBridge/>
{containerEl && (
  <SkiaCanvasLazy ... />
)}
<DotBackground />   {/* ← SkiaCanvasLazy 와 형제로 삽입 */}
{containerEl && (
  <ViewportControlBridge ... />
)}
```

실제 `<canvas>` 엘리먼트는 `SkiaCanvas.tsx` 내부에 있으므로, `DotBackground` 는 `.canvas-container` 직계 자식 레벨에서 `SkiaCanvasLazy` 와 **형제**로 삽입한다. DOM 순서상 Skia보다 뒤에 오지만 z-index(`canvas: 2` / `base: 0` / `glow: 1`)로 시각 스택은 배경이 아래가 된다. P0에서 Skia 가 void 영역을 투명화하므로 도트 레이어가 실제로 노출된다.

## pan/zoom 수학 설명

React Flow가 `<pattern x y>` 속성을 업데이트하는 것과 수학적으로 동등한 것을 CSS `background-position` 으로 표현:

```
gap        = BASE_GAP * zoom              // 줌 시 도트 간격 확대/축소
offset_x   = mod(panOffset.x, gap)        // 타일 경계 내 위치
offset_y   = mod(panOffset.y, gap)
```

`background-size`가 타일 크기 → 브라우저가 무한 타일링. `background-position` 이동만으로 "도트가 패닝에 따라 흐르는" 효과 달성.

`((x % gap) + gap) % gap` 패턴은 음수 panOffset 에서도 양수 오프셋 보장 (JS `%` 는 음수 반환 가능).

## 검증 체크리스트

### P0 투명화 전용 검증 (ADR Gate G2 반영)

- [ ] `SkiaRenderer` 3 call site 전환 후 페이지 내부 영역 before/after 스크린샷 pixel diff 0 (페이지 body fill 동등)
- [ ] viewport void(페이지 바깥) 영역의 pixel alpha=0 확인 (`<canvas>` 픽셀 샘플 또는 DevTools)
- [ ] `.canvas-container { background: var(--bg) }` 가 light/dark 전환 시 즉시 반영 (ADR-021 `setupThemeWatcher` 경로 독립 확인)
- [ ] `SkiaRenderer.setBackgroundColor()` / `readCssBgColor()` / `setupThemeWatcher` 호출이 남아있어도 런타임 오류 없음 (API 보존)

### 시각

- [ ] 베이스 도트가 canvas 영역 전체(페이지 바깥 void)에 균일 노출
- [ ] 페이지 body 내부는 기존처럼 불투명 fill (body backgroundColor 설정된 경우) — 도트가 페이지 위로 올라타지 않음
- [ ] pan(휠/드래그) 시 도트가 패닝 방향으로 자연스럽게 흐름
- [ ] zoom(Ctrl+휠) 시 도트 간격이 줌 비율에 맞춰 변화
- [ ] 마우스가 canvas 안에 있을 때 커서 주변 반경 ~140px 안에서 accent 색 도트 노출
- [ ] 마우스가 canvas 밖으로 나가면 200ms 페이드아웃
- [ ] 다크모드 전환 시 `--bg`/`--fg-muted`/`--accent` 토큰값에 따라 색 자동 변경
- [ ] `showGrid=true` 설정 시 Skia gridRenderer(씬 좌표계 그리드)와 DotBackground(스크린 좌표계 도트)가 동시 노출되며 시각 간섭 없음 (그리드는 페이지 내부에서, 도트는 void 영역에서 지배)

### 성능

- [ ] **배경 on/off 비교**: DotBackground 장착/제거 상태에서 동일 조작(hover, pan, zoom) 시 Skia invalidation 카운트 증가 **0건** (기존 hover 경로의 RAF는 허용, 배경 때문에 추가된 invalidation만 검출)
- [ ] DotBackground의 pointermove 핸들러 frame budget **< 2ms**
- [ ] 뷰포트 full 영역에서 60fps 유지 (배경 on 상태에서 기존 편집 캔버스와 동등)

### 정합성 (ADR Gate G1 반영)

- [ ] pointer-events 기존 ViewportController/중앙 pointer 핸들러와 충돌 없음 (드래그/선택/휠 zoom 동작 확인)
- [ ] `pointermove` bubble이 `.canvas-container`에 도달 (canvas target에서 `stopPropagation()` 호출 여부 확인 — ViewportController 내 이벤트 처리 경로 점검. wheel에만 stopPropagation 있음이 확인됨)
- [ ] `.canvas-container`에 `isolation: isolate` 적용 후 z-index 스택 안정:
  - [ ] `SkiaCanvas` (z-index:2, pointer-events:auto) 정상 렌더
  - [ ] `TextEditOverlay` (absolute, BuilderCanvas.tsx:671) 위치/z-index 기존 동일
  - [ ] `GPUDebugOverlay` (BuilderCanvas.tsx:668) 기존 동일
  - [ ] `wasmLayoutFailed` 배너 (z:9999, BuilderCanvas.tsx:610-645) 기존과 동일하게 최상단 노출
  - [ ] `ViewportControlBridge` (BuilderCanvas.tsx:657-666) 이벤트/포인터 동작 회귀 0
- [ ] `.canvas-container` 외 영역(scrollbar z:10 형제, WorkflowCanvasToggles, WorkspaceStatusIndicator) 침범 없음
- [ ] 비교 모드(compareMode): 좌측 CSS fallback 패널은 현상 유지(도트 배경 없음), 우측 Canvas 패널은 도트 배경 포함 정상 동작
- [ ] compare 모드 split resizer(`.workspace-compare-resizer`) 드래그 정상 — `isolation: isolate` 로 인한 z-index 충돌 없음

### 브라우저

- [ ] Chrome/Edge: mask-image 정상
- [ ] Safari: `-webkit-mask-image` 폴백 확인
- [ ] Firefox: `mask-image` 정상

## 롤백 플랜

1. `BuilderCanvas.tsx` 의 `<DotBackground />` 한 줄 제거
2. `DotBackground.tsx` 파일 삭제
3. `Workspace.css` 의 `.dot-background*` 블록 + `.canvas-container { background / isolation }` 2 줄 삭제
4. `SkiaRenderer.ts` 의 3 call site 를 `this.mainCanvas.clear(this.backgroundColor)` 로 원복

번들 -~1.5KB, 런타임 영향 0, Skia 렌더 경로 완전 원복.

## Out of Scope (본 ADR 미포함)

- on/off 토글 UI (필요 시 후속 ADR)
- 간격/반경/색상 사용자 설정 (필요 시 후속 ADR)
- 다중 테마별 별도 커스터마이즈 (현재는 시맨틱 토큰 자동 전환으로 충분)
- Preview/Publish 적용 (D3 아님, 의도적 제외)
- `SkiaRenderer.backgroundColor` 필드/`setBackgroundColor()`/`setupThemeWatcher` 색 동기화 경로 제거 — P0 이후 시각적 no-op 이 되므로 정리 가능하나 별도 ADR 로 분리 (API 영향 범위 검토 필요)
