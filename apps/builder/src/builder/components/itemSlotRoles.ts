/**
 * ADR-238 Phase 1 — 항목 안 역할 (icon · label · description · shortcut · avatar) 의 on/off 표면.
 *
 * - instance (Slot "+" 로 넣은 자기 자식 ref · 상속 항목의 synthetic 표면 · 상태 변형 ref): origin 의 역할 목록을
 *   보이고 optional 역할만 on/off — 쓰기 = 역할 자식 synthetic id (`<항목>/<역할 segment>`) 의 `enabled` (store 가
 *   바깥 instance 의 `descendants[path].enabled` 로 돌린다, ADR-229 U1 · 234 `enabled` 3값).
 * - origin (Components 페이지 항목 origin — ref 아님): 표에 있지만 자식이 없는 역할을 더한다 (GridListItem icon).
 *   새 역할 자식 = seed 와 같은 plain 모양 (`metadata.slotRole` · `optional: true`) · `slot` 은 RAC 가 받는 이름만.
 * - 필수 역할 (label) 은 끌 수 없다 (RAC 접근 가능한 이름).
 */
import {
  ITEM_SLOT_ROLE_TABLE,
  getSlotRole,
  resolveItemRoleSlotName,
  type CanonicalNode,
  type SlotRole,
} from "@composition/shared";

import { getCanonicalRefPathSegment } from "../../adapters/canonical/canonicalRefResolution";

export interface ItemRoleRow {
  role: SlotRole;
  required: boolean;
  /** 해석된 항목에서 이 역할 자식이 보이는가. */
  enabled: boolean;
  /** origin 에 역할 자식이 있는가 (없으면 origin 에서 더할 수 있다). */
  present: boolean;
  /** origin 역할 자식의 descendants segment (present 일 때). */
  segment: string | null;
}

export interface ItemRoleSurface {
  mode: "instance" | "origin";
  itemType: string;
  rows: ItemRoleRow[];
}

function roleChildren(
  nodes: readonly unknown[] | undefined,
): Map<SlotRole, unknown> {
  const map = new Map<SlotRole, unknown>();
  for (const node of nodes ?? []) {
    const role = getSlotRole(node);
    if (role && !map.has(role)) map.set(role, node);
  }
  return map;
}

/**
 * 항목의 역할 표면. `origin` = ref 체인 끝 항목 origin (type 이 표에 있어야 한다) · `resolvedChildren` = 해석된
 * 항목의 자식 (instance 면 `enabled: false` 인 역할은 해석기가 뺀다) · `isInstance` = 선택 노드가 ref / synthetic.
 */
export function buildItemRoleSurface(
  origin: CanonicalNode | undefined,
  resolvedChildren: readonly unknown[] | undefined,
  isInstance: boolean,
): ItemRoleSurface | null {
  const itemType = origin?.type;
  const specs = itemType ? ITEM_SLOT_ROLE_TABLE[itemType] : undefined;
  if (!origin || !itemType || !specs) return null;
  const originRoles = roleChildren(origin.children);
  const visible = roleChildren(isInstance ? resolvedChildren : origin.children);
  const rows = specs
    .map((spec): ItemRoleRow => {
      const child = originRoles.get(spec.role) as CanonicalNode | undefined;
      return {
        role: spec.role,
        required: spec.required === true,
        enabled: visible.has(spec.role),
        present: child !== undefined,
        segment: child ? getCanonicalRefPathSegment(child) : null,
      };
    })
    // instance 는 origin 에 있는 역할만 (없는 역할은 origin 에서 더한다).
    .filter((row) => !isInstance || row.present);
  return { mode: isInstance ? "instance" : "origin", itemType, rows };
}

/**
 * instance 역할 on/off 의 자식 갱신 — `updateSelectedPropertiesWithChildren({}, [..])` 가 받는 모양. 필수 역할 ·
 * origin 에 없는 역할은 null (끌 수 없다).
 */
export function planItemRoleToggle(
  itemId: string,
  surface: ItemRoleSurface,
  role: SlotRole,
  enabled: boolean,
): { elementId: string; props: { enabled: boolean } } | null {
  if (surface.mode !== "instance") return null;
  const row = surface.rows.find((entry) => entry.role === role);
  if (!row || !row.segment || (row.required && !enabled)) return null;
  return { elementId: `${itemId}/${row.segment}`, props: { enabled } };
}

const ROLE_CHILD_SHAPE: Partial<
  Record<
    SlotRole,
    { type: string; name: string; props: Record<string, unknown> }
  >
> = {
  icon: { type: "Icon", name: "Icon", props: { iconName: "{icon}" } },
  avatar: {
    type: "Avatar",
    name: "Avatar",
    props: { src: "{avatar}", alt: "" },
  },
  label: { type: "Text", name: "Label", props: { children: "{label}" } },
  description: {
    type: "Text",
    name: "Description",
    props: { children: "{description}" },
  },
  shortcut: {
    type: "Text",
    name: "Shortcut",
    props: { children: "{shortcut}" },
  },
};

/** seed 의 역할 자식 `metadata.type` (`*TemplateOrigins`). */
const ROLE_CHILD_METADATA_TYPE: Readonly<Record<string, string>> = {
  ListBoxItem: "listbox-item-slot",
  MenuItem: "menu-item-slot",
  GridListItem: "gridlist-item-slot",
  Tag: "tag-item-slot",
};

/** 역할 자식 표시 순서 = 표 순서 — 새 역할 자식을 넣을 index (origin 자식 배열 기준). */
function insertIndexFor(origin: CanonicalNode, role: SlotRole): number {
  const specs = ITEM_SLOT_ROLE_TABLE[origin.type] ?? [];
  const order = specs.map((spec) => spec.role);
  const target = order.indexOf(role);
  const children = origin.children ?? [];
  for (let i = 0; i < children.length; i += 1) {
    const childRole = getSlotRole(children[i]);
    if (childRole && order.indexOf(childRole) > target) return i;
  }
  return children.length;
}

/**
 * origin 에 없는 역할 자식 — seed (`*TemplateOrigins`) 와 같은 plain 모양. `slot` 은 RAC slot context 를 읽는
 * 자식 (Text) 이면 표의 RAC 이름만 (GridListItem label 은 싣지 않는다), Icon · Avatar 는 역할 이름 (CSS 훅).
 */
export function planItemRoleChild(
  origin: CanonicalNode,
  role: SlotRole,
): { node: CanonicalNode; index: number } | null {
  const specs = ITEM_SLOT_ROLE_TABLE[origin.type];
  const spec = specs?.find((entry) => entry.role === role);
  const shape = ROLE_CHILD_SHAPE[role];
  if (!spec || !shape) return null;
  if (roleChildren(origin.children).has(role)) return null;
  const slot = resolveItemRoleSlotName(origin.type, role, shape.type);
  const node = {
    id: `${origin.id}__${role}`,
    type: shape.type,
    name: shape.name,
    props: { ...(slot ? { slot } : {}), ...shape.props },
    metadata: {
      type: ROLE_CHILD_METADATA_TYPE[origin.type] ?? "item-slot",
      systemOwned: true,
      slotRole: role,
      ...(spec.required ? {} : { optional: true }),
    },
  } as unknown as CanonicalNode;
  return { node, index: insertIndexFor(origin, role) };
}
