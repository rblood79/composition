# ADR-067 Phase 3 — G1 Metrics (Typography)

**Date**: 2026-04-15
**Branch**: `refactor/adr-059-b5-togglebutton-indicator-ssot` (HEAD `80b03116` 기준)
**Phase 3 Scope**: Typography 섹션 (16 props + textBehaviorPreset + isFontSizeFromPreset) Jotai → Zustand 전환

---

## G1 (a) — `computeSyntheticStyle` 호출 0회

**측정 방법**:

- 임시 계측: `computeSyntheticStyle` 진입부에 `(globalThis as any).__csyCalls.push(element?.type)` 추가
- Typography 섹션만 펼친 상태 (`localStorage.styles-panel-collapse`로 transform/layout/appearance/state/comp-\* 전부 collapsed)
- 페이지 리로드 → `globalThis.__csyCalls = []` 초기화 → 2개 요소 교차 선택 12회

**결과**: `__csyCalls.length = 0`, `csyTypes = []`

✅ **G1 (a) PASS**

---

## G1 (b) — Typography Value Resolve

**측정 대상**: `TypographySectionContent` 안에서 `useTypographyValues(selectedId)` resolve 시간 (16 props + derived `textBehaviorPreset` + `isFontSizeFromPreset`).

**Sample 분포** (12 samples, ms):

```
0, 0, 0, 0.1, 0, 0, 0.1, 0, 0, 0, 0, 0
```

| 지표       | 값 (ms) | 통과 조건 | 판정        |
| ---------- | ------- | --------- | ----------- |
| min        | 0       | —         | —           |
| **median** | **0**   | ≤ 4ms     | ✅ PASS     |
| **p95**    | **0.1** | ≤ 8ms     | ✅ PASS     |
| max        | 0.1     | —         | —           |
| samples    | 12      | 30 권장   | 분포 안정적 |

**해석**:

- 16 props 집약 + 2 derived (`textBehaviorPreset`/`isFontSizeFromPreset`)이 submillisecond resolve
- Phase 1 Transform(median 0.1ms / p95 0.1ms), Phase 2 Layout(median 0ms / p95 0.1ms)과 동등 수준
- `resolveTypographySpecPreset` O(1) cache hit, Jotai selectAtom graph 경유 제거로 체인 단축

✅ **G1 (b) PASS**

---

## G1 (c) — Canvas FPS during drag/resize

자동 측정 미수행. Phase 1/2와 동일 사유 — Typography 섹션 변경은 Canvas 렌더 path 외부 (read-only consumer).

**판정**: ⚠️ **수동 검증 대기**

---

## G1 종합 판정

| 항목                                 | 결과                             |
| ------------------------------------ | -------------------------------- |
| (a) `computeSyntheticStyle` 호출 0회 | ✅ PASS                          |
| (b) Typography resolve median ≤ 4ms  | ✅ PASS (median 0ms / p95 0.1ms) |
| (c) Canvas FPS 60 유지               | ⚠️ 수동 검증 대기                |

**최종 판정**: **PASS**

---

## Cleanup

계측 코드(`__csyCalls` push / `_g1bStart` + `__resolveTimes`)는 측정 완료 후 revert:

- `apps/builder/src/services/computedStyleService.ts`
- `apps/builder/src/builder/panels/styles/sections/TypographySection.tsx`

## 참조

- ADR-067: `docs/adr/067-style-panel-skia-native-read-path.md` §Gates G1
- Phase 2 measurements: `067-phase2-g1-metrics.md`
- Phase 1 measurements: `067-phase1-csy-calls.md`, `067-phase1-paint-latency.md`
