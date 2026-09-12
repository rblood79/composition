# P3-A 진입 회귀 위험 평가 (static analysis)

> HEAD: `56819009` — 정적 분석 only, 코드 수정 없음
> 기준: ADR-903 Phase 3-A §2.1 + Phase 3-B §2.2 breakdown

---

## Group 1: layout_id ownership 처리

### elementCreation.ts (7 ref, `apps/builder/src/builder/stores/utils/elementCreation.ts`)

#### A. 현재 동작

**책임**: `addElement` / `addComplexElement` 두 action factory.

**Invariant 보존 경로**:

1. `normalizeElementTagInElement` 호출 후 `normalizeExternalFillIngress` 적용
2. `childrenMap` 기반 atomic `order_num` 할당 — `set()` 내부에서 prevState 기반 계산 (race-condition 방지)
3. **히스토리 기록 조건 (line 71)**: `state.currentPageId || elementToAdd.layout_id` — 둘 중 하나가 있을 때만 historyManager에 기록
4. `_rebuildIndexes()` 호출로 `elementsMap` / `childrenMap` 갱신
5. IndexedDB 저장 시 `sanitizeElement(elementToAdd)` 경유 — `layout_id` 필드 명시 포함
6. **order_num 재정렬 분기 (line 98-123)**:
   - `page_id === currentPageId` → `reorderElements(elements, currentPageId, ...)`
   - `elementToAdd.layout_id` 있음 → `elementsMap.forEach`로 layout elements 스캔 후 `reorderElements(elements, layout_id, ...)`

**기대 input**: `Element` 객체에 `page_id` XOR `layout_id` 중 하나 설정
**기대 output**: 메모리 + IndexedDB 동기화, 히스토리 기록

#### B. P3-B 진입 시 깨질 가능성

**시나리오 B1** — ownership marker 제거 후 히스토리 누락:

- P3-B 작업 §4: "`elementCreation.ts` 의 `{ page_id, layout_id }` ownership 주입 제거"
- 현재 히스토리 조건 `state.currentPageId || elementToAdd.layout_id` 에서 `layout_id` 제거 시, layout 편집 모드에서 `currentPageId`가 null인 상태로 element 추가 → **히스토리 미기록** → Undo 불가
- **사용자 가시 증상**: Layout 편집 모드에서 추가한 element가 Undo 목록에 없음

**시나리오 B2** — order_num 재정렬 경로 소실:

- line 105 `else if (elementToAdd.layout_id)` 분기 제거 시 Layout 요소의 order_num 재정렬 미실행
- IndexedDB에 중복 `order_num` 저장 → 다음 세션 로드 시 element 순서 오염
- **사용자 가시 증상**: 레이아웃 내 element 순서가 새로고침 후 뒤바뀜 (데이터 손실 아니지만 UX 파괴)

**시나리오 B3** — `elementsMap.forEach` 기반 layout 필터 잔존:

- P3-B에서 layout 전용 인덱스가 canonical document tree로 이동한 후, `elementsMap.forEach`로 `layout_id`를 필터하는 코드가 남아 있으면 O(N) 순회 지속 (성능 문제)
- canonical 전환 후에는 `el.layout_id === elementToAdd.layout_id` 조건이 `undefined === undefined` = true로 오판 → 전체 elements가 재정렬 대상에 포함될 수 있음

#### C. 차단 권고

1. **P3-A 안전망**: `elementCreation.ts`에 dev-only assert 추가:
   ```ts
   if (import.meta.env.DEV) {
     const hasOwnership = !!element.page_id || !!element.layout_id;
     console.assert(
       hasOwnership,
       "[elementCreation] ownership marker 없는 element 추가:",
       element,
     );
   }
   ```
2. **P3-B 진입 시 필수 회귀 테스트**:
   - `layout_id` 없이 element 추가 시 canonical parent 기반 히스토리 기록되는지 확인
   - order_num 재정렬이 canonical tree context로 동작하는지 unit test

#### D. 잠재 hidden bug

**버그 D1** — `addComplexElement`의 히스토리 기록 (line 186):

```ts
if (state.currentPageId || parentToAdd.layout_id) {
  historyManager.addEntry({ ... childElements: normalizedChildren.map(...) });
}
```

`state`는 `createAddComplexElementAction` 호출 시점의 **스냅샷** (line 142: `const state = get()`). 이후 `set()`으로 메모리가 변경된 후에도 `state` 변수는 구버전 참조. P3-B와 무관하게 **현재 코드에서 stale closure 위험**: 히스토리 기록 시 `state.currentPageId`가 다른 페이지 값일 수 있음. (단, 일반적으로 element 추가와 페이지 전환이 동시에 일어나지 않아 실제 증상 미관측 — 잠재 버그)

---

### elementSanitizer.ts (6 ref, `apps/builder/src/builder/stores/utils/elementSanitizer.ts`)

#### A. 현재 동작

**책임**: Element 객체를 직렬화 안전한 형태로 변환. 두 함수:

- `sanitizeElement(element)` — postMessage/IndexedDB용 순수 직렬화 (structuredClone 우선)
- `sanitizeElementForCloud(element)` — snake_case 변환 포함 Cloud용

**Invariant 보존**:

- `layout_id` 필드를 명시적으로 전달 (`element.layout_id` 그대로)
- fallback (structuredClone 불가) 시 `layout_id || null` 처리

**실패 시 증상**:

- `sanitizeElement`가 `layout_id`를 누락하면 IndexedDB에 `layout_id: undefined` 저장 → 재로드 시 null로 처리 → element가 어떤 layout에도 속하지 않는 orphan 상태

#### B. P3-B 진입 시 깨질 가능성

**시나리오 B4** — layout_id 제거 후 직렬화 불일치:

- P3-B에서 `layout_id` 필드 제거 시, `sanitizeElement`의 명시적 `layout_id: element.layout_id` 라인이 그대로 남으면 canonical 구조에 없는 필드를 직렬화에 포함 → **타입 오류 + 런타임 경고**
- 반대로 제거했는데 IndexedDB 스키마가 아직 `layout_id` 컬럼을 기대하면 쓰기 실패

**시나리오 B5** — CloudElement 타입 불일치 (line 7-17):

```ts
export interface CloudElement {
  layout_id?: string | null;
  page_id: string; // ← required, null 불허
}
```

현재 `page_id`가 `required` 타입인데 layout element는 `page_id: null`. `sanitizeElementForCloud`의 line 97: `page_id: element.page_id ?? ""` 로 빈 문자열 fallback → **DB에 page_id=""인 layout elements 존재 가능** (현재 코드에서 이미 잠재된 문제).

#### C. 차단 권고

1. **P3-A 안전망**: `sanitizeElement`에 dev-only 경고 추가:
   ```ts
   if (import.meta.env.DEV && !element.page_id && !element.layout_id) {
     console.warn(
       "[sanitizeElement] page_id/layout_id 없음 — canonical parent 의존 element?",
       element.id,
     );
   }
   ```
2. **P3-B 진입 전 필수 체크**: `CloudElement.page_id` 타입을 `string | null`로 수정 (현재 `string` required) — P3-B 진입 전 타입 수정 없이 시작하면 `sanitizeElementForCloud` 타입 에러 발생

#### D. 잠재 hidden bug

**버그 D2** — `CloudElement.page_id` required 타입 vs 런타임 null:

- 타입 정의 `page_id: string` (required)
- 실제 layout elements는 `page_id: null`
- `sanitizeElementForCloud` line 97: `page_id: element.page_id ?? ""` 로 빈 문자열 emit
- Cloud/IndexedDB에서 `page_id = ""` 로 조회하면 매칭 실패 → 현재 코드에서 잠재된 데이터 정합성 버그

---

### DisplayComponents.ts (factory 패턴 샘플, `apps/builder/src/builder/factories/definitions/DisplayComponents.ts`)

#### A. 현재 동작

**책임**: 컴포넌트 별 Element/children 생성 정의.

**Invariant (모든 10개 factory에 반복)**:

```ts
const ownerFields = layoutId
  ? { page_id: null, layout_id: layoutId }
  : { page_id: pageId, layout_id: null };
```

- `layoutId`가 truthy이면 layout 소속 (page_id=null)
- `pageId`가 있으면 page 소속 (layout_id=null)
- mutual-exclusive ownership이 factory 단위에서 명시적으로 결정됨

**실패 시 증상**: ownership이 틀리면 element가 잘못된 페이지/레이아웃으로 로드됨

#### B. P3-B 진입 시 깨질 가능성

**시나리오 B6** — factory ownership 제거 + IndexedDB 저장 데이터 호환성:

- P3-D breakdown §1에서 factory의 `ownerFields` 를 제거하고 `const element = baseElement`로 전환 예정
- **기존 사용자의 IndexedDB에는 `layout_id`가 있는 element들이 존재**
- `legacyOwnershipToCanonicalParent()` adapter 미완성 상태로 P3-D 진입 시 기존 데이터 로드 파이프라인 (`getByLayout(layoutId)`, `getByPage(pageId)`)이 canonical 구조에서 어떤 element를 반환해야 하는지 불명확
- **데이터 손실 가능성 있음**: `getByLayout` 쿼리가 존재하지 않는 canonical path로 이동하면 layout elements 로드 누락 → 사용자 layout이 빈 화면으로 보임

**시나리오 B7** — children의 ownerFields 전파:

- `createAvatarGroupDefinition` 같은 composite factory에서 children도 `...ownerFields`를 spread
- P3-B/D에서 parent의 ownership 제거 시 children도 동시에 제거해야 함 — 10개 factory 파일 전수 누락 가능성

#### C. 차단 권고

1. **P3-A 안전망**: factory `context` 타입에 `@deprecated layoutId?: string` 마크
2. **P3-B 진입 전 필수**: `adapters/canonical/slotAndLayoutAdapter.ts`에 `legacyOwnershipToCanonicalParent(element: Element): CanonicalParentRef` 구현 완료 후 factory 변경

---

## Group 2: currentLayoutId selector

### layoutActions.ts (21 ref, `apps/builder/src/builder/stores/utils/layoutActions.ts`)

#### A. 현재 동작

**핵심 함수들**:

1. `createFetchLayoutsAction` — `layouts[]` 로드 + `currentLayoutId` 자동 선택
   - **Invariant**: `isCurrentLayoutValid` 검증 → invalid/없으면 `defaultLayout?.id` 자동 선택
   - 자동 선택 기준: `order_num === 0` 우선, 없으면 첫 번째

2. `createCreateLayoutAction` — layout 생성 + body element 동시 생성
   - `page_id: null`, `layout_id: newLayout.id` 로 body element 생성
   - `mergeElements([bodyElement])` 로 elements store 동기화

3. `createDeleteLayoutAction` — layout 삭제 cascade
   - 사용 중인 pages의 `layout_id = null` 설정
   - 해당 layout의 모든 elements 삭제
   - `currentLayoutId === id` 이면 선택 해제

4. `createDuplicateLayoutAction` — layout + elements 복제
   - `idMap` 기반 부모-자식 ID 재매핑 (`parent_id: el.parent_id ? idMap.get(el.parent_id) || null : null`)
   - `page_id: null` 강제

5. `createGetLayoutSlotsAction` — Slot elements 필터
   - `el.layout_id === layoutId && el.tag === "Slot"` 기반 조회 (O(N) elements 스캔)

#### B. P3-B 진입 시 깨질 가능성

**시나리오 B8** — `currentLayoutId` → `selectedReusableFrameId` rename 후 참조 불일치:

- P3-B 작업 §2에서 `currentLayoutId` selector → `selectedReusableFrameId` rename
- `BuilderCore.tsx:273`(`useLayoutsStore.getState().currentLayoutId`), `useIframeMessenger.ts:196`(동일)이 각각 직접 참조 중
- **2개 파일이 P3-B 동시 업데이트 안 되면**: buildtime 타입 에러 (TypeScript가 잡음) — 단, `getState().currentLayoutId as any` 패턴 있으면 런타임까지 숨겨질 수 있음

**시나리오 B9** — `createGetLayoutSlotsAction`의 O(N) 스캔 + canonical 전환:

- 현재 `elements.filter(el => el.layout_id === layoutId && el.tag === "Slot")` → O(N)
- P3-B에서 `layouts[]` store가 canonical document tree로 흡수되면 이 함수의 입력 `getElements`가 canonical resolved tree를 반환해야 함 — 기존 `layout_id` 필드 없는 canonical element에서 필터 조건이 항상 false → **Slot 정보 조회 0건 반환**
- **사용자 가시 증상**: Layout에 Slot이 있어도 Panel에서 0개로 표시, Page-Layout 연결 UI 파괴

**시나리오 B10** — `createDeleteLayoutAction`의 cascade 안전성:

- 삭제 시 `db.pages.getAll()` 전체 조회 + `allElements = await db.elements.getAll()` 전체 조회
- P3-B 후 canonical tree에서는 `getAll()` API가 canonical format을 반환해야 하는데, 이때 `el.layout_id === id` 필터가 동작하지 않으면 **layout elements 미삭제** (dangling data)
- 반대로 canonical tree에서 layout 삭제 cascade가 propagate되면 연결 pages의 content가 의도치 않게 삭제될 수 있음

#### C. 차단 권고

1. **P3-A 안전망**: `currentLayoutId` 접근 시 dev-only 경고:
   ```ts
   // useLayoutsStore.getState().currentLayoutId 모든 호출 사이트에
   if (import.meta.env.DEV) {
     console.warn(
       "[P3 migration] currentLayoutId 직접 참조 — selectCurrentReusableFrameId 전환 대상",
     );
   }
   ```
2. **P3-B 회귀 테스트 필수**: layout 삭제 후 연관 elements가 canonical tree에서 올바르게 정리되는지 확인

#### D. 잠재 hidden bug

**버그 D3** — `createDuplicateLayoutAction`의 부모 ID 재매핑 불완전:

- line 274: `parent_id: el.parent_id ? idMap.get(el.parent_id) || null : null`
- `idMap.get(el.parent_id)` 가 `undefined` 이면 `|| null` fallback → parent_id=null (고아 element)
- 원본 layout에 다단계 부모-자식 구조가 있으면 **중간 레벨 parent가 idMap에 없는 경우 발생 가능** (forEach에서 모든 el.id를 idMap에 미리 등록하므로 일반적으로 안전하나, DB fetch 순서 의존)

---

### layouts.ts (18 ref, `apps/builder/src/builder/stores/layouts.ts`)

#### A. 현재 동작

- `useLayoutsStore` — Zustand persist store, `currentLayoutId`만 localStorage 유지
- `layouts[]` 배열은 session 시작 시 `fetchLayouts()` 로 IndexedDB에서 로드
- `useCurrentLayout()`, `useLayouts()` 편의 selector 제공

**Invariant**: `persist` middleware가 `currentLayoutId`를 `"composition-layouts"` key로 저장 → 페이지 새로고침 후 복원

#### B. P3-B 진입 시 깨질 가능성

**시나리오 B11** — localStorage `persist` 잔존:

- P3-B에서 `useLayoutsStore` 를 adapter-only로 축소 시, `persist` middleware의 `"composition-layouts"` key가 localStorage에 남아 있음
- canonical 전환 후 새 `selectedReusableFrameId`는 다른 persist key를 사용 → **새로고침 후 layout 선택 초기화** (UX regression)

**시나리오 B12** — `useCurrentLayout()` consumer 가 P3-B 후 stale:

- `BuilderCanvas.tsx:191`: `const layouts = useLayoutsStore((state) => state.layouts)` — 구독자
- P3-B에서 `layouts[]` 가 read-through adapter로만 남으면 `useLayoutsStore((state) => state.layouts)` 가 항상 `[]`를 반환 → **BuilderCanvas에서 layouts 배열 사용 경로 파괴**

#### C. 차단 권고

1. **P3-A에서 localStorage key migration 계획** 확정: `"composition-layouts"` → `"composition-reusable-frames"` 전환 타이밍 결정
2. **P3-B 회귀 테스트**: 새로고침 후 `selectedReusableFrameId` 복원 확인

---

## Group 3: 외부 결합

### BuilderCore.tsx (11 ref)

#### A. 현재 동작

**layout_id 결합점 (line 272-297)**:

```ts
const editMode = useEditModeStore.getState().mode;
const currentLayoutId = useLayoutsStore.getState().currentLayoutId;
if (editMode === "layout" && currentLayoutId) {
  const layoutElements = await db.elements.getByLayout(currentLayoutId);
  // ... merge with elements store
}
```

- 초기화 시 editMode='layout'이면 layout elements를 IndexedDB에서 로드
- **Invariant**: `db.elements.getByLayout(layoutId)` API 존재 + layout_id 기반 IndexedDB 쿼리 동작

**또 다른 결합점 (line 451-470)**:

```ts
const currentLayoutId = useLayoutsStore.getState().currentLayoutId;
if (editMode === "layout" && currentLayoutId) {
  filteredElements = state.elements.filter(
    (el) => el.layout_id === currentLayoutId,
  );
}
```

- 편집 모드에 따라 iframe에 전송할 elements 필터링
- `el.layout_id` 기반 필터 → P3-D 이후 동작 안 함

#### B. P3-B/D 진입 시 깨질 가능성

**시나리오 B13** — `db.elements.getByLayout()` API 소멸:

- P3-E에서 IndexedDB schema의 `layout_id` 컬럼 제거 → `getByLayout()` API 삭제
- **P3-B 단계에서도** BuilderCore 초기화 코드가 `getByLayout()` 호출 — P3-B+E 간 간격이 길면 런타임 오류
- **사용자 가시 증상**: 새로고침 후 layout 편집 모드에서 elements가 로드되지 않음 (빈 캔버스)

**시나리오 B14** — elements 필터링 경로 동시 변경 필요:

- BuilderCore line 451-470 와 `useIframeMessenger.ts:196-209`가 모두 동일한 `layout_id` 기반 필터 사용
- 두 파일이 동시에 canonical 경로로 전환되지 않으면 **iframe이 잘못된 elements 집합 수신** → Preview 렌더 오염

#### C. 차단 권고

1. **P3-A dev-only logging**: `BuilderCore.tsx`의 `editMode === 'layout'` 분기에 migration 경고 주석 추가
2. **P3-B 전 gate 확인**: `db.elements.getByLayout()` API 를 P3-B에서 바로 제거하지 말 것 — P3-E까지 유지

---

### useIframeMessenger.ts (10 ref)

#### A. 현재 동작

**layout_id 결합점 (line 196-209)**:

```ts
const layoutStoreLayoutId = useLayoutsStore.getState().currentLayoutId;
const pageInfo =
  currentEditMode === "layout"
    ? { pageId: null, layoutId: layoutStoreLayoutId }
    : { pageId: currentPageId, layoutId: currentPage?.layout_id || null };
```

- `UPDATE_ELEMENTS` postMessage payload에 `pageInfo.layoutId` 포함 → Preview가 layout 렌더에 사용
- `UPDATE_PAGE_INFO` 에도 `currentPage?.layout_id` 포함 (line 897)

**Invariant**: Preview의 `layoutResolver.ts`가 이 `layoutId`를 받아 `resolveLayoutForPage()` 호출

#### B. P3-B/D 진입 시 깨질 가능성

**시나리오 B15** — postMessage schema 버전 불일치:

- P3-D에서 `postMessage`의 `layoutId` 필드 → canonical reusable frame id로 변경 예정
- Builder/Preview 동시 배포 안 되면: Builder는 canonical id 전송, Preview는 legacy layoutId 처리 → **Preview 렌더 파괴**
- ADR-903 breakdown §2.4 mitigation에 "postMessage version 필드 도입"이 명시되어 있으나 **P3-A에서 version 필드 스텁이 없으면 P3-D 단계에서 급조 필요**

**시나리오 B16** — `sendLayoutsToIframe` (line 75 타입) 경로:

- `useIframeMessenger` 반환 타입에 `sendLayoutsToIframe: () => void` 존재
- P3-B에서 `layouts[]` store가 canonical adapter로만 남으면 이 함수가 반환하는 layouts 데이터 포맷이 달라짐 → Preview layout rendering path 파괴

#### C. 차단 권고

1. **P3-A에서 postMessage version 필드 스텁 추가**: `{ type: "UPDATE_ELEMENTS", version: "legacy-1.0", ... }` — P3-D에서 `"canonical-1.0"`으로 전환 시 Preview가 version 기반 분기 가능

---

### usePageManager.ts (10 ref)

#### A. 현재 동작

**layout_id 결합점**:

1. `fetchElements` (line 200-214): `currentPage?.layout_id` 있으면 `db.elements.getByLayout(layout_id)` 추가 로드
2. `addPage` (line 274): `layout_id: null` 기본값
3. `addPageWithParams` (line 354, 375-403): `layout_id: layoutId` 저장 + `layoutId` 있으면 다른 초기화 경로 (elements 없이 page만 생성)
4. `initializeProject` (line 473-527): 모든 pages의 `layout_id` 수집 → `getByLayout()` 일괄 로드

**핵심 Invariant**: 프로젝트 초기화 시 page의 `layout_id`를 통해 관련 layout elements를 한 번에 로드. Layout elements가 없으면 preview에서 layout shell이 비어 보임.

#### B. P3-B/D 진입 시 깨질 가능성

**시나리오 B17** — `initializeProject`의 layout 로딩 전략 완전 교체 필요:

- line 513-527: `layoutIds` 배열 수집 → `getByLayout()` 루프 실행 — **P3-D에서 가장 많은 수정 필요**
- canonical 전환 후에는 document tree의 reusable frame 노드를 통해 elements를 로드해야 함
- **미완성 상태로 P3-D 진입 시**: 프로젝트 초기화 시 layout elements 로드 누락 → **모든 layout-linked pages가 layout shell 없이 렌더됨** (사용자 데이터 손실 아니지만 렌더 완전 파괴)

**시나리오 B18** — `addPageWithParams` 분기 (`layoutId` 있을 때):

- line 394-404: layoutId 있으면 `appendPageShell` 없이 `setCurrentPageId` + `fetchElements` 직접 호출
- P3-D 이후 이 분기가 canonical frame ref 기반으로 바뀌어야 하는데, 미변경 시 새 page에 layout frame ref가 연결되지 않음

#### C. 차단 권고

1. **P3-A에서 `initializeProject`의 layout loading 경로를 `// TODO(P3-D): canonical reusable frame 로딩으로 전환` 주석 마킹**
2. **P3-D 진입 전 필수 회귀 테스트**: `initializeProject` 후 layout-linked page의 elements 수 검증

#### D. 잠재 hidden bug

**버그 D4** — `fetchElements`의 layout element 중복 방지 로직 (line 207-213):

```ts
const existingIds = new Set(allElements.map((el) => el.id));
layoutElements.forEach((el) => {
  if (!existingIds.has(el.id)) allElements.push(el);
});
```

여기서 `allElements`는 `[...elementsData]` 복사본이고 `existingIds`는 그 시점의 스냅샷. 하지만 `mergedMap`으로 elements store와 merge 시 (line 218-221):

```ts
elements.forEach((el) => mergedMap.set(el.id, el));
allElements.forEach((el) => mergedMap.set(el.id, el));
```

**스토어의 기존 elements가 allElements보다 우선 삽입 후 allElements로 덮어씌워짐** — layout elements가 스토어의 최신 버전을 덮어쓸 수 있음. 일반적으로 layout elements는 불변이므로 문제 없지만, 편집 중 저장 + 동시 페이지 전환 시 race condition 가능성.

---

## 종합 권고

### P3-A 단계 안전망 7개 추가 권고

1. `elementCreation.ts`: ownership marker 존재 여부 dev-only assert
2. `elementSanitizer.ts`: `page_id/layout_id` 미설정 element dev-only 경고
3. `elementCreation.ts`: layout 편집 히스토리 기록 조건 주석 강화 (`// TODO(P3-B): layout_id 제거 시 canonical context로 대체 필수`)
4. `useIframeMessenger.ts`: `UPDATE_ELEMENTS` postMessage에 `version: "legacy-1.0"` 스텁 추가
5. `layoutActions.ts`: `currentLayoutId` 직접 접근 사이트에 dev-only migration 경고 logging
6. `CloudElement.page_id` 타입을 `string | null`로 수정 (현재 required → P3-B 전 타입 오류 예방)
7. `usePageManager.ts:initializeProject` layout loading 경로에 `// TODO(P3-D)` 마킹

### P3-B 진입 전 필수 회귀 테스트 7케이스

1. **Layout 편집 히스토리**: `layout_id` 없는 element 추가 후 Undo 가능한지 확인
2. **layout Slot 조회**: `getLayoutSlotsAction`이 canonical tree에서 올바른 Slot 수 반환하는지 확인
3. **fetchLayouts + currentLayoutId 복원**: 새로고침 후 `selectedReusableFrameId` 유지 확인
4. **삭제 cascade**: layout 삭제 후 연관 page의 layout 참조 + layout elements 모두 정리 확인
5. **initializeProject + layout 로딩**: 프로젝트 초기화 시 layout-linked pages의 elements 완전 로드 확인
6. **BuilderCore elements 필터**: `editMode='layout'` 시 iframe에 올바른 elements 집합 전송 확인
7. **postMessage schema 버전**: Preview가 `version:"legacy-1.0"` payload를 올바르게 처리하는지 확인

### HIGH+ 위험 회귀 포인트 5개 발견

| # | 위치 | 시나리오 | 심각도 | 증상 |
| --- | ----------------------------------------------------------- | ---------------------------------------------- | :----: | ------------------------------------ | ---- | --------------------- |
| 1 | `elementCreation.ts:71` | B1: 히스토리 조건 `                            |        | layout_id` 제거 | HIGH | Layout 편집 Undo 불가 |
| 2 | `layoutActions.ts:createGetLayoutSlotsAction` | B9: canonical tree에서 Slot 조회 0건 | HIGH | Layout-Page 연결 UI 파괴 |
| 3 | `usePageManager.ts:initializeProject:513-527` | B17: layout elements 로딩 경로 전체 교체 | HIGH | 프로젝트 초기화 시 layout shell 소실 |
| 4 | `useIframeMessenger.ts:196-209` + `BuilderCore.tsx:451-470` | B14/B15: 동시 미전환 시 iframe 잘못된 elements | HIGH | Preview 렌더 오염 |
| 5 | `elementSanitizer.ts:page_id required` | D2: layout element에 `page_id=""` 저장 | MEDIUM | DB 정합성 (현재 잠재) |

### 사용자 데이터 손실 가능성 있는 시나리오

**P3-D 진입 시**: `legacyOwnershipToCanonicalParent()` adapter 미완성 상태에서 factory ownership 제거 시, 기존 IndexedDB의 `layout_id` 기반 elements가 `getByLayout()` 쿼리 소멸 후 고아 데이터로 남을 수 있음 (읽기 불가 = 사실상 손실).

**mitigation 요건**: P3-A에서 `legacyLayoutToCanonicalFrame()` adapter 구현 + P3-D 진입 전 `legacyOwnershipToCanonicalParent()` 완성이 **필수 precondition**. P3-D breakdown §mitigation에 명시되어 있으나 P3-A Gate G3-A 조건(§2.1)에는 포함되지 않음 — **G3-A 통과 조건에 adapter 완성도 체크 추가 권고**.

### 권고하는 Phased rollout 전략

**P3-A (지금)**: types + adapter foundation 추가만. 기존 결합 사이트에 `// TODO(P3-B/D)` dev 마킹 + dev-only ownership assert. 기존 코드 동작 변경 없음.

**P3-B 진입 조건 (추가 권고)**:

- G3-A 통과 조건에 `legacyOwnershipToCanonicalParent()` 구현 완성 포함
- `CloudElement.page_id: string | null` 타입 수정 선행
- localStorage `"composition-layouts"` persist key migration 계획 확정

**P3-D 진입 조건 (existing + 추가)**:

- P2 옵션 C 완료 (G2=0) — 이미 명시
- **추가**: `db.elements.getByLayout()` adapter shim 존재 확인
- **추가**: postMessage `version` 필드 Preview 처리 코드 동시 배포 계획 확인

### 발견한 잠재 hidden bug (P3 무관, 현재 코드)

| ID | 위치 | 설명 | 심각도 |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------------------ | :----: | ----------------------------------------------------- | --- |
| D1 | `elementCreation.ts:142 + 186` | `addComplexElement`의 `state` stale closure — get() 후 set() 사이 페이지 전환 시 히스토리 context 오판 | LOW |
| D2 | `elementSanitizer.ts:97` | layout elements에 `page_id: ""` 저장 — `CloudElement.page_id` required 타입 vs null 런타임 | MEDIUM |
| D3 | `layoutActions.ts:274` | `duplicateLayout`에서 `idMap.get(parent_id)                                                            |        | null` — 3단계 이상 중첩 시 parent_id 재매핑 실패 가능 | LOW |
| D4 | `usePageManager.ts:218-221` | `fetchElements`에서 `elementsMap` 덮어쓰기 순서 — store 최신 elements보다 layout elements 우선 | LOW |
