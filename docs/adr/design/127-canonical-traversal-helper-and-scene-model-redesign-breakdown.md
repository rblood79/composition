# ADR-127 구현 상세 — Canonical-native traversal helper + scene model 재설계

본 문서는 [ADR-127](../127-canonical-traversal-helper-and-scene-model-redesign.md) 의 Phase 계획, inventory 분류, Gate 측정 방법을 정의한다.

**진입 조건**: ADR-122 + ADR-125 모두 `Implemented` 후 Phase 1 이상 착수 가능. Phase 0 (inventory freeze) 은 선행 수행 가능.

---

## 1. Fork Checkpoint (ADR-writing.md §ADR Fork / 분리 결정 시)

| 질문                           | 판정                                                                                                                                                                                                                                                                                          |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| base / 응용 분류               | ADR-127 은 **base ADR** (추상). canonical-native traversal helper API + scene model 재설계 = canonical document consumer side 의 SSOT module 변경. 응용 = ADR-126 Phase 2 (hot path 70 file transition).                                                                                      |
| schema 직교성                  | helper API (`canonicalElementsBridge.ts` 확장) 와 scene model 재설계 (`canonicalSceneModel.ts` 인터페이스 변경) 는 같은 SSOT module level 변경. 직교 분리 가능 (대안 B) 했으나 자연 그루핑 (canonical-native consumer 측 module) + prerequisite 추적 단순화 측면에서 통합 발의 (대안 C) 채택. |
| baseline framing reverse 검증  | ADR-122 + ADR-125 baseline 의 의존 방향 (canonical document SSOT → derived view consumer) 그대로 승계. ADR-127 은 derived view 의 consumer side API 확장 + scene model export shape 정렬. **방향 reverse 없음** (ADR-122/125 → ADR-127 → ADR-126 Phase 2 일관 방향).                          |
| codex 1차 진입 전 framing 통과 | 4 질문 답변이 ADR 본문 §Context §Decision 에 lock-in 됨. ADR-126 Phase 2 진입 직전 raise 된 framing 의문 4 가지가 본 ADR 의 발의 motivation. sub-phase 분해 전 사용자 confirm 획득 (대안 C 통합 발의 — 사용자 답변 "a 를 하라는거 아닌가" 동의).                                              |

---

## 2. Target State

| Layer              | Target                                                                                                              | 금지                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| helper API         | `canonicalElementsBridge.ts` 확장 — children/parent/ancestor/byPath/nodeMap/childrenByParent 6 helper export        | `Element` 타입 의존 (모든 helper signature 가 `CanonicalNode` 만 사용)             |
| scene model export | `CanonicalSceneModel` 인터페이스가 `nodes: CanonicalNode[]` + `nodesMap: Map<string, CanonicalNode>` + 기타 derived | `elements: Element[]` direct export (legacy getter 는 별도 module 격리 — boundary) |
| scene model build  | `buildCanonicalSceneModel(doc)` 가 CanonicalNode 직접 traversal — Element[] projection 미생성                       | canonical document → Element[] projection → CanonicalNode[] 이중 변환              |
| scene model caller | `layoutCache.ts:343` 등 5+ caller 가 새 shape 소비 (단일 commit transition)                                         | scene model 재설계 후 caller 미swap 잔존 (type-check 가 검출)                      |
| legacy getter      | scene model 의 `elements: Element[]` getter 는 별도 file (`canonicalSceneModelLegacy.ts`) 에 격리 — boundary 처리   | workspace scope 안의 file 에서 `Element[]` direct property 노출                    |

---

## 3. Phase 0 — Inventory Freeze

**목표**: helper API 신설 대상 + scene model 재설계 영향 범위 + 기존 caller 위치를 freeze.

### Measurement command seed

```bash
# helper API 사용처 (현재 존재하는 hook + getter)
rg -n "useCanonicalNode\(|getCanonicalNode\(|useActiveCanonicalDocument\(" \
  apps/builder/src \
  --include="*.ts" --include="*.tsx" \
  | grep -v "test\|spec\|__tests__"

# scene model 호출 chain
rg -n "buildCanonicalSceneModel\(|CanonicalSceneModel\b" \
  apps/builder/src \
  --include="*.ts" --include="*.tsx" \
  | grep -v "test\|spec\|__tests__"

# scene model elements 필드 read (legacy getter 격리 대상)
rg -n "scene\.elements\b|sceneModel\.elements\b|\.elements\.length" \
  apps/builder/src/builder/workspace \
  --include="*.ts" --include="*.tsx" \
  | grep -v "test\|spec\|__tests__"

# scene model elementsMap 필드 read (lookup 용도)
rg -n "scene\.elementsMap\b|sceneModel\.elementsMap\b" \
  apps/builder/src/builder/workspace \
  --include="*.ts" --include="*.tsx" \
  | grep -v "test\|spec\|__tests__"
```

### Bucket 정의

| Bucket            | 의미                                                                       | Phase                    |
| ----------------- | -------------------------------------------------------------------------- | ------------------------ |
| `helper-define`   | `canonicalElementsBridge.ts` 의 helper API 정의 위치                       | Phase 1 신설             |
| `scene-define`    | `canonicalSceneModel.ts` 인터페이스 + build 함수 정의 위치                 | Phase 2 재설계           |
| `scene-caller`    | scene model 의 `elements` / `elementsMap` / `childrenByParent` 사용 caller | Phase 2 caller swap 동반 |
| `legacy-boundary` | legacy `elements: Element[]` getter 의존 file (transition 기간 잔존 허용)  | Phase 2 별도 module 격리 |
| `test-doc`        | tests, fixtures, docs                                                      | Phase 3 정렬             |

### Phase 0 Gate (G0)

ADR-122, ADR-125 status 확인:

```bash
grep -A2 "^## Status" \
  docs/adr/122-*.md docs/adr/125-*.md \
  docs/adr/completed/122-*.md docs/adr/completed/125-*.md \
  2>/dev/null
```

두 ADR 중 하나라도 `Implemented` 아니면 Phase 1 진입 금지.

---

## 4. Phase 1 — Helper API 신설

**목표**: `canonicalElementsBridge.ts` 또는 별도 module (`canonicalTraversalHelpers.ts`) 에 6 helper API 신설 + 단위 테스트.

### 작업

1. **module 위치 결정**: `canonicalElementsBridge.ts` 확장 vs 별도 file. 권장: `apps/builder/src/builder/stores/canonical/canonicalTraversalHelpers.ts` 신설 (single responsibility — bridge 는 store subscribe, helpers 는 traversal).
2. **6 helper signature**:

   ```typescript
   // children — node.children 정렬된 list (배열 순서 = order)
   export function getChildren(node: CanonicalNode): CanonicalNode[];

   // parent — id → parent canonical node lookup (active document 기준)
   export function getParent(nodeId: string): CanonicalNode | null;

   // ancestors — root 까지 ancestor chain (root 가 마지막)
   export function getAncestors(nodeId: string): CanonicalNode[];

   // findByPath — pencil path syntax ("ok-button/label") 지원
   export function findByPath(path: string): CanonicalNode | null;

   // nodeMap — 평탄 lookup index (memo 화)
   export function getNodeMap(): Map<string, CanonicalNode>;

   // childrenByParent — parent_id → children list (memo 화)
   export function getChildrenByParent(): Map<string, CanonicalNode[]>;
   ```

3. **memo 전략**: canonical document version 기반 cache invalidation. `useCanonicalDocumentStore.subscribe` listener 로 version 증가 시 cache flush.
4. **test 커버**:
   - unit test: `getChildren` / `getParent` / `getAncestors` / `findByPath` 6 helper 각 fixture 기반
   - integration test: canonical document mutation → cache invalidation → fresh result
   - perf test: nodeMap rebuild O(n) 검증

### Phase 1 Gate (G1)

| 검증 항목           | 명령                                                                                                          | 통과 기준 |
| ------------------- | ------------------------------------------------------------------------------------------------------------- | --------- |
| helper API 6 export | `rg "^export function (getChildren\|getParent\|getAncestors\|findByPath\|getNodeMap\|getChildrenByParent)\("` | 6 hit     |
| 단위 테스트         | `pnpm -F @composition/builder exec vitest run src/builder/stores/canonical`                                   | PASS      |
| type-check          | `pnpm type-check`                                                                                             | 0 error   |

---

## 5. Phase 2 — Scene model 재설계

**목표**: `canonicalSceneModel.ts` 인터페이스를 CanonicalNode 기반으로 재설계 + caller swap 동반 (단일 commit).

### 작업

1. **인터페이스 변경**:

   ```typescript
   // Before (ADR-125 transition contract)
   export interface CanonicalSceneModel {
     childrenByParent: Map<string, Element[]>;
     elements: Element[];
     elementsMap: Map<string, Element>;
     frameElementScopes: ...;
     pageIndex: PageElementIndex;
   }

   // After (ADR-127 canonical-native)
   export interface CanonicalSceneModel {
     childrenByParent: Map<string, CanonicalNode[]>;
     nodes: CanonicalNode[];
     nodesMap: Map<string, CanonicalNode>;
     frameElementScopes: ...;
     pageIndex: PageElementIndex; // 내부 형태가 CanonicalNode 호환되게 변경
   }
   ```

2. **build 함수 변경**:
   ```typescript
   export function buildCanonicalSceneModel(doc: CompositionDocument): CanonicalSceneModel {
     const nodes: CanonicalNode[] = [];
     const nodesMap = new Map<string, CanonicalNode>();
     const childrenByParent = new Map<string, CanonicalNode[]>();
     visitCanonicalDocumentNodes(doc, (node, parentId) => {
       nodes.push(node);
       nodesMap.set(node.id, node);
       if (parentId) {
         const list = childrenByParent.get(parentId);
         if (list) list.push(node);
         else childrenByParent.set(parentId, [node]);
       }
     });
     return { nodes, nodesMap, childrenByParent, frameElementScopes: ..., pageIndex: ... };
   }
   ```
3. **caller swap (단일 commit 동반)**:
   - `layoutCache.ts:343` — scene model `elementsMap` → `nodesMap` 사용. 단, ADR-125 의 `calculateFullTreeLayoutFromSceneModel` 가 Element 기반 layout 입력을 기대 → 호환성 결정 필요 (대안: layoutCache 가 nodesMap → elementsMap projection 단계 추가, ADR-127 Phase 2 안에서 처리)
   - 기타 scene model caller (5+ file)
4. **legacy getter 격리**:
   - `apps/builder/src/builder/stores/canonical/canonicalSceneModelLegacy.ts` 신설 (boundary 위치 — workspace scope 외)
   - `getSceneModelElementsLegacy(scene): Element[]` deprecated getter export
   - 기존 `scene.elements` 사용처가 transition 기간 동안 본 helper 경유 (ADR-126 Phase 2 에서 swap 후 Phase 5 격리 시 제거)

### Phase 2 Gate (G2)

| 검증 항목                                         | 명령                                                                                        | 통과 기준              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------- |
| scene model 인터페이스 export 가 Element[] 미사용 | `rg ": Element\[\]" apps/builder/src/builder/workspace/canvas/scene/canonicalSceneModel.ts` | 0 hit                  |
| scene model build 함수가 CanonicalNode 직접 사용  | `rg "Element" apps/builder/src/builder/workspace/canvas/scene/canonicalSceneModel.ts`       | 0 hit (보조 변수 포함) |
| layoutCache caller swap                           | type-check 0 error + targeted vitest layoutCache PASS                                       | PASS                   |
| legacy getter 격리                                | `rg ": Element\[\]" apps/builder/src/builder/workspace/canvas/scene` (legacy file 외)       | 0 hit                  |

---

## 6. Phase 3 — Verification

**목표**: ADR-127 G3 통과 + ADR-126 Phase 2 진입 가능 상태 확증.

### 작업

1. type-check 0 error
2. targeted vitest PASS (canonicalElementsBridge, canonicalSceneModel, layoutCache 영역)
3. browser smoke (create/edit/delete/undo/redo/reorder/refresh) 회귀 0
4. FPS 실측 — Phase 1 baseline (median 120.5fps idle) 대비 -5% bound 114fps 이상
5. preflight FULL TURBO PASS

### Phase 3 Gate (G3)

| 검증 항목       | 통과 기준                                                  |
| --------------- | ---------------------------------------------------------- |
| type-check      | 0 error                                                    |
| targeted vitest | PASS                                                       |
| browser smoke   | 회귀 0                                                     |
| FPS             | median 114fps 이상 (Phase 1 baseline 120.5 대비 -5% bound) |
| preflight       | FULL TURBO PASS                                            |

---

## 7. Phase Plan 요약

| Phase   | 목표               | 주요 산출물                                                                  | Gate | 진입 조건                     |
| ------- | ------------------ | ---------------------------------------------------------------------------- | ---- | ----------------------------- |
| Phase 0 | Inventory freeze   | helper API 사용처 / scene model caller / legacy getter 의존 enumerate        | G0   | 없음 (즉시 수행 가능)         |
| Phase 1 | Helper API 신설    | 6 helper export + 단위 테스트                                                | G1   | ADR-122 + ADR-125 Implemented |
| Phase 2 | Scene model 재설계 | CanonicalSceneModel 인터페이스 변경 + build 함수 + caller swap + legacy 격리 | G2   | G1 PASS                       |
| Phase 3 | Verification       | type-check + vitest + smoke + FPS + preflight                                | G3   | G2 PASS                       |

---

## 8. 관련 파일 (Phase 0 seed — 실 코드 기준 재측정 필요)

### helper-define bucket

- `apps/builder/src/builder/stores/canonical/canonicalElementsBridge.ts` (확장)
- `apps/builder/src/builder/stores/canonical/canonicalTraversalHelpers.ts` (신설 권장)

### scene-define bucket

- `apps/builder/src/builder/workspace/canvas/scene/canonicalSceneModel.ts` (재설계)
- `apps/builder/src/builder/workspace/canvas/scene/index.ts` (export)

### scene-caller bucket (Phase 2 동반 swap)

- `apps/builder/src/builder/workspace/canvas/scene/layoutCache.ts:5,343`
- `apps/builder/src/builder/workspace/canvas/scene/buildSceneSnapshot.ts`
- `apps/builder/src/builder/workspace/canvas/scene/buildSceneIndex.ts`
- `apps/builder/src/builder/workspace/canvas/scene/buildSelectionSnapshot.ts`
- 기타 5+ file (Phase 0 inventory freeze 시 재측정)

### legacy-boundary bucket (신설)

- `apps/builder/src/builder/stores/canonical/canonicalSceneModelLegacy.ts` (신설 — boundary)

### CanonicalNode 정의 (baseline)

- `packages/shared/src/types/composition-document.types.ts:206-284`

---

## 9. 공존 기간 상한

ADR-127 Phase 1 착수 시점 기준 **30일** 내 Phase 3 완결 목표. 30일 초과 시 잔존 caller 를 ADR 본문 residual 로 기록하고 별도 cleanup ADR 발의.
