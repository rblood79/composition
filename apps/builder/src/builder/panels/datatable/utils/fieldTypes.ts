/**
 * 필드 타입 목록 + 아이콘 — 필드 패널의 타입 ListBox 와 격자 헤더의 타입 아이콘이 같은 표를 읽는다
 * (헤더에서 보이는 아이콘 = 패널에서 고르는 아이콘, 인지 > 회상).
 */
import {
  Braces,
  Calendar,
  CalendarClock,
  Hash,
  Image as ImageIcon,
  Link as LinkIcon,
  List,
  Mail,
  ToggleLeft,
  Type as TypeIcon,
  type LucideIcon,
} from "lucide-react";
import type { DataFieldType } from "../../../../types/builder/data.types";

export interface FieldTypeEntry {
  value: DataFieldType;
  icon: LucideIcon;
  /** `datatable.types.*` i18n 키 */
  i18n: string;
}

export const FIELD_TYPES: readonly FieldTypeEntry[] = [
  { value: "string", icon: TypeIcon, i18n: "types.string" },
  { value: "number", icon: Hash, i18n: "types.number" },
  { value: "boolean", icon: ToggleLeft, i18n: "types.boolean" },
  { value: "date", icon: Calendar, i18n: "types.date" },
  { value: "datetime", icon: CalendarClock, i18n: "types.dateTime" },
  { value: "email", icon: Mail, i18n: "types.email" },
  { value: "url", icon: LinkIcon, i18n: "types.url" },
  { value: "image", icon: ImageIcon, i18n: "types.image" },
  { value: "array", icon: List, i18n: "types.array" },
  { value: "object", icon: Braces, i18n: "types.object" },
];

/** 모르는 타입 (구 문서) 은 string 아이콘으로 */
export function resolveFieldType(type: string): FieldTypeEntry {
  return FIELD_TYPES.find((ft) => ft.value === type) ?? FIELD_TYPES[0];
}
