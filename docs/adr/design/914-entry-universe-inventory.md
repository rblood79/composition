# ADR-914 Phase 0 — Entry Universe Inventory Freeze

> 본문: [914-component-entry-universe-collapse.md](../completed/914-component-entry-universe-collapse.md)
> breakdown: [914-component-entry-universe-collapse-breakdown.md](914-component-entry-universe-collapse-breakdown.md) §2, §4 Phase 0
> 실측 기준일: **2026-06-20** (grep + 정의 블록 직접 Read 전수 재실측)

## G0 게이트 충족 선언

본 문서는 ADR-914 deletion phase 진입 전 9개 손등록 표면 + ADR-139 baseline/exception을
count와 owner classification으로 freeze한다. **ADR-912 카운트는 source가 아니다** — 같은
문서 안에서 factory 수치가 자기모순(`912.md:76`=60 / `912.md:59`=55 / `912.md:209`=45)이며,
`912.md:59`의 "creators = `COMPLEX_COMPONENT_TAGS`" 등치 자체가 set-math상 틀렸다
(실측 creators 55 ⊋ COMPLEX 48, 차 7). 따라서 모든 표면을 현재 코드에서 전수 재실측했고,
ADR-912 수치는 history 참고로만 인용한다.

### 재실측 방법론 (awk/naive grep 카운트 불신)

awk 범위 추출과 naive grep은 코드 본문 문자열 / 주석 / multi-line 호출 오염으로 부정확하다
(본 Phase에서 실제로 입증됨). 그래서 각 표면을 **정의 블록 직접 Read + 멤버 한 줄씩 수동
카운트**로 확정했다. 1차 Explore agent fan-out 결과를 main이 verifier로 교차검증해 2건의
agent 오류를 정정했다:

| 표면               | 1차 agent | 정정 후 (정본) | 정정 근거                                                 |
| ------------------ | --------- | -------------- | --------------------------------------------------------- |
| rendererMap        | 78 ❌     | **94**         | `packages/shared/src/renderers/index.ts:24-143` 직접 Read |
| INTERNAL_RENDERERS | 27 ❌     | **26**         | `CanonicalNodeRenderer.tsx:106-141` 직접 Read             |

나머지 8개 표면 + baseline/exception은 agent 카운트가 직접 Read와 일치해 그대로 채택했다.

## 1. 표면별 정본 카운트 요약

| 표면                              | 기준 파일                                                                        | 정본 카운트                                                     | 분류 축 (Phase)        |
| --------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------- |
| `rendererMap`                     | `packages/shared/src/renderers/index.ts:19-144`                                  | **94**                                                          | render (Phase 3)       |
| `INTERNAL_RENDERERS`              | `apps/builder/src/preview/components/CanonicalNodeRenderer.tsx:103-142`          | **26**                                                          | render (Phase 3)       |
| `DELEGATING_INTERNAL_RENDERERS`   | `CanonicalNodeRenderer.tsx:154-235`                                              | **18**                                                          | render (Phase 3)       |
| `DELEGATING_RAC_RENDERERS`        | `CanonicalNodeRenderer.tsx:248-307`                                              | **10**                                                          | render (Phase 3)       |
| `DEFAULT_PROPS_MAP`               | `apps/builder/src/types/builder/unified.types.ts`                                | **92** (derived 6 / literal 86)                                 | defaults (Phase 2)     |
| `ComponentFactory.creators`       | `apps/builder/src/builder/factories/ComponentFactory.ts:98-165`                  | **55** (54 fn, Navigation→createNav alias)                      | creation (Phase 4)     |
| `COMPLEX_COMPONENT_TAGS`          | `apps/builder/src/builder/factories/constants.ts:13-79`                          | **48** (creators ⊊, 차 7)                                       | creation (Phase 4)     |
| `registerPropagationSpec` 등록    | `apps/builder/src/builder/utils/propagationRegistry.ts:703-749`                  | **31** (ListBox no-op 포함)                                     | propagation (Phase 5)  |
| `SYNTHETIC_CHILD_PROP_MERGE_TAGS` | `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts:187`        | **9**                                                           | childRuntime (Phase 6) |
| `POPOVER_CHILDREN_TAGS`           | `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts:424` | **2**                                                           | childRuntime (Phase 6) |
| registration baseline             | `__tests__/componentRegistrationBaseline.json`                                   | **0 / 0 / 0** (소진됨)                                          | contract (Phase 7)     |
| registration exception            | `__tests__/componentRegistrationException.json`                                  | TAG_SPEC_MAP **11** / rendererMap **4** / getDefaultProps **2** | contract (Phase 7)     |

## 2. render 표면 상세

### 2.1 rendererMap (94)

`packages/shared/src/renderers/index.ts:24-143`. shared 레이어의 `(element, context) => ReactNode`
self-compose / RAC wrapper / child recursion skip 정책 source.

전수 멤버 (94, 영역별):

- **Form (16)**: Form, TextField, NumberField, SearchField, Input, Label, Description, FieldError,
  Checkbox, CheckboxGroup, Radio, RadioGroup, Switch, TailSwatch, FileTrigger, DropZone
- **Selection (8)**: ListBox, ListBoxItem, GridList, GridListItem, Select, ComboBox, Slider, Field
- **Layout (39)**: Tabs, TabList, TabPanels, Card, Dialog, Popover, CardHeader, CardContent,
  CardPreview, CardFooter, Button, Tooltip, ProgressBar, Meter, Separator, Group, Modal,
  Breadcrumbs, Breadcrumb, Link, Badge, Slot, Toast, Pagination, Skeleton, Avatar, AvatarGroup,
  StatusLight, ButtonGroup, Nav, Navigation, Disclosure, DisclosureHeader, DisclosureContent,
  DisclosureGroup, ColorPicker, ColorSwatch, ColorSwatchPicker, ProgressCircle, Image,
  RangeCalendar, IllustratedMessage, CardView, TableView
  (= 44 항목; Nav/Navigation 둘 다 `renderNav` 매핑)
- **Date (5)**: Calendar, DatePicker, DateRangePicker, DateField, TimeField
- **Collection (9)**: Tree, TreeItem, TagGroup, Tag, ToggleButtonGroup, ToggleButton, Menu,
  MenuItem, Toolbar
- **Table (6)**: Table, TableHeader, TableBody, Column, Row, Cell
- **Data (1)**: DataTable
- **Icon (1)**: Icon
- **Color (4)**: ColorField, ColorArea, ColorSlider, ColorWheel

> 영역 합 16+8+44+5+9+6+1+1+4 = 94. (Layout 영역의 InlineAlert/Text는 주석 처리되어 멤버 아님 —
> InlineAlert는 catalog generic fallback, Text는 Spec 경로.)

### 2.2 INTERNAL_RENDERERS (26)

`CanonicalNodeRenderer.tsx:106-141`. Preview가 `React.ElementType`로 직접 렌더하는 internal
컴포넌트 (generic 자식 재귀 가능).

전수 멤버 (26): icon, badge, skeleton, illustrated, statuslight, avatar, progresscircle, listbox,
menu, select, combobox, tabs, taggroup, gridlist, breadcrumbs, tree, table, dialog, modal, popover,
tooltip, dropzone, calendar, rangecalendar, datepicker, daterangepicker

### 2.3 DELEGATING_INTERNAL_RENDERERS (18)

`CanonicalNodeRenderer.tsx:154-235`. `binding.source.kind==="internal"`이면서 self-compose
(childrenByParent 필요)라 `rendererMap[type]`로 위임 + 자식 재귀 skip하는 type.

전수 멤버 (18): tabs, progressbar, meter, breadcrumbs, disclosure, disclosuregroup, nav,
disclosurecontent, field, select, combobox, tree, taggroup, listbox, gridlist, menu, colorpicker,
colorswatchpicker

### 2.4 DELEGATING_RAC_RENDERERS (10)

`CanonicalNodeRenderer.tsx:248-307`. `binding.source.kind==="rac"`이면서 self-compose라 위임 +
자식 재귀 skip하는 type.

전수 멤버 (10): Slider, NumberField, SearchField, TextField, CheckboxGroup, RadioGroup, DateField,
TimeField, Switch, Checkbox

## 3. defaults 표면 상세

### 3.1 DEFAULT_PROPS_MAP (92 = derived 6 + literal 86)

`apps/builder/src/types/builder/unified.types.ts`. `getDefaultProps(type)`는 단순
`DEFAULT_PROPS_MAP[type]?.() ?? {}` lookup이며 (line 2320 부근), runtime binding merge 없음 —
합성은 각 `createDefault*Props` 함수 / `deriveDefaultPropsFromCatalog` 안에서 일어난다.

- **binding-derived (6)** — `deriveDefaultPropsFromCatalog(...)` 사용 (ADR-912에서 닫힘):
  Button, Link, ToggleButton, Badge, Text, Icon
  (Icon은 factory overlay로 random iconName 추가)
- **literal (86)**: 나머지 전부. 각자 literal object/함수로 default props 정의.

Phase 2 우선 proof 후보 = 위 derived 6을 golden baseline으로, 그 다음 binding default가 명확한
child-없는 leaf row를 literal→derived 전환.

## 4. creation 표면 상세

### 4.1 ComponentFactory.creators (55 keys / 54 fn)

`apps/builder/src/builder/factories/ComponentFactory.ts:98-165`. palette add 시 canonical child
element tree를 생성하는 함수 registry.

전수 키 (55): TextField, TextArea, Toast, NumberField, SearchField, frame, ToggleButtonGroup,
CheckboxGroup, RadioGroup, Checkbox, Radio, Switch, Select, ComboBox, Slider, Card, Tabs, Tree,
TagGroup, Breadcrumbs, ListBox, GridList, Table, Menu, Nav, **Navigation (→ createNav alias)**,
Pagination, Disclosure, DisclosureGroup, Dialog, Popover, Tooltip, DataTable, Slot, DatePicker,
DateRangePicker, Calendar, ColorPicker, DateField, TimeField, ColorField, ColorSwatchPicker, Avatar,
AvatarGroup, StatusLight, InlineAlert, ButtonGroup, ProgressBar, Meter, ProgressCircle, Image,
RangeCalendar, IllustratedMessage, CardView, TableView

(고유 creator 함수 = 54. Navigation과 Nav가 동일 `createNav` 공유.)

### 4.2 COMPLEX_COMPONENT_TAGS (48)

`apps/builder/src/builder/factories/constants.ts:13-79`. factory가 자식을 자동 생성하는 "복합"
컴포넌트 membership.

전수 멤버 (48): TextField, TextArea, NumberField, SearchField, DateField, TimeField, ColorField,
Select, ComboBox, ListBox, GridList, Checkbox, Radio, Switch, Slider, ToggleButtonGroup,
CheckboxGroup, RadioGroup, Card, Menu, Disclosure, DisclosureGroup, Pagination, Dialog, Popover,
Tooltip, Toast, InlineAlert, DatePicker, DateRangePicker, Calendar, ColorPicker, ColorSwatchPicker,
Tabs, Tree, TagGroup, Table, ProgressBar, Meter, CardView, TableView, Nav, Navigation, AvatarGroup,
ButtonGroup, Breadcrumbs, IllustratedMessage, RangeCalendar

### 4.3 set-math: COMPLEX_COMPONENT_TAGS ⊊ creators (proper subset)

- **COMPLEX ∖ creators = ∅** — COMPLEX 48 멤버 전부 creators에 존재.
- **creators ∖ COMPLEX = 7** — creators에 있고 COMPLEX에 없는 것:
  **frame, Avatar, ProgressCircle, Image, StatusLight, DataTable, Slot**
  (layout primitive: frame/Slot/DataTable / 단순 leaf: Avatar/ProgressCircle/Image/StatusLight —
  자식 자동생성 불필요라 COMPLEX 비대상)

→ ADR-912 `912.md:59`의 "creators = `COMPLEX_COMPONENT_TAGS`" 등치는 틀렸다 (진부분집합, 차 7).
Phase 4에서 `COMPLEX_COMPONENT_TAGS` membership을 creation facet에서 파생할 때 이 7개 차집합을
"none / leaf-primitive"로 분류해야 한다.

## 5. propagation 표면 상세

### 5.1 registerPropagationSpec 등록 (31)

`apps/builder/src/builder/utils/propagationRegistry.ts:703-749`. parent props를 child props/style로
전파하는 `ComponentSpec`-모양 shadow object registry.

등록 parent type (31): DatePicker, DateRangePicker, Select, ComboBox, SearchField, CheckboxGroup,
RadioGroup, TagGroup, Checkbox, Radio, Switch, TextField, TextArea, NumberField, DateField, TimeField,
ColorField, Slider, ProgressBar, Meter, Calendar, RangeCalendar, Card, CardHeader, CardContent,
GridList, ListBox, ToggleButtonGroup, Tabs, GridListItem, ListBoxItem

- single-line 호출 29 + multi-line 2 (GridListItem/ListBoxItem, `createCollectionItemPropagationSpec`
  경유) = 31.
- **no-op/empty (1)**: ListBox — `rules:[]` (ADR-912 단계5 step4, 2026-06-17 이관. 원 spec은
  propagation 규칙 부재였고 no-op로 보존).

Phase 5 proof family = order-sensitive 한 family 하나에서 spec-shaped constant 제거.

## 6. childRuntime 표면 상세

### 6.1 SYNTHETIC_CHILD_PROP_MERGE_TAGS (9)

`apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts:187`. Skia가 자식 props를
참조해 shapes를 구성하므로 `_hasChildren` 주입을 차단하는 type (canvas-rendering.md §2.5 정합).

전수 멤버 (9): Breadcrumbs, ComboBox, GridList, Select, Table, Tabs, TagGroup, Toolbar, Tree

### 6.2 POPOVER_CHILDREN_TAGS (2)

`apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts:424`. popover-hosted라
Taffy 레이아웃에서 제외하는 type.

전수 멤버 (2): Calendar, RangeCalendar

- 같은 파일의 `filteredChildren` branch는 containerTag 기반으로 ~23개 유형(breadcrumbs/menu/
  taggroup/taglist/listbox/gridlist/... inlinealert)을 다룬다. Phase 6에서 declarative membership과
  function-level filter를 분리 분류한다.

## 7. contract 표면 상세 (ADR-139)

### 7.1 baseline (소진) — `componentRegistrationBaseline.json`

- TAG_SPEC_MAP: **0** / rendererMap: **0** / getDefaultProps: **0**
- 2026-05-17 이후 baseline 전수 소진 → 모든 registry 빈 객체. baseline = 해소 대상 known debt
  (`debt`). 현재 debt 잔여 0.

### 7.2 exception (intended 부재 — 영구 보존) — `componentRegistrationException.json`

baseline과 달리 **영구 정당한 의도된 부재(`intended-absent`)**. 해소(삭제) 대상 아님.

- **TAG_SPEC_MAP (11)**: ColorPicker, ColorSwatchPicker, DataTable, Disclosure, DisclosureGroup,
  Image, MenuItem, Nav, Navigation, ProgressCircle, StatusLight
- **rendererMap (4)**: InlineAlert, List, TextArea, frame
- **getDefaultProps (2)**: DataTable, Navigation

### 7.3 allowed() 로직 — `componentRegistrationContract.test.ts:94-96`

```ts
function allowed(reg, comp) {
  return comp in (exceptions[reg] ?? {}) || comp in (baseline[reg] ?? {});
}
```

미등록 컴포넌트는 exception **또는** baseline 키에 있으면 허용. Phase 7 contract swap은 baseline
(빈 객체) 차단 의미뿐 아니라 **exception 11/4/2 항목의 "등록 없음이 정상" 차단 의미까지** 누락
없이 `entryUniverseContract`로 흡수해야 한다 (§3.3-8 / Phase 7 matrix).

## 8. owner classification (deletion 진입용 사전 분류)

각 표면의 owner 분류는 해당 deletion phase에서 fixture green과 함께 확정한다. Phase 0은 count
freeze만 담당하고, 분류 축(label)만 제시한다:

| 표면              | 분류 축 (해당 Phase에서 row별 확정)                                                        |
| ----------------- | ------------------------------------------------------------------------------------------ |
| rendererMap       | `generic-dead` / `internal-adapter` / `delegating-rac` / `delegating-internal` / `unknown` |
| DEFAULT_PROPS_MAP | `binding-derived` (6) / `literal-equivalent` / `literal-required` / `unknown`              |
| creators          | `no-child` / `declared-child-template` / `reusable-origin-ready` / `delegate-required`     |
| propagation       | parent type별 + `no-op`(ListBox) 분리                                                      |
| childRuntime      | type membership 단위 (declarative vs function-level filter)                                |
| baseline          | `debt` (현재 0)                                                                            |
| exception         | `intended-absent` (영구 보존, 11/4/2)                                                      |

## 9. ADR-912 카운트 대조 (history 참고 전용 — source 아님)

| 표면     | ADR-912 인용                                   | ADR-914 정본 (2026-06-20) | gap 사유                                      |
| -------- | ---------------------------------------------- | ------------------------- | --------------------------------------------- |
| creators | 60 (`912:76`) / 55 (`912:59`) / 45 (`912:209`) | **55**                    | ADR-912 자기모순 (3값). 55가 현재 실측과 일치 |
| COMPLEX  | = creators (`912:59` 등치)                     | **48** (creators ⊊, 차 7) | `912:59` set 등치 오류                        |
| derived  | "6/92"                                         | **6/92**                  | 일치 (검증 통과)                              |

ADR-912 gap은 새 fork 사유가 아니라 본 Phase 0 inventory로 흡수 (adr-writing.md M3 — 추정 vs
실측 gap = Phase 0 inventory freeze 절차로 해소, 전제 재검토 trigger 아님). 향후 phase는 본
inventory의 정본 카운트를 current source로 우선한다.

## 10. Phase 2a G8 live smoke 부수 발견 — nested `<button>` (creation 영역, Phase 4)

Phase 2a (Button defaults proof) G8 live smoke 중 발견: palette "button" 추가 시 Preview DOM 에
`<button>` 안에 `<button>` 중첩 (canonical element id 2개: 컨테이너 + 내부) → React hydration
error (`<button> cannot be a descendant of <button>`).

**defaults 변경과 무관 (격리 검증 완료)**: Phase 2a 변경을 git stash 한 baseline 코드에서도
동일 error 가 byte-identical 재현됨 (동일 element id / 동일 timestamp). 즉 nested button 은
defaults facet 이 아니라 **creation 구조 문제** — palette "button" 추가가 Button 을 Button child 로
넣는 factory/canonical 구조. **ADR-914 Phase 4 (Creation Facet Proof) 영역**에서 다룬다.

Phase 2a 의 defaults 관점 검증은 통과: 추가된 Button 이 `data-variant="primary" data-size="md"
data-fill-style="fill"` 로 정상 렌더 = `getDefaultProps("Button")` derived 경로가 oracle 과 일치.
