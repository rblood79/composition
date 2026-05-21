# ADR-144 Phase 8 — Perf Methodology Lock-in

> **목적**: G7 (Perf handoff) 을 측정-전용 게이트가 아닌 **blocking fail gate** 로
> 확정하기 위해, Phase 0 baseline 대비 측정 대상 / 측정 도구 / pass-fail 임계 /
> 실패 라우팅을 1-page 로 고정한다. 본 문서는 Phase 8 measurement 실행 전
> contract 이며, 실측 결과는 별도 `*-phase8-results.md` 에 기록한다.

## 1. 측정 대상 매트릭스 — Phase 7 land 와 정합

Phase 7 Wave A 는 4 family (Select / ComboBox / ListBox / Menu) 의 root marker
(`data-canonical-id`) + factory + Skia symmetric `hitTestOwner: true` 부재만
land 했다. **4 family 의 Skia resolved-tree draw path 는 Wave B 미land**.
따라서 Phase 8 에서 `props-only vs resolved-tree` 비교는 **Tabs 만 evaluable**
하며, 4 family 은 props-only baseline + 60fps stress 기록만 가능하다.

| Family   |   Wave A landed   | Wave B landed | Skia resolved-tree path active | G7 evaluable now                                        |
| :------- | :---------------: | :-----------: | :----------------------------: | :------------------------------------------------------ |
| Tabs     | (Phase 2-6 fully) |      yes      |              yes               | **G7-A / G7-B / G7-C / G7-D full evaluation**           |
| Select   | yes (root marker) |      no       |               no               | G7-B / G7-C / G7-D props-only baseline 기록 (G7-A 보류) |
| ComboBox |        yes        |      no       |               no               | 동일                                                    |
| ListBox  |        yes        |      no       |               no               | 동일                                                    |
| Menu     |        yes        |      no       |               no               | 동일                                                    |

> 4 family resolved-tree 의 G7-A `+25%` 비교는 Wave B (4 family Skia builder
> Tabs Phase 4 급 `hitTestOwner: true + ownerPath` 자식 emission) land 후
> evaluable. 본 phase 8 에서는 이를 **debt 로 명시** + family hold 조건은
> 60fps budget (G7-B) 만 적용.

## 2. 측정 harness

- **entry**: `measureGenericResolvedSkiaFrameBudget({ node, theme, layoutById })`
  (`apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts:1041`)
- **metric**:
  - `durationMs` — 단일 frame 의 `buildGenericResolvedSkiaNodeData` 호출 시간
  - `nodeCount` — `SkiaNodeData` 트리의 노드 수
  - `estimatedFps = 1000 / max(durationMs, 0.001)` — 유도값
- **iteration shape**:
  - warmup `W = 20` 회 (JIT / inline cache 워밍, 측정 제외)
  - measure `N = 100` 회
- **aggregate**: `p50` / `p95` / `max` (vitest 안에서 sort 후 index 추출)
- **environment**:
  - `vitest run --pool=forks --no-coverage --reporter=verbose`
  - jsdom 불필요 (DOM 미사용)
  - 동일 process 안에서 두 path 비교 (machine variance 영향 균등화)
- **memory delta**: `process.memoryUsage().heapUsed` warmup 후 / measure 후 차이.
  단조 누적 아님 → informational only.

## 3. Pass / Fail Thresholds (G7 Blocking)

| Gate ID  | 적용 family                                          | 조건                                          | 위반 시                                                                            |
| :------- | :--------------------------------------------------- | :-------------------------------------------- | :--------------------------------------------------------------------------------- |
| **G7-A** | Tabs only (Wave B 미land family 보류)                | `p95(resolved-tree) ≤ p95(props-only) × 1.25` | **Tabs parity adapter-only hold + ADR-910 prerequisite 승격** (breakdown §571-572) |
| **G7-B** | Tabs (resolved-tree); 4 family (props-only baseline) | `p95 ≤ 16.67ms` (60fps budget)                | 해당 family hold + ADR-910 phase 0 feed                                            |
| **G7-C** | family stress matrix                                 | 1000+ scale 에서 `p95 ≤ 16.67ms`              | family hold                                                                        |
| **G7-D** | informational                                        | `nodeCount` + `heapUsed` delta 기록           | (gate 없음, ADR-910 baseline feed 용)                                              |

Stress 규모:

- **Tabs**: 1000 tabs (resolved-tree composite — 1 reusable Tab origin + 1000 ref children + 1000 TabPanel leaf bodies)
- **ListBox**: 1000 ListBoxItem refs (Phase 7 Wave A composite payload 와 동일 패턴 확장)
- **Menu**: 1000 MenuItem refs
- **Select / ComboBox**: stress N=200 (RAC trigger + popover 가 단일 listbox 갖는 패턴 — 1000 까지 확장은 RAC 자체 미지원, ADR-076 ItemsManager 가 200 이내 추천치)

## 4. Failure Routing (절대 정책)

- **G7-A 또는 G7-B Tabs 실패** → Tabs parity 가 adapter-only hold 로 강등.
  새 authoring path (resolved-tree creation factory) 는 enable 금지.
  ADR-910 을 prerequisite 으로 승격하고 본 ADR-144 Status 는 `In Progress` 유지.
- **G7-C family 실패** → 해당 family 만 `hold` (ADR-144 breakdown Phase 7 Wave B
  진입 보류) + ADR-910 Phase 0 baseline feed.
- **G7-D 만 영향** → 통과로 처리. ADR-910 Phase 0 baseline input.
- **모든 경우** — 사용자 surface 후 결정. budget miss 를 무시한 새 authoring
  path enable 절대 금지 (Hard Constraint 6: "wrong tree 를 빠르게 그리는 것으로
  ADR-144 gate 를 대체하지 않는다").

## 5. Out-of-scope (이번 phase 에서 측정 안 함)

- DOM measurement, Preview iframe layout 비용 (D 대안 기각 사유)
- 실제 GPU draw (CanvasKit `Surface.drawNode`) 시간 — node tree build 단계가
  fail gate 의 dominant cost. GPU draw 시간 측정은 ADR-910 Phase 1+ 에서 다룸.
- WebGL / paint cache / picture cache 최적화 (ADR-910 ownership)
- Wave B nested descendant editability landing 이후의 4 family resolved-tree
  비교 (debt)

## 6. Artifacts (Phase 8 산출물)

- `apps/builder/src/builder/workspace/canvas/skia/__perf__/adr144Phase8FrameBudget.perf.test.ts`
  (신규 perf test, vitest run target)
- `docs/adr/design/144-composite-rac-resolved-tree-parity-phase8-results.md`
  (실측 p50 / p95 / max / nodeCount / heap delta 표 + pass-fail 판정)
- ADR-144 본문 진행 로그 entry + Acceptance Checklist Phase 8 tick
- ADR-910 Phase 0 baseline feed 1-page summary (`results.md` §"ADR-910 handoff")

## 7. Hard Constraints 재인용

- HC2: editable owner 는 canonical/resolved node 만. perf test 가 synthetic id 를
  editable owner 로 만들지 않는다.
- HC6: ADR-910 의 deterministic rendering optimization 은 **본 phase 결과
  통과 이후** 적용. perf miss 시 ADR-910 선행.
- HC7: legacy `render.shapes()` 는 adapter boundary. perf test 가 legacy spec
  consumer 를 재활성화하지 않는다.

## 8. 측정 진행 순서

1. methodology 본문 (본 문서) commit-ready 상태로 land
2. perf test 작성 (`adr144Phase8FrameBudget.perf.test.ts`)
3. `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/skia/__perf__/adr144Phase8FrameBudget.perf.test.ts --reporter=verbose` 실행
4. 결과 → `*-phase8-results.md` 기록 (위 §3 표 + G7-A/B/C/D 판정)
5. ADR-144 본문 진행 로그 entry + Acceptance Checklist tick
6. type-check + commit + push origin main (PR 금지)
