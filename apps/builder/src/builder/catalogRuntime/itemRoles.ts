import {
  ITEM_SLOT_ROLE_TABLE,
  SLOT_ROLES,
  type SlotRole,
} from "@composition/shared";
import { setWholeField } from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import {
  definitionTypeName,
  type EditTarget,
} from "../../../../../packages/shared/src/catalog/commands/context";
import type { CatalogReader } from "../../../../../packages/shared/src/catalog/document/types";
import { readTargetProp } from "../../../../../packages/shared/src/catalog/resolution/fieldSource";
import {
  childPositions,
  type CatalogPosition,
} from "../../../../../packages/shared/src/catalog/resolution/positions";

/**
 * ADR-248 Phase 4e-4e: the roles inside a collection item (ADR-238 — icon · avatar · label ·
 * description · shortcut) over the catalog document. The item's role children are its positions
 * whose `slot` prop names a role; each optional role switches on and off with the child's
 * `enabled` (an owned child's own field, a template position's descendant patch). The label is
 * required (RAC's accessible name) and cannot be switched off.
 */
export interface CatalogItemRoleRow {
  role: SlotRole;
  required: boolean;
  enabled: boolean;
  target: EditTarget;
  /** Whether the child shows without the item's own `enabled` write (template positions). */
  inheritedEnabled: boolean;
}
export interface CatalogItemRoles {
  itemType: string;
  rows: CatalogItemRoleRow[];
}

const ROLES: ReadonlySet<string> = new Set(SLOT_ROLES);

function roleOf(reader: CatalogReader, target: EditTarget): SlotRole | null {
  let slot: unknown;
  try {
    slot = readTargetProp(reader, target, "slot");
  } catch {
    return null;
  }
  return typeof slot === "string" && ROLES.has(slot)
    ? (slot as SlotRole)
    : null;
}

/** The role rows of an item position (table order, roles the item has); null when not an item. */
export function catalogItemRoles(
  reader: CatalogReader,
  position: CatalogPosition,
): CatalogItemRoles | null {
  let itemType: string;
  try {
    itemType = definitionTypeName(reader, position.definitionId);
  } catch {
    return null;
  }
  const specs = ITEM_SLOT_ROLE_TABLE[itemType];
  if (!specs) return null;
  const byRole = new Map<SlotRole, CatalogPosition>();
  for (const child of childPositions(reader, position, {
    includeDisabled: true,
  })) {
    const role = roleOf(reader, child.target);
    if (role && !byRole.has(role)) byRole.set(role, child);
  }
  const rows = specs.flatMap((spec): CatalogItemRoleRow[] => {
    const child = byRole.get(spec.role);
    if (!child) return [];
    return [
      {
        role: spec.role,
        required: spec.required === true,
        enabled: child.disabled !== true,
        target: child.target,
        inheritedEnabled:
          child.target.kind === "node"
            ? true
            : child.inheritedEnabled !== false,
      },
    ];
  });
  return rows.length ? { itemType, rows } : null;
}

/**
 * Switch a role on or off: the write that makes the child show (or not) — cleared when the
 * inherited value already does, else explicit.
 */
export function catalogItemRoleCommand(
  row: CatalogItemRoleRow,
  enabled: boolean,
): CatalogCommand {
  return setWholeField({
    targets: [row.target],
    field: "enabled",
    value: enabled === row.inheritedEnabled ? undefined : enabled,
    label: enabled ? "Show item part" : "Hide item part",
  });
}
