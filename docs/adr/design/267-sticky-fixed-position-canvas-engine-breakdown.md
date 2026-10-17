# ADR-267 design breakdown — position sticky · fixed 의 Canvas 지원

> 본문: [ADR-267](../completed/267-sticky-fixed-position-canvas-engine.md). 이 문서는 구현 상세 (phase · 파일 · 체크리스트 · fixture) 와 Phase 0 inventory 의 결론을 둔다. 수치는 측정 뒤 여기에 적는다 — 본문에는 옮기지 않는다.

## 1. 전제 lock-in

- 분리 아님 — 새 ADR 하나. base/응용 · schema 직교성 질문은 해당 없음. 선행 ADR-164 의 「fixed = absolute 근사」 전제는 **승계하지 않는다** — Phase 0 이 실제 경로 (`styleOf` 가 떨어뜨려 in-flow static) 를 다시 확인했고, fixed 의 재개는 사용자 결정 1 로 판정한다.
- sticky 와 fixed 는 별도 feature (정본 §7-4 X8 · 사용자 요청 원문 「fixed 는 viewport 기준 별도 phase」). 같은 ADR 의 Phase 1 · Phase 2.
- oracle: Chrome `getBoundingClientRect` (ADR-156 차등 oracle, browser vitest) · Compare Mode 픽셀 (live). Blink 코드는 지도.
- 한 격차 = 한 커밋 = 원복 RED 1 + cross-check (또는 live) 1 (정본 §0-2).

## 2. Phase 0 — inventory · RED · 기준선 (동작 변경 0)

- [x] **입력 전수 표**: `componentRulesTable.ts` 의 `position: "sticky"` (현재 2 — `Header` :5599 inset 없음 · `ListBox` 섹션 헤더 :6903 `top`) · 수동 시트 (`Table.css:176` `.react-aria-Sticky` · `GridList.css:103`) · `Table.runtime.tsx:104 sticky?` · 생성 CSS `position: fixed` (overlay archetype `CSSGenerator.ts:154` → Modal · Popover, 수동 `overlays.css:5` · `Toast.css:24`). 각각 Canvas 도달 여부 · 범위 안/밖 표기.
- [x] **RED fixture**: 단독 ListBox (높이 저작 · `overflow: auto` · 섹션 2 · 항목 충분) 를 Preview 와 Canvas 에서 같은 양 스크롤 → 섹션 헤더 y 가 다름. ADR-156 oracle 형식 (`apps/builder/tests/parity/stickyPosition.browser.test.ts` 신설) 으로 RED 를 기록.
- [x] **입력 0 동일성 단언**: sticky 입력이 없는 fixture (기존 parity 스위트 + G3 하니스 78/79) 의 엔진 geometry 와 명령 스트림을 Phase 1 전후 바이트 비교할 수단 (기존 `engineCssParity` · G3 하니스 재사용 — 새 하니스 만들지 않음).
- [x] **단언 자리 목록**: geometry 출력 길이 · 순서를 단언하는 테스트 (`apps/builder/tests/parity/*` · `packages/engine/src/tree.rs` 테스트 · `apps/builder/src/builder/catalogRuntime/__tests__/*`) 를 grep 으로 세어 R1 범위 확정.
- [x] **unsafe 카운트 기준선**: RED fixture 문서의 `renderCounters` (`fullRepaint` 계열 · `pageGridMoveNullFixedOrSticky`) 를 `--fixed-inputs` 2 회 같은 값으로 기록.
- [x] **go/no-go**: RED 가 재현되면 go. 재현되지 않으면 정본 X8 재판정 → ADR Deprecated.

## 3. Phase 1 — sticky (대안 A)

순서는 전송 → 엔진 → 소비 → 문서. 각 단계가 한 커밋, 각 커밋에 원복 RED 1.

### 1-a 전송 — rule · 노드 값이 엔진까지

입력 2개는 Canvas 에 닿는 길이 서로 다르다 (리뷰 Round 1 H1 — 2026-10-17 코드 대조):

| 입력               | 값이 있는 곳                                                                                                                                                                               | 지금 Canvas 에 닿는 길                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 1-a 에서 고칠 곳                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `Header` rule 루트 | `containerStyles.position: "sticky"` (:5599, inset 없음)                                                                                                                                   | `typedCanvasBox` (`ruleDefinition.ts:191-192`) — `relative` 만 남긴다                                                                                                                                                                                                                                                                                                                                                                                                                | `typedCanvasBox` 에 `sticky` 통과. inset 이 없으니 constraints 는 「없음」 (1-b) — 변화 0 이 기대값 |
| ListBox 섹션 헤더  | `rootSelectors["&:not(.react-aria-Popover *)"].nested[".react-aria-ListBoxSection .react-aria-Header"]` (:6844-6904 — `position: sticky` · `top: calc(-1 * var(--border-width-hairline))`) | **part compiler 로는 닿지 않는다.** `compileRulePartRules` (`rulePartRules.ts:1717-1760`) 는 archetype · `staticSelectors` · `sizeSelectors` · delegation 만 모으고 `rootSelectors.nested` 를 읽지 않는다. `parseSimple` (:244-254) 도 자손 조합 선택자를 받지 않는다. Canvas 의 섹션 헤더 모양은 손으로 옮긴 part rule `manualBoxRules.ts` `ListBox` (:333-376 — `childType: "Header"` · `via: "ListBoxSection"` · `layout: { display: "block" }`) 이 준다 — position · top 이 없다 | 아래                                                                                                |

- **ListBox 섹션 헤더 — 값은 table 에서 읽는다**: `manualBoxRules.ts` `ListBox` 의 Header part `layout` 에 `position` · `insetTop` 을 **손으로 적지 않고** rule 의 nested 블록에서 읽는다 (선례: `catalogListItemFlexShrink` `rulePartRules.ts:705-731` — 같은 `&:not(.react-aria-Popover *)` 블록을 읽는다). 값 해석: `top` 의 `calc(-1 * var(--border-width-hairline))` → `-resolveToken("{border.width.hairline}")` px (이 파일이 이미 `hairline` 을 같은 토큰으로 푼다 :346). 해석 못 하는 inset (`calc` 다른 형태 · `%`) 은 「없음」 이 아니라 **throw 하는 unit** 으로 막는다 — 조용히 0 으로 떨어지면 Header rule 과 같은 「붙지 않음」 으로 보여 RED 가 GREEN 으로 가려진다.
- **Popover 조건**: nested 블록은 `:not(.react-aria-Popover *)` 아래라 단독 ListBox 에만 해당한다. picker 의 ListBox (Popover 안) 는 Canvas 가 닫힌 목록을 그리지 않으므로 (`presence.ts` `TRIGGER_OVERLAY_CHILDREN`) 도달 0 이지만, part rule 이 Popover 안 ListBox 에도 붙는 경우가 있으면 (Phase 0 inventory 에서 `manualBoxRule("ListBox")` 소비 자리 grep) sticky 를 Popover 밖 조건에만 싣는다.
- **검증기 — 라이브러리 rule 과 노드 저작을 나눈다 (리뷰 Round 2 H1)**: `validation.ts:195` `layoutValueChoices.position` (`static · relative · absolute`) 하나를 두 검증 함수가 같이 쓴다. 그대로 두면 위 값이 resolver 에 닿기 전에 `buildCodeCatalogLibrary` → `buildCatalogLibrary` (`library.ts:209-214`) → `validateLibraryDefinition` 에서 `INVALID_LAYOUT_VALUE` (`library.definition.partRules[0].layout.position` · 루트 Header 는 `library.definition.layout.position`) 로 **코드 라이브러리 생성 자체가 실패**해 Builder 가 프로젝트를 열지 못한다 (`catalogRuntime/library.ts:10`). 호출 자리 실측 (2026-10-17):

  | 검증 함수             | 호출 자리                                                                                                                                                                                                            | 입력 출처                                                                                                                                       | Phase 1 의 `position`                        |
  | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
  | `layoutValues` (:599) | `validateLibraryDefinition` 의 `library.definition.layout` (:1575) · `ruleOutput` (:841 → partRules · rules :1591 · :1620) · `validateLibraryTemplate` 의 `library.template.layout` (:1743) · template patch (:1775) | 코드 catalog 뿐 — 호출자는 `buildCatalogLibrary` 하나 (`codeCatalogLibrary.ts:737` · fixture). 문서 · IndexedDB · 내보낸 파일에 저장되지 않는다 | `+ sticky`                                   |
  | `layoutWrites` (:608) | `entry.layout` (:1224) · responsive layer (:792) · descendant patch · `fillSlot` (:893)                                                                                                                              | 문서 (사용자 저작)                                                                                                                              | 그대로 (`sticky` · `fixed` 거부 — 결정 1 전) |

  그래서 `layoutValueChoices` 를 둘로 나눈다 — 저작용 (지금 값) 과 라이브러리 rule 용 (저작용 + `position: sticky`). `fixed` 는 어느 쪽에도 넣지 않는다 (Phase 2). 문서 스키마 · `LIBRARY_CONTRACT_VERSION` 은 바뀌지 않는다 — 저장되는 쪽 (`layoutWrites`) 의 허용 집합이 같고, 라이브러리는 세션마다 코드에서 다시 만든다. unit (`validation` 스위트): ① 라이브러리 definition · part rule 의 `position: sticky` + `insetTop: "-0.5px"` 통과 · ② `entry.layout` · responsive layer · descendant patch 의 `position: sticky` 는 여전히 `INVALID_LAYOUT_VALUE` · ③ 라이브러리 rule 의 `position: fixed` 거부.

- `rulePartRules.ts:500` — part rule 의 `position` 필터에 `sticky` 통과 · inset 4 (`top · right · bottom · left` → `insetTop…`) 를 layout 으로 (일반 경로 — staticSelectors 로 오는 향후 입력용).
- `packages/shared/src/catalog/runtime/compositionRoot.ts:1258-1270` `itemLayout` — `position: sticky` + inset 전송 (저작 노드는 스키마상 아직 올 수 없음 — rule · part rule 값 경로만 실효).
- **RED 는 end-to-end 로**: 필터 unit 만으로 닫지 않는다. 실제 `buildCodeCatalogLibrary()` (검증 포함) 로 만든 라이브러리 위에서 단독 ListBox > ListBoxSection > Header 문서를 실제 catalog → resolver → `styleOf` 로 돌려 Header 의 엔진 입력에 `position: "sticky"` 와 **수치 `insetTop` (−hairline px)** 이 도착하는지 단언 (`packages/shared/src/catalog/runtime/__tests__/` — 기존 `compositionRoot` 스위트 형식). 반례 대조: nested 블록의 `top` 을 메모리에서 바꾸면 엔진 입력도 바뀐다 (리뷰가 쓴 「바꿔도 출력 동일」 프로브의 반대 방향).
- 원복 RED: ① `typedCanvasBox` 가 다시 떨어뜨림 → Header rule 단언 RED · ② manual Header part 가 nested 블록을 안 읽음 → 위 end-to-end 단언 RED + 1-c 의 「중간」 fixture RED · ③ 라이브러리 rule 용 선택지에서 `sticky` 를 빼면 `buildCodeCatalogLibrary` 가 `INVALID_LAYOUT_VALUE` 로 실패 (end-to-end 단언 RED) · ④ 저작용 선택지에 `sticky` 를 넣으면 unit ② RED.

### 1-b 엔진 — constraints (Blink `ComputeStickyPositionConstraints` 계약)

- `packages/engine/src/tree.rs` — sticky 상자는 in-flow 그대로 (레이아웃 결과 불변). 레이아웃 뒤 sticky 노드마다:
  - **scroll container**: 가장 가까운 조상 중 **CSS scroll container** 인 것 — `overflow` 한 축이라도 `hidden · scroll · auto` (`clip` · `visible` 제외, [CSS Overflow 3 §valdef-overflow-hidden](https://www.w3.org/TR/css-overflow-3/#valdef-overflow-hidden)). 판정은 엔진의 기존 단일 술어 `is_scroll_container` (`tree.rs:6264-6282`) 를 그대로 쓴다 — **`catalogOverflowScrolls` (`canvasOverflow.ts:36-37`, `auto · scroll` 만) 를 쓰지 않는다**: 그것은 Canvas 의 사용자 스크롤 UI (스크롤바 · wheel) 판정이고 sticky 기준 조상 판정이 아니다 (리뷰 Round 1 M3 — Chrome 155 실측: outer `auto` scrollTop 100 > section `hidden` > sticky Header 는 y=−100, 즉 hidden section 이 owner 라 outer 와 함께 흘러간다. `visible` · `clip` 대조군은 y=0). 없으면 page root. owner id 를 geometry 에 실어 TS 는 재판정하지 않는다 (R2). `hidden` owner 는 Canvas 에서 스크롤 오프셋이 늘 0 이라 보정 0 — 이것이 Chrome 결과와 같다.
  - **sticky container (containing block)** 기준 영역: scroll container 자신이면 scrollable overflow rect (`:591-593`), 아니면 padding box (`:595`) → 그 상자의 padding 을 뺌 (`:610-611`).
  - sticky 요소 margin 제외 (`:612-625`) · 4 inset (auto 는 「없음」 — 전부 auto 면 constraints 자체 없음) · static rect.
  - 출력: geometry 의 **선택 필드** (sticky 노드만). 길이 · 순서 기존 불변 (R1).
- Rust unit test: 정본 X8 fixture 「`overflow:auto; height:200px; padding-bottom:40px` 안 `sticky; top:0` 헤더」 + margin · 양쪽 inset · inset 없음 · scroll container = containing block · **`auto` 바깥 > `hidden` 안 경계 (owner = hidden 쪽)** · `clip` 경계 (owner = 바깥 `auto`).
- 원복 RED: constraints 를 비우면 1-c fixture RED.

### 1-c 소비 — binding · renderCommands · stickyResolver

- `apps/builder/src/builder/catalogRuntime/canvasBinding.ts:1455-1476` — geometry 의 sticky constraints 를 `SkiaNodeData.sticky` 로 (기존 `isSticky · stickyTop · stickyLeft` 는 이 구조로 교체 — `nodeRendererTypes.ts:187-194`).
- `apps/builder/src/builder/workspace/canvas/skia/renderCommands.ts:1647-1700` — 오프셋은 **가장 가까운 scroll container** 의 현재 `scrollOffsets` (자기 `skiaData.scrollOffset` 아님). clamp 는 Blink: 양쪽 inset · 공간 부족 시 `max_inset += free` (`:686-695`) · inset 없음 = 보정 0.
- `apps/builder/src/builder/workspace/canvas/layout/stickyResolver.ts` — 입력을 constraints 구조로 바꾸고 양 축 · 양쪽 inset 지원. 헤더의 「ADR-100 Phase 3」 → 「ADR-267」.
- **좌표 계약 — sticky delta 는 그리기만이 아니라 공간 문맥 전체에 (리뷰 Round 1 H2)**: 지금 `visitElement` 는 `boundsMap` · `hitBoundsMap` 을 정적 좌표로 먼저 기록하고 (`renderCommands.ts:1633-1644`) 그 뒤에 `renderRelX/Y` 만 보정하며 (:1647-1700), 자식의 `parentAbs` · `childClipRectOf` · `selfOnlyChildContexts` 도 보정 전 `absX/Y` 를 쓴다 (:1790-1837). 그대로 살리면 scrollTop 100 에서 헤더는 화면 y=0 에 그려지는데 bounds 는 y=−100, hit 는 clip 밖이라 미등재 — 보이는 헤더를 클릭 · 선택할 수 없고 자손 label 도 y=−96 에 남는다 (리뷰 소비자 함수 반례). 그래서:
  1. sticky delta (`dx · dy` = Blink clamp 결과 − 정적 위치) 를 **bounds 기록보다 먼저** 한 번 계산하고, `stickyAbsX/Y = absX/Y + dx/dy` 하나를 이 요소의 모든 공간 출력에 쓴다 — `boundsMap` · `hitBoundsMap` (`intersectBounds(stickyBounds, clipRect)` — 조상 clip 은 그대로, sticky 는 scroll owner 의 clip 을 벗어나지 않는다) · `renderRelX/Y`.
  2. 자식 문맥도 같은 좌표에서: `childClipRectOf(stickyAbsX, stickyAbsY, …)` · 자식 `parentAbs = stickyAbs − scroll` · `selfOnlyChildContexts` · `subtreeBuildContextByElement` 에 저장하는 값도 같은 식. **전체 · 서브트리 · self 재빌드 세 경로가 같은 값을 저장 · 소비**하는지 단언한다 (self 재빌드가 캐시된 정적 문맥을 꺼내 쓰면 자손만 원위치로 돌아간다).
  3. 캐시 키: delta 는 scroll owner 의 오프셋 함수다. owner 는 sticky 요소의 조상이므로 `scrollContextKey` 사슬 (`|scroll:${id}:${x},${y}`) 이 이미 owner 오프셋을 포함한다 — Phase 0 에서 owner ≠ 직계 부모인 fixture 로 키가 실제로 바뀌는지 확인 (안 바뀌면 키에 owner 오프셋을 추가).
  4. 오버레이 · hit 소비자 (`SpatialIndex` 는 `hitBoundsMap` 을 받는다 — 리뷰 근거) 는 고치지 않는다 — 입력 map 이 맞으면 따라온다. full repaint · unsafe 분류 유지로는 이 문제가 풀리지 않는다 (좌표의 문제지 무효화의 문제가 아니다).
- `subtreeTranslate.ts:138-140` 거부 · `hasSparseDamageUnsafePaint` (:1887-1892) 분류는 **유지** (사용자 결정 3 전).
- unit (`renderCommands` 스위트 — 리뷰 반례 형식 그대로 production emitter 입력으로): scrollTop 100 · `top: 0` 헤더 → paint y · `boundsMap` y · `hitBoundsMap` y 가 모두 0 (scroll owner 화면 좌표 기준), 자손 label 의 bounds · hit 도 같은 delta · 전체 / self 재빌드 결과 동일.
- browser vitest (ADR-156 oracle) fixture ≥ 6: 스크롤 0 · 중간 · 끝 (containing block 하단에 걸림) · padding-bottom 컨테이너 · margin 있는 sticky · inset 없음 (`Header` rule — 변화 0) · 양쪽 inset 공간 부족 · **`auto` > `hidden` 경계 (헤더가 바깥과 함께 흐름)**. 각 ≤ 1 px.
- 원복 RED: ① 조상 오프셋 → 자기 오프셋으로 되돌리면 「중간」 fixture RED · ② bounds 기록을 delta 앞으로 되돌리면 위 unit 의 bounds · hit 단언 RED · ③ owner 판정을 `catalogOverflowScrolls` 로 바꾸면 hidden 경계 fixture RED.

### 1-d 문서 · 상태

- `.claude/rules/layout-engine.md:61-67` — 「fixed = absolute 근사」 → 「`styleOf` 가 떨어뜨려 in-flow static · sticky 는 ADR-267 Phase 1 로 엔진 constraints」.
- `packages/engine/src/tree.rs:2517` 주석 · `stickyResolver.ts` 헤더 정정 (R6).
- 정본 `CHROMIUM_CANVAS_PARITY_2026-10.md` X8 (§0-2 행 3 · §7-0 표 · §7-4) — sticky `code-confirmed` → `gate-passed`, fixed 는 사용자 결정 1 전 `planned`.
- `docs/adr/README.md` · CHANGELOG (사용자-가시: Compare Mode 섹션 헤더 일치).
- G2 live (Chrome MCP) 기록 → 본문 `### Live Exercise` — 위치 비교에 더해 **붙은 헤더를 Canvas 에서 클릭해 선택되는지 · 선택 오버레이가 그려진 헤더와 겹치는지** 를 같이 적는다 (H2).

## 4. Phase 2 — fixed (사용자 결정 1 · 2 뒤에만)

- 진입 조건: 결정 1 = 저작 허용. 불허면 이 Phase 는 「ADR-164 의도적 미지원 유지」 로 종결하고 정본 X8 fixed = `unsupported` (사유: 입력 0).
- 허용 시:
  - `packages/shared/src/catalog/document/validation.ts` 의 **저작용** 선택지 (`layoutWrites` — Phase 1 에서 라이브러리 rule 용과 나눈 쪽) 에 `sticky · fixed` 허용, 라이브러리 rule 용에 `fixed` 추가. `LIBRARY_CONTRACT_VERSION` 올림 여부는 결정 1 에 포함 (변환 코드 없음 — 개발 단계).
  - Design 패널 `TransformSection.tsx:333 · 426` — position 선택지 확장 (Design 패널 섹션 = prop 뜻 하나 규칙 — 메모리 `feedback-design-panel-section-by-prop-meaning`).
  - `itemLayout` — `fixed` 전송. 엔진 `is_out_of_flow` (:6949) 는 이미 fixed 포함 — containing block 을 page root (viewport = `set_viewport`) 로 (결정 2 = page frame 기준).
  - 렌더: `topLayerElementIds` (`renderCommands.ts:1615`) 경로 유지 · 오프셋 보정은 page frame 기준이라 스크롤 무관 (Canvas 는 page 를 스크롤하지 않음).
  - fixture: page frame 안 `fixed; bottom: 0; right: 0` 상자 — Preview 스크롤 0 의 `getBoundingClientRect` 와 ≤ 1 px.
- Preview 스크롤 중 fixed 의 화면 고정은 Preview 가 이미 한다 (DOM) — Canvas 는 저작 표시만.

## 5. Phase 3 — 종결

- G0 ~ G3 (· G4) 결과 · 수치 → 이 문서 §기록. 본문 Status 승격 (Accepted 는 사용자 `/execute-adr 267` + 리뷰 pending 0, Implemented 는 G2 live + `### Live Exercise`).
- 범위 밖 기록: Table `.react-aria-Sticky` (E02 와 함께) · GridList (Builder 무관) · sticky 노드 unsafe 분류 (사용자 결정 3 결과).

## 6. 파일 변경표 (추정 — Phase 0 에서 확정)

| 영역       | 파일                                                                                                                                                                                             | 변경                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| 전송       | `ruleDefinition.ts` · `rulePartRules.ts` · `manualBoxRules.ts` (ListBox Header part — nested 블록 읽기) · `validation.ts` (라이브러리 rule 용 선택지 분리) · `compositionRoot.ts` (`itemLayout`) | sticky · inset 통과 · ListBox nested 값 도달 · 저작 검증은 그대로                            |
| 엔진       | `packages/engine/src/tree.rs` (+ 테스트)                                                                                                                                                         | constraints 계산 (owner = `is_scroll_container`) · geometry 선택 필드                        |
| 소비       | `canvasBinding.ts` · `nodeRendererTypes.ts` · `renderCommands.ts` · `stickyResolver.ts`                                                                                                          | constraints 소비 · scroll owner 오프셋 · Blink clamp · bounds · hit · 자식 문맥에 같은 delta |
| 테스트     | `apps/builder/tests/parity/stickyPosition.browser.test.ts` (신설) · catalog end-to-end 전송 unit · `renderCommands` 좌표 unit · ratchet run 1                                                    | ADR-156 oracle fixture ≥ 6 · 카운트                                                          |
| 문서       | `layout-engine.md` · `CHROMIUM_CANVAS_PARITY_2026-10.md` · `docs/adr/README.md` · CHANGELOG                                                                                                      | 상태 · 틀린 설명 정정                                                                        |
| Phase 2 만 | `validation.ts` (저작용 선택지) · `TransformSection.tsx` · `itemLayout` (fixed) · `tree.rs` (containing block = page)                                                                            | 사용자 결정 1 · 2 뒤                                                                         |

추정 13 파일 (Phase 2 제외 11 — 리뷰 Round 1 H1 로 `manualBoxRules.ts`, Round 2 H1 로 `validation.ts` 가 Phase 1 에 추가). 실측이 1.5 배를 넘으면 이 표를 Phase 0 보강 커밋으로 고친다 (fork 사유 아님 — adr-writing M3).

## 기록

### 2026-10-17 — Phase 0 · 1 · 2 · 3 종결 (사용자 `/execute-adr 267`)

**Phase 0 (go)**

- 입력 전수: 본문 §입력 전수와 같다 — rule 2 (`Header` 루트 inset 없음 · ListBox 섹션 헤더 `top`) · 수동 시트 2 (Table · GridList, 범위 밖) · fixed 0.
- RED: `apps/builder/tests/parity/stickyPosition.browser.test.ts` (Chrome 차등 oracle, 13 fixture) — 구현 전 RED 9 / GREEN 4 (스크롤 0 · inset 없음 · `auto` > `hidden` 경계 · 높이 없음 — 원래 움직이지 않는 케이스).
- 단언 자리 (R1): **0** — constraints 를 geometry batch (`get_layouts_batch` 5 값) 에 싣지 않고 별도 API (`LayoutTree::sticky_constraints` → wasm `getStickyConstraints`, sticky 노드만 조회 — `PersistentLayoutTree` 의 `stickyIds`) 로 냈다. 「geometry 의 선택 필드」 를 이 형태로 구현 — 입력 0 문서는 엔진 호출 0 · 바이트 동일이 구조로 성립.
- 기준선 (R4): 기존 ratchet 시드 (60 · 600 · nested-flex · app-pages) 에 섹션 헤더가 없어 perf 하니스에 `--fixture-kind sticky-lists` (단독 ListBox 높이 200 × 섹션 3, 목록 6) 를 추가하고 HEAD worktree (5174) 와 비교.

**Phase 1**

- 전송: `typedCanvasBox` · part rule 필터 (`rulePartRules.ts`) · `itemLayout` 이 `sticky` 를 통과. **ListBox 섹션 헤더는 manual part 가 아니라 resolver 파생 값** (`presence.ts` `catalogListSectionHeaderInsets` → `_stickyInset*` · `_stickyZIndex`, `styleOf` `stickyInsets`) 으로 실었다 — breakdown 이 선례로 든 `catalogListItemFlexShrink` 가 이 경로이고, Popover 조건 (`:not(.react-aria-Popover *)`) 을 조상 판정으로 가를 수 있다. 값은 table nested 블록에서 읽고 (`catalogListSectionHeaderSticky`), 해석 못 하는 inset 은 `CATALOG_STICKY_INSET_UNRESOLVED` throw.
- 검증기: `libraryLayoutValueChoices` (라이브러리 rule — `+ sticky`) · 저작 `layoutWrites` 그대로. `LIBRARY_CONTRACT_VERSION` 41 그대로.
- 엔진: `sticky_constraints` (owner = `is_scroll_container`, 없으면 root + viewport) · Rust unit 7 (X8 fixture · 섹션 padding/margin · inset 없음 · 양쪽 inset 축소 · hidden vs clip · viewport · JSON 왕복).
- 소비: `SkiaNodeData.sticky` (옛 `isSticky · stickyTop · stickyLeft` 삭제) · `resolveStickyOffset` (Blink `ComputeStickyOffset`) · `visitElement` 가 delta 를 bounds 기록 전에 계산 — paint · `boundsMap` · `hitBoundsMap` · 자식 `parentAbs` · `selfOnlyChildContexts` 가 같은 좌표 (`stickyCoordinates.test.ts` — 전체 · 서브트리 · self 재빌드 동일). 스크롤 owner 가 스크롤하면 `scrollBy` → owner dirty → 서브트리 재기록 (constraints 변화는 update 마다 다시 읽어 바뀐 sticky 만 재등록).
- **live 에서 찾은 것 — 그리기 순서**: Canvas 는 형제 순서대로 그려 붙은 헤더 위에 뒤 항목 글자가 겹쳤다 (Preview 는 rule 의 `z-index: 2`). nested 블록의 `z-index` 를 `_stickyZIndex` → `SkiaNodeData.zIndex` 로 (저작 z-index 우선).
- fixed: `renderCommands` 의 옛 fixed 좌표 보정 (`stickyTop ?? 0` 근사) 은 생산자 0 이라 함께 지웠다 — `isFixed` 는 top layer 판정만 남는다.
- oracle 13/13 ≤ 1 px. 원복 RED 13/13 — 전송 4 (`typedCanvasBox` · nested 미독 · 라이브러리 선택지 · `itemLayout`) · 저작 선택지 1 · 소비 3 (자기 오프셋 · 정적 bounds · 정적 자식 문맥) · 엔진 2 (constraints 비움 → oracle 9 RED · owner 를 auto/scroll 로 축소 → hidden 경계 RED) · z-index 1 · ratchet 1 (아래).

**사용자 결정 (2026-10-17)**

- 결정 3 = **(c)**: unsafe 유지 상태의 `60:sticky-lists` edit — `contentFullRenders` 0 → 15 · `contentDamageRenders` 15 → 0 · `translateCalls` 60 → 0 · `patchWrites` 1,425 → 7,125 (select 변화 0). bounds = 그려진 자리가 되어 unsafe 사유 (hit bounds 밖 paint) 가 사라졌으므로 `hasSparseDamageUnsafePaint` 에서 sticky 를 빼고, `subtreeTranslate` 는 「sticky 의 owner 가 옮기는 서브트리 안」 이면 옮긴다 (밖 · page root 면 거부). 결과: HEAD 와 render 카운트 동일 (차이는 B 등급 `cdp.LayoutCount` ±1 · 제외 키뿐). ratchet `60:sticky-lists` (edit · select) 등록 — (c) 이전 측정값을 `--judge` 하면 A 초과 26 으로 차단.
- 결정 1 = **허용 안 함**: Phase 2 는 ADR-164 의도적 미지원 유지로 종결, 정본 X8 fixed = `unsupported`. 결정 2 해당 없음.

**G3 · 수치**

- 회귀: cargo 465 + golden/tree_golden 등 전부 · shared 1,717 · builder unit 5,962 (skip 4) · parity 823/824 — 실패 1 (`adr248CatalogGeometryDelta` case 2 `subtreeNodeVisits` 4 기대 · 1 실제) 은 **HEAD `7c982da37` worktree 에서도 같은 값으로 실패** (ADR-264 뒤 갱신되지 않은 기대값 — 이 ADR 과 무관, 범위 밖).
- 번들: Builder initial JS gzip 1,364,793 → 1,365,666 B (+873, 상한 1,421,000). 엔진 wasm 436,446 → 443,377 B (+6,931 · gzip +2,379 — 첫 구현의 `serde_json::json!` 은 +18 KB 라 `format!` 으로 바꿈).
- 기존 ratchet run (60 · 600 · nested-flex · app-pages) 은 push 때 pre-push 게이트가 커밋 기준으로 잰다 (dirty 트리는 HEAD 를 재므로 여기서 판정하지 않았다).

**판독 (reviewer 1 회 + 수리 검증 1 회 — 종결)**: MEDIUM 1 (production 재현) — constraints 만 바뀐 sticky (섹션이 커져 밀린 헤더의 한계가 바뀜) 를 `reRegister` · `patchRoots` 에만 넣어, production 의 `placeRegion` (`seeds` · `onPath` 밖은 기록 0) 이 옛 자리를 남겼다 (dev `translateOff` 에선 안 보임). `stickyChanged` 를 `seeds` 에 넣어 수리 — binding unit (patched stream = fresh bind) 이 수리 전 RED (−1.5 에 남음) · 뒤 GREEN. LOW (스크롤마다 inset 없는 Header 까지 wasm 조회 · owner 역색인을 매번 재구성) 도 같이: 추적을 inset 있는 sticky 로 한정 · `elementIdByHandle` 유지. 수리 뒤 `60:sticky-lists` 판정 통과 (HEAD 와 render 카운트 동일). HIGH 0 → 닫힘.

**사후 보고 (adr-writing — scope 1.5 배)**: 추정 11 파일 → 제품 17 (전송 5 · 엔진 경계 7 — `engineTypes` · `layoutEngine` · `persistentLayoutTree` · `tree.rs` · `wasm.rs` · `engine.ts` · `engineWasm.ts` · 소비 5 — `subtreeTranslate.ts` 는 결정 3 (c)) + 테스트 7 + 하니스 2 (`perf-baseline.mjs` · `perfCatalogFacade.mjs`) + `ratchet.json`. 늘어난 몫은 별도 API 경계 (geometry 필드 대신) · 결정 3 (c) · 하니스 fixture. 범위 밖으로 남김: Table `.react-aria-Sticky` (E02) · GridList · sticky 안의 sticky (catalog 입력 없음).
