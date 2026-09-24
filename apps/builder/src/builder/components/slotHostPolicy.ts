import {
  LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
  LISTBOX_ITEM_SELECTED_ORIGIN_ID,
} from "./listbox/listBoxTemplateOrigins";
import { GRIDLIST_ITEM_DEFAULT_ORIGIN_ID } from "./gridlist/gridListTemplateOrigins";
import { MENU_ITEM_DEFAULT_ORIGIN_ID } from "./menu/menuTemplateOrigins";
import {
  TAG_ITEM_DEFAULT_ORIGIN_ID,
  TAG_ITEM_SELECTED_ORIGIN_ID,
} from "./taggroup/tagGroupTemplateOrigins";
import {
  TAB_ITEM_DEFAULT_ORIGIN_ID,
  TAB_ITEM_SELECTED_ORIGIN_ID,
} from "./tabs/tabsTemplateOrigins";
import { BREADCRUMB_ITEM_DEFAULT_ORIGIN_ID } from "./breadcrumbs/breadcrumbsTemplateOrigins";

export type SlotPolicyElement = {
  _resolvedFrom?: string;
  componentName?: string | null;
  customId?: string | null;
  id: string;
  metadata?: Record<string, unknown>;
  name?: string | null;
  ref?: string;
  reusable?: boolean;
  slot?: unknown;
  type: string;
};

export const FRAME_SLOT_HOST_TYPES = new Set([
  "box",
  "cardcontent",
  "cardfooter",
  "cardheader",
  // ADR-240 Phase 1 — Card preview 영역 · 자유 내용 컨테이너 (RAC Popover · Tooltip — 이름 있는 slot 없음, R2).
  "cardpreview",
  "frame",
  "group",
  "popover",
  "section",
  "tooltip",
]);

/**
 * ADR-240 — 이름 영역 host (148 slotRole 어휘 P3). 영역의 계약 대상은 **채운 reusable instance** 뿐이다:
 * origin 에서 상속한 자식 (Card `{title}` Heading · Dialog Description) 과 자유 내용 (primitive) 은 추천 목록과
 * 대조하지 않는다 (Preview `validateSlotContract` 경고 대상 밖).
 */
export const NAMED_REGION_SLOT_ROLES: ReadonlySet<string> = new Set([
  "preview",
  "header",
  "content",
  "footer",
  "action",
]);

/** 자유 내용 컨테이너 root 가 곧 영역인 type (instance 는 자기 자식으로 채운다 — mode C 아님). */
export const ROOT_REGION_SLOT_HOST_TYPES: ReadonlySet<string> = new Set([
  "Popover",
  "Tooltip",
]);

export function isNamedRegionHost(element: SlotPolicyElement): boolean {
  const role = element.metadata?.slotRole;
  return (
    (typeof role === "string" && NAMED_REGION_SLOT_ROLES.has(role)) ||
    ROOT_REGION_SLOT_HOST_TYPES.has(element.type)
  );
}

/**
 * Slot 절 "Insert" 의 뜻 — Frame 가족은 slot 에 ref 자식을 넣고, 목록 틀 (TabList · TagList · ListBox · GridList ·
 * Menu) 은 항목 instance 를 넣는다 (ADR-234 Phase 3 — slot 은 목록 틀에만 있다. TagGroup · Tabs root 는 host 아님).
 * 그룹 컨테이너 (ADR-237) 는 항목 instance 자식을 넣고 선택 prop 값 (`isSelected` · Radio `value`) 을 채운다.
 */
export type SlotInsertAction =
  | { kind: "child" }
  // ADR-234 Phase 3 — 목록 틀 (TabList · TagList · ListBox) 의 "+" = 항목 instance (Tabs 는 짝 TabPanel 도 —
  //   `collectionItemInsert`).
  | { kind: "list-item" }
  // ADR-237 Phase 1 — 그룹 컨테이너의 "+" = origin 의 instance 자식 + 선택 값 (`groupItemInsert`).
  | { kind: "group-item" };

/**
 * ADR-237 Phase 1 — slot host 표 한 행. 종전 type 별 if 문 5종을 행으로 옮겼다 (동작 무변경).
 *
 * - `matches` : 후보 · 넣기 정책을 적용할 host 인가 (candidate/drop 정책의 host 판정).
 * - `active`  : Slot 절을 보여 줄 host 인가 (`isSlotHostElement`).
 * - `candidate` : slot 추천 후보로 허용되는 노드인가.
 * - `placedChildren` : 후보가 reusable 이 아닌 배치 요소 (Label · 사용자가 끌어 넣은 instance) 면 허용 — 그룹만.
 *   캔버스 drop · 형제 재배치 · slot 계약 경고가 같은 판정을 읽으므로 그룹의 Label 자식이 막히지 않게 한다.
 * - `itemTypes` : slot 계약 경고 대상 자식 type (없으면 전부) — 그룹의 Label · Separator 는 항목이 아니다.
 */
export interface SlotHostRule {
  host: string;
  matches(element: SlotPolicyElement): boolean;
  active(element: SlotPolicyElement): boolean;
  candidate(candidate: SlotPolicyElement): boolean;
  insert: SlotInsertAction["kind"];
  placedChildren?: boolean;
  itemTypes?: ReadonlySet<string>;
}

function normalizeType(type: string | undefined): string {
  return (type ?? "").toLowerCase();
}

function getElementLabel(element: SlotPolicyElement): string {
  return (
    element.componentName ?? element.customId ?? element.name ?? element.type
  );
}

function hasSlotArray(element: SlotPolicyElement): boolean {
  return Array.isArray(element.slot);
}

function isReusableOrSystemOwned(element: SlotPolicyElement): boolean {
  return element.reusable === true || element.metadata?.systemOwned === true;
}

/** 후보가 origin 집합 중 하나를 (자기 · ref · 해석 원천) 가리키거나, 라벨이 접두사로 시작하나. */
function templateCandidate(
  originIds: ReadonlySet<string>,
  labelPrefix: string,
): (candidate: SlotPolicyElement) => boolean {
  return (candidate) => {
    if (originIds.has(candidate.id)) return true;
    if (candidate.ref && originIds.has(candidate.ref)) return true;
    if (candidate._resolvedFrom && originIds.has(candidate._resolvedFrom)) {
      return true;
    }
    return getElementLabel(candidate).toLowerCase().startsWith(labelPrefix);
  };
}

/**
 * ADR-237 — 그룹 항목 후보: 가족 origin 자신 또는 그 상태 변형 (ref 변형 = `ref`, 이관 전 복제본 =
 * `metadata.variantOf`).
 */
function familyCandidate(
  originIds: ReadonlySet<string>,
): (candidate: SlotPolicyElement) => boolean {
  return (candidate) =>
    [
      candidate.id,
      candidate.ref,
      candidate._resolvedFrom,
      candidate.metadata?.variantOf,
    ].some((id) => typeof id === "string" && originIds.has(id));
}

const byType =
  (type: string) =>
  (element: SlotPolicyElement): boolean =>
    normalizeType(element.type) === type;

const byTypeWithSlot =
  (type: string) =>
  (element: SlotPolicyElement): boolean =>
    normalizeType(element.type) === type && hasSlotArray(element);

/**
 * ADR-237 Phase 1 — 그룹 컨테이너 9종 (host type → 항목 origin · 항목 type). 목록 틀 = host 자신이라 instance 는
 * root 에서 origin 의 slot 을 읽는다 (`SELF_LIST_SLOT_HOST_TYPES`).
 */
export const GROUP_SLOT_HOSTS: ReadonlyArray<{
  type: string;
  originIds: readonly string[];
  itemTypes: readonly string[];
  /** 새 문서 seed · 기존 문서 repair 의 추천 목록 (휴지 모양 먼저 — Tabs 와 같은 순서). */
  slot: readonly string[];
}> = [
  {
    type: "CheckboxGroup",
    originIds: ["component-checkbox"],
    itemTypes: ["Checkbox"],
    slot: ["component-checkbox--unselected", "component-checkbox"],
  },
  {
    type: "RadioGroup",
    originIds: ["component-radio"],
    itemTypes: ["Radio"],
    slot: ["component-radio--unselected", "component-radio"],
  },
  {
    type: "ToggleButtonGroup",
    originIds: ["component-togglebutton"],
    itemTypes: ["ToggleButton"],
    slot: ["component-togglebutton--unselected", "component-togglebutton"],
  },
  {
    type: "DisclosureGroup",
    originIds: ["component-disclosure"],
    itemTypes: ["Disclosure"],
    slot: ["component-disclosure--collapsed", "component-disclosure"],
  },
  {
    type: "ButtonGroup",
    originIds: ["component-button"],
    itemTypes: ["Button"],
    slot: ["component-button"],
  },
  {
    type: "Pagination",
    originIds: ["component-button"],
    itemTypes: ["Button"],
    slot: ["component-button"],
  },
  {
    type: "AvatarGroup",
    originIds: ["component-avatar"],
    itemTypes: ["Avatar"],
    slot: ["component-avatar"],
  },
  {
    type: "Nav",
    originIds: ["component-link"],
    itemTypes: ["Link"],
    slot: ["component-link"],
  },
  {
    type: "Toolbar",
    originIds: ["component-button", "component-togglebutton"],
    itemTypes: ["Button", "ToggleButton"],
    slot: [
      "component-button",
      "component-togglebutton--unselected",
      "component-togglebutton",
    ],
  },
];

export const SLOT_HOST_RULES: readonly SlotHostRule[] = [
  // ADR-234 Phase 3 — slot 을 가진 TabList (Tabs 의 목록 틀).
  {
    host: "tablist",
    matches: byTypeWithSlot("tablist"),
    active: byTypeWithSlot("tablist"),
    candidate: templateCandidate(
      new Set([TAB_ITEM_DEFAULT_ORIGIN_ID, TAB_ITEM_SELECTED_ORIGIN_ID]),
      "tab/",
    ),
    insert: "list-item",
  },
  // ADR-229 Phase 2 → ADR-234 Phase 3 — slot 을 가진 TagList (TagGroup 의 목록 틀).
  {
    host: "taglist",
    matches: byTypeWithSlot("taglist"),
    active: byTypeWithSlot("taglist"),
    candidate: templateCandidate(
      new Set([TAG_ITEM_DEFAULT_ORIGIN_ID, TAG_ITEM_SELECTED_ORIGIN_ID]),
      "tag/",
    ),
    insert: "list-item",
  },
  // ListBox 는 자기가 목록 틀 — 정적 목록의 "+" 는 ListBoxItem instance 자식 (바인딩 목록의 행은 데이터).
  {
    host: "listbox",
    matches: byType("listbox"),
    active: (element) =>
      byType("listbox")(element) && isReusableOrSystemOwned(element),
    candidate: templateCandidate(
      new Set([
        LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
        LISTBOX_ITEM_SELECTED_ORIGIN_ID,
      ]),
      "listboxitem/",
    ),
    insert: "list-item",
  },
  // ADR-161 Phase 7: GridList slot host parity (ListBox 대칭).
  {
    host: "gridlist",
    matches: byType("gridlist"),
    active: (element) =>
      byType("gridlist")(element) && isReusableOrSystemOwned(element),
    candidate: templateCandidate(
      new Set([GRIDLIST_ITEM_DEFAULT_ORIGIN_ID]),
      "gridlistitem/",
    ),
    insert: "list-item",
  },
  // ADR-234 Phase 3f — Menu 는 자기가 목록 틀 (항목 = MenuItem instance 자식, popover 안).
  {
    host: "menu",
    matches: byType("menu"),
    active: (element) =>
      byType("menu")(element) && isReusableOrSystemOwned(element),
    candidate: templateCandidate(
      new Set([MENU_ITEM_DEFAULT_ORIGIN_ID]),
      "menuitem/",
    ),
    insert: "list-item",
  },
  // ADR-237 Phase 3 — Breadcrumbs 는 자기가 목록 틀 (항목 = Breadcrumb instance 자식 · 현재 변형도 후보).
  {
    host: "breadcrumbs",
    // slot 을 가진 것만 (Components origin · instance 는 패널이 origin slot 을 읽는다) — slot 없는 사용자
    //   Breadcrumbs 의 drop · 재배치는 종전 그대로. 배치 요소 (legacy plain Breadcrumb 자식) 는 허용.
    matches: byTypeWithSlot("breadcrumbs"),
    active: byTypeWithSlot("breadcrumbs"),
    candidate: templateCandidate(
      new Set([BREADCRUMB_ITEM_DEFAULT_ORIGIN_ID]),
      "breadcrumb/",
    ),
    placedChildren: true,
    insert: "list-item",
  },
  // ADR-237 Phase 1 — 그룹 컨테이너 9종 (slot 을 가진 것만 — slot 없는 사용자 그룹은 종전 그대로).
  ...GROUP_SLOT_HOSTS.map((group): SlotHostRule => ({
    host: normalizeType(group.type),
    matches: byTypeWithSlot(normalizeType(group.type)),
    active: byTypeWithSlot(normalizeType(group.type)),
    candidate: familyCandidate(new Set(group.originIds)),
    insert: "group-item",
    placedChildren: true,
    itemTypes: new Set(group.itemTypes),
  })),
];

/**
 * 목록 틀 = host 자신 (항목 = 자기 자식) — instance root 가 origin 의 slot 을 읽는 가족. ADR-240 — 자유 내용
 * 컨테이너 root (Popover · Tooltip) 도 같은 모양 (instance 자기 자식, inherited 자식 뒤).
 */
export const SELF_LIST_SLOT_HOST_TYPES: ReadonlySet<string> = new Set([
  "ListBox",
  "GridList",
  "Menu",
  "Breadcrumbs",
  ...GROUP_SLOT_HOSTS.map((group) => group.type),
  ...ROOT_REGION_SLOT_HOST_TYPES,
]);

function findRule(
  host: SlotPolicyElement | undefined,
): SlotHostRule | undefined {
  if (!host) return undefined;
  return SLOT_HOST_RULES.find((rule) => rule.matches(host));
}

export function resolveSlotInsertAction(
  host: SlotPolicyElement | undefined,
  candidate: SlotPolicyElement | undefined,
): SlotInsertAction {
  const rule = findRule(host);
  if (rule && candidate && rule.candidate(candidate)) {
    return { kind: rule.insert };
  }
  return { kind: "child" };
}

/**
 * ADR-240 Phase 2 — instance 안에서 새 노드 (팔레트 삽입 · Canvas drop) 를 mode C 로 받는 slot host: `slot` 배열이 있고
 * 목록 틀 · 그룹 규칙 (`SLOT_HOST_RULES` — 항목 instance 를 넣는 host) 이 아닌 것 = 이름 영역 · frame 가족 slot.
 */
export function isFreeContentSlotHost(host: SlotPolicyElement): boolean {
  return Array.isArray(host.slot) && !findRule(host);
}

export function isSlotHostElement(
  element: SlotPolicyElement | undefined,
): boolean {
  if (!element) return false;
  if (SLOT_HOST_RULES.some((rule) => rule.active(element))) return true;
  return FRAME_SLOT_HOST_TYPES.has(normalizeType(element.type));
}

export function isSlotCandidateAllowed(
  host: SlotPolicyElement | undefined,
  candidate: SlotPolicyElement | undefined,
): boolean {
  if (!host || !candidate) return false;
  const rule = findRule(host);
  if (!rule) return true;
  if (rule.placedChildren && candidate.reusable !== true) return true;
  return rule.candidate(candidate);
}

/**
 * ADR-237 — slot 계약 경고 대상 자식인가. 그룹의 Label · Toolbar Separator 처럼 항목이 아닌 자식은 추천 목록과
 * 대조하지 않는다 (Preview resolver `validateSlotContract`).
 */
export function isSlotContractItem(
  host: SlotPolicyElement | undefined,
  child: { type?: string; _resolvedFrom?: string },
): boolean {
  // ADR-240 — 이름 영역은 채운 reusable instance (해석된 ref) 만 대조한다.
  if (host && isNamedRegionHost(host)) {
    return typeof child._resolvedFrom === "string";
  }
  const itemTypes = findRule(host)?.itemTypes;
  return !itemTypes || itemTypes.has(String(child.type));
}

export function filterSlotCandidates<T extends SlotPolicyElement>(
  host: SlotPolicyElement | undefined,
  candidates: readonly T[],
): T[] {
  return candidates.filter(
    (candidate) =>
      candidate.reusable === true && isSlotCandidateAllowed(host, candidate),
  );
}
