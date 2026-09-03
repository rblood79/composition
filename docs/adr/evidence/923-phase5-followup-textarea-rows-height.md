# ADR-923 Phase 5 후속 착수 2 — TextArea 본체 높이: Canvas 가 `rows` 를 읽지 않았다 (2026-09-03)

> 착수 순위 2 (evidence [subpart-extension §5·§7](923-phase5-followup-subpart-extension.md) · [fielderror-state-projection](923-phase5-followup-fielderror-state-projection.md) "TextArea 본체 격차 Canvas 56/30 vs DOM 96/70"). 착수 전 production 표면에서 먼저 쟀다 (착수 1 의 교훈).

## 1. 사실 (착수 전 실측 — Compare 모드 Preview, Chrome CPU throttle 4x)

| 표면    | root | Label | 컨트롤 | 근거                                                                                                                                                                                           |
| ------- | ---- | ----- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DOM     | 96   | 20    | **70** | `<textarea rows="3" class="react-aria-TextArea">` — line-height 20 × 3 + padding 4 × 2 + border 1 × 2 (computed `height: 70px`, `min-height: auto`, `resize: both`, data-size md)               |
| Canvas  | 56   | 20    | **30** | Input 자식이 read-only sub-part 라 factory 인라인 `height: 80` 은 투영이 걷어내고, implicit textfield/textarea 분기는 높이를 안 넣는다 → leaf Input 한 줄 (catalog `Input.sizes.md.height` 30) |

- DOM 높이의 원천은 D2 prop `rows` (shared `TextArea.tsx` `<AriaTextArea rows={rows}>`, 기본 3 · factory 3 · binding "Rows" 편집 가능). catalog `TextArea.sizes[size].height` (64/80/120/160) 는 **DOM 도 Skia 도 읽지 않는다** — TextArea rule 은 `source.component = TextField` 라 CSS 가 생성되지 않고 (메모리 `feedback-textarea-renders-as-textfield-class`), Canvas 는 그 필드를 소비하는 코드가 없다. 종전 factory 인라인 80 도 DOM 70 과 달랐다.
- 줄 높이는 한 줄 Input 상자에서 나온다: catalog `Input.sizes[size]` 의 `height − paddingY × 2 − border × 2` = md 30 − 8 − 2 = **20** (= `--text-sm--line-height`), lg 42 − 16 − 2 = 24, sm 22 − 4 − 2 = 16, xl 54 − 24 − 2 = 28 — DOM 한 줄 Input 도 line-height + padding + border 로 같은 30 이라 같은 상자다.

## 2. 수리 (동작 변경 — Canvas)

- **layout** `implicitStyles.ts` textfield/textarea 분기: `containerTag === "textarea"` 면 Input 자식에 `height = oneRow + (rows − 1) × lineHeight` 주입 (`textAreaInputHeight` — rows 는 1 미만·소수를 1 로 내림, 미지정 3; 사용자 명시 height 우선). read-time 주입이 유일 채널 (sub-part 투영 뒤 implicit 입력이 투영 사본).
- **Skia** `buildSpecNodeData.ts` sub-part 블록: owner TextArea 의 Input 에 `verticalAlign: "top"` 투영 (자식 인라인은 무시). 그 값이 위로 가는 경로는 두 층 — (1) `packages/specs` `buildCatalogShapes.ts`: box 텍스트 shape 가 `y:0 · baseline middle` 고정이라 (converter 가 `(containerHeight − textBlockHeight)/2` 로 paddingTop 25 를 만든다) `style.verticalAlign === "top"` 이면 `y = size.paddingY · baseline top` (textAlign 의 "사용자 명시 style 우선" 과 같은 데이터 분기) → converter paddingTop = 4 = DOM padding-top. (2) `nodeRendererText.ts`: explicit `"top"` 을 paddingTop 으로 그린다 — 종전엔 explicit paddingBottom 이 있으면 `"top"` 도 중앙 배치라 Style 패널 "Vertical Align: top" 이 no-op 이었다 (setter 0곳, 실측 grep). 첫 시도에서 (2) 만 고쳤을 때 zoom 이 그대로 중앙이었다 — paddingTop 자체가 중앙값이라 (1) 이 필요했다. 한 줄 Input (미설정) 은 기존 중앙 유지. specs 재빌드 (generated CSS diff 0).
- 손대지 않음: catalog `TextArea.sizes.height` (dead — §4) · DOM · factory 인라인 (투영이 무시).

## 3. 게이트 · 원복 RED

- unit `textFieldImplicitStyles.test.ts` +6: md rows 3 → 70 · 미지정 → 70 · rows 5/1/0/2.7 → 110/30/30/50 · lg 3 → 90 · sm 3 → 54 · side 라벨 rows 4 → 90 · TextField 는 미주입. RED 5 (height undefined) → GREEN.
- unit `buildSpecNodeData.test.ts` +2: TextArea > Input text.verticalAlign "top" (자식 인라인 "middle" 무시) · TextField > Input 미설정. RED 1 → GREEN.
- unit specs `buildCatalogShapes.verticalAlignTop.test.ts` +3: top → y 4 (paddingY) · baseline top · 미지정/middle 은 y 0 · middle. RED 1 → GREEN (specs renderers 538).
- browser `adr923FieldSubpartProjection.browser.test.ts`: "baseline DOM 대조" 의 TextArea 제외 (`continue`) 삭제 → 컨트롤 h·y · root h 를 1px 안에서 게이트. 원복 (implicit 주입 `if (false && …)`) 시 `TextArea control h canvas 30 dom 70` 1 FAIL → 복원 GREEN.

## 4. 검증 · live

- type-check PASS · skia + engines unit 860 · specs renderers 538 · browser field gate 8 (Field/FieldError state) · full parity (아래 §4 표) · builder unit 5210 PASS + **4 FAIL 은 다른 세션의 dirty 파일** (`canvasStore.ts` · `canonicalTraversalHelpers.ts` · `useResetStyles.ts` 정적/grep 게이트 — 본 변경 파일과 무관, 그 세션이 닫는다).
- live (수리 후, 같은 Preview): Canvas root `[24,136,342,96]` · Input `[0,26,342,70]` = DOM 96/70. `updateElementProps` 로 rows 6 → Canvas 130/156 = DOM 130/156 · rows 1 → 30/56 = 30/56 · size lg rows 3 → Input 90 = DOM 90 (root Canvas 122 vs DOM 120.85 — lg Label 줄 높이 Δ1.15, 본체 무관 기존 격차, 기록) · md rows 3 복귀 96/70. zoom: placeholder 가 상자 위 (padding) 에 놓인다.

## 5. 범위 밖 (기록만)

- ~~catalog `TextArea.sizes[size].height` 64/80/120/160 — 양쪽 다 안 읽는 dead 값~~ → **2026-09-04 삭제** (사용자 판단: 삭제). §6 참조.
- lg Label 줄 높이 Δ1.15 (DOM 22.85 vs Canvas 24) — Label 일반 격차.
- Style 패널 "Vertical Align: top" 이 이제 실제로 위에 붙는다 (종전 no-op) — 사용자-가시, CHANGELOG 기재.

## 6. 후속 — catalog `TextArea.sizes[size].height` 삭제 (2026-09-04, 착수 7)

사용자 판단: **삭제**. 근거 — 실제 높이는 `rows × Input 줄 높이 + padding + border` 계약이고 (§2) 이 값은 DOM·Canvas 모두 미소비다. 남겨두면 "여러 줄 상자 높이의 SSOT" 로 잘못 읽힌다.

**dead 확인은 grep 이 아니라 전 표면 변이 대조로** (메모리 `feedback-grep-zero-refs-is-not-dead-code`): 64/80/120/160 → 641/801/1201/1601 로 바꾸고 세 스위트를 돌렸다.

| 스위트          | 규모 | 변이에 반응한 것                                        |
| --------------- | ---- | ------------------------------------------------------- |
| browser parity  | 1090 | 없음 (기존 2 실패 그대로)                               |
| builder unit    | 5246 | 없음 (기존 4 실패 그대로 — 다른 세션 소관)              |
| shared unit     | 972  | **1** — 이 값을 고정하던 `domClassMatchesRuleKey` 테스트 |

즉 값을 읽는 유일한 소비자가 그 값을 고정하는 테스트였다.

- 변경: `componentRulesTable.ts` TextArea sizes 4개에서 `height` 제거 (paddingX/fontSize/borderRadius/gap 유지) + 삭제 사유 주석.
- 테스트 개정: "height 는 TextArea 고유값으로 유지된다" → **"height 는 없다 — 본체 높이의 정본은 rows × 줄 높이 계약이다"** (부재 고정 + 계산식 입력인 `Input.sizes.md.height` 는 존재해야 함). 다시 심으면 RED.
- live: 같은 문서의 TextArea md rows 3 — root 342×96 · Input 342×70 으로 §4 와 동일 (변화 0).
- 검증: type-check PASS · parity 1086 PASS (기존 2) · builder 5223 PASS (기존 4) · shared 972 PASS.
