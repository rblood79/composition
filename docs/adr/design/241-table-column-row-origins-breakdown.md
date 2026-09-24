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
| F4  | Preview Table 은 Column 요소가 없으면 데이터 필드로 열을 감지해 builder 에 `ADD_COLUMN_ELEMENTS` 를 보낸다 (늦은 도착은 이미 Column 이 있으면 버림).                                                                                                        | `TableRenderer.tsx:222-262,383-416` · `apps/builder/src/builder/hooks/useIframeMessenger.ts:774-799`                                                                                            |
| F5  | quick connect 는 **직접 Table 노드만** 열을 만든다 — ref instance 는 `planTableColumns` 가 `null` (열이 공유 origin 에 있으므로). 팔레트로 놓은 Table (= ref instance, ADR-228) 은 자기 열을 가질 수 없다.                                                  | `apps/builder/src/builder/panels/datatable/utils/quickConnect.ts:116-143,154-183,233-333` · `apps/builder/src/builder/hooks/useElementCreator.ts:344-388`                                                                    |
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
  - (d) TableView 정적 행의 셀 수가 열 수와 어긋난 문서 (Column 4 · Cell 3) 의 두 leg 표시.
- 쓰기 경로 표: 팔레트 · factory · quick connect · `ADD_COLUMN_ELEMENTS` · AI tool · 붙여넣기가 Column · Row · Cell 을 어떤 모양으로 쓰는지.
- 이관 수식 실측: Components 새 노드 (Column origin 1 · Row origin 1 (+ Cell 1) · origin 열/행 ref) · 사용자 TableView plain Column `c` · Row `r` → ref (셀 `r × c` 는 행 descendants) · Δbyte.

### Phase 1 — 두 leg 열 원천 통일 (G1)

- **정본 = Column 요소** (Preview 가 이미 읽는 것). Canvas 는 `props.columns` 대신 해석된 TableHeader 의 Column 요소 (instance 상속 · 자기 열 포함) 에서 열 정의 (key · 글자 · width) 를 얻는다 — 한 reader 를 두 leg 가 쓴다. `props.columns` 는 legacy 입력으로만 폴백.

### Phase 2 — 열 origin · TableHeader slot (G2)

- Column origin `component-table-column` (팔레트 밖 reusable — 233 Radio 선례). Table · TableView origin 의 TableHeader `slot` = Column origin. "+" = Column instance (key 배정 = 형제와 다른 `key` — 237 Radio `value` 와 같은 자리).
- **ref instance 의 열**: Table instance 의 TableHeader 에 Slot 채우기 (instance 자기 열 — mode C 또는 237 `placedChildren` 중 Phase 0 에서 정함). quick connect 가 ref instance 에서도 이 경로로 열을 만든다 (F5 해소 — 한 history 항목).
- `ADD_COLUMN_ELEMENTS` (F4) 도 같은 쓰기 경로로.

### Phase 3 — 정적 행 origin · 열 ↔ 셀 동기화 (G3)

- Row origin `component-table-row` (Cell 템플릿 1) · TableBody `slot` = Row origin (TableView — 바인딩 Table 은 행 데이터라 slot 없음).
- **구조 동기화**: 정적 행의 셀은 열 순서로 대응한다 — 열 추가 = 모든 정적 행에 Cell (Row origin 의 Cell 템플릿 instance) 추가 · 열 삭제 = 그 index 의 Cell 삭제 · 열 순서 변경 = 셀 순서 변경. 한 history 항목.
- 셀 글자 = 행 instance 의 `descendants[셀 경로].children`.

### Phase 4 — 성능 · BC (G4 · G5)

- G4: headed A/B (대조 arm = 241 전 빌드) — fixture = 데이터 Table 500 행 × 8 열 (가상화) · TableView 20 행 × 5 열 × 10 · 불리 조작 (Column origin 편집 · 열 추가 · breakpoint).
- G5: 이관 전후 Canvas 픽셀 (TableView · 열이 있는 Table) · Δbyte · 재hydration Δ0.

## 5. 실행 기록

(실행 시 기록)
