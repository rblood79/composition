# ADR-267: position sticky · fixed 의 Canvas 지원 — `styleOf` 미전송 복원 · scroll container 기준 영역 (Blink `ComputeStickyPositionConstraints`) · fixed 별도 phase

## Status

Proposed — 2026-10-17

- 사용자 요청: `/create-adr position sticky · fixed 를 Canvas 와 엔진에 연결 — styleOf 미전송 복원 · scroll container 기준 영역 (Blink ScrollableOverflowRect) · fixed 는 viewport 기준 별도 phase` (2026-10-17)
- 방향을 정한 사용자 원문: 「CHROMIUM_CANVAS_PARITY_2026-10.md 이 항목들은 설계문서로 다시 작성해야하나」 → 「전체 작성해야하는 ADR은 몇개가 되지」 → 「확정3개 create-adr 제목 모두 정해줘」 (2026-10-17). Chromium 대조 정본 [CHROMIUM_CANVAS_PARITY_2026-10.md](../explanation/research/CHROMIUM_CANVAS_PARITY_2026-10.md) 의 51 행 가운데 ADR 이 필요한 확정 3 건 (X8 sticky · fixed / F4 / O1) 의 첫 번째. 나머지 행은 정본 §0-2 의 「한 격차 = 한 커밋」 규약대로 ADR 없이 닫는다.
- 이미 정해진 것 (정본 §0-2 · §7-4 X8 · 전수 원본 대조 2026-10-17): sticky 와 fixed 는 **별도 feature** 로 나눈다 (sticky 는 in-flow + 스크롤 보정, fixed 는 out-of-flow + viewport 좌표계). 입력 전달만으로 완료 처리하지 않는다 — 직렬화 · scroll owner · 엔진 · paint 소비를 끝까지 추적한다. oracle 은 Blink 코드가 아니라 Chrome 의 `getBoundingClientRect` (ADR-156 차등 oracle) 와 Compare Mode 픽셀이다. Blink 인용은 고정 SHA `33688427bc1a316cecb28d5651ad25208ba9ab53` 원본을 직접 읽은 것 (code-confirmed).
- 리뷰: 사용자 요청 시 `review-adr` → `reviews/267.md`.

Related: [ADR-164 엔진 TS 보정 흡수](completed/164-engine-ts-compensation-absorption.md) (fixed 를 absolute 로 근사한 「의도적 미지원」 과 그 재개 조건 — 이 ADR 이 그 재개 여부를 판정한다) · [ADR-156 엔진 CSS parity 차등 oracle](completed/156-engine-css-parity-alignment-margin.md) (판정 수단) · [ADR-248 통합 catalog 문서](completed/248-unified-catalog-document.md) (옛 sticky 생산자가 삭제된 자리) · [ADR-246 카운트 ratchet](completed/246-deterministic-count-ratchet-and-begin-frame-harness.md) (성능 집행 수단) · [ADR-266 그리기 캐시 thrash](completed/266-draw-cache-thrash-real-document-zoom-edit.md) (unsafe 요소를 viewport · damage 에 싣는 현재 경로 — sticky 노드가 그 경로를 탄다) · [Chromium 대조 정본](../explanation/research/CHROMIUM_CANVAS_PARITY_2026-10.md) §0-2 행 3 · §7-4 X8 · U2

## Context

**Domain**: D3 (시각 스타일) — Canvas (Skia) 와 Preview (DOM + CSS) 가 같은 catalog 값 (`position: sticky` · inset) 에서 같은 시각 결과를 내야 하는 대칭 문제. D1 · D2 는 건드리지 않는다 (RAC DOM 그대로, 새 prop 없음). 문서 스키마 확장 (저작 가능한 `sticky` · `fixed`) 은 D3 안의 입력 범위 문제이고 **이 ADR 이 가정하지 않는다** — 아래 사용자 결정 1.

### 문제 — Preview 는 붙고 Canvas 는 흘러간다

catalog rule 이 `position: sticky` 를 싣는 곳이 두 군데 있고 (`packages/shared/src/catalog/generated/componentRulesTable.ts` — `Header` rule `containerStyles.position: "sticky"` :5599, `ListBox` rule 의 `.react-aria-ListBoxSection .react-aria-Header` 선택자 `position: sticky · top: calc(-1 * hairline) · z-index: 2` :6903), 생성 CSS 가 그대로 내보낸다 (`Header.css:20` · `ListBox.css:113`). Preview 에서는 ListBox 섹션 헤더가 목록을 스크롤할 때 위에 붙는다. Canvas 에서는 같은 값이 세 자리에서 떨어진다:

1. **rule → Canvas box**: `packages/shared/src/catalog/document/ruleDefinition.ts:191-192` `typedCanvasBox` 가 `position` 중 `relative` 만 남긴다 (주석 「`sticky` has no layout-engine equivalent; the box stays in flow」). 부품 rule 경로 `rulePartRules.ts:500` 도 `relative · static` 만. 그리고 ListBox 섹션 헤더의 값은 이 필터 **앞에서** 이미 빠진다 — `compileRulePartRules` (`rulePartRules.ts:1717-1760`) 는 `rootSelectors.nested` 를 모으지 않고, Canvas 의 섹션 헤더 part 는 손으로 옮긴 `manualBoxRules.ts` `ListBox` (:333-376) 가 position · top 없이 준다 (리뷰 Round 1 H1).
2. **노드 → 엔진 style**: `packages/shared/src/catalog/runtime/compositionRoot.ts:1258-1270` `itemLayout` 이 `node.layout.position` 가운데 `relative` · `absolute` 만 내보낸다. `styleOf` (:941) 는 위치 상자를 `absolute + insetLeft/Top` 로만 싣는다.
3. **Canvas 소비자는 있는데 생산자가 0**: `apps/builder/src/builder/workspace/canvas/skia/renderCommands.ts:1647-1700` 이 `skiaData.isSticky · isFixed · stickyTop · stickyLeft` (`nodeRendererTypes.ts:187-194`) 를 읽어 `stickyResolver.ts` 로 좌표를 보정하지만, 이 필드를 쓰는 생산자는 `5382d1da0` (2026-10-02, ADR-248 Phase 4e-9-8 — `buildSkiaNodeData.ts` · `buildSpecNodeData.ts` 삭제) 뒤 없다. 생산자는 `3178820bf` (2026-04-07) 에 생겼고 catalog 경로로 다시 연결되지 않았다.

그래서 Compare Mode 에서 **같은 문서 · 같은 스크롤** 에 Preview 는 헤더가 고정, Canvas 는 흘러간다 (정본 X8 — code-confirmed, 재현 fixture 는 Phase 0).

### 코드 사실 — 소비자도 Blink 계약과 다르다

소비자가 살아 있어도 그대로 쓸 수 없다. Blink `LayoutBoxModelObject::ComputeStickyPositionConstraints` (`third_party/blink/renderer/core/layout/layout_box_model_object.cc:548-718`, SHA 33688427) 와 대조:

| 항목               | Blink                                                                                                                                                    | `renderCommands.ts` · `stickyResolver.ts` 현재                                                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 스크롤 기준 요소   | 가장 가까운 **scroll container** (조상 체인)                                                                                                             | `skiaData.scrollOffset` — **자기 자신**의 스크롤 오프셋 (`canvasBinding.ts:1455-1476` 은 스크롤하는 컨테이너 자신에 `scrollOffset` 을 싣는다). 주석은 「부모」 |
| 기준 영역          | sticky container 가 scroll container 자신이면 `ScrollableOverflowRect()` (:591-593), 아니면 `PhysicalPaddingBoxRect()` (:595) → padding 을 뺌 (:610-611) | `containerBottom = parentLayout.height` — 부모 **border-box**, padding 미반영, 스크롤 overflow 미반영                                                          |
| sticky 요소 margin | 제외 (:612-625, `LayoutIgnoreMarginsForSticky` 꺼짐 = stable 기본)                                                                                       | 미반영                                                                                                                                                         |
| 양쪽 inset         | top/bottom · left/right 둘 다, 공간 부족 시 `max_inset += free` (:686-695)                                                                               | top · left 만                                                                                                                                                  |
| inset 전부 auto    | 붙지 않음 (static 과 같음)                                                                                                                               | `stickyTop ?? 0` → top: 0 으로 붙음 — `Header` rule (top 없음) 이 **잘못 붙는다**                                                                              |
| 계산 시점          | 레이아웃이 constraints 를 만들고, 오프셋은 스크롤 때 compositor 가 적용 (재레이아웃 0)                                                                   | 렌더 때 좌표 보정 (시점은 같은 분할)                                                                                                                           |

엔진 (`packages/engine/src/tree.rs`) 은 `sticky` · `fixed` 를 positioned 조상으로 인식만 한다 (`style_is_positioned` :6954-6959) — sticky 알고리즘은 없고 (`sticky` 4 회, 전부 판정 · 주석), `fixed` 는 out-of-flow (`is_out_of_flow` :6949-6951) 를 absolute 로 근사한다 (:2517, ADR-164 Phase 2 「의도적 미지원」 — `.claude/rules/layout-engine.md:61-67`, 재개 조건 「캔버스 viewport (= page frame) 기준 fixed 실사용 등장」).

이미 맞는 것 (수정 불요): `cssStackingContext.ts:22` 가 `fixed · sticky` 를 stacking context 로 본다 · `renderCommands.ts:1612` 가 scroll context 키에 `self:sticky` 를 넣고 `subtreeTranslate.ts:138-140` 이 그 서브트리 옮기기를 거부한다 (사유 카운트 `pageGridMoveNullFixedOrSticky`) · `hasSparseDamageUnsafePaint` (:1887-1892) 가 sticky · fixed 를 unsafe 로 분류한다 (ADR-266 Phase 3 뒤 unsafe 는 viewport · damage sequence 에 실린다).

### 입력 전수 — 어디서 sticky · fixed 가 오는가

- **sticky, Canvas 가 받아야 하는 것**: rule 2 (`Header` :5599 — inset 없음 → Blink 에선 붙지 않음 · `ListBox` 섹션 헤더 :6903 — `top` 있음, 선택자가 `:not(.react-aria-Popover *)` 라 단독 ListBox 만). 저작 경로는 **없다** — `packages/shared/src/catalog/document/validation.ts:195` 가 `position` 을 `static · relative · absolute` 로 제한하고 Design 패널 (`TransformSection.tsx:333 · 426`) 도 absolute 토글만 둔다. 정본 X8 의 「+ Styles」 는 이 ADR 작성 중 틀린 것으로 확인 — 같은 커밋에서 정본을 고친다.
- **sticky, Canvas 범위 밖**: 수동 시트 `Table.css:176-178` `.react-aria-Sticky` · `GridList.css:103` — Table 은 ADR-257 열 트랙 근사 · E02 (CSS table) 영역, GridList 는 수동 시트 (Builder 무관). 이 ADR 은 다루지 않고 §Consequences 에 적는다.
- **fixed**: catalog rule 에 없다. 생성 CSS 의 `position: fixed` 는 `overlay` archetype base (`packages/rendering/src/renderers/CSSGenerator.ts:154` → `Modal.css:11` · `Popover.css:11`) 와 수동 시트 (`overlays.css:5` · `Toast.css:24`) 뿐이고, Canvas 는 오버레이를 **top layer** 로 그린다 (`renderCommands.ts` `isTopLayer`). 즉 fixed 는 저작 경로가 열리기 전까지 **production 입력 0** 이다 — ADR-164 재개 조건이 아직 성립하지 않았다.

### Hard constraints

- **기하**: ADR-156 차등 oracle — sticky fixture 의 Canvas 좌표 ↔ Chrome `getBoundingClientRect` 차 ≤ 1 px (스크롤 0 · 중간 · 끝 · 공간 부족 케이스 전부).
- **회귀 0**: sticky 입력이 없는 문서의 엔진 geometry · 그리기 명령은 바이트 단위로 같다 (기존 parity 스위트 전량 · G3 하니스 78/79 유지 · ADR-246 ratchet 등급 A 변동 0).
- **성능**: 스크롤 프레임에서 엔진 재호출 0 (오프셋은 렌더 보정). sticky 노드가 있는 fixture 의 full repaint 카운트는 Phase 0 기준선 대비 증가 0 (ADR-266 L4 경로 그대로).
- **번들**: Builder initial gzip ≤ 1,421,000 B (ADR-201 재승인 값, `adr201-bundle-gate.mjs`). 엔진 wasm 은 gitignored 산출물 — 크기 게이트 없음, 변화량만 기록.
- **스키마**: 이 ADR 로 `LIBRARY_CONTRACT_VERSION` · 문서 스키마를 바꾸지 않는다 (사용자 결정 1 전). 노드 저작 검증 (`validation.ts` `layoutWrites`) 의 `position` 허용 집합은 그대로이고, 코드 catalog 라이브러리의 rule 검증 (`layoutValues` — 저장되지 않음) 만 `sticky` 를 받는다.

## Alternatives Considered

### 대안 A — 엔진이 constraints, 렌더가 오프셋 (Blink 분할)

- 설명: `typedCanvasBox` · `itemLayout` 이 `position: sticky` 와 inset 4 방향을 엔진에 보낸다. 엔진은 sticky 상자를 in-flow 로 두고 (레이아웃 결과 불변) 그 상자에 대해 Blink 계약대로 **constraints** 를 만든다 — 가장 가까운 scroll container (CSS scroll container — overflow `hidden · scroll · auto` 인 조상, `clip` 제외 · 엔진 `is_scroll_container` 술어. 없으면 page root) · sticky container (containing block) 의 기준 영역 (scroll container 자신이면 scrollable overflow rect, 아니면 padding box − padding) · sticky 요소 margin 제외 · 4 inset · static rect. geometry 출력에 선택 필드로 붙는다 (sticky 가 없는 노드는 0 바이트 추가). `canvasBinding` 이 그것을 `SkiaNodeData.sticky` 로 옮기고, `renderCommands` 가 **가장 가까운 scroll container 의 현재 오프셋** 으로 Blink clamp (양쪽 inset · 공간 부족 시 완화) 를 적용하고, 그 delta 를 그리기 좌표뿐 아니라 bounds · hit 영역 · 자손의 공간 문맥 (parentAbs · clip) 에 같이 싣는다 — 보이는 자리와 선택되는 자리가 같다. 스크롤마다 엔진 호출 0.
- 근거: Blink 가 같은 분할이다 (layout 이 `StickyPositionScrollingConstraints`, 오프셋은 compositor). ADR-164 가 TS 보정을 엔진으로 흡수한 방향과 같다 — 박스 모델 (padding · margin · overflow rect) 을 아는 쪽이 계산한다.
- 위험: 기술 **MEDIUM** (geometry 출력 포맷 확장 — wasm 경계 · 기존 parity 스위트가 길이를 단언할 수 있음) / 성능 LOW / 유지보수 LOW (계산 한 곳) / 마이그레이션 LOW (입력 0 이면 동작 불변).

### 대안 B — 엔진은 전달만, TS binding 이 사각형으로 constraints 계산

- 설명: 엔진에는 `position: sticky` 만 보내 positioned 판정에 쓰고, constraints 는 `canvasBinding` 이 `rectOf` 기하 + catalog box 값 (padding · margin) 으로 TS 에서 계산한다. 엔진 변경 0.
- 근거: 당장 가장 짧다. `scrollStateOf` 가 이미 scroll range (overflow) 를 안다.
- 위험: 기술 LOW / 성능 LOW / 유지보수 **MEDIUM ~ HIGH** (padding · margin · 스크롤 overflow 계산을 TS 에 복제 — ADR-164 가 걷어낸 TS 보정의 재도입, 두 곳이 어긋나면 Compare Mode 발산을 다시 만든다) / 마이그레이션 LOW.

### 대안 C — 엔진이 스크롤 오프셋을 입력으로 받아 레이아웃에서 위치 확정

- 설명: `set_scroll_offset` 류 입력을 두고 sticky 상자의 최종 위치를 엔진이 계산. 렌더 보정 0.
- 위험: 기술 MEDIUM / 성능 **HIGH** (스크롤 프레임마다 엔진 호출 + geometry 재수신 — ADR-263 ~ 266 이 걷어낸 꼬리의 재발, 60 Hz floor 위협) / 유지보수 MEDIUM / 마이그레이션 MEDIUM (스크롤 상태가 레이아웃 입력이 되어 캐시 키가 바뀐다).

### 대안 D — 미지원 유지, 발산을 문서화

- 설명: `typedCanvasBox` 주석대로 둔다. 정본 X8 을 `unsupported` 로 고정하고 Compare Mode 발산을 알려진 차이로 적는다.
- 위험: 기술 LOW / 성능 LOW / 유지보수 LOW / 마이그레이션 LOW — 다만 사용자-가시 발산이 남고 (ListBox 섹션 헤더), 사용자 지시 「Canvas 와 엔진에 연결」 과 어긋난다.

### Risk Threshold Check

| 대안 | HIGH+                  | 판정                                   |
| ---- | ---------------------- | -------------------------------------- |
| A    | 없음 (기술 MEDIUM 1)   | 통과                                   |
| B    | 유지보수 MEDIUM ~ HIGH | 통과 조건부 — A 가 있어 선택 안 함     |
| C    | 성능 HIGH              | 제외                                   |
| D    | 없음                   | 통과 — 사용자 지시와 어긋나 선택 안 함 |

HIGH 가 없는 대안이 둘 (A · D) 이라 새 대안 추가 루프는 필요 없다.

## Decision

**대안 A.** sticky 는 엔진이 Blink `ComputeStickyPositionConstraints` 계약의 constraints 를 만들고 렌더가 가장 가까운 scroll container 의 오프셋으로 clamp 한다. fixed 는 **별도 phase** 로 두되, production 입력이 0 이고 저작 경로가 스키마 (`validation.ts:195`) 에 막혀 있으므로 사용자 결정 1 이 열리기 전에는 `planned` 다 — 결정이 「저작 안 함」 이면 fixed phase 는 ADR-164 의 「의도적 미지원」 을 그대로 유지하며 종결한다.

- 위험 수용 근거: A 의 유일한 MEDIUM 은 geometry 출력 확장이다. 선택 필드 (sticky 노드만 채움) 로 두고 기존 스위트가 길이 · 값을 단언하는 자리를 Phase 0 에서 세어 깨지는 것만 고치면 수용 가능하다. 입력 0 문서는 바이트 동일 — G0 가 집행한다.
- B 기각: TS 보정 재도입. ADR-164 가 실측 (TS 보정 0 건 목표) 으로 흡수한 방향의 역행이고, Compare Mode 발산의 원인 (두 계산) 을 다시 만든다.
- C 기각: 스크롤 프레임의 엔진 호출. ADR-263 ~ 266 종결 수치 (줌 · 편집 p99 ≤ 20 ms 대) 를 위협하고 Blink 도 그렇게 하지 않는다.
- D 기각: 사용자-가시 발산을 남긴다. 다만 fixed 는 입력 0 이라 사실상 D 상태를 **phase 로 분리해 유지** 한다 (사용자 결정 1 전).

### 사용자 결정 3건

execute-adr 가 해당 항목에 닿을 때 묻는다 — 지금 질문하지 않는다.

1. **저작 경로 (스키마)**: `node.layout.position` 에 `sticky` · `fixed` 를 허용하고 Design 패널에 노출할 것인가 (`validation.ts:195` · `TransformSection.tsx`). 허용하지 않으면 sticky 는 rule 입력 2 건만, fixed phase 는 입력 0 으로 종결 (ADR-164 미지원 유지). 허용하면 `LIBRARY_CONTRACT_VERSION` 올림 여부가 따라온다 (개발 단계라 변환 코드는 넣지 않는다 — 메모리 `feedback-no-document-migration-code-dev-stage`).
2. **fixed 의 Canvas 좌표계** (결정 1 이 허용일 때만): Canvas 는 저작 surface 라 화면 viewport 가 아니라 **page frame** (= Preview 스크롤 0 의 viewport) 기준으로 그린다 (권고 — 메모리 `feedback-skia-builder-not-frontend-interaction-belongs-to-preview`). 다른 선택: page 가 viewport 높이로 잘리는 모드에서만 fixed 표시.
3. **성능 미달 시**: sticky 노드는 unsafe 분류라 full repaint · 옮기기 거부를 늘릴 수 있다. Phase 0 기준선 대비 sticky fixture 의 full 카운트가 늘면 — (a) 정밀 paint bounds (정본 U4) 를 선행, (b) 측정 기록으로 종결, (c) sticky 를 unsafe 에서 빼고 damage 를 scroll container 로 확장. 권고 (c).

> 구현 상세: [267-sticky-fixed-position-canvas-engine-breakdown.md](design/267-sticky-fixed-position-canvas-engine-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                 | 심각도 | 대응                                                                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | geometry 출력 확장이 기존 parity · dual-run 스위트의 길이 · 순서 단언을 깨뜨림 (`apps/builder/tests/parity/*` · `tree.rs` 테스트)                                                                                                    |  MED   | 선택 필드 · sticky 없는 노드 0 바이트. Phase 0 에서 단언 자리를 세고 G0 (입력 0 문서 바이트 동일) 로 집행                                                                                                                                                          |
| R2  | 소비자가 scroll container 를 잘못 고름 (자기 오프셋 → 조상 오프셋 전환 · `overflow: auto` 인데 높이 미저작이라 스크롤이 없는 ListBox)                                                                                                |  MED   | scroll container 판정을 엔진 constraints 에 포함 (TS 재판정 없음 — 엔진 `is_scroll_container`, `hidden` 포함 · `clip` 제외. Canvas 스크롤 UI 용 `catalogOverflowScrolls` 와 다른 술어). ADR-156 oracle fixture 에 「overflow auto · 높이 없음 → 붙지 않음」 케이스 |
| R3  | `Header` rule 의 inset 없는 sticky 가 붙어 버림 (현재 소비자의 `?? 0`)                                                                                                                                                               |  MED   | Blink 계약 「inset 전부 auto = static」 을 constraints 에 그대로. 회귀 fixture 1                                                                                                                                                                                   |
| R4  | sticky 노드 = unsafe → 편집 full · 옮기기 거부 증가 (ListBox 섹션 헤더가 있는 문서)                                                                                                                                                  |  MED   | Phase 0 카운트 기준선 (`renderCounters` · ratchet run 에 sticky fixture) · 사용자 결정 3                                                                                                                                                                           |
| R5  | fixed phase 가 결정 1 전에 구현되어 입력 0 코드가 남음                                                                                                                                                                               |  LOW   | Phase 2 는 결정 1 뒤에만. 결정 전엔 정본 X8 fixed 를 `planned` 로                                                                                                                                                                                                  |
| R6  | 문서 stale — `layout-engine.md:67` (「absolute 근사」 — 실제는 in-flow static) · `tree.rs:2517` 주석 · `stickyResolver.ts` 헤더의 「ADR-100 Phase 3」 (ADR-100 은 Select 네이밍)                                                     |  LOW   | Phase 1 마지막 커밋에서 같이 고침 (정본 §0-5 목록)                                                                                                                                                                                                                 |
| R7  | sticky delta 를 그리기 좌표에만 적용해 bounds · hit · 자손 문맥이 정적 위치에 남음 — 붙은 헤더가 클릭 · 선택되지 않음 (리뷰 Round 1 H2)                                                                                              |  MED   | delta 를 bounds 기록 전에 계산하고 한 좌표를 모든 공간 출력 · 자식 문맥 (전체 · 서브트리 · self 재빌드) 에 쓴다. `renderCommands` 좌표 unit + G2 클릭 선택                                                                                                         |
| R8  | ListBox nested 블록 값이 part rule 에 닿지 않거나 inset `calc` 해석 실패가 조용히 「inset 없음」 으로 떨어짐 (리뷰 Round 1 H1) · 공용 layout 검증기가 라이브러리 rule 의 `sticky` 를 거부해 코드 라이브러리 생성이 실패 (Round 2 H1) |  MED   | manual Header part 가 nested 블록을 읽고, 해석 실패는 throw. 검증 선택지를 라이브러리 rule 용 (+ `sticky`) 과 저작용 (그대로) 으로 나눈다. 실제 `buildCodeCatalogLibrary` → resolver → `styleOf` end-to-end 단언 + 저작 거부 unit                                  |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점                 | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 실패 시 대안                                                                              |
| ---- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| G0   | Phase 0 종결         | sticky 입력 전수 (rule 2 · 수동 시트 2 · Table runtime) 표 · Compare Mode 발산 RED fixture 1 (ListBox 섹션 헤더 스크롤) · 입력 0 문서의 geometry · 명령 스트림 바이트 동일 단언 · 기존 단언 자리 목록 · unsafe 카운트 기준선                                                                                                                                                                                                                                                                             | 발산이 재현되지 않으면 정본 X8 을 재판정하고 ADR 을 Deprecated                            |
| G1   | Phase 1 각 커밋      | ADR-156 차등 oracle (browser vitest) sticky fixture ≥ 6 (스크롤 0 · 중간 · 끝 · padding-bottom 컨테이너 · margin 있는 sticky · inset 없음 · 양쪽 inset 공간 부족 · `auto` > `hidden` 경계) 전부 ≤ 1 px · bounds · hit 가 paint 와 같은 좌표 (unit) · ListBox nested 값의 end-to-end 도달 (실제 코드 라이브러리 생성 · 검증 포함, unit) · 노드 저작 `sticky` 는 계속 거부 (unit) · 원복 RED 1 (전송 제거 · nested 미독 · constraints 제거 · 조상 오프셋 되돌림 · bounds 정적 복귀 · owner 판정 축소 각 1) | 틀린 축만 수리, 한 커밋에 하나                                                            |
| G2   | Phase 1 종결         | Compare Mode live 1 회 (Chrome MCP) — 단독 ListBox (높이 저작 · 섹션 2) 를 스크롤해 Preview 와 Canvas 헤더 위치 같음 · 붙은 헤더를 Canvas 에서 클릭하면 선택되고 오버레이가 그려진 헤더와 겹침 · `Header` rule 단독은 변화 0                                                                                                                                                                                                                                                                             | 사용자 confirm 대체 불가 — 미통과면 Implemented 승격 보류                                 |
| G3   | Phase 1 종결         | ADR-246 ratchet: sticky 없는 run (600 · 5k · `app-pages`) 등급 A 변동 0 · sticky fixture run 등록 (full repaint · `pageGridMoveNullFixedOrSticky`) · Builder initial gzip ≤ 1,421,000 B                                                                                                                                                                                                                                                                                                                  | 사용자 결정 3                                                                             |
| G4   | Phase 2 (fixed) 진입 | 사용자 결정 1 = 허용 · 결정 2 확정 · fixed fixture (page frame 기준) ADR-156 oracle ≤ 1 px                                                                                                                                                                                                                                                                                                                                                                                                               | 결정 1 = 불허 → Phase 2 는 「ADR-164 미지원 유지」 로 종결, 정본 X8 fixed = `unsupported` |

집행 수단은 browser vitest (`pnpm -F @composition/builder test:parity`) · pre-push ratchet (`pnpm gate:perf-ratchet`) · 로컬 Chrome MCP live — 모두 `push: main` 과 양립한다.

### Live Exercise

(Implemented 승격 시 기재 — G2 의 Compare Mode 시나리오 · 결과 · 날짜 · Chrome MCP / 사용자 confirm 구분.)

## Consequences

### Positive

- ListBox 섹션 헤더의 Compare Mode 발산이 닫히고, catalog 가 싣는 `position` 값 네 가지 (`static · relative · absolute · sticky`) 가 전부 두 consumer 에 같은 뜻으로 도달한다.
- sticky 계산이 엔진 한 곳 (Blink 계약) 에 있어 TS 보정이 다시 생기지 않는다 (ADR-164 방향 유지).
- 정본 X8 이 `code-confirmed` → `gate-passed` 로 승격되고, `layout-engine.md` · `tree.rs` · `stickyResolver.ts` 의 틀린 설명이 정리된다.
- fixed 의 재개 조건 (ADR-164) 이 「실사용 등장」 이라는 관찰 대기에서 「사용자 결정 1」 이라는 명시 판정으로 바뀐다.

### Negative

- 엔진 geometry 출력에 선택 필드가 하나 늘어 wasm 경계 계약이 한 줄 복잡해진다.
- sticky 노드는 여전히 unsafe · 옮기기 거부라, 섹션 헤더가 많은 문서의 편집은 full 이 늘 수 있다 (R4 — 사용자 결정 3 까지 측정 기록).
- Table `.react-aria-Sticky` (수동 시트) · GridList 의 sticky 는 범위 밖으로 남는다 — Table 은 E02 (CSS table) 와 함께, GridList 는 Builder 무관.
- 저작 경로 (스키마) 결정 전까지 sticky 입력은 rule 2 건뿐이라 기능의 사용 빈도는 낮다 — 이 ADR 의 가치는 빈도가 아니라 D3 대칭의 완결이다.
