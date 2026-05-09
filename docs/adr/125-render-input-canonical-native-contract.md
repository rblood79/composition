# ADR-125: Render input canonical-native contract

## Status

Proposed — 2026-05-10

## Context

**도메인**: D3 (시각 스타일) — render input contract는 Skia renderer와 Preview renderer가
`CompositionDocument` canonical scene을 소비하는 방식의 경계이다. SSOT 체인에서 D3
symmetric consumer 계약의 "입력 경계"를 확정하는 결정이다.

**의존 ADR**:

- ADR-116: `CompositionDocument`를 storage/mutation SSOT로 승격
- ADR-122: Builder internal runtime에서 mutable legacy mirror 제거 (Implemented 2026-05-09)
- ADR-100: Unified Skia Engine — 단일 렌더러 (Skia)
- ADR-126 (후속, 응용): Element 타입 deprecate — 본 ADR(base)이 ADR-126의 prerequisite

**ADR-122 closure note 후속**:

ADR-122는 closure 시 다음을 명시했다:

> "the layout engine still accepts `elementsMap`/`childrenMap` as an internal derived
> render contract, but the maps now come from canonical scene input when an active
> document exists; removing that internal layout contract is a separate renderer
> refactor, not a G6 mutable legacy mirror blocker."
>
> "`UPDATE_ELEMENTS` Preview compatibility receive type [...] remain allowed by bucket."

본 ADR은 이 closure note의 "별도 renderer refactor" 항목을 정식 범위로 다룬다.
ADR-122가 mutable legacy mirror를 runtime primary에서 제거했다면, ADR-125는 render
pipeline의 **입력 계약** 자체를 canonical-native로 확정한다.

**현재 상태 (잔존 표면)**:

1. **layout engine map-shaped input** (`fullTreeLayout.ts`): `DFSContext.elementsMap /
childrenMap` shape를 직접 받는다. 호출자는 canonical-derived map을 생성해 전달하지만,
   contract 자체는 legacy map shape이다. 42곳의 `elementsMap`/`childrenMap` 참조가
   내부 traversal에 산재한다.

2. **Preview `UPDATE_ELEMENTS` receive type 잔존** (`messageHandler.ts:45` type def,
   `:300` case 처리 / `preview/types/index.ts:71`): canonical hydration 이전 bootstrap
   compatibility path로 남아 있지만 active channel은 아니다.

3. **`elements.ts:1414–1456` element move fallback `order_num` 갱신**: canonical
   `children[]` index가 SSOT임에도 move 연산에서 `order_num` 필드를 Element 상태에
   기록한다. ADR-122 HC.5 ("Element/page/layout order는 `CompositionDocument.children[]`
   index가 SSOT이며 `order_num`을 재도입하지 않는다") 위반 잔존.

4. **`useIframeMessenger.ts:718–726` bootstrap fallback path**: `!canonicalDoc` 분기에서
   `sendElementsToIframe(currentElements)` — `UPDATE_ELEMENTS` outbound가 canonical
   hydration 이전에 전송될 수 있다.

**Hard Constraints**:

1. Skia render hot path: 60fps 유지 — canonical traversal 비용이 기존 map lookup 비용을
   초과하면 scene snapshot 또는 pre-built node list 캐시가 필수.
2. Preview render parity 0: Preview가 수신하는 render input 변경 후 시각 회귀 0.
3. `order_num` 재도입 금지 (ADR-122 HC.5 계승).
4. cloud/export/import boundary는 이번 scope 밖 — `exportLegacyDocument()` boundary
   allowlist는 ADR-122 G4 기준을 유지한다.

**Soft Constraints**:

- layout engine 내부 traversal 구현 변경은 `fullTreeLayout.ts` boundary 내에서 격리.
  `BaseTaffyEngine` / `TaffyFlexEngine` / `TaffyGridEngine` 의 외부 호출 sigature는
  가능하면 유지한다.
- Preview `UPDATE_ELEMENTS` receive type 제거는 Preview side 단독으로 rollback 가능한
  단계에서 수행한다.

## Alternatives Considered

### 대안 A: ADR-122 closure 상태 유지 (현재 canonical-derived map contract 동결)

- 설명: layout engine은 `elementsMap`/`childrenMap` map shape를 contract로 유지하되,
  호출자가 canonical document에서 파생한 map을 전달하는 현재 상태를 "완료"로 간주한다.
  Preview `UPDATE_ELEMENTS` receive type과 `order_num` 갱신도 그대로 남긴다.
- 근거: ADR-122 G6이 통과했으므로 추가 변경 없이 안정 상태로 간주할 수 있다.
- 위험:
  - 기술: M — contract가 map shape이므로 미래에 canonical model이 변경되면 호출자와
    layout engine 양쪽을 동시에 수정해야 한다. map 파생 로직이 호출자마다 별도로
    존재할 수 있어 drift 위험이 남는다.
  - 성능: L — 현재 canonical-derived map 생성 비용이 측정된 상태.
  - 유지보수: H — "canonical-only runtime" 선언에도 불구하고 layout API contract가
    legacy `Element[]` shape를 계속 요구한다. ADR-116/122 읽는 개발자에게 혼란.
    `order_num` 갱신 잔존으로 ADR-122 HC.5 위반 상태가 영구화된다.
  - 마이그레이션: L — 아무것도 변경하지 않으므로 단기 이동 비용 없음.

### 대안 B: layout engine + Preview receive 즉시 전환, 성능 검증 없이 배포

- 설명: `DFSContext`를 canonical node list/scene model 직접 입력으로 즉시 교체하고,
  Preview `UPDATE_ELEMENTS` receive case를 제거한다. `order_num` 갱신도 동시에 제거한다.
- 근거: 가장 빠른 full closure. 코드량 감소.
- 위험:
  - 기술: M — `fullTreeLayout.ts` 내 42곳 `elementsMap`/`childrenMap` 참조를 한 번에
    교체하면 회귀 발생 시 원인 분리가 어렵다.
  - 성능: M — canonical traversal이 기존 Map lookup보다 비용이 크면 60fps 목표를
    위협한다. 성능 검증 없이 배포하면 발견이 늦다.
  - 유지보수: L — 완료 후 단순.
  - 마이그레이션: M — Preview side는 `UPDATE_ELEMENTS` 제거 후 hydration 순서 문제로
    빈 화면이 발생할 수 있다. fallback 없이 일괄 제거하면 롤백 비용이 크다.

### Risk Threshold Check (A/B)

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ |
| ---- | ---- | ---- | -------- | ------------ | :---: |
| A    | M    | L    | H        | L            |   1   |
| B    | M    | M    | L        | M            |   0   |

대안 A는 유지보수 HIGH가 남는다 (`order_num` HC.5 위반 영구화 + map shape API 혼란).
대안 B는 HIGH 없지만 성능 검증 없는 일괄 전환이 위험하다.
→ 단계별 성능 측정을 포함한 대안 C 추가.

### 대안 C: canonical scene model boundary 강화 + map input을 boundary 안 derived로 격리 (권장)

- 설명: layout engine 입력 계약을 canonical-native traversal 또는 scene model node list로
  점진 전환하되, 각 단계마다 render benchmark gate를 두어 60fps 회귀를 조기 탐지한다.
  Preview `UPDATE_ELEMENTS` receive type은 canonical hydration guard를 강화한 뒤 별도
  단계에서 제거한다. `order_num` 갱신은 가장 먼저 제거한다 (ADR-122 HC.5 closure).
- 근거: 단계 분리로 원인 격리. 성능 gate가 60fps 안전망. Preview side는 rollback 가능.
- 위험:
  - 기술: M — `fullTreeLayout.ts` 내부 contract 변경은 격리 가능하나, 42곳 참조 수정은
    구체 경로(`fullTreeLayout.ts:857`, `utils.ts:617`) 전수 커버가 필요하다.
  - 성능: M — canonical traversal 비용이 map lookup 비용을 초과할 수 있다. Phase 2 gate에서
    render benchmark 통과 조건으로 관리한다.
  - 유지보수: L — 완료 후 layout engine contract가 canonical-native이므로 drift 위험 제거.
  - 마이그레이션: L — 단계별 rollback surface. Preview side는 독립 rollback 가능.

### 대안 D: layout engine만 전환, Preview `UPDATE_ELEMENTS` receive 잔존

- 설명: layout engine map-shaped input만 canonical scene model로 전환하고, Preview
  receive type과 `order_num` 갱신은 별도 ADR로 미룬다.
- 근거: layout engine 범위를 최소화해 위험을 줄인다.
- 위험:
  - 기술: M — layout engine과 Preview render input contract가 분리되면 "canonical-native"
    완성 여부를 판단하기 어렵다.
  - 성능: L — layout engine만 변경하므로 Preview 측 성능 영향 없음.
  - 유지보수: H — `UPDATE_ELEMENTS` receive type과 `order_num` 갱신이 영구 잔존이 될
    위험. "별도 ADR로 미룬다"는 패턴이 debt 영구화 경로다.
  - 마이그레이션: L — 범위가 작아 rollback 쉬움.

### Risk Threshold Check (C/D)

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ |
| ---- | ---- | ---- | -------- | ------------ | :---: |
| C    | M    | M    | L        | L            |   0   |
| D    | M    | L    | H        | L            |   1   |

대안 D는 유지보수 HIGH 1개. 대안 C는 HIGH 0개.
→ 대안 C 채택. 성능 M 위험은 Phase 2 render benchmark gate로 관리.

## Decision

**대안 C: canonical scene model boundary 강화 + map input을 boundary 안 derived로 격리**를
선택한다.

선택 근거:

1. ADR-122 HC.5 `order_num` 위반이 가장 명확한 cleanup 대상이다. 이것을 먼저 제거하면
   HC.5 closure note를 충족한다.
2. layout engine 내부 contract를 canonical-native로 전환하면 `fullTreeLayout.ts`가
   legacy map shape API를 요구하지 않게 된다. 호출자와 engine 양쪽의 drift 위험이 제거된다.
3. Preview `UPDATE_ELEMENTS` receive type은 canonical hydration guard를 먼저 강화한 뒤
   별도 단계에서 제거하므로 bootstrap 순서 안전이 보장된다.
4. 성능 benchmark gate를 Phase 2에 배치해 60fps 회귀를 조기 탐지한다.

기각 사유:

- **대안 A 기각**: `order_num` HC.5 위반을 영구화한다. "canonical-only runtime" 완성 이후에도
  layout API가 legacy map shape를 요구하는 혼란이 남는다.
- **대안 B 기각**: 성능 검증 없는 일괄 전환은 60fps 회귀 발견 시 rollback 비용이 크다.
- **대안 D 기각**: Preview `UPDATE_ELEMENTS` receive 잔존과 `order_num` 잔존이 모두 debt로
  영구화될 위험이 유지보수 HIGH로 평가된다.

> 구현 상세: [125-render-input-canonical-native-contract-breakdown.md](design/125-render-input-canonical-native-contract-breakdown.md)

## Risks

| ID  | 위험                                                                                 | 심각도 | 대응                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------ | :----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | `fullTreeLayout.ts` 내 42곳 map 참조 전환 중 누락이 생기면 layout 회귀 발생          |  MED   | Phase 2 시작 전 grep gate로 전수 확인. 단위 테스트 `fullTreeLayout.syntheticElements.test.ts` + `fullTreeLayout.static.test.ts`를 전환 후 반드시 통과시킨다 |
| R2  | canonical traversal이 Map O(1) lookup보다 느리면 60fps 달성 불가                     |  MED   | Phase 2 render benchmark gate — `requestAnimationFrame` 측정 60fps 목표. 실패 시 scene snapshot 캐시 또는 pre-built node list 도입                          |
| R3  | Preview `UPDATE_ELEMENTS` receive 제거 후 bootstrap 순서 문제로 빈 화면              |  MED   | Phase 3 canonical hydration guard 강화 → 독립 browser smoke → receive case 제거 순서 보장                                                                   |
| R4  | `order_num` 제거 후 element move 연산의 sibling 재정렬이 canonical document에 미반영 |  MED   | Phase 5에서 move 연산이 canonical `children[]` patch를 primary로 수행하는지 확인. `batchUpdateElementOrders` canonical path 검증                            |

잔존 HIGH 위험 없음.

## Gates

| Gate                          | 시점         | 통과 조건                                                                                                                                                       | 실패 시 대안                                                |
| ----------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| G1: contract inventory        | Phase 0 종료 | layout engine, Preview receive, order_num, bootstrap path 4개 surface의 정확한 파일/라인 목록이 확정됨                                                          | 착수 금지, inventory 보강                                   |
| G2: layout engine benchmark   | Phase 2 종료 | `fullTreeLayout.ts` canonical-native 전환 후 render loop `requestAnimationFrame` 측정 60fps 달성. 기존 map lookup 대비 latency +10% 이내                        | scene snapshot 캐시 또는 pre-built node list 도입 후 재측정 |
| G3: Preview receive isolation | Phase 3 종료 | canonical hydration이 완료된 상태에서 `UPDATE_ELEMENTS` receive case를 제거해도 Preview 초기 렌더가 정상. browser smoke 기준: create/edit/delete/reorder 회귀 0 | hydration guard 보강 후 단계 재실행                         |
| G4: order_num closure         | Phase 5 종료 | `elements.ts` move 연산에서 `order_num` 필드 기록 0건. ADR-122 HC.5 grep gate 통과                                                                              | canonical children[] patch path 보강                        |
| G5: final verification        | Phase 6 종료 | `pnpm run codex:preflight` 통과 + browser smoke create/edit/delete/reorder/origin-instance/refresh 회귀 0 + Vitest targeted tests 통과                          | 실패 bucket을 residual로 기록 후 해당 phase 재실행          |

## Consequences

### Positive

- `fullTreeLayout.ts` API가 canonical-native이므로 호출자와 engine의 drift 위험 제거.
- ADR-122 HC.5 `order_num` 위반이 최종 제거된다.
- Preview `UPDATE_ELEMENTS` receive 제거로 Preview render pipeline이 `UPDATE_CANONICAL_DOCUMENT`
  단일 채널로 통합된다.
- ADR-126 (canonical render protocol 확장)의 prerequisite이 충족된다.

### Negative

- `fullTreeLayout.ts` 내부 42곳 참조 전환이 큰 변경이다. 단계별 gate가 있어도 수정량이 크다.
- Phase 2 성능 benchmark gate 실패 시 scene snapshot 캐시 설계가 추가 작업으로 발생한다.

## 반복 패턴 선차단 체크리스트 (adr-writing.md §"반복 패턴 선차단" 4 항목 selfcheck)

- [x] **HIGH+ 위험 코드 경로 3곳 이상 구체 인용**: 잔존 HIGH 위험 0. MEDIUM 위험 (R1~R4) 도 코드 경로 인용 — `apps/builder/src/builder/workspace/canvas/layout/engines/fullTreeLayout.ts:857-858` (42 hits), `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` (6 hits), `apps/builder/src/preview/messaging/messageHandler.ts:45,300`, `apps/builder/src/preview/types/index.ts:71`, `apps/builder/src/builder/stores/elements.ts:1414-1456` (move fallback `order_num`), `apps/builder/src/builder/hooks/useIframeMessenger.ts:721-726` (bootstrap fallback). HIGH+ 없으므로 본 항목 strict requirement N/A.
- [x] **Spec/Generator 확장 ADR 여부**: 본 ADR 은 render input contract, Spec/Generator 확장 아님. N/A.
- [x] **BC 훼손 수식화**: render parity 0 (Hard Constraint). Preview render 회귀 0, Skia 60fps 유지. 영향 = 모든 render path (100%), 회귀 허용 = 0. Phase 2 render benchmark gate (60fps + latency +10% 이내) + Phase 3 Preview canonical hydration guard 강화로 통제.
- [x] **HIGH+ Phase 분리 가능 여부 검토**: HIGH+ 0. 단, layout engine 42 hits + Preview receive + bootstrap + order_num 4 영역 직교성으로 Phase 2/3/4/5 분리. 별도 ADR 분리 불필요 (각 영역의 코드 경로 결합도 낮아 단일 ADR 내 phase 분리로 충분).
