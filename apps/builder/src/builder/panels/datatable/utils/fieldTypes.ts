/**
 * 필드 타입 목록 + 아이콘 — 필드 패널의 타입 ListBox 와 격자 헤더의 타입 아이콘이 같은 표를 읽는다
 * (헤더에서 보이는 아이콘 = 패널에서 고르는 아이콘, 인지 > 회상).
 */
import {
  Braces,
  Calendar,
  Hash,
  Image as ImageIcon,
  Link as LinkIcon,
  Link2,
  Mail,
  Sigma,
  ToggleLeft,
  Type as TypeIcon,
  type LucideIcon,
} from "lucide-react";
import type {
  DataField,
  DataFieldFormat,
  DataFieldType,
} from "../../../../types/builder/data.types";

export interface FieldTypeEntry {
  value: DataFieldType;
  icon: LucideIcon;
  /** `datatable.types.*` i18n 키 */
  i18n: string;
}

/**
 * The types a column picks — the variables' types (string · number · boolean · date · JSON) and
 * `reference` (a table's own — 사용자 결정 2026-10-29 「reference 는 표 전용으로 남기고 공통 타입으로」).
 * `object` · `array` show as one JSON (`array` resolves to it); a text's kind is a format.
 */
export const FIELD_TYPES: readonly FieldTypeEntry[] = [
  { value: "string", icon: TypeIcon, i18n: "types.string" },
  { value: "number", icon: Hash, i18n: "types.number" },
  { value: "boolean", icon: ToggleLeft, i18n: "types.boolean" },
  { value: "date", icon: Calendar, i18n: "types.date" },
  { value: "object", icon: Braces, i18n: "types.json" },
  { value: "reference", icon: Link2, i18n: "types.reference" },
];

export interface FieldFormatEntry {
  value: DataFieldFormat;
  icon: LucideIcon;
  /** `datatable.types.*` i18n 키 (the old type labels — Email · URL · Image) */
  i18n: string;
}

/** A `string` column's kinds (`DataField.format`). */
export const FIELD_FORMATS: readonly FieldFormatEntry[] = [
  { value: "email", icon: Mail, i18n: "types.email" },
  { value: "url", icon: LinkIcon, i18n: "types.url" },
  { value: "image", icon: ImageIcon, i18n: "types.image" },
];

/** The picked type as shown — an `array` column is the JSON one. */
export const shownFieldType = (type: string): DataFieldType =>
  type === "array" ? "object" : (type as DataFieldType);

/**
 * A column's glyph — a computed column's Σ (ADR-291 — `formula`, no type added), else its
 * format's for a formatted text, else its type's.
 */
/** A computed column's glyph (ADR-291 — whatever its result type). */
export const COMPUTED_FIELD_GLYPH: LucideIcon = Sigma;

export function resolveFieldGlyph(
  field: Pick<DataField, "type" | "format" | "formula">,
): LucideIcon {
  if (field.formula) return COMPUTED_FIELD_GLYPH;
  if (field.type === "string" && field.format) {
    const format = FIELD_FORMATS.find((entry) => entry.value === field.format);
    if (format) return format.icon;
  }
  return resolveFieldType(field.type).icon;
}

/** 모르는 타입 (구 문서) 은 string 아이콘으로 */
export function resolveFieldType(type: string): FieldTypeEntry {
  const shown = shownFieldType(type);
  return FIELD_TYPES.find((ft) => ft.value === shown) ?? FIELD_TYPES[0];
}
