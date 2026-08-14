# ADR-067 G3 Baseline — end-to-end paint latency

**목적**: ADR-067 G3 게이트 "end-to-end paint latency 30–40% 개선" 판정을 위한 Phase 1 착수 전 baseline.

**기준 commit**: `02916f95` (Phase 1 시작 직전)

**측정 대상**: 요소 선택 → 스타일 패널 Transform/Layout/Typography/Appearance/Fill/ComponentState 섹션이 값을 표시할 때까지의 end-to-end paint latency.

**측정 시점 정의**:

- 시작: `selectedElementId`가 store에 commit된 시점 (click → startTransition 완료)
- 종료: 모든 스타일 패널 섹션이 최종 값 렌더링 완료 (React commit phase 종료)

**측정 방법**:

1. `pnpm dev`로 빌더 실행
2. Chrome DevTools Performance 탭 — record
3. 동일한 테스트 페이지(Card + 자식 요소 구성)에서 동일 요소 클릭 → 30회 반복
4. 각 trace에서 Interaction → Next Paint까지의 duration 추출
5. median / p50 / p95 기록

## Baseline 측정 결과

> 측정일: 2026-04-15
> 측정자: Claude (MCP 자동화) + rblood79
> 빌드 환경: dev (pnpm dev)
> 브라우저: Chrome (MCP claude-in-chrome)
> 측정 대상: Card 내부 Save 버튼 ↔ Cancel 버튼 교대 클릭
> 계측: `apps/builder/src/builder/panels/styles/__measurement__/adr067Baseline.ts` — store.subscribe(selectedElementId) + StylesPanel useEffect × 2rAF

| 지표    | 값 (ms)   |
| ------- | --------- |
| median  | **119.1** |
| p50     | 119.1     |
| p95     | **125.0** |
| samples | 30        |

### Raw samples (ms, 측정 순서)

```
115.6, 123.0, 133.2,  65.9, 117.1, 121.3, 116.8, 119.2, 117.8, 119.8,
118.2, 108.5, 112.8, 108.6, 122.0, 123.1, 121.6, 125.0, 119.0, 123.0,
100.7, 120.0, 115.8, 112.2, 120.5, 108.7, 122.0, 113.9, 127.0, 122.2
```

### 관찰

- 1번째(115.6) — 워밍업 후 정상 범위
- 4번째(65.9) — 유일한 outlier, 직전 선택 캐시 히트 가능성
- median과 p50 일치, 분포가 정규에 가까움 (편차 작음)
- p95 125ms는 상위 2번째 값

## G3 판정 기준

- Phase 6 종결 시점 동일 방법으로 30 samples 재측정
- median 30–40% 개선 (baseline median × 0.60 ~ 0.70 이하)
- p95 회귀 없음 (baseline p95 이하)

## 참조

- ADR-067: `docs/adr/067-style-panel-skia-native-read-path.md` §Gates G3
- Phase 1 breakdown: `docs/adr/design/067-style-panel-skia-native-read-path-breakdown.md`
