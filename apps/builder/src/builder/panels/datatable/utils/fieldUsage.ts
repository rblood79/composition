/**
 * 필드 단위 역참조 — ADR-212 Phase 3.
 *
 * `resolveCollectionUsage` (collection 단위) 를 필드로 세분한다. 필드 삭제·rename 이 어느
 * 요소를 건드리는지 사람 경로에서 보여 주기 위한 것 (UX-5, Y5). 세 축을 본다:
 *
 * - **바인딩 `fieldMap`** (label/value/description/icon) — 값이 `field.id` 또는 `field.key`
 * - **`columnMapping`** — 그 필드 key 를 가진 열 (차트 시리즈 · 테이블 열)
 * - **`{field}` / `{#fieldId}` 템플릿** — 문자열 prop 전수 (`compileFieldTemplate`)
 *
 * 바인딩이 있으면 그 collection 에 매인 요소만, 없으면 (텍스트 요소) 템플릿·columnMapping 만
 * 본다. 순수 함수 — store 를 모른다.
 */
import {
  compileFieldTemplate,
  resolveBoundCollection,
} from "@composition/shared";
import type {
  DataField,
  DataTable,
} from "../../../../types/builder/data.types";

export interface UsageBearingElement {
  id: string;
  type?: string;
  props?: unknown;
  dataBinding?: unknown;
}

export type FieldUsageReason = "fieldMap" | "columnMapping" | "template";

export interface FieldUsageRef {
  id: string;
  type: string | null;
  reason: FieldUsageReason;
}

function readBinding(element: UsageBearingElement): unknown {
  const props = element.props;
  if (props && typeof props === "object" && "dataBinding" in props) {
    const fromProps = (props as { dataBinding?: unknown }).dataBinding;
    if (fromProps) return fromProps;
  }
  return element.dataBinding;
}

/** fieldMap 의 어느 role 값이 field.id / field.key 와 같은가. */
function usesInFieldMap(binding: unknown, field: DataField): boolean {
  if (!binding || typeof binding !== "object") return false;
  const fieldMap = (binding as { fieldMap?: unknown }).fieldMap;
  if (!fieldMap || typeof fieldMap !== "object") return false;
  for (const value of Object.values(fieldMap as Record<string, unknown>)) {
    if (value === field.id || value === field.key) return true;
  }
  return false;
}

/** columnMapping 은 field key 로 키가 매겨진다 (`ColumnMapping[fieldKey]`). */
function usesInColumnMapping(props: unknown, field: DataField): boolean {
  if (!props || typeof props !== "object") return false;
  const mapping = (props as { columnMapping?: unknown }).columnMapping;
  if (!mapping || typeof mapping !== "object") return false;
  return Object.prototype.hasOwnProperty.call(mapping, field.key);
}

/** 문자열 값 안에서 field.key (flat 토큰) 또는 `#field.id` 저장형 토큰을 쓰는가. */
function templateUsesField(text: string, field: DataField): boolean {
  if (!text.includes("{")) return false;
  const compiled = compileFieldTemplate(text);
  if (!compiled) return false;
  for (const part of compiled.parts) {
    if (part.kind !== "field") continue;
    if (field.id && part.fieldId === field.id) return true;
    // flat 토큰 — 경로 첫 세그먼트가 field.key (fieldId 저장형이 아닐 때만)
    if (!part.fieldId && part.path[0] === field.key) return true;
  }
  return false;
}

/** props 트리의 모든 문자열을 훑어 템플릿 참조를 찾는다 (텍스트가 배열·객체 안에 있어도). */
function anyTemplateUsesField(
  value: unknown,
  field: DataField,
  depth = 0,
): boolean {
  if (depth > 6) return false;
  if (typeof value === "string") return templateUsesField(value, field);
  if (Array.isArray(value))
    return value.some((v) => anyTemplateUsesField(v, field, depth + 1));
  if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      if (anyTemplateUsesField(v, field, depth + 1)) return true;
    }
  }
  return false;
}

/**
 * `field` 를 참조하는 요소들. `collection` 은 바인딩 매칭 (id/name) 에 쓴다 — 바인딩 있는
 * 요소는 이 collection 에 매인 것만, 없는 요소는 columnMapping·템플릿만 본다.
 */
export function resolveFieldUsage(
  elements: readonly UsageBearingElement[],
  collection: DataTable,
  field: DataField,
): FieldUsageRef[] {
  const out: FieldUsageRef[] = [];
  for (const element of elements) {
    const binding = readBinding(element);
    const boundHere =
      binding != null && resolveBoundCollection(binding, [collection]) !== null;
    const boundElsewhere = binding != null && !boundHere;
    if (boundElsewhere) continue;

    let reason: FieldUsageReason | null = null;
    if (boundHere && usesInFieldMap(binding, field)) reason = "fieldMap";
    else if (usesInColumnMapping(element.props, field))
      reason = "columnMapping";
    else if (anyTemplateUsesField(element.props, field)) reason = "template";

    if (reason)
      out.push({ id: element.id, type: element.type ?? null, reason });
  }
  return out;
}
