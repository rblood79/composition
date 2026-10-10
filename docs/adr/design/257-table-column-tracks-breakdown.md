# ADR-257 breakdown — Table 열 트랙 · 표·목록 S2 prop

> 본문: [ADR-257](../257-table-column-tracks.md). 이 문서는 Phase · 파일 경계 · 검증 순서를 둔다. 결정 · 기각 사유는 본문이 정본이다. 2026-10-10 리뷰 round 1 수리로 채택안이 flex 파생 → 행마다 같은 명시 트랙의 grid (대안 C2) 로 바뀌었다.

## 1. 전제 기록

- 새 ADR 이다 — 기존 ADR 의 분리 · fork 가 아니다 (ADR-256 Phase 5i 가 만든 노드 Table 위에 배치 규칙을 얹는다. 256 의 「열 수 = 칸 수」 판정만 Phase 2 에서 colSpan 합으로 넓힌다). 바운드 열 폭 (ADR-241 · 150 의 `resolveTableColumnEffectiveWidth`) 은 이 트랙 목록으로 대체된다.
- base / 응용: 트랙 목록 (Phase 1) 이 base, colSpan · 칸 값 · 표 단위 값 · Preview 조작 (Phase 2 ~ 4) 이 응용이다. 순서를 뒤집지 않는다.
- D1 무변경 — RAC Table 부품 그대로. grid 는 행 요소의 CSS 배치다. 열 크기 조절도 RAC `ResizableTableContainer` · `ColumnResizer` 를 그대로 쓴다.

## 2. Phase

### Phase 0 — 인벤토리 (G0)

- 영향 집단 세기 (seed · `reusableOriginLibrary.ts` · 로컬 프로젝트 IndexedDB `composition-catalog-projects-v1` · 예제 fixture):
  - (a) Column · Cell 에 Styles 폭 (`visual.width` · `flex*` · `min/max-width`) 이 작성된 노드
  - (b) 폭을 안 적은 바운드 열 (지금 150px) · 숫자 `width` 가 있는 바운드 열
  - (c) TableView 에서 긴 무공백 글자로 열이 넓어진 칸 (지금 자동 최소 크기 — 트랙 `minmax(0, …)` 에서 바뀐다)
  - (d) 숫자 문자열 폭 (`"120"`) · fr 이 든 `minWidth`/`maxWidth` (m2 — 검증기 전환 대상)
  - (e) 트랙으로 표현 못 하는 조합 (`Nfr` + `maxWidth` · px 폭 + `%` min/max · `%` 폭 + px min/max)
  - (f) 사용자 결정 1 의 재료 — 표 폭 < 75 × 열 수 인 Table (RAC/S2 기본 최소 폭 75px 를 고르면 모양이 바뀌는 집단) · 선택 checkbox 열이 있는 Table 과 그 열의 지금 폭 (S2 는 고정 40px)
- 열 index 판정이 닿을 경로: 정적 Row (노드) · 바운드 투영 (`resolver.ts:1060-1180`) · TableView (`TABLEVIEW_CHILD_STYLE`) · 선택 checkbox 열 (`Checkbox[slot=selection]` 이 든 Column · Cell).
- 기준선: ADR-248 G3 하니스의 Table · TableView 항목 PNG · 현재 열 폭 표 (Canvas layout map · DOM rect).
- 엔진 실측 2건 (가설 1 + 반증 1): ① 기존 grid 행의 `gridTemplateColumns` 를 `updateStyleRaw` 로 바꿨을 때 새로고침 없이 배치가 따라오는가 (R1 — 2026-06 증상 재현 여부) ② 폭 300 · 칸 padding 8 · `minmax(0,1fr) minmax(0,2fr)` + `span` 이 엔진에서도 100 · 200 · 200 인가 (Chrome 실측은 본문 Context 5).
- 결과는 이 문서 §5 에 적는다 (`docs/adr/evidence/` 는 로컬 전용).

### Phase 1 — 트랙 목록 (G1 · G5 · G6)

사용자 결정 1 · 2 · 3 확정 (2026-10-10 권장안 — 기본 폭 `1fr` + 기존 바운드 열 `width: 150` 전환 · 기본 최소 폭 75px · checkbox 열 template `width: 40` · Column Styles 폭 → `width` · Cell Styles 폭 삭제 · 표현 못 하는 조합은 저장 · 미적용 · 안내). 기존 모양이 바뀌는 집단 (Phase 0 (a) · (c) · (f)) 은 집계 뒤 수와 함께 확정.

- binding: Column accepts 에 `width` · `defaultWidth` (`ColumnSize` — 숫자 px · `"Nfr"` · `"N%"`), `minWidth` · `maxWidth` (`ColumnStaticSize` — 숫자 px · `"N%"`). 검증기: 숫자 문자열 거부 (S2/RAC 타입은 `` `${number}` `` 를 허용 — 표기만 좁히는 composition 제한으로 binding 머리말에 적는다) · min/max 의 fr 거부. `width` 가 `defaultWidth` 를 이긴다 (S2 의 controlled · 초기값 — 문서에는 둘 다 작성된 폭).
- 트랙 함수 (shared, 순수): Column 목록 → 트랙 배열. px → `Npx` (px min/max 미리 clamp), fr → `minmax(<minWidth — px · `N%` 그대로, 없으면 기본 최소 폭 — 사용자 결정 1 (i): RAC/S2 75px 또는 0>, Nfr)`, % → `N%` (`%` min/max 미리 clamp), 없음 → 기본 (사용자 결정 1). 선택 checkbox 열 트랙은 사용자 결정 1 (ii) (S2 = 고정 40px). 사용자 결정 3 의 조합 처리.
- resolver: Table · TableView 의 TableHeader (머리글 행) · Row (정적 · 바운드 투영) 에 파생 `display: grid` · `gridTemplateColumns`. 바운드 투영의 `fixed()` 칸 폭 (`resolver.ts:1172`) 을 지우고 같은 트랙을 쓴다. Cell 의 폭 style 은 열 안에서 효과 없음 (사용자 결정 2 처리).
- 재해석 큐: Column 폭 변경 · 열 추가 · 삭제 · 순서 변경 → 그 Table 의 머리글 행 · Row 전부 (density 큐 동형, `compositionRoot.ts`).
- 엔진: Phase 0 ① 이 RED 면 `update_style` (`tree.rs:805`) 의 grid 캐시 무효화를 먼저 고친다 (TS rebuild 가드 금지).
- DOM: Row (`tr`) inline `display: grid; grid-template-columns`. 머리글은 RAC 가 만드는 `tr` 이라 TableHeader (`thead`) 에 CSS 변수 (`--table-column-tracks`) 를 싣고 `Table.css` 의 `.react-aria-TableHeader > tr` 가 읽는다. TableView 는 `TABLEVIEW_CHILD_STYLE` 의 Row · TableHeader `flex` 를 파생 트랙으로, Column · Cell `flex: 1` 은 지운다. `Table.css` 의 `:last-child { flex: 1 }` 삭제.
- 로드 시 1회 전환 (`s2PropAlignment.ts` 표): 사용자 결정 1 · 2 의 처리 — 예) 폭 없는 바운드 열에 `width: 150`, Column Styles 폭 → `width`, Cell Styles 폭 삭제, 숫자 문자열 → 숫자.
- 테스트: 트랙 함수 unit (px · fr · % · px/`%` 하한 · 표현 못 하는 조합) — 기대값은 설치 RAC `calculateColumnSizes` 를 같은 입력으로 돌린 값 (독립 oracle — 기본 최소 폭은 RAC 기본 75, 결정 1 (i) 이 0 일 때만 `getDefaultMinWidth: () => 0` 을 주고 기록 · 표 폭 < 75 × 열 수 입력 포함) · 열 index unit · resolver 파생 unit (Table · TableView · 바운드) · 로드 전환 unit · 원복 RED (파생 끊기 · 재해석 큐 빼기 · `minmax` 하한 0 빼기 · 바운드 `fixed()` 되살리기).
- live: `apps/builder/scripts/table-column-tracks-live.mjs` — G1 fixture, Compare Mode 에서 Canvas layout map 과 Preview rect 를 열마다 비교, 폭 편집 · undo · 열 추가 · 삭제 · 순서 변경 직후 (새로고침 없이) 재측정.

### Phase 2 — colSpan (G2)

- Cell accepts `colSpan` (정수 ≥ 1, 기본 1) → 파생 `gridColumn: span k` (엔진 §25 span) · RAC `Cell` 에 `colSpan` (D1 그대로 — RAC 가 `aria-colspan`).
- ADR-256 의 행 칸 수 판정을 colSpan 합으로. 열 추가 · 삭제의 칸 동기화: 걸친 열을 지우면 colSpan − 1, 걸친 자리에 열을 넣으면 colSpan + 1.
- 테스트 · live: G2 fixture 를 Phase 1 스크립트에 추가.

### Phase 3 — 칸 값 · 표 단위 값 (G3)

착수 전 사용자 결정 6 · 7.

- Cell `align` (start · center · end, 기본 start) · Column `align` (머리글 칸 자신): 글자 정렬 + 칸 안 자식의 가로 정렬. 같은 열 Cell 로 물려주지 않는다 (S2 — 사용자 결정 7 이 확장을 고르면 그때만).
- Cell `showDivider` (기본 false): 오른쪽 1px `{color.border}` 구분선 (rule rootSelector · Canvas border).
- Cell `isSticky` 는 들이지 않는다 (S2 `@private` · RAC 공개 API 없음 — 본문 Decision 4).
- Table · TableView `selectionStyle`: checkbox (기본) · highlight. highlight 면 RAC `selectionBehavior="replace"` · 선택 checkbox 노드 숨김 (presence) · 그 열의 트랙 제외 · 선택 행 배경 값 (사용자 결정 6).
- Table · GridList · Badge `overflowMode`: truncate · wrap (기본값 S2 대로 — Table · TableView · GridList truncate, Badge wrap) — 칸 · 항목 글자의 `white-space` · `text-overflow`, Canvas paragraph 의 같은 채널 (`canvasBinding.ts:464-484`). wrap 이면 행 높이가 글자를 따른다 (바운드 행은 ADR-150 실측 캐시).
- 테스트: 축마다 unit + 원복 RED · G3 하니스 항목 추가.

### Phase 4 — Preview 조작 (G4)

착수 전 사용자 결정 4 · 5.

- 4a 정렬: Column accepts `allowsSorting`. RAC `onSortChange` → Preview 실행 상태의 `sortDescriptor` → 행 재배열 (바운드: 필드 값, 정적: 사용자 결정 4). Canvas 는 문서 순서 · 정렬 표시는 문서의 초기 `sortDescriptor` 만 (있다면). 문서 revision 불변.
- 4b 열 크기 조절: Column accepts `allowsResizing`. Preview 만 `ResizableTableContainer` 로 감싸고, 감싼 동안 내내 (첫 렌더부터) RAC `TableColumnResizeStateContext` 의 열 폭 (px) 목록을 머리글 행 (CSS 변수) · Row 의 트랙으로 바꾼다 — RAC 가 table 에 inline `width: min-content` (`Table.mjs:498-505`) 를 주므로 fr 트랙이 남으면 열이 접힌다. Column (`th`) 의 RAC inline `width` 는 같은 px 라 트랙과 맞는다. 끝난 폭은 실행 상태 (사용자 결정 5).
- live: 감싼 직후 (드래그 전) 열 폭이 감싸기 전과 ≤ 1 px · 정렬 클릭 · 드래그 크기 조절 (전후 실제 폭 변화 + RAC 상태 px 일치) · reload 뒤 문서 그대로.

## 3. 파일 경계 (예상)

| 영역           | 파일                                                                                                                  | Phase    |
| -------------- | --------------------------------------------------------------------------------------------------------------------- | -------- |
| binding        | `packages/shared/src/catalog/bindings/{Column,Cell,Table,TableView,GridList,Badge}.binding.ts`                        | 1 ~ 4    |
| 트랙 · 열 판정 | `packages/shared/src/catalog/` 의 새 순수 모듈 1개 (트랙 목록 · 열 index · 값 타입 정규화)                            | 1 · 2    |
| resolver       | `packages/shared/src/catalog/resolution/resolver.ts` (파생 호출 3 경로 — owned · synthesize · template · 바운드 투영) | 1 · 2    |
| 바운드 폭      | `packages/shared/src/collections/resolveCollectionItems.ts` (`resolveTableColumnEffectiveWidth` 대체)                 | 1        |
| 재해석 큐      | `packages/shared/src/catalog/runtime/compositionRoot.ts`                                                              | 1        |
| 엔진 (조건부)  | `packages/engine/src/tree.rs` `update_style` grid 캐시 (Phase 0 ① RED 일 때만)                                        | 1        |
| presence       | `packages/shared/src/catalog/runtime/presence.ts` (선택 checkbox 숨김 · 칸 수)                                        | 2 · 3    |
| DOM            | `runtime/domRegistry.tsx` (`CatalogTable` · Row) · `runtime/tableViewChildStyle.ts` · `components/styles/Table.css`   | 1 ~ 4    |
| rule           | `generated/componentRulesTable.ts` (python 치환만 — Column · Cell flex 삭제 · align · divider · overflow)             | 1 · 3    |
| 로드 전환      | `packages/shared/src/catalog/document/s2PropAlignment.ts`                                                             | 1        |
| 칸 동기화      | ADR-241 · 256 의 열 · 행 동기화 경로 (`catalogRuntime/` 의 Table 명령)                                                | 2        |
| 테스트         | `apps/builder/src/builder/catalogRuntime/__tests__/tableColumnTracks*.test.tsx` · G3 하니스 항목                      | 1 ~ 4    |
| live           | `apps/builder/scripts/table-column-tracks-live.mjs`                                                                   | 1 ~ 4    |
| 문서           | `docs/CHANGELOG.md` · `.claude/rules/ssot-hierarchy.md` (열 트랙 = Column 소유 한 줄)                                 | 각 Phase |

## 4. 검증 순서 (Phase 마다)

1. unit RED → GREEN → 원복 RED (변이마다 실패 확인, 출력은 파일로).
2. shared · builder (· engine 을 고쳤으면 `cargo test`) 스위트 (`pnpm -F <pkg> test`) · `pnpm type-check`.
3. live (headed Chrome · Compare Mode · 인증 세션 재사용) — 해당 Gate fixture, 새로고침 없는 편집 직후 포함.
4. G3 하니스 Table · TableView 항목.
5. CHANGELOG · 커밋 · `git push origin main` (pre-push ratchet = G6).

## 5. Phase 0 결과

2026-10-10 실행 (G0 통과 — go).

**영향 집단 (a ~ f)** — 저장된 문서에서 모두 0:

| 출처                                                                                                                                              | Table · TableView | (a) Styles 폭                               | (b) 폭 없는 바운드 열 · 숫자 폭 | (c) TableView 긴 글자 칸 | (d) 숫자 문자열 · fr min/max | (e) 표현 못 하는 조합 | (f) 좁은 표 · checkbox 열 |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------- | ------------------------------- | ------------------------ | ---------------------------- | --------------------- | ------------------------- |
| 로컬 프로젝트 (사용자 Chrome IndexedDB `composition-catalog-projects-v1` — 프로젝트 1 · entry 4, 다른 IndexedDB 의 `Column`/`TableView` 문자열 0) | 0                 | 0                                           | 0                               | 0                        | 0                            | 0                     | 0                         |
| `reusableOriginLibrary.ts` 원본 (`component-table` · `component-tableview` · `component-table-column` · `component-table-row`)                    | 원본 4            | 0 (`visual` 은 Column 글자 `fontWeight` 뿐) | 0                               | 0 (예시 글자 짧음)       | 0                            | 0                     | 0                         |
| palette (`paletteItems.ts` — Table catalog · TableView overlay)                                                                                   | 원본 그대로       | 0                                           | 0                               | 0                        | 0                            | 0                     | 0                         |
| seed (`tierSeedDefaults.ts` — Table 축 없음) · 로드 전환 (`s2PropAlignment.ts` — TableView `variant` 만)                                          | —                 | 0                                           | 0                               | 0                        | 0                            | 0                     | 0                         |

- 사실: Column binding accepts 에 `width` · `minWidth` · `maxWidth` 가 **없다** (`Column.binding.ts` — `density` · `children` · `isRowHeader` · `size`). 바운드 열 폭은 지금 쓸 수 있는 길이 없어 늘 기본 150px 이다 (`resolveCollectionItems.ts:656`). 그래서 (b) 의 숫자 폭 · (d) · (e) 는 옛 문서에만 있을 수 있고, 로드 시 1회 전환은 그 경우를 위해 남긴다.
- 사용자 결정 1 · 2 의 「집계 뒤 확정」 항목 (기본 최소 폭 75px · Cell Styles 폭 삭제 · TableView 긴 글자 칸): 기존 문서 대상 0 → **권장안대로 확정**. 바뀌는 것은 새로 만드는 표의 모양뿐이다 — palette TableView (열 3) 는 폭 < 225 이면 가로로 넘친다 (RAC/S2 와 같음).

**열 index 판정이 닿을 경로 (d)**: ① 정적 Row — 노드 트리 (resolver 의 owned · template 경로, DOM `domRegistry.tsx:62` `CatalogTable` · Row · Cell), ② 바운드 투영 — `resolver.ts:1052-1212` `projectTableRows` (머리글 Column 과 칸 모두 `fixed()`), ③ TableView — `delegatedDom.tsx:1543` `tableview` + `tableViewChildStyle.ts:25` (Row · Column · Cell `flex`), ④ 선택 checkbox 열 — `presence.ts:334-440` (`Checkbox[slot=selection]` 의 행 · Table 판정 — 열 index 는 쓰지 않는다). 엔진 입력은 `persistentLayoutTree.ts:226` 이 바뀐 노드를 `updateStyleRaw` 로 보낸다 (아래 ① 과 같은 경로).

**G3 기준선 (e)**: `propAxisCanvasDom.browser.test.ts` 의 `Table-nodes` · `Table-selection` PASS (Canvas ↔ DOM, 2026-10-10). `paletteBaseCanvas` 는 로컬 old leg 기준선이 없어 skip (ADR-248 G0 기준선 로컬 전용).

**엔진 실측 (가설 1 + 반증 1)** — `packages/engine/src/tree.rs` 의 `adr257_*` 회귀 테스트 4건 (cargo test 449 PASS):

| #   | 입력 (폭 300, 칸 `padding 0 8px` — 둘째 열은 `0 20px`)                                                                                                   | 엔진                                            | Chrome · RAC                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------- |
| ②   | `minmax(0,1fr) minmax(0,2fr)`, 행 3                                                                                                                      | 0·100 / 100·200 (모든 행)                       | 100 · 200                                                                    |
| ②   | `repeat 3 × minmax(0,1fr)` + 첫 칸 `span 2`                                                                                                              | 200 · 100 (머리글 100·100·100)                  | 200 · 100                                                                    |
| ②   | `minmax(75%,1fr) minmax(0,1fr)`                                                                                                                          | 225 · 75                                        | 225 · 75 (RAC `calculateColumnSizes`)                                        |
| ②   | `120px minmax(75px,1fr) minmax(75px,2fr)`                                                                                                                | 120 · 75 · 105                                  | 120 · 75 · 105 (RAC 알고리즘 손계산 — 75 하한 고정 뒤 나머지, Chrome 미측정) |
| ①   | 위 첫 표를 계산한 뒤 모든 행의 트랙을 `update_style` (wasm `updateStyleRaw` 와 같은 JSON) 로 `2fr 1fr` → `120px 1fr` → 열 추가 (`set_children` + 트랙 3) | 200·100 → 120·180 → 120·90·90, 새로 만들지 않고 | —                                                                            |

- ① 가설 「2026-06 의 증분 트랙 붕괴가 엔진에 남아 있다」 → 반증 GREEN: 엔진 `update_style` 은 트랙 교체 · 열 추가를 새로고침 없이 따라간다. 엔진 수리 (breakdown Phase 1 의 조건부 항목) 는 하지 않는다. TS 쪽 (재해석 큐 → `updateStyleRaw` 가 실제로 모든 행에 닿는가) 은 Phase 1 의 G1 live 가 판정한다.

## 6. Phase 1 결과 (2026-10-10, 미커밋)

| 항목      | 위치                                                                                                                                                                                                                                                                                                           |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 값 타입   | `document/valueType.ts` `catalogColumnSizeFits` · `ValueType` `columnSize` · `columnStaticSize` (`types.ts` · `validation.ts` · `graph.ts` `propValueMatches`) · Inspector kind `column-size` · `column-static-size` (`catalog/types.ts` · `ruleDefinition.ts`) · AI 검증 (`services/ai/compiler/manifest.ts`) |
| binding   | `Column.binding.ts` — `width` · `defaultWidth` (숨김) · `minWidth` · `maxWidth`                                                                                                                                                                                                                                |
| 트랙 함수 | `runtime/tableTracks.ts` — `catalogColumnTrack` (RAC 기본 1fr · 최소 75 · 정적 폭 clamp · 선택 열 40) · `catalogTableRowTracks` · `catalogTableTrackDependents`                                                                                                                                                |
| 파생      | `presence.ts` `catalogDerivedProps` → `_tableTracks` (TableHeader · Row), dependents 에 트랙 의존 · `compositionRoot.ts` 구조 변경 영역 밖 트랙 재파생                                                                                                                                                         |
| Canvas    | `compositionRoot.ts` `styleOf` — `_tableTracks` → `display: grid` + `gridTemplateColumns`                                                                                                                                                                                                                      |
| DOM       | `domBinding.tsx` `catalogTableTrackStyle` (catalogDomStyle · ruleDom) · `Table.css` 머리글 `tr` grid (`--table-column-tracks`) · `:last-child { flex: 1 }` 삭제 · TableView `delegatedDom.tsx` · `tableViewChildStyle.ts`                                                                                      |
| rule      | `componentRulesTable.ts` Column · Cell `containerStyles.flex` 삭제 (python 치환)                                                                                                                                                                                                                               |
| 바운드    | `resolver.ts` `projectTableRows` 의 `fixed()` 150px 삭제 (`resolveTableColumnEffectiveWidth` 는 production 미사용으로 남음)                                                                                                                                                                                    |
| Styles 폭 | `catalogStylesHost.ts` — Column 의 Width · Min · Max → prop (`catalogColumnStyleValue`), 표시도 prop                                                                                                                                                                                                           |
| 로드 전환 | `s2PropAlignment.ts` `migrateCatalogTableColumns` (Column Styles 폭 → prop · Cell Styles 폭 삭제 · 숫자 문자열 → 숫자) — `createCatalogGraph`                                                                                                                                                                  |
| 안내      | `GenericFieldRenderer.tsx` `ColumnSizeField` + `PropertyInput.afterControl` · i18n `columnSizeNotApplied`                                                                                                                                                                                                      |

- 테스트: `adr257ColumnTracks.test.ts` 16 (RAC oracle 12 · 표현 못 하는 조합 · 값 타입) · `adr257TableTracks.test.tsx` 8 (Canvas 정렬 · 편집 직후 · undo/redo · Insert Column · DOM · TableView · 선택 열 · 로드 전환 · Styles 값) · 기존 갱신 2 (`phase4eTableRows` — 바운드 150 → 1fr · `resolveContainerStylesFallback` — Column · Cell flex 없음). shared 1574 · builder 5296 (+1 갱신 뒤 전부 PASS) · parity 811 · G3 Table 2 · type-check 0.
- live: `table-column-tracks-live.mjs` 6/6 — 120 · 1fr · 2fr 에서 머리글 · Cell (x, w) Canvas = Preview = (0,120) (120,599.33) (719.33,1198.67), Design 패널 Width 160 → (120,160) 모든 행, undo, TableView 90, 새로고침 뒤 같은 트랙, 오류 0.
- G6 (부분): 엔진 단 A/B (300행 × 10열, 3쌍 중앙값) grid 9.4 ms ↔ flex 2.2 ms — 행당 31 ↔ 7 µs. 바운드 Table 은 행 window (기본 높이 400 → 12행 안팎) 라 재배치당 약 0.4 ms. 총비용 A/B · pre-push ratchet 은 커밋 뒤. 넘으면 실패 대안 (엔진 grid 캐시 — 같은 트랙 · 같은 행 폭이면 열 위치를 다시 풀지 않음).
- 결정과 다르게 한 것: 본문 Status Phase 1 블록 ① ② (바운드 `width: 150` 전환 생략 · 선택 열 40px 는 트랙 기본값).

## 7. Phase 2 결과 (2026-10-10, 미커밋)

- binding: `Cell.binding.ts` `colSpan` (number, min 1, step 1, **기본 없음** — 기본 1 을 두면 모든 칸이 RAC 에 `colSpan=1` 을 넘겨 RAC 가 colIndex 를 따로 계산하고, 재사용 행 · 열 삭제 시험에서 `Cell count must match column count` 로 throw 했다).
- 배치: `tableTracks.ts` `catalogCellSpan` → `compositionRoot.ts` `styleOf` `gridColumnStart: span k` · `domBinding.tsx` `catalogTableTrackStyle` `gridColumn` · TableView `delegatedDom.tsx`.
- 명령 (`commands/collections.ts`): `cellSpanAt` · `spanSum` · `cellAtColumn` — `tableAlignedIn` · `tableColumnGrid` · `insertTableColumns` · `insertTableRow` 의 칸 수를 span 합으로. `tableColumnCells` 는 span 1 칸만, `tableColumnSpanningCells` 는 걸친 칸 (삭제 → `structure.ts` `removeTargets` 가 span − 1, 숨김 → `tableHidingTargets` 거부). `tableColumnOrder` · `dropTableColumnTemplateCells` 는 걸친 칸이 있는 행에서 거부. `setTableCellSpan` — 늘리면 오른쪽 칸 흡수 (합이 정확히 맞아야), 줄이면 빈 칸 생성 (`buildCell` · `newId` 필요).
- 편집 경로: `editContract.ts` `catalogCellSpanCommand` (`catalogPropertiesPatchCommand` 의 `colSpan` — owned Cell 만, `newId` 는 `CatalogPropertiesPanel` 이 넘김).
- Preview: `domBinding.tsx` `ruleDom` — Row 의 React key 에 칸 span 서명 (RAC 가 행 생성 때의 colIndex 를 유지해 span 이 줄면 throw — 원복 RED 확인).
- 테스트: `adr257ColSpan.test.tsx` 7 (span 2 흡수 · 두 열 덮음 (minWidth 열 · padding 포함) · span 3 → 1 · 맞지 않는 span 거부 · DOM `grid-column` · `aria-colspan` · 걸친 열 삭제 span − 1 · Insert Column · Preview 재그림 · 순서 변경 거부). shared 1574 · builder 5304 · parity 811 · G3 Table 2 · type-check 0.
- live: `table-column-tracks-live.mjs` G2-1 ~ 3 (전체 9/9).

## 8. Phase 3 결과 (2026-10-10, 미커밋)

사용자 결정 6 · 7 = 「S2 대로」 (ADR 본문 결정 줄).

- binding: Column `align` · Cell `align` · `showDivider` (S2 기본 start · false), Column · Cell `overflowMode` (editorHidden — 전파 값), Table · TableView `selectionStyle` (checkbox · highlight, 기본 checkbox) · `overflowMode` (truncate · wrap, 기본 truncate).
- rule (python 치환): Column · Cell `containerVariants` — `align` (center · end → text-align), `overflow-mode` (truncate = overflow hidden + nowrap + ellipsis, wrap = normal + ellipsis — S2 `cellContent`), Cell `show-divider.true` (border-right 1px solid `var(--border)`). Cell variant 에 `colors.border` 를 두면 rule 이 네 변 1px 테두리를 만든다 (`ruleRootBox` `variantBorder`) — 색은 블록에 둔다.
- 컴파일: `rulePartRules.ts` `CELL_TEXT_VARIANT_RULES` (Column · Cell 만 — text-align · white-space · text-overflow · overflow · border-style · border-color · border-right-width) · `TYPE_CONTAINER_VARIANT_AXES` Column · Cell. `ruleDefinition.ts` 의 root variant 규칙이 boolean prop 블록 (`true` · `false`) 을 받는다.
- 전파: `sizePropagation.ts` `CATALOG_TABLE_OVERFLOW_OWNERS` (후속 §11 에서 `CATALOG_OVERFLOW_MODE_OWNERS` 로 개명) → resolver `applyOwnerOverflowMode` (owned · synthesize · **template** 세 경로) · `compositionRoot.ts` 재해석 큐. template 경로 (palette Table 의 Column · Cell) 에 `applyOwnerDensity` 도 없어 palette Table 의 density 가 칸에 닿지 않던 결함을 같이 고쳤다 (시험 `adr257CellValues` palette 항목).
- Canvas: `catalogBindingKeepsOneLine` (cell · column 의 고정 한 줄이 `white-space: normal` 에 비킴 — 측정 · rewrap · 텍스트 binding), `ruleShapes.ts` `catalogRuleNodeData` (rule 도형 경로의 Cell 글자 — wrap 이면 nowrap · 말줄임 안 함, `alignTableText`), `canvasBinding.ts` `RULE_CARRIED_TEXT_KEYS` (자식을 가진 · 빈 Cell · Column 은 글자 키를 안쪽 글자에 상속만 — 거부하면 장면이 깨졌다, live 에서 발견).
- DOM: `domBinding.tsx` `TABLE_CELL_TEXT_CSS` (rule 노드 inline 의 cell 글자 키) · `renderNode` 의 선택 열 숨김 · Row key 에 숨김 서명, `domRegistry.tsx` `CatalogTable` `selectionBehavior` (`resolveSelectionBehavior`) + `data-selection-style`, `tableViewChildStyle.ts` `catalogTableViewCellTextStyle` · `delegatedDom.tsx` TableView 부품 숨김. `Table.css` highlight 선택 행 (S2 `color-mix(… 10%)` · 묶음 둘레 inset 테두리 — 선택은 Preview 실행 상태라 Canvas 는 그리지 않는다).
- 숨김 판정: `tableTracks.ts` `catalogTableSelectionPartHidden` · `catalogTableSelectionParts` → presence `catalogHiddenAtRest` · presence scope (Table · TableView) · 트랙 목록.
- 패널: `labels.ts` · `translations.ts` (Divider · Truncate · Column span · Min width · Max width). boolean 은 칩 묶음이라 binding 라벨 `Show Divider` → 칩 「Divider」.
- 테스트: `adr257CellValues.test.tsx` 9 (align · divider · truncate · wrap · TableView · highlight Table · highlight TableView · Canvas 장면 · palette Table). 원복 RED 14건 전부 RED · 복원 cmp 확인.
- live: `table-column-tracks-live.mjs` G3-1 ~ 5 (전체 14/14) — truncate 한 줄 41 = 41, wrap 직후 행 137 = 137 (Canvas · Preview), align · Design 패널 Divider 칩, highlight 에서 마우스 누름이 선택을 바꿈 (한 행만).
- 미룸: GridList · Badge `overflowMode` (G3 실패 시 대안 — 해당 축만 다음 Phase).

## 9. Phase 4 결과 (2026-10-10, 미커밋)

사용자 결정 4 = 바운드 + 정적 모두 · 5 = 넣고 끝난 폭은 문서에 안 씀 (ADR 본문 결정 줄).

- binding: Column `allowsSorting` · `allowsResizing` (S2, section state — Design 패널 칩 「Allow Sorting」 · 「Allow Resizing」, `labels.ts` · `translations.ts` 크기 조절 허용).
- 정렬 (`runtime/tableSort.ts`): RAC `onSortChange` → `setRuntimeProps(table, { sortDescriptor })` (Preview 실행 상태 — `catalogPreviewInteractions` 가 세션 `sortTable` 에 넘긴다). 작성한 Row: `domBinding` `tableBodyOrder` 가 TableBody 의 Row 를 그 열 칸 글자로 (`catalogTableSortedRows` — colSpan 누적으로 열 찾기, `Intl.Collator` numeric · base), TableBody 는 Table 의 runtime props 를 구독. 바운드 행: resolver `projectTableRows` 가 `tableSort` (8번째 인자 — `compositionRoot` 옵션 · 세션 `tableSorts`) 로 전체 행을 필드 값으로 정렬한 뒤 fixed 높이가 보이는 행을 자른다 (DOM 만 정렬하면 보이는 14 행 안에서만 정렬된다). 세션 `sortTable` 은 바운드 root 를 다시 해석한다 (`refreshRows`). 열 키: RAC 는 Column 의 작성자 HTML id 를 key 로 쓴다 (`withHtmlId`) — `catalogTableColumnKey` (htmlId ?? record id) 를 DOM · resolver 가 같이 쓴다. S2 정렬 아이콘: `tableOperationsDom.tsx` `catalogColumnChildren` (정렬된 동안만 arrow-up · arrow-down 16px · 글자 앞 8px — `Table.css`).
- 크기 조절: `catalogTableResizable` (Column 하나라도 `allowsResizing`) → `domRegistry` `CatalogTable` 이 RAC `ResizableTableContainer` 로 감싼다 — container 가 Table 의 상자 (inline style · `Table.css` 의 `[data-node-table-container]` 기본값: 테두리 · 바탕 · 모서리 · 높이 · `overflow: auto`), table 은 테두리 · 바탕 없이 행 배치만 (RAC `width: min-content` · table 이 스크롤 요소면 RAC 가 table 폭으로 재서 열이 최소 폭에 묶인다). 머리글 행 · Row 트랙 = `var(--table-resized-tracks, <트랙>)`, 첫 Column 안 `CatalogTableResizeTracks` 가 RAC `TableColumnResizeStateContext` 의 열 폭 (px) 을 table 에 쓴다. S2 `width` 는 controlled 라 드래그가 막힌다 — 감싼 Table 에서는 `defaultWidth` 로 넘긴다. RAC `ColumnResizer` (12px 손잡이 · 1px 선 · 드래그 중 2px `--informative`, 열 hover 때만 — S2 `resizerHandle`).
- Canvas: 바뀐 것 없음 (정렬 · 크기 조절은 Preview 실행 상태, 쉬는 상태 Preview 에는 아이콘 · 손잡이가 없다).
- 테스트: `preview/catalog/__tests__/adr257TableOperations.test.tsx` 5 (작성 표 정렬 · 정렬 안 하는 열 · 바운드 30 행 fixed 높이 전체 정렬 · 크기 조절 감싸기 · 감싸지 않음). 원복 RED 8: resolver 정렬 · `tableBodyOrder` · 감싸기 · 트랙 var · 열 키 htmlId · TableBody 구독 · 세션 `tableSort` 는 단위 RED, `width` → `defaultWidth` 전환은 jsdom 이 폭을 못 재 단위 GREEN → live G4-3 FAIL (드래그 뒤 폭 그대로) 로 반증. 복원 `cmp` 확인.
- live: G4-1 ~ 4 (전체 18/18) — 칩 → Preview 머리글 누름 (pointer events) 으로 a · b9 · b10 / b10 · b9 · a, `aria-sort` · 아이콘, 히스토리 · Canvas 순서 그대로 · 감싼 직후 120 · 1798 그대로 · 드래그 1798 → 1738 (머리글 · 3 행 Cell = RAC px) · 새로고침 뒤 문서 순서 · 폭. Compare Mode 의 좌표 누름은 Builder overlay 가 받아 드래그도 iframe 안 pointer events 로 보냈다.
- 회귀: shared 1574 · builder 5318 · parity 811 · G3 Table 2 · type-check 0.
- 미룸: TableView 의 정렬 · 크기 조절 (TableView 는 RAC 에 없는 S2 (react-spectrum.adobe.com/TableView) 컴포넌트이고, S2 1.8.0 은 그것을 RAC `Table` 위에 만든다 (`TableView.tsx` — `ResizableTableContainer` > `Virtualizer` > RAC `Table`, 감싸기는 늘). 우리 Preview 는 그 구조가 아니라 composition div 로 그려 (선택도 없다) 두 조작을 붙일 RAC 상태가 없다 — S2 구조로 옮기는 별도 작업), GridList · Badge `overflowMode` (Phase 3).

## 10. Phase 5 결과 (2026-10-10, 미커밋) — TableView 를 S2 처럼 RAC Table 위로

사용자 지시 「TableView 를 S2 처럼 RAC Table 위로 옮겨라」 (Phase 4 미룸 ① — 이 ADR 안에서 닫음, scope 는 사용자 지시가 정함).

- 레퍼런스: TableView 는 RAC 에 없는 S2 컴포넌트 (react-spectrum.adobe.com/TableView). S2 1.8.0 `TableView.tsx` 는 `ResizableTableContainer` (늘) > `Virtualizer` > RAC `Table` (`selectionBehavior` = `selectionStyle`).
- DOM: `domRegistry.tsx` `CatalogTableView` — container 가 `.react-aria-TableView` (variant · density · 레코드 style · `overflow: hidden`), 안쪽 RAC Table 은 테두리 · 바탕 없이 행 배치만 (`RESIZABLE_TABLE_STYLE` · `data-node-table`). `INTERNAL_RENDERERS.tableview`. 옛 `delegatedDom` `tableview` (composition div + `TABLEVIEW_CHILD_STYLE`) 와 `renderFacetDeclaration` delegating 등록을 지웠다 (inventory 33 → 32). 부품은 Table 과 같은 `ruleDom` 경로 — 모양은 부품 record (Canvas 와 같은 값), 옛 손 미러 (`TABLEVIEW_CHILD_STYLE` padding 8 · font 16/24) 는 쓰이지 않는다.
- `ruleDom`: TableView 는 늘 `resizable` (트랙 = `var(--table-resized-tracks, …)` · 문서 `width` → `defaultWidth` · 첫 Column 이 RAC 폭을 씀), Table 의 정렬 props (`sortDescriptor` · `onSortChange`) 를 TableView 에도. `Table.css` 의 resizer 규칙을 TableView container 와 공용으로.
- 결함 수리: 감싼 Table · TableView 는 문서 열 폭이 RAC `defaultWidth` 라 Builder 편집이 Preview 에 닿지 않았다 (live G1-4 FAIL 로 발견, 새로고침하면 맞음 — Phase 4 의 크기 조절 Table 에도 있었다). `tableColumnWidthKey` (Column 들의 id · S2 폭 4종) 를 Table 요소 key 에 넣어 문서 폭이 바뀌면 다시 만든다.
- 테스트: `adr257TableOperations` +3 (TableView 구조 · 선택 · 정렬 · resizer · 문서 폭 편집), `adr257TableTracks` TableView 항목을 RAC 구조로, `renderFacetDeclarationContract` inventory. 원복 RED: `tableview` 등록 · TableView 늘 resizable · width key · TableView 정렬 props 4건 RED. Table 이 Column 을 구독하는 코드는 단위 · live (21/21) 모두 GREEN 이라 지웠다 (Preview delta 에서 Table 이 이미 다시 그려진다).
- live: G5-1 ~ 3 + G1-4 (전체 21/21). 회귀: shared 1574 · builder 5321 · parity 811 · G3 Table 2 · type-check 0.
- 삭제: 쓰는 곳이 없어진 `tableViewChildStyle.ts` (`TABLEVIEW_CHILD_STYLE` · `catalogTableViewCellTextStyle`) — 사용자 승인 (2026-10-10). TableView 의 Table 단위 `allowsSorting` prop (S2 에 없는 옛 surface) 은 그대로.

## 11. 후속 결과 (2026-10-10, 미커밋) — GridList · Badge `overflowMode`

사용자 지시 「GridList · Badge overflowMode 도 진행해」 (Phase 3 의 미룸 항목). 값 · 기본값은 사용자 결정 6 (S2 대로).

- 레퍼런스 (S2 1.8.0): ListView `overflowMode` 기본 truncate — 항목의 `label` · `description` 이 `truncate` (한 줄 · 말줄임), wrap 이면 `white-space: normal` (`DragPreview.tsx` `label` · `description`). Badge `overflowMode` 기본 wrap — 글자를 감싼 `Text` 가 `overflow: hidden` · 말줄임, truncate 면 `nowrap` (`Badge.tsx`).
- binding: GridList `overflowMode` (truncate · wrap, 기본 truncate) · GridListItem `overflowMode` (editorHidden — 운반 값) · Badge `overflowMode` (wrap · truncate, 기본 wrap). Design 패널은 두 값 segmented (Overflow).
- GridList: resolver `applyOwnerOverflowMode` 가 GridList 의 값을 항목에 (`CATALOG_OVERFLOW_MODE_OWNERS` 에 `GridListItem: ["GridList"]` — Table 전용 이름에서 개명), `compositionRoot` 재해석 큐가 같은 표를 읽는다. GridListItem rule 의 top-level `containerVariants["overflow-mode"]` 의 `nested` (`> .react-aria-Text`) 가 part rule 로 항목 안 Text record 에 `whiteSpace` · `overflow` · `textOverflow` 를 준다 (`containerVariantPartRules` 가 이 축에서만 `cellTextVisual` 을 읽는다 — `TEXT_BOX_VARIANT_AXIS`). Canvas 텍스트 leaf 는 말줄임 · 잘림을, DOM 은 Text 의 inline style 을 같은 값으로.
- Badge: rule 의 top-level `containerVariants["overflow-mode"]` → `TYPE_CONTAINER_VARIANT_AXES.Badge` · `TEXT_VARIANT_RULES` (옛 `CELL_TEXT_VARIANT_RULES`) 로 record visual `whiteSpace` (· `textOverflow`). Canvas: 측정 (`singleLine`) 과 rule painter (`ruleShapes.ts` — truncate 면 `nowrap` + 말줄임, 종전의 Badge `nowrap` 고정 삭제) · `RULE_CARRIED_TEXT_KEYS.Badge`. DOM: `RULE_TEXT_BOX_BINDINGS` (옛 `TABLE_CELL_TEXT_BINDINGS`) 에 badge — inline `white-space`, Badge.tsx `data-overflow-mode` + 글자 span `.badge-text` (S2 `Text` 자리 — inline-flex 상자 바로 안의 글자는 말줄임이 안 된다), `Badge.css` 의 두 값 · 글자 상자. top-level 블록이라 생성 CSS diff 0 (ColorSwatch `rounding` 과 같은 배치).
- 편차: 줄바꿈된 Badge 의 줄은 가운데 정렬 — Canvas 의 box 형 글자 계약 (`buildCatalogShapes` — Button · Badge 가운데) 에 DOM 글자 상자를 맞췄다. S2 는 줄을 시작 정렬한다 (한 줄 Badge 는 S2 도 `justify-content: center` 로 가운데).
- Changed: Badge 는 종전 DOM · Canvas 모두 `nowrap` 고정이었다 — 이제 S2 기본 wrap 이라 좁은 자리에서 줄을 바꾼다.
- 테스트: `catalogRuntime/__tests__/adr257OverflowMode.test.tsx` 4 (GridList truncate 기본 — record · DOM · Canvas 칠, wrap 편집 · undo, Badge wrap 기본 · 가운데 정렬, truncate 편집 — Canvas 말줄임 · DOM). `defaultPropsOracle` 에 Badge `overflowMode`. 원복 RED 7: owner 표 · part rule 글자 상자 · Badge rule 축 · rule painter · DOM inline · `data-overflow-mode` · Canvas 운반 키 모두 RED, 복원 `cmp` 확인. `Badge.css` 가운데 정렬은 live L4 가 잡는다. 단위 레이아웃은 글자 측정이 없어 높이는 live 로.
- live: `apps/builder/scripts/overflow-mode-live.mjs` 6/6 (ADR 본문 Live Exercise). 회귀: shared 1574 · builder 5325 · parity 811 · G3 prop-axis 60 · type-check 0 · stale-symbols 0.
