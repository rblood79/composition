# ADR-903 P3-D-4 Phase C 정합화 plan

> 부모 문서: [903-phase3d-runtime-breakdown.md](903-phase3d-runtime-breakdown.md)
> ADR 본문: [ADR-903](../completed/903-ref-descendants-slot-composition-format-migration-plan.md)
> 검증 시나리오: [903-p3d4-phase-d-verification.md](903-p3d4-phase-d-verification.md)

---

## Status

Proposed — 2026-04-26

---

## Context

### Phase C minimal stub land 상태

ADR-903 P3-D-4 Phase C (PR #237, commit `5db2c695`) 는 `usePageManager.ts` 의
`initializeProject` 함수 안에서 `selectCanonicalDocument` 를 호출하되
실질적인 **layout-linked elements 추출 로직을 빈 stub** 으로 처리했다.

`usePageManager.ts:516-527` (현재 코드 그대로 인용):

```typescript
// MINIMAL STUB: canonical resolver 호출
// P3-D-1 머지 후 정합화 TODO:
//   canonicalDoc.children(reusable FrameNode) 별 elements 추출로 교체 필요.
//   현재 minimal stub: layout-linked pages elements 누락 회귀 가능성 있음
//   (P3-D-1 머지 후 정합화 — element.layout_id 필드 정합화 선행 필요).
const canonicalDoc = selectCanonicalDocument(
  useStore.getState(),
  storePages,
  useLayoutsStore.getState().layouts,
);
void canonicalDoc; // P3-D-1 후: reusable FrameNode 기반 elements 추출에 사용
const layoutElements: Element[] = [];
```

즉 `canonicalDoc` 을 계산하지만 즉시 `void` 로 버리고, `layoutElements` 는 **빈 배열**
그대로 남는다. 결과적으로 `initializeProject` 가 DB 에서 로딩한 `pageElements` 만 병합하며,
layout(reusable frame) 에 속한 elements 는 초기화 시 누락된다.

### 회귀 패턴

- `903-p3d4-phase-d-verification.md:205` 시나리오 B-1: page 전환 시 일부 element 누락
  → **"Phase C minimal stub 에서 layoutElements 미병합 → page 전환 시 일부 element 누락"**
- `session-2026-04-26-session31-p3d4-phase-c-landed.md:88-92`:
  "Phase C minimal stub 의 layout-linked pages elements 누락 회귀 수정.
  selectCanonicalDocument 결과의 reusable FrameNode 기반 elements 추출 정합화. ~1.5h"

### 선행 조건 (현재 미충족)

stub 주석이 명시하듯이 **P3-D-1 머지가 선행** 되어야 한다.
P3-D-1 은 `element.layout_id` 필드 정합화(factory ownership)를 담당한다.
P3-D-1 미머지 상태에서 본 정합화를 진행하면 `layout_id` 기반 필터가 stale 데이터를
반환하여 오히려 더 깊은 회귀를 야기할 수 있다.

---

## 현재 코드 분석

### 대상 파일

`apps/builder/src/builder/hooks/usePageManager.ts`

### minimal stub 영역 전체 (L500-535)

```typescript
// L507-535: initializeProject 내부 elements 로딩 블록
const pageIdSet = new Set(projectPages.map((p) => p.id));
const allElements = await db.elements.getAll();
const pageElements = allElements.filter(
  (el) => el.page_id && pageIdSet.has(el.page_id),
);

// MINIMAL STUB: canonical resolver 호출             ← L516
const canonicalDoc = selectCanonicalDocument(
  // ← L521
  useStore.getState(),
  storePages,
  useLayoutsStore.getState().layouts,
);
void canonicalDoc; // ← L526 — 결과 폐기
const layoutElements: Element[] = []; // ← L527 — 항상 빈 배열

const mergedMap = new Map<string, Element>(); // ← L529
pageElements.forEach((el) => mergedMap.set(el.id, el));
layoutElements.forEach((el) => mergedMap.set(el.id, el)); // layoutElements = [] → no-op
const rawMerged = Array.from(mergedMap.values());
```

### 정합화 전 fetchElements 의 layout elements 처리 (L200-216)

`fetchElements` (단일 페이지 로딩 경로) 는 이미 `db.elements.getByLayout()` 를
사용하여 layout elements 를 추출하고 있다. 이 패턴이 `initializeProject` (전체 프로젝트
초기화 경로) 에는 적용되어 있지 않다.

```typescript
// fetchElements L200-216: 기존 getByLayout 패턴
if (currentPage?.layout_id) {
  const layoutElements = await db.elements.getByLayout(currentPage.layout_id);
  const existingIds = new Set(allElements.map((el) => el.id));
  layoutElements.forEach((el) => {
    if (!existingIds.has(el.id)) {
      allElements.push(el);
    }
  });
}
```

### 선행 reference: createGetLayoutSlotsAction 의 canonical lookup 패턴

`apps/builder/src/builder/stores/utils/layoutActions.ts:412-437`
에서 이미 `selectCanonicalDocument` 결과를 소비하여 reusable FrameNode 를 탐색하는
패턴이 land 되어 있다 (P3-D-3):

```typescript
const doc = selectCanonicalDocument(elementsState, pages, layouts);
const frame = doc.children.find(
  (n): n is FrameNode =>
    n.type === "frame" && n.reusable === true && n.id === layoutId,
);
```

본 정합화는 이 패턴을 `initializeProject` 에도 적용한다.

---

## 정합화 목표

`initializeProject` 의 `layoutElements` 를 **비지 않도록** 만든다.
구체적으로:

1. `canonicalDoc.children` 에서 `type === "frame" && reusable === true` 인 노드 전체 수집.
2. 각 reusable FrameNode 의 ID 에서 해당 layout 의 elements 를 DB 또는 store 에서 추출.
3. 추출된 elements 를 중복 제거 후 `mergedMap` 에 병합.

이 로직은 P3-D-1 이 land 된 이후 `element.layout_id` 가 올바르게 정합화된 상태를
전제로 동작한다.

---

## Phase 분해

본 작업은 총 **4 step** 으로 분해한다. 각 step 은 독립적으로 `type-check` + `vitest` 가
통과해야 한다.

### Step C-1: helper 함수 추출 (위험 0)

**대상**: `apps/builder/src/builder/hooks/usePageManager.ts` 또는
`apps/builder/src/builder/utils/` 하위 신규 파일.

**내용**: `canonicalDoc` 에서 모든 reusable FrameNode 의 ID 목록을 추출하는 순수 함수
`extractReusableFrameIds(doc: CompositionDocument): string[]` 작성.

```typescript
// 예시 시그니처 (구현 시 실제 타입 맞춤)
export function extractReusableFrameIds(doc: CompositionDocument): string[] {
  return doc.children
    .filter((n): n is FrameNode => n.type === "frame" && n.reusable === true)
    .map((n) => n.id);
}
```

**검증**: unit test 1개 (빈 doc → `[]`, frame 있는 doc → ID 배열 반환).

**회귀 위험**: 없음 — 순수 함수, 기존 코드 미변경.

---

### Step C-2: DB 조회 로직 통합 (낮음)

**대상**: `usePageManager.ts` 의 `initializeProject` 내부.

**내용**: canonical doc 에서 추출한 reusable frame ID 목록으로 DB elements 조회 후
`layoutElements` 배열 채우기.

```typescript
// BEFORE (minimal stub)
void canonicalDoc;
const layoutElements: Element[] = [];

// AFTER (정합화)
const reusableFrameIds = extractReusableFrameIds(canonicalDoc);
const layoutElementsArrays = await Promise.all(
  reusableFrameIds.map((frameId) => {
    // layout id convention: "layout-<uuid>" → uuid 추출 후 DB 조회
    const rawLayoutId = frameId.startsWith("layout-")
      ? frameId.slice("layout-".length)
      : frameId;
    return db.elements.getByLayout(rawLayoutId);
  }),
);
const layoutElements: Element[] = layoutElementsArrays.flat();
```

**검증**: `initializeProject` 호출 후 `useStore.getState().elementsMap` 에
layout elements 포함 확인 (vitest + store mock).

**회귀 위험**: LOW — `db.elements.getByLayout` 은 `fetchElements` 에서 이미 사용 중.
단, layout ID convention (`"layout-<uuid>"`) 이 P3-D-1 이후 변경될 경우 동기화 필요.

---

### Step C-3: 중복 제거 정합화 (낮음)

**대상**: `initializeProject` 의 `mergedMap` 구성 블록.

**내용**: layout elements 와 page elements 가 동일 element ID 를 가질 때 최신
(메모리 우선) 를 유지하도록 병합 순서 확인. 현재 로직은 이미
`pageElements.forEach → layoutElements.forEach` 순으로 `mergedMap.set` 을 사용하므로
순서만 확인하면 된다.

실제로 body element 같이 `layout_id` 를 가지는 elements 가 P3-D-1 이전 상태에서는
`page_id` 가 null 이어서 `pageIdSet` 필터에 걸리지 않는다는 점을 테스트로 확인한다.

**검증**: layout body element (page_id=null, layout_id 있음) 가 mergedMap 에 포함되는지
단위 테스트로 확인.

**회귀 위험**: LOW — mergedMap 병합 순서는 기존 코드와 동일.

---

### Step C-4: console.log 정리 + TODO 주석 제거 (없음)

**내용**: minimal stub 주석 (`MINIMAL STUB:`, `P3-D-1 머지 후 정합화 TODO:`, `void canonicalDoc`) 제거.
`fetchElements` 의 `📥 [fetchElements] Layout ... 요소 ... 개 함께 로드` 와 동일한
debug log 를 `initializeProject` 경로에도 추가 (선택).

**회귀 위험**: 없음 — 주석 및 log 만 변경.

---

## 선행 의존성

| 의존성                               | 설명                                                | 상태                           |
| ------------------------------------ | --------------------------------------------------- | ------------------------------ |
| **P3-D-1 PR 머지**                   | `element.layout_id` 정합화 (factory ownership 제거) | **사용자 영역 — 머지 후 진입** |
| **P3-D-2 PR 머지**                   | (P3-D-1 연관 후속 작업, 있으면)                     | 사용자 확인 필요               |
| `db.elements.getByLayout` 존재       | `fetchElements` 에서 이미 사용 중 — land 확인됨     | ✅                             |
| `selectCanonicalDocument` 인터페이스 | `usePageManager.ts` 에서 이미 import 됨             | ✅                             |
| `FrameNode` 타입                     | `@composition/shared` 에서 import 됨                | ✅                             |

**진입 조건 체크리스트**:

- [ ] `git log --oneline origin/main..HEAD` 출력 없음 (본 브랜치 = main HEAD 상태)
- [ ] P3-D-1 PR `#233` (또는 해당 번호) 머지 확인
- [ ] P3-D-2 PR (있는 경우) 머지 확인
- [ ] `pnpm type-check` PASS
- [ ] `pnpm test --run` PASS

---

## 회귀 위험 평가

| 축           | 등급 | 근거                                                                                                              |
| ------------ | :--: | ----------------------------------------------------------------------------------------------------------------- |
| 기술         | MED  | `db.elements.getByLayout` 이 P3-D-1 이전 `layout_id` stale 데이터를 반환할 수 있음 → P3-D-1 선행 머지로 완화      |
| 성능         | LOW  | `getByLayout` 은 index scan — `getAll` + filter 보다 빠름. reusable frame 이 여러 개일 때 `Promise.all` 병렬 조회 |
| 유지보수     | LOW  | `extractReusableFrameIds` 순수 helper 는 테스트 용이. layout ID convention 변경 시 한 곳만 수정                   |
| 마이그레이션 | LOW  | 변경 범위 = `initializeProject` 함수 내부 10줄 교체. rollback 시 minimal stub 로 revert 가능                      |

**잔존 MED 위험 1건**:

| ID  | 위험                                                                        | 심각도 | 대응                                                                             |
| --- | --------------------------------------------------------------------------- | :----: | -------------------------------------------------------------------------------- |
| R1  | P3-D-1 미머지 상태에서 진입 → `layout_id` stale → layout elements 중복/누락 |  MED   | 선행 의존성 체크리스트 통과 후 진입. P3-D-1 미머지 시 B-2 시나리오가 알려진 FAIL |

---

## 검증 시나리오 mapping

본 정합화가 완료된 후 `903-p3d4-phase-d-verification.md` 의 아래 시나리오를 통과해야 한다:

| 시나리오 | 연관        | 통과 조건                                                         |
| -------- | ----------- | ----------------------------------------------------------------- |
| **B-1**  | 핵심        | 왕복 page 전환 후 element 수 일치 (layout elements 포함)          |
| **B-2**  | P3-D-1 전제 | layout-linked page 에서 layout elements Preview 표시 정상         |
| **B-3**  | 간접        | `selectCanonicalDocument` 호출 trace 1회 이상                     |
| **D-1**  | 핵심        | F5 새로고침 후 page + element 수 일치 (layout elements 복원 포함) |
| RC-1     | 공통        | Preview blank 0                                                   |
| RC-4     | 공통        | `element.page_id` / `element.layout_id` 소실 없음                 |
| RC-5     | 공통        | `selectCanonicalDocument` 반환값 non-null                         |

B-2 는 P3-D-1 머지 이후에만 PASS 가능 — 알려진 선결 조건.

---

## 체크리스트

### 진입 전

- [ ] P3-D-1 / P3-D-2 PR 머지 완료 (사용자 확인)
- [ ] `git pull origin main` + `pnpm type-check` PASS
- [ ] `pnpm test --run` PASS (기존 회귀 없음 확인)

### 구현 중

- [ ] Step C-1: `extractReusableFrameIds` 순수 helper + unit test 1개
- [ ] Step C-2: `initializeProject` 내부 `layoutElements` 실질 채우기
- [ ] Step C-3: 중복 제거 병합 순서 단위 테스트 확인
- [ ] Step C-4: minimal stub 주석 제거 + TODO 제거

### 구현 후

- [ ] `pnpm type-check` PASS (0 error)
- [ ] `pnpm test --run` PASS (0 regression)
- [ ] Chrome MCP 시나리오 B-1 PASS (일반 page 전환 element 수 일치)
- [ ] Chrome MCP 시나리오 D-1 PASS (F5 새로고침 후 복원)
- [ ] RC-1~RC-5 공통 체크 PASS
- [ ] B-2 시나리오 (P3-D-1 머지 후): layout elements Preview 표시 PASS

---

## 금지 패턴

- **❌ minimal stub 패턴 재사용**: `void canonicalDoc; const layoutElements: Element[] = [];` 재도입 금지 — 정합화 목적 자체가 이 패턴 제거.
- **❌ P3-D-1 미머지 상태 진입**: `element.layout_id` stale 시 `getByLayout` 이 잘못된 elements 반환 → 더 깊은 회귀.
- **❌ `allElements.filter(el => el.layout_id === layoutId)` 패턴**: `db.elements.getByLayout` 가 아닌 전체 getAll + filter 는 O(N) — `getByLayout` 을 사용.
- **❌ layout ID convention 하드코딩**: `"layout-"` prefix 로직은 `extractReusableFrameIds` 내부에만 위치. 호출자에 노출 금지.
- **❌ fetchElements 경로 변경**: `fetchElements` (단일 페이지 경로) 는 이미 `getByLayout` 사용 — 중복 수정 금지, `initializeProject` (전체 초기화 경로) 만 수정 대상.
- **❌ `hydrateProjectSnapshot` 앞에서 `mergeElements` 직접 호출**: `initializeProject` 는 최종 `hydrateProjectSnapshot(mergedElements)` 를 단일 호출로 병합한다. 중간에 별도 `mergeElements` 추가는 상태 파이프라인 순서 파괴.

---

## 관련 문서

| 문서                                                                 | 설명                                                                          |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [903-phase3d-runtime-breakdown.md](903-phase3d-runtime-breakdown.md) | P3-D 전체 설계 + sub-phase 목록                                               |
| [903-p3d4-phase-d-verification.md](903-p3d4-phase-d-verification.md) | Chrome MCP 통합 검증 시나리오                                                 |
| [903-phase3-frameset-breakdown.md](903-phase3-frameset-breakdown.md) | P3 통합 breakdown                                                             |
| `apps/builder/src/builder/hooks/usePageManager.ts`                   | 수정 대상 파일                                                                |
| `apps/builder/src/builder/stores/utils/layoutActions.ts`             | P3-D-3 land 패턴 (canonical lookup 선행 reference)                            |
| `apps/builder/src/adapters/canonical/index.ts`                       | `selectCanonicalReusableFrames`, `legacyOwnershipToCanonicalParent` 등 helper |
