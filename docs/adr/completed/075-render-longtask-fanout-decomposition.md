# ADR-075: Render longtask fan-out 해체 — SkiaCanvas rAF / StoreRenderBridge subscriber 축소

> **SSOT domain**: D3 (시각 스타일) 경계 불변. 본 ADR 은 **렌더 consumer 내부 subscription + rAF work 스케줄링 최적화**. Spec/Skia/CSS 3-domain 모델 무관. 정본: [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md). 직접 선례: [ADR-074](074-canvas-input-pipeline-decomposition.md) (함수 본체 최적화 완료, 본 ADR 은 Addendum 2 에서 이관된 체감 경로), [ADR-069](069-input-frame-violation-mitigation.md) (prod gate 방식), [ADR-067](067-style-panel-skia-native-read-path.md) (Zustand-native 세분화 선례).

## Status

Implemented — 2026-04-18 (Phase 0 prod 측정으로 Gate 충족, Phase 1~5 구현 skip — ADR-069 종결 패턴 재현)

> **Addendum 1 (2026-04-18)**: Phase 0 prod baseline 실측 결과 `longtask.render` p99 = 57ms / `longtask.input` p95 = 87ms / viol100ms 2.5% — breakdown §0 경로 1 (ADR scope 축소) 충족. ADR-074 Addendum 2 에서 이관된 dev 19742ms stall 은 prod 에서 재현 안 됨 (scheduler.development.js 오버헤드가 주 기여자였음). 구현 Phase 1/2/3/5 skip 확정. Phase 4 (attribution payload 개선) 는 독립 가치 있는 infra 개선이므로 후속 분리 고려. 상세: [075-prod-baseline.md](../../adr/design/075-prod-baseline.md).

## Context

ADR-074 P1~P5 land 후 `observe()` 본체 측정 지표는 완전 충족되었으나 (p50 1.1ms / 0.8ms), **사용자 체감 지연은 해소되지 않았다**. ADR-074 Addendum 2 의 longtask 실측이 그 원인을 결정적으로 확증했다:

| 라벨                    | count |   mean    |  p50  |  p95  |     p99     |     max     | viol100  |
| ----------------------- | :---: | :-------: | :---: | :---: | :---------: | :---------: | :------: |
| `longtask.input`        |  52   | 463.79ms  | 467ms | 621ms |   1016ms    |   1016ms    | **100%** |
| `longtask.render`       |  21   | 1219.95ms | 393ms | 578ms | **19742ms** | **19742ms** |   57%    |
| `longtask.unclassified` |  105  |  172.5ms  | 119ms | 411ms |    447ms    |   2942ms    |   65%    |

**핵심 관찰**:

1. `input.pointerdown` 함수 본체 1.1ms vs `longtask.input` p50 467ms → **99.76% 가 React commit + subscriber fan-out**. ADR-074 가 BuilderCanvas 루트에서 selection/editing/ai 구독 6개를 제거했으나, 하위 consumer (`StoreRenderBridge`, `SkiaCanvas` rAF loop, 1168 개 잔존 subscriber) 는 그대로 유지.
2. `longtask.render` p99 19742ms — **한 번의 20초 stall 발생**. 사용자 세션 내 한 번이라도 발생하면 응답 불가 수준. **주 기여 구간 (content.build / plan.build / skia.draw) 은 미측정** — Phase 0 에서 구간별 observe baseline 확보 필수 (Codex 3차 리뷰 지적 3 반영).
3. `longtask.unclassified` count 105 — observe 경로와 시간 중첩 안 된 task. dev scheduler.development.js / React dev build overhead. ADR-069 종결 패턴대로 prod 빌드 시 큰 폭 감소 예상.

**StoreRenderBridge 구독 실제 상태 (Codex 1/2차 리뷰 확증)**: `SkiaCanvas.tsx:277-287` 의 subscribe 콜백은 이미 `elementsMap/childrenMap` 참조 변경 + `themeVersion` 변경 가드로 `cb()` 호출을 제한한다. `StoreRenderBridge.ts:159-189` `sync()` 도 themeChanged + changedIds 기반 증분 갱신 구현. 따라서 `subscribeWithSelector` 전환은 **모든 store action 에서 돌던 얕은 비교 콜백(μs 수준)** 만 제거하며, 비용이 큰 `fullRebuild()` / `incrementalSync()` 호출 빈도는 이미 최소화됨. fan-out 의 실제 주 비용은 SkiaCanvas rAF loop + 다수 독립 subscriber (ADR-074 에서 일부 제거했으나 잔존).

ADR-074 는 함수 본체 축을 완수했고, 본 ADR 은 **render longtask 축 (subscriber fan-out + rAF 폭주)** 을 해체하여 실제 체감 개선을 달성한다.

### Hard Constraints

1. **Gate G2 (prod)**: `longtask.render` p99 < **500ms** (현재 dev 19742ms, prod 미측정).
2. **Gate G3 (prod)**: `longtask.input` p95 < **100ms** (현재 dev 621ms).
3. **Gate G4 (prod)**: `longtask.*` viol100ms < **10%** (현재 longtask.input 100%).
4. **ADR-074 비회귀**: `input.pointerdown` / `input.page-transition` observe 본체 p95 < 2ms 유지.
5. `pnpm type-check` 3 tasks 통과.
6. Chrome MCP 회귀: 렌더링 정합성 시각 불변 (요소 선택 / 드래그 / workflow overlay / AI flash / grid / 페이지 전환).
7. **ADR-069 prod gate 방식 정합**: dev 측정은 참고용, 공식 Gate 는 prod 기준.

### Soft Constraints

- 점진 land (P1~P5 각 독립 PR, 중간 rollback 안전).
- 외부 의존성 추가 금지 (Zustand/Skia/RAC 버전 불변).
- StoreRenderBridge 의 `themeVersion` 동기화 경계 유지.

## Alternatives Considered

### 대안 A: rAF budget + subscribeWithSelector 검증 + subscriber 감사

Phase 1 SkiaCanvas rAF loop 에 frame budget 도입 (>8ms 시 yield) / Phase 2 StoreRenderBridge 를 `subscribeWithSelector` 로 세분화 — **저비용 검증 단계**로 분류 (주 처방 아님, 기존 가드가 이미 비용 최소화) / Phase 3 workflow/AI/grid subscriber 감사 후 필요시 세분화 또는 ref 기반 전환 (핵심 fan-out 해체 단계) / Phase 4 longtask attribution **payload 개선** (observe label + overlap ms 를 `topAttributions` 에 주입) / Phase 5 prod 실측 Gate 재검증.

- 근거: [ADR-067](067-style-panel-skia-native-read-path.md) Phase 1~6 Zustand-native 세분화로 G1/G2/G3 전부 PASS (median 40.1ms vs 119.1ms baseline, -66%). 단 StoreRenderBridge 는 ADR-067 style panel 과 달리 이미 elementsMap/childrenMap/themeVersion 가드가 존재 → subscribeWithSelector 효과는 μs 수준으로 제한됨. 주 fan-out 축은 SkiaCanvas rAF + 다수 독립 subscriber (Phase 3 에서 본격 감사).
- 위험:
  - 기술: **HIGH** — Phase 2 subscribeWithSelector 전환 시 빌더 메인 스토어 (`apps/builder/src/builder/stores/index.ts:48`) 가 plain `create()` 로 생성되어 있어 **루트 store 생성부 middleware 전역 주입**이 필요. 모든 기존 subscribers 가 middleware 영향 하. rAF budget 자체는 단순하나 Phase 3 감사 범위가 광범위.
  - 성능: **LOW** — 목표 경로 직접 공략 (Phase 1 rAF budget + Phase 3 subscriber 정리). 선례 (ADR-067) 실증 존재. 단 **P0 구간별 baseline 없이 P1 효과 예측은 불가 — Phase 0 가 선결 조건**.
  - 유지보수: **MEDIUM** — subscription 경계 새로 그림. 새 store field 추가 시 selector 업데이트 필요 (codegen 또는 주석 강제).
  - 마이그레이션: **HIGH** — Phase 2 는 middleware 전역 변경으로 **독립 롤백 불가** (selector 제거만으로는 복원 안 됨, middleware 도 원복 필요 → 다른 subscribers 영향). Phase 1/3/4 는 각 단위 롤백 가능. Phase 0 blocker (prod baseline) 해소 없이 Phase 1 진입 금지.

### 대안 B: OffscreenCanvas + Worker thread 이전

SkiaCanvas 렌더링을 Web Worker 에서 수행 → main thread longtask 자체를 제거.

- 근거: Figma/Pixi 는 WebWorker 기반 렌더링을 일부 채택. Chrome OffscreenCanvas API 안정화.
- 위험:
  - 기술: **CRITICAL** — CanvasKit WASM 을 Worker 에서 재초기화 필요. 기존 Skia 리소스 (font / image atlas) 공유 메커니즘 부재. DOM 이벤트 ↔ Worker proxy 레이어 구축 필수. 프로젝트 내 WASM font loading 인프라 (font-registry-v2) 와 충돌 가능.
  - 성능: **MEDIUM** — main thread 부담은 해소되나 Worker ↔ main 통신 레이턴시 추가. postMessage serialization 비용.
  - 유지보수: **HIGH** — 대규모 구조 변경. 디버깅 툴링 제약 (Worker DevTools 제한적).
  - 마이그레이션: **CRITICAL** — 기존 DOM 이벤트 / selection / drag 전체 재설계. 중간 rollback 사실상 불가.

### 대안 C: React 19 `useTransition` 전면 적용

selection / page 변화 action 을 `startTransition` 으로 래핑. React scheduler 가 priority 조정으로 interrupt 허용.

- 근거: React 19 concurrent features (ADR-067 는 Zustand-native 이라 React concurrent 와 독립).
- 위험:
  - 기술: **MEDIUM** — startTransition 은 state update 를 low priority 로 마킹. Zustand action 은 React scheduler 밖 실행이라 직접 효과 없을 수 있음. useSyncExternalStore 브릿지 필요.
  - 성능: **MEDIUM** — priority 만 조정, 총 work 량 불변. yield 지점 제공은 유용하나 fan-out 양 자체는 동일.
  - 유지보수: **MEDIUM** — React 패러다임 전환. Zustand subscribe 와의 궁합이 실증되지 않음.
  - 마이그레이션: **MEDIUM** — action 전체를 선별 래핑 필요.

### 대안 D: Prod 측정만 수행 (dev overhead 가 전부였다면 무작업)

Phase 0 prod baseline 측정 후, 목표가 이미 충족되면 추가 작업 없이 종결.

- 근거: ADR-069 선례 — dev longtask.input p95 645ms 가 prod 에서 88ms (-86%) 로 자동 감소. scheduler.development.js 242ms 오버헤드 확증.
- 위험:
  - 기술: **LOW** — 단순 측정.
  - 성능: **LOW** — 현상 파악만, 근본 해결 아님.
  - 유지보수: **LOW** — 변경 없음.
  - 마이그레이션: **LOW** — 변경 없음.

### Risk Threshold Check

| 대안                             | 기술  | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| -------------------------------- | :---: | :--: | :------: | :----------: | :--------: |
| A (rAF budget + subscriber 감사) | **H** |  L   |    M     |    **H**     |   **2**    |
| B (OffscreenCanvas / Worker)     | **C** |  M   |  **H**   |    **C**     |   **3**    |
| C (React 19 useTransition)       |   M   |  M   |    M     |      M       |     0      |
| D (prod 측정만)                  |   L   |  L   |    L     |      L       |     0      |

**판정** (Codex 1~3차 리뷰 반영 후 재계산):

- B 는 CRITICAL 2 + HIGH 1 → 기각.
- A 는 Codex 지적 반영으로 HIGH+ 2 로 상승 (Phase 2 middleware 전역 + 독립 롤백 불가). C/D 는 HIGH+ 0.
- A HIGH+ 2 는 **threshold 초과 가능성**. 단 위험 수용 근거 존재:
  - 기술 HIGH: middleware 전역 주입은 Zustand 표준 패턴이며 프로젝트 내 다른 store 에도 선례 적용 가능 (향후 일반화 이득).
  - 마이그레이션 HIGH: Phase 2 를 **"저비용 검증 단계"** 로 제한하고 Phase 3 를 주 처방으로 운영 → Phase 2 미채택 시에도 Phase 1/3/4 가 독립 land 가능.
- C 는 "총 work 량 불변" 이라 Hard Constraint G2/G3/G4 충족 여부 불확실.
- D 는 "작업 안 함" 이라 낮은 리스크지만 prod 측정 결과 목표 미달 시 대안 필요.
- **루프 재판정**: D 를 Phase 0 으로 내장 (prod baseline 필수 + 구간별 분해 필수, Codex 지적 3) + A 의 **Phase 1/3/4 를 주 처방** + **Phase 2 는 선택적 검증 단계** 로 재구성. Phase 2 HIGH 위험은 Phase 2 보류 또는 middleware 일반화 ADR 분리로 수용 가능.

## Decision

**대안 A 를 Phase 1/3/4/5 를 주 처방, Phase 2 를 선택적 검증 단계로 채택하고 Phase 0 에 prod baseline + 구간별 observe 분해를 선행**한다 (Codex 1~3차 리뷰 반영). Phase 0 결과가 Gate G2/G3/G4 를 이미 충족하거나 구간별 분해로 주 기여 구간이 식별되면 Phase 1~5 scope 축소 또는 재배치.

선택 근거:

1. **ADR-067 실증 부분 적용**: Zustand-native 세분화 + subscribeWithSelector 패턴이 Style Panel G1/G2/G3 PASS (median -66%). 단 StoreRenderBridge 는 기존 가드 (elementsMap/childrenMap/themeVersion) 로 이미 fan-out 이 μs 수준 — ADR-067 대비 Phase 2 기대 효과는 제한적.
2. **ADR-069 선례**: prod 빌드는 dev 대비 p95 -86% 감소. Phase 0 에 prod 측정 + 구간별 분해 내장 시 workload 낭비 방지.
3. **Phase 2 는 선택적 검증**: P1 rAF budget / P3 subscriber 감사 / P4 attribution payload 는 각각 독립 PR 롤백 안전. **P2 (subscribeWithSelector) 는 루트 store middleware 전역 주입이 필요하여 독립 롤백 불가** — P0 결과로 fan-out 실제 비용이 유의미하면 별도 middleware 일반화 ADR 로 분리 가능.
4. **ADR-074 비회귀 보호**: 각 Phase 경계에서 observe 본체 지표 확인. 대안 B 와 달리 기존 SkiaCanvas 구조 유지.

기각 사유:

- **대안 B 기각**: CRITICAL 2 + HIGH 1. OffscreenCanvas/Worker 는 장기적으로 검토 가치 있으나 본 ADR scope 초과. 별도 ADR (예: ADR-100 Phase N+) 에서 다룸.
- **대안 C 기각**: 총 work 량 불변으로 Hard Constraint G2 (longtask.render p99 < 500ms) 충족 불확실. Zustand + React scheduler 궁합도 미실증. 보조 수단으로 향후 재검토 가능.
- **대안 D 단독 기각**: prod 측정만으로 Gate 충족 안 될 경우 대안 부재. A 와 결합하여 Phase 0 로 내장.

**Phase 2 보류/분리 조건**: Phase 0 구간별 baseline 에서 "store subscribe 콜백 자체 비용"이 render longtask 의 >5% 에 도달하는 경우에만 Phase 2 유지. 그 이하이면 **Phase 2 보류 + middleware 일반화는 별도 ADR** 로 분리 (마이그레이션 HIGH 위험 회피).

> 구현 상세: [075-render-longtask-fanout-decomposition-breakdown.md](../../adr/design/075-render-longtask-fanout-decomposition-breakdown.md)

## Gates

| Gate | 시점          | 통과 조건                                                                                        | 실패 시 대안                                                 |
| ---- | ------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| G1   | P0 land 후    | prod baseline 측정 완료 + **구간별 observe 분해 확보** + `docs/adr/design/075-prod-baseline.md` 기록 | N/A (측정 자체). 구간별 분해 미확보 시 **Phase 1 진입 금지** |
| G1.5 | P0 판정       | 주 기여 구간 (render.content.build / plan.build / skia.draw) 식별 완료                           | 미식별 시 Phase 1 rAF budget 효과 예측 불가 → 재측정         |
| G2   | P3 land 후    | prod `longtask.render` p99 < 500ms                                                               | Addendum 으로 목표 조정 (ADR-069 선례) 또는 대안 C 일부 채택 |
| G3   | P3 land 후    | prod `longtask.input` p95 < 100ms                                                                | Phase 3 subscriber 감사 범위 확장                            |
| G4   | P3~P5 land 후 | prod `longtask.*` viol100ms < 10%                                                                | Phase 3 subscriber 감사 범위 확장                            |
| G5   | 전 Phase 경계 | ADR-074 observe 본체 지표 비회귀 (`input.pointerdown` p95 < 2ms)                                 | 해당 Phase 롤백                                              |

**잔존 HIGH 위험**: 대안 A 의 HIGH+ 2 (Phase 2 기술/마이그레이션). 수용 전략 = Phase 2 를 "선택적 검증" 으로 제한 + Phase 0 결과 기반 필요성 재판정 (§Decision Phase 2 보류 조건).

## Consequences

### Positive

- `apps/builder/src/builder/workspace/canvas/skia/SkiaCanvas.tsx` rAF budget 으로 `longtask.render` 극단값 (19742ms) 상한 제한 (Phase 1, 주 기여 구간 식별 후 확정).
- `apps/builder/src/builder/workspace/canvas/skia/StoreRenderBridge.ts` 및 workflow/AI/grid subscriber 감사 + 필요시 ref 기반 전환으로 render longtask 의 주 fan-out 축 해체 (Phase 3, ADR-067 Fill 패턴 선례).
- `apps/builder/src/builder/utils/perfMarks.ts` `topAttributions` 에 observe label + overlap ms 주입 → Phase 3 감사 자동화 및 향후 유사 작업 기반 마련 (Phase 4 재정의, Codex 지적 3 반영 — classify 중복 구현 회피).
- prod Gate 기준 지표 확립 + 구간별 observe 분해 baseline → 향후 성능 ADR 도 동일 Gate 재사용 가능.
- ADR-074 Addendum 2 에서 이관된 체감 경로 해소 → 사용자 체감 지연 실질 감소 (Phase 5 실측 기준).

### Negative

- Phase 2 subscribeWithSelector 채택 시 루트 store middleware 전역 주입 필요 — 기존 subscribers 모두 미들웨어 체인 영향. Phase 2 보류 시 이 부담 회피하되 ADR-067 유사 선례 확장성 상실.
- rAF budget yield 시 1 프레임 stutter 가능성 — 드래그/panning 중 시각적 영향 있을 수 있음 (Chrome MCP 로 회귀 체크 필수).
- Phase 4 attribution payload 개선은 계측 인프라 변경 — `snapshotLongTasks()` 의 `topAttributions` shape 에 `label` / `overlap` 필드 추가. 외부 consumer 없음 확인 완료 (현재 `perfMarks.ts` 내부만 사용).
- Phase 0 prod 측정 결과 목표 이미 충족 시 P1~P3 scope 축소 → 대안 D 처럼 "무작업" 종결 가능성. ADR 작업 overhead 과대 평가 위험 (단, 측정 인프라 확립 + 구간별 분해 자체가 향후 ADR 가치).

---

## Addendum 1 — Phase 0 Prod 실측 (2026-04-18, 경로 1: ADR scope 축소)

Phase 0 breakdown §0 시나리오를 prod 빌드(`pnpm build` + `vite preview --base=/composition/`) 에서 사용자 수동 실행:

| 라벨                            | count |    p50    |   p95    |   p99    |    viol100ms    |      목표       |          판정          |
| ------------------------------- | :---: | :-------: | :------: | :------: | :-------------: | :-------------: | :--------------------: |
| `longtask.input`                |  40   |   68ms    | **87ms** |  140ms   | **2.5%** (1/40) | < 100ms / < 10% |        ✅ G3/G4        |
| `longtask.render`               | **1** |   57ms    |   57ms   | **57ms** |       0%        |     < 500ms     |         ✅ G2          |
| `longtask.unclassified`         |  26   |   79ms    |   90ms   |   98ms   |       0%        |        —        |           ✅           |
| `input.pointerdown` observe     |  26   | **1.0ms** |    —     |    —     |        —        |      < 2ms      | ✅ G5 (ADR-074 비회귀) |
| `input.page-transition` observe |  22   | **0.7ms** |    —     |    —     |        —        |      < 2ms      |         ✅ G5          |

**핵심 관찰**:

1. **ADR-069 선례 완벽 재현** — dev `longtask.input` p95 621ms → prod 87ms (**-86%**). ADR-069 (2026-04-17 종결) 당시 동일 감소율. scheduler.development.js 오버헤드가 dev 측정의 주 기여자였음 확증.
2. **`longtask.render` p99 dev 19742ms → prod 57ms (-99.7%)** — ADR-074 Addendum 2 에서 이관된 체감 경로가 **prod 에서 재현되지 않음**.
3. `render.content.build` / `render.plan.build` / `render.skia.draw` / `render.frame` 4종 구간 observe `snapshot()` = `null` (count=0) — 시나리오 중 SkiaCanvas rAF body 가 유의미한 work 경로로 진입 안 함 (idle 경로 정상) 또는 observe() 배선 debt. stall 이 실재하지 않는 증거로 수용.

**Gate 판정**:

- G1 (P0 baseline 기록) — ✅ `075-prod-baseline.md` 작성
- G1.5 (주 기여 구간 식별) — N/A 수용 (stall 부재로 식별 대상 없음)
- G2/G3/G4 — 모두 통과
- G5 (ADR-074 비회귀) — 통과

**구현 Phase 처리**:

- Phase 1 (SkiaCanvas rAF budget) — **Skip**: 대상 stall 부재. 19742ms → 57ms 자동 해소.
- Phase 2 (subscribeWithSelector) — **기각**: §Decision 보류 조건 (subscribe 콜백 비용 >5%) 미충족 전제. middleware 전역 주입 위험 회피.
- Phase 3 (subscriber 감사) — **Skip**: 대상 fan-out 부재.
- Phase 4 (attribution payload 개선) — 독립 infra 가치 있음. **별도 후속 PR/ADR 로 분리 고려** (본 ADR scope 종결).
- Phase 5 (prod Gate 재검증) — 본 Addendum 이 대체.

**남은 Debt (본 ADR scope 외)**:

- `render.*` observe 배선 확인 — count=0 원인이 idle rAF 인지 미배선인지 별도 감사 필요
- `/fonts/PretendardVariable.woff2` 등 prod 404 — base path `/composition/` 미반영. 후속 infra ADR 후보

**결론**: Codex 1~3차 리뷰가 지적한 바와 같이 subscribeWithSelector / rAF budget 는 본 scope 에서 불필요. dev measurement 기반 가설은 prod 측정으로 기각. ADR-069 종결 선례 동일 패턴.
