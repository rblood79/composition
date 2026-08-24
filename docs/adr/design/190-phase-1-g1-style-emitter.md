# ADR-190 Phase 1 / G1 — style 축 emitter

> 본문: [../190-commit-descriptor-emitter-expansion.md](../190-commit-descriptor-emitter-expansion.md) ·
> Phase 0: [190-phase-0-emitter-inventory.md](190-phase-0-emitter-inventory.md)

## 판정

**G1 통과 — Phase 1 완료 (2026-08-24)**

`updateElementProps` 로 들어오는 generic canonical commit 이 ADR-189 의 sparse
commit lane 에 진입한다. N=5,000 문서에서 한 요소 style commit 의
`render.frame` p95 가 **73.1ms → 2.6ms** 로 내려갔고, patch 결과와 full rebuild
결과의 픽셀 차이는 0 이다.

## 1. 구현

| 파일                                        | 역할                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------ |
| `presentation/storeCommitDescriptor.ts`     | props patch → `style.patch` descriptor 변환 (순수 함수, fail-closed 판정 소유) |
| `presentation/storeCommitDescriptorSink.ts` | store → commit lane 단방향 sink (단일 슬롯) + 진단 카운터                      |
| `stores/utils/elementUpdate.ts:398-410`     | canonical sync 직후 emitter 호출                                               |
| `skia/SkiaCanvas.tsx`                       | sink 등록/해제 (기존 `onCommitted` 배선과 같은 effect)                         |

emitter 는 canonical sync **뒤**, `set()` **앞**에 있다 (Phase 0 §2). 그 지점의
`documentVersion` 이 post-commit revision 이고, `set()` 이 store 구독을
발화시키기 전이라 그 sync 가 pending commit 을 본다.

### fail-closed 판정 (R1)

descriptor 는 다음 중 하나라도 걸리면 `null` 이고, 호출자는 기존 full rebuild
경로를 그대로 둔다:

- patch 최상위가 `style` 단독이 아님 — prop 축 (`label`/`items`/`size` 등) 혼입
- `style` 안에 **effect registry 미등재 키**가 하나라도 있음
- projected render id (`::page-frame::` — canonical 문서에 없음, ADR-135)
- 빈 patch / 빈 style

상속 전파 키 (`fontSize`/`lineHeight`/`textAlign` 등 13개) 가 섞이면 descriptor
전체를 `propagation: "inherited-subtree"` 로 **승격**한다. 좁은 쪽(self)으로
축소하면 자손이 갱신되지 않는다.

### fail-closed 는 patch 단위이지 키 단위가 아니다

이 성질은 측정 중 실증됐다. probe 가 미등재 키를 한 번 넣자 그 키가 style 에
남아 **이후 모든 commit 이 fail-closed** 로 떨어졌다 (probe 자체의 결함이었고
스크립트에 정리 단계를 추가했다). 실사용에서도 같은 일이 일어난다 — 호출자가
delta 가 아니라 병합된 전체 style 을 넘기면, 그 요소가 미등재 키를 하나라도
가진 순간 lane 진입이 영구히 막힌다.

이는 의도된 보수성이다 (최악 = 오늘의 성능). 다만 **신규 style 키를 도입할 때
effect registry 등재가 sparse lane 진입의 전제**라는 뜻이므로, registry 등재를
빠뜨리면 성능 회귀가 조용히 누적된다. Phase 3 에서 미등재 키 노출 계측을
검토한다.

## 2. G1 실측

재현:

```bash
node apps/builder/scripts/adr190-generic-commit-probe.mjs --repeats 8
node apps/builder/scripts/adr190-pixel-oracle.mjs
```

Chrome 151, 1440×900 headless, dev server `localhost:5173`. tier 당 known-key
8회 + 미등재 키 2회. console error **0건**.

### sparse lane 진입

| fixture N | queue | patchSuccess | fallback | full build | frame p95 | record p95 |
| --------: | ----: | -----------: | -------: | ---------: | --------: | ---------: |
|        50 |   8/8 |          8/8 |        0 |      **0** |     1.8ms |          0 |
|       500 |   8/8 |          8/8 |        0 |      **0** |     1.6ms |          0 |
|     5,000 |   8/8 |          8/8 |        0 |      **0** | **2.6ms** |      **0** |

`record p95 = 0` 은 content record 자체가 일어나지 않았다는 뜻이다 — subtree
splice 가 command stream 을 제자리 교체하므로 whole-tree 재기록이 없다.

### before / after (ADR-190 §Context 대비)

| N=5,000 축         |  before |             after |
| ------------------ | ------: | ----------------: |
| `render.frame` p95 | 79.9ms¹ |         **2.6ms** |
| content record p95 |  69.2ms |             **0** |
| full DFS visits    |   5,056 | **0 (subtree 1)** |
| queue 진입         |       0 |           **8/8** |

¹ 같은 스크립트의 emitter 비활성 상태 실측 (ADR-189 G0 baseline 73.1ms 와
동일 경로, fixture 차이로 수치가 소폭 다르다).

### fail-closed

| fixture N | 미등재 키 commit | queue | full build |
| --------: | ---------------: | ----: | ---------: |
|        50 |                2 | **0** |          2 |
|       500 |                2 | **0** |          2 |
|     5,000 |                2 | **0** |          2 |

### pixel oracle

258-node fixture 에서 `left`/`top` 을 generic commit 으로 옮긴 뒤 backing buffer
를 캡처하고, reload full rebuild 로 같은 상태에 다시 도달해 비교했다.

- patch 경로: `queue 1` / `patchSuccess 1` / `fallback 0` / full build **0** /
  subtree build 1
- 비교: `1440 × 852`, **differing pixels 0**, max channel delta 0, mean 0
- console error 0

## 3. R2 / R6 회귀 방어

`storeCommitDescriptorProducerSeparation.static.test.ts` 4건:

- presentation commit adapter 에 `updateElementProps` / `batchUpdateElementProps`
  참조 0건 — 두 생산자가 같은 commit 을 중복 queue 하지 않는다
- `instanceActions.ts` 에 `updateElementProps` 참조 0건
- emitter 호출이 canonical sync 뒤 · `set()` 앞이라는 순서 계약
- sink 가 단일 슬롯 (listener Set 재도입 금지)

## 4. 검증

- `pnpm type-check`: PASS (baseline 43 known errors, 신규 위반 0)
- Builder Vitest — `presentation` + `stores` + `skia`: 1,003 passed / 4 skipped,
  실패 1건은 `buildSpecNodeData.test.ts` 의 mesh gradient 로 **본 변경 이전부터
  실패**한다 (clean `main` 에서 stash 후 동일 1건 실패 재현 확인)
- 신규 테스트 13건 (descriptor 변환 9 + sink 4) + 정적 계약 4건
- live builder exercise: 위 probe / pixel oracle 이 실제 Chrome 에서 프로젝트
  생성 → 요소 시드 → 패널 경로와 동일한 `updateElementProps` commit → Skia
  렌더 결과 캡처까지 수행

## 5. 잔존 (Phase 2~3)

- structure 축 (`add`/`remove`/`order`) — Phase 2
- `batchUpdateElementProps` 배치 queue (R6), `updateElement`, undo/redo·AI·드래그
  경로 분류, 대량 mutation 임계 (R4) — Phase 3
- 미등재 style 키 노출 계측 — Phase 3 검토
