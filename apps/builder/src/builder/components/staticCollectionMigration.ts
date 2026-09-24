/**
 * ADR-234 Phase 3 — 이관: 작성자가 채운 목록 (`items` 데이터) → 목록 틀의 항목 instance 자식.
 *
 * breakdown §4 Phase 3 계약:
 * - 목록 틀 = 항목을 직접 담는 노드 (Tabs 는 TabList). 정적 `items` 의 행 하나 = 항목 origin 의
 *   instance 자식 하나 (`type: "ref"` · `props.id` = 행 id — RAC key · TabPanel `itemId` 짝) · label 등은
 *   `descendants` (origin 의 label slot 자식 id).
 * - slot 은 목록 틀로 옮긴다 (값 = 항목 origin 추천 목록).
 * - 바인딩 목록 (`dataBinding`) 은 `items` + 템플릿 경로 그대로 — 이관하지 않는다.
 * - ref instance 가 자기 `items` 를 덮어쓴 경우: 목록 틀 경로에 descendants mode C (자식 교체) 로.
 *   그 경로에 이미 다른 patch 가 있으면 보류 (경고) — 부분 이관 없음.
 * - 항목 origin 이 문서에 없으면 그 목록은 보류 (다음 hydration 에서 origin 이 생기면 이관).
 * - 멱등: 이관을 지난 문서는 같은 객체 (재hydration Δ0).
 */
import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import { getElementDataBinding } from "@composition/shared";

import { getCanonicalRefPathSegment } from "../../adapters/canonical/canonicalRefResolution";
import { TAB_ITEM_DEFAULT_ORIGIN_ID } from "./tabs/tabsTemplateOrigins";
import { TAG_ITEM_DEFAULT_ORIGIN_ID } from "./taggroup/tagGroupTemplateOrigins";
import { LISTBOX_ITEM_DEFAULT_ORIGIN_ID } from "./listbox/listBoxTemplateOrigins";
import { GRIDLIST_ITEM_DEFAULT_ORIGIN_ID } from "./gridlist/gridListTemplateOrigins";
import { MENU_ITEM_DEFAULT_ORIGIN_ID } from "./menu/menuTemplateOrigins";
import { BREADCRUMB_ITEM_DEFAULT_ORIGIN_ID } from "./breadcrumbs/breadcrumbsTemplateOrigins";
import {
  TREE_ITEM_DEFAULT_ORIGIN_ID,
  treeItemSlotIds,
} from "./tree/treeTemplateOrigins";

type RefLike = CanonicalNode & {
  ref?: string;
  descendants?: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function indexNodes(
  document: CompositionDocument,
): Map<string, CanonicalNode> {
  const map = new Map<string, CanonicalNode>();
  const visit = (nodes: readonly CanonicalNode[] | undefined): void => {
    for (const node of nodes ?? []) {
      map.set(node.id, node);
      visit(node.children);
    }
  };
  visit(document.children);
  return map;
}

/** ref 체인 끝 (origin). 순환 · 깊이 초과 · 누락이면 undefined. */
export function resolveChainEnd(
  id: string | undefined,
  byId: ReadonlyMap<string, CanonicalNode>,
): CanonicalNode | undefined {
  let current = id ? byId.get(id) : undefined;
  for (let depth = 0; current?.type === "ref"; depth += 1) {
    if (depth >= 8) return undefined;
    current = byId.get((current as RefLike).ref ?? "");
  }
  return current;
}

/** 정적 목록인가 — 바인딩 목록은 `items` + 템플릿 경로 그대로 (breakdown §1-3). */
function isBoundCollection(node: CanonicalNode): boolean {
  return (
    getElementDataBinding(
      node as unknown as Parameters<typeof getElementDataBinding>[0],
    ) != null ||
    (node.props as Record<string, unknown> | undefined)?.columnMapping != null
  );
}

function readItems(
  props: Record<string, unknown> | undefined,
): Array<Record<string, unknown>> | null {
  const items = props?.items;
  if (!Array.isArray(items)) return null;
  return items.filter(isRecord);
}

function omitKey(
  props: Record<string, unknown> | undefined,
  key: string,
): Record<string, unknown> {
  const next = { ...(props ?? {}) };
  delete next[key];
  return next;
}

/** slot 추천 목록에서 항목 origin (ref 가 아닌 노드 · 체인 끝) — 없으면 fallback 상수. */
export function pickItemOriginId(
  slot: unknown,
  byId: ReadonlyMap<string, CanonicalNode>,
  fallback: string,
): string | null {
  if (Array.isArray(slot)) {
    for (const entry of slot) {
      if (typeof entry !== "string") continue;
      const node = byId.get(entry);
      if (node && node.type !== "ref") return node.id;
    }
    for (const entry of slot) {
      if (typeof entry !== "string") continue;
      const end = resolveChainEnd(entry, byId);
      if (end) return end.id;
    }
  }
  return byId.has(fallback) ? fallback : null;
}

function uniqueId(base: string, taken: Set<string>): string {
  let id = base;
  for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`;
  taken.add(id);
  return id;
}

// ───────────────────────────── 가족 표 ─────────────────────────────

/** origin 의 slot 역할 자식 (`metadata.slotRole` · `props.slot`) 의 descendants 키 (segment). */
function findSlotChildKey(origin: CanonicalNode, role: string): string | null {
  const child = (origin.children ?? []).find(
    (c) =>
      (c.metadata as Record<string, unknown> | undefined)?.slotRole === role ||
      (c.props as Record<string, unknown> | undefined)?.slot === role,
  );
  return child ? getCanonicalRefPathSegment(child) : null;
}

/**
 * origin id 필드는 getter — 이 모듈은 항목 origin 모듈과 순환 import 안이라 (listBoxTemplateOrigins → … →
 * reusableCompositeOrigins → 여기) 가족 객체를 만들 때 상수를 복사하면 진입 순서에 따라 undefined 로 굳는다
 * (ADR-238 Phase 2 실측 — 새 프로젝트 경로). getter 는 접근 시점에 live binding 을 읽는다.
 *
 * 정적 목록 가족 — owner (items 보유) · 목록 틀 (항목 자식을 담는 노드) · 항목 origin 기본 id · 행 →
 * 항목 instance 의 props / descendants.
 */
export interface StaticCollectionFamily {
  ownerType: string;
  /** 항목을 직접 담는 목록 틀 type — `null` 이면 owner 자신 (ListBox · GridList). */
  listType: string | null;
  itemType: string;
  itemPrefix: string;
  defaultOriginId: string;
  /** Components 페이지 origin 에 slot 이 없을 때 싣는 추천 목록 (기본 `[defaultOriginId]`). */
  originSlot?: readonly string[];
  /** ADR-238 Phase 2 — section 층 type (RAC `ListBoxSection` …). 있으면 section · separator 행도 이관한다. */
  sectionType?: string;
  /** ADR-238 Phase 2 — section 사이 `Separator` 행을 허용하는가 (Menu). */
  allowsSeparators?: boolean;
  /**
   * ADR-238 Phase 3 — owner 가 항목 외 sub-part 자식 (Label · SelectTrigger …) 을 갖는 목록 틀 (Select · ComboBox).
   * 이관 여부는 항목 · section 자식으로 판정하고, 항목 자식은 sub-part 뒤에 붙는다.
   */
  ownerKeepsSubparts?: boolean;
  /** ADR-238 Phase 3 — Slot "+" 가 선택 모양 후보를 넣어도 owner 선택 key 를 쓰지 않는다 (Select · ComboBox). */
  skipsSelectionOnInsert?: boolean;
  /**
   * ADR-239 Phase 1 — 항목 안 항목 (Tree 의 TreeItem). 항목 자신도 목록 틀이다 — Slot "+" host 가 항목이면 그 자식으로
   * 넣는다 (선택 key 는 쓰지 않는다 — 선택 owner 는 조상 Tree 이고 새 항목 key 는 부모 key 접두라 host 가 모른다).
   */
  recursiveItems?: boolean;
  /**
   * ADR-239 Phase 3 — 행의 `children` (하위 메뉴) 를 항목 instance 의 자식 항목으로 옮긴다 (Menu). 없으면 하위 메뉴
   * 행이 있는 목록은 이관하지 않는다.
   */
  allowsSubmenus?: boolean;
  buildItem(
    item: Record<string, unknown>,
    origin: CanonicalNode,
  ): { props: Record<string, unknown>; descendants: Record<string, unknown> };
}

function labelDescendant(
  origin: CanonicalNode,
  text: unknown,
): Record<string, unknown> {
  const key = findSlotChildKey(origin, "label");
  return key ? { [key]: { children: String(text ?? "") } } : {};
}

export const TABS_STATIC_FAMILY: StaticCollectionFamily = {
  ownerType: "Tabs",
  listType: "TabList",
  itemType: "Tab",
  itemPrefix: "tab",
  get defaultOriginId() {
    return TAB_ITEM_DEFAULT_ORIGIN_ID;
  },
  buildItem(item, origin) {
    return {
      props: item.isDisabled === true ? { isDisabled: true } : {},
      descendants: labelDescendant(
        origin,
        item.title ?? item.label ?? item.textValue,
      ),
    };
  },
};

export const TAGGROUP_STATIC_FAMILY: StaticCollectionFamily = {
  ownerType: "TagGroup",
  listType: "TagList",
  itemType: "Tag",
  itemPrefix: "tag",
  get defaultOriginId() {
    return TAG_ITEM_DEFAULT_ORIGIN_ID;
  },
  buildItem(item, origin) {
    const descendants: Record<string, unknown> = labelDescendant(
      origin,
      item.label ?? item.textValue ?? item.title,
    );
    // leading slot 은 행에 값이 있을 때만 (projection 의 존재 gating 과 같은 결과) — 없으면 숨김.
    const icon = findSlotChildKey(origin, "icon");
    if (icon) {
      descendants[icon] =
        typeof item.icon === "string" && item.icon
          ? { iconName: item.icon }
          : { enabled: false };
    }
    const avatar = findSlotChildKey(origin, "avatar");
    if (avatar) {
      descendants[avatar] =
        typeof item.avatar === "string" && item.avatar
          ? { src: item.avatar }
          : { enabled: false };
    }
    return {
      props: {
        ...(item.isDisabled === true ? { isDisabled: true } : {}),
        ...(item.allowsRemoving === true ? { allowsRemoving: true } : {}),
      },
      descendants,
    };
  },
};

/** 행 값이 있으면 그 patch, 없으면 숨김 (projection 의 슬롯 존재 gating 과 같은 결과). */
function optionalSlotDescendant(
  origin: CanonicalNode,
  role: string,
  value: unknown,
  toPatch: (text: string) => Record<string, unknown>,
): Record<string, unknown> {
  const key = findSlotChildKey(origin, role);
  if (!key) return {};
  return {
    [key]:
      typeof value === "string" && value ? toPatch(value) : { enabled: false },
  };
}

export const LISTBOX_STATIC_FAMILY: StaticCollectionFamily = {
  ownerType: "ListBox",
  listType: null,
  itemType: "ListBoxItem",
  itemPrefix: "item",
  get defaultOriginId() {
    return LISTBOX_ITEM_DEFAULT_ORIGIN_ID;
  },
  sectionType: "ListBoxSection",
  buildItem(item, origin) {
    return {
      props: {
        ...(item.isDisabled === true ? { isDisabled: true } : {}),
        ...(typeof item.href === "string" && item.href
          ? { href: item.href }
          : {}),
      },
      descendants: {
        ...optionalSlotDescendant(origin, "icon", item.icon, (iconName) => ({
          iconName,
        })),
        ...labelDescendant(origin, item.label ?? item.textValue ?? item.title),
        ...optionalSlotDescendant(
          origin,
          "description",
          item.description,
          (children) => ({ children }),
        ),
      },
    };
  },
};

export const GRIDLIST_STATIC_FAMILY: StaticCollectionFamily = {
  ownerType: "GridList",
  listType: null,
  itemType: "GridListItem",
  itemPrefix: "item",
  get defaultOriginId() {
    return GRIDLIST_ITEM_DEFAULT_ORIGIN_ID;
  },
  sectionType: "GridListSection",
  buildItem(item, origin) {
    return {
      props: item.isDisabled === true ? { isDisabled: true } : {},
      descendants: {
        ...labelDescendant(origin, item.label ?? item.textValue ?? item.title),
        ...optionalSlotDescendant(
          origin,
          "description",
          item.description,
          (children) => ({ children }),
        ),
      },
    };
  },
};

/** Menu — 항목은 popover 안 (Canvas 는 트리거만). 행 → icon · label · shortcut · description · 링크. */
export const MENU_STATIC_FAMILY: StaticCollectionFamily = {
  ownerType: "Menu",
  listType: null,
  itemType: "MenuItem",
  itemPrefix: "item",
  get defaultOriginId() {
    return MENU_ITEM_DEFAULT_ORIGIN_ID;
  },
  sectionType: "MenuSection",
  allowsSeparators: true,
  // ADR-239 Phase 3 — MenuItem instance 의 자식 MenuItem = 하위 메뉴. Slot "+" 가 MenuItem host 에도 넣는다.
  allowsSubmenus: true,
  recursiveItems: true,
  buildItem(item, origin) {
    return {
      props: {
        ...(item.isDisabled === true ? { isDisabled: true } : {}),
        ...(typeof item.href === "string" && item.href
          ? { href: item.href }
          : {}),
      },
      descendants: {
        ...optionalSlotDescendant(origin, "icon", item.icon, (iconName) => ({
          iconName,
        })),
        ...labelDescendant(origin, item.label ?? item.textValue ?? item.title),
        ...optionalSlotDescendant(
          origin,
          "shortcut",
          item.shortcut,
          (children) => ({ children }),
        ),
        ...optionalSlotDescendant(
          origin,
          "description",
          item.description,
          (children) => ({ children }),
        ),
      },
    };
  },
};

/**
 * ADR-237 Phase 3 — Breadcrumbs (목록 틀 = owner). 행 (`StoredBreadcrumbItem` — id · label · href) → Breadcrumb
 * instance 의 `children` · `href`. slot 은 [항목 origin, 현재 변형].
 */
export const BREADCRUMBS_STATIC_FAMILY: StaticCollectionFamily = {
  ownerType: "Breadcrumbs",
  listType: null,
  itemType: "Breadcrumb",
  itemPrefix: "item",
  get defaultOriginId() {
    return BREADCRUMB_ITEM_DEFAULT_ORIGIN_ID;
  },
  get originSlot() {
    return [
      BREADCRUMB_ITEM_DEFAULT_ORIGIN_ID,
      `${BREADCRUMB_ITEM_DEFAULT_ORIGIN_ID}--current`,
    ];
  },
  buildItem(item) {
    const label = item.label ?? item.textValue ?? item.title ?? item.name;
    return {
      props: {
        children: String(label ?? ""),
        // 행에 href 가 없으면 (현재 페이지) 빈 값 — origin 의 링크 href 를 상속하지 않는다.
        href: typeof item.href === "string" ? item.href : null,
        ...(item.isDisabled === true ? { isDisabled: true } : {}),
      },
      descendants: {},
    };
  },
};

/** ADR-238 Phase 3 — Select · ComboBox 행 → ListBoxItem instance (id · value · 명시 textValue · icon/label/description). */
function buildPickerItem(
  item: Record<string, unknown>,
  origin: CanonicalNode,
): ReturnType<StaticCollectionFamily["buildItem"]> {
  const listBox = LISTBOX_STATIC_FAMILY.buildItem(item, origin);
  return {
    ...listBox,
    props: {
      ...listBox.props,
      // 행 `value` (업무 값) → 항목 `value` — writeback `selectedValue` 가 이 값을 읽는다 (행 id 와 다르다).
      ...(item.value !== undefined ? { value: item.value } : {}),
      // 검색어는 명시값만 (없으면 renderer 가 label 글자 — 이관 전 `textValue ?? label` 과 같은 우선순위).
      ...(typeof item.textValue === "string" && item.textValue !== ""
        ? { textValue: item.textValue }
        : {}),
    },
  };
}

const PICKER_ORIGIN_SLOT_IDS = (): string[] => [
  `${LISTBOX_ITEM_DEFAULT_ORIGIN_ID}--unselected`,
  LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
  "component-listbox-section",
];

export const SELECT_STATIC_FAMILY: StaticCollectionFamily = {
  ownerType: "Select",
  listType: null,
  itemType: "ListBoxItem",
  itemPrefix: "item",
  get defaultOriginId() {
    return LISTBOX_ITEM_DEFAULT_ORIGIN_ID;
  },
  get originSlot() {
    return PICKER_ORIGIN_SLOT_IDS();
  },
  sectionType: "ListBoxSection",
  ownerKeepsSubparts: true,
  skipsSelectionOnInsert: true,
  buildItem: buildPickerItem,
};

export const COMBOBOX_STATIC_FAMILY: StaticCollectionFamily = {
  ...SELECT_STATIC_FAMILY,
  ownerType: "ComboBox",
  get defaultOriginId() {
    return LISTBOX_ITEM_DEFAULT_ORIGIN_ID;
  },
  get originSlot() {
    return PICKER_ORIGIN_SLOT_IDS();
  },
};

/**
 * ADR-239 Phase 1 — Tree (목록 틀 = owner, 항목 = TreeItem instance · 항목 안 항목). Tree 는 `items` 가 아니라 TreeItem
 * 요소라 행 이관은 `migrateTreeItemsToInstances` 가 맡는다 — 이 가족은 Slot "+" 삽입 (`buildItem` 은 새 행 하나) 용.
 */
export const TREE_STATIC_FAMILY: StaticCollectionFamily = {
  ownerType: "Tree",
  listType: null,
  itemType: "TreeItem",
  itemPrefix: "item",
  get defaultOriginId() {
    return TREE_ITEM_DEFAULT_ORIGIN_ID;
  },
  get originSlot() {
    return treeItemSlotIds();
  },
  recursiveItems: true,
  buildItem(item, origin) {
    return {
      props: item.isDisabled === true ? { isDisabled: true } : {},
      descendants: labelDescendant(
        origin,
        item.label ?? item.textValue ?? item.title,
      ),
    };
  },
};

export const STATIC_COLLECTION_FAMILIES: readonly StaticCollectionFamily[] = [
  TABS_STATIC_FAMILY,
  TAGGROUP_STATIC_FAMILY,
  LISTBOX_STATIC_FAMILY,
  GRIDLIST_STATIC_FAMILY,
  MENU_STATIC_FAMILY,
  BREADCRUMBS_STATIC_FAMILY,
  SELECT_STATIC_FAMILY,
  COMBOBOX_STATIC_FAMILY,
  TREE_STATIC_FAMILY,
];

/** 목록 틀 — `listType` 자식, `null` 이면 owner 자신. */
function findListFrame(
  family: StaticCollectionFamily,
  owner: CanonicalNode,
): CanonicalNode | undefined {
  if (family.listType === null) return owner;
  return (owner.children ?? []).find((child) => child.type === family.listType);
}

/** 하위 메뉴 행 (`children`) — 평면 항목으로 옮길 수 없다 (범위 밖, Menu SubmenuTrigger). */
function hasSubmenu(item: Record<string, unknown>): boolean {
  return Array.isArray(item.children) && item.children.length > 0;
}

/**
 * 이관하지 않는 행 모양. section 층이 있는 가족 (ListBox · GridList · Menu, ADR-238) 은 section (안쪽은 평면 항목만) ·
 * Menu separator 를 옮기고, 하위 메뉴 행만 건너뛴다. section 층이 없는 가족은 종전대로 section · separator 도 건너뛴다.
 */
function hasUnsupportedRows(
  family: StaticCollectionFamily,
  items: ReadonlyArray<Record<string, unknown>>,
): boolean {
  // ADR-239 Phase 3 — 하위 메뉴 행은 `allowsSubmenus` 가족 (Menu) 이면 중첩 항목으로 옮긴다.
  const unsupportedSubmenu = (row: Record<string, unknown>): boolean =>
    hasSubmenu(row) &&
    (!family.allowsSubmenus ||
      (row.children as unknown[]).some(
        (child) =>
          !isRecord(child) ||
          child.type === "section" ||
          child.type === "separator" ||
          unsupportedSubmenu(child),
      ));
  return items.some((item) => {
    if (unsupportedSubmenu(item)) return true;
    if (item.type === "section") {
      if (!family.sectionType) return true;
      const inner = Array.isArray(item.items) ? item.items : [];
      return inner.some(
        (row) =>
          !isRecord(row) ||
          row.type === "section" ||
          row.type === "separator" ||
          unsupportedSubmenu(row),
      );
    }
    if (item.type === "separator") return !family.allowsSeparators;
    return false;
  });
}

/** Menu section 의 per-section 선택 필드 · aria-label — section 노드 props 로 그대로 (F6). */
const SECTION_ROW_PROP_KEYS = [
  "selectionMode",
  "selectedKeys",
  "defaultSelectedKeys",
  "disallowEmptySelection",
] as const;

/**
 * ADR-238 Phase 2 — 행 목록 → 목록 틀 자식: 평면 행 = 항목 instance · section 행 = section 노드 (Header + 항목
 * instance) · separator 행 = `Separator`. section 이 없으면 `buildItemInstances` 와 같은 결과.
 */
export function buildCollectionEntries(
  family: StaticCollectionFamily,
  items: ReadonlyArray<Record<string, unknown>>,
  idPrefix: string,
  origin: CanonicalNode,
  taken: Set<string>,
  startIndex = 0,
): CanonicalNode[] {
  if (!family.sectionType) {
    return buildItemInstances(family, items, idPrefix, origin, taken, startIndex);
  }
  const out: CanonicalNode[] = [];
  let itemIndex = startIndex;
  let sectionIndex = 0;
  let separatorIndex = 0;
  for (const row of items) {
    if (row.type === "section") {
      sectionIndex += 1;
      const sectionId = uniqueId(`${idPrefix}__section-${sectionIndex}`, taken);
      const header = typeof row.header === "string" ? row.header : "";
      const rows = (Array.isArray(row.items) ? row.items : []).filter(isRecord);
      const props: Record<string, unknown> = {
        ...(row.id !== undefined ? { id: String(row.id) } : {}),
        ...(typeof row.ariaLabel === "string" && row.ariaLabel
          ? { "aria-label": row.ariaLabel }
          : {}),
      };
      for (const key of SECTION_ROW_PROP_KEYS) {
        if (row[key] !== undefined) props[key] = row[key];
      }
      out.push({
        id: sectionId,
        type: family.sectionType,
        props,
        children: [
          ...(header
            ? [
                {
                  id: uniqueId(`${sectionId}__header`, taken),
                  type: "Header",
                  props: { children: header },
                } as CanonicalNode,
              ]
            : []),
          ...buildItemInstances(family, rows, sectionId, origin, taken),
        ],
      } as CanonicalNode);
      continue;
    }
    if (row.type === "separator") {
      separatorIndex += 1;
      out.push({
        id: uniqueId(`${idPrefix}__separator-${separatorIndex}`, taken),
        type: "Separator",
        props: {},
      } as CanonicalNode);
      continue;
    }
    out.push(
      ...buildItemInstances(family, [row], idPrefix, origin, taken, itemIndex),
    );
    itemIndex += 1;
  }
  return out;
}

/** 행 → 항목 instance 자식 (`props.id` = 행 id — RAC key). */
export function buildItemInstances(
  family: StaticCollectionFamily,
  items: ReadonlyArray<Record<string, unknown>>,
  idPrefix: string,
  origin: CanonicalNode,
  taken: Set<string>,
  /** 새 항목의 번호 시작 (Slot "+" 는 기존 항목 수 — id `__<prefix>-<n>`). */
  startIndex = 0,
  /**
   * ADR-239 Phase 3 — 하위 메뉴 행의 id 없는 자식 key = `<부모 행 id>-<index>` (items 경로 `Menu.tsx` 의
   * `${item.id}-${childIndex}` 와 같다). 최상위는 종전 `<idPrefix>-<n>`.
   */
  submenuParentKey?: string,
): CanonicalNode[] {
  return items.map((item, offset) => {
    const index = startIndex + offset;
    const built = family.buildItem(item, origin);
    const id = uniqueId(`${idPrefix}__${family.itemPrefix}-${index + 1}`, taken);
    const key = String(
      item.id ??
        (submenuParentKey !== undefined
          ? `${submenuParentKey}-${offset}`
          : `${idPrefix}-${index + 1}`),
    );
    const submenuRows =
      family.allowsSubmenus && Array.isArray(item.children)
        ? item.children.filter(isRecord)
        : [];
    return {
      id,
      type: "ref",
      ref: origin.id,
      props: {
        id: key,
        ...built.props,
      },
      ...(Object.keys(built.descendants).length > 0
        ? { descendants: built.descendants }
        : {}),
      ...(submenuRows.length > 0
        ? {
            children: buildItemInstances(
              family,
              submenuRows,
              id,
              origin,
              taken,
              0,
              key,
            ),
          }
        : {}),
    } as unknown as CanonicalNode;
  });
}

/** plain owner (origin 포함) — 목록 틀에 항목 instance 자식 · items 제거 · slot 을 목록 틀로. */
function migratePlainOwner(
  family: StaticCollectionFamily,
  owner: CanonicalNode,
  byId: ReadonlyMap<string, CanonicalNode>,
  taken: Set<string>,
): CanonicalNode | null {
  if (isBoundCollection(owner)) return null;
  if (family.listType === null) {
    return migrateSelfListOwner(family, owner, byId, taken);
  }
  const children = owner.children ?? [];
  const listIndex = children.findIndex(
    (child) => child.type === family.listType,
  );
  if (listIndex < 0) return null;
  const list = children[listIndex]!;
  const ownerProps = (owner.props ?? {}) as Record<string, unknown>;
  const listProps = (list.props ?? {}) as Record<string, unknown>;
  const hasStaticChildren = (list.children ?? []).length > 0;
  const items = readItems(ownerProps) ?? readItems(listProps);
  const rootSlot = Array.isArray(owner.slot) ? owner.slot : undefined;
  const needsConversion = !hasStaticChildren && items !== null;
  if (!needsConversion && !rootSlot) return null;

  let nextListChildren = list.children;
  if (needsConversion && items.length > 0) {
    const originId = pickItemOriginId(
      list.slot ?? rootSlot,
      byId,
      family.defaultOriginId,
    );
    const origin = originId ? byId.get(originId) : undefined;
    if (!origin) return null; // 보류 — origin 이 생기면 다음 hydration 에서.
    nextListChildren = buildItemInstances(
      family,
      items,
      list.id,
      origin,
      taken,
    );
  }

  const nextList: CanonicalNode = {
    ...list,
    ...(needsConversion ? { props: omitKey(listProps, "items") } : {}),
    ...(nextListChildren ? { children: nextListChildren } : {}),
    ...(rootSlot && !Array.isArray(list.slot) ? { slot: rootSlot } : {}),
  };
  const { slot: _movedSlot, ...ownerWithoutSlot } = owner;
  const nextChildren = [...children];
  nextChildren[listIndex] = nextList;
  return {
    ...(rootSlot ? ownerWithoutSlot : owner),
    ...(needsConversion ? { props: omitKey(ownerProps, "items") } : {}),
    children: nextChildren,
  } as CanonicalNode;
}

/**
 * 목록 틀 (owner 자신) 에 이미 정적 항목이 있나 — sub-part 를 갖는 가족 (Select · ComboBox) 은 항목 · section 자식만
 * 센다 (Label · SelectTrigger 는 항목이 아니다). 그 밖의 가족은 종전대로 자식이 하나라도 있으면.
 */
function hasListChildren(
  family: StaticCollectionFamily,
  owner: CanonicalNode,
  byId: ReadonlyMap<string, CanonicalNode>,
): boolean {
  const children = owner.children ?? [];
  if (!family.ownerKeepsSubparts) return children.length > 0;
  return children.some((child) => {
    const type =
      child.type === "ref" ? resolveChainEnd(child.id, byId)?.type : child.type;
    return type === family.itemType || type === family.sectionType;
  });
}

/**
 * owner 가 곧 목록 틀 (ListBox · GridList) — 자기 자식으로 항목 instance · items 제거 · slot 은 그대로 (이미 목록
 * 틀에 있다). 자식이 이미 있으면 (정적 자식 · 템플릿 anchor) 손대지 않는다.
 */
function migrateSelfListOwner(
  family: StaticCollectionFamily,
  owner: CanonicalNode,
  byId: ReadonlyMap<string, CanonicalNode>,
  taken: Set<string>,
): CanonicalNode | null {
  const props = (owner.props ?? {}) as Record<string, unknown>;
  const items = readItems(props);
  if (items === null || hasListChildren(family, owner, byId)) return null;
  if (hasUnsupportedRows(family, items)) return null;
  let children: CanonicalNode[] | undefined;
  if (items.length > 0) {
    const originId = pickItemOriginId(owner.slot, byId, family.defaultOriginId);
    const origin = originId ? byId.get(originId) : undefined;
    if (!origin) return null; // 보류 — origin 이 생기면 다음 hydration 에서.
    children = [
      // Select · ComboBox — sub-part (Label · SelectTrigger …) 는 그대로 두고 항목을 뒤에 붙인다.
      ...(family.ownerKeepsSubparts ? (owner.children ?? []) : []),
      ...buildCollectionEntries(family, items, owner.id, origin, taken),
    ];
  }
  return {
    ...owner,
    props: omitKey(props, "items"),
    ...(children ? { children } : {}),
    // Components 페이지 origin 에 slot 이 없던 가족 (Menu) — 항목 origin 추천 목록을 싣는다 (Slot "+").
    ...(owner.reusable === true && owner.slot === undefined
      ? { slot: [...(family.originSlot ?? [family.defaultOriginId])] }
      : {}),
  } as CanonicalNode;
}

/**
 * owner 자신이 목록 틀 (ListBox) 인 instance 의 `items` override — descendants 는 자손 경로만 바꾸므로 root
 * 자식 교체 대신 (1) origin 항목 자식을 `enabled: false` 로 숨기고 (2) 행을 instance 자기 자식 (origin 자식
 * 뒤에 덧붙는 인스턴스 자식 — 두 leg 공통 의미) 으로 싣는다. origin 이 아직 이관 전 (자식 없음) 이면 보류.
 */
function migrateSelfListInstance(
  family: StaticCollectionFamily,
  instance: RefLike,
  master: CanonicalNode,
  items: ReadonlyArray<Record<string, unknown>>,
  byId: ReadonlyMap<string, CanonicalNode>,
  taken: Set<string>,
): CanonicalNode | null {
  const originItems = (master.children ?? []).filter(
    (child) => resolveChainEnd(child.id, byId)?.type === family.itemType,
  );
  if (
    !hasListChildren(family, master, byId) &&
    readItems(master.props as Record<string, unknown>)
  ) {
    return null;
  }
  const originId = pickItemOriginId(master.slot, byId, family.defaultOriginId);
  const origin = originId ? byId.get(originId) : undefined;
  if (!origin) return null;
  const descendants: Record<string, unknown> = {
    ...(instance.descendants ?? {}),
  };
  for (const child of originItems) {
    const key = getCanonicalRefPathSegment(child);
    descendants[key] = {
      ...((descendants[key] as Record<string, unknown>) ?? {}),
      enabled: false,
    };
  }
  const props = (instance.props ?? {}) as Record<string, unknown>;
  return {
    ...instance,
    props: omitKey(props, "items"),
    ...(Object.keys(descendants).length > 0 ? { descendants } : {}),
    children: [
      ...(instance.children ?? []),
      ...buildCollectionEntries(family, items, instance.id, origin, taken),
    ],
  } as CanonicalNode;
}

/** owner ref instance 가 자기 `items` 를 덮어쓴 경우 → 목록 틀 경로 descendants mode C. */
function migrateOwnerInstance(
  instance: RefLike,
  byId: ReadonlyMap<string, CanonicalNode>,
  taken: Set<string>,
  held: string[],
): CanonicalNode | null {
  const props = (instance.props ?? {}) as Record<string, unknown>;
  const items = readItems(props);
  if (items === null || isBoundCollection(instance)) return null;
  const master = resolveChainEnd(instance.ref, byId);
  const family = STATIC_COLLECTION_FAMILIES.find(
    (f) => f.ownerType === master?.type,
  );
  if (!master || !family) return null;
  if (hasUnsupportedRows(family, items)) return null;
  if (family.listType === null) {
    return migrateSelfListInstance(
      family,
      instance,
      master,
      items,
      byId,
      taken,
    );
  }
  const list = findListFrame(family, master);
  if (!list) return null;
  const listPath = getCanonicalRefPathSegment(list);
  if (instance.descendants?.[listPath] !== undefined) {
    held.push(`${instance.id}: descendants["${listPath}"] 이미 있음`);
    return null;
  }
  const originId = pickItemOriginId(
    list.slot ?? master.slot,
    byId,
    family.defaultOriginId,
  );
  const origin = originId ? byId.get(originId) : undefined;
  if (!origin) return null;
  return {
    ...instance,
    props: omitKey(props, "items"),
    descendants: {
      ...(instance.descendants ?? {}),
      [listPath]: {
        children: buildItemInstances(family, items, instance.id, origin, taken),
      },
    },
  } as CanonicalNode;
}

// ───────────────────────────── 문서 ─────────────────────────────

export function migrateStaticCollectionsToInstances(
  document: CompositionDocument,
): CompositionDocument {
  const byId = indexNodes(document);
  const taken = new Set(byId.keys());
  const held: string[] = [];

  const mapTree = (
    doc: CompositionDocument,
    step: (node: CanonicalNode) => CanonicalNode | null,
  ): CompositionDocument => {
    const visit = (node: CanonicalNode): CanonicalNode => {
      let next = node;
      if (node.children) {
        let changed = false;
        const children = node.children.map((child) => {
          const visited = visit(child);
          if (visited !== child) changed = true;
          return visited;
        });
        if (changed) next = { ...node, children };
      }
      return step(next) ?? next;
    };
    let changed = false;
    const children = doc.children.map((child) => {
      const visited = visit(child);
      if (visited !== child) changed = true;
      return visited;
    });
    return changed ? { ...doc, children } : doc;
  };

  // 1단계 plain owner (origin 포함) → 2단계 instance: instance 이관은 이관을 마친 origin 의 항목 자식을 읽는다
  //   (ListBox instance 는 origin 항목을 숨기는 descendants 를 쓴다).
  const plainDone = mapTree(document, (node) => {
    const family = STATIC_COLLECTION_FAMILIES.find(
      (f) => f.ownerType === node.type,
    );
    return family ? migratePlainOwner(family, node, byId, taken) : null;
  });
  const byIdAfterPlain = plainDone === document ? byId : indexNodes(plainDone);
  const result = mapTree(plainDone, (node) =>
    node.type === "ref"
      ? migrateOwnerInstance(node as RefLike, byIdAfterPlain, taken, held)
      : null,
  );
  if (held.length > 0) {
    console.warn("[ADR-234] 정적 목록 이관 보류", held);
  }
  return result;
}

/**
 * ADR-234 Phase 3 — 이 노드가 **작성자가 채운 목록** (목록 틀에 항목 instance 자식) 의 owner 인가. Properties 의
 * items 편집기 (items-manager) 는 바인딩 목록 전용이 된다 — 정적 목록에 `items` 를 다시 쓰면 두 목록이 겹친다.
 * ref instance 는 체인 끝 origin 의 목록 틀 (instance 가 그 경로를 mode C 로 채웠어도 정적).
 */
export function isStaticCollectionOwner(
  document: CompositionDocument,
  nodeId: string,
): boolean {
  const byId = indexNodes(document);
  const node = byId.get(nodeId);
  if (!node || isBoundCollection(node)) return false;
  // instance 가 자기 `items` 를 덮어쓴 목록 (이관 보류 — 그 행이 정본) 은 items 편집기로.
  if (node.type === "ref" && readItems(node.props as Record<string, unknown>)) {
    return false;
  }
  const master = node.type === "ref" ? resolveChainEnd(nodeId, byId) : node;
  const family = STATIC_COLLECTION_FAMILIES.find(
    (f) => f.ownerType === master?.type,
  );
  if (!master || !family) return false;
  if (master !== node && isBoundCollection(master)) return false;
  // 정적 목록의 항목 정본은 목록 틀 자식이다 — 자식이 0 이어도 (항목을 다 지움) 정적 (사용자 지적 2026-09-23:
  //   빈 TagGroup 에 "Add Tag" 가 떠 root `items` 로 되돌아갔다). 편집기는 아직 이관되지 않은 `items`
  //   (origin 누락으로 보류) 가 정본일 때만.
  const list = findListFrame(family, master);
  const hasItemChildren = list
    ? family.listType === null
      ? hasListChildren(family, list, byId)
      : (list.children ?? []).length > 0
    : false;
  return (
    hasItemChildren ||
    (!readItems(master.props as Record<string, unknown>) &&
      !readItems(list?.props as Record<string, unknown> | undefined))
  );
}
