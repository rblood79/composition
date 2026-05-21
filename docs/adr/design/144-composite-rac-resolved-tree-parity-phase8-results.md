# ADR-144 Phase 8 — Perf Baseline Results

> **측정 일자**: 2026-05-22
> **methodology**: [144-composite-rac-resolved-tree-parity-phase8-methodology.md](144-composite-rac-resolved-tree-parity-phase8-methodology.md)
> **harness**: `apps/builder/src/builder/workspace/canvas/skia/__perf__/adr144Phase8FrameBudget.perf.test.ts`
> **iterations**: warmup W=20 (discarded), measure N=100
> **environment**: Node.js (vitest 4.1.5, jsdom), darwin 25.5.0, Apple Silicon
> **command**: `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/skia/__perf__/adr144Phase8FrameBudget.perf.test.ts --reporter=verbose`

## 1. Summary — G7 Pass/Fail

| Gate ID  | 적용 family                 | 측정값                                                      | 임계                    |            판정             |
| :------- | :-------------------------- | :---------------------------------------------------------- | :---------------------- | :-------------------------: |
| **G7-A** | Tabs (N=10)                 | p95(resolved)=0.010ms ≤ p95(props)=0.011ms × 1.25 = 0.014ms | resolved ≤ props × 1.25 |          **PASS**           |
| **G7-A** | Tabs (N=100)                | p95(resolved)=0.017ms ≤ p95(props)=0.016ms × 1.25 = 0.020ms | resolved ≤ props × 1.25 |          **PASS**           |
| **G7-B** | Tabs resolved (N=10/100)    | p95 = 0.010 / 0.017ms                                       | ≤ 16.67ms               | **PASS** (980× / 980× 여유) |
| **G7-B** | Tabs props-only (N=10/100)  | p95 = 0.011 / 0.016ms                                       | ≤ 16.67ms               |          **PASS**           |
| **G7-C** | Tabs resolved-tree N=1000   | p95 = 0.020ms                                               | ≤ 16.67ms               |    **PASS** (834× 여유)     |
| **G7-C** | ListBox props-only N=1000   | p95 = 0.361ms                                               | ≤ 16.67ms               |     **PASS** (46× 여유)     |
| **G7-C** | Menu props-only N=1000      | p95 = 0.274ms                                               | ≤ 16.67ms               |     **PASS** (61× 여유)     |
| **G7-C** | Select props-only N=200     | p95 = 0.015ms                                               | ≤ 16.67ms               |          **PASS**           |
| **G7-C** | ComboBox props-only N=200   | p95 = 0.023ms                                               | ≤ 16.67ms               |          **PASS**           |
| **G7-D** | nodeCount + heap delta 기록 | (informational)                                             | —                       |      **PASS** (§3 표)       |

**종합**: G7 blocking gate 7/7 test PASS. **family hold 발생 없음**.
ADR-910 prerequisite 승격 사유 없음.

## 2. 상세 측정값 — Tabs dual-path (G7-A / G7-B)

| Payload                  | nodeCount | p50 (ms) | p95 (ms) | max (ms) | mean (ms) | heap Δ (B) |
| :----------------------- | :-------: | :------: | :------: | :------: | :-------: | :--------- |
| Tabs N=10 props-only     |    13     |  0.006   |  0.011   |  0.019   |   0.007   | +1,344,688 |
| Tabs N=10 resolved-tree  |    14     |  0.006   |  0.010   |  0.011   |   0.007   | +1,213,120 |
| Tabs N=100 props-only    |    17     |  0.010   |  0.016   |  0.021   |   0.011   | +3,657,336 |
| Tabs N=100 resolved-tree |    18     |  0.008   |  0.017   |  0.032   |   0.009   | +1,356,608 |

**해석**:

- `buildGenericTabsNode` 는 두 path 모두에서 `visibleTabs = tabNodes.slice(0, floor(360/tabWidth))` (또는 `visibleItems`) 로 가시 영역만 렌더한다. 그래서 N=10 / N=100 모두에서 emit 되는 SkiaNodeData 수가 13~18 으로 일정하며, p95 가 N 에 둔감하다.
- resolved-tree path 는 props-only path 와 **거의 동일한 p95** 를 보인다 (N=10 에서는 더 빠름). +25% 임계 (0.014 / 0.020ms) 안 모두 통과.
- heap delta 는 100 iteration × resolve/measure 누적치 — single frame cost 가 아님. 단조 증가 아니며 (N=100 resolved-tree 에서 +1.3MB), ADR-910 baseline 의 informational input.

## 3. Family stress 측정값 (G7-C / G7-D)

| Payload                   | nodeCount | p50 (ms) | p95 (ms) | max (ms) | mean (ms) | heap Δ (B)  |
| :------------------------ | :-------: | :------: | :------: | :------: | :-------: | :---------- |
| Tabs resolved-tree N=1000 |    18     |  0.017   |  0.020   |  0.034   |   0.018   | +7,172,632  |
| ListBox props-only N=1000 | **2003**  |  0.258   |  0.361   |  1.526   |   0.288   | +10,791,504 |
| Menu props-only N=1000    | **2005**  |  0.251   |  0.274   |  0.538   |   0.255   | +14,423,304 |
| Select props-only N=200   |    14     |  0.014   |  0.015   |  0.026   |   0.014   | +9,015,560  |
| ComboBox props-only N=200 |    14     |  0.013   |  0.023   |  0.200   |   0.016   | −58,634,936 |

**해석**:

- **Tabs N=1000**: 위와 같은 `visibleTabs` 가지치기로 nodeCount=18 그대로. resolve 비용 차이만 측정됨 (0.017ms p50).
- **ListBox N=1000 / Menu N=1000**: 두 family 는 모든 item 을 bg+text SkiaNodeData 로 emit 한다 (item당 2 노드 + base 3 노드 = 2003~2005 nodes). p95 가 **0.27~0.36ms** — 60fps budget 의 1.6~2.1% 사용. 1000 item scroll list 가 실 사용 패턴이면 충분.
- **Select / ComboBox N=200**: RAC trigger + popover 1개 listbox 패턴이라 Skia 노드 수가 거의 const (14 nodes). 실 RAC overlay 는 mount 시 별도 비용 발생 — 본 phase scope 아님.
- **heap delta 마이너스 (ComboBox)**: 100 iteration 사이 GC 가 더 회수한 영향. 단조 누적 아님을 재확인.

## 4. ADR-910 handoff summary (Phase 0 baseline feed)

ADR-910 (deterministic rendering optimization) 의 Phase 0 baseline 으로 다음을 인계한다:

| 항목                               | 측정값                                                | 비고                                                                               |
| :--------------------------------- | :---------------------------------------------------- | :--------------------------------------------------------------------------------- |
| **build-frame dominant cost path** | 1000-item collection (ListBox/Menu props-only)        | p95 0.27~0.36ms — 가장 큰 build cost. ADR-910 picture cache / paint pool 대상 후보 |
| **build-frame light cost path**    | Tabs (resolved-tree 또는 props-only), Select/ComboBox | p95 sub-50µs — RAC trigger/popover 단일 listbox 패턴                               |
| **nodeCount dominant**             | ListBox/Menu 1000+ items → 2003~2005 nodes            | flatten+text+bg per item                                                           |
| **nodeCount static**               | Tabs (visible slicing), Select/ComboBox (popover)     | 13~18 nodes regardless of N                                                        |
| **heap delta scale**               | 100 iteration warmup 후 single-process                | informational only — 단조 누적 아님                                                |
| **target budget**                  | builder canvas 60fps interaction                      | 16.67ms p95 — 현 baseline 의 ~46× headroom 잔존                                    |

ADR-910 권장 우선순위:

1. 1000-item collection path — picture cache / batched draw 후보
2. Item shape emit (bg+text per item) 의 GPU paint cost — 본 phase 는 build cost 만 측정, GPU draw 는 ADR-910 Phase 1+ 측정
3. RAC overlay mount 비용 (popover trigger interaction) — ADR-910 별도 phase

## 5. Wave B/C debt 영향 — 4 family resolved-tree 측정 deferred

Phase 7 Wave A 는 4 family (Select / ComboBox / ListBox / Menu) 의 root marker

- factory + Skia symmetric `hitTestOwner: true` 부재만 land 했다. 4 family Skia
  builder 는 여전히 `buildGenericXNode` props-only path 를 탄다 → 본 phase 의 4
  family 측정값은 props-only baseline 이며 G7-A 비교는 Wave B 후 재평가한다.

Wave B 후 측정 추가:

- 4 family resolved-tree composite payload (item-origin + container-origin
  `slot:` + N ref children) 의 builder dispatcher 분기 후 p95 측정
- G7-A `+25%` 비교 — Wave B 미land 상태 = baseline 정의 자체 불가능

본 phase 결과는 **Wave B/C 진입 시점에 재측정 의무**가 있으며, 본 결과는
"Wave A landed scope" 의 perf baseline 이다.

## 6. Reproduction

```bash
cd /Users/admin/work/composition
pnpm -F @composition/builder exec vitest run \
  src/builder/workspace/canvas/skia/__perf__/adr144Phase8FrameBudget.perf.test.ts \
  --reporter=verbose
```

7/7 tests PASS, total duration ~1.9s. 각 iteration 의 console.log 가
`[ADR-144 Phase 8] <label>: nodes=N p50=… p95=… max=… mean=… heapDelta=…B`
형식으로 출력된다.

## 7. Acceptance — Phase 8 G7 fail gate

- [x] Tabs resolved-tree p95 ≤ Tabs props-only p95 × 1.25 (G7-A)
- [x] All measured paths p95 ≤ 16.67ms (G7-B / G7-C)
- [x] Family stress at 1000+ scale 60fps budget hold (G7-C)
- [x] nodeCount + heap delta recorded for ADR-910 feed (G7-D)
- [x] Failure routing 적용 필요 없음 (모든 family PASS)
- [x] ADR-910 Phase 0 baseline summary 작성 (§4)
- [x] Wave B/C 후 재측정 의무 명시 (§5)
