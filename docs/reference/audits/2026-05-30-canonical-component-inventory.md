# Canonical 컴포넌트 시스템 Inventory — ADR-142 Phase 0

**작성일**: 2026-05-30
**ADR**: [ADR-142](../../adr/142-starter-spec-component-system-cutover.md) Phase 0 (Gate G0/G1) 산출물
**리뷰 연계**: [docs/adr/reviews/142.md](../../adr/reviews/142.md) Round 2 MEDIUM #2(R4 scope)/#3(R2 size)/LOW(R9) 실측 확정
**방법**: starter `import` 구조 grep + spec `render.shapes` 패턴 grep + registry 카운트 (read-only, 2026-05-30 HEAD)

> 본 inventory 는 ADR-142 의 추정치 3개(① ~35 primitive ② R4 Skia scope "arc/track/indicator" ③ R9 PropContract 매핑)를 **실측으로 교정**한다. CLAUDE.md "추정 vs 실측 gap 은 Phase 0 inventory 로 흡수" 원칙 적용 — 본 데이터가 ADR/breakdown 보강의 근거.

---

## 1. 요약 — ADR 추정 vs 실측

| 항목                              | ADR 추정                      | 실측                                                                                      | 차이                                                            |
| --------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| leaf RAC primitive (binding 코드) | **~35**                       | starter RAC-controller-backed **49** + composed 6 = 55                                    | binding 이 ~35 보다 **많음** (folding 후 ~40-45)                |
| R4 Skia "비-DOM-trivial" scope    | "arc/track/indicator" 소수    | text 그리기 **64** + 특수 shape **38** + ADR-907 spacing **4** + ADR-908 fill **30** spec | generic Skia 가 render.shapes **대부분** 재현 — R4 MED **과소** |
| R9 매핑 난항 FieldDef             | CustomField + derivedUpdateFn | CustomField **0개(dead)** / derivedUpdateFn **19개** / ChildrenManagerField **5개**       | R9 **miscalibrated** (dead 명시 + 실제 위험 누락)               |
| 124 ComponentSpec 처분            | 전수 legacy                   | 124 = primitive-mapped ~49 + sub-part ~40 + composed/native ~15                           | (분해 §3)                                                       |

**핵심 결론**: ADR-142 의 결정(대안 E)은 건전하나, **공통 기반(M1/G2)의 Skia 재작성 규모가 추정보다 훨씬 큼** — 124 spec render.shapes 의 text 측정/spacing/fill/arc 로직 대부분을 generic Skia backend + skiaPrimitive 로 재현해야 한다. R2(composite 재저작)보다 **R4(Skia generic 재구현)가 더 큰 리스크**임이 실측으로 드러남.

---

## 2. starter 55 → primitive / composed 분류

분류 기준: 파일이 **자기 이름의 RAC controller** (`react-aria-components/<Name>`)를 import 하면 **primitive**, 없이 다른 primitive 들을 조립하면 **composed/reusable**.

### 2-1. Primitive (RAC controller backed) — 49

`Breadcrumbs, Button, Calendar, Checkbox, CheckboxGroup, ColorArea, ColorField, ColorPicker, ColorSlider, ColorSwatch, ColorSwatchPicker, ColorThumb, ColorWheel, ComboBox, DateField, DatePicker, DateRangePicker, Dialog, Disclosure, DisclosureGroup, DropZone, Form, GridList, Link, ListBox, Menu, Meter, Modal, NumberField, Popover, ProgressBar, RadioGroup, RangeCalendar, SearchField, Select, Separator, Slider, Switch, Table, Tabs, TagGroup, TextField, TimeField, Toast, ToggleButton, ToggleButtonGroup, Toolbar, Tooltip, Tree`

### 2-2. Composed / variant (RAC controller 없음 — 조립/변형) — 6

| starter          | 구성                         | 처분                                             |
| ---------------- | ---------------------------- | ------------------------------------------------ |
| CommandPalette   | Autocomplete + Dialog + Menu | reusable 문서                                    |
| Content          | Heading + Text               | reusable (layout helper)                         |
| InputGroup       | Group + Input                | reusable 문서                                    |
| SegmentedControl | ToggleButtonGroup 변형       | theme variant (data-\*) 또는 reusable            |
| Sheet            | Modal 변형                   | theme variant 또는 reusable                      |
| ProgressCircle   | ProgressBar 변형 (circle)    | ProgressBar binding + skiaPrimitive(arc) variant |

### 2-3. "~35 binding" 교정

starter 기준 RAC-backed 가 **49**. ADR HC#3/Decision#3 의 "~35" 는 다음 folding 을 전제해야 도달:

- variant folding: Sheet→Modal / SegmentedControl→ToggleButtonGroup / ProgressCircle→ProgressBar (−3)
- sub-part folding: ColorThumb 는 ColorArea/Wheel/Slider 의 part (−1)
- group pair folding: Checkbox+CheckboxGroup, Radio+RadioGroup, ToggleButton+ToggleButtonGroup 등을 family binding 으로 (−몇)

folding 후에도 **~40-45 binding** 으로, "~35" 는 ~5-10 LOW. → ADR 본문 "~35" 를 "~40-49 (folding 정책에 따라)" 로 보정 권장.

---

## 3. 124 ComponentSpec 분해 + 처분 (전수 legacy)

124 spec = primitive-mapped + sub-part(부모 binding 의 parts/slots 로 흡수) + composed/native.

| 분류                          | 예시                                                                                                                                                                                                                                                                                                              | 처분                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **primitive-mapped** (~49)    | Button, TextField, ListBox, Select, Tree, Table, Calendar, ColorWheel ... (§2-1)                                                                                                                                                                                                                                  | RAC `PrimitiveBinding`                                                     |
| **sub-part** (~40)            | CalendarGrid/CalendarHeader, CardContent/Footer/Header/Preview, DateInput/DateSegment, MeterTrack/MeterValue, ProgressBarTrack/Value, SliderThumb/Track/Output, TabList/Panel/Panels/Tab, MenuItem, ListBoxItem, GridListItem, TreeItem, SelectIcon/Trigger/Value, TagList/Tag, FieldError, FormField, Breadcrumb | 부모 binding 의 `parts`/`slots` 로 흡수 (독립 정의 없음)                   |
| **composed / reusable** (~15) | Card, CardView, Section, IllustratedMessage, InlineAlert, StatusLight, Badge, Kbd, Skeleton, Pagination, Avatar(Group), Accordion, List                                                                                                                                                                           | canonical reusable frame 문서 (R2 재저작 대상)                             |
| **composition-native**        | Frame, Slot, Body, Nav, Header, Group, MaskedFrame, Switcher, TailSwatch, Code, Paragraph, Text, Heading, Description, Label, Icon, Image, TextArea, Input                                                                                                                                                        | catalog 등록 (Frame/Slot binding 없음) / 일부는 primitive(Text/Input/Icon) |

전부 새 시스템이 import/파생하지 않는 **legacy**. legacy 문서 호환 + migration reference 로만 유지 (ADR HC#2).

**R2 재저작 규모 (실측 기반)**: composed/reusable ~15개가 수작업 재저작 대상 (HC#6 자동변환 금지). ADR 추정 "~89 composite" 보다 작음 — 대부분(~40)은 sub-part 라 binding parts 로 흡수되지 별도 재저작 아님. → **R2 는 추정보다 작고, R4 가 진짜 병목.**

---

## 4. R4 실측 — Skia generic backend scope (MEDIUM #2 확정)

generic Skia backend + `skiaPrimitive` 가 재현해야 하는 render.shapes 로직 (중복 집합):

| 로직                                                                                     | spec 수 | 비고                                                                                                                  |
| ---------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------- |
| **text 그리기** (CanvasKit 측정 의존: heightMultiplier/halfLeading/strut/getLongestLine) | **64**  | canvas-rendering.md §3 — generic 렌더러가 측정 파이프라인 전체 재현 필요                                              |
| 특수 shape (arc/icon_font/gradient/track/indicator)                                      | **38**  | Button, Calendar\*, Color\*, Meter\*, Progress\*, Slider\*, Switch, Tab\*, Toggle\*, Tree\*, ListBoxItem, Tooltip ... |
| ADR-907 container spacing resolver                                                       | 4       | GridList, ListBox, Menu, Toolbar — `resolveContainerSpacing`/`resolve*SpacingMetric` re-home                          |
| ADR-908 fill token resolver                                                              | 30      | `resolveFillTokens`/`resolveIndicatorFill` re-home                                                                    |

→ "비-DOM-trivial = arc/track/indicator 소수" 는 **틀림**. 124 중 절대 다수가 비-trivial. R8(ADR-907/908 "status 재평가")는 부정확 — **그 resolver 로직이 generic Skia backend 에 재구현**돼야 함. R4 를 MED→HIGH 로 격상하거나 별도 Risk 분리 권장. **이것이 G2 의 실제 무게.**

---

## 5. 6 registry diff (단일 catalog 대체 대상)

| registry                   | 위치                                         | 카운트            |
| -------------------------- | -------------------------------------------- | ----------------- |
| Component Panel hard-coded | `ComponentList.tsx`                          | ~66               |
| Factory creators           | `ComponentFactory.ts`                        | (placeable)       |
| rendererMap                | `packages/shared/src/renderers/index.ts`     | 95                |
| getDefaultProps            | `apps/builder/src/types/core/store.types.ts` | (map)             |
| BASE_TAG_SPEC_MAP          | `packages/specs/src/index.ts`                | 124 (+childSpecs) |
| builder TAG_SPEC_MAP       | `tagSpecMap.ts`                              | 124 + 8 alias     |

카운트 불일치(Panel 66 / rendererMap 95 / TAG_SPEC_MAP 124) 자체가 drift 증거. **ADR-139 `componentRegistrationContract.test.ts` 불변식 A/B + baseline/exception JSON 이 이미 diff 를 추적** — ADR-142 는 불변식 C/D/E 추가로 catalog cross-check 확장 (breakdown Phase 4). 단일 `componentCatalog` 가 6개 전부 대체.

---

## 6. R9 실측 — FieldDef 11 → PropContract 매핑 (LOW, recalibration)

| FieldDef (11, `spec.types.ts:448-458`) | PropContract.kind (9) | 사용 spec    | 비고                                                          |
| -------------------------------------- | --------------------- | ------------ | ------------------------------------------------------------- |
| VariantField                           | variant               | —            | theme data-\* 값                                              |
| SizeField                              | size                  | —            | theme data-\* 값                                              |
| BooleanField                           | boolean               | —            |                                                               |
| EnumField                              | enum                  | —            |                                                               |
| StringField                            | string                | —            |                                                               |
| StringArrayField                       | string-array          | —            |                                                               |
| NumberField                            | number                | —            |                                                               |
| IconField                              | icon                  | —            |                                                               |
| ItemsManagerField                      | binding               | —            | collections(ADR-132)                                          |
| **ChildrenManagerField**               | **(매핑 없음)**       | **5**        | canonical children 트리로 흡수 추정 — ADR/breakdown 미명시    |
| **CustomField**                        | (매핑 없음)           | **0 (dead)** | 현재 어떤 spec 도 미사용 — R9 가 명시한 항목이 실제 무용      |
| (横단) **derivedUpdateFn**             | —                     | **19**       | 한 prop→복수 prop 갱신. R9 부차 명시했으나 **실제 최대 사용** |

→ R9 recalibration: **CustomField(0) 는 dead 명시, ChildrenManagerField(5) 추가, derivedUpdateFn(19)을 주 위험으로 격상.** generic Inspector 가 derivedUpdateFn 19개를 어떻게 흡수할지가 R9 의 실제 과제.

---

## 7. 결론 — ADR-142 보강 권장 (실측 근거)

1. **HC#3/Decision#3 "~35 binding" → "~40-49"** (folding 정책 명시). (§2-3)
2. **R4 MED → HIGH 또는 별도 Risk 분리**, R8 을 "ADR-907/908 status 재평가" → "**resolver 로직 generic Skia re-home**" 으로 정정. G2 의 실제 무게는 Skia 재작성. (§4)
3. **R2 추정 "~89 composite" → "~15 reusable 재저작"** (~40 은 sub-part 흡수). R2 MED 유지 가능, 단 R4 가 진짜 병목. (§3)
4. **R9 recalibration**: CustomField dead / ChildrenManagerField(5) 추가 / derivedUpdateFn(19) 주 위험. (§6)
5. G2 분해 권장 (review #1): DOM-first(resolver/CanonicalNodeRenderer 기존) → Skia-재작성(64 text + 38 shape + 34 spacing/fill re-home, 최대 위험) 분리. §4 데이터가 분해 정당성 제공.

> 다음: 본 inventory 를 근거로 ADR-142 본문/breakdown 보강 (review-adr Round 2 MEDIUM 반영) — 사용자 결정 영역.
