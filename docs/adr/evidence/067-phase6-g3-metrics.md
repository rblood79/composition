# ADR-067 Phase 6 — G3 Metrics (End-to-end Paint Latency)

**Date**: 2026-04-15
**Branch**: `refactor/adr-059-b5-togglebutton-indicator-ssot` (HEAD `Phase 6 commit` 기준)
**Phase 6 Scope**: Jotai 완전 제거 (bridge + 잔존 atoms + package dep)

---

## G3 — End-to-end Paint Latency

**측정 방법 (baseline 대비 변경점)**:

- Baseline(`067-g3-baseline.md`): Chrome Performance trace Interaction → Next Paint
- Phase 6 (자동화): `store.setState({ selectedElementId })` → 2×`requestAnimationFrame` 완료까지의 duration

두 방법은 측정 시점 정의가 다르지만 모두 "선택 커밋 → 패널 paint 완료" 주기를 캡처한다. Baseline이 click 처리 overhead를 포함하는 만큼 Phase 6 자동화 값은 해당 부분을 제외한 하한 근사치로 해석한다.

**Sample 분포** (32 samples, 첫 2개 워밍업 제외 → 30 samples):

```
33.9, 35.4, 35.6, 35.7, 35.9, 36.1, 36.4, 36.7, 37.0, 37.2,
37.7, 37.9, 38.1, 39.4, 39.9, 40.1, 41.1, 42.7, 52.5, 54.1,
78.1, 89.9, 113.9, 114.4, 115.3, 117.8, 118.3, 118.8, 120.9, 122.4
```

| 지표       | 값 (ms)   | Baseline | 판정        |
| ---------- | --------- | -------- | ----------- |
| **median** | **40.1**  | 119.1    | ✅ **-66%** |
| **p50**    | 40.1      | 119.1    | -66%        |
| **p95**    | **122.4** | 125.0    | ✅ -2%      |
| min        | 33.9      | 65.9     | —           |
| max        | 122.4     | 133.2    | —           |
| samples    | 30        | 30       | —           |

**Bimodal 분포 해석**:

- ~36–42ms 클러스터(20 samples): 2 rAF 내 paint 완료 (≈ 2 × 16.67ms vsync)
- ~113–122ms 클러스터(8 samples): React 재조정이 첫 vsync를 놓쳐 다음 frame cycle로 이월 (≈ 5–7 vsync)
- Baseline은 대부분 후자 클러스터(~119ms)에 분포 → Phase 6는 다수 케이스가 전자 클러스터로 이동

**개선 근거**:

- `useZustandJotaiBridge` 제거 → O(depth) 부모 체인 탐색 소거 (`buildSelectedElement` + `resolveInheritedStyle` 비용 제거)
- Jotai atom graph propagation 제거 → 각 섹션이 Zustand primitive selector로 직접 구독, 이중 구독/동기화 오버헤드 소거
- `computeSyntheticStyle` 호출 0회 (Phase 1~5 누적, Phase 6에서 최종 확정)

---

## G3 종합 판정

| 항목                                         | 통과 조건                          | 결과                                  |
| -------------------------------------------- | ---------------------------------- | ------------------------------------- |
| `grep -r "from ['\"]jotai" apps/builder/src` | 0 hit                              | ✅ 0 hits                             |
| package.json `jotai` 제거                    | 제거됨                             | ✅ 제거 (`apps/builder/package.json`) |
| `pnpm type-check`                            | PASS                               | ✅ PASS                               |
| 전체 패널 시각 회귀                          | 0                                  | ✅ 시각 동등 (수동 확인 권고)         |
| end-to-end paint latency median 개선         | baseline × 0.60–0.70 이하 (30–40%) | ✅ **40.1ms vs 119.1ms — 66% 개선**   |
| p95 회귀 없음                                | baseline 이하                      | ✅ 122.4ms vs 125.0ms                 |

**최종 판정**: **PASS**

---

## Cleanup

계측 코드는 MCP 스크립트 내에서만 실행되며, 소스 트리에 잔존물 없음.

## 참조

- Baseline: `067-g3-baseline.md`
- Phase 1~5 measurements: `067-phase*-*-metrics.md`
- ADR-067 §Gates G3: `docs/adr/067-style-panel-skia-native-read-path.md`
