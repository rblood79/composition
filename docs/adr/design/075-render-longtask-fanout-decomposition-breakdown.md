# ADR-075 구현 상세: Render longtask fan-out 해체

> 본 문서는 [ADR-075](../completed/075-render-longtask-fanout-decomposition.md) 의 Phase 구성, 파일 변경 범위, Gate 측정 방법, 롤백 전략을 상세화한다. ADR 본문은 "무엇을/왜" 에 한정하고 "어떻게" 는 이 문서에 둔다.

---

## 0. Baseline 재측정 (Phase 진입 전 필수, prod 기반)

ADR-074 Addendum 2 실측은 **dev 빌드** 기준이며, scheduler.development.js 오버헤드가 대부분을 차지할 가능성이 크다 (ADR-069 종결 세션에서 실증된 패턴). 본 ADR 의 Gate 는 **prod 빌드 기준** 으로 정의된다.

### 측정 환경

- `pnpm build && pnpm preview`
- Chrome 정식 빌드 (stable)
- 5000+ elements 로드된 샘플 프로젝트 (ADR-069/074 동일 프로젝트)
- DevTools Performance panel CPU throttling **off**, Network **off**
- 브라우저 확장 **비활성화**
- 확실한 reload 후 실행

### 측정 시나리오 (필수 확장 — Codex 3차 리뷰 지적 3 반영)

```
# 1) 초기화
window.__composition_PERF__.reset()

# 2) 시나리오 A — 50회 캔버스 요소 클릭 반복
#    → longtask.input + input.pointerdown + render.* 시간 중첩 분류
window.__composition_PERF__.snapshot("input.pointerdown")

# 3) 시나리오 B — 20회 페이지 전환 반복
#    → longtask.input (input.page-transition 중첩) + render.* stall
window.__composition_PERF__.snapshot("input.page-transition")

# 4) longtask 전체 분류 (input / render / unclassified)
JSON.stringify(window.__composition_PERF__.snapshotLongTasks(), null, 2)

# 5) 구간별 observe 분해 (★ 필수 — P1 진입 조건, 단계별 기여도 식별)
["render.frame", "render.content.build", "render.plan.build", "render.skia.draw"]
  .forEach(l => console.log(l, window.__composition_PERF__.snapshot(l)))
```

### 기록 위치

`docs/adr/design/075-prod-baseline.md` (신설 완료). prod 수치 + **구간별 observe 분해** 확보 후 Gate 목표 수치 확정 (dev 수치는 참고용).

### 판정 조건 (Codex 지적 3 반영, 3-Way 분기)

1. **prod longtask.render p99 < 500ms** → 본 ADR scope 축소 (dev overhead 가 전부였음, ADR-069 종결 패턴 재현, P1/P3 보류 가능)
2. **prod p99 여전히 높고 구간별 분해에서 단일 구간 (예: `render.skia.draw`) 이 주 기여** → 해당 구간 타깃 Phase 1 rAF budget 진입, Gate 예측 가능
3. **prod p99 여전히 높고 여러 구간 분산** → Phase 1 rAF budget 효과 제한적 → Phase 3 subscriber 감사 우선 + Phase 1 차순위

**주의**: 구간별 분해 미확보 시 **Phase 1 진입 자체 금지**. 이유 = Phase 1 실패 시 예측 실패 원인 분리 불가 (함수 본체 / rAF budget 효과 / subscriber fan-out 중 어느 것이 원인인지 판정 불가).

---

## 1. Phase 구성

각 Phase 는 **독립 PR** 로 land. Phase 경계에서 type-check + Chrome MCP 회귀 + `snapshotLongTasks()` diff 확인.

### Phase 1 — SkiaCanvas rAF loop budget 도입

**진입 조건 (Phase 0 Gate G1 + G1.5 충족 필수, Codex 3차 리뷰 지적 3 반영)**:

- Phase 0 에서 `render.content.build` / `render.plan.build` / `render.skia.draw` / `render.frame` 각 구간의 p50/p95/p99 확보
- 주 기여 구간 (>50% 비중) 식별 완료 — 구간별 baseline 없이 P1 진입 시 rAF budget 효과 예측 불가 (함수 본체 vs budget 효과 분리 불가)
- Phase 0 3-Way 분기에서 경로 2 (단일 구간 주 기여) 또는 경로 3 (여러 구간 분산 + Phase 3 보조) 로 판정된 경우

**목적**: 1 프레임당 주 기여 구간 (Phase 0 에서 식별) 포함 `render.content.build` / `render.plan.build` / `render.skia.draw` 합산 work 가 8ms (60fps budget) 넘으면 다음 프레임으로 yield. `longtask.render` p99 의 극단값 (현재 dev 19742ms, prod 미측정) 을 상한으로 자른다.

**파일 변경**:

- `apps/builder/src/builder/workspace/canvas/skia/SkiaCanvas.tsx` RAF loop 구간 (line 390~700 근방)
  - 프레임 시작 시 `budgetStart = performance.now()` 기록
  - `buildFrameContent` 후 `budgetUsed > 8ms` 이면 `paintPlan`/`draw` 다음 프레임으로 deferral
  - deferral 큐: `nextFrameWorkRef: { content?, plan?, draw? }` ref 로 보류
- 계측: `render.frame.deferred` 라벨 신설 (몇 프레임이 yield 발생했는지 count)

**Gate**:

- Phase 1 land 후 `longtask.render` max < 500ms (극단값 제거)
- **주 기여 구간 p99 단독 측정값 감소** — Phase 0 에서 식별된 구간이 Phase 1 효과의 타깃. 미감소 시 rAF budget 의 인과관계 예측 실패 → Phase 3 우선 재고
- ADR-074 observe 본체 지표 비회귀 (`input.pointerdown` p95 < 2ms)

**Rollback**: budget 조건을 `Infinity` 로 설정 (즉시 무효화 가능). deferral 큐 로직은 dead code 로 남기고 budget 만 off.

---

### Phase 2 — StoreRenderBridge subscribe 세분화 [선택적 검증 단계]

> **분류 강등 (Codex 1~2차 리뷰 반영)**: 기존 서술은 P2 를 "핵심 fan-out 해체"로 간주했으나, 실제 `SkiaCanvas.tsx:277-287` 의 subscribe 콜백은 이미 `elementsMap`/`childrenMap`/`themeVersion` 참조 가드로 `cb()` 호출을 제한한다. `StoreRenderBridge.ts:159-189` `sync()` 역시 changedIds 증분이므로 **subscribeWithSelector 전환이 줄이는 것은 "모든 action 에서 돌던 얕은 비교 콜백 (μs 수준)" 뿐**. 주 fan-out 은 Phase 3 대상.

**목적**: subscribe 콜백 자체의 얕은 비교 비용이 render longtask 의 유의미한 % (>5%) 를 차지하는지 **검증**. 기대치는 낮음. 주 비용은 이미 가드로 차단되어 있음.

**진입 조건 (Phase 0 기반 Gate)**:

- Phase 0 에서 subscribe 콜백 자체 비용 (overhead outside of `fullRebuild`/`incrementalSync`) 이 render longtask 의 >5% 로 측정되는 경우에만 진행
- 5% 이하이면 **Phase 2 보류** + middleware 일반화는 별도 ADR 로 분리 (마이그레이션 HIGH 위험 회피, ADR 본문 Decision §Phase 2 보류 조건)

**파일 변경** (Phase 2 채택 시):

- `apps/builder/src/builder/stores/index.ts` — **루트 store middleware 전역 주입** (plain `create()` → `create()(subscribeWithSelector(…))`). 모든 기존 subscribers 영향.
- `apps/builder/src/builder/workspace/canvas/skia/StoreRenderBridge.ts` — `subscribe` 구현을 `useStore.subscribe(selector, cb, { equalityFn })` 로 전환
  - selector: `(s) => [s.elementsMap, s.childrenMap, themeVersion]`
  - equalityFn: shallow tuple 비교
- `apps/builder/src/builder/workspace/canvas/skia/SkiaCanvas.tsx:274-300` — subscribe 가드 블록 제거 (selector 가 동일 기능 수행)

**Gate**:

- (a) subscribe 콜백 호출 횟수 감소 — React DevTools Profiler 또는 console 계측으로 확인
- (b) `longtask.render` p99 에 유의미한 변화 없음 (Phase 2 자체 효과는 μs 수준이라 longtask 감소 기대 안 함)
- (c) 모든 기존 subscribers (workflow/AI/grid 등) 의 reactivity 비회귀 — Chrome MCP 회귀 필수

**Rollback**: **독립 롤백 불가**. middleware 를 원복하면 다른 subscribers 에서 selector overload 를 이미 쓰는 경우 연쇄 영향. 롤백 시 `stores/index.ts` middleware 원복 + `StoreRenderBridge.ts` subscribe 재작성 + SkiaCanvas.tsx 가드 복원 3단계 동시 수행 필요.

---

### Phase 3 — Workflow / Grid / AI subscriber 감사 + 정리

**목적**: `longtask.render` 에 기여하는 잔존 subscriber 를 감사. Workflow overlay / AI flash / grid 관련 useStore 구독이 render 경로에 fan-out 되는지 확인 후 필요시 세분화 또는 ref 기반 전환.

**파일 변경**:

- `apps/builder/src/builder/workspace/canvas/skia/SkiaCanvas.tsx` (ADR-074 Phase 4 에서 추가된 selection/ai 구독 7개)
- `apps/builder/src/builder/workspace/canvas/skia/workflowRenderer.ts`, `workflowMinimap.ts` 등 workflow 관련 store 접근
- Grid 관련 `showGrid`/`gridSize` 구독

**구체 작업**:

1. ADR-074 Phase 0 기법 재사용: observe → longtask 시간 중첩 수동 추적 (`performance.getEntriesByType("longtask")` + observe trace)
2. subscriber 중 render longtask 와 중첩되는 것 식별
3. 세분화 가능한 것은 subscribeWithSelector, 그렇지 않은 것은 ref + event 기반 전환 (ADR-067 Phase 5 Fill 패턴)

**Gate**: Phase 3 land 후 `longtask.render` p99 < 500ms, viol100 < 10%.

**Rollback**: subscriber 변경 개별 롤백 (각 subscriber 마다 독립 PR).

---

### Phase 4 — longtask attribution payload 개선

> **범위 재정의 (Codex 3차 리뷰 지적 3 반영)**: 이전 서술은 "`classifyLongTask` 에 observe trace best-match 추가"로 적혀 있었으나 `perfMarks.ts:298-315` 의 `classifyLongTask()` 는 **이미 observe trace overlap 기반 best-match 로 버킷 분류를 수행**한다 (`for (const trace of measurementTraces) { ... bestOverlap }`). 따라서 중복 구현을 유도하지 않도록 작업 범위를 **attribution payload 개선** 으로 재정의.

**목적**: `recordLongTask()` (`perfMarks.ts:317-334`) 가 `attrKey` 로 브라우저 PerformanceObserver 의 `entry.attribution[0]` (containerSrc/containerName 등) 만 사용하고 있어 SPA 환경에서는 대부분 `"self"` / `"window"` 로만 기록됨. 실제로 어떤 observe label 이 해당 longtask 와 시간 중첩되었는지 **`topAttributions` payload 에 실어주어야** Phase 3 감사 자동화 가능.

**파일 변경**:

- `apps/builder/src/builder/utils/perfMarks.ts`
  - `classifyLongTask()` 에서 `bestLabel` 을 반환하도록 return shape 확장 (현재는 bucket 만 반환) — 기존 classify 로직 재사용
  - `recordLongTask()` 에서 `bestLabel` + `bestOverlap` (ms) 을 `attrKey` 후보에 포함. 예: `"render.skia.draw/12ms"` 형태
  - `LabelBuffer.attributions` (Map<string, number>) 유지하되 key 를 enriched 문자열로 전환
  - `topAttributions` 반환 shape 에 `overlapMs` 필드 선택적 추가 (consumer 가 UI 없이 JSON 로그로만 소비 중 — breaking change 없음)

**Gate**: 측정 인프라 개선 — `snapshotLongTasks()[*].topAttributions` 가 실제 observe label (`render.content.build` / `input.pointerdown` 등) 을 포함하여 Phase 3 감사 수동 추적 대신 자동 상위 5개 attribution 추출 가능.

**Rollback**: attribution enrichment 제거 (기본 `entry.attribution[0]` 사용) — classify 로직은 건드리지 않으므로 단순 롤백.

---

### Phase 5 — Prod Gate 재검증

**목적**: Phase 1~4 land 후 prod 빌드에서 최종 측정. ADR-069 종결 패턴 동일.

**측정 방법**: Phase 0 과 동일 시나리오, `pnpm build && pnpm preview` 환경.

**Gate**:

- `longtask.render` p99 < 500ms (현재 dev 19742ms, prod 수치 미측정)
- `longtask.input` p95 < 100ms (현재 dev 621ms)
- viol100ms < 10% (input/render 각각)
- ADR-074 observe 본체 지표 퇴행 없음 (`input.pointerdown` p95 < 2ms, `input.page-transition` p95 < 2ms)

**결과 기록**: `docs/adr/design/075-prod-gate.md` 신설. ADR Status → Implemented + Addendum 추가.

---

## 2. 측정 인프라 요약

| Gate | 라벨/도구                                                                                                                       | 관찰 방법                   | 목표 (prod)  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------ |
| G1   | P0 baseline 측정 + `longtask.*` 3종 + **`render.content.build`/`render.plan.build`/`render.skia.draw`/`render.frame` 4종 구간** | prod 실측 + 문서 기록       | 완료         |
| G1.5 | 주 기여 구간 식별 (구간별 p99 비중 >50% 또는 여러 구간 분산 판정)                                                               | Phase 0 구간별 observe 분해 | 식별 완료    |
| G2   | `snapshotLongTasks()[longtask.render]`                                                                                          | 요소 클릭 50회 후 p99       | < 500ms      |
| G3   | `snapshotLongTasks()[longtask.input]`                                                                                           | 요소 클릭 50회 후 p95       | < 100ms      |
| G4   | `snapshotLongTasks()[longtask.*]` viol100ms                                                                                     | count / totalCount 비율     | < 10%        |
| G5   | ADR-074 observe (`input.pointerdown` 등) p95                                                                                    | 퇴행 감지용                 | 유지 (< 2ms) |

---

## 3. 체크리스트 (Phase land 시)

각 Phase PR 머지 전:

- [ ] `pnpm type-check` 3 tasks PASS
- [ ] Chrome MCP 회귀: 렌더링 정합성 불변 (빈 영역 클릭 / 요소 선택 / 페이지 전환 / drag / workflow overlay)
- [ ] `snapshotLongTasks()` diff 기록 (`docs/adr/design/075-prod-baseline.md` 업데이트)
- [ ] ADR-074 observe 본체 지표 비회귀 확인 (각 Phase 경계)
- [ ] `parallel-verify` skill 로 렌더링 관련 컴포넌트 패밀리 회귀 (Phase 3 이후)

---

## 4. 의존성 / 선후 관계 (Codex 리뷰 반영 재구성)

```
P0 ──→ P4 ──→ P1 ─┬─→ P3 ──→ P5
(baseline   (attr   │
 필수 +    payload  │
 구간별)  Phase3     └──[선택]──→ P2 (독립 롤백 불가, 보류 가능)
           자동화)
```

- **P0 prod baseline + 구간별 분해 확보 필수** — Gate G1+G1.5 모두 충족 전에는 P1 진입 금지 (Codex 지적 3)
- **P4 는 P1/P3 전 선행 권장** — attribution payload 가 Phase 3 감사 자동화 전제. P4 없이 수동 추적 가능하나 biased.
- **P2 는 선택적 검증 단계** — P0 결과에서 subscribe 콜백 비용 >5% 시에만 진입. 그 이하이면 middleware 일반화는 별도 ADR
- **P1 / P3 주 처방**: P0 3-Way 분기 판정에 따라 우선순위 결정 (경로 2 → P1 우선, 경로 3 → P3 우선)
- **P5 는 최종 Gate** — P1/P3/P4 (+ 조건부 P2) main 머지 후 prod 재측정

---

## 5. 리스크 완화 노트

### R1. P1 rAF budget yield 시 1 프레임 stutter

- 완화: yield 발생 시 다음 프레임에서 deferred work 우선 처리. 시각적 stutter 최소화 위해 visible page 우선.
- 검증: Chrome MCP 로 드래그 중 budget yield 발생 시에도 시각 정합성 유지.

### R2. P2 subscribeWithSelector 전환 시 reactivity 누락 + middleware 전역 영향

- 완화:
  - selector 가 커버하지 못한 field 변화 시 render 갱신 안 됨. shallow tuple 로 elementsMap/childrenMap/themeVersion 3개 커버하되, 새 필드 추가 시 selector 업데이트 강제 (codegen 또는 주석).
  - **middleware 전역 주입으로 기존 모든 subscribers 가 영향받음** (Codex 2차 리뷰) — plain subscribe 사용자는 API 호환되나 TypeScript overload 선택이 달라질 수 있음. 전면 감사 필요.
- 검증:
  - 다양한 store action (add/update/remove/theme change) 후 시각 갱신 확인
  - 기존 subscribers 전체 type-check + Chrome MCP 회귀 — 특히 history/undo/redo 등 고빈도 경로
- 상시 피해 금지: P0 결과에서 subscribe 콜백 비용 >5% 미만이면 P2 보류 (§Decision 조건)

### R3. P3 workflow/AI subscriber 감사 실수로 reactivity 제거

- 완화: Phase 3 는 감사 + 세분화만 수행, 완전 제거는 금지. 각 subscriber 수정은 개별 PR.
- Fallback: 영향받은 기능 (workflow overlay / AI flash / grid) 각 회귀 체크리스트 수행.

### R4. P5 prod 측정 시 dev overhead 없이도 목표 미달

- 완화: prod Gate 목표를 실측 후 조정. 현실적 목표가 p99 < 800ms 수준이라도 dev 19742ms 대비 큰 개선.
- Fallback: ADR-075 Addendum 으로 "prod 측정 기반 목표 재정의" (ADR-069 종결 선례 동일).

---

## 6. 종결 기준 (ADR-075 Implemented 전환)

- G1~G5 모두 PASS (또는 Addendum 으로 현실적 목표로 재정의)
- P1~P5 전부 main 머지 + Chrome MCP 회귀 PASS
- `docs/adr/design/075-prod-gate.md` 에 before/after 수치 기록
- `docs/adr/README.md` 에서 Proposed → Implemented 상태 전이 + 완료 ADR 섹션 이동
