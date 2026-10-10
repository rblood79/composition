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

착수 전 사용자 결정 1 · 2 · 3.

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

(Phase 0 실행 때 기록)
