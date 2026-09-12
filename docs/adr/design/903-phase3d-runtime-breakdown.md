# ADR-903 Phase 3-D — Runtime canonical document synchronization

> ADR-903 Phase 3 P3-D sub-breakdown 설계문서.
> 부모 문서: [ADR-903 기본](../completed/903-ref-descendants-slot-composition-format-migration-plan.md),
> P3 통합: [903-phase3-frameset-breakdown.md](903-phase3-frameset-breakdown.md)
> 사전결정: [903-phase3-decisions.md](903-phase3-decisions.md)

**HEAD**: `56819009` | **상태**: Design Phase (P3-A~C 완료 시 진입) | **추정 시간**: ~20h | **위험**: CRITICAL

---

## 1. 목적 + Hard Constraints

### 1.1 P3-D의 핵심 책임

P3-A (Types + Adapter foundation) 과 P3-B/C (Stores 해체 + UI 재설계) 가 canonical document 구조와 타입을 정의한 후, P3-D는 **runtime 에서 element/page/layout write/update/delete 시 canonical document 와 legacy elements/pages/layouts 의 양방향 동기화를 완성**한다.

즉:

- 사용자가 element 추가/수정/삭제 → factory 또는 action 함수 호출
- 함수 내부에서 canonical document 부모 참조 확인 (`legacyOwnershipToCanonicalParent()`)
- 변환된 부모 id 기반 metatdata 업데이트 + history 기록 + persistence 호출
- IndexedDB 저장 시 canonical format 또는 legacy adapter 자동 선택

### 1.2 Hard Constraints

1. **`legacyOwnershipToCanonicalParent()` 경유 100%**
   - write path (element add/update/delete) 가 **항상** 이 함수를 호출하여 부모 ownership 확인
   - orphan element (부모 미파악) 는 undo 또는 경고 처리

2. **`selectedReusableFrameId` / `currentLayoutId` 양방향 동기화**
   - P3-B 에서 `currentLayoutId` → `selectedReusableFrameId` rename (canonical document 내 reusable frame id)
   - store selector 변경 시 localStorage persist key 도 동시 migration (`"composition-layouts"` → `"composition-reusable-frames"`)

3. **canonical document version 자동 증가**
   - element write 시마다 `doc.version` 을 update — resolver cache invalidation 트리거
   - version scheme: `"composition-1.0"` → minor bump only (breaking changes 미포함)

4. **Type-check + unit + integration test 전수 PASS**
   - TypeScript `--strict` mode 통과
   - factory write 경로 unit test (ownership 변환 검증)
   - preview 렌더 등가성 integration test (P2 옵션 C 와 합류)
   - Sub-Gate G3-D: 측정 = 0 (legacy layout_id 참조 제거)

5. **Sub-Gate G3-A precondition 충족**
   - P3-A 단계에서 `legacyOwnershipToCanonicalParent()` 구현 완료 + test PASS 필수
   - P3-D 진입 시 이 함수가 stable API 로 사용 가능한 상태임을 확인

---

## 2. Write/Update/Delete Path 인벤토리

### 2.1 Factory definitions (10 files, 124 ref)

**위치**: `apps/builder/src/builder/factories/definitions/*.ts`

**현재 패턴**:

```ts
const ownerFields = layoutId
  ? { page_id: null, layout_id: layoutId }
  : { page_id: pageId, layout_id: null };
const element = { ...baseElement, ...ownerFields };
```

**P3-D 변환**:

```ts
// ownership marker 제거 — 부모 노드가 document tree 에서 결정
const element = baseElement; // page_id, layout_id 필드 없음
// 대신 call-site 에서 parentId 명시적으로 제공
// Example: addElement(element, { parentId: canonicalParentId })
```

**영향 파일**:

- DisplayComponents.ts (19 ref)
- ButtonComponents.ts
- FormComponents.ts
- LayoutComponents.ts
- MediaComponents.ts
- GridComponents.ts
- TableComponents.ts
- TabsComponents.ts
- TypographyComponents.ts
- MiscComponents.ts

**변환 전략**:

1. factory function signature 에 `parentId?: string` 파라미터 추가 (또는 context 객체에 포함)
2. `ownerFields` spread 제거
3. factory 호출 사이트 (elementCreation.ts:createAddElementAction) 에서 `parentId` 를 canonical tree 에서 조회하여 전달
4. Unit test: ownership 제거 후 element 생성 → history 기록 + IndexedDB 저장 동작 확인

**위험도**: HIGH (factory 는 모든 element 생성의 진입점. 누락 시 orphan element 생성)

---

### 2.2 Element store — createAddElementAction + createAddComplexElementAction (7 ref)

**위치**: `apps/builder/src/builder/stores/utils/elementCreation.ts:32~180`

**현재 로직**:

```ts
// line 71: 히스토리 조건
if (state.currentPageId || elementToAdd.layout_id) {
  historyManager.addEntry({...});
}

// line 105-125: layout_id 기반 order_num 재정렬
else if (elementToAdd.layout_id) {
  queueMicrotask(() => {
    elementsMap.forEach((el) => {
      if (el.layout_id === elementToAdd.layout_id) hasLayoutElements = true;
    });
    if (hasLayoutElements) {
      reorderElements(elements, elementToAdd.layout_id!, ...);
    }
  });
}
```

**P3-D 변환**:

```ts
// 1. ownership 제거 후 히스토리 조건 교체
// Before: state.currentPageId || elementToAdd.layout_id
// After: 부모 노드가 canonical tree 에서 page 인지 reusable frame 인지 확인
const parentNode = doc.children.find(n => n.id === element.parent_id);
const isPageContext = parentNode?.metadata?.type === "page";
const isReusableContext = parentNode?.reusable === true;
if (isPageContext || isReusableContext) {
  historyManager.addEntry({...});
}

// 2. order_num 재정렬: layout_id → reusable frame id
// Before: elementsMap.forEach로 layout_id 필터
// After: canonical document 내 reusable frame children 조회
const reusableParent = ...; // canonicalDocument에서 reusable frame lookup
if (reusableParent?.type === "frame" && reusableParent.reusable) {
  const siblingOrderNums = reusableParent.children
    ?.map(c => c.order_num || 0) || [];
  elementToAdd.order_num = Math.max(...siblingOrderNums) + 1;
}
```

**영향 범위**:

- `historyManager.addEntry` 조건 변경 → P3-B 이후 canonical context 기반
- `reorderElements()` 호출 경로 축소 (layout elements 인덱스 제거)
- `set((prevState) => {...})` 내부 atomic order_num 할당 로직 유지

**변환 전략**:

1. P3-A: ownership marker 존재 여부 dev-only assert 추가
   ```ts
   if (import.meta.env.DEV && !element.page_id && !element.layout_id) {
     console.warn("[elementCreation] ownership 없음", element);
   }
   ```
2. P3-B: canonical document 에서 parent node lookup 로직 추가 (adapter 경유)
3. P3-D: 위 2개 조건 (`state.currentPageId || elementToAdd.layout_id`) 를 canonical context 로 치환
4. Unit test:
   - layout 편집 모드 → 히스토리 기록 확인
   - reusable frame 내 element 추가 → order_num 재정렬 확인

**위험도**: HIGH (히스토리 손실 → Undo 불가)

---

### 2.3 Layout actions (21 ref)

**위치**: `apps/builder/src/builder/stores/utils/layoutActions.ts:54~403`

**현재 함수들**:

- `createFetchLayoutsAction` — layouts[] 로드 + currentLayoutId auto-select
- `createCreateLayoutAction` — layout + body element 동시 생성
- `createDeleteLayoutAction` — layout cascade delete
- `createDuplicateLayoutAction` — layout + elements 복제
- `createGetLayoutSlotsAction` — `el.layout_id === id && el.tag === "Slot"` 필터

**P3-D 전환**:

- `currentLayoutId` → canonical document 의 selected reusable frame id (`selectedReusableFrameId`)
- `createLayout` → canonical document 에 신규 `reusable: true` frame 추가 (store 로직이 아니라 **document tree 뮤테이션**)
- `createGetLayoutSlotsAction` → reusable frame 의 slot metadata 직접 조회 (elementsMap.forEach 제거)

**구체 예시**:

Before:

```ts
// createGetLayoutSlotsAction (line 340-355)
const slots = elements.filter(
  (el) => el.layout_id === layoutId && el.tag === "Slot",
);
```

After:

```ts
// P3-D: canonical document 기반
const reusableFrame = canonicalDoc.children.find(
  (n) => n.type === "frame" && n.reusable && n.id === selectedReusableFrameId,
);
const slots = reusableFrame?.slot || []; // slot metadata 직접 사용
```

**영향 범위**:

- `layouts[]` store 에서 canonical document 로의 read-through adapter 활용
- `currentLayoutId` selector 모든 호출 사이트 (18 파일) 동시 rename
- localStorage persist key migration

**변환 전략**:

1. P3-A: `currentLayoutId` 접근 시 dev-only migration 경고
2. P3-B: `useLayoutsStore` 의 `currentLayoutId` → `selectedReusableFrameId` rename (adapter 유지)
3. P3-D:
   - `createCreateLayoutAction` → `createReusableFrameNode()` adapter 함수 호출로 대체
   - `createDeleteLayoutAction` → document tree 의 reusable frame 노드 제거 + cascade
   - `createGetLayoutSlotsAction` → slot metadata 직접 조회

**위험도**: HIGH (layout-page sync 깨짐, Page-Layout 연결 UI 파괴)

---

### 2.4 Hooks — usePageManager.ts + useIframeMessenger.ts (28 ref)

**위치**:

- `apps/builder/src/builder/hooks/usePageManager.ts:473~527` (initializeProject)
- `apps/builder/src/builder/hooks/useIframeMessenger.ts:196~210`

#### usePageManager.initializeProject

**현재 로직 (line 513-527)**:

```ts
const layoutIds = new Set<string>();
pages.forEach((p) => {
  if (p.layout_id) layoutIds.add(p.layout_id);
});
for (const layoutId of layoutIds) {
  const layoutElements = await db.elements.getByLayout(layoutId);
  allElements.push(...layoutElements);
}
```

**P3-D 전환**:

```ts
// 1. canonical document 로드 (adapter 경유)
const canonicalDoc = loadCanonicalDocument(projectId);

// 2. reusable frame 노드 발견 → 해당 children 수집
const reusableFrames = selectCanonicalReusableFrames(canonicalDoc);
for (const frame of reusableFrames) {
  const frameElements = collectElementsFromNode(frame, ...);
  allElements.push(...frameElements);
}

// 3. page 노드 처리
// - type: "ref" → ref: "layout-*" 또는 해당 reusable frame 참조
// - type: "frame" + metadata.type: "page" → standalone page
const pageElements = collectPageElements(canonicalDoc, ...);
allElements.push(...pageElements);
```

**P3-D TODO 마킹**:

```ts
// 현재 코드 (line 473)
// TODO(P3-D): canonical document load 로 전환 예정.
// → P3-D 진입 시 제거하고 위 코드로 치환
```

#### useIframeMessenger.UPDATE_ELEMENTS postMessage

**현재 스키마 (line 196-209)**:

```ts
const pageInfo =
  currentEditMode === "layout"
    ? { pageId: null, layoutId: useLayoutsStore.getState().currentLayoutId }
    : { pageId: currentPageId, layoutId: currentPage?.layout_id || null };

sendElementsToIframe({
  type: "UPDATE_ELEMENTS",
  elements: filteredElements,
  pageInfo, // ← layoutId 포함
});
```

**P3-D 전환**:

```ts
// 1. version 필드 추가 (P3-A 에서 스텁)
const pageInfo = {
  version: "canonical-1.0", // P3-D: legacy 에서 canonical 로 변경
  pageId: currentPageId || null,
  reusableFrameId: selectedReusableFrameId || null, // layoutId 대신
};

sendElementsToIframe({
  type: "UPDATE_ELEMENTS",
  elements: filteredElements,
  pageInfo,
});
```

**위험도**: CRITICAL

- postMessage schema 변경 → builder + preview **동시 배포 필수**
- version 필드로 호환성 확보 (preview 가 legacy/canonical 구분)

---

### 2.5 BuilderCore.tsx (11 ref)

**위치**: `apps/builder/src/builder/main/BuilderCore.tsx:272~297, 451~470`

#### 초기화 경로 (line 272-297)

**현재**:

```ts
const currentLayoutId = useLayoutsStore.getState().currentLayoutId;
if (editMode === "layout" && currentLayoutId) {
  const layoutElements = await db.elements.getByLayout(currentLayoutId);
  mergeElements([...layoutElements]);
}
```

**P3-D**:

```ts
const selectedReusableFrameId =
  useEditModeStore.getState().selectedReusableFrameId;
if (editMode === "layout" && selectedReusableFrameId) {
  // 1. canonical document 에서 reusable frame lookup
  const frame = canonicalDoc.children.find(
    (n) => n.type === "frame" && n.reusable && n.id === selectedReusableFrameId,
  );

  // 2. frame.children 수집 (adapter 경유 변환)
  const frameElements = frame?.children?.map(canonicalToLegacy) || [];
  mergeElements(frameElements);
}
```

#### 필터링 경로 (line 451-470)

**현재**:

```ts
if (editMode === "layout" && currentLayoutId) {
  filteredElements = state.elements.filter(
    (el) => el.layout_id === currentLayoutId,
  );
}
```

**P3-D**:

```ts
if (editMode === "layout" && selectedReusableFrameId) {
  // canonical document 기반 필터
  filteredElements = state.elements.filter(
    (el) => getCanonicalParentId(el) === selectedReusableFrameId,
  );
}
```

**변환 전략**:

1. P3-A: dev-only migration 경고 주석 추가
2. P3-B: `currentLayoutId` → `selectedReusableFrameId` rename
3. P3-D: 두 경로 모두 canonical context 기반 조회로 교체

**위험도**: HIGH (layout 편집 모드 element 로드 실패)

---

### 2.6 Preview App.tsx + layoutResolver.ts (35 ref)

**위치**:

- `apps/builder/src/preview/App.tsx` (hybrid 12건)
- `apps/builder/src/preview/utils/layoutResolver.ts`

**P2 옵션 C와의 의존성**:

- P2 G2 = 0 (preview/App.tsx 의 layout_id/slot_name 분기 전원 제거) 가 **P3-D 진입 hard precondition**

**P3-D 작업**:

1. `preview/App.tsx`: 12건 hybrid 분기 모두 canonical resolver 로 통합
2. `layoutResolver.ts`: P2 옵션 C 에서 dev compare 로 검증된 canonical resolver 직접 채택
3. postMessage 수신 시 `version: "canonical-1.0"` 처리 (legacy fallback 제거)

---

## 3. Sub-Gate G3-D 정의

```
Sub-Gate G3-D 통과 조건:

(a) write path 100% legacyOwnershipToCanonicalParent 경유
    grep 측정: legacy layout_id ref = 0 (factories, actions, hooks 전수)

(b) selectedReusableFrameId ↔ currentLayoutId 양방향 동기화
    - store selector rename 완료
    - localStorage key migration (`"composition-layouts"` → `"composition-reusable-frames"`)
    - 새로고침 후 선택 상태 복원 확인

(c) canonical document version 자동 증가
    - element write 시마다 doc.version minor bump
    - version scheme: "composition-1.0" (no breaking changes)

(d) type-check PASS (--strict mode, 0 errors)
    - Element.page_id / Element.layout_id 타입 제거 또는 deprecated
    - CloudElement.page_id: string | null (P3-B 에서 수정)

(e) unit test 전수 PASS
    - elementCreation ownership 변환 (6 test cases)
    - layoutActions reusable frame CRUD (4 test cases)
    - usePageManager initializeProject canonical load (3 test cases)
    - useIframeMessenger postMessage version handling (2 test cases)

(f) integration test PASS
    - preview 렌더 등가성 (P2 옵션 C 와 합류)
    - BuilderCore layout 편집 모드 element 로드

(g) grep 측정 = 0
    grep -rnE "layout_id|currentLayoutId|fetchLayouts|createLayout" \
      apps/builder/src/builder/{factories,hooks,preview,main,workspace} \
      --include='*.ts' --include='*.tsx' | wc -l
    → 0 (adapter 제외)
```

---

## 4. Sub-phase 분해 (P3-D-1 ~ P3-D-6)

P3-D 는 규모가 크므로 (CRITICAL 위험, 207 ref, 26 파일) 진행 중 회귀 관리를 위해 6개 sub-phase 로 분해.

### 4.1 P3-D-1: factory ownership 제거 (4h)

**범위**: factories/definitions/ 10 파일 (124 ref)

**작업**:

1. factory 함수 signature 에 `parentId?: string` 파라미터 추가
2. `ownerFields` spread 제거 + element 생성 시 ownership marker 포함 안 함
3. call-site (elementCreation.ts) 에서 parentId 조회 후 전달
4. unit test: 10개 factory → ownership 제거 후 test 3건 각 (30 test cases)

**영향 파일**: DisplayComponents.ts, ButtonComponents.ts, ... (10 파일)

**의존성**: P3-A (adapter), P3-B (canonical context lookup)

**위험도**: HIGH

---

### 4.2 P3-D-2: elementCreation 히스토리 조건 교체 (3h)

**범위**: elementCreation.ts (7 ref)

**작업**:

1. `state.currentPageId || elementToAdd.layout_id` → canonical parent context 기반 조건
2. `reorderElements()` 로직: layout_id → reusable frame id 기반
3. dev-only assert 제거 (P3-A 에서 land 한 것)
4. unit test: 4 test cases (page context, reusable context, orphan, ...)

**의존성**: P3-D-1 (ownership 제거)

**위험도**: HIGH

---

### 4.3 P3-D-3: layoutActions 전환 (4h)

**범위**: layoutActions.ts (21 ref)

**작업**:

1. `currentLayoutId` → canonical document selector (P3-B 에서 완료했으나 내부 로직도 변경)
2. `createGetLayoutSlotsAction` → slot metadata 직접 조회 (elementsMap.forEach 제거)
3. `createDeleteLayoutAction` cascade → reusable frame 제거 로직
4. unit test: 5 test cases (fetch, create, delete, duplicate, getSlots)

**의존성**: P3-B (selectedReusableFrameId selector)

**위험도**: HIGH

---

### 4.4 P3-D-4: usePageManager + useIframeMessenger 동시 교체 (5h)

**범위**: usePageManager.ts:initializeProject + useIframeMessenger.ts:postMessage (18 ref)

**작업**:

1. `initializeProject` layout loading → canonical document lookup (reusable frames 순회)
2. `UPDATE_ELEMENTS` postMessage schema: `layoutId` → `reusableFrameId` + `version: "canonical-1.0"`
3. preview 가 version 기반 분기 (P2 옵션 C 에서 구현)
4. unit test + integration test: 5 test cases

**의존성**: P3-D-2, P3-D-3, P2 옵션 C 완료 (G2=0)

**위험도**: CRITICAL

---

### 4.5 P3-D-5: BuilderCore + workspace canvas (3h)

**범위**: BuilderCore.tsx, workflowEdges.ts, ... (11 ref)

**작업**:

1. 초기화 경로: `db.elements.getByLayout()` → canonical document reusable frame lookup
2. 필터링 경로: `el.layout_id === id` → `getCanonicalParentId(el) === id`
3. workspace canvas 의 layout-aware 분기 제거
4. unit test: 3 test cases

**의존성**: P3-D-4

**위험도**: HIGH

---

### 4.6 P3-D-6: preview 통합 + 최종 grep 측정 (1h)

**범위**: preview/App.tsx, layoutResolver.ts (35 ref)

**작업**:

1. preview/App.tsx 12건 hybrid 분기 모두 canonical resolver 로 통합 (P2 옵션 C 완료 기준)
2. layoutResolver.ts: canonical resolver 직접 채택 (legacy resolver 제거)
3. integration test: parallel-verify skill (P2 옵션 C 와 합류)
4. grep 측정: 0 확인

**의존성**: P2 옵션 C 완료, P3-D-1~5 완료

**위험도**: MEDIUM (P2 옵션 C 와 공동 진행)

---

## 5. 회귀 위험 + 안전망

### 5.1 HIGH 위험 회귀 포인트 5개 (Group 1~2 참조)

| #   | 위치                                     | 시나리오                                          | 심각도 | 안전망                                                      |
| --- | ---------------------------------------- | ------------------------------------------------- | ------ | ----------------------------------------------------------- |
| 1   | elementCreation.ts:71                    | 히스토리 조건 제거 → Undo 불가                    | HIGH   | P3-D-2 unit test (history record 확인)                      |
| 2   | layoutActions:createGetLayoutSlotsAction | canonical tree 에서 Slot 0건 반환                 | HIGH   | P3-D-3 unit test (slot metadata 직접 조회)                  |
| 3   | usePageManager:initializeProject         | layout elements 로드 누락 → blank layout          | HIGH   | P3-D-4 integration test (initProject 후 element count 검증) |
| 4   | useIframeMessenger + BuilderCore         | postMessage schema 불일치 → preview render broken | HIGH   | P3-D-4 dual-deploy + version field                          |
| 5   | factories 10개                           | ownership 제거 누락 → orphan element              | HIGH   | P3-D-1 sweep grep (ownership field 0 남음 확인)             |

### 5.2 안전망 (test + runtime guard) 5+건

1. **P3-A safe guard** (이미 land):

   ```ts
   // elementCreation.ts
   if (import.meta.env.DEV && !element.page_id && !element.layout_id) {
     console.warn("[elementCreation] ownership 없음", element);
   }
   ```

2. **P3-D-1 sweep verification**:

   ```bash
   grep -rnE "ownerFields|{ page_id:|layout_id:" \
     apps/builder/src/builder/factories/ \
     --include='*.ts' | wc -l
   # → 0 확인 (ownership marker 완전 제거)
   ```

3. **P3-D-2 unit test** (6 test cases):
   - page context: addElement → historyManager 호출 확인
   - reusable context: addElement → historyManager 호출 확인
   - orphan: addElement → historyManager 미호출 확인
   - order_num reorder: layout element 추가 → reorderElements 호출 확인
   - ownership 제거 후: element.page_id/layout_id undefined → 경고 미발생

4. **P3-D-4 integration test** (mock preview):
   - postMessage 송수신: version="canonical-1.0" → preview 처리 확인
   - selectedReusableFrameId 변경 → UPDATE_ELEMENTS reusableFrameId 변경 반영
   - initializeProject 후: layout-linked page elements 완전 로드

5. **P3-D-5 BuilderCore test**:
   - layout 편집 모드: element load → elementsMap 채워짐 확인
   - `db.elements.getByLayout()` deprecated warning emit (P3-E 완료 전까지)

6. **P3-D-6 parallel-verify**:
   - preview 렌더 등가성 (P2 옵션 C 와 합류)
   - canonical resolver 출력과 legacy resolver 출력 비교

---

## 6. 의존성 + 후속 phase 연결

### 6.1 P3-B 미완 항목 (#1, #2) 과의 dependency

**P3-B #1**: `currentLayoutId` → `selectedReusableFrameId` rename

- P3-D 는 이 rename 이 완료되어야 진행 가능
- 18 파일 동시 업데이트 필요

**P3-B #2**: localStorage persist key migration

- P3-D-4 단계에서 새로운 persist key 사용 시작
- P3-B 에서 migration 스크립트 추가 (옛날 key → 새 key)

### 6.2 P3-E 진입 조건

P3-D 완료 (G3-D PASS) 후 P3-E 시작:

- IndexedDB schema 의 `layout_id` 컬럼 제거 (P3-D 단계에서 legacy layout API는 남아 있음)
- P3-E 에서 `db.elements.getByLayout()` API 완전 제거 + migration script

### 6.3 P3-F 통합 테스트 시점

P3-D 완료 후 P3-F 단계에서:

- canonical resolver test 전수 PASS
- adapter compat test PASS (legacy → canonical 변환)
- grep 측정 최종 = 0

### 6.4 P4 (Editing Semantics) 의존

- P4-A (detach subtree materialize): P3-D 의 canonical tree mutation API 에 의존
- P4-B (path-based descendants): P3-A 의 `legacyOwnershipToCanonicalParent()` adapter 활용

---

## 7. P3-D 진입 차단 조건 (결정 4)

**결정 4**: P2 옵션 C 완료 (G2=0) + CI Gate 필수

```
P3-D 진입 불가:
- G2 > 0 (preview/App.tsx hybrid 분기 잔존)
- postMessage version 필드 Preview 처리 미완
- selectedReusableFrameId selector 미rename (P3-B 미완)

CI Gate (P3-D PR merge 차단):
grep -rnE "layout_id|currentLayoutId|fetchLayouts|createLayout" \
  apps/builder/src/builder/{factories,hooks,preview,main,workspace} \
  --include='*.ts' --include='*.tsx' | wc -l
→ 0 이어야 merge 가능 (adapter 제외)
```

---

## 요약: 통계 + 시간 추정

| 항목            | 수치                                                                 |
| --------------- | -------------------------------------------------------------------- |
| Sub-phase 개수  | 6 (P3-D-1 ~ P3-D-6)                                                  |
| 총 영향 파일 수 | 26 (factories 10 + actions 6 + hooks 5 + preview 3 + other 2)        |
| 전체 ref 개수   | ~207 (factories 124 + actions 21 + hooks 28 + preview 35 + other 11) |
| 추정 시간       | ~20h (P3-D-1 4h + 2 3h + 3 4h + 4 5h + 5 3h + 6 1h)                  |
| 위험도          | CRITICAL (postMessage schema 변경, 동시 배포 필수)                   |
| 안전망          | test 6+건 + grep 측정                                                |
