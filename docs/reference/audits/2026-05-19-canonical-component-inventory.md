# ADR-142 Phase 0 — Canonical component inventory

> ADR-142 [breakdown Phase 0](../../adr/design/142-starter-spec-component-system-cutover-breakdown.md) 산출물.
> Gate G0/G1 — starter source freeze, starter primitive/composed 분류,
> legacy `ComponentSpec` 처분, 기존 6개 registry diff, `design.md` 완전성 확인.

**작성:** 2026-05-20
**기준:** `main` / `d8ff43614`
**범위:** 문서 inventory + upstream 보호 문구 정리. `packages/react-aria-starter/src/**`
및 runtime 구현 파일 변경 없음.

## 1. Gate 요약

| Gate | 판정 | 근거                                                                                                                                                                                                                          |
| ---- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G0   | PASS | `packages/react-aria-starter/src/**` 원본 미수정, `pnpm-workspace.yaml` 에서 `!packages/react-aria-starter` 제외 유지, `UPSTREAM.md` reference-only 정책 정리. 신규 active component 를 legacy 6개 registry 에 추가하지 않음. |
| G1   | PASS | starter 55개 파일 분류, 124 `ComponentSpec` legacy 처분, 6개 registry diff, 비-DOM-trivial primitive 후보, `design.md` section 완전성 확인을 본 문서에 고정.                                                                  |

실행 검증:

```bash
git status --short
pnpm run codex:guard
pnpm run codex:typecheck
pnpm test:registration-contract
```

결과: `codex:guard` PASS, `codex:typecheck` 는 TS 변경 없음으로 스킵,
`componentRegistrationContract.test.ts` 10/10 PASS.

## 2. Starter snapshot inventory

| 항목                                    |  수 | 비고                                                        |
| --------------------------------------- | --: | ----------------------------------------------------------- |
| `packages/react-aria-starter/src/*.tsx` |  55 | starter 컴포넌트/헬퍼 reference 파일                        |
| `packages/react-aria-starter/src/*.css` |  56 | 컴포넌트 CSS 54 + `theme.css` + `utilities.css`             |
| 컴포넌트 CSS 없음                       |   1 | `ProgressCircle.tsx` 는 전용 `ProgressCircle.css` 없음      |
| runtime import                          |   0 | ADR-142 기준으로 starter source 는 runtime import 대상 아님 |

`packages/react-aria-starter/design.md` 의 top-level section set:

1. Overview
2. Colors
3. Typography
4. Layout
5. Elevation & Depth
6. Shapes
7. Components
8. Motion
9. Mapping
10. Appendix
11. Do's and Don'ts

판정: Phase 0 입력 reference 로 사용 가능. 단 이 문서는 theme/tokens root
collection 을 대체하는 runtime D3 SSOT 가 아니며, `PrimitiveBinding` 런타임
계약도 아니다.

## 3. Starter 55 분류표

분류 용어:

- `primitive` — leaf 또는 RAC primitive family 의 `PrimitiveBinding` 후보.
- `composed` — canonical reusable 문서로 저작할 후보. binding 이 아니라 데이터가 기준.
- `helper` — starter 내부 편의 wrapper/alias. Phase 1b/2 에서 primitive 또는 reusable 로 흡수 방식 확정.

| Starter file        | Phase 0 분류 | Family             | CSS reference                     | 비고                                             |
| ------------------- | ------------ | ------------------ | --------------------------------- | ------------------------------------------------ |
| `Breadcrumbs`       | primitive    | primitives/actions | `Breadcrumbs.css`                 | Breadcrumb subpart 포함                          |
| `Button`            | primitive    | primitives/actions | `Button.css`                      | Phase 1a proof slice 후보                        |
| `Calendar`          | primitive    | date-color         | `Calendar.css`                    | active `skiaPrimitive` pilot                     |
| `Checkbox`          | primitive    | selection          | `Checkbox.css`                    | indicator draw 검증 필요                         |
| `CheckboxGroup`     | primitive    | selection          | `CheckboxGroup.css`               | group + checkbox children                        |
| `ColorArea`         | primitive    | date-color         | `ColorArea.css`                   | active `skiaPrimitive` pilot                     |
| `ColorField`        | primitive    | fields             | `ColorField.css`                  | field family                                     |
| `ColorPicker`       | primitive    | date-color         | `ColorPicker.css`                 | active composite placement pilot                 |
| `ColorSlider`       | primitive    | date-color         | `ColorSlider.css`                 | active `skiaPrimitive` pilot                     |
| `ColorSwatch`       | primitive    | date-color         | `ColorSwatch.css`                 | color fill draw 검증 필요                        |
| `ColorSwatchPicker` | primitive    | date-color         | `ColorSwatchPicker.css`           | collection-like picker                           |
| `ColorThumb`        | primitive    | date-color         | `ColorThumb.css`                  | `skiaPrimitive` 후보                             |
| `ColorWheel`        | primitive    | date-color         | `ColorWheel.css`                  | active `skiaPrimitive` pilot                     |
| `ComboBox`          | primitive    | collections        | `ComboBox.css`                    | ListBox 재사용 경계 검증                         |
| `CommandPalette`    | composed     | overlays           | `CommandPalette.css`              | Autocomplete + Menu + Dialog 조합                |
| `Content`           | helper       | primitives/actions | `Content.css`                     | Heading/Text wrapper surface                     |
| `DateField`         | primitive    | fields             | `DateField.css`                   | DateInput/DateSegment subpart 포함               |
| `DatePicker`        | primitive    | date-color         | `DatePicker.css`                  | active `skiaPrimitive` pilot                     |
| `DateRangePicker`   | primitive    | date-color         | `DateRangePicker.css`             | active `skiaPrimitive` pilot                     |
| `Dialog`            | primitive    | overlays           | `Dialog.css`                      | DialogTrigger/Heading export 포함                |
| `Disclosure`        | primitive    | collections        | `Disclosure.css`                  | header/panel subpart 포함                        |
| `DisclosureGroup`   | primitive    | collections        | `DisclosureGroup.css`             | disclosure collection                            |
| `DropZone`          | primitive    | overlays           | `DropZone.css`                    | Text export 포함                                 |
| `Form`              | primitive    | fields             | `Form.css`                        | Label/FieldError/Description/FieldButton exports |
| `GridList`          | primitive    | collections        | `GridList.css`                    | item/load-more/section exports                   |
| `InputGroup`        | helper       | fields             | `InputGroup.css`                  | Group + InputContext wrapper                     |
| `Link`              | primitive    | primitives/actions | `Link.css`                        | RAC Link                                         |
| `ListBox`           | primitive    | collections        | `ListBox.css`                     | Select/ComboBox shared list primitive            |
| `Menu`              | primitive    | collections        | `Menu.css`                        | MenuTrigger/MenuItem/SubmenuTrigger              |
| `Meter`             | primitive    | primitives/actions | `Meter.css`                       | track/value draw 검증 필요                       |
| `Modal`             | primitive    | overlays           | `Modal.css`                       | Modal overlay primitive                          |
| `NumberField`       | primitive    | fields             | `NumberField.css`                 | field family                                     |
| `Popover`           | primitive    | overlays           | `Popover.css`                     | overlay arrow option                             |
| `ProgressBar`       | primitive    | primitives/actions | `ProgressBar.css`                 | track/bar draw 검증 필요                         |
| `ProgressCircle`    | primitive    | primitives/actions | 없음                              | SVG circle draw, `skiaPrimitive` 후보            |
| `RadioGroup`        | primitive    | selection          | `RadioGroup.css`, `utilities.css` | Radio subpart 포함                               |
| `RangeCalendar`     | primitive    | date-color         | `RangeCalendar.css`               | active `skiaPrimitive` pilot                     |
| `SearchField`       | primitive    | fields             | `SearchField.css`                 | field family                                     |
| `SegmentedControl`  | helper       | selection          | `SegmentedControl.css`            | ToggleButtonGroup alias/wrapper                  |
| `Select`            | primitive    | collections        | `Select.css`                      | ListBox 재사용 경계 검증                         |
| `Separator`         | primitive    | primitives/actions | `Separator.css`                   | RAC Separator                                    |
| `Sheet`             | composed     | overlays           | `Sheet.css`                       | Modal + overlay layout reusable 후보             |
| `Slider`            | primitive    | selection          | `Slider.css`                      | track/thumb `skiaPrimitive` 후보                 |
| `Switch`            | primitive    | selection          | `Switch.css`                      | thumb/track draw 검증 필요                       |
| `Table`             | primitive    | tree-table         | `Table.css`                       | RAC Table + collections 데이터, 수동 우회 금지   |
| `Tabs`              | primitive    | collections        | `Tabs.css`                        | TabList/TabPanels/TabPanel subparts              |
| `TagGroup`          | primitive    | collections        | `TagGroup.css`                    | Tag/List collection                              |
| `TextField`         | primitive    | fields             | `TextField.css`                   | field family                                     |
| `TimeField`         | primitive    | fields             | `TimeField.css`                   | time segment field                               |
| `Toast`             | primitive    | overlays           | `Toast.css`                       | queue/region boundary 별도 검증                  |
| `ToggleButton`      | primitive    | primitives/actions | `ToggleButton.css`                | action state                                     |
| `ToggleButtonGroup` | primitive    | primitives/actions | `ToggleButtonGroup.css`           | group state                                      |
| `Toolbar`           | primitive    | primitives/actions | `Toolbar.css`                     | separator/toggle context                         |
| `Tooltip`           | primitive    | overlays           | `Tooltip.css`                     | trigger + overlay                                |
| `Tree`              | primitive    | tree-table         | `Tree.css`                        | RAC Tree + collections 데이터, 수동 우회 금지    |

요약: 50개는 primitive 또는 primitive-family binding 후보, 3개는 helper,
2개는 canonical reusable 문서 후보. 이 수치는 최종 `PrimitiveBinding` 개수와
동일하지 않다. Phase 1b 에서 subpart/export 를 약 35개 leaf binding 으로
정규화한다.

2026-05-20 구현 메모: `Breadcrumbs`, `ToggleButtonGroup`, `Toolbar` 는 active
primitive catalog pilot 으로 등록했고, parent 기본 자식은
`PrimitiveBinding.placement` child template 에서 생성한다. `Breadcrumb` 는
Breadcrumbs parent 의 non-placeable subpart binding 이다. starter 원본과 legacy 6개
registry 신규 active 등록은 변경하지 않았다.

2026-05-20 collections 구현 메모: `ListBox`, `GridList`, `TagGroup`, `Menu`,
`ComboBox`, `Select`, `Tabs` 는 active primitive catalog pilot 으로 등록했다. 각
항목은 `PrimitiveBinding` + `toRacProps` + shared wrapper projection + Preview
primitive branch + generic Skia fixture 로 검증하며, starter 원본과 legacy 6개
registry 신규 active 등록은 변경하지 않았다. ADR-132 collection 데이터 binding 전체
전환은 별도 잔여다.

## 4. 비-DOM-trivial / `skiaPrimitive` 후보

다음은 generic Skia backend 가 단순 box/text draw 로 환원하기 어렵거나,
track/indicator/arc/cell state 를 별도 draw module 로 표현할 가능성이 큰 후보.

| 후보                                                                                       | 이유                                                                                           |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `Checkbox`, `RadioGroup`, `Switch`                                                         | checked indicator, thumb/track state                                                           |
| `Slider`                                                                                   | track/fill/thumb geometry                                                                      |
| `ProgressBar`, `ProgressCircle`, `Meter`                                                   | progress track/value/arc geometry                                                              |
| `Calendar`, `RangeCalendar`, `DatePicker`, `DateRangePicker`                               | date cell state, range band, calendar grid                                                     |
| `ColorArea`, `ColorSlider`, `ColorWheel`, `ColorThumb`, `ColorSwatch`, `ColorSwatchPicker` | gradient/arc/thumb/color fill                                                                  |
| `ListBox`, `GridList`, `Menu`, `TagGroup`, `ComboBox`, `Tabs`                              | collection item state, keyboard/selection state visualization                                  |
| `Tree`, `Table`, `TableView`                                                               | collections 데이터 + row/cell/tree disclosure state. 수동 우회 구현으로 full support 주장 금지 |
| `DropZone`                                                                                 | drop-target state + dashed container/icon/text. legacy render.shapes 우회 금지                 |
| `Tooltip`                                                                                  | overlay bubble/text/arrow + trigger positioning. legacy render.shapes 우회 금지                |
| `Dialog`                                                                                   | overlay panel/text role state. legacy render.shapes 우회 금지                                  |

Phase 1a 의 Button proof 는 최소 연결성 검증이고, 위 후보들의 비용/시각 대칭은
G2b/G2c 및 family fixture 에서 별도 검증해야 한다.

## 5. Legacy `ComponentSpec` 처분

`packages/specs/src/components/*.spec.ts` 는 124개다. ADR-142 신규 시스템의
source, migration source, 또는 `PrimitiveBinding` 작성 source 로 쓰지 않는다.
처분은 전수 `legacy compatibility boundary` 다.

허용:

- legacy 문서 import/export/read-time compatibility
- explicit legacy fallback test
- migration fixture 및 현행 회귀 비교 기준

금지:

- `packages/shared/src/catalog/**` 에서 import
- `PrimitiveBinding`/`componentCatalog` 생성 source
- 신규 active authoring path 등록
- `render.shapes()` 확장으로 RAC 구조를 표현하려는 우회

124개 legacy 목록:

`Accordion`, `Autocomplete`, `Avatar`, `AvatarGroup`, `Badge`, `Body`, `Breadcrumb`,
`Breadcrumbs`, `Button`, `ButtonGroup`, `Calendar`, `CalendarGrid`, `CalendarHeader`,
`Card`, `CardContent`, `CardFooter`, `CardHeader`, `CardPreview`, `CardView`,
`Checkbox`, `CheckboxGroup`, `CheckboxItems`, `Code`, `ColorArea`, `ColorField`,
`ColorPicker`, `ColorSlider`, `ColorSwatch`, `ColorSwatchPicker`, `ColorWheel`,
`ComboBox`, `DateField`, `DateInput`, `DatePicker`, `DateRangePicker`, `DateSegment`,
`Description`, `Dialog`, `DialogFooter`, `Disclosure`, `DisclosureContent`,
`DisclosureGroup`, `DisclosureHeader`, `DropZone`, `Field`, `FieldError`,
`FileTrigger`, `Form`, `FormField`, `Frame`, `GridList`, `GridListItem`, `Group`,
`Header`, `Heading`, `Icon`, `IllustratedMessage`, `Image`, `InlineAlert`, `Input`,
`Kbd`, `Label`, `Link`, `List`, `ListBox`, `ListBoxItem`, `MaskedFrame`, `Menu`,
`MenuItem`, `Meter`, `MeterTrack`, `MeterValue`, `Modal`, `Nav`, `NumberField`,
`Pagination`, `Paragraph`, `Popover`, `ProgressBar`, `ProgressBarTrack`,
`ProgressBarValue`, `ProgressCircle`, `Radio`, `RadioGroup`, `RadioItems`,
`RangeCalendar`, `SearchField`, `Section`, `Select`, `SelectIcon`, `SelectTrigger`,
`SelectValue`, `Separator`, `Skeleton`, `Slider`, `SliderOutput`, `SliderThumb`,
`SliderTrack`, `Slot`, `StatusLight`, `Switch`, `Switcher`, `Tab`, `TabList`,
`TabPanel`, `TabPanels`, `Table`, `TableView`, `Tabs`, `Tag`, `TagGroup`, `TagList`,
`TailSwatch`, `Text`, `TextArea`, `TextField`, `TimeField`, `Toast`, `ToggleButton`,
`ToggleButtonGroup`, `Toolbar`, `Tooltip`, `Tree`, `TreeItem`.

## 6. 기존 6개 registry diff

현 상태는 ADR-139 registration contract 로 placeable path 의 누락을 차단하지만,
ADR-142 관점에서는 여전히 다중 정본이다. Phase 2~6 에서 아래 표면을
`componentCatalog` 로 대체한다.

| Registry                             | 파일                                                                                    |                           정적 항목 수 | Phase 0 diff                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------------------- | -------------------------------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component Panel hard-coded list      | `apps/builder/src/builder/panels/components/ComponentList.tsx`                          |                                     61 | UI category hard-code. `Slot` 은 layout mode 에서만 노출.                                                                                                                                                                                                                                                                                                                                                                          |
| Factory creator map                  | `apps/builder/src/builder/factories/ComponentFactory.ts`                                |                                     60 | Panel에는 있으나 factory에는 없는 항목 14개: `Badge`, `Button`, `DropZone`, `FileTrigger`, `Icon`, `Link`, `MaskedFrame`, `Modal`, `Section`, `Separator`, `Skeleton`, `TailSwatch`, `Text`, `ToggleButton`. Factory에는 있으나 Panel에는 없는 항목 13개: `ColorField`, `ColorPicker`, `ColorSwatchPicker`, `DataTable`, `DisclosureGroup`, `List`, `Meter`, `Navigation`, `Pagination`, `Radio`, `Switcher`, `TextArea`, `Toast`. |
| `rendererMap`                        | `packages/shared/src/renderers/index.ts`                                                |                                     95 | Panel 대비 미등록: `MaskedFrame`, `Section`, `Text`, `frame`. `Text` 는 spec fallback 의도, 나머지는 legacy/fallback boundary 로 남음.                                                                                                                                                                                                                                                                                             |
| `getDefaultProps` map                | `apps/builder/src/types/builder/unified.types.ts`                                       |                                     96 | Panel 대비 누락 0. Factory/renderer 와 별도 수동 map 이라 catalog 대체 대상.                                                                                                                                                                                                                                                                                                                                                       |
| `BASE_TAG_SPEC_MAP` / `TAG_SPEC_MAP` | `packages/specs/src/runtime/tagToElement.ts`                                            | 111 manual base + childSpecs expansion | Panel 대비 정적 base 누락: `Image`. 현행 `Image` 는 ADR-139 intended exception / image rendering path.                                                                                                                                                                                                                                                                                                                             |
| Builder `TAG_SPEC_MAP` alias layer   | `apps/builder/src/builder/workspace/canvas/sprites/tagSpecMap.ts`, `builderAliasMap.ts` |           packages/specs map + 9 alias | alias: `ComboBoxInput`, `ComboBoxTrigger`, `ComboBoxWrapper`, `SearchClearButton`, `SearchFieldWrapper`, `SearchIcon`, `SearchInput`, `TabBar`, `body`.                                                                                                                                                                                                                                                                            |

검증: `pnpm test:registration-contract` → 1 파일 / 10 테스트 PASS.

## 7. Phase 1a 진입 전 고정 조건

Phase 1a 는 G2a~G2c kill-switch 이므로, 아래 조건 없이는 진입하지 않는다.

1. Phase 1a 착수 당시 ADR-142 Status 가 `In Progress` 또는 `Accepted` 상태로 유지될 것
   (G7 closure 이후 현재 Status 는 `Implemented`).
2. `packages/react-aria-starter/src/**` 는 계속 read-only reference 로 유지될 것.
3. `design.md` 는 Phase 1~6 입력 reference 이며 runtime D3 SSOT 로 승격하지 않을 것.
4. `ComponentSpec` / `ReactRenderer` / `CSSGenerator` / `render.shapes()` 는
   `packages/shared/src/catalog/**` 의 source 로 쓰지 않을 것.
5. Button proof slice 가 primitive 노드와 최소 reusable-origin/ref-instance 노드를
   모두 포함할 것.
6. G2c 는 Button 만으로 통과 처리하지 않고, 200+ 노드(ref 포함) worst-case
   collection canonical document 를 대표 device profile 로 측정할 것.

## 8. Gate G0/G1 판정

- [x] starter source 보호 유지.
- [x] 신규 active component 를 legacy 6개 registry 에 추가하지 않음.
- [x] starter 55 파일 primitive/composed/helper 분류.
- [x] 124 `ComponentSpec` legacy 처분 명시.
- [x] 6개 registry diff 문서화.
- [x] 비-DOM-trivial / `skiaPrimitive` 후보 명시.
- [x] 단일 `design.md` section set 과 reference-only 경계 확인.

→ ADR-142 Phase 0 은 G0/G1 기준으로 완료. 2026-05-20 Phase 1a proof slice
(G2a/G2b/G2c kill-switch) 와 Phase 1b 공통 기반 완성(G2d)도 완료됐다. Phase 2
catalog/library slice 로 Button active primitive entry, Card/Section reusable
seed 문서, registration contract C/D/E 기반을 추가했다. 이어서 G3 catalog
inventory bridge 로 Button panel item 과 element creation default props 가 catalog
를 우선 소비하도록 연결하고, 기존 Component Panel 7개 카테고리 목록을 shared
`panelInventory.ts` 로 이동했다. reusable catalog entry 는 active flip 시
canonical `ref` insertion payload 로 해석된다. 다음 진입점은 Phase 3 shared
primitive wrapper surface + legacy boundary 다. 2026-05-20 Phase 3 첫 slice 로
Button shared wrapper 가 catalog `toButtonRacProps()` 를 소비하도록 전환됐고,
`packages/shared/src/components/legacy/README.md` 가 active Builder authoring /
Panel / Factory / Preview / Publish runtime 에서 legacy import 금지 경계를
문서화했다. 이 slice 는 Button proof family 의 boundary 이며 전체 primitive
wrapper family 완료 판정은 아니다. 이어서 Separator primitive pilot 으로
`toSeparatorRacProps()` / `separatorPrimitiveBinding` / active catalog entry /
Preview primitive branch / generic Skia `line` 렌더 fixture 를 추가했다. 이 역시
`primitives/actions` family 의 일부 pilot 이며 family 전체 cutover 완료 판정은
아니다. Link primitive pilot 도 같은 방식으로 `toLinkRacProps()` /
`linkPrimitiveBinding` / active catalog entry / Preview primitive branch / generic
Skia underline text fixture 를 추가했다. ToggleButton primitive pilot 도
`toToggleButtonRacProps()` / `toggleButtonPrimitiveBinding` / active catalog entry /
Preview primitive branch / generic Skia selected/emphasized button-like fixture 로
확장했다. Button Icon inspector parity 는 구 `ButtonSpec.properties` 로 되돌리지
않고 `buttonPrimitiveBinding.props.accepts` 의 `Icon` section 과 `toButtonRacProps()`
projection 으로 보강했으며, generic Skia Button path 는 `iconName` 을 `icon_path`
child 로 렌더한다. TextField primitive pilot 은 `fields` family 의 첫 active
slice 로 `toTextFieldRacProps()` / `textFieldPrimitiveBinding` / active catalog
entry / Preview primitive branch / generic Skia label-input-value fixture 를 추가했다.
이 과정에서 TextField 의 `type` prop 이 component tag 로 오인되지 않도록
`CanonicalNodeRenderer` 는 `node.type` 을 component type SSOT 로 우선한다.
NumberField primitive pilot 은 `fields` family 의 두 번째 active slice 로
`toNumberFieldRacProps()` / `numberFieldPrimitiveBinding` / active catalog entry /
Preview primitive branch / generic Skia label-input-value fixture 를 추가했다.
NumberField 역시 `NumberFieldSpec.render.shapes()` 를 호출하지 않는 generic Skia
fixture 로 고정했으며, fields family 전체 완료 판정은 아니다.
SearchField primitive pilot 은 `fields` family 의 세 번째 active slice 로
`toSearchFieldRacProps()` / `searchFieldPrimitiveBinding` / active catalog entry /
Preview primitive branch / generic Skia label-input-value+search-icon fixture 를
추가했다. SearchField 역시 `SearchFieldSpec.render.shapes()` 를 호출하지 않는
generic Skia fixture 로 고정했으며, fields family 전체 완료 판정은 아니다.
DateField primitive pilot 은 `fields` family 의 네 번째 active slice 로
`toDateFieldRacProps()` / `dateFieldPrimitiveBinding` / active catalog entry /
Preview primitive branch / generic Skia label-input-value fixture 를 추가했다.
DateField 역시 `DateFieldSpec.render.shapes()` 를 호출하지 않는 generic Skia
fixture 로 고정했으며, fields family 전체 완료 판정은 아니다.
TimeField primitive pilot 은 `fields` family 의 다섯 번째 active slice 로
`toTimeFieldRacProps()` / `timeFieldPrimitiveBinding` / active catalog entry /
Preview primitive branch / generic Skia label-input-value fixture 를 추가했다.
TimeField 역시 `TimeFieldSpec.render.shapes()` 를 호출하지 않는 generic Skia
fixture 로 고정했으며, fields family 전체 완료 판정은 아니다.
ColorField primitive pilot 은 `fields` family 의 여섯 번째 active slice 로
`toColorFieldRacProps()` / `colorFieldPrimitiveBinding` / active catalog entry /
Preview primitive branch / generic Skia label-input-value+swatch fixture 를
추가했다. ColorField 역시 `ColorFieldSpec.render.shapes()` 를 호출하지 않는
generic Skia fixture 로 고정했으며, fields family 전체 완료 판정은 아니다.
Form primitive pilot 은 `fields` family 의 일곱 번째 active slice 로
`toFormRacProps()` / `formPrimitiveBinding` / active catalog entry / Form placement
TextField/TextField/Button child template / Preview primitive branch / generic Skia
container+children fixture 를 추가했다. Form 은 dedicated `skiaPrimitive` 없이
generic container 재귀 경로로 고정했고 `FormSpec.render.shapes()` 를 호출하지
않는다. fields family 전체 완료 판정은 아니다.
FileTrigger primitive pilot 은 `fields` family 의 여덟 번째 active slice 로
`toFileTriggerRacProps()` / `fileTriggerPrimitiveBinding` / active catalog entry /
FileTrigger placement Button child template / Preview primitive branch / generic Skia
container+trigger-child fixture 를 추가했다. FileTrigger 는 dedicated
`skiaPrimitive` 없이 generic container 재귀 경로로 고정했고
`FileTriggerSpec.render.shapes()` 를 호출하지 않는다. `Field` 는 독립 RAC leaf
primitive 가 아니라 Label/Text/Input/FieldError helper 및 DataField surface 이므로
active primitive 승격 대상에서 제외했다.

Inspector active path 보정: `getEditor()` 는 catalog primitive 에 대해 legacy
`specRegistry` 를 조회하기 전에 `getPrimitiveBinding()` 으로 `GenericPropertyEditor`
에 `componentType` 을 넘긴다. 따라서 Button/Separator/Link/Breadcrumbs/
ToggleButton/ToggleButtonGroup/Toolbar 및 TextField/NumberField/SearchField/
DateField/TimeField/ColorField/Form/FileTrigger 의 Properties Panel source 는
`PrimitiveBinding.props.accepts` 기반 `PropContract` section 이며, legacy
`ComponentSpec.properties.sections` / `SpecField` 는 catalog binding 이 없는 component
fallback 으로만 남는다.

Switch primitive pilot 은 `selection` family 의 첫 active slice 로
`toSwitchRacProps()` / `switchPrimitiveBinding` / active catalog entry / shared
wrapper projection / Preview primitive branch / generic Skia track-thumb-label fixture 를
추가했다. Switch 는 `SwitchSpec.render.shapes()` 를 호출하지 않는 generic Skia
fixture 로 고정했으며, 이후 Checkbox slice 로 확장했다.

Checkbox primitive pilot 은 Switch 다음 selection slice 로
`toCheckboxRacProps()` / `checkboxPrimitiveBinding` / active catalog entry / shared
wrapper projection / Preview primitive branch / generic Skia box-indicator-label fixture 를
추가했다. Checkbox 는 `CheckboxSpec.render.shapes()` 를 호출하지 않는 generic Skia
fixture 로 고정했으며, TreeItem 내부 slot 예외는 shared wrapper 에 유지한다.
이후 Slider slice 로 확장했다.

Slider primitive pilot 은 Checkbox 다음 selection slice 로
`toSliderRacProps()` / `sliderPrimitiveBinding` / active catalog entry / shared wrapper
projection / Preview primitive branch / generic Skia label-output-track-fill-thumb fixture 를
추가했다. Slider 는 `SliderSpec.render.shapes()` 를 호출하지 않는 generic Skia fixture 로
고정했다. 이후 CheckboxGroup slice 로 확장했다.

CheckboxGroup primitive pilot 은 Slider 다음 selection slice 로
`toCheckboxGroupRacProps()` / `checkboxGroupPrimitiveBinding` / active catalog entry /
shared wrapper / Preview primitive branch / generic Skia label+children fixture 를
추가했다. CheckboxGroup 은 `CheckboxGroupSpec.render.shapes()` 와 child
`CheckboxSpec.render.shapes()` 를 호출하지 않는 generic Skia fixture 로 고정했다.

Radio/RadioGroup primitive pilot 은 selection family 마무리 slice 로
`toRadioRacProps()` / `toRadioGroupRacProps()` / `radioPrimitiveBinding` /
`radioGroupPrimitiveBinding` / active catalog entry / shared wrapper / Preview
RadioGroup primitive branch / generic Skia ring-dot-label 및 group label+children
fixture 를 추가했다. Radio 는 React Aria `RadioGroup` context 가 필요한 subpart 이므로
non-placeable active primitive 로 등록하고 standalone Preview 는 legacy fallback 을 유지한다.
Radio/RadioGroup 은 `RadioSpec.render.shapes()` / `RadioGroupSpec.render.shapes()` 를
호출하지 않는 generic Skia fixture 로 고정했다. selection family pilot 은 완료됐고
다음 잔여 family 는 collections 다.

ListBox collections primitive pilot 은 collections family 착수 slice 로
`toListBoxRacProps()` / `listBoxPrimitiveBinding` / active catalog entry / shared
`ListBox.tsx` projection / Preview ListBox primitive branch / generic Skia
container+item row fixture 를 추가했다. ListBox 는 canonical `items[]` 를 RAC ListBox
item surface 로 투영하며 `ListBoxSpec.render.shapes()` 를 호출하지 않는 generic Skia
fixture 로 고정했다. GridList collections primitive pilot 은 `toGridListRacProps()` /
`gridListPrimitiveBinding` / active catalog entry / shared `GridList.tsx` projection /
Preview GridList primitive branch / generic Skia card label+description fixture 를
추가했다. GridList 는 canonical `items[]` 를 RAC GridList card surface 로 투영하며
`GridListSpec.render.shapes()` 를 호출하지 않는 generic Skia fixture 로 고정했다.
TagGroup collections primitive pilot 은 `toTagGroupRacProps()` /
`tagGroupPrimitiveBinding` / active catalog entry / shared `TagGroup.tsx` projection /
Preview TagGroup primitive branch / generic Skia label+chip fixture 를 추가했다.
TagGroup 은 canonical `items[]` 를 RAC TagGroup chip surface 로 투영하며
`TagGroupSpec.render.shapes()` 를 호출하지 않는 generic Skia fixture 로 고정했다.
Menu collections primitive pilot 은 `toMenuRacProps()` / `menuPrimitiveBinding` /
active catalog entry / shared `Menu.tsx` projection / Preview Menu primitive branch /
generic Skia trigger+item row fixture 를 추가했다. Menu 는 canonical `items[]` 를 RAC
Menu item surface 로 투영하며 `MenuSpec.render.shapes()` 를 호출하지 않는 generic Skia
fixture 로 고정했다. Panel category 는 기존 사용자 위치를 보존하기 위해 `buttons` 로
유지한다.
ComboBox collections primitive pilot 은 `toComboBoxRacProps()` /
`comboBoxPrimitiveBinding` / active catalog entry / shared `ComboBox.tsx` projection /
Preview ComboBox primitive branch / generic Skia label+input+item row fixture 를
추가했다. ComboBox 는 canonical `items[]` 를 RAC ComboBox item surface 로 투영하며
`ComboBoxSpec.render.shapes()` 를 호출하지 않는 generic Skia fixture 로 고정했다.
Panel category 는 기존 사용자 위치를 보존하기 위해 `forms` 로 유지한다.
Select collections primitive pilot 은 `toSelectRacProps()` / `selectPrimitiveBinding` /
active catalog entry / shared `Select.tsx` projection / Preview Select primitive branch /
generic Skia label+trigger+item row fixture 를 추가했다. Select 는 canonical `items[]` 를
RAC Select item surface 로 투영하며 `SelectSpec.render.shapes()` 를 호출하지 않는
generic Skia fixture 로 고정했다. Panel category 는 기존 사용자 위치를 보존하기 위해
`forms` 로 유지한다.
Tabs collections primitive pilot 은 `toTabsRacProps()` / `tabsPrimitiveBinding` /
active catalog entry / shared `Tabs.tsx` projection / Preview Tabs primitive branch /
generic Skia tab-list+panel fixture 를 추가했다. Tabs 는 canonical `items[]` 를 RAC
Tabs item/panel surface 로 투영하며 `TabsSpec.render.shapes()` 를 호출하지 않는
generic Skia fixture 로 고정했다. collections row 의 primitive pilot 은 완료됐지만
ADR-132 collection 데이터 binding 전체 전환은 아직 닫지 않는다.
Tree·Table primitive pilot 은 `toTreeRacProps()` / `toTableRacProps()` /
`treePrimitiveBinding` / `tablePrimitiveBinding` / `tableViewPrimitiveBinding` /
active catalog entry / shared `Tree.tsx`·`Table.tsx` projection / Preview Tree·Table
primitive branch / generic Skia row-disclosure 및 header-row-cell fixture 를 추가했다.
Tree/Table/TableView 는 `TreeSpec.render.shapes()` / `TableSpec.render.shapes()` /
`TableViewSpec.render.shapes()` 를 호출하지 않는 generic Skia fixture 로 고정했다.
TableView 는 별도 RAC primitive 가 없으므로 canonical tag 는 `TableView` 로 유지하고
runtime exportName 은 `Table` binding 을 사용한다. ADR-132 collection 데이터 binding
전체 전환은 여전히 잔여다.
DropZone overlays primitive pilot 은 `toDropZoneRacProps()` /
`dropZonePrimitiveBinding` / active catalog entry / shared `DropZone.tsx` projection /
Preview DropZone primitive branch / generic Skia dashed container+upload icon+label/description
fixture 를 추가했다. DropZone 은 `DropZoneSpec.render.shapes()` 를 호출하지 않는
generic Skia fixture 로 고정했다. 기존 사용자 패널 위치는 `forms` category 로 보존한다.
Tooltip overlays primitive pilot 은 `toTooltipRacProps()` /
`tooltipPrimitiveBinding` / active catalog entry / shared `Tooltip.tsx` projection /
Preview Tooltip primitive branch / generic Skia bubble+text+arrow fixture 를 추가했다.
Tooltip 은 `TooltipSpec.render.shapes()` 를 호출하지 않는 generic Skia fixture 로
고정했다. shared Tooltip wrapper 는 기존 TooltipTrigger context 를 보존하면서
catalog/Preview 단독 surface 에서는 controlled TooltipTrigger anchor 로 DOM tooltip 을
생성한다.
Dialog overlays primitive pilot 은 `toDialogRacProps()` / `dialogPrimitiveBinding` /
active catalog entry / shared `Dialog.tsx` projection / Preview Dialog primitive branch /
generic Skia panel+text fixture 를 추가했다. Dialog 는 `DialogSpec.render.shapes()` 를
호출하지 않는 generic Skia fixture 로 고정했다.
Popover overlays primitive pilot 은 `toPopoverRacProps()` / `popoverPrimitiveBinding` /
active catalog entry / shared `Popover.tsx` projection / Preview Popover primitive
branch / generic Skia panel+text+arrow fixture 를 추가했다. Popover 는
`PopoverSpec.render.shapes()` 를 호출하지 않는 generic Skia fixture 로 고정했다.
shared Popover wrapper 는 기존 DialogTrigger context 를 보존하면서 catalog/Preview
단독 surface 에서는 controlled DialogTrigger anchor 로 DOM popover 를 생성한다.
Modal overlays primitive pilot 은 `toModalRacProps()` / `modalPrimitiveBinding` /
active catalog entry / shared `Modal.tsx` projection / Preview Modal primitive branch /
generic Skia panel+text fixture 를 추가했다. Modal 은 `ModalSpec.render.shapes()` 를
호출하지 않는 generic Skia fixture 로 고정했다. shared Modal wrapper 는 기존
DialogTrigger context 를 보존하면서 catalog/Preview 단독 surface 에서는 controlled
DialogTrigger anchor 로 DOM modal 을 생성한다.
Toast overlays primitive pilot 은 `toToastRacProps()` / `toastPrimitiveBinding` /
active catalog entry / shared `Toast.tsx` RAC `UNSTABLE_ToastQueue` projection /
Preview Toast primitive branch / generic Skia icon+title+description fixture 를
추가했다. Toast 는 `ToastSpec.render.shapes()` 를 호출하지 않는 generic Skia
fixture 로 고정했다. shared Toast wrapper 는 기존 `ToastProvider`/`useToast` API 를
보존하면서 내부 표시 surface 를 RAC ToastRegion/Toast 로 전환하고, catalog/Preview
단독 surface 에서는 standalone queue 로 DOM toast 를 생성한다. overlays family pilot
은 DropZone/Tooltip/Dialog/Popover/Modal/Toast 까지 완료했으며, 다음 family
entrypoint 는 date/color 다.
ColorSwatch date/color primitive pilot 은 `toColorSwatchRacProps()` /
`colorSwatchPrimitiveBinding` / active catalog entry / shared `ColorSwatch.tsx`
projection / Preview ColorSwatch primitive branch / generic Skia color fill fixture 를
추가했다. ColorSwatch 는 `ColorSwatchSpec.render.shapes()` 를 호출하지 않는 generic
Skia fixture 로 고정했다. ColorSlider date/color primitive pilot 은
`toColorSliderRacProps()` / `colorSliderPrimitiveBinding` / active catalog entry /
shared `ColorSlider.tsx` projection / Preview ColorSlider primitive branch /
generic Skia track-thumb fixture 를 추가했다. ColorSlider 는
`ColorSliderSpec.render.shapes()` 를 호출하지 않는 generic Skia fixture 로 고정했다.
ColorArea date/color primitive pilot 은 `toColorAreaRacProps()` /
`colorAreaPrimitiveBinding` / active catalog entry / shared `ColorArea.tsx`
projection / Preview ColorArea primitive branch / generic Skia plane-thumb fixture 를
추가했다. ColorArea 는 `ColorAreaSpec.render.shapes()` 를 호출하지 않는 generic Skia
fixture 로 고정했다. ColorWheel date/color primitive pilot 은
`toColorWheelRacProps()` / `colorWheelPrimitiveBinding` / active catalog entry /
shared `ColorWheel.tsx` projection / Preview ColorWheel primitive branch /
generic Skia arc-thumb fixture 를 추가했다. ColorWheel 은
`ColorWheelSpec.render.shapes()` 를 호출하지 않는 generic Skia fixture 로 고정했다.
ColorPicker date/color primitive pilot 은 `toColorPickerRacProps()` /
`colorPickerPrimitiveBinding` / active catalog entry / ColorArea+ColorSlider+
ColorField placement / shared `ColorPicker.tsx` projection / Preview ColorPicker
primitive branch / generic Skia resolved-children fixture 를 추가했다. ColorPicker 는
`ColorPickerSpec.render.shapes()` 를 호출하지 않는 generic Skia fixture 로 고정했다.
Calendar date/color primitive pilot 은 `toCalendarRacProps()` /
`calendarPrimitiveBinding` / active catalog entry / shared `Calendar.tsx`
projection / Preview Calendar primitive branch / generic Skia month grid fixture 를
추가했다. Calendar 는 `CalendarSpec.render.shapes()` 를 호출하지 않는 generic Skia
fixture 로 고정했다. RangeCalendar date/color primitive pilot 은
`toRangeCalendarRacProps()` / `rangeCalendarPrimitiveBinding` / active catalog entry /
shared `RangeCalendar.tsx` projection / Preview RangeCalendar primitive branch /
generic Skia range-band fixture 를 추가했다. RangeCalendar 는
`RangeCalendarSpec.render.shapes()` 를 호출하지 않는 generic Skia fixture 로
고정했다. DatePicker date/color primitive pilot 은 `toDatePickerRacProps()` /
`datePickerPrimitiveBinding` / active catalog entry / shared `DatePicker.tsx`
projection / Preview DatePicker primitive branch / generic Skia label-input-icon
fixture 를 추가했다. DatePicker 는 `DatePickerSpec.render.shapes()` 를 호출하지
않는 generic Skia fixture 로 고정했다. DateRangePicker date/color primitive pilot 은 `toDateRangePickerRacProps()` /
`dateRangePickerPrimitiveBinding` / active catalog entry / shared
`DateRangePicker.tsx` projection / Preview DateRangePicker primitive branch /
generic Skia label-input-icon fixture 를 추가했다. DateRangePicker 는
`DateRangePickerSpec.render.shapes()` 를 호출하지 않는 generic Skia fixture 로
고정했다. date/color family 는
ColorSwatch/ColorSlider/ColorArea/ColorWheel/ColorPicker/Calendar/RangeCalendar/
DatePicker/DateRangePicker 까지 진행했다.

Composition-native cutover 는 2026-05-21 기준 Card/Section reusable entry 를
`cutover:"catalog"` 로 flip 하고 `frame`/`Slot` native catalog entry 를 추가했다.
Card/Section 은 reusable canonical document seed 를 `type:"ref"` creation payload 로
소비하고, `frame`/`Slot` 은 RAC primitive 없이 native catalog default props 와
`propsSchema` 로 배치·편집한다. `Slot` 은 layout mode 전용 `layoutOnly` panel entry
이며 일반 component palette 에는 노출하지 않는다. `kind:"binding"` PropContract 는
Inspector 에서 `PropertyDataBinding` 을 통해 `x-composition.dataBinding` 으로 저장되고,
legacy static collection binding 은 resolved render props 에서 Tree `items` 또는
Table `rows` 로 materialize 되어 Preview/Skia fixture 로 고정됐다.

G7 closure 기준(2026-05-21): 모든 `componentCatalog` entry 는 `cutover:"catalog"` 이며
`legacy` / `cutting-over` entry 는 0건이다. ADR-142 는 Implemented 로 승격했고,
ADR-036/907/908/140/141 의 Spec D3 / `render.shapes()` 기반 메커니즘은 active
component path 가 아니라 legacy compatibility boundary 로 재평가됐다.
