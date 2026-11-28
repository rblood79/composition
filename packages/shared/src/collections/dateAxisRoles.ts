/**
 * ADR-323 Phase 1 — the date-axis roles (Decision 1 · breakdown §5.1): the one table Timeline ·
 * EventCalendar · Gantt read their binding's `fieldMap` from (R6 — a role's name does not differ
 * between the three). Values are field ids like every `fieldMap` role; `resolveDateAxisRoles` turns
 * them into row keys the way `resolveFieldRoles` does. Hierarchy stays the existing `children` ·
 * `parentId` roles.
 *
 * Dependency-free (no date library) — the panels may read it on the first screen. Reading the
 * values (`scheduleSpan.ts`) and the geometry (`@composition/rendering/schedule/*`) are not here.
 */
import type { DATA_FIELD_TYPES } from "../schemas/dataChange";
import { resolveField } from "./resolveBoundCollection";

export type DateAxisComponent = "Timeline" | "EventCalendar" | "Gantt";
type FieldType = (typeof DATA_FIELD_TYPES)[number];

export interface DateAxisRoleDef {
  /** The field types the role's picker offers. */
  readonly fieldTypes: readonly FieldType[];
  /** The components that read the role. */
  readonly components: readonly DateAxisComponent[];
}

/**
 * breakdown §5.1. `end` is exclusive (HC8); `color` is the color · status field (one value picks
 * the item's tone — Timeline's status, 사용자 결정 1); `resource` is EventCalendar's resource
 * (결정 2); `predecessors` is Gantt's predecessor keys (결정 6).
 */
export const DATE_AXIS_ROLES = {
  start: {
    fieldTypes: ["date"],
    components: ["Timeline", "EventCalendar", "Gantt"],
  },
  end: { fieldTypes: ["date"], components: ["EventCalendar", "Gantt"] },
  allDay: { fieldTypes: ["boolean"], components: ["EventCalendar"] },
  title: {
    fieldTypes: ["string"],
    components: ["Timeline", "EventCalendar", "Gantt"],
  },
  color: {
    fieldTypes: ["string"],
    components: ["Timeline", "EventCalendar", "Gantt"],
  },
  resource: {
    fieldTypes: ["string", "reference"],
    components: ["EventCalendar"],
  },
  progress: { fieldTypes: ["number"], components: ["Gantt"] },
  predecessors: { fieldTypes: ["array"], components: ["Gantt"] },
} as const satisfies Record<string, DateAxisRoleDef>;

export type DateAxisRole = keyof typeof DATE_AXIS_ROLES;

export const DATE_AXIS_ROLE_KEYS = Object.keys(
  DATE_AXIS_ROLES,
) as readonly DateAxisRole[];

/** The roles a component reads, in the table's order. */
export function dateAxisRolesOf(
  component: DateAxisComponent,
): readonly DateAxisRole[] {
  return DATE_AXIS_ROLE_KEYS.filter((role) =>
    (DATE_AXIS_ROLES[role].components as readonly string[]).includes(component),
  );
}

/** Whether a field of `type` may fill `role`. */
export function dateAxisRoleAccepts(
  role: DateAxisRole,
  type: string | undefined,
): boolean {
  return (DATE_AXIS_ROLES[role].fieldTypes as readonly string[]).includes(
    type ?? "",
  );
}

export type DateAxisFieldKeys = Partial<Record<DateAxisRole, string>>;

/**
 * A binding's date-axis roles as row keys (`fieldMap` id → the schema field's key; a value no field
 * has stays as is — a v1 key). Only `component`'s roles; undefined when none is set.
 */
export function resolveDateAxisRoles(
  fieldMap: Readonly<Record<string, unknown>> | undefined,
  schema: readonly { id?: string; key: string }[] | undefined,
  component: DateAxisComponent,
): DateAxisFieldKeys | undefined {
  if (!fieldMap) return undefined;
  const keys: DateAxisFieldKeys = {};
  let any = false;
  for (const role of dateAxisRolesOf(component)) {
    const ref = fieldMap[role];
    if (typeof ref !== "string" || ref.length === 0) continue;
    keys[role] = schema ? (resolveField(schema, ref)?.key ?? ref) : ref;
    any = true;
  }
  return any ? keys : undefined;
}
