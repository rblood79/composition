/**
 * 필드 단위 역참조 — ADR-212 Phase 3.
 *
 * `resolveCollectionUsage` (collection 단위) 를 필드로 세분한다. 필드 삭제·rename 이 어느
 * 요소를 건드리는지 사람 경로에서 보여 주기 위한 것 (UX-5, Y5). 세 축을 본다:
 *
 * - **바인딩 `fieldMap`** (label/value/description/icon) — 값이 `field.id` 또는 `field.key`
 * - **`columnMapping`** — 그 필드 key 를 가진 열 (차트 시리즈 · 테이블 열)
 * - **`{field}` / `{#fieldId}` 템플릿** — 문자열 prop 전수 (`compileFieldTemplate`)
 * - **Chart 역할** (ADR-312) — 그 collection 에 연결된 Chart 의 역할 prop (역할 표 `CHART_ROLE_KEYS` — 값이
 *   `#field.id` 또는 field.key, 목록 역할은 그 원소)
 *
 * 바인딩이 있으면 그 collection 에 매인 요소만, 없으면 (텍스트 요소) 템플릿·columnMapping 만
 * 본다. 순수 함수 — store 를 모른다.
 */
import { CHART_ROLE_KEYS } from "@composition/rendering";
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
  /** 컴포넌트 type 이름 (`Chart`) — `type` 이 정의 id 일 때 어댑터가 채운다. */
  componentType?: string;
  props?: unknown;
  dataBinding?: unknown;
}

export type FieldUsageReason =
  "fieldMap" | "columnMapping" | "template" | "chartRole";

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

/** ADR-312 — Chart 의 역할 prop 이 그 필드를 가리키는가 (`#id` 또는 key, 목록 역할은 원소). */
function chartRoleUsesField(props: unknown, field: DataField): boolean {
  if (!props || typeof props !== "object") return false;
  const record = props as Record<string, unknown>;
  const hits = (value: unknown): boolean =>
    typeof value === "string" &&
    ((!!field.id && value === `#${field.id}`) || value === field.key);
  return CHART_ROLE_KEYS.some((key) => {
    const value = record[key];
    return Array.isArray(value) ? value.some(hits) : hits(value);
  });
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
    else if (
      boundHere &&
      (element.componentType ?? element.type) === "Chart" &&
      chartRoleUsesField(element.props, field)
    )
      reason = "chartRole";

    if (reason)
      out.push({ id: element.id, type: element.type ?? null, reason });
  }
  return out;
}
