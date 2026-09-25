/**
 * 타입 특성 표 (ADR-236 Phase 2) — "이 타입이 무엇인가" 를 타입 한 행에 모은다.
 *
 * 같은 멤버십을 파일마다 `new Set([...])` 으로 다시 적으면 새 타입이 들어올 때 목록마다 따로
 * 고쳐야 하고, 빠진 목록은 조용히 다르게 동작한다 (Phase 0 인벤토리: 파생 대상 집합 23).
 * 소비처는 `componentTypeSet(family)` 로 집합을 얻는다 — 렌더 분기 코드는 그대로 두고 멤버십만
 * 여기서 온다. 측정 · 크기 · shape 값을 정하는 집합 (렌더 특수) 은 여기 두지 않는다.
 *
 * 키는 element `type` 그대로다. PascalCase canonical 타입 외에 legacy HTML 태그 (`p` · `span` ·
 * `label` …) 와 소문자 legacy 타입 (`box` · `container`) 도 요소 type 으로 남아 있어 행을 둔다.
 * 소문자로 비교하는 소비처는 `{ lowercase: true }` 로 받는다.
 *
 * `children` · `owners` 는 RAC 합성 계약의 관찰값이다 (D1 을 정의하지 않고 적는다). 중첩 검사
 * (`catalog/nesting/nestingRules.ts` 층 2) 가 이 두 열과 `container: "collection"` 을 읽는다.
 * 항목은 `factoryNestingOracle.test.ts` 가 팩토리 트리로 검증한다.
 */

/**
 * - `structural`: 자식을 담는 레이아웃 그릇 (drop 대상 · padding 편집 대상).
 * - `collection`: item 만 읽는 진짜 컬렉션 — 레이아웃 래퍼도 못 들어간다 (RAC collection 은 직계
 *   자식을 item 으로 해석한다). 그 밖의 합성 컨테이너 (RadioGroup · Slider · Tabs …) 는 context
 *   기반이라 `frame` 같은 레이아웃 래퍼를 사이에 둬도 된다 — `NESTING_PASSTHROUGH_TYPES`.
 */
export type ComponentContainerKind = "structural" | "collection";

export type ComponentTraitFamily =
  /** 이름 있는 영역 없이 자유 내용을 받는 slot host (frame slot). */
  | "freeContentHost"
  /** 캔버스 더블클릭으로 텍스트 (children) 를 편집한다. */
  | "textHost"
  /** 캔버스 더블클릭으로 입력 값 (value) 을 편집한다. */
  | "inputValue"
  /** 자식 Text · Icon 을 Properties 의 버튼 내용 섹션에서 편집한다. */
  | "buttonChildHost"
  /** 팔레트 추가 시 action 기본값을 받는 타입. */
  | "action"
  /** 이미지 소스를 그리는 타입. */
  | "image"
  /** 조상 Form 의 설정을 상속하는 텍스트 입력 필드. */
  | "textInputField"
  /** 선택 상태를 항목 flag 로 싣는 collection 항목. */
  | "selectionItem"
  /** RAC key 를 정적 `props.id` 로 내는 collection 항목. */
  | "staticCollectionItem"
  /** 항목의 slot 자식 역할을 DOM `slot` 으로 내는 collection. */
  | "itemSlotCollection"
  /** `isDisabled` 를 자식 항목에게 내리는 그룹. */
  | "disablingGroup";

export interface ComponentTraits {
  readonly container?: ComponentContainerKind;
  readonly families?: readonly ComponentTraitFamily[];
  /** 컬렉션 · 합성 컨테이너가 직계 자식으로 읽는 타입. RAC 는 이 밖의 자식을 collection 으로 인식하지 않는다. */
  readonly children?: readonly string[];
  /** 합성 부품이 뜻을 갖기 위해 조상 어딘가에 있어야 하는 소유자 (직계가 아니어도 된다). */
  readonly owners?: readonly string[];
}

// SelectTrigger 래퍼를 쓰는 필드 전부가 소유자다 — 팩토리 오라클이 DatePicker · DateRangePicker ·
// NumberField 의 트리거 안 SelectIcon/SelectValue 를 실증했다.
const SELECT_TRIGGER_OWNERS = [
  "Select",
  "ComboBox",
  "SearchField",
  "NumberField",
  "DatePicker",
  "DateRangePicker",
] as const;

export const COMPONENT_TRAITS: Readonly<Record<string, ComponentTraits>> = {
  // ── 구조 컨테이너 ──
  body: { container: "structural" },
  box: { container: "structural", families: ["freeContentHost"] },
  container: { container: "structural" },
  frame: { container: "structural", families: ["freeContentHost"] },
  Group: { container: "structural", families: ["freeContentHost"] },
  Section: { container: "structural", families: ["freeContentHost"] },
  Card: { container: "structural" },
  CardHeader: {
    container: "structural",
    families: ["freeContentHost"],
    owners: ["Card"],
  },
  CardContent: {
    container: "structural",
    families: ["freeContentHost"],
    owners: ["Card"],
  },
  CardFooter: {
    container: "structural",
    families: ["freeContentHost"],
    owners: ["Card"],
  },
  // ADR-240 Phase 1 — Card preview 영역 · 자유 내용 컨테이너 (RAC Popover · Tooltip — 이름 있는 slot 없음).
  CardPreview: {
    container: "structural",
    families: ["freeContentHost"],
    owners: ["Card"],
  },
  Popover: { families: ["freeContentHost"] },
  Tooltip: { families: ["freeContentHost"] },

  // ── 텍스트 ──
  Text: { families: ["textHost"] },
  Heading: { families: ["textHost"] },
  Label: { families: ["textHost"] },
  Paragraph: { families: ["textHost"] },
  Description: { families: ["textHost"] },
  Strong: { families: ["textHost"] },
  Em: { families: ["textHost"] },
  Code: { families: ["textHost"] },
  Badge: { families: ["textHost"] },
  Link: { families: ["textHost", "action"] },
  p: { families: ["textHost"] },
  h1: { families: ["textHost"] },
  h2: { families: ["textHost"] },
  h3: { families: ["textHost"] },
  h4: { families: ["textHost"] },
  h5: { families: ["textHost"] },
  h6: { families: ["textHost"] },
  span: { families: ["textHost"] },
  a: { families: ["textHost"] },
  label: { families: ["textHost"] },
  button: { families: ["textHost"] },

  // ── 버튼 ──
  Button: { families: ["textHost", "buttonChildHost", "action"] },
  ToggleButton: { families: ["textHost", "buttonChildHost", "action"] },
  ButtonGroup: { families: ["action"] },
  ActionButtonGroup: { families: ["action"] },
  ToggleButtonGroup: {
    container: "collection",
    families: ["disablingGroup"],
    children: ["ToggleButton"],
  },

  // ── 이미지 ──
  Image: { families: ["image"] },
  Avatar: { families: ["image"] },
  Logo: { families: ["image"] },
  Thumbnail: { families: ["image"] },

  // ── 필드 ──
  Input: {
    families: ["inputValue"],
    owners: [
      "TextField",
      "TextArea",
      "NumberField",
      "SearchField",
      "ColorField",
      "ComboBox",
      "Field",
    ],
  },
  TextInput: { families: ["inputValue"] },
  TextField: { families: ["inputValue", "textInputField"] },
  TextArea: { families: ["inputValue", "textInputField"] },
  SearchField: { families: ["inputValue", "textInputField"] },
  NumberField: { families: ["textInputField"] },
  FieldError: {
    owners: [
      "TextField",
      "TextArea",
      "NumberField",
      "SearchField",
      "DateField",
      "TimeField",
      "DatePicker",
      "DateRangePicker",
      "ColorField",
      "ComboBox",
      "Select",
      "RadioGroup",
      "CheckboxGroup",
      "TagGroup",
      "Slider",
      "Field",
    ],
  },
  DateInput: {
    owners: ["DateField", "TimeField", "DatePicker", "DateRangePicker"],
  },
  SelectTrigger: { owners: SELECT_TRIGGER_OWNERS },
  SelectValue: { owners: SELECT_TRIGGER_OWNERS },
  SelectIcon: { owners: SELECT_TRIGGER_OWNERS },

  // ── 컬렉션 ──
  // ADR-238 Phase 2 — section 층 (RAC `ListBoxSection` · `MenuSection` · `GridListSection` + `Header`).
  ListBox: {
    container: "collection",
    families: ["itemSlotCollection", "disablingGroup"],
    children: ["ListBoxItem", "ListBoxSection", "Section", "Header"],
  },
  ListBoxSection: {
    children: ["Header", "ListBoxItem"],
    owners: ["ListBox", "Select", "ComboBox"],
  },
  ListBoxItem: {
    families: ["selectionItem", "staticCollectionItem"],
    owners: ["ListBox", "Select", "ComboBox"],
  },
  Menu: {
    container: "collection",
    families: ["itemSlotCollection"],
    children: ["MenuItem", "MenuSection", "Section", "Separator", "Header"],
  },
  MenuSection: { children: ["Header", "MenuItem"], owners: ["Menu"] },
  MenuItem: { owners: ["Menu"] },
  GridList: {
    container: "collection",
    families: ["itemSlotCollection", "disablingGroup"],
    children: ["GridListItem", "GridListSection"],
  },
  GridListSection: {
    children: ["Header", "GridListItem"],
    owners: ["GridList"],
  },
  GridListItem: {
    families: ["selectionItem", "staticCollectionItem"],
    owners: ["GridList"],
  },
  TagGroup: {
    families: ["itemSlotCollection", "disablingGroup"],
    children: ["Label", "TagList", "Description", "FieldError"],
  },
  TagList: {
    container: "collection",
    children: ["Tag"],
    owners: ["TagGroup"],
  },
  Tag: { families: ["textHost", "staticCollectionItem"], owners: ["TagList"] },
  Breadcrumbs: { container: "collection", children: ["Breadcrumb"] },
  Breadcrumb: {
    families: ["staticCollectionItem"],
    owners: ["Breadcrumbs"],
  },

  // ── 합성 컨테이너 ──
  Tabs: {
    families: ["disablingGroup"],
    children: ["TabList", "TabPanels", "TabPanel"],
  },
  TabList: { container: "collection", children: ["Tab"], owners: ["Tabs"] },
  TabPanels: {
    container: "collection",
    children: ["TabPanel"],
    owners: ["Tabs"],
  },
  TabPanel: { owners: ["Tabs"] },
  Tab: { families: ["staticCollectionItem"], owners: ["TabList"] },
  RadioGroup: {
    families: ["disablingGroup"],
    children: ["Label", "Radio", "RadioItems", "Description", "FieldError"],
  },
  Radio: { owners: ["RadioGroup"] },
  RadioItems: { owners: ["RadioGroup"] },
  CheckboxGroup: {
    families: ["disablingGroup"],
    children: [
      "Label",
      "Checkbox",
      "CheckboxItems",
      "Description",
      "FieldError",
    ],
  },
  CheckboxItems: { owners: ["CheckboxGroup"] },
  DisclosureGroup: { children: ["Disclosure"] },
  DisclosureHeader: { owners: ["Disclosure"] },
  Slider: { children: ["Label", "SliderOutput", "SliderTrack"] },
  SliderOutput: { owners: ["Slider"] },
  SliderTrack: { children: ["SliderThumb"], owners: ["Slider"] },
  SliderThumb: { owners: ["SliderTrack"] },
  Meter: { children: ["Label", "MeterValue", "MeterTrack"] },
  MeterTrack: { owners: ["Meter"] },
  MeterValue: { owners: ["Meter"] },
  ProgressBar: { children: ["Label", "ProgressBarValue", "ProgressBarTrack"] },
  ProgressBarTrack: { owners: ["ProgressBar"] },
  ProgressBarValue: { owners: ["ProgressBar"] },
  Calendar: { children: ["CalendarHeader", "CalendarGrid"] },
  RangeCalendar: { children: ["CalendarHeader", "CalendarGrid"] },
  CalendarGrid: { owners: ["Calendar", "RangeCalendar"] },
  CalendarHeader: { owners: ["Calendar", "RangeCalendar"] },
};

export function getComponentTraits(
  type: string | null | undefined,
): ComponentTraits | undefined {
  if (!type || !Object.hasOwn(COMPONENT_TRAITS, type)) return undefined;
  return COMPONENT_TRAITS[type];
}

export function hasComponentFamily(
  type: string | null | undefined,
  family: ComponentTraitFamily,
): boolean {
  return getComponentTraits(type)?.families?.includes(family) === true;
}

export interface ComponentTypeSetOptions {
  /** 소비처가 `type.toLowerCase()` 로 비교할 때 — 대소문자만 다른 행은 하나로 합쳐진다. */
  readonly lowercase?: boolean;
}

function toTypeSet(
  types: readonly string[],
  options: ComponentTypeSetOptions | undefined,
): ReadonlySet<string> {
  return new Set(
    options?.lowercase ? types.map((type) => type.toLowerCase()) : types,
  );
}

/** family 를 가진 타입 집합 (표 순서). */
export function componentTypeSet(
  family: ComponentTraitFamily,
  options?: ComponentTypeSetOptions,
): ReadonlySet<string> {
  const types = Object.keys(COMPONENT_TRAITS).filter((type) =>
    COMPONENT_TRAITS[type].families?.includes(family),
  );
  return toTypeSet(types, options);
}

/** container 종류가 같은 타입 집합 (표 순서). */
export function containerTypeSet(
  kind: ComponentContainerKind,
  options?: ComponentTypeSetOptions,
): ReadonlySet<string> {
  const types = Object.keys(COMPONENT_TRAITS).filter(
    (type) => COMPONENT_TRAITS[type].container === kind,
  );
  return toTypeSet(types, options);
}

/** 타입 → 합성 부품이 읽는 한 열 (`children` 또는 `owners`) 의 맵. 그 열이 있는 행만 담는다. */
export function componentContractMap(
  column: "children" | "owners",
): Readonly<Record<string, readonly string[]>> {
  const map: Record<string, readonly string[]> = {};
  for (const [type, traits] of Object.entries(COMPONENT_TRAITS)) {
    const values = traits[column];
    if (values) map[type] = values;
  }
  return map;
}

/** `type` 을 조상에 둬야 뜻이 있는 합성 부품의 소유자 목록 (없으면 빈 배열). */
export function componentOwnerTypes(
  type: string | null | undefined,
): readonly string[] {
  return getComponentTraits(type)?.owners ?? [];
}
