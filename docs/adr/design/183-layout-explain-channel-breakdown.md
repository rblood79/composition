# ADR-183 Design Breakdown: 레이아웃 explain 디버그 채널 (엔진 판정 트레이스)

> 본문: [183-layout-explain-channel.md](../183-layout-explain-channel.md)
> 상태: Proposed — Phase 계획 초안 (리뷰 전)

## 1. 목표 형태

디버그 게이트가 켜진 상태에서, 노드 하나에 대해 엔진이 내린 판정 시퀀스를 판독 가능한 형태로 얻는다:

```
window.__layoutExplain("component-listbox")
→ [node component-listbox] solve_flex(avail_w=350, avail_h=-1)
  ├ §4.5 auto-min floor: content_min_main=162 적용 (off 19 공급)
  ├ used-size clamp: maxHeight 300 바인딩 → 재분배 3.6 진입
  ├ incremental skip: MISS (subtree dirty)
  └ 반환 (350, 300) → last_solved 기록 (gen=412)
```

트레이스는 **엔진의 자기 보고**다 — 정합 oracle 은 여전히 Chrome parity fixture (판독 헬퍼 출력 첫 줄에 명시).

## 2. Phase 분할

### Phase 0 — 트레이스 이벤트 인벤토리 + off-cost baseline (freeze)

- `layout-engine.md` 의 "진단 금지" / 금지 패턴 항목에서 **역산**: 각 오진을 1줄로 배제하려면 어떤 판정이 기록돼야 하는가 → 이벤트 목록 freeze. 초기 후보 (오진 이력 빈도순):
  1. 증분 skip 판정 (HIT/MISS + 사유: dirty / `last_avail` 불일치) — tree.rs:968
  2. used-size clamp 발화 (min/max 어느 쪽이 바인딩했나 + 재분배 재진입 여부)
  3. §4.5 automatic minimum floor (스칼라 공급 vs absent fallback — `flex.rs::parse_item`)
  4. stretch ↔ shrink-to-fit 갈래 (`inline_intrinsic` 판정 + 재진입)
  5. intrinsic 측정 캐시 (HIT/MISS + `mutation_gen`)
  6. flex item 재-solve 발화 (3.5 — used ≠ solved_avail)
  7. grid 트랙 해소 결과 (§12.5 기여 / §12.7.1 freeze-restart / §12.8 stretch)
- off-cost baseline: `benches/flex_shrink.rs` (grow_nowrap 등 3종) + `benches/tree_solve.rs` 현행 수치 채록 (동일 머신 — G1 의 A/B 기준값)
- 산출물: 이벤트 enum 초안 + baseline 표 (본 문서 §4 에 기록)

### Phase 1 — 엔진 trace 코어

- `packages/composition-engine/src/trace.rs` 신설: `TraceEvent` enum + `TraceSink` (노드 handle → `Vec<TraceEvent>`, 노드당 상한 N — R3)
- 게이트: `LayoutTree` 에 `trace: Option<TraceSink>` — **off 시 비용 = `Option` 분기 1회/판정 지점**. 기록 매크로/헬퍼는 `if let Some(sink)` 로만 진입
- 계측 지점 (Phase 0 freeze 목록의 거처):
  - `tree.rs::solve_node` — 증분 skip 판정 (968 게이트), used-size clamp, 키워드 폭 해소
  - `flex.rs` — `parse_item` §4.5 floor, `solve_flex` 3.5 재-solve / 3.6·3.7 clamp 재분배, 라인 cross 대입
  - `tree.rs::solve_grid` — `inline_intrinsic` 판정, 트랙 해소 (§12.5/§12.7.1/§12.8)
  - `tree.rs::measure_intrinsic_width` — 캐시 HIT/MISS (`mutation_gen`)
- **측정 패스 오염 금지**: `snapshot_subtree`/`restore_subtree` 구간(센티넬 available)의 이벤트는 `measure_pass: true` 태그 또는 별도 버킷 — 본 solve 판정과 섞이면 판독이 오도된다
- 단위 테스트: 대표 판정 3종 (skip HIT / clamp 바인딩 / §4.5 floor) 이 기대 이벤트를 남기는지 + off 시 이벤트 0건
- **G1 측정**: off 상태 A/B 벤치 — 회귀 ≤ 2% 확인 후 다음 phase

### Phase 2 — WASM 경계

- `lib.rs` (wasm-bindgen surface): `enable_layout_trace(enabled: bool)` / `get_layout_trace(node_id) -> JsValue(JSON)`
- **binary_protocol / `build_tree_batch` 계약 무변경** (HC3) — 트레이스는 별도 조회 API, 배치 payload 에 싣지 않는다
- enable 시에만 sink 할당 (R3 — off 시 메모리 0)
- `compositionEngineWasm.ts` 바인딩 + `idMapper.ts` 경유 element id ↔ node handle 변환

### Phase 3 — TS 판독 채널

- `fullTreeLayout.ts` 인접에 디버그 헬퍼: element id → handle 매핑 → 트레이스 조회 → 사람이 읽는 시퀀스 포맷 (§1 형태)
- `window.__layoutExplain(elementId)` — **dev 전용** (`import.meta.env.DEV` 게이트, 게이트 상수는 boolean 상수가 아니므로 featureFlags registry 계약과 무충돌)
- TS 층 자체 판정 (Step 4.5 재측정 트리거, 스칼라 공급 여부) 은 **엔진 트레이스에 없다** — 헬퍼가 `enrichWithIntrinsicSize` 공급값 (`contentMinWidth`/`contentMaxWidth`) 을 별도 줄로 병기 (경계 표기: `[TS]` prefix)
- **G2**: live builder 에서 실노드 1개 explain 실측 (완료 기준 live behavior 게이트)
- **G3**: 오진 대표 3건 (새로고침-정상 캐시 / 형제 성장 / flexSweep green 오독 아님 — 미결정 main) 이 트레이스 출력으로 판별됨을 시나리오로 확인

### Phase 4 — (비스코프) 패널 UI 승격

사용자용 "왜 이 크기인가" 패널은 **본 ADR 범위 밖** — 내부 채널 운용 경험 후 별도 ADR 로 판단. 여기서 미리 설계하지 않는다.

## 3. 파일 변경 요약 (추정 — Phase 0 에서 실측 보정)

| 파일                                                                               | 변경                                           |
| ---------------------------------------------------------------------------------- | ---------------------------------------------- |
| `packages/composition-engine/src/trace.rs`                                         | 신설 — TraceEvent/TraceSink                    |
| `packages/composition-engine/src/tree.rs`                                          | 계측 지점 삽입 (solve_node/solve_grid/measure) |
| `packages/composition-engine/src/flex.rs`                                          | 계측 지점 삽입 (§4.5/3.5/3.6/라인 cross)       |
| `packages/composition-engine/src/lib.rs`                                           | WASM API 2종                                   |
| `apps/builder/src/builder/workspace/canvas/wasm-bindings/compositionEngineWasm.ts` | 바인딩                                         |
| `apps/builder/src/builder/workspace/canvas/layout/engines/` (디버그 헬퍼 신설)     | 판독 포맷 + window 노출                        |

## 4. Phase 0 산출물 기록란

- [ ] 이벤트 enum freeze 목록:
- [ ] off-cost baseline (grow_nowrap / shrink 2종 / tree_solve):
