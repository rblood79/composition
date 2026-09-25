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
 */

/** 구조 컨테이너 — 자식을 담는 레이아웃 그릇 (drop 대상 · padding 편집 대상). */
export type ComponentContainerKind = "structural";

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
  /** DateInput 을 자식으로 두는 날짜 · 시간 필드. */
  | "dateField"
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
}

export const COMPONENT_TRAITS: Readonly<Record<string, ComponentTraits>> = {
  // ── 구조 컨테이너 ──
  body: { container: "structural" },
  box: { container: "structural", families: ["freeContentHost"] },
  container: { container: "structural" },
  frame: { container: "structural", families: ["freeContentHost"] },
  Group: { container: "structural", families: ["freeContentHost"] },
  Section: { container: "structural", families: ["freeContentHost"] },
  Card: { container: "structural" },
  CardHeader: { container: "structural", families: ["freeContentHost"] },
  CardContent: { container: "structural", families: ["freeContentHost"] },
  CardFooter: { container: "structural", families: ["freeContentHost"] },
  // ADR-240 Phase 1 — Card preview 영역 · 자유 내용 컨테이너 (RAC Popover · Tooltip — 이름 있는 slot 없음).
  CardPreview: { container: "structural", families: ["freeContentHost"] },
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

  // ── 이미지 ──
  Image: { families: ["image"] },
  Avatar: { families: ["image"] },
  Logo: { families: ["image"] },
  Thumbnail: { families: ["image"] },

  // ── 필드 ──
  Input: { families: ["inputValue"] },
  TextInput: { families: ["inputValue"] },
  TextField: { families: ["inputValue", "textInputField"] },
  TextArea: { families: ["inputValue", "textInputField"] },
  SearchField: { families: ["inputValue", "textInputField"] },
  NumberField: { families: ["textInputField"] },
  DateField: { families: ["dateField"] },
  TimeField: { families: ["dateField"] },
  DatePicker: { families: ["dateField"] },
  DateRangePicker: { families: ["dateField"] },

  // ── 컬렉션 · 그룹 ──
  ListBox: { families: ["itemSlotCollection", "disablingGroup"] },
  GridList: { families: ["itemSlotCollection", "disablingGroup"] },
  Menu: { families: ["itemSlotCollection"] },
  TagGroup: { families: ["itemSlotCollection", "disablingGroup"] },
  Tabs: { families: ["disablingGroup"] },
  RadioGroup: { families: ["disablingGroup"] },
  CheckboxGroup: { families: ["disablingGroup"] },
  ToggleButtonGroup: { families: ["disablingGroup"] },
  ListBoxItem: { families: ["selectionItem", "staticCollectionItem"] },
  GridListItem: { families: ["selectionItem", "staticCollectionItem"] },
  Tab: { families: ["staticCollectionItem"] },
  Tag: { families: ["textHost", "staticCollectionItem"] },
  Breadcrumb: { families: ["staticCollectionItem"] },
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
