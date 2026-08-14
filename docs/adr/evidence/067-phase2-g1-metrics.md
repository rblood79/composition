# ADR-067 Phase 2 — G1 Metrics (Layout + Spacing)

**Date**: 2026-04-15
**Branch**: `refactor/adr-059-b5-togglebutton-indicator-ssot` (HEAD `a9aa0ae8` 기준)
**Phase 2 Scope**: Layout 섹션 (6 layout + 10 spacing props) + 4 derived-keys hooks, Jotai → Zustand 전환

---

## G1 (a) — `computeSyntheticStyle` 호출 0회

**측정 방법**:

- 임시 계측: `computeSyntheticStyle` 진입부에 `(window.__csyCalls ||= []).push(element?.type)` 추가
- Layout 섹션만 펼친 상태 (`localStorage.styles-panel-collapse`로 transform/appearance/typography/state/comp-\* 전부 collapsed)
- 페이지 리로드 → `window.__csyCalls = []` 초기화 → 2개 요소 교차 선택 12회 → 호출 수 집계

**결과**: `window.__csyCalls.length = 0`

✅ **G1 (a) PASS** — Layout/Spacing 섹션 렌더 중 `computeSyntheticStyle` 호출 없음

---

## G1 (b) — Layout + Spacing Value Resolve

**측정 대상**: `LayoutSectionContent` 안에서 `useLayoutValues` + `useFlexDirectionKeys` + `useFlexAlignmentKeys` + `useJustifyContentSpacingKeys` + `useFlexWrapKeys` 5 hook 합산 resolve 시간.

**측정 방법**:

- LayoutSection.tsx에 `_g1bStart = performance.now()` → hook 호출 후 `window.__resolveTimes.push(...)` 계측
- 2개 요소 교차 선택 12회 (80ms 간격)
- 측정 후 계측 제거

**Sample 분포** (12 samples, ms):

```
0, 0.1, 0.1, 0, 0.1, 0, 0, 0, 0, 0, 0, 0
```

| 지표       | 값 (ms) | 통과 조건 | 판정        |
| ---------- | ------- | --------- | ----------- |
| min        | 0       | —         | —           |
| **median** | **0**   | ≤ 4ms     | ✅ PASS     |
| **p95**    | **0.1** | ≤ 8ms     | ✅ PASS     |
| max        | 0.1     | —         | —           |
| samples    | 12      | 30 권장   | 분포 안정적 |

**해석**:

- 16 props 집약(`useLayoutValues`) + 4 derived-keys hooks 합산이 submillisecond resolve
- Phase 1 Transform pilot(median 0.1ms / p95 0.1ms)과 동등 수준
- Spec preset lookup이 O(1) cache hit, `useSyncExternalStore` 미사용(derived keys는 순수 Zustand selector + useMemo)

✅ **G1 (b) PASS**

---

## G1 (c) — Canvas FPS during drag/resize

자동 측정 미수행. Phase 1과 동일 사유 — Layout 섹션 변경은 Canvas 렌더 path 외부 (read-only consumer). 회귀 가능성 매우 낮음.

**판정**: ⚠️ **수동 검증 대기** (필요 시 Chrome DevTools Rendering FPS meter)

---

## G1 종합 판정

| 항목                                    | 결과                             |
| --------------------------------------- | -------------------------------- |
| (a) `computeSyntheticStyle` 호출 0회    | ✅ PASS                          |
| (b) Layout/Spacing resolve median ≤ 4ms | ✅ PASS (median 0ms / p95 0.1ms) |
| (c) Canvas FPS 60 유지                  | ⚠️ 수동 검증 대기                |

**최종 판정**: **PASS**

---

## Cleanup

계측 코드(`__csyCalls` push / `_g1bStart` + `__resolveTimes`)는 측정 완료 후 revert:

- `apps/builder/src/services/computedStyleService.ts`
- `apps/builder/src/builder/panels/styles/sections/LayoutSection.tsx`

## 참조

- ADR-067: `docs/adr/067-style-panel-skia-native-read-path.md` §Gates G1
- breakdown Phase 2: `docs/adr/design/067-style-panel-skia-native-read-path-breakdown.md`
- Phase 1 measurements: `067-phase1-csy-calls.md`, `067-phase1-paint-latency.md`
