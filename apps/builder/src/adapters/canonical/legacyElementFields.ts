import type { Element } from "@/types/builder/unified.types";

export const LEGACY_COMPONENT_ROLE_FIELD = "componentRole" as const;
export const LEGACY_MASTER_ID_FIELD = "masterId" as const;
export const LEGACY_OVERRIDES_FIELD = "overrides" as const;
export const LEGACY_DESCENDANTS_FIELD = "descendants" as const;
export const LEGACY_LAYOUT_ID_FIELD = "layout_id" as const;
export const LEGACY_SLOT_NAME_FIELD = "slot_name" as const;

export type LegacyComponentRole = "master" | "instance";

export type LegacyElementMirrorFields = {
  [LEGACY_COMPONENT_ROLE_FIELD]?: LegacyComponentRole;
  [LEGACY_DESCENDANTS_FIELD]?: Record<string, Record<string, unknown>>;
  [LEGACY_LAYOUT_ID_FIELD]?: string | null;
  [LEGACY_MASTER_ID_FIELD]?: string;
  [LEGACY_OVERRIDES_FIELD]?: Record<string, unknown>;
  [LEGACY_SLOT_NAME_FIELD]?: string | null;
  componentName?: string;
};

export type ElementWithLegacyMirror = Element & LegacyElementMirrorFields;

type CanonicalRefLike = {
  ref?: unknown;
};

export function asElementWithLegacyMirror(
  element: Element,
): ElementWithLegacyMirror {
  return element as ElementWithLegacyMirror;
}

function asAnyLegacyFields(
  value: unknown,
): Partial<LegacyElementMirrorFields> | null {
  if (!value || typeof value !== "object") return null;
  return value as Partial<LegacyElementMirrorFields>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isLegacyMasterElement(element: Element): boolean {
  return (
    asElementWithLegacyMirror(element)[LEGACY_COMPONENT_ROLE_FIELD] === "master"
  );
}

export function isLegacyInstanceElement(element: Element): boolean {
  return (
    asElementWithLegacyMirror(element)[LEGACY_COMPONENT_ROLE_FIELD] ===
      "instance" &&
    typeof asElementWithLegacyMirror(element)[LEGACY_MASTER_ID_FIELD] ===
      "string"
  );
}

export function getInstanceMasterReference(
  element: Element,
): string | undefined {
  const legacyMasterId =
    asElementWithLegacyMirror(element)[LEGACY_MASTER_ID_FIELD];
  if (typeof legacyMasterId === "string" && legacyMasterId) {
    return legacyMasterId;
  }

  const canonical = element as Element & CanonicalRefLike;
  if (typeof canonical.ref === "string" && canonical.ref) {
    return canonical.ref;
  }

  return undefined;
}

export function getLegacyOverrides(
  element: Element,
): Record<string, unknown> | undefined {
  const value = asElementWithLegacyMirror(element)[LEGACY_OVERRIDES_FIELD];
  return isRecord(value) ? value : undefined;
}

export function getLegacyDescendants(
  element: Element,
): Record<string, unknown> | undefined {
  const value = asElementWithLegacyMirror(element)[LEGACY_DESCENDANTS_FIELD];
  return isRecord(value) ? value : undefined;
}

export function getElementLayoutId(element: Element): string | null {
  return getLegacyLayoutId(element);
}

export function getLegacyLayoutId(value: unknown): string | null {
  const fields = asAnyLegacyFields(value);
  const layoutId = fields?.[LEGACY_LAYOUT_ID_FIELD];
  return typeof layoutId === "string" ? layoutId : null;
}

export function hasLegacyLayoutId(value: unknown): boolean {
  return getLegacyLayoutId(value) !== null;
}

export function matchesLegacyLayoutId(
  value: unknown,
  layoutId: string,
): boolean {
  return getLegacyLayoutId(value) === layoutId;
}

export function getLegacySlotName(value: unknown): string | null {
  const fields = asAnyLegacyFields(value);
  const slotName = fields?.[LEGACY_SLOT_NAME_FIELD];
  return typeof slotName === "string" ? slotName : null;
}

export function getElementSlotName(element: Element): string | null {
  const value = asElementWithLegacyMirror(element)[LEGACY_SLOT_NAME_FIELD];
  return typeof value === "string" ? value : null;
}

export function withLegacyLayoutId<T extends object>(
  value: T,
  layoutId: string | null,
): T {
  return {
    ...value,
    [LEGACY_LAYOUT_ID_FIELD]: layoutId,
  } as T;
}

export function withLegacySlotName<T extends object>(
  value: T,
  slotName: string | null,
): T {
  return {
    ...value,
    [LEGACY_SLOT_NAME_FIELD]: slotName,
  } as T;
}

export function withoutLegacyInstanceFields(element: Element): Element {
  const clone = { ...element } as ElementWithLegacyMirror;
  delete clone[LEGACY_COMPONENT_ROLE_FIELD];
  delete clone[LEGACY_MASTER_ID_FIELD];
  delete clone[LEGACY_OVERRIDES_FIELD];
  delete clone[LEGACY_DESCENDANTS_FIELD];
  return clone;
}
