# ADR-190 Phase 2 / G2 — structure 축 emitter

> 본문: [../190-commit-descriptor-emitter-expansion.md](../190-commit-descriptor-emitter-expansion.md) ·
> Phase 0: [190-phase-0-emitter-inventory.md](190-phase-0-emitter-inventory.md) ·
> Phase 1: [190-phase-1-g1-style-emitter.md](190-phase-1-g1-style-emitter.md)

## 판정

**G2 통과 — Phase 2 완료 (2026-08-24)**

자식 추가·삭제·순서 변경이 sparse commit lane 에 진입한다. 큰 문서 안의 작은
컨테이너를 편집하는 실사용 형태에서 `render.frame` p95 가 **22.3ms → 1.2ms**
(추가) / **19.4ms → 1.1ms** (삭제) 로 내려갔고, 추가한 노드는 Skia registry 에
등록되고 삭제한 노드는 사라진다 (렌더 정합성 12/12).

## 1. 구현

| 파일                                             | 변경                                                           |
| ------------------------------------------------ | -------------------------------------------------------------- |
| `presentation/storeStructureCommitDescriptor.ts` | structure.patch descriptor 변환 (신규)                         |
| `presentation/storeCommitEmitter.ts`             | style·structure 공용 emitter 진입점 (신규 — Phase 1 헬퍼 이관) |
| `presentation/storeCommitDescriptorSink.ts`      | sink 계약을 **배열**로 전환 (R6)                               |
| `stores/utils/elementCreation.ts`                | `addElement` / `addComplexElement` 배선                        |
| `stores/utils/elementRemoval.ts`                 | `executeRemoval` 배선                                          |
| `stores/elements.ts`                             | `reorderElementWithinParent` 배선 (`order`)                    |

### dirty root 는 대상이 아니라 부모

자식 추가/제거/순서는 부모의 subtree command span 길이를 바꾸므로 부모를 다시
기록해야 형제 배치가 맞는다 (`commitPatchPlan.ts` 의
`PARENT_SCOPED_STRUCTURE_OPERATIONS`). 세 연산 모두 `payload.parentId` 를
명시적으로 싣는다 — 특히 `remove` 는 post-commit 트리에서 대상 노드가 이미
사라져 있어 부모 참조가 **유일한** 단서이고, 그 부모는 mutation 전 스냅샷
(`rootElements`) 에서만 읽을 수 있다.

### 배열 sink 로 R6 을 구조적으로 해소

`addComplexElement` 는 부모와 자식 N개를 한 편집으로 만든다. 요소마다 따로
queue 하면 `pendingCommit` 단일 슬롯이 앞선 patch 를 덮어써 유실된다. sink 계약을
`(descriptors[], revision)` 으로 바꿔 **한 번에** 넘긴다 — `queueCommitPatch` 와
`createCommitPatchPlan` 은 원래 배열을 받으므로 소비자 변경은 없다.

### emit 하지 않는 것

| 대상                        | 사유                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------- |
| `reparent` / `ref` / `slot` | 출발지·도착지 양쪽이 dirty — descriptor 하나로 범위 특정 불가. 소비자도 fail-closed (정적 테스트로 고정) |
| 삭제 대상의 **자손**        | 부모 subtree 를 다시 기록하면 사라진 자손도 함께 사라진다. root 의 부모만 dirty 로 잡으면 충분           |
| autoDetach 가 동반된 삭제   | 삭제와 별개로 다른 요소의 props 가 바뀌어 structure descriptor 만으로 화면을 맞출 수 없다 → 전체 포기    |
| 하나라도 변환 실패한 batch  | 부분 emit 금지 — 한 프레임에 patch/full 두 경로가 섞이면 revision 원자성이 깨진다 (ADR-189 HC4)          |

## 2. G2 실측

재현:

```bash
node apps/builder/scripts/adr190-structure-probe.mjs
```

Chrome 151, 1440×900 headless, 1,000-node 문서. 시나리오당 4회. console error 0.

| 시나리오                    | queue | patchSuccess | fallback | full build | 렌더 정합성 | p95 (전) |  p95 (후) |
| --------------------------- | ----: | -----------: | -------: | ---------: | :---------: | -------: | --------: |
| deep add (작은 컨테이너 안) |   4/4 |          4/4 |        0 |          0 |     4/4     |   22.3ms | **1.2ms** |
| deep remove                 |   4/4 |          4/4 |        0 |          0 |     4/4     |   19.4ms | **1.1ms** |
| shallow add (body 직속)     |   4/4 |          4/4 |        0 |          0 |     4/4     |   18.8ms | **7.4ms** |

"전" 은 같은 스크립트를 Phase 2 미적용 상태(`git stash`)에서 돌린 값이다 — 세
시나리오 모두 `queue 0` / `full build 4` 로 full rebuild 경로였다.

**렌더 정합성 판정**: `add` 는 store 와 Skia registry 양쪽에 존재해야 하고,
`remove` 는 양쪽에서 사라져야 한다. 12/12 충족 — 요소 소실도 유령 노드도 없다.

### shallow add 가 덜 빨라지는 이유 (R4 잔존)

body 직속 추가는 dirty root 가 body 라 affected subtree 가 문서 전체다. 그래서
subtree splice 가 사실상 전체 재기록에 가까워지고, 이득이 2.5배에 그친다
(18.8 → 7.4ms). 회귀는 아니지만 **120Hz 예산 4ms 는 넘는다**.

이 형태에 임계를 걸어 full rebuild 로 조기 판정할지는 R4 (Phase 3) 판단이다.
현 시점에서 임계를 넣지 않은 이유: 임계 미만/초과 모두 오늘보다 빠르고, 임계값을
근거 없이 고르면 실사용 분포와 어긋난 상수가 굳는다.

### pixel oracle · G1 회귀

- pixel oracle (258-node, generic style commit): `1440 × 852`, **differing
  pixels 0**, max/mean delta 0, fallback 0 — Phase 1 과 동일
- G1 재실측 (같은 tier ladder, 8회): N=5,000 `render.frame` p95 **2.8ms**
  (Phase 1 기록 2.6ms 대비 동등), queue/patchSuccess 8/8, full build 0

## 3. 검증

- `pnpm type-check`: PASS. baseline 항목 1건의 **줄 번호만** 500 → 501 로 정정
  (import 추가로 밀린 기존 오류 — 내용 동일, 전체 재생성은 신규 오류를 흡수할 수
  있어 회피)
- Builder Vitest `presentation` + `stores`: **669 passed / 97 files**
- 신규 테스트: structure descriptor 5건, sink 배열 계약 2건 추가 (총 8건)
- 정적 계약 6건 — 생산자 분리 3 + emit 순서 (style·structure) 2 + reparent 비대상 1
- live exercise: 실제 Chrome 에서 프로젝트 생성 → 1,000-node 시드 → 컨테이너
  추가/삭제 + body 추가 각 4회 → Skia registry·store 양쪽 확인 + 픽셀 비교

## 4. 잔존 (Phase 3)

- `batchUpdateElementProps` 배치 queue, `updateElement`
- undo/redo · AI · 드래그(`moveElementToCanonicalTarget`) 경로 분류
- 대량 mutation 임계 (R4) — 위 shallow add 형태 포함
- 미등재 style 키 노출 계측
