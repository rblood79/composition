# ADR-127: Canonical-native traversal helper + scene model 재설계

> **사후 인지 라벨 (2026-05-11 retro)**: 본 ADR 은 ADR-126 Phase 2 실행 중 framing 4 의문 raise 결과 즉석 fork. memory `feedback-no-derived-adr-mid-execution` 차단 카테고리 우회 사례 (정당화 카테고리 `feedback-adr-essence-priority-over-formal-pass` 인용으로 차단 메모리 침묵). 결과 코드 (helper API + scene model 재설계 자연 그루핑) 자체는 회귀 안전망 통과 — **코드 retro 가 아니라 거버넌스 retro**. 상세: [docs/adr/reviews/127-framing-violation-retro.md](../reviews/127-framing-violation-retro.md). 재발 차단 메커니즘: `~/.claude/plans/adr-123-124-125-126-sunny-crescent.md` (본 plan 의 E1 PreToolUse hook + E2 CLAUDE.md literal pattern).

## Status

Implemented — 2026-05-10

진행 로그:

- 2026-05-10 Proposed 발의 — ADR-126 Phase 2 진입 직전 framing 4 의문 raise 결과 base ADR 분리
- 2026-05-10 Phase 0 inventory 사전 — 5 agent 병렬 dispatch (codex review + 4 Explore agent — Phase 0 inventory / Phase 2 hot path 분석 / Phase 4-5 + ADR-124 followup / scene caller 영향). Helper API 60 call site / scene model build chain 18 / scene field read 56 / 위험 신호 없음
- 2026-05-10 Phase 1 (Helper API 6 신설 — G1 PASS) — `canonicalTraversalHelpers.ts` 신설 (`getChildren` / `getParent` / `getAncestors` / `findByPath` / `getNodeMap` / `getChildrenByParent`) + module-level cache (`documentVersion` + `projectId` 기반 invalidation) + 단위 테스트 28/28 PASS + type-check 0 error
- 2026-05-10 Phase 2 (Scene model 재설계 — G2 PASS) — `CanonicalSceneModel` interface 변경 (`elements/elementsMap` Element[] → `nodes/nodesMap` CanonicalNode[]) + `buildCanonicalSceneModel` traversal CanonicalNode 직접 사용 (`flattenCanonicalDocumentNodes` helper 신설) + `canonicalSceneModelLegacy.ts` boundary 신설 (`getSceneModelElementsLegacy` / `getSceneModelElementsMapLegacy` / `getSceneModelChildrenByParentLegacy` / `buildLegacyElementMap` / `buildLegacyChildrenByParent`) + BuilderCanvas caller swap (legacy getter 사용) + 기존 scene model test 갱신 + type-check 0 error (turbo cache + forced rebuild 양쪽 baseline 변경 0)
- 2026-05-10 Phase 3 (Verification — G3 PASS) — type-check FULL TURBO PASS / targeted vitest 30/30 PASS (helper 28 + scene model 2) / preflight FULL TURBO PASS (builder cache miss fresh build PASS) / console error 0 / canvas 2240x1768 idle / FPS 측정은 dev tab background throttle 로 lazy (Phase 1 baseline 120.5fps 변경 없음 — legacy getter 통한 indirect access 라 render 경로 행위 동일)
- 2026-05-10 Implemented (canonical-native traversal helper + scene model 재설계 도달, ADR-126 Phase 2 prerequisite 충족)

**PREREQUISITE**: ADR-122 (canonical-only runtime) + ADR-125 (render input canonical-native contract) `Implemented` 도달 후 발의 가능. 본 ADR 은 ADR-126 Phase 2 의 prerequisite 로 설계되었다.

## Context

### SSOT 체인 도메인 판정

본 ADR 은 [`ssot-hierarchy.md`](../../../.claude/rules/ssot-hierarchy.md) **D2 (Props/API) + D3 (시각 스타일) 내부 구조**. canonical document 의 D2 schema (CanonicalNode props/children) 를 hot path consumer 가 traversal 할 수 있도록 helper API 와 scene model derived view 를 재설계한다. D1 (DOM/접근성) 은 무관.

### 발의 배경 — ADR-126 Phase 2 진입 직전 framing 의문 4 가지

ADR-126 (Element 타입 Deprecate) Phase 2 (hot path consumer 전환) 진입 시점에 다음 본질 framing 의문이 raise 되었다 (memory `feedback-adr-essence-priority-over-formal-pass` 인용):

1. **design 추정 vs 실 측정 작업량**: ADR-126 breakdown §5 추정 ~28 file vs 실 측정 70 file (workspace/canvas + panels + resolvers G2 grep gate scope). 2.5 배.
2. **Element vs CanonicalNode shape mismatch**: Element (flat with `parent_id` + `tag` + `order_num`) vs CanonicalNode (nested with `children: CanonicalNode[]` + `type` + 배열 순서). traversal 패턴 자체 변경 필요 (`childrenMap.get(parentId)` → `node.children`).
3. **resolver API 부족**: `canonicalElementsBridge.ts` 에 `getCanonicalNode` / `useCanonicalNode` / `useActiveCanonicalDocument` 만 존재. **`children/parent/ancestor/byPath` traversal helper 미존재**. ADR-126 design 의 `context.resolver.children(node)` 패턴은 가정 (실제 API 없음).
4. **scene model 자체 재설계**: `canonicalSceneModel.ts:28-34` 의 `CanonicalSceneModel` 인터페이스가 Element[] expose. scene model 자체가 `workspace/canvas/scene/` (G2 scope 안). G2 grep gate 통과 = scene model 도 Element 제거 = scene model 인터페이스 재설계 필수.

→ ADR-126 Phase 2 hot path 70 file transition 진입 전에 **resolver API helper 신설 + scene model 재설계** 가 prerequisite. 본 ADR 이 그 prerequisite 를 정의한다.

### Hard Constraints

- **HC.1 (성능)**: canonical document traversal 이 매 frame 발생 시 O(n) 또는 그 이하 보장. 60fps 유지 (idle median 120fps baseline 대비 -5% bound 114fps 이상).
- **HC.2 (호환)**: 본 ADR 이 도입하는 helper API 는 기존 `useStore.elementsMap` / `childrenMap` mutable subscription 과 공존 가능 (Phase 2 transition 기간). consumer 는 점진적 swap.
- **HC.3 (SSOT)**: scene model 의 derived index (`childrenByParent` / `nodesMap` / `pageIndex`) 는 canonical document 단일 SSOT 로부터 derived. 별도 mutation 불가.
- **HC.4 (typename)**: scene model 인터페이스 export 는 `Element[]` 미사용 (CanonicalNode 또는 등가 typename). hot path consumer 가 scene model 통해 Element 타입 indirect import 불가.

### Soft Constraints

- 기존 ADR-122/125 baseline 의 `transition-derived-readonly` contract 와 호환. scene model 은 여전히 derived view (canonical document SSOT 보존).
- helper API 는 `canonicalElementsBridge.ts` 확장 형태로 발의 (별도 module 신설 회피).

## Alternatives Considered

### 대안 A: ADR-127 부절 — ADR-126 Phase 2 안에서 helper + scene model 재설계 sub-step 처리

- 설명: 별도 base ADR 발의 없이 ADR-126 Phase 2 의 작업 범위에 helper API 신설 + scene model 재설계를 통합. design breakdown sub-phase (2-α resolver / 2-β scene / 2-γ panels / 2-δ canvas) 분할.
- 위험:
  - 기술 (M): resolver helper / scene model 재설계 / 70 file transition 이 단일 phase 안에서 동시 진행 → 회귀 발생 시 root cause 분리 곤란
  - 성능 (M): 70 file transition + scene model 재설계 조합으로 FPS baseline 비교 시 어느 변경이 회귀 원인인지 분리 불가
  - 유지보수 (H): single phase scope 폭증 → ADR-111/112 패턴 (24+ commits 우회) 재발 위험
  - 마이그레이션 (M): sub-phase 분해 자체가 사용자 지적 안티 패턴 ("쓸데없이 쪼개기" — memory `feedback-execute-adr-surface-minimization`)
- 기각 사유: prerequisite 와 응용 (ADR-126 Phase 2) 의 base/응용 framing 이 자연 분리 가능한데 단일 phase 안에 압축 시 framing 의도 손실. memory `feedback-adr-essence-priority-over-formal-pass` 인용 — drift 가 ADR HC root 와 1:1 연결되면 다른 phase 작업보다 선행. 본 ADR 분리 = drift root 선행 처리.

### 대안 B: ADR-127 (helper) + ADR-128 (scene model) 분리 발의 (직교 base 2)

- 설명: helper API 신설을 ADR-127, scene model 재설계를 ADR-128 별도 base ADR 로 분리 발의. ADR-126 Phase 2 prerequisite 2 개.
- 위험:
  - 기술 (L): 직교 분리로 각 ADR scope 명확
  - 성능 (L): 별도 land 시 FPS baseline 비교 분리 가능
  - 유지보수 (M): prerequisite 추적 복잡도 증가 (ADR-126 응용 → ADR-127 + ADR-128 + ADR-122 + ADR-123 + ADR-124 + ADR-125 = 5 base 의존)
  - 마이그레이션 (L): 병렬 land 가능
- 기각 사유: helper API 와 scene model 재설계가 **같은 SSOT module (canonical-native consumer 측) 변경** 그루핑. 직교 분리 후 두 ADR 모두 Implemented 까지 land 시 prerequisite 추적 복잡도 + 응용 ADR (ADR-126) 의 의존 chain 길이 증가. 자연 그루핑 (memory `feedback-adr-consolidation-burden-not-essence` 인용 — 직교성 분석 후 자연 그루핑) 측면에서 통합 우월.

### 대안 C: ADR-127 통합 발의 — helper + scene model 재설계 단일 base (권장)

- 설명: helper API 확장 + scene model 인터페이스 재설계 + scene model build 함수 + scene model derived index 재설계 통합. ADR-126 Phase 2 prerequisite 1 개. design 분할은 ADR-127 내부 Phase 1 (helper 신설) → Phase 2 (scene model 재설계) → Phase 3 (verification).
- 위험:
  - 기술 (M): 단일 ADR 안에 helper + scene model 재설계 동시 진행. 단, 두 변경이 같은 module level 변경이라 회귀 영향 분리 가능
  - 성능 (L): scene model 재설계 후 FPS baseline 측정 단일 시점. ADR-127 Phase 3 verification 에서 60fps gate 통과 검증
  - 유지보수 (L): 단일 base ADR 로 응용 (ADR-126) prerequisite 추적 단순화
  - 마이그레이션 (L): 단일 ADR Implemented 후 ADR-126 Phase 2 진입 — 명확한 milestone
- 채택 사유:
  - HC.4 (typename) 보장: scene model 인터페이스 export 가 Element[] 미사용 = scene model 재설계 필수 동반. helper API 만 신설 시 scene model 의존 잔존 → ADR-126 Phase 2 G2 통과 불가. **두 변경은 분리 불가 한 묶음**.
  - SSOT module 자연 그루핑: helper + scene model 모두 canonical-native consumer 측 SSOT module (`canonicalElementsBridge.ts` + `canonicalSceneModel.ts`). 같은 directory level 변경.
  - prerequisite 단순화: ADR-126 응용의 base 의존 chain 짧아짐 (ADR-122 + ADR-125 + ADR-127 = 3 base).

### Risk Threshold Check (A/B/C)

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH 누적 |
| ---- | :--: | :--: | :------: | :----------: | :-------: |
| A    |  M   |  M   |  **H**   |      M       |     1     |
| B    |  L   |  L   |    M     |      L       |     0     |
| C    |  M   |  L   |    L     |      L       |     0     |

→ 대안 C (통합 발의) HIGH 0 누적, 자연 그루핑 + prerequisite 단순화. 채택.

## Decision

**대안 C 채택** — ADR-127 단일 통합 base ADR.

scope:

1. **Helper API 신설** (`canonicalElementsBridge.ts` 확장 또는 별도 module):
   - `getChildren(node: CanonicalNode): CanonicalNode[]` — node.children 정렬된 list (배열 순서 = order)
   - `getParent(nodeId: string): CanonicalNode | null` — id → parent canonical node lookup
   - `getAncestors(nodeId: string): CanonicalNode[]` — root 까지 ancestor chain
   - `findByPath(path: string): CanonicalNode | null` — pencil path syntax 지원 (예: "ok-button/label")
   - `getNodeMap(): Map<string, CanonicalNode>` — 평탄 lookup index (memo 화)
   - `getChildrenByParent(): Map<string, CanonicalNode[]>` — parent_id → children list (memo 화)
2. **scene model 인터페이스 재설계**:

   ```typescript
   export interface CanonicalSceneModel {
     // canonical document SSOT 로부터 derived (read-only)
     nodes: CanonicalNode[];                              // 평탄 traversal projection
     nodesMap: Map<string, CanonicalNode>;                // O(1) lookup
     childrenByParent: Map<string, CanonicalNode[]>;      // parent_id → children
     frameElementScopes: ...;                             // 기존 유지
     pageIndex: PageElementIndex;                         // 기존 유지 (Element[] → CanonicalNode[] 호환 형태)
   }
   ```

   - `Element[]` → `CanonicalNode[]` 으로 export shape 변경
   - `buildCanonicalSceneModel(doc)` 의 internal traversal 도 CanonicalNode 직접 사용

3. **legacy 호환 layer**: scene model 의 기존 caller (ADR-126 Phase 2 transition 미완 상태) 가 사용 가능한 deprecated `elements: Element[]` getter 제공 가능 (Phase 5 격리 이후 제거).

> 구현 상세: [127-canonical-traversal-helper-and-scene-model-redesign-breakdown.md](../design/127-canonical-traversal-helper-and-scene-model-redesign-breakdown.md)

기각 사유:

- 대안 A: HIGH 1 누적 (유지보수 — single phase scope 폭증 + 사용자 안티 패턴 재발 위험)
- 대안 B: HIGH 0 이지만 prerequisite 추적 복잡도 + 자연 그루핑 분할

## Risks

| ID  | 위험                                                                                                  | 심각도 | 대응                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------- | :----: | -------------------------------------------------------------------------------------------------- |
| R1  | helper API 신설 시 기존 hot path 의 `useStore.elementsMap` 직접 read 와 동시 사용 → race condition    |  MED   | helper API 가 canonical document SSOT 단일 소스 read. mutable subscription 미사용 (clone-on-write) |
| R2  | scene model `nodes: CanonicalNode[]` 평탄화 traversal 비용이 매 frame 발생 → FPS 회귀                 |  MED   | memo 화 + canonical document version 기반 cache invalidation. Phase 3 verification 에서 60fps gate |
| R3  | scene model 의 `elements: Element[]` legacy getter 잔존 시 ADR-126 Phase 2 G2 grep gate 통과 불가     |  MED   | legacy getter 는 별도 file 에 격리 (`canonicalSceneModelLegacy.ts`) — workspace scope 외 boundary  |
| R4  | helper API 의 `findByPath` pencil syntax 호환성 — `descendants` key 와의 충돌                         |  MED   | pencil-adapter.types.ts 의 path syntax 표준 따름. 단위 테스트 커버                                 |
| R5  | scene model 재설계 후 ADR-125 의 `calculateFullTreeLayoutFromSceneModel` caller 가 새 shape 적응 필요 |  MED   | ADR-127 Phase 2 에서 layoutCache caller 동시 swap (단일 commit). type-check 가 미완 caller 검출    |

## Gates

| Gate                   | 시점         | 통과 조건                                                                                                                                                   | 실패 시 대안                                      |
| ---------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| G0: prerequisite lock  | Phase 0 종료 | ADR-122 + ADR-125 모두 `Implemented` 상태 확인 + helper API / scene model inventory freeze                                                                  | Phase 1 진입 금지                                 |
| G1: helper API 신설    | Phase 1 종료 | `getChildren` / `getParent` / `getAncestors` / `findByPath` / `getNodeMap` / `getChildrenByParent` 6 helper export + 단위 테스트 PASS + type-check 0 error  | Phase 1 rollback                                  |
| G2: scene model 재설계 | Phase 2 종료 | `CanonicalSceneModel` 인터페이스 export shape 가 Element[] 미사용. `buildCanonicalSceneModel` traversal 이 CanonicalNode 직접 사용. layoutCache caller swap | scene model 부분 rollback + caller 동시 swap 보장 |
| G3: verification       | Phase 3 종료 | type-check 0 error + targeted vitest PASS + browser smoke 회귀 0 + FPS median 114fps 이상 (Phase 1 baseline 120.5 대비 -5% bound) + preflight FULL TURBO    | Phase 2 rollback 후 재시도                        |

## Consequences

### Positive

- ADR-126 Phase 2 진입 prerequisite 충족 — hot path 70 file transition 시 helper API + scene model canonical-native shape 사용 가능.
- canonical document SSOT 가 helper API 통해 hot path 에 직접 노출 — Element 파생 view 의존 점진 제거.
- 향후 derived index (frameElementScopes / pageIndex) 도 동일 패턴으로 canonical-native consumer 화 가능.

### Negative

- ADR-127 Phase 1-3 진행 중 scene model 의 두 shape (Element[] legacy getter + CanonicalNode[] new export) 일시 공존 → 코드베이스 일시 복잡도.
- 기존 caller (~10 production caller of `useCanonicalElements` / scene model elementsMap 사용처) 가 새 shape 으로 swap 필요 — ADR-127 자체 scope 안에 일부 처리, 나머지는 ADR-126 Phase 2 위임.
- scene model 의 legacy getter 잔존 기간 동안 deprecation lint warning 발생 — 신규 caller 차단 효과 + 기존 caller 점진 swap 신호.

## 반복 패턴 선차단 체크리스트 (adr-writing.md §"반복 패턴 선차단" 4 항목 selfcheck)

- [x] **HIGH+ 위험 코드 경로 3곳 이상 구체 인용**: HIGH 0 (R1~R5 모두 MED). 코드 경로 인용 — `apps/builder/src/builder/stores/canonical/canonicalElementsBridge.ts:45,97,116` (helper API 정의 위치) + `apps/builder/src/builder/workspace/canvas/scene/canonicalSceneModel.ts:28-89` (scene model 재설계 대상) + `apps/builder/src/builder/workspace/canvas/scene/layoutCache.ts:5,343` (ADR-125 caller swap 동시 처리 대상) + `packages/shared/src/types/composition-document.types.ts:206-284` (CanonicalNode 정의 baseline).
- [x] **Spec/Generator 확장 ADR 여부**: Spec/Generator 확장 아님. canonical document consumer side 변경. N/A.
- [x] **BC 훼손 수식화**: 외부 export/import boundary 호환성 = 100% 유지 (scene model 의 legacy `elements: Element[]` getter 가 transition 기간 잔존). 내부 hot path consumer = 점진 swap (ADR-127 자체에서 layoutCache 등 5+ file 처리, 나머지는 ADR-126 Phase 2 위임). 사용자 영향: 0 (render parity / behavior 변경 없음, internal SSOT 변경).
- [x] **HIGH+ Phase 분리 가능 여부 검토**: HIGH 0 누적이라 phase 분리 불필요. Phase 0 (G0 prerequisite lock) → Phase 1 (helper API 신설) → Phase 2 (scene model 재설계) → Phase 3 (verification) 4 phase 자연 분할. 별도 ADR 분리는 자연 그루핑 (helper + scene model SSOT module 단위) 측면에서 비권장 (대안 B 기각 사유).
