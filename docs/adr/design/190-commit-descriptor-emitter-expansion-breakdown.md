# ADR-190 구현 상세 — commit descriptor emitter 확장

> 본문: [190-commit-descriptor-emitter-expansion.md](../190-commit-descriptor-emitter-expansion.md)

## 1. 전제·관점 4 질문 lock-in

1. **base/응용 분류**: ADR-189 (sparse commit lane 메커니즘) = base, 본 ADR-190
   (emitter 커버리지 확장) = 응용. base 는 Implemented (2026-08-24) 로 prerequisite
   충족.
2. **schema 직교성**: `EditorMutationDescriptor` union (`editorPresentationTypes.ts:30`)
   은 ADR-187/189 에서 이미 `fills.replace | style.patch | geometry.patch |
structure.patch` 로 정의됨. 본 ADR 은 신규 descriptor 스키마를 만들지 않고
   **생산자(emitter)만** 추가한다 — specialization 아님.
3. **선행 ADR 전제 reverse 검증**: 소비자 체계 (`createCommitPatchPlan`,
   `commitPatchPlan.ts:120`) 가 style/geometry/structure(add/remove/order) plan 을
   이미 지원함을 코드로 확증 — 189→190 단방향 의존, 역방향 없음.
4. **사용자 confirm 기록**: 2026-08-24 사용자 명시 요청 ("descriptor emitter 확장
   후속 ADR로 제안해줘"). ADR-189 Phase 4 잔존 범위가 예고한 후속 작업이다.

## 2. 실측 현황 (2026-08-24, 착수 근거)

before/after 재실측 (`node apps/builder/scripts/adr189-commit-baseline.mjs`,
N=50/500/5,000, 5회 p95):

| 경로                                             | N=5,000 record+stream p95 | full DFS visits | 비고                            |
| ------------------------------------------------ | ------------------------: | --------------: | ------------------------------- |
| generic `updateElementProps` (G0 2026-08-22)     |                    75.1ms |           5,056 | ADR-189 이전                    |
| generic `updateElementProps` (2026-08-24 재실측) |                    73.1ms |           5,056 | ADR-189 이후 — **변화 없음**    |
| `fills.replace` (presentation 터미널, Phase 4/5) |  damage 0.4/0.5ms p50/p95 |  patch visits 1 | sparse command 11 vs full 1,533 |

probe 실측: generic mutation 은 `queueCount=0` / `patchFallbackCount=0` — fallback
이 아니라 **patch queue 진입 자체가 없다**. 유일 생산자는
`SkiaCanvas.tsx:449` (`SkiaEditorPresentationBridge.onCommitted →
StoreRenderBridge.queueCommitPatch`, `StoreRenderBridge.ts:1041`) 이고, 터미널
commit 라우터 (`editorPresentationCommitAdapter.ts` §
`editorPresentationCanonicalRuntimeOptions.commit`) 는 `fills.replace` 전량 +
`style.patch` 협소 allowlist (borderColor / boxShadow / text color / opacity /
px 고정 width·height·spacing longhand / fontSize·fontWeight) 만 canonical commit
으로 받는다.

## 3. 현행 경로 지도

```
[커버됨]  Style 패널 presentation session → finish(finalDescriptor)
          → runtime #commit (adapter allowlist) → onCommitted
          → queueCommitPatch → createCommitPatchPlan → subtree splice + damage
[미커버]  updateElementProps / addComplexElement / removeElement / move·reorder
          / undo·redo / AI tool / 키보드 nudge → canonical store 직접 mutation
          → descriptor 없음 → full DFS rebuild + full content record
```

소비자 측 기지원 범위 (`commitPatchPlan.ts`):

- `style.patch` / `geometry.patch` — used-size 승격 판정 포함 (ADR-188 lane 공유)
- `structure.patch` — `add` / `remove` / `order` (dirty root = 부모). `reparent` /
  `ref` / `slot` 은 `unsupported-structure-operation` fail-closed — **본 ADR 에서도
  유지** (범위 특정 불가, full rebuild 수렴)

## 4. Phase 분할

### Phase 0 — emitter 지점 inventory freeze + baseline 고정

- canonical mutation action 전수 grep: `updateElementProps`,
  `addComplexElement`, `removeElement(s)`, move/reorder 계열, group/ungroup,
  undo/redo apply, AI tool 경유 mutation, ADR-184 러너 경유 신규 경로. 각
  action → descriptor 축 (style/structure) 매핑 표 + 제외 목록 (reparent 계열,
  page-level mutation) 산출.
- presentation session 발 commit 과의 경로 중첩 지점 (이중 큐 후보) 식별.
- baseline 은 §2 의 2026-08-24 재실측을 freeze (재측정 불요 — 동일 스크립트,
  browser error 0).
- 산출물: 본 문서 §7 inventory 표 갱신.

### Phase 1 — style 축 emitter (updateElementProps 경계)

- `updateElementProps` 가 자신의 patch 를 `style.patch` descriptor 로 서술해
  post-commit revision 과 함께 `queueCommitPatch` 로 전달.
- **fail-closed 계약**: descriptor 화 불가능한 키 (예: 구조 유발 prop) 가 하나라도
  섞이면 descriptor 를 내지 않는다 — 전체 commit full rebuild (부분 patch 금지,
  ADR-189 HC4).
- **이중 큐 dedupe**: presentation session 발 canonical commit (adapter 경유) 은
  commit origin 표식으로 store emitter 를 스킵 — `pendingCommit` 단일 슬롯
  덮어쓰기 차단. 회귀 테스트 필수.
- adapter allowlist 는 그대로 유지 (ADR-187 계약 무변경) — emitter 는 allowlist
  밖 키를 commitPatchPlan 판정에 위임한다.
- **다중 mutation 배치 (R6)**: instance sync / propagation fan-out 으로 한 사용자
  편집이 다수 canonical mutation 을 만들면 `queueCommitPatch(mutations[])` **1회
  배치**로 전달 — mutation 별 연속 queue 는 `pendingCommit` 단일 슬롯
  (`StoreRenderBridge.ts:1052` 무조건 덮어쓰기) 이 앞선 patch 를 유실시킨다.
  `createCommitPatchPlan` 은 mutations 배열을 기지원.
- **queue 순서 계약**: emitter 는 store subscriber sync 실행 전 (같은 동기 commit
  window 안) 에 queue 한다 — 늦으면 sync 가 pendingCommit 없이 changedIds 를
  소비해 뒤늦은 patch 가 stale revision 이 된다. G1 probe (`queueCount`/
  `patchSuccess`) 로 검출.
- **Phase 1 완료 (2026-08-24)** — G1 전 항목 통과. 증적:
  [190-phase-1-g1-style-emitter.md](190-phase-1-g1-style-emitter.md).
  N=5,000 `render.frame` p95 73.1ms → **2.6ms**, full build 0, pixel diff 0.

### Phase 2 — structure 축 emitter (add / remove / order)

- `addComplexElement` / `removeElement` / reorder 가 `structure.patch`
  (payload.parentId 포함 — post-commit 트리에서 remove 대상은 부모 참조가 유일
  단서) descriptor 를 emit.
- `reparent`/`ref`/`slot` 은 emit 하지 않음 (소비자 fail-closed 유지).
- **Phase 2 완료 (2026-08-24)** — G2 전 항목 통과. 증적:
  [190-phase-2-g2-structure-emitter.md](190-phase-2-g2-structure-emitter.md).
  deep add 22.3ms → 1.2ms / deep remove 19.4ms → 1.1ms, 렌더 정합성 12/12.
  R6 은 sink 계약을 배열로 바꿔 구조적으로 해소.

### Phase 3 — 잔여 호출자 수렴 + 대량 mutation 임계

- undo/redo apply, AI tool, 키보드 nudge, 드래그 터미널 commit 이 Phase 1/2
  emitter 경유로 수렴하는지 실측. 미수렴 경로는 개별 배선 또는 의도적 full
  rebuild 로 명시 분류.
- 대량 mutation (undo 로 다수 노드 동시 변경): dirty root 수 / affectedIds 비율
  임계 초과 시 full rebuild 조기 판정 — sparse 역전 방지. 임계값은 N-tier 벤치로
  산정.
- **Phase 3 완료 (2026-08-24)** — G3 전 항목 통과. 증적:
  [190-phase-3-g3-path-classification.md](190-phase-3-g3-path-classification.md).
  경로 전수 분류 완료 (AI tool 은 Phase 1·2 배선으로 자동 커버). **R4 는 임계
  상수를 도입하지 않는 것으로 판정** — 경계가 batch 크기가 아니라 dirty root
  개수 1이고, 2개부터 이미 소비자가 fail-closed 하므로 임계 로직이 도달 불가
  코드가 된다. 대신 무익한 시도를 막는 가드를 넣어 다중 항목의 queue/fallback
  을 4/4 → 0/0 으로 제거했다.

### Phase 4 — closure

- G0 스크립트 재실측 before/after 표 (본 문서 §2 대비) — N=5,000 generic commit
  이 sparse lane 수치로 내려왔는지 확정.
- live builder exercise (CLAUDE.md §완료 기준): Chrome 에서 패널 편집 + undo +
  구조 추가 각 1회 이상, `queueCount/patchSuccess` 및 pixel 확인.
- CHANGELOG / README 갱신, Implemented 승격 (closure 5단계).

## 5. Gate 상세

| Gate | 시점    | 통과 조건                                                                                                                                                            | 실패 시 대안                           |
| ---- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| G1   | Phase 1 | probe 기준 generic style commit `queueCount≥1`·`patchSuccess=1`·full build 0; patch vs full pixel diff 0; N=5,000 `render.frame` p95 < 4ms; 이중 큐 회귀 테스트 PASS | emitter 를 dirty-key allowlist 로 축소 |
| G2   | Phase 2 | structure add/remove/order commit patch 성공 + 신규/삭제 노드 자체의 DOM↔Skia parity; reparent fail-closed 계약 테스트 PASS                                          | structure 축을 add 단독으로 축소       |
| G3   | Phase 3 | undo/redo·AI·드래그 경로 분류표 100% (수렴 or 명시 full rebuild); 대량 mutation 임계 벤치에서 sparse ≤ full 역전 0                                                   | 임계 하향 (보수적 full rebuild 확대)   |
| G4   | Phase 4 | N-tier 50/500/5,000 재실측 — generic commit sparse command 수 N 비결합, long task 0, console error 0; live exercise 기록                                             | 미달 축을 Phase 3 로 반송, 승격 보류   |

## 6. 파일 경계 (예상)

| 파일                                                                       | 변경                                                     |
| -------------------------------------------------------------------------- | -------------------------------------------------------- |
| `apps/builder/src/builder/stores/elements.ts` (canonical mutation 지점)    | style/structure emitter 호출 + origin 표식               |
| `apps/builder/src/builder/presentation/commitPatchPlan.ts`                 | 변경 없음 목표 (기지원) — 대량 mutation 임계만 추가 가능 |
| `apps/builder/src/builder/workspace/canvas/skia/StoreRenderBridge.ts`      | `queueCommitPatch` origin dedupe                         |
| `apps/builder/src/builder/workspace/canvas/skia/SkiaCanvas.tsx`            | emitter 배선 (기존 449 라인 경로와 병렬)                 |
| `apps/builder/src/builder/presentation/editorPresentationCommitAdapter.ts` | 무변경 (ADR-187 allowlist 계약 유지)                     |

정확한 목록은 Phase 0 inventory 에서 freeze — 추정 vs 실측 gap 은 Phase 0 보강
commit 으로 흡수 (adr-writing.md M3).

## 7. Phase 0 inventory

**Phase 0 완료 (2026-08-24)** — 산출물은
[190-phase-0-emitter-inventory.md](190-phase-0-emitter-inventory.md) 로 분리했다.
Phase 1 진입 판정에 직결되는 결론 3건:

- emitter 삽입점 단일 특정 — `elementUpdate.ts:398` (canonical sync) 과 `:415`
  (`set`) 사이. 정적 가드 무충돌, ADR-184 allowlist 추가 불요
- **R2 (이중 큐) 는 코드 구조상 이미 분리** — presentation adapter 는
  `runCanonicalMutation` + `useStore.setState` 직접 경로라 `updateElementProps`
  를 경유하지 않는다. origin 표식 불요, 회귀 테스트로 대체
- **R6 (다중 mutation) 은 `batchUpdate*` 2개 한정** — Phase 1 대상
  `updateElementProps` 는 단일 element 수정이라 배치 로직 불요, Phase 3 로 이연
