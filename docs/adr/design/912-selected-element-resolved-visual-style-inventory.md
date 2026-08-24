# ADR-912 후속 Phase 0 — Resolved Visual Style Consumer Inventory

> 동결 기준: 2026-08-25, `main` HEAD `6a04d34cd`
>
> 상태: **Phase 0 Complete** — inventory 재동결 + D1~D5 expected RED fixture 완료
>
> 범위: catalog root paint의 `backgroundColor` / `color` / `borderColor`와 이를 선택하는
> authored state. layout, typography metric, transient hover/pressed/focus 편집 UI는 제외한다.

## 1. Producer와 adapter 경계

| 계층                 | production owner / entry                                                                                                   | 공급·변환 채널                                  | Phase 1~3 처리                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------ |
| Catalog D3           | `packages/shared/src/catalog/generated/componentRulesTable.ts::COMPONENT_RULES_TABLE`                                      | variant `fill`, `colors`, size, structure       | symbolic paint SSOT 유지                                     |
| Catalog D2           | `packages/shared/src/catalog/bindings/*.binding.ts`                                                                        | 편집 가능한 authored props                      | surface matrix를 아래 §4에 동결                              |
| Builder rule adapter | `apps/builder/src/builder/workspace/canvas/skia/resolveSkiaVisualRule.ts::resolveSkiaRule`                                 | rule variant를 `ComponentVisualRule`로 투영     | state 선택은 shared resolver로 이동하되 shape adapter는 유지 |
| Per-element accent   | `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts::resolveElementAccent` 및 `withAccentOverride` 호출부 | own/ancestor `accentColor`를 theme token에 적용 | canonical tree 탐색은 Builder read boundary에 유지           |
| Specs visual shape   | `packages/specs/src/renderers/utils/resolveComponentVisual.ts::ComponentVisualRule`                                        | renderer가 읽는 symbolic paint shape            | 타입은 유지, test-only 함수는 production owner가 아님        |
| DOM generator        | `packages/specs/src/renderers/CSSGenerator.ts`                                                                             | 같은 rule에서 data-attribute CSS 생성           | runtime resolver 주입 없이 precedence parity만 유지          |

`resolveComponentVisual`과 `variantToVisual` 함수는 파일 주석대로 test-only다. production Canvas
호출자는 Builder의 `resolveSkiaRule`이며, `packages/specs`가 `@composition/shared`를 import하지 않는
현재 패키지 방향을 Phase 0에서 바꾸지 않는다.

## 2. Canvas/Skia paint consumer 동결

### 2-1. Generic box + text owner

`packages/specs/src/renderers/buildCatalogShapes.ts::buildCatalogShapes` 한 함수가 다음 선택을 직접 한다.

| 입력 축                      | 직접 소비 결과                                                 |
| ---------------------------- | -------------------------------------------------------------- |
| `fillStyle`                  | `fill.default` / `fill.outline` / `fill.subtle`                |
| `isQuiet`                    | `fill.quiet`가 존재할 때 quiet state 선택                      |
| `isSelected`, `isEmphasized` | selected/emphasizedSelected background, text, border           |
| `staticColor`                | opaque box의 fixed background + inverse text + eligible border |
| `interactionState`           | default/hover/pressed background, text, border                 |
| `props.style`                | background/text/border explicit override 최우선                |
| `fill.alpha`, `fillBar`      | visible box, opaque background, 25% static track wash 판정     |

보조 consumer인 `resolveSelectionSlot`과 `resolveLeadingSlot`은 각각 selection checkbox와 leading
icon/avatar의 시각 메타를 읽는다. 이 둘은 root 3채널을 고르는 함수는 아니지만 primitive와 generic
text의 위치·표시 결론을 공유하므로 adapter 삭제 대상이 아니다.

### 2-2. `skiaPrimitives.ts` 직접 paint read 26개

| 채널                         | 함수                                                                                                      |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| text                         | `iconFont`, `breadcrumbCrumb`, `calendarMonthGrid`, `leadingIcon`, `inlineIconText`, `illustratedMessage` |
| fill                         | `dot`, `tooltipArrow`, `popoverArrow`                                                                     |
| border                       | `divider`, `tableRowDivider`, `tablistDivider`, `leadingAvatar`                                           |
| fill + text                  | `statusLight`, `avatar`                                                                                   |
| fill + text + border         | `gridListCard`, `calendarGrid`, `datefieldSegments`                                                       |
| selection fill/border        | `listBoxItem`, `checkbox`, `radio`, `switchToggle`                                                        |
| subpart track/value + static | `valueFillBar`, `sliderFillBar`, `valueFillArc`                                                           |
| selection slot metadata      | `selectionCheckbox`                                                                                       |

`sliderThumb`는 `SkiaPrimitiveDrawFn`이지만 현재 `return []`이며 paint 소비가 0건이다. 위 26개 중
root 3채널을 공통 resolver 결과로 치환할 대상과 subpart/slot 메타를 유지할 대상을 Phase 1
output shape 확정 시 분리한다. `valueFillBar`/`valueFillArc`의 `staticColor`와 `fillBar`,
`selectionCheckbox`의 slot config는 root 3채널로 소실시키지 않는다.

### 2-3. Canvas 조립 및 theme consumer

| 파일 / 함수                                                                                          | 역할                                                                |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts::buildCatalogShapesOrPrimitive` | generic/primitive 호출과 compose mode 선택                          |
| `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts::resolveElementAccent`          | own → ancestor 순서로 accent 탐색                                   |
| `apps/builder/src/utils/theme/tintToSkiaColors.ts::withAccentOverride`                               | 동기 callback 동안 light/dark accent 5토큰을 교체·복원              |
| `packages/specs/src/renderers/composeCatalogShapes.ts::composeCatalogShapes`                         | prepend/replace/append shape 합성; paint state를 다시 선택하지 않음 |

### 2-4. DOM/Preview/Publish transport와 manual paint

| 축                         | production 경로                                                                                                            | 판정                                                                           |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| generated state CSS        | `packages/specs/src/renderers/CSSGenerator.ts`                                                                             | catalog rule의 fill/quiet/selected/emphasized selector를 emit하는 DOM consumer |
| Badge fillStyle            | `packages/shared/src/components/styles/Badge.css`                                                                          | bold/subtle/outline paint를 수동 소유하는 D1 dual source; Phase 4 제거 대상    |
| staticColor CSS            | `Button.css`, `Link.css`, `ToggleButton.css`, `ToggleButtonGroup.css`, `ProgressBar.css`                                   | theme token으로 표현하지 못한 fixed black/white 및 track wash 소비             |
| ProgressCircle staticColor | `packages/shared/src/components/ProgressCircle.tsx`                                                                        | inline track/indicator static paint 소비                                       |
| authored prop emit         | `Button.tsx`, `Link.tsx`, `ToggleButton.tsx`, `ToggleButtonGroup.tsx`, `ProgressBar.tsx`, `ProgressCircle.tsx`, `Card.tsx` | `data-*` 또는 component prop transport; paint precedence owner는 아님          |
| composite forwarding       | `packages/shared/src/renderers/CollectionRenderers.tsx`, `LayoutRenderers.tsx`                                             | staticColor/accentColor를 실제 DOM component/data attribute로 전달             |

manual static CSS와 ProgressCircle subpart 계산은 root resolver로 모두 흡수하지 않는다. 공통 resolver는
동일 authored-state precedence를 제공하고 DOM은 현재 data-attribute/inline consumer를 유지한다.

## 3. Style Panel과 picker consumer 동결

| 경계                                                                | 현재 입력                                                          | 확인된 누락 / 유지 계약                                                   |
| ------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `useElementStyleContext`                                            | canonical 또는 legacy fallback 요소, ref origin, breakpoint, fills | effective props/style은 제공하지만 inherited accent는 제공하지 않음       |
| `resolveCatalogColorPreset`                                         | type + `variant` + `fillStyle` + `isQuiet`                         | `staticColor`, selected/emphasized, accent 누락                           |
| appearance/typography preset cache                                  | `type:size:variant:fillStyle:isQuiet` 문자열                       | 누락 state를 key에 추가하는 방식은 금지; dynamic paint cache 제거 대상    |
| `useAppearanceValues`                                               | effective style/fills + appearance preset + global theme           | background/border concrete picker color 소비                              |
| `useTypographyValues`                                               | effective style + typography preset + global theme                 | text concrete picker color 소비                                           |
| `resolveStylePanelColor`                                            | TokenRef, 단순 CSS variable, CSS color + global theme              | element/ancestor accent context 없음                                      |
| `ModifiedStylesSection`                                             | raw inline style 문자열                                            | `var(--token)`을 `PropertyColor`에 그대로 전달                            |
| `PropertyColor.safeSwatchColor` / `ColorPickerPanel.safeParseColor` | React Aria parseable color                                         | parse 실패 시 검정 fallback; 호출 전에 known token을 concrete로 바꿔야 함 |

ColorArea의 continuous preview/terminal commit 계약은 ADR-187 owner이며 이 inventory의 변경 대상이
아니다. unsupported gradient/mesh 및 secondary fill의 commit-only 경로도 D1~D5와 구분한다.

## 4. Authored-state binding matrix

binding 파일의 `accepts` key를 전수 검색한 결과는 **31 component-axis 조합**이다. 한 컴포넌트가
여러 축을 노출하면 각 축에 한 번씩 센다. 주석의 과거 prop 이름은 제외했다.

| 축             |  수 | binding type                                                                                                                                                                    |
| -------------- | --: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `staticColor`  |   6 | Button, Link, ProgressBar, ProgressCircle, ToggleButton, ToggleButtonGroup                                                                                                      |
| `isSelected`   |   5 | Card, Checkbox, Radio, Switch, ToggleButton                                                                                                                                     |
| `isEmphasized` |   2 | ToggleButton, ToggleButtonGroup                                                                                                                                                 |
| `isQuiet`      |  15 | ColorField, ComboBox, DateField, DatePicker, DateRangePicker, GridList, Link, NumberField, SearchField, Select, TextArea, TextField, TimeField, ToggleButton, ToggleButtonGroup |
| `fillStyle`    |   2 | Badge, Button                                                                                                                                                                   |
| `accentColor`  |   1 | Card                                                                                                                                                                            |

문자열 grep에는 과거/내부 계약을 설명하는 주석도 잡힌다. Card의 `isQuiet`/`fillStyle`,
ListBoxItem의 `isSelected`, TableView의 `isQuiet`은 현재 accepts key가 아니므로 matrix에서 제외했다.
Card quiet은 `variant="quiet"`로 흡수됐고 ListBoxItem selection은 collection projection이 주입하는
runtime state다. Phase 1 fixture 입력은 위 31개 D2 surface와 별도로 renderer-injected state를
검증한다.

## 5. D1~D5 RED fixture와 기존 GREEN oracle

Phase 0 fixture는 Vitest `it.fails`를 사용한다. 현재 결손으로 assertion이 실패해야 suite가
통과하며, 구현으로 assertion이 통과하는 순간 `it.fails` 자체가 실패하므로 해당 test를 일반 `it`로
전환해야 다음 Phase gate를 통과한다.

| ID  | fixture 경계                                            | RED 원인                                          |
| --- | ------------------------------------------------------- | ------------------------------------------------- |
| D1  | Badge binding option ↔ rule coverage + Style Panel hook | `subtle`/`outline` catalog paint 부재             |
| D2  | Button `staticColor=black` Style Panel hook             | panel resolver와 cache key가 staticColor 무시     |
| D3  | ToggleButton selected + emphasized Style Panel hook     | panel resolver와 cache key가 selection state 무시 |
| D4  | own/ancestor accent Style Panel hook                    | panel read context에 inherited accent 없음        |
| D5  | Modified Styles `var(--accent)` 전달 fixture            | raw CSS variable이 picker parse 경계까지 도달     |

기존 GREEN oracle은 다음을 유지한다.

- Button primary/accent outline/premium dark + inline override color tests.
- `useElementStyleContext`의 ref-origin merge, tier별 responsive merge, fills fallback.
- Phase 0에서 ref-origin responsive와 instance inline override를 한 fixture에 합쳐 precedence를 추가 고정.
- Specs의 `buildCatalogShapes` fillStyle/quiet/selection/staticColor tests는 Canvas 현행 oracle로 유지.

## 6. Scope 판정

- breakdown의 HIGH-risk seed 8개 대비 실측 resolver/consumer 경계는 위 표의 18개 module/file
  family로 **2.25배**다. 여기에 DOM transport와 manual CSS sibling이 별도로 있다. 1.5배 threshold를
  넘었으므로 이 문서로 inventory를 재freeze했으며, ADR fork 사유로 사용하지 않는다.
- `skiaPrimitives.ts` 내부 direct paint 함수는 26개지만 단일 registry의 data-driven consumer다.
  Phase 2에서 함수별 분기 추가가 아니라 주입 paint adapter를 공유해야 한다.
- Phase 1 output에는 root paint 외에 `backgroundAlpha`, `staticTrackWash`, visible/opaque capability가
  필요하다. `fillBar`, selection checkbox, leading slot 메타는 별도 adapter input으로 보존한다.
- 새 ADR로 분리하지 않고 ADR-912 후속 breakdown 안에서 Phase 1을 진행할 수 있다.

## 7. Phase 0 gate 결과

| Gate                             | 결과 | 근거                                                                       |
| -------------------------------- | ---- | -------------------------------------------------------------------------- |
| Inventory                        | PASS | resolver/consumer 18경계, direct paint primitive 26개, binding 31조합 기록 |
| D1~D5 RED                        | PASS | 7개 `it.fails`가 현재 결손으로 expected failure                            |
| 기존 GREEN                       | PASS | Builder/shared 집중 실행 104 passed                                        |
| Ref/responsive/inline precedence | PASS | 결합 GREEN fixture 1개 추가                                                |
| TypeScript                       | PASS | `codex:typecheck`, 신규 violation 0; 기존 baseline 43 유지                 |
| Production 변경                  | PASS | test와 design 문서만 변경, runtime source 0건                              |

CSS↔Skia cross-check와 Builder live 검증은 production render/write 동작을 바꾸지 않은 Phase 0에서는
수행하지 않는다. Phase 2/3 전환 시 각 gate에서 실행한다.
