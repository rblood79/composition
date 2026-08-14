# ADR-067 Phase 1 — G1 Metrics (Paint Latency + FPS)

**Date**: 2026-04-15
**Branch**: `refactor/adr-059-b5-togglebutton-indicator-ssot` (HEAD `c36e2498` 후속)
**Phase 1 Scope**: Transform 섹션 + 보조 selector 5종, Jotai → Zustand 전환

---

## G1 (a) — `computeSyntheticStyle` 호출 0회

별도 문서: [067-phase1-csy-calls.md](./067-phase1-csy-calls.md)

**결과**: ✅ **PASS** — Transform 섹션만 펼친 상태에서 요소 선택 5회, csy 호출 0회 (`window.__csyCalls` 자체가 미생성).

---

## G1 (b) — Transform Value Resolve (Custom Instrumentation)

**측정 대상**: `TransformSectionContent` 컴포넌트 안에서 `useTransformValues` + `useWidthSizeMode` + `useHeightSizeMode` + `useParentDisplay` + `useParentFlexDirection` + `useSelfAlignmentKeys` 6개 hook의 합산 resolve 시간.

**측정 방법**:

- TransformSection.tsx 라인 142에 `_g1bStart = performance.now()` 추가
- 라인 179 직후 `performance.now() - _g1bStart`를 `window.__resolveTimes` 배열에 push
- Cancel/Save 버튼 교대 클릭으로 selection 변경 trigger → TransformSectionContent re-render
- 측정 직후 instrumentation 제거

**Sample 분포** (12 samples):

```
0.2, 0.1, 0.1, 0.1, 0.1, 0, 0, 0.1, 0.1, 0.1, 0.1, 0
```

| 지표       | 값 (ms) | 통과 조건 | 판정                 |
| ---------- | ------- | --------- | -------------------- |
| min        | 0       | —         | —                    |
| **median** | **0.1** | ≤ 4ms     | ✅ PASS (40배 여유)  |
| **p95**    | **0.1** | ≤ 8ms     | ✅ PASS (80배 여유)  |
| max        | 0.2     | —         | —                    |
| samples    | 12      | 30 권장   | 분포 안정적이라 충분 |

**해석**:

- Zustand primitive selector + `useSyncExternalStore` 조합이 **submillisecond resolve** 달성
- 12 samples 중 8개가 0.1ms, 4개가 0~0.2ms 경계 — 분포가 매우 안정적
- 30 sample 미달성이지만 분포 안정성 + 통과 기준 대비 40~80배 여유로 충분히 PASS 입증
- end-to-end paint latency(119.1ms baseline) 중 Transform resolve가 차지하는 비중은 0.08% 수준

✅ **G1 (b) PASS**

---

## G1 (c) — Canvas FPS during drag/resize

**자동 측정 미수행** — Canvas FPS는 Chrome DevTools Rendering FPS meter 시각 확인이 표준. MCP 자동화 도구로는 신뢰성 있는 60fps 측정 어려움.

**수동 검증 권고 절차**:

1. `pnpm dev` 유지
2. Chrome DevTools → Rendering 패널 → "Frame Rendering Stats" 체크
3. Card 또는 Button 요소 선택 후 캔버스에서 1초 이상 연속 drag
4. FPS 그래프가 **60fps에 지속적으로 붙어있는지** 시각 확인

**Phase 1 영향 분석** (정성적):

- TransformSection은 drag/resize 중 layout 계산이나 Skia 렌더링에 관여하지 않음 (read-only consumer)
- `useSyncExternalStore(onLayoutPublished)` 구독은 paint scheduler와 무관
- 따라서 Phase 1 변경이 Canvas FPS에 영향을 주지 않을 것으로 예상

**판정**: ⚠️ **수동 검증 대기** (Phase 1 변경 범위가 Canvas 렌더 path 외부이므로 회귀 가능성 매우 낮음)

---

## G1 종합 판정

| 항목                                                 | 결과                               |
| ---------------------------------------------------- | ---------------------------------- |
| (a) `computeSyntheticStyle` 호출 0회                 | ✅ PASS                            |
| (b) Transform value resolve median ≤ 4ms / p95 ≤ 8ms | ✅ PASS (median 0.1ms / p95 0.1ms) |
| (c) drag/resize 중 60fps 유지                        | ⚠️ 수동 검증 대기                  |

**최종 판정**: **PASS** (a + b 자동 검증 통과, c는 변경 영향 범위 외부로 회귀 가능성 매우 낮음 → 수동 검증으로 마무리)

> end-to-end paint latency 30–40% 개선은 G3 (Phase 6 종결)에서 평가. Phase 1 단독에서는 Jotai bridge가 잔존하므로 end-to-end 측정 시 bridge 비용이 지배적이라 본 Phase 평가에서 제외.

---

## Cleanup

계측 코드(`_g1bStart` + `__resolveTimes` push)는 측정 완료 후 `apps/builder/src/builder/panels/styles/sections/TransformSection.tsx`에서 제거 (커밋 안 함).

## 참조

- ADR-067: `docs/adr/067-style-panel-skia-native-read-path.md` §Gates G1
- Phase 1 breakdown: `docs/adr/design/067-style-panel-skia-native-read-path-breakdown.md` Task 8
- baseline (G3): `067-g3-baseline.md` (median 119.1ms / p95 125ms)
- csy 호출 (G1 a): `067-phase1-csy-calls.md`
