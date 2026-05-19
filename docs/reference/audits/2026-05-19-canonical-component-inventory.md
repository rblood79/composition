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
| `Calendar`          | primitive    | date-color         | `Calendar.css`                    | `CalendarCell`/`CalendarGrid` subpart 포함       |
| `Checkbox`          | primitive    | selection          | `Checkbox.css`                    | indicator draw 검증 필요                         |
| `CheckboxGroup`     | primitive    | selection          | `CheckboxGroup.css`               | group + checkbox children                        |
| `ColorArea`         | primitive    | date-color         | `ColorArea.css`                   | `skiaPrimitive` 후보                             |
| `ColorField`        | primitive    | fields             | `ColorField.css`                  | field family                                     |
| `ColorPicker`       | primitive    | date-color         | `ColorPicker.css`                 | picker shell + color controls                    |
| `ColorSlider`       | primitive    | date-color         | `ColorSlider.css`                 | `skiaPrimitive` 후보                             |
| `ColorSwatch`       | primitive    | date-color         | `ColorSwatch.css`                 | color fill draw 검증 필요                        |
| `ColorSwatchPicker` | primitive    | date-color         | `ColorSwatchPicker.css`           | collection-like picker                           |
| `ColorThumb`        | primitive    | date-color         | `ColorThumb.css`                  | `skiaPrimitive` 후보                             |
| `ColorWheel`        | primitive    | date-color         | `ColorWheel.css`                  | `skiaPrimitive` 후보                             |
| `ComboBox`          | primitive    | collections        | `ComboBox.css`                    | ListBox 재사용 경계 검증                         |
| `CommandPalette`    | composed     | overlays           | `CommandPalette.css`              | Autocomplete + Menu + Dialog 조합                |
| `Content`           | helper       | primitives/actions | `Content.css`                     | Heading/Text wrapper surface                     |
| `DateField`         | primitive    | fields             | `DateField.css`                   | DateInput/DateSegment subpart 포함               |
| `DatePicker`        | primitive    | date-color         | `DatePicker.css`                  | popover/calendar composition 포함                |
| `DateRangePicker`   | primitive    | date-color         | `DateRangePicker.css`             | range calendar composition 포함                  |
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
| `RangeCalendar`     | primitive    | date-color         | `RangeCalendar.css`               | range cell draw 검증 필요                        |
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
| `ListBox`, `GridList`, `Menu`, `TagGroup`, `Tabs`                                          | collection item state, keyboard/selection state visualization                                  |
| `Tree`, `Table`                                                                            | collections 데이터 + row/cell/tree disclosure state. 수동 우회 구현으로 full support 주장 금지 |

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

1. ADR-142 Status 가 `In Progress` 또는 `Accepted` 상태로 유지될 것.
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
seed 문서, registration contract C/D/E 기반을 추가했다. 다음 진입점은 G3 의
Panel/Factory catalog-only 배선이다.
