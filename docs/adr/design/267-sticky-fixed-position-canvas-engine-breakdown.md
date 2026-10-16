# ADR-267 design breakdown — position sticky · fixed 의 Canvas 지원

> 본문: [ADR-267](../267-sticky-fixed-position-canvas-engine.md). 이 문서는 구현 상세 (phase · 파일 · 체크리스트 · fixture) 와 Phase 0 inventory 의 결론을 둔다. 수치는 측정 뒤 여기에 적는다 — 본문에는 옮기지 않는다.

## 1. 전제 lock-in

- 분리 아님 — 새 ADR 하나. base/응용 · schema 직교성 질문은 해당 없음. 선행 ADR-164 의 「fixed = absolute 근사」 전제는 **승계하지 않는다** — Phase 0 이 실제 경로 (`styleOf` 가 떨어뜨려 in-flow static) 를 다시 확인했고, fixed 의 재개는 사용자 결정 1 로 판정한다.
- sticky 와 fixed 는 별도 feature (정본 §7-4 X8 · 사용자 요청 원문 「fixed 는 viewport 기준 별도 phase」). 같은 ADR 의 Phase 1 · Phase 2.
- oracle: Chrome `getBoundingClientRect` (ADR-156 차등 oracle, browser vitest) · Compare Mode 픽셀 (live). Blink 코드는 지도.
- 한 격차 = 한 커밋 = 원복 RED 1 + cross-check (또는 live) 1 (정본 §0-2).

## 2. Phase 0 — inventory · RED · 기준선 (동작 변경 0)

- [ ] **입력 전수 표**: `componentRulesTable.ts` 의 `position: "sticky"` (현재 2 — `Header` :5599 inset 없음 · `ListBox` 섹션 헤더 :6903 `top`) · 수동 시트 (`Table.css:176` `.react-aria-Sticky` · `GridList.css:103`) · `Table.runtime.tsx:104 sticky?` · 생성 CSS `position: fixed` (overlay archetype `CSSGenerator.ts:154` → Modal · Popover, 수동 `overlays.css:5` · `Toast.css:24`). 각각 Canvas 도달 여부 · 범위 안/밖 표기.
- [ ] **RED fixture**: 단독 ListBox (높이 저작 · `overflow: auto` · 섹션 2 · 항목 충분) 를 Preview 와 Canvas 에서 같은 양 스크롤 → 섹션 헤더 y 가 다름. ADR-156 oracle 형식 (`apps/builder/tests/parity/stickyPosition.browser.test.ts` 신설) 으로 RED 를 기록.
- [ ] **입력 0 동일성 단언**: sticky 입력이 없는 fixture (기존 parity 스위트 + G3 하니스 78/79) 의 엔진 geometry 와 명령 스트림을 Phase 1 전후 바이트 비교할 수단 (기존 `engineCssParity` · G3 하니스 재사용 — 새 하니스 만들지 않음).
- [ ] **단언 자리 목록**: geometry 출력 길이 · 순서를 단언하는 테스트 (`apps/builder/tests/parity/*` · `packages/engine/src/tree.rs` 테스트 · `apps/builder/src/builder/catalogRuntime/__tests__/*`) 를 grep 으로 세어 R1 범위 확정.
- [ ] **unsafe 카운트 기준선**: RED fixture 문서의 `renderCounters` (`fullRepaint` 계열 · `pageGridMoveNullFixedOrSticky`) 를 `--fixed-inputs` 2 회 같은 값으로 기록.
- [ ] **go/no-go**: RED 가 재현되면 go. 재현되지 않으면 정본 X8 재판정 → ADR Deprecated.

## 3. Phase 1 — sticky (대안 A)

순서는 전송 → 엔진 → 소비 → 문서. 각 단계가 한 커밋, 각 커밋에 원복 RED 1.

### 1-a 전송 — rule · 노드 값이 엔진까지

- `packages/shared/src/catalog/document/ruleDefinition.ts:191-192` `typedCanvasBox` — `position` 에 `sticky` 통과 (주석 삭제). inset 4 (`top · left · right · bottom` → `insetTop…`) 도 layout 으로.
- `packages/shared/src/catalog/document/rulePartRules.ts:500` — 부품 rule 경로 같은 처리.
- `packages/shared/src/catalog/runtime/compositionRoot.ts:1258-1270` `itemLayout` — `position: sticky` 전송 (저작 노드는 스키마상 아직 올 수 없음 — rule 값 경로만 실효).
- 원복 RED: `typedCanvasBox` 가 다시 떨어뜨리면 1-c 의 fixture RED.

### 1-b 엔진 — constraints (Blink `ComputeStickyPositionConstraints` 계약)

- `packages/engine/src/tree.rs` — sticky 상자는 in-flow 그대로 (레이아웃 결과 불변). 레이아웃 뒤 sticky 노드마다:
  - **scroll container**: 가장 가까운 조상 중 overflow 가 스크롤인 것 (`catalogOverflowScrolls` 와 같은 판정 — `auto · scroll`), 없으면 page root.
  - **sticky container (containing block)** 기준 영역: scroll container 자신이면 scrollable overflow rect (`:591-593`), 아니면 padding box (`:595`) → 그 상자의 padding 을 뺌 (`:610-611`).
  - sticky 요소 margin 제외 (`:612-625`) · 4 inset (auto 는 「없음」 — 전부 auto 면 constraints 자체 없음) · static rect.
  - 출력: geometry 의 **선택 필드** (sticky 노드만). 길이 · 순서 기존 불변 (R1).
- Rust unit test: 정본 X8 fixture 「`overflow:auto; height:200px; padding-bottom:40px` 안 `sticky; top:0` 헤더」 + margin · 양쪽 inset · inset 없음 · scroll container = containing block.
- 원복 RED: constraints 를 비우면 1-c fixture RED.

### 1-c 소비 — binding · renderCommands · stickyResolver

- `apps/builder/src/builder/catalogRuntime/canvasBinding.ts:1455-1476` — geometry 의 sticky constraints 를 `SkiaNodeData.sticky` 로 (기존 `isSticky · stickyTop · stickyLeft` 는 이 구조로 교체 — `nodeRendererTypes.ts:187-194`).
- `apps/builder/src/builder/workspace/canvas/skia/renderCommands.ts:1647-1700` — 오프셋은 **가장 가까운 scroll container** 의 현재 `scrollOffsets` (자기 `skiaData.scrollOffset` 아님). clamp 는 Blink: 양쪽 inset · 공간 부족 시 `max_inset += free` (`:686-695`) · inset 없음 = 보정 0.
- `apps/builder/src/builder/workspace/canvas/layout/stickyResolver.ts` — 입력을 constraints 구조로 바꾸고 양 축 · 양쪽 inset 지원. 헤더의 「ADR-100 Phase 3」 → 「ADR-267」.
- `subtreeTranslate.ts:138-140` 거부 · `hasSparseDamageUnsafePaint` (:1887-1892) 분류는 **유지** (사용자 결정 3 전).
- browser vitest (ADR-156 oracle) fixture ≥ 5: 스크롤 0 · 중간 · 끝 (containing block 하단에 걸림) · padding-bottom 컨테이너 · margin 있는 sticky · inset 없음 (`Header` rule — 변화 0) · 양쪽 inset 공간 부족. 각 ≤ 1 px.
- 원복 RED: 조상 오프셋 → 자기 오프셋으로 되돌리면 「중간」 fixture RED.

### 1-d 문서 · 상태

- `.claude/rules/layout-engine.md:61-67` — 「fixed = absolute 근사」 → 「`styleOf` 가 떨어뜨려 in-flow static · sticky 는 ADR-267 Phase 1 로 엔진 constraints」.
- `packages/engine/src/tree.rs:2517` 주석 · `stickyResolver.ts` 헤더 정정 (R6).
- 정본 `CHROMIUM_CANVAS_PARITY_2026-10.md` X8 (§0-2 행 3 · §7-0 표 · §7-4) — sticky `code-confirmed` → `gate-passed`, fixed 는 사용자 결정 1 전 `planned`.
- `docs/adr/README.md` · CHANGELOG (사용자-가시: Compare Mode 섹션 헤더 일치).
- G2 live (Chrome MCP) 기록 → 본문 `### Live Exercise`.

## 4. Phase 2 — fixed (사용자 결정 1 · 2 뒤에만)

- 진입 조건: 결정 1 = 저작 허용. 불허면 이 Phase 는 「ADR-164 의도적 미지원 유지」 로 종결하고 정본 X8 fixed = `unsupported` (사유: 입력 0).
- 허용 시:
  - `packages/shared/src/catalog/document/validation.ts:195` — `position` 에 `sticky · fixed` 허용. `LIBRARY_CONTRACT_VERSION` 올림 여부는 결정 1 에 포함 (변환 코드 없음 — 개발 단계).
  - Design 패널 `TransformSection.tsx:333 · 426` — position 선택지 확장 (Design 패널 섹션 = prop 뜻 하나 규칙 — 메모리 `feedback-design-panel-section-by-prop-meaning`).
  - `itemLayout` — `fixed` 전송. 엔진 `is_out_of_flow` (:6949) 는 이미 fixed 포함 — containing block 을 page root (viewport = `set_viewport`) 로 (결정 2 = page frame 기준).
  - 렌더: `topLayerElementIds` (`renderCommands.ts:1615`) 경로 유지 · 오프셋 보정은 page frame 기준이라 스크롤 무관 (Canvas 는 page 를 스크롤하지 않음).
  - fixture: page frame 안 `fixed; bottom: 0; right: 0` 상자 — Preview 스크롤 0 의 `getBoundingClientRect` 와 ≤ 1 px.
- Preview 스크롤 중 fixed 의 화면 고정은 Preview 가 이미 한다 (DOM) — Canvas 는 저작 표시만.

## 5. Phase 3 — 종결

- G0 ~ G3 (· G4) 결과 · 수치 → 이 문서 §기록. 본문 Status 승격 (Accepted 는 사용자 `/execute-adr 267` + 리뷰 pending 0, Implemented 는 G2 live + `### Live Exercise`).
- 범위 밖 기록: Table `.react-aria-Sticky` (E02 와 함께) · GridList (Builder 무관) · sticky 노드 unsafe 분류 (사용자 결정 3 결과).

## 6. 파일 변경표 (추정 — Phase 0 에서 확정)

| 영역        | 파일                                                                                                    | 변경                                     |
| ----------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 전송        | `ruleDefinition.ts` · `rulePartRules.ts` · `compositionRoot.ts` (`itemLayout`)                          | sticky · inset 통과                      |
| 엔진        | `packages/engine/src/tree.rs` (+ 테스트)                                                                | constraints 계산 · geometry 선택 필드    |
| 소비        | `canvasBinding.ts` · `nodeRendererTypes.ts` · `renderCommands.ts` · `stickyResolver.ts`                 | constraints 소비 · scroll container 오프셋 · Blink clamp |
| 테스트      | `apps/builder/tests/parity/stickyPosition.browser.test.ts` (신설) · ratchet run 1                       | ADR-156 oracle fixture ≥ 5 · 카운트       |
| 문서        | `layout-engine.md` · `CHROMIUM_CANVAS_PARITY_2026-10.md` · `docs/adr/README.md` · CHANGELOG             | 상태 · 틀린 설명 정정                    |
| Phase 2 만  | `validation.ts` · `TransformSection.tsx` · `itemLayout` (fixed) · `tree.rs` (containing block = page)   | 사용자 결정 1 · 2 뒤                     |

추정 12 파일 (Phase 2 제외 9). 실측이 1.5 배를 넘으면 이 표를 Phase 0 보강 커밋으로 고친다 (fork 사유 아님 — adr-writing M3).

## 기록

(Phase 별 수치 · go/no-go · 사용자 결정 결과를 여기에.)
