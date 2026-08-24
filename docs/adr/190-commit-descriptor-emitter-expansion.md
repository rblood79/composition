# ADR-190: commit descriptor emitter 확장 — generic style/layout/structure mutation 의 sparse commit lane 진입

## Status

Accepted — 2026-08-24 (리뷰 round 1 승인 — 이슈 3건 전건 fixed, pending 0)

## Context

ADR-189 는 canonical commit 의 whole-tree 재기록을 dirty-root 서브트리 splice +
sparse damage playback 으로 대체했고 Implemented (2026-08-24) 로 종결됐다. 그러나
이 lane 의 진입점은 presentation session 의 typed 터미널 descriptor 뿐이다 —
유일 생산자는 `SkiaCanvas.tsx:449` (`onCommitted → queueCommitPatch`,
`StoreRenderBridge.ts:1041`) 이고, canonical commit 라우터
(`editorPresentationCommitAdapter.ts` § `editorPresentationCanonicalRuntimeOptions`)
는 `fills.replace` 전량과 `style.patch` 협소 allowlist 만 받는다. canonical store
를 직접 mutate 하는 generic 경로 (`updateElementProps`, `addComplexElement`,
`removeElement`, undo/redo, AI tool) 는 descriptor 를 내지 않아 **fallback 이
아니라 patch queue 진입 자체가 없다** (2026-08-24 probe 실측: `queueCount=0`).

before/after 재실측 (2026-08-24, `adr189-commit-baseline.mjs` N=5,000, 5회 p95):
generic style commit 은 ADR-189 이전 75.1ms → 이후 **73.1ms 로 변화 없음** (full
DFS visits 5,056 유지, long task 10). 같은 lane 의 `fills.replace` 는 damage
duration p50/p95 0.4/0.5ms (신규 Button fixture, commit 당 sparse command 11)
이고, 258-node fixture 에서는 sparse command 119 vs full stream 1,533 이다. 이 격차의
해소가 본 ADR 의 목적이며, ADR-189 Phase 4 잔존 범위 ("해당 emitter 를 추가하는
경우 새 descriptor 별 dirty-root, Preview/Skia parity, N-tier 120Hz gate 를 다시
통과해야 한다") 가 예고한 후속이다.

**SSOT domain**: D1/D2/D3 어느 SSOT 도 변경하지 않는다 — D3 시각 domain 의
Builder(Skia) consumer 내부 렌더 파이프라인 성능 메커니즘이다. catalog/spec
비관여, Spec/Generator 확장 아님 (Generator emit 지원 질문 해당 없음).

**Hard Constraints**:

1. N=5,000 한 요소 generic style/layout commit: 현행 `record+stream` p95 73.1ms
   → sparse 진입 시 `render.frame` p95 **< 4ms** (120Hz gate, ADR-189 준용),
   sparse command 수 N 비결합 (50/500/5,000 동일 자릿수).
2. patch 직후 vs full rebuild 의 backing buffer **pixel diff 0** (ADR-189 G5-5
   oracle 준용).
3. fail-closed: descriptor 도출 불가 또는 plan 실패 시 **full rebuild 수렴** —
   stale 화면 0 (ADR-189 HC5). 부분 patch 금지 — commit 전체 원자성 (HC4).
4. canonical 문서 스키마 무변경 — BC 영향 0% 사용자 / 재직렬화 0 파일.
5. 상태 변경 파이프라인 순서 (`Memory → Index → History → DB → Preview`) 보존 —
   emitter 는 관찰자이며 순서에 개입하지 않는다.

**Soft Constraints**:

- ADR-187 commit allowlist 계약, ADR-184 canonical mutation 러너 (신규 경로
  한정), ADR-185 history coverage 계약과의 공존 — 기존 계약 재협상 없이 얹는다.
- `reparent`/`ref`/`slot` 은 소비자 (`commitPatchPlan.ts:120`) 가 fail-closed 로
  설계했으므로 본 ADR 범위에서도 full rebuild 유지.

## Alternatives Considered

### 대안 A: 편집 표면별 presentation session 확장

- 설명: ADR-187 패턴을 연장 — 각 편집 UI (패널 필드, 드래그, 키보드) 를
  presentation session 으로 전환하고 adapter allowlist 를 점진 확대한다.
- 근거: ADR-187/189 에서 검증된 기존 경로. 신규 인프라 없음.
- 위험:
  - 기술: L — 검증된 패턴의 반복.
  - 성능: M — 세션을 만들 수 없는 호출자 (AI tool, undo/redo, store 직접 호출)
    는 영구 미커버 — 73ms 격차가 부분적으로만 닫힌다.
  - 유지보수: H — 표면마다 세션 보일러플레이트 중복, 신규 편집 표면 추가 시
    누락이 **조용한 full rebuild 회귀**로 나타나 감지 불가.
  - 마이그레이션: L — 점진 적용, 롤백 표면 단위.

### 대안 B: canonical store 경계 descriptor emitter (단일 진입점)

- 설명: canonical mutation action (`updateElementProps` 등) 이 자신의 변경을
  descriptor 로 서술해 post-commit revision 과 함께 `queueCommitPatch` 로
  전달한다. 호출자 (패널/AI/undo/키보드) 전부가 자동 커버. presentation session
  발 commit 은 origin 표식으로 스킵 (이중 큐 차단).
- 근거: Figma multiplayer / tldraw 등 typed op 를 UI 표면이 아닌 store/record
  경계에서 발행하는 구조 (구조 참고 — 판정 근거는 로컬 counter·pixel oracle,
  ADR-189 L5 교훈 준용). 소비자 (`createCommitPatchPlan`) 는 style/geometry/
  structure(add/remove/order) 를 이미 지원하므로 생산자만 추가하면 된다.
- 위험:
  - 기술: M — descriptor fidelity (patch 키 오해석 → dirty-root 과소 → stale
    화면). fail-closed 로 상쇄: 최악의 경우 = 현행 full rebuild.
  - 성능: L — emitter 는 O(변경 키 수), plan 실패 시 현행 경로.
  - 유지보수: L — 신규 호출자가 자동 커버, 단일 지점 계약.
  - 마이그레이션: M — presentation lane 과의 이중 큐 dedupe (`pendingCommit`
    단일 슬롯) 및 revision 결합 검증 필요.

### 대안 C: emitter 없는 post-commit tree diff

- 설명: descriptor 없이 revision 간 elementsMap 을 비교해 dirty root 를 도출.
- 근거: 상태 diff 기반 무효화 (React reconciliation 류) 의 일반 패턴.
- 위험:
  - 기술: H — diff 자체가 O(N) 전수 스캔 — 제거하려는 N-결합 비용을 다른 형태로
    재도입. 5,000-node 에서 diff 비용이 splice 이득을 잠식.
  - 성능: H — 매 commit O(N) 고정비.
  - 유지보수: M — mutation 의미 소실 (structure add 인지 style 변경인지 재추론).
  - 마이그레이션: L — 호출자 무변경.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  L   |  M   |    H     |      L       |     1      |
| B    |  M   |  L   |    L     |      M       |     0      |
| C    |  H   |  H   |    M     |      L       |     2      |

루프 판정: 대안 B 가 HIGH 0 — 새 대안 추가 불요.

## Decision

**대안 B: canonical store 경계 descriptor emitter** 를 선택한다.

선택 근거:

1. **fail-closed 이므로 안전 하한이 현행과 동일** — descriptor 화 불가·plan
   실패·이중 큐 의심 시 전부 full rebuild 로 수렴한다 (ADR-189 HC5 계약 재사용).
   최악의 경우가 오늘의 73.1ms 이고, 성공 경로만 이득을 더한다.
2. 소비자 측 (`commitPatchPlan`·subtree splice·sparse damage) 은 ADR-189 로 이미
   구축·검증됨 — 본 ADR 은 생산자 배선만 추가하므로 표면적이 작다.
3. 호출자 자동 커버 — AI tool / undo·redo / 신규 패널이 별도 작업 없이 lane 에
   진입하고, 누락이 회귀로 축적되지 않는다.

기각 사유:

- **대안 A 기각**: 세션화 불가능한 호출자 (AI, undo/redo) 가 영구 미커버라 hard
  constraint 1 을 완결할 수 없고, 표면별 중복이 유지보수 HIGH.
- **대안 C 기각**: O(N) diff 가 N-비결합이라는 본 ADR 의 목적 자체와 모순.

> 구현 상세: [190-commit-descriptor-emitter-expansion-breakdown.md](design/190-commit-descriptor-emitter-expansion-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                   | 심각도 | 대응                                                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | descriptor fidelity — patch 키 오해석으로 dirty-root 과소 → stale 화면 (`updateElementProps` 임의 키 → `style.patch` 변환 경계)                                                                                        |  HIGH  | 해석 불가 키 1개라도 존재 시 descriptor 미발행 → full rebuild (부분 patch 금지). pixel oracle 을 G1/G2 통과 조건으로 강제                                  |
| R2  | 이중 큐 — presentation session 발 commit 과 store emitter 가 같은 commit 을 중복 queue → `pendingCommit` 단일 슬롯 덮어쓰기, revision 원자성(HC4) 훼손                                                                 |  HIGH  | commit origin 표식으로 emitter 스킵 (`SkiaCanvas.tsx:449` 경로와 상호 배타) + 덮어쓰기 회귀 테스트를 G1 에 포함                                            |
| R3  | revision 결합 — emitter 가 잘못된 revision 으로 queue 시 sync 스킵/오소비                                                                                                                                              |  MED   | post-commit documentVersion 후행 읽기 + 기존 `queuedCanonicalRevision` 검사 준용                                                                           |
| R4  | 대량 mutation (undo/redo 다수 노드) 에서 dirty root 다수 → sparse 이득 역전                                                                                                                                            |  MED   | dirty root 수/affected 비율 임계 초과 시 full rebuild 조기 판정, 임계는 N-tier 벤치 산정 (G3)                                                              |
| R5  | `damageUnsafeElementIds` (shadow/transform paint outset) 장면과의 상호작용                                                                                                                                             |  LOW   | ADR-189 기존 게이트 재사용 — unsafe 존재 시 sparse 거부 유지, 신규 로직 없음                                                                               |
| R6  | 단일 사용자 편집 → 다중 canonical mutation (instance sync / propagation fan-out) 을 mutation 별 연속 queue 하면 `pendingCommit` 단일 슬롯이 앞선 patch 를 덮어씀 — R2 는 이중 생산자, 본 항목은 동일 생산자 연속 queue |  MED   | 같은 commit window 의 mutation 을 `mutations[]` 배열 1회 queue 로 배치 (`queueCommitPatch`/`createCommitPatchPlan` 기지원) + 배치 회귀 테스트를 G1 에 포함 |

## Gates

| Gate | 시점    | 통과 조건                                                                                                                                                                      | 실패 시 대안                           |
| ---- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| G1   | Phase 1 | generic style commit `queueCount≥1`·`patchSuccess=1`·full build 0 (probe); pixel diff 0; N=5,000 `render.frame` p95 < 4ms; 이중 큐(R2)·다중 mutation 배치(R6) 회귀 테스트 PASS | emitter 를 dirty-key allowlist 로 축소 |
| G2   | Phase 2 | structure add/remove/order patch 성공 + 신규/삭제 노드 자체 DOM↔Skia parity; reparent fail-closed 계약 테스트 PASS                                                             | structure 축을 add 단독으로 축소       |
| G3   | Phase 3 | undo/redo·AI·드래그 경로 분류표 100% (수렴 또는 명시 full rebuild); 대량 mutation 벤치에서 sparse ≤ full 역전 0 (R4)                                                           | 임계 하향 — 보수적 full rebuild 확대   |
| G4   | Phase 4 | N-tier 재실측 sparse command N 비결합·long task 0·console error 0 + live builder exercise 기록                                                                                 | 미달 축 Phase 3 반송, 승격 보류        |

## Consequences

### Positive

- 5,000-node 문서의 패널/AI/undo 발 style·structure commit 이 73.1ms full
  rebuild 에서 sparse lane (실측 damage 0.4/0.5ms 급) 으로 이동 — ADR-189 이득이
  편집 유형 전반으로 확장.
- 신규 편집 경로가 emitter 를 자동 상속 — 표면 추가 시 성능 회귀 누적 구조 제거.
- `apps/builder/scripts/adr189-commit-baseline.mjs` 가 generic 경로의 상시 회귀
  oracle 로 승격 (현재는 미커버 경로 측정기).

### Negative

- canonical store mutation 지점 (`elements.ts` 계열) 에 emitter 호출이 추가되어
  store 와 렌더 lane 의 결합점이 1곳 늘어난다 (관찰자 계약으로 한정).
- 이중 큐 dedupe 표식이 commit 흐름에 origin 개념을 도입 — ADR-187 lane 과의
  교차 테스트 유지 비용.
- `reparent`/`ref`/`slot` 및 대량 mutation 은 의도적으로 full rebuild 잔존 —
  본 ADR 이후에도 전체 편집 유형의 100% sparse 화는 아니다 (명시 비스코프).
