# Canvas 렌더링 구현 상세

> `.claude/rules/canvas-rendering.md` 의 구현 세부사항. 규칙 원칙은 canvas-rendering.md 를 참조한다.
>
> **2026-10-04 개정**: ADR-248 Phase 4 (2026-10-03) 뒤 production Canvas 는 `catalogRuntime/canvasBinding.ts` (binding 실행기) · `ruleShapes.ts` / `rulePaint.ts` (rule 실행기) · `presence.ts` (owner 파생 값) 이다. 옛 `buildSpecNodeData.ts` · factory Label 정의 · `useCentralCanvasPointerHandlers.ts` 를 근거로 한 절은 지웠다. 옛 레이아웃 경로 (`fullTreeLayout.ts` · `implicitStyles.ts` 의 주입 · `engines/utils.ts` 의 태그별 크기) 는 2026-10-05 삭제됐다 ([layout-engine.md](../../../rules/layout-engine.md)).

## Label — 크기 · 줄바꿈 · 접미사

| 축               | 현행                                                                                                                                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 템플릿           | 합성 템플릿의 Label 은 `props.children: "{label}"` 만 갖고 인라인 style 이 없다 (`reusableOriginLibrary.ts`). 시각은 catalog `COMPONENT_RULES_TABLE.Label`                                                                                                          |
| size 전달        | `CATALOG_SIZE_PROPAGATION` (`document/sizePropagation.ts`) — Checkbox/Radio → Label, 그룹 → items → item. resolver 가 한 번 해석해 Canvas rule box 와 DOM `data-size` 가 같은 값을 읽는다                                                                           |
| 부모 delegation  | 부모 rule 이 `--label-font-size` / `--label-font-weight` / `--label-line-height` 를 두고 Label 이 소비 (`document/rulePartRules.ts` `CONSUMED_VARIABLES` — DOM `Label.css` 와 같은 다리) · field 가족 FieldError 는 `resolveDelegatedChildFontSize`                 |
| 줄바꿈           | `label` binding 은 nowrap (`compositionRoot.ts` `noWrapTextBindings` — `Label.css` 와 같음). 측정도 min-content = max-content                                                                                                                                       |
| Necessity 접미사 | `catalogLabelSuffix` (`catalogRuntime/presence.ts`) — field 자신의 `necessityIndicator`, 없으면 가장 가까운 Form 의 값 + `isRequired` → `getNecessityIndicatorSuffix`. DOM 은 `renderNecessityIndicator` (`packages/shared/src/components/FieldNecessityIndicator`) |

- **주의**: `--text-md` CSS 변수는 없다 → `var(--text-base)` (`tokenToCSSVar()` 가 `text-md` → `text-base` 매핑).
- lineHeight 는 `"20px"` 문자열 (숫자는 `parseLineHeight` 가 배율로 해석).
- `createDefaultLabelProps()` (`types/builder/unified.types.ts`) 는 옛 타입 mirror 다 — catalog 생성 경로가 쓰지 않는다.

## Tag/Badge · Table 셀 nowrap

`catalogRuleShapes` (`ruleShapes.ts`) — Tag · Badge · Cell · Column, 그리고 레이아웃이 한 줄로 둔 leaf (`singleLine`) 의 text shape 에 `whiteSpace: "nowrap"` (Table.css `.react-aria-Cell, .react-aria-Column` 과 같은 규칙).

## Calendar 계열 (catalog 기반)

- 시각 정본: `COMPONENT_RULES_TABLE` + `Calendar/RangeCalendar/CalendarGrid/CalendarHeader.binding.ts`.
- `CalendarHeader` 는 `BOX_SIZE_TYPES` (`ruleShapes.ts`) — 우측 chevron / 가운데 text 좌표가 상자 폭 의존 (`_containerWidth` 주입).
- `Calendar` / `RangeCalendar` 는 `SHELL_ONLY_TYPES` (`rulePaint.ts`) — 자식 수 무관 `_hasChildren=true` (ADR-072).

## Overlay 자식 제외 (Popover 류)

`TRIGGER_OVERLAY_CHILDREN` (`catalogRuntime/presence.ts`) — 트리거 컴포넌트가 닫힌 overlay 에 두는 자식 (DatePicker → Calendar/Popover, Select/ComboBox → ListBox 계열/Popover, DialogTrigger, Menu …). 레이아웃은 상자를 주지 않고 Canvas 는 그리지 않는다 — Preview 에서 overlay 로 열리는 것과 같은 결과.

## Pointer → Move

`CatalogCanvas.tsx` pointerdown → `picking.target(x, y, deep)` (현재 맥락 깊이로 정규화) → 선택돼 있으면 `gestures.beginMove` → `CatalogCanvasGestures.beginMove` (`catalogRuntime/canvasGesture.ts`) 가 `host.selection()` 을 읽어 이동 대상을 정한다. 히트한 원시 id 를 이동 대상으로 넘기지 않는다 — 위반 시 컴포넌트 반복 선택 · 더블클릭 때 내부 자식이 의도치 않게 이동한다. 판정 표는 [canvas-interaction.md](../../../rules/canvas-interaction.md) §8.8.

## Arc Shape 렌더링 (ProgressCircle 등)

Spec `arc` shape → `specShapeConverter` 에서 `type: "box"` + `arc` 데이터로 변환. 별도 `type: "arc"` 금지 (`React.lazy()` import 체인으로 `renderNodeInternal` switch 미도달, HMR 이슈).

- `renderBox` 에서 `node.arc` 감지 시 `CanvasKit.Path.addArc()` 로 부분 원호 렌더링.
- 트랙 링에 `circle` + stroke 금지: `renderSolidBorder` 는 `inset = sw/2` 를 적용해 스트로크 중심 반지름이 안쪽으로 밀리고, `addArc` 는 정확한 반지름에 그려 어긋난다. 트랙도 `arc(sweepAngle=360°)` 로 같은 경로.
- text 중앙 배치: `x: 0, y: 0` + `align: "center"` + `baseline: "middle"` (`x: cx, y: cy` 면 paddingLeft/maxWidth 오계산으로 치우침).

## Container Dimension Injection

shape 생성기가 상자 크기를 필요로 할 때:

- `catalogRuleShapes` 가 `BOX_SIZE_TYPES` 타입에 `_containerWidth` / `_containerHeight` 를 rect 에서 바로 주입 (`ruleShapes.ts`) — 레이아웃 결과를 받는 시점이라 타이밍 문제가 없다.
- 줄바꿈 뒤 높이 재계산은 composition root 의 `rewrap` (height-for-width 1회 재측정 — layout-engine.md 6단계 표).
- 우측 역산 배치: `containerWidth - border - paddingRight - pad - iconSize/2` (텍스트 폭 추정 금지).
- 세로 중앙: `containerHeight / 2` (`size.height / 2` 금지 — border 미포함).
- 부모와 자식을 함께 바꾸는 편집은 `composeCommands` 한 step.
- 상세: [spec-container-dimension-injection.md](../rules/spec-container-dimension-injection.md)

## Collection Item Font (ListBoxItem/GridListItem)

시각 · 측정 font 모두 catalog `COMPONENT_RULES_TABLE` rule 이다 (레이아웃 측정은 resolved record 를 읽는 `styleOf`). 옛 `injectCollectionItemFontStyles()` 높이 경로는 2026-10-05 삭제.

## fontFamilies — 측정기 ↔ 렌더러 동일 배열

- 렌더러: `nodeRendererText.ts` 가 CSS 체인 전체를 `resolveFamily()` 로 매핑 (Canvas 2D 문자열과 fallback Paragraph 둘 다 `resolvedFamilies` 에서).
- CSS fontFamily 문자열을 단일 배열 요소로 넘기지 않는다 (CanvasKit 매칭 실패 → fallback 폰트 → 폭 차이). 첫 폰트만 추출 (`split(",")[0]`) 도 금지.
- 기본 fallback 은 `CANVAS_FONT_FALLBACK_FAMILIES` (`fonts/customFonts.ts`), 텍스트 binding 은 `catalogFontFamilies` (`catalogRuntime/boxModel.ts`).
- **FontMgr 교체 시 캐시 clear**: Paragraph 캐시 (`nodeRendererText.ts`) 와 Canvas 2D 세그먼트 캐시 (`utils/canvas2dSegmentCache.ts`) 는 별도 관리 (렌더 vs 측정).

## 텍스트 측정 ↔ 렌더 오차 처리

- **레이아웃 측정**: `catalogTextMeasure` (`catalogRuntime/textMeasure.ts`) — CanvasKit 준비 후엔 Canvas 가 그릴 paragraph 로 측정, 준비 전엔 Canvas 2D. 측정기 종류별 보정 (+2/+4px) 금지.
- **Break Hint**: `nodeRendererText.ts` — Canvas 2D 가 줄바꿈을 정해 `\n` 으로 넣고 CanvasKit 에 강제 (ADR-051).
- **post-layout 교정**: `paragraph.layout()` 뒤 `\n` 없는 단일줄이 줄바꿈되면 `getMaxIntrinsicWidth() + 1` 로 재layout. 상세는 [child-composition.md](child-composition.md) §4.
- `getMaxIntrinsicWidth()` 는 반드시 `layout()` 이후에 부른다 (이전이면 0).
