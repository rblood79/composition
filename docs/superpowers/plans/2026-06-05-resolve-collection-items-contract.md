# resolveCollectionItems 단일 계약 설계 고정 (ADR-912 영역 B 연장)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **위상**: 본 문서는 **설계 고정(design freeze)** 산물이다. 코드 수정 task는 4단계 설계 고정(섹션 1~4) 완료 + 사용자 별도 승인 후 진행한다. 본 plan 의 Task 들은 설계 확정을 위한 실측·문서화·계약 정의이며, 실제 wrapper 전환 코드는 "구현 단계 (사용자 승인 후)" 섹션의 별도 task 다.

**Goal:** collection items 의 source(static props.items / dataBinding / collections / fallback)를 `resolveCollectionItems` 단일 계약으로 통합하여 DOM wrapper 와 Skia projector 가 같은 source 를 소비하게 하고, wrapper 별 `if(!hasDataBinding && items)` 분산 보정(ADR-142 가 없애려던 패턴)을 차단한다.

**Architecture:** Skia 가 이미 가진 `getFlatProjectionRows`(순수 함수, import 0)를 `resolveCollectionItems` 후보로 승격 → `packages/shared` 로 hoist → DOM wrapper 와 Skia projector 양쪽이 동일 계약 소비. RAC 공식 패턴("collection data source" ↔ "item render adapter" 분리)과 정합: source 통합은 계약이, render adapt(JSX children / items+render fn / `<Collection>`)는 wrapper 가 담당.

**Tech Stack:** TypeScript, React Aria Components (Collections), Zustand, packages/shared ← apps/builder 경계.

---

## 배경 — 왜 small patch 가 아니라 단일 계약인가

### 사용자 결정 (2026-06-05)

> "1번, resolveCollectionItems 단일 계약 설계 먼저가 맞습니다. ... 지금 5개 small patch 로 밀면 단기 복구는 되지만 같은 문제가 또 생깁니다. ... normalized collection items 모델 가능성을 먼저 설계하고, 가능한 군만 그 모델로 전환하는 쪽이 ADR-142/912 목적에 더 일관됩니다."

### RAC 공식 패턴 근거 (사용자 인용 — React Aria Collections 문서)

- static collection = JSX children
- dynamic collection = `items` prop + render function
- async = `useAsyncList(...).items` 를 collection 에 공급
- `<Collection items={...}>` 로 여러 source 조합
- → RAC 자체가 **"collection data source" 와 "item render adapter" 를 분리**해서 본다.

우리 매핑: static/API/async 를 먼저 normalized collection items 로 통합 → DOM 에서 RAC 의 items/Collection/render function 형태로 어댑트.

### feasibility 실측 결론 (코드 수정 없이 판정 완료)

| 사실                                                                                              | evidence                                                                                                           |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Skia 는 이미 dataBinding/items/collections 단일 통합                                              | `getFlatProjectionRows` (`apps/builder/src/builder/components/collection/collectionRowProjectionModel.ts:200-212`) |
| 그 모듈은 import 0 순수 함수 → shared hoist 안전                                                  | 동 파일 import 블록 0건                                                                                            |
| DOM 만 분산 (`useCollectionData(dataBinding)` + wrapper 별 ad-hoc 정적 items 분기)                | `packages/shared/src/hooks/useCollectionData.tsx:220` (정적 items param 없음)                                      |
| ADR-142 에 단일 어댑터 선례 존재 (`resolveMergedStyle`)                                           | `packages/shared/src/catalog/resolvers/resolveMergedStyle.ts`                                                      |
| small patch 8회 = wrapper 별 `if(!hasDataBinding && items)` 복제 = ADR-142 no-classification 역행 | TagGroup `a49e63541`/`9e84c2707` + Menu 기존 분기(`Menu.tsx:478`)                                                  |

### collection 분류 (5 통합 가능 + 1 부분 + 3 예외)

| 군                | collection                                                  |           flat items SSOT           | 통합 계약                     |
| ----------------- | ----------------------------------------------------------- | :---------------------------------: | ----------------------------- |
| **통합 가능 (5)** | Menu / ListBox / GridList / TagGroup / Select               |                 ✅                  | `resolveCollectionItems` 소비 |
| **부분 (1)**      | ComboBox                                                    | items prop 없음(additive 도입 필요) | 계약 도입 + items prop 신규   |
| **예외 (3)**      | Tabs(Tab+TabPanel 쌍) / Tree(계층) / Table(2D columns+rows) |           ❌ flat 1D 불가           | 단일 계약 제외, 별도 처리     |

---

## 섹션 1 — 파일 경계 확정 (사용자 4단계 #1)

### 1-A. hoist 대상

- **source**: `apps/builder/src/builder/components/collection/collectionRowProjectionModel.ts` (import 0 순수 함수)
- **목표 위치**: `packages/shared/src/collections/resolveCollectionItems.ts` (신규) — `packages/shared` 는 builder/preview 양쪽이 import 하므로 DOM wrapper(shared) + Skia projector(builder) 공통 소비 가능
- **경계 검증**: 해당 모듈은 `apps/builder` 의 store/타입에 의존하지 않음 (import 0). hoist 시 역의존(shared → builder) 발생하지 않음 → **안전**

### 1-B. 호출처/경계 (hoist 시 import 경로 갱신 대상)

| surface                                                                          | 현재 import                                             | 갱신 후                                    | 상태                         |
| -------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------ | ---------------------------- |
| `apps/builder/src/builder/layers/listBoxRowProjection.ts:6`                      | `../components/listbox/listBoxRowProjectionModel`       | 기존 alias 유지 또는 `@composition/shared` | actual inbound               |
| `apps/builder/src/builder/workspace/canvas/scene/canonicalSceneModel.ts:12`      | `../../../components/listbox/listBoxRowProjectionModel` | 기존 alias 유지 또는 `@composition/shared` | actual inbound(type only)    |
| `apps/builder/src/builder/workspace/canvas/scene/canvasSceneNode.ts:19,24`       | `listbox/...` + `collection/...`                        | 기존 alias 유지 또는 `@composition/shared` | actual inbound               |
| `apps/builder/src/builder/components/listbox/listBoxRowProjectionModel.ts`       | (BC alias 모듈, collection/ 위임)                       | shared 재export alias 로 전환              | alias surface                |
| `apps/builder/src/builder/components/collection/collectionRowProjectionModel.ts` | (원본)                                                  | shared 재export alias (BC 0)               | alias surface / old location |

**BC 전략**: 기존 builder 경로 2 모듈은 shared 의 새 모듈을 재export 하는 alias 로 남긴다 (소비처 변경 0, ADR-912 C1 hoist 선례와 동일).

**shared export 경계 (보강, 2026-06-05 review)**:

- 신규 디렉토리: `packages/shared/src/collections/`
- 신규 entry: `packages/shared/src/collections/index.ts`
- root export: `packages/shared/src/index.ts` 에 `export * from "./collections";` 추가
- subpath export: direct import 를 `@composition/shared/collections` 로 선택할 경우 `packages/shared/package.json` exports 에 `./collections` 추가. 기본 구현은 root export(`@composition/shared`) 우선 — package export churn 최소화.

---

## 섹션 2 — 반환 계약 정의 (사용자 4단계 #2)

### 2-A. 현재 `CollectionProjectionRow` (이미 존재하는 metadata)

```ts
// collectionRowProjectionModel.ts:34
type CollectionProjectionRow = {
  kind: "item" | "section";
  header?: string; // section header (kind:'section')
  description: string | null;
  icon: string | null; // ADR-147 lucide icon name
  isDisabled: boolean;
  item: unknown; // raw item 보존 — DOM render adapter(Menu submenu/shortcut 등)가 소비
  itemKey: string; // = key
  label: string;
  rowIndex: number; // projection id / fallback key / selection 계산 보조
  value: string | null;
};
```

### 2-B. 사용자 요청 계약 vs 현재 (gap)

| 요청 필드                                  | 현재                                          | gap                     |
| ------------------------------------------ | --------------------------------------------- | ----------------------- |
| items                                      | ✅ (배열 반환)                                | —                       |
| key                                        | ✅ `itemKey`                                  | —                       |
| label                                      | ✅ `label`                                    | —                       |
| icon                                       | ✅ `icon`                                     | —                       |
| raw item                                   | ✅ `item`                                     | 보존 필수               |
| rowIndex                                   | ✅ `rowIndex`                                 | 보존 필수               |
| remove (allowsRemoving)                    | caller prop                                   | row 계약에 넣지 않음    |
| sourceKind (static/dataBinding/collection) | ❌                                            | **추가 필요**           |
| writeTarget (template/data/override)       | ⚠️ 별도 존재 (`resolveCollectionWriteTarget`) | **계약 연계 명시** 필요 |

### 2-C. 확정 반환 계약 (설계 고정)

```ts
/** collection source 의 정규화 결과 — DOM wrapper / Skia projector 공통 소비. */
interface ResolvedCollectionItems {
  /** 정규화된 item 행 (kind:'item'|'section'). 기존 CollectionProjectionRow 재사용. */
  rows: CollectionProjectionRow[];
  /** source 판정 — render adapter 가 분기 없이 동일 처리하되, 디버깅/write 라우팅 보조. */
  sourceKind:
    | "static-items"
    | "dataBinding"
    | "collection"
    | "fallback"
    | "empty";
  /**
   * write target 라우팅 힌트 (resolveCollectionWriteTarget 과 연계).
   * static-items → "data"(props.items), dataBinding/collection → "data"(collection),
   * template subtree 편집 → "template". 계약은 sourceKind 만 제공, 실제 변환은 resolveCollectionWriteTarget.
   */
  // writeTarget 은 계약에 포함하지 않고 sourceKind 로 caller 가 resolveCollectionWriteTarget 호출 — 단일 책임 분리
}
```

**설계 결정 — `remove` metadata 는 row 가 아니라 caller (allowsRemoving prop)** 에서: `allowsRemoving` 은 collection 노드 prop(전체)이지 row 별 값이 아니다. row 계약에 넣지 않고 wrapper 가 `allowsRemoving` prop 으로 render adapt 시 결정 (TagGroup `9e84c2707` 패턴). → 계약 최소화.

**설계 결정 — `sourceKind` 는 추가하되 `writeTarget` 은 계약에서 분리**: writeTarget 변환은 이미 `resolveCollectionWriteTarget(projection, intent)` 단일 책임이다. 계약에 중복 넣으면 두 source of truth. `sourceKind` 만 제공하고 write 라우팅은 기존 함수 위임 (단일 책임 보존).

### 2-D. 순수 resolver 와 DOM hook/adapter 경계 (review 보강)

`resolveCollectionItems` 는 **동기 순수 함수**다. Skia projector 는 canonical node props + builder 가 이미 보유한 `collections` snapshot 을 넘길 수 있으므로 순수 함수만으로 충분하다.

DOM wrapper 는 다르다. 현재 `collections`/API/dataTable 접근은 `useCollectionData()` 내부 DI(`useCollectionDataServices`)로만 가능하다. 따라서 wrapper 가 `resolveCollectionItems({ props, dataBinding, collections })` 를 직접 호출하면 shared/service 경계가 깨진다.

**DOM 쪽 확정 경계**:

- 순수 계약: `resolveCollectionItems(input)` — raw source rows 를 `CollectionProjectionRow[]` 로 정규화.
- hook adapter: `useResolvedCollectionItems(options)` 또는 `useCollectionData({ staticItems })` 확장 중 하나를 Task 2-A 에서 lock-in.
- 기본 권장: `useResolvedCollectionItems` 신설. 내부에서 `useCollectionData` 로 async/dataTable source 를 해소하고, 정적 `props.items` 와 bound data 를 같은 `resolveCollectionItems` row normalizer 로 통과시킨다.
- 금지: wrapper 별 `if (!hasDataBinding && items)` 복제, wrapper 에서 `useCollectionDataServices()` 직접 호출, `collections` store 직접 import.

---

## 섹션 3 — DOM wrapper ↔ Skia projector 소비 표 고정 (사용자 4단계 #3)

### 3-A. 통합 가능 5군 — 같은 계약 소비 방식

| collection   | DOM wrapper render adapt                                             | Skia projector                | 검증 상태                                                    |
| ------------ | -------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------ |
| **TagGroup** | `<TagList items={rows}>{(item)=>...}</TagList>`                      | `appendTagRowProjection`      | VERIFIED — Tag proof + items 복구 후 되감기 proof 대상       |
| **ListBox**  | `<AriaListBox items={rows}>{(item)=>...}</AriaListBox>`              | `appendListBoxRowProjection`  | VERIFIED — ListBox row projection 선례                       |
| **GridList** | `<AriaGridList items={rows}>{(item)=>...}</AriaGridList>`            | `appendGridListRowProjection` | PARTIAL — flat rows verified, section header projection 후행 |
| **Menu**     | `<AriaMenu items={rows}>{(item)=>...}</AriaMenu>` (기존 분기 되감기) | (Menu Skia projector 추후)    | PLANNED — DOM 정적 분기 존재, Skia projector 후행            |
| **Select**   | popover 내 `<AriaListBox items={rows}>`                              | (Select Skia projector 추후)  | PLANNED — DOM popover/ListBox 2단 adapter, Skia 후행         |

### 3-B. 부분 1군

| collection   | 처리                                                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| **ComboBox** | `items` prop 신규 도입(additive, breaking 아님) → 5군과 동일 계약 소비. binding accepts 에 items 추가 + wrapper signature 에 items 추가 |

### 3-C. 예외 3군 (단일 계약 제외 — 명시적 분리)

| collection | 이유                                                                                 | 별도 처리                                                          |
| ---------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| **Tabs**   | Tab + TabPanel **쌍** 구조 — 1개 row 가 2개 element 생성. flat 1D items 로 표현 불가 | factory-child 패턴 유지. items→Tab/TabPanel 쌍 변환은 wrapper 전용 |
| **Tree**   | **계층** 구조 (재귀 children). flat items 아님                                       | dataBinding/children 재귀 유지                                     |
| **Table**  | **2D** (columns + rows), TanStack 엔진, RAC collection 아님                          | 2D 전용 (column 차원). `getTableProjectionRows`(이미 별도) 유지    |

**예외 분리 원칙 (사용자 명시)**: "Tabs/Tree/Table 까지 억지로 flat items 에 넣지 않습니다. flat 가능한 군과 예외군을 명확히 나누는 게 단일 계약의 조건입니다."

---

## 섹션 4 — proof 정의: TagGroup 되감기 (사용자 4단계 #4)

**proof 대상**: Menu/ListBox/GridList 가 아니라, **TagGroup 기존 patch(`9e84c2707`)를 normalized contract 로 되감아도 같은 결과**가 나오는지.

**Why 되감기**: TagGroup 은 이미 small patch 로 정적 items 분기를 가졌다(`TagGroup.tsx:485-542`). 이걸 `resolveCollectionItems` 계약 소비로 교체했을 때 동일 결과면 — 계약이 small patch 를 대체할 수 있음을 증명. 이게 5군 일괄 전환의 안전 게이트.

**proof 성공 기준 (kill criteria)**:

- TagGroup wrapper 의 `if(!hasDataBinding && items)` 분기 **삭제** (계약으로 대체) → seam 제거 (`feedback-proof-gate-seam-removal-kill-criteria`: fallback 유지 = 실패)
- builder items=4 / iframe fiber items=4 / iframe DOM chip 4 + 텍스트 정상 (TagGroup `9e84c2707` 검증과 동일 결과)
- Skia projection chip 4 유지
- dataBinding 경로 회귀 0
- DOM wrapper 가 `collections` store 를 직접 읽지 않음 (`useResolvedCollectionItems`/`useCollectionData` adapter 경유)
- **kill 조건**: 계약 되감기로 TagGroup 이 깨끗하게(분기 0 + 같은 결과) 안 나오면 5군 일괄 전환 **중단** + 계약 재설계

---

## 구현 단계 (사용자 승인 후 — 본 plan 의 설계 고정 완료 시점에 별도 task)

> 아래는 설계 고정(섹션 1~4) 확정 + 사용자 승인 후 진행. 지금은 **설계 참조용 task 목록**.

### Task 1: `getFlatProjectionRows` → `resolveCollectionItems` shared hoist

**Files:**

- Create: `packages/shared/src/collections/resolveCollectionItems.ts` (collectionRowProjectionModel 내용 이전 + `ResolvedCollectionItems` 계약 추가)
- Create: `packages/shared/src/collections/index.ts`
- Modify: `packages/shared/src/index.ts` (collections root export)
- Optional: `packages/shared/package.json` `./collections` export (direct subpath 선택 시)
- Modify: `apps/builder/src/builder/components/collection/collectionRowProjectionModel.ts` (shared 재export alias)
- Modify: `apps/builder/src/builder/components/listbox/listBoxRowProjectionModel.ts` (shared 재export alias)
- Test: `packages/shared/src/collections/__tests__/resolveCollectionItems.test.ts`

- [ ] **Step 1: 실패 테스트 작성** — `resolveCollectionItems({props:{items:[{id:"1",label:"A"}]}})` → `{rows:[{kind:"item",itemKey:"1",label:"A",...}], sourceKind:"static-items"}` 기대
- [ ] **Step 2: 테스트 실패 확인** — `pnpm --filter @composition/shared test resolveCollectionItems` → FAIL (module not found)
- [ ] **Step 3: collectionRowProjectionModel 내용 이전 + `ResolvedCollectionItems` wrapper 추가** (기존 순수 함수 그대로 + sourceKind 판정 래퍼)
- [ ] **Step 4: builder 측 2 모듈을 shared 재export alias 로 변경** (BC: 호출처 5개 변경 0)
- [ ] **Step 5: shared export 경계 추가** — root export 필수, subpath export 는 import 전략 선택 시
- [ ] **Step 6: 테스트 통과 + type-check + 호출처 5개 빌드 확인** — `pnpm type-check`
- [ ] **Step 7: 커밋**

### Task 2-A: DOM adapter 경계 lock-in

**Files:**

- Create: `packages/shared/src/collections/useResolvedCollectionItems.ts` (권장) 또는 `packages/shared/src/hooks/useCollectionData.tsx` 확장
- Test: `packages/shared/src/collections/__tests__/useResolvedCollectionItems.test.tsx` 또는 hook adapter targeted test

- [ ] **Step 1: hook adapter 실패 테스트 작성** — static `items` 와 `dataBinding` bound data 가 모두 `CollectionProjectionRow[]` 로 정규화되는지
- [ ] **Step 2: `useResolvedCollectionItems` 구현** — `useCollectionData` 로 async/dataTable source 해소 + 정적 items 는 같은 `resolveCollectionItems` normalizer 사용
- [ ] **Step 3: wrapper 직접 service/store 접근 금지 확인** — `useCollectionDataServices` 직접 import 0
- [ ] **Step 4: 테스트 통과 + type-check**
- [ ] **Step 5: 커밋**

### Task 2-B: TagGroup 되감기 proof (섹션 4)

**Files:**

- Modify: `packages/shared/src/components/TagGroup.tsx` (정적 items 분기 → `resolveCollectionItems` 계약 소비로 교체, `if(!hasDataBinding && items)` 분기 삭제)

- [ ] **Step 1: TagGroup wrapper 가 `useResolvedCollectionItems({items, dataBinding, ...})` 소비 → rows 로 render adapt** (기존 `9e84c2707` 분기 제거)
- [ ] **Step 2: live 검증** — Compare 모드: builder items=4 / fiber items=4 / DOM chip 4 + 텍스트 / Skia chip 4 유지 / dataBinding 회귀 0
- [ ] **Step 3: kill criteria 판정** — 분기 0 + 같은 결과면 PASS → 5군 진행. 아니면 중단 + 계약 재설계
- [ ] **Step 4: 커밋 (proof 통과 시)**

### Task 3~6: 5군 나머지 전환 (Menu/ListBox/GridList/Select) — proof 통과 후

각 wrapper 의 정적 items 분기(있으면)를 `useResolvedCollectionItems`/`resolveCollectionItems` 소비로 교체 + binding accepts items 추가 + live 검증. Task 2-B 패턴 반복.

### Task 7: ComboBox items prop additive 도입 (부분 1군)

ComboBox.tsx signature + binding accepts 에 items 추가 → `resolveCollectionItems` 소비.

### (예외 3군 Tabs/Tree/Table — 본 계약 제외, 별도 영역)

---

## Self-Review

**1. Spec coverage:** 사용자 4단계 — #1 파일경계(섹션1) / #2 반환계약(섹션2) / #3 소비표 5+1+3(섹션3) / #4 TagGroup 되감기 proof(섹션4) 전부 커버. ✅

**2. Placeholder scan:** 구현 Task 의 Step 들은 설계 참조용(사용자 승인 후 상세화) — 본 plan 은 **설계 고정**이 산물이고 코드 Task 는 승인 후 진행이므로, Step 코드 상세는 Task 착수 시 채움 (현 단계는 설계 freeze).

**3. Type consistency:** `ResolvedCollectionItems` / `CollectionProjectionRow` / `sourceKind` 명칭 섹션 2~4 일관. `resolveCollectionItems` 함수명 전 섹션 일관.

---

## ADR-912 연계

본 설계는 ADR-912 영역 B (collection projected tree)의 연장이다. ADR fork 아님 — ADR-912 breakdown(`docs/adr/design/912-rac-pencil-rebuild-cutover-breakdown.md`)의 영역 B 섹션에 "collection items 단일 계약(`resolveCollectionItems`)" 항목으로 반영 대상. 사용자가 "ADR-142/912 목적에 일관"이라 명시.
