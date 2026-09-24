# ADR-241 구현 상세 — Table 열 · 행 origin (2차원 collection)

> 본문: [ADR-241](../241-table-column-row-origins.md) · base: [ADR-234](../completed/234-variant-instances-and-slot-filled-collections.md) · 관련: [ADR-013](../completed/013-quick-connect-data-binding.md) (quick connect 열 생성)

## 1. 전제 확정 기록 (fork 4 질문 · 사용자 confirm)

사용자 confirm 2026-09-24 (AskUserQuestion — "3개로 분리"). 근거: 같은 날 `/deep-research` + `react-aria-components@1.21.0` 소스 + 코드 조사.

1. **base / 응용**: 234 가 base. 241 은 그 규칙을 **두 축 collection** (열 = 반복 항목, 행 = 열 수만큼 셀을 갖는 반복 항목) 에 적용하는 응용이다.
2. **schema 직교성**: 새 저장 필드 · 새 노드 type 없음 — Column · Row · Cell · TableHeader · TableBody 는 이미 type 이다. `props.columns` 는 Canvas 전용 입력으로 남되 정본에서 파생한다.
3. **선행 전제 역전 검증**: 241 → 234 단방향. 238 · 239 · 240 과 독립. 234 의 "바인딩 행 = 데이터" 를 따른다 — 바인딩 Table 의 행은 instance 로 만들지 않는다.
4. **범위**: 열 origin + TableHeader slot (Table · TableView 공용) · 두 leg 열 원천 통일 · 정적 행 (TableView) origin + TableBody slot + 열 ↔ 셀 구조 동기화 · ref instance Table 의 열 추가 (quick connect 포함). 범위 밖: Table 렌더러의 RAC 전환 (현재 TanStack — F7) · 행 상태 변형 (RAC render props 부재) · 열별 셀 템플릿 · 정렬 · 열 크기 조절 · 행 드래그 · TableLoadMoreItem · Table ↔ TableView 통합.

## 2. 레퍼런스 — RAC (`react-aria-components@1.21.0` · starter `packages/react-aria-starter/src/Table.tsx`, read-only)

| ID  | 사실                                                                                                                                                                                               | 근거                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| R1  | Table = `TableHeader > Column` (열 collection) + `TableBody > Row > Cell`. dynamic Row 는 `<Collection items={columns}>` 로 열마다 Cell 을 만든다 — 행의 셀 수 = 열 수 (2차원).                    | starter `Table.tsx:62-109` · react-aria.adobe.com/Table                      |
| R2  | Row provider slot = `selection` (Checkbox, toggle 선택) · `drag` (Button) · Cell `chevron` (tree column) — owner 설정이 켜는 부품. Column 은 `allowsSorting` · `ColumnResizer` (`allowsResizing`). | starter `Table.tsx:37-60,85-128` · `dist/private/Table.mjs` provider `slots` |
| R3  | Row render props = `isSelected` · `isHovered` · `isPressed` · `isFocusVisible` · `isDisabled` (ListBoxItem 과 같은 상태 층).                                                                       | react-aria.adobe.com/Table                                                   |

## 3. 코드 사실 (2026-09-24, main `44ec413ad`)

| ID  | 사실                                                                                                                                                                                                                                                        | 위치                                                                                                                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | Table 과 TableView 는 다른 구현이다 — Table = 데이터 목록 (행은 `dataBinding` · `props.rows`), TableView = 정적 요소 트리 (TableHeader > Column ×3 · TableBody > Row > Cell ×3). 둘 다 palette reusable origin (`component-table` · `component-tableview`). | `packages/shared/src/catalog/componentCatalog.ts:451-455,927-931,1269,1274` · `factories/definitions/{TableDefinition.ts:16-38,DisplayComponents.ts:651-728}`                                 |
| F2  | 열 = canonical Column 요소 (TableHeader 자식). Table origin 은 TableHeader · TableBody 만 (Column 0) · TableView origin 은 Column 3 · Row 1. 둘 다 `slot` 없음 · slot host 행 · 정적 가족 행 없음.                                                          | `components/catalogOrigins.ts:29-47,100-121` · `slotHostPolicy.ts:206-267` · `staticCollectionMigration.ts:157-278`                                                                           |
| F3  | **두 leg 의 열 원천이 다르다** — Preview Table 은 TableHeader 의 Column 요소를 읽고, Canvas projection 은 `props.columns` 를 읽는다 (`readTableColumns` — 없으면 `[]`). Column 요소 → `props.columns` 변환 코드가 없다.                                     | `packages/shared/src/renderers/TableRenderer.tsx:58-69` · `packages/shared/src/collections/resolveCollectionItems.ts:594-617,650-707` · `workspace/canvas/scene/canvasSceneNode.ts:1825-1857` |
| F4  | Preview Table 은 Column 요소가 없으면 데이터 필드로 열을 감지해 builder 에 `ADD_COLUMN_ELEMENTS` 를 보낸다 (늦은 도착은 이미 Column 이 있으면 버림).                                                                                                        | `TableRenderer.tsx:222-262,383-416` · `apps/builder/src/builder/hooks/useIframeMessenger.ts:774-799`                                                                                          |
| F5  | quick connect 는 **직접 Table 노드만** 열을 만든다 — ref instance 는 `planTableColumns` 가 `null` (열이 공유 origin 에 있으므로). 팔레트로 놓은 Table (= ref instance, ADR-228) 은 자기 열을 가질 수 없다.                                                  | `apps/builder/src/builder/panels/datatable/utils/quickConnect.ts:116-143,154-183,233-333` · `apps/builder/src/builder/hooks/useElementCreator.ts:344-388`                                     |
| F6  | TableView Preview 는 RAC 가 아닌 plain div (role grid/row/columnheader/gridcell, `react-aria-*` class 없음 — 의도 주석) · `selectionMode` · `allowsSorting` 미사용.                                                                                         | `packages/shared/src/renderers/LayoutRenderers.tsx:2312-2480`                                                                                                                                 |
| F7  | Table Preview 는 RAC Table 이 아니라 TanStack (`@tanstack/react-table` · `react-virtual`) 의 `<table>` — 선택 (`selectionMode` · `selectedKeys`) 미배선, 정렬 · 크기 조절은 TanStack 로컬 상태.                                                             | `packages/shared/src/components/Table.tsx:3-13,1203-1233`                                                                                                                                     |
| F8  | Canvas Table 행 = projection (`Rows` > TableRow > TableCell) · 가상화 · 높이 모드 (`heightMode` · `height`).                                                                                                                                                | `canvasSceneNode.ts:1872-2182` · `scene/collectionVirtualization.ts:119-156` · `layout/engines/implicitStyles.ts:1502-1548`                                                                   |
| F9  | Column prop = `key` · `isRowHeader` · `allowsSorting` · `enableResizing` · `width` · `minWidth` · `maxWidth` · `children` (글자).                                                                                                                           | `apps/builder/src/types/builder/unified.types.ts:593-602`                                                                                                                                     |

## 4. Phase

### Phase 0 — inventory freeze (G0)

- F1~F9 재grep. 진단 RED:
  - (a) 같은 Table 에 Column 요소 3 · `props.columns` 없음 → Canvas 데이터 행 셀 0 vs Preview 3 열 (F3).
  - (b) 팔레트로 놓은 Table instance 에 quick connect → 열이 생기지 않음 (F5).
  - (c) TableView instance 에 열 · 행을 추가할 경로 없음 (F2).
  - (d) TableView 정적 행의 셀 수가 열 수와 어긋난 문서 (Column 4 · Cell 3 · Column 3 · Cell 4) 의 두 leg 표시.
  - (e) 열 폭 제한 (리뷰 r1 m1): Column `width:80 · minWidth:120` → Canvas 셀 80 (`canvasSceneNode.ts:2095` 가 `col.width` 그대로) vs Preview 120 (TanStack `getSize()` clamp — `components/Table.tsx:521,1480`).
  - (f) 셀 편집 경로 (리뷰 r1 h1): 바깥 TableView instance 가 origin 의 세 번째 셀을 `descendants` 로 고친 문서 — Row 를 ref 로 바꾼 뒤에도 그 patch 가 같은 셀에 붙는지.
  - (g) 중첩 ref 자기 자식 (리뷰 r2): TableView origin 안 Row = `빈 Row origin ref + 자기 Cell 3` → 그 TableView 의 instance 에서 Canvas Cell 수 · 바깥 override 의 Preview 적용.
- 쓰기 경로 표: 팔레트 · factory · quick connect · `ADD_COLUMN_ELEMENTS` · AI tool · 붙여넣기가 Column · Row · Cell 을 어떤 모양으로 쓰는지.
- 이관 수식 실측: Components 새 노드 (Column origin 1 · Row origin 1 · origin 열/행 ref) · 사용자 TableView plain Column `c` · Row `r` → ref (셀 `r × c` 는 행 instance 자기 자식으로 **노드 그대로 이동** — id 유지) · Δbyte.
- 경로 실측: 셀이 Row ref 의 자기 자식으로 옮겨진 뒤 바깥 instance `descendants` 경로 (`<row>/<cell>`) 가 두 해석기에서 같은 셀에 닿는지 — 안 닿으면 F7 선례의 경로 전치 규칙을 정한다.

### Phase 1 — 두 leg 열 원천 통일 (G1)

- **정본 = Column 요소** (Preview 가 이미 읽는 것). Canvas 는 `props.columns` 대신 해석된 TableHeader 의 Column 요소 (instance 상속 · 자기 열 포함) 에서 열 정의 (key · 글자 · 유효 폭) 를 얻는다 — 한 reader 를 두 leg 가 쓴다. `props.columns` 는 legacy 입력으로만 폴백.
- **유효 열 폭** (리뷰 r1 m1): reader 가 `clamp(width ?? 150, minWidth, maxWidth)` 를 계산해 두 leg 에 준다 — Preview 는 TanStack 이 같은 clamp 를 하므로 (`getSize()`) Canvas 가 같은 값을 받아야 한다. 기본값 150 은 `TableRenderer.tsx:87` 과 같은 상수를 공유한다. 사용자 열 크기 조절 (TanStack 로컬 상태) 은 문서 값이 아니라 범위 밖.

### Phase 2 — 열 origin · TableHeader slot (G2)

- Column origin `component-table-column` (팔레트 밖 reusable — 233 Radio 선례). Table · TableView origin 의 TableHeader `slot` = Column origin. "+" = Column instance (key 배정 = 형제와 다른 `key` — 237 Radio `value` 와 같은 자리).
- **ref instance 의 열**: Table instance 의 TableHeader 에 Slot 채우기 (instance 자기 열 — mode C 또는 237 `placedChildren` 중 Phase 0 에서 정함). quick connect 가 ref instance 에서도 이 경로로 열을 만든다 (F5 해소 — 한 history 항목).
- `ADD_COLUMN_ELEMENTS` (F4) 도 같은 쓰기 경로로.

### Phase 3 — 정적 행 origin · 열 ↔ 셀 동기화 (G3)

- Row origin `component-table-row` (행 모양만 — 셀 자식 없음) · TableBody `slot` = Row origin (TableView — 바인딩 Table 은 행 데이터라 slot 없음).
- **셀 저장 모양** (리뷰 r1 h1): 해석기는 origin 에 실제로 있는 경로에만 `descendants` patch 를 붙인다 (`canonicalRefResolution.ts:928` · `resolvers/canonical/index.ts:328`) — Cell 템플릿 1 개짜리 Row origin 으로는 2 · 3 번째 셀이 설 자리가 없다. 그래서 셀은 **행 instance 의 자기 자식** (237 `placedChildren`) 이다. 이관은 기존 셀 노드를 그대로 옮긴다 (id · props 유지 — 셀 글자 · 모양 편집 보존). 새 행 ("+") 은 열 수만큼 기본 Cell 자식을 만든다.
- **중첩 ref 자기 자식 해석 (선행 수리 — 리뷰 r2)**: 지금 두 해석기는 origin 안에 있는 ref 의 **자기 자식** 을 바깥 instance 에서 다르게 다룬다 — Canvas 는 중첩 ref 를 만나면 그 ref origin 의 자식만 펼치고 (`canonicalRefResolution.ts:1070-1090` `materializeSyntheticDescendants(nestedMaster …)`) 자기 자식을 버린다. Preview 는 자기 자식을 그리지만 바깥 `descendants` 를 적용하지 않는다 (`resolvers/canonical/index.ts:222-224`). 실측 (codex r2, 메모리 실행): `빈 Row origin ref + 자기 Cell 3` 인 Row 를 담은 TableView origin 의 instance → Canvas Cell 0 · Preview Cell 3 · 세 번째 셀 override `"Edited"` 는 Preview 에 미적용. 이 모양은 이관 문서뿐 아니라 **새 TableView origin 을 팔레트로 놓을 때도** 생기므로 이관 보류로 막을 수 없다. 그래서 Phase 3 는 두 해석기의 규칙을 먼저 맞춘다:
  - 중첩 ref 의 자기 자식을 그 ref origin 자식 뒤에 materialize (237 top-level instance 자기 자식과 같은 순서 규칙).
  - 바깥 instance 의 `descendants[<중첩 ref>/<자기 자식>]` patch 를 두 해석기가 그 자식에 적용 (경로 = 해석 경로 — 238 key 규칙과 같은 접두).
  - 진단 RED (g) = 위 실측 그대로 (Canvas 셀 수 · Preview override) → GREEN. 공용 해석기 변경이라 영향 범위 = "origin 안 ref 가 자기 자식을 가진 문서" — Phase 0 에서 문서 수를 세고 (지금은 Canvas 에서 그 자식이 빠지는 발산 상태), 변경 뒤 그 문서들의 Canvas 가 Preview 쪽으로 맞춰지는 것을 G5 변경 영역으로 기록한다.
- **바깥 instance 경로**: origin TableView 의 셀을 고친 바깥 instance `descendants` 는 위 해석 규칙 뒤의 경로 실측대로 — 그대로 닿으면 무변경, 안 닿으면 같은 pass 에서 경로 전치 (F7 선례), 전치할 수 없으면 그 문서 이관 보류.
- **구조 동기화**: 정적 행의 셀은 열 순서로 대응한다 — 열 추가 = 모든 정적 행에 Cell 추가 · 열 삭제 = 그 index 의 Cell 삭제 · 열 순서 변경 = 셀 순서 변경. 한 history 항목. 동기화 대상은 셀 수 = 열 수인 행만이다.
- **셀 수가 어긋난 문서** (리뷰 r1 m2): 행 하나라도 셀 수 ≠ 열 수인 TableView 는 **이관하지 않는다** (plain 그대로 — 픽셀 · 내용 불변) · 그 TableView 에는 Row slot · 셀 동기화를 켜지 않는다. 사용자가 셀 수를 맞추면 다음 hydration 에서 이관 (멱등). "남는 셀 유지" 와 "셀 수 = 열 수" 가 한 문서에 공존하지 않는다.

### Phase 4 — 성능 · BC (G4 · G5)

- G4: headed A/B (대조 arm = 241 전 빌드) — fixture = 데이터 Table 500 행 × 8 열 (가상화) · TableView 20 행 × 5 열 × 10 · 불리 조작 (Column origin 편집 · 열 추가 · breakpoint).
- G5: 이관 전후 Canvas 픽셀 (TableView · 열이 있는 Table) · 기존 셀 편집 (행 안 · 바깥 instance) 이 이관 뒤 같은 셀에 적용 · 셀 수 어긋난 TableView 무변경 · Δbyte · 재hydration Δ0.

## 5. 실행 기록

### 선행 수리 — 중첩 ref 자기 자식 해석 (2026-09-25, main)

Phase 3 의 선행 수리를 main 에서 먼저 반영했다 — ADR-239 의 Tree origin (자식 항목을 가진 TreeItem instance) · 하위 메뉴 (중첩 ref) 도 같은 모양이라, 239 · 241 을 worktree 로 나누기 전에 공용 해석기를 한 번만 고친다.

- 진단 RED (g) → GREEN: 두 해석기 같은 fixture (`빈 Row origin ref + 자기 Cell 3` 을 담은 TableView origin 의 instance). 수리 전 Canvas `childrenMap` 셀 **0** (자기 자식 버림) · origin 자식이 있으면 `["handle"]` 만 · Preview 셀 3 이지만 `"Edited"` override 미적용 (4 RED). 수리 뒤 6/6 GREEN.
  - Canvas `materializeSyntheticDescendants`: nested master 자식 뒤에 자식 ref 의 자기 자식을 실체화 (`appendAfterExisting` — Preview `[...origin, ...instance]` 순서). patch 소유자 = 바깥 owner 만 (자식 ref 자신의 descendants 는 nested master 경로를 가리킨다).
  - Preview `resolveNestedRefChild` → `_resolveRefNodeUncached(…, ownChildrenDescendants = scoped)`: 자기 자식에 `applyDescendantsToTree` (id · segment path 둘 다). scoped 가 없으면 종전 경로 (`resolveNode`).
  - 테스트: `apps/builder/src/builder/utils/canonicalRefResolution.test.ts` · `apps/builder/src/resolvers/canonical/__tests__/resolver.test.ts` 의 `ADR-241 선행` describe.
- 영향 범위: `createInitialProjectDocument` 의 origin 124 · origin 안 ref 70 중 자기 자식을 가진 것 **0** → seed 문서 Canvas 무변경. 사용자가 origin 안 instance 에 자식을 넣은 문서만 바뀌며, 바뀌는 방향은 Preview 와 맞춰지는 쪽 (G5 변경 영역).
- 회귀: builder unit 7,454 PASS · 실패 5 는 변경 전부터 있던 정적 게이트 drift (ADR-113 grep gate · propertyFieldIcons `isOpen` · factoryInlineDirtyBaseline Dialog · historyActions `setPagePositions` · AI catalog 동명 type) — 수리 파일 무관. type-check 0.
- live (`apps/builder/scripts/adr241-nested-ref-own-children-live.mjs`, headed · Skia layout · store, Compare Mode · Preview 미개방) **5/5**: 대조군 단일 instance origin 자식 rect · 중첩 ref 자기 자식 2 가 instance Canvas 에 실체화 (inner y 0 → own 28 → 56) · 합성 id 선택 + `updateSelectedProperties` → 바깥 `descendants["live-outer__row/live-outer__own-2"]` · rect 폭 44 → 194 · origin 원본 불변 · page error 0.
- 관측 (범위 밖): `frame` type origin 을 `addComplexElement` 로 넣으면 그 instance 의 자식이 Canvas 에 풀리지 않는다 (대조군 ⓪ 가 frame 일 때 rect null) — 하니스 seed 경로 한정인지 미확인, LOW.

### Phase 0 — inventory freeze (2026-09-25, worktree `adr-241` @ `a2d1fe649`)

- **진단** (`apps/builder/src/builder/components/__tests__/adr241Diagnostics.test.tsx`): 기준선 5 GREEN · RED 4 (`it.fails`) — (a) Column 요소만 있는 Table 의 Canvas 데이터 행 셀 0 (Preview 열 3) · (e) `width:80 · minWidth:120` 셀 폭 ≠ 120 · (c) Table/TableView origin TableHeader slot 없음 · TableView TableBody slot 없음. (b) 는 `quickConnect.test.ts` "ref 인스턴스 · TableHeader 없는 노드는 컬럼 계획 없음" 이 기준선 (store 의 instance element 는 `type: "ref"` → `elementType !== "Table"`). (d) 셀 수 어긋난 TableView 는 두 leg 모두 셀을 있는 그대로 (Column 4 · Cell 3). (f) 바깥 TableView instance 의 `descendants["component-tableview__2/component-tableview__2_1/component-tableview__2_1_3"]` 가 두 leg 에 적용 — 이관 뒤 같은 경로가 같은 셀에 닿아야 한다. (g) 는 선행 수리에서 GREEN.
- **F3 보강**: Preview 열 우선순위 = Column 요소 > `columnMapping` (정적 바인딩) > 데이터 필드 감지 (`ADD_COLUMN_ELEMENTS`). Preview 는 `props.columns` 를 읽지 않는다. 기본 폭: Preview 150 · Canvas legacy 100. TanStack `getSize()` = `clamp(size ?? 150, minSize ?? 20, maxSize ?? MAX_SAFE_INTEGER)` (columnDef 의 `minSize: undefined` 는 기본 20 으로 떨어진다).
- **Canvas 모습 live** (`apps/builder/scripts/adr241-g0-probe-live.mjs`, Skia layout · store): Column 요소 3 (폭 150 · 80/min120 · 150) 인 바인딩 Table → 헤더 = Column 요소 (catalog `flex:1` 이라 Table 폭 1920 을 640 씩 나눔 — `width` 무시) · projection 헤더 행 (빈 36px) · 데이터 행 2 (셀 0, 행 폭 360 폴백). 즉 지금 Canvas 헤더는 Column 요소가 그리고 projection 헤더 행은 빈 줄이다.
- **instance 열의 해석**: Table instance 의 `descendants["component-table__1"].children = [Column…]` (mode C) 는 Canvas scene 에 이미 `t2/component-table__1/<col>` 로 풀린다 — instance TableHeader 는 origin 안쪽 노드라 237 `placedChildren` (root 전용) 이 아니라 234 Tabs 의 TabList 와 같은 mode C 로 채운다 (Phase 2 결정).
- **`props.columns` 쓰기 경로 0**: `createDefaultTableProps` 가 배열을 뺀 뒤 production writer 없음 — legacy 문서만 가진다 (R1 폴백 대상).

쓰기 경로 표 (Column · Row · Cell):

| 경로                                   | Table                                                                                                   | TableView                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 팔레트 · AI (`useElementCreator`)      | ref instance — origin 상속 (Column 0)                                                                   | ref instance — origin 상속 (Column 3 · Row 1×Cell 3) |
| quick connect (`executeQuickConnect`)  | plain Table 만 Column 삽입 (`key` · `label` · `children` · `width:150` …) · ref instance 는 바인딩만    | 대상 아님                                          |
| `ADD_COLUMN_ELEMENTS` (Preview 감지)   | plain: Column 0 일 때 `columnMapping` 열 삽입 · instance: 해석 id (`<inst>/component-table__1`) 를 부모로 보냄 | —                                                  |
| 붙여넣기                               | 원본 모양 그대로                                                                                        | 원본 모양 그대로                                   |
| Column · Cell 삭제 (`elementRemoval`)  | 같은 index Cell · Column 을 같이 지운다 — 단 `Table` 조상만 (정적 행이 없어 사실상 no-op)               | 동기화 없음 (Phase 3 대상)                         |

### Phase 1 — 두 leg 열 원천 통일 (G1, 2026-09-25)

- **공용 reader** (`packages/shared/src/collections/resolveCollectionItems.ts`): `readTableColumnElements` · `resolveTableColumnKey` (Preview dataKey 규칙 그대로 — key · 글자 소문자 · `props.id` · `col<index>`) · `resolveTableColumnEffectiveWidth` (`clamp(width ?? 150, minWidth ?? 20, maxWidth)`) · `TABLE_COLUMN_DEFAULT_WIDTH`. Preview `renderTable` 이 key · 기본 폭을 이 reader 에서 받고 (clamp 는 TanStack 이 같은 규칙), Canvas `getTableProjectionRows(…, elementColumns)` 가 Column 요소 열을 받는다 (없으면 legacy `props.columns`).
- **Canvas 열 읽는 자리**: Table 의 자식 scene (TableHeader > Column) — ref Column (Phase 2 의 Column instance) 은 visit 이 origin type · props 로 접어 두므로 같은 경로. 그래서 Table projection 은 **자식 visit 뒤** 에 만들고, ref instance Table (root · 합성) 은 해석 뒤 `appendRefInstanceChildProjections` 가 붙인다 (해석 전에는 origin 열 · mode C 열이 scene 에 없다 — 228 TagList/TabList 선례).
- **헤더**: Column 요소가 헤더를 그리면 projection 헤더 행을 세우지 않는다 (이전: Column 요소 헤더 + 빈 projection 헤더 행 36px). Column 요소 폭은 layout `applyImplicitStyles` (TableHeader, 부모 Table) 가 유효 폭 · `flexBasis:auto` · grow/shrink 0 으로 주입 — catalog `flex:1` 이 batch 에 남긴 basis `0%` 를 덮지 않으면 grow 0 에서 content 폭으로 준다 (live 1차 45/46/39 실측). TableView 는 종전 그대로.
- **G1 unit**: shared `tableColumnElements.test.ts` 3 (폭 7 케이스 = 설치된 TanStack `getSize()` · key 규칙 · 삭제/type 필터) · builder `adr241Phase1.columnSource.test.tsx` 7 (셀 순서 · key · 유효 폭 150/120/60 · 행 폭 330 · legacy 무변경 (헤더 행 · 80/100) · Column 요소 우선 · instance mode C 열 · 바인딩 없음 projection 없음 · layout 폭 주입 · TableView 무주입) · 진단 (a) (e) GREEN. 원복 RED: projection 의 `elementColumns` 인자 제거 → 5 RED ((a) (e) · 셀 · Column 요소 우선 · instance 열), implicit 주입 제거 → layout 1 RED.
- **live** (`adr241-g0-probe-live.mjs`, Skia layout · store): Column 150/120/150 (x 0/150/270) = 데이터 셀 폭 · 행 420 · projection 헤더 행 없음 · page error 0 (수리 전 640×3 · 빈 헤더 행 · 셀 0).
- 회귀: builder unit 7,472 PASS · shared 1,410 PASS · type-check 0. 실패 = 변경 무관 3 — `textAxisGate` (gitignored `docs/adr/evidence` 가 worktree 에 없음) · shared `componentCatalog` placeable 단일성 · browser `catalogComponentBox` Dialog fixed · `adr923Hc2DisplayJudgment` GridList (모두 Table 밖, HEAD 기존).

### Phase 2 — Column origin · TableHeader slot · instance 열 (G2, 2026-09-25)

- **origin · slot** (`components/tableColumnOrigins.ts`): Column origin `component-table-column` (`props.children: "Column"`, 팔레트 밖) · Table · TableView origin TableHeader `slot: [Column origin]` (slot 이 없을 때만 — 사용자 추천 목록 보존) · `ensureReusableCompositeOrigins` 끝에서 멱등. 저장 history 의 Components body · owner origin 스냅샷도 같은 보정 (`ensureTableColumnOriginsInSnapshot` — 240 F28 가족: 이관 전 body 스냅샷을 Undo 로 재생하면 Column origin 이 빠져 instance 열이 origin 을 잃는다).
- **slot host 규칙** `tableheader` (insert kind `table-column` · `placedChildren` · `contractRefOnly` — plain Column (quick connect · Preview 감지 · 이관 전 TableView) 은 배치 요소로 허용하고 slot 계약 경고 대조 밖).
- **열 삽입 계획** (`components/tableColumnInsert.ts`, 한 곳): plain TableHeader → Column instance 자식 · instance TableHeader (`<instance>/<path>` — origin 안쪽 노드라 234 Tabs TabList 와 같은 mode C) → `descendants[path].children`. 첫 mode C 는 origin 열을 복제해 이어 쓰고 그 열의 바깥 patch (`descendants["path/열"]` 글자 · 폭) 를 복제본 props 로 옮긴다 (경로가 복제본 id 로 바뀌어 그대로 두면 편집이 사라진다). key = 형제 유효 key (ref 는 origin props 위 자기 props) 와 겹치지 않는 `column<n>` (R3) · 명시 key (schema) 는 그대로.
- **쓰기 4곳**: Properties Slot 「+」 (`FrameSlotSection` — plain TableHeader, origin 이면 영향 확인 뒤 한 트랜잭션) · Slot Fill (`ComponentSlotFillSection` — instance) · quick connect (`planTableColumns` 가 ref instance 의 체인 끝이 Table 이면 instance 계획 · `executeQuickConnect` 가 바인딩 **전** 에 자기 열을 쓰고 replace event 쌍을 data 항목 하나에 싣는다 — 실패 시 원복) · Preview `ADD_COLUMN_ELEMENTS` (해석 id TableHeader → `planPreviewDetectedColumns` mode C, 이미 열이 있으면 버림).
- **live 결함 1 (수리)**: quick connect 의 replace event 를 열 쓰기 직후 스냅샷으로 만들면 redo 가 그 노드 (바인딩 전) 를 다시 넣어 바인딩을 지웠다 (live ③ `bound:false`) → 바인딩 **뒤** post-mutation 모드로 만든다 · unit 순서 고정 (`updateInstance → applyDataChange → replaceEvents`).
- **G2 unit**: `adr241Phase2.columnOrigin.test.tsx` 10 (origin · slot seed · 멱등 · 사용자 slot 보존 · 계약 경고 · history 스냅샷 · plain "+" key 유일 + 두 leg · 형제 유효 key 회피 · instance mode C 두 leg · TableView 첫 mode C patch 이관 · Preview 감지 instance + 늦은 도착 · replace) · `quickConnect.test.ts` instance 3 (계획 · 한 history 항목 + 순서 · 실패 원복) · 진단 (c) TableHeader GREEN. 원복 RED: quick connect instance 분기 제거 → 3 RED.
- **live** (`adr241-phase2-live.mjs`, headed · 실제 팔레트 · Properties UI · Compare Mode · Preview 미개방) **7/7**: 팔레트 Table = ref instance · Data 「New table」 Contacts → instance 자기 열 13 (Column origin ref · schema key) · Canvas 합성 Column 13 · 데이터 셀 key = 열 key · 셀 폭 = Column 폭 150 · undo 1회 → 열 · 바인딩 같이 제거 · redo 복원 · Slot Fill 「Fill slot」 → `column14` · undo 1회 → 그 열만 · page error 0 · dialog 0.
- 회귀: builder unit 7,485 PASS · type-check 0 · ADR-113 descendants 게이트에 새 파일 4 등재 (canonical `RefNode.descendants` 를 만드는 계획 · adapter 필드로 쓰는 쓰기). 실패 1 = `textAxisGate` (worktree evidence 부재, 무관).
