/**
 * Tree Helper Functions & Types
 *
 * 🚀 Performance: 컴포넌트 외부로 추출하여 불필요한 재생성 방지
 */

import type { ElementProps } from "../../../../types/integrations/supabase.types";

// ============================================
// Types
// ============================================

export type ButtonItem = { id: string; title: string; isSelected?: boolean };
export type CheckboxItem = { id: string; label: string; isSelected?: boolean };
export type RadioItem = { id: string; label: string; value: string };
export type ListItem = {
  id: string;
  label: string;
  value?: string;
  isDisabled?: boolean;
};
export type TreeItem = {
  id: string;
  title: string;
  type: "folder" | "file";
  parent_id: string | null;
  originalIndex: number;
  children: TreeItem[];
};

export type WithTag = { type: string };
export type WithProps = { props: ElementProps };

// ============================================
// Icon Props (상수)
// ============================================

export const ICON_EDIT_PROPS = {
  color: "#171717",
  stroke: 1,
  size: 16,
} as const;

// ============================================
// Pure Helper Functions
// ============================================

/**
 * 아이템이 자식을 가지고 있는지 확인
 */
export const hasChildren = <T extends { id: string; parent_id?: string | null }>(
  items: T[],
  itemId: string
): boolean => {
  return items.some((item) => item.parent_id === itemId);
};

/**
 * Type guard: 객체가 type 프로퍼티를 가지고 있는지 확인
 */
export const hasTag = (x: unknown): x is WithTag =>
  typeof x === "object" &&
  x !== null &&
  "type" in x &&
  typeof (x as Record<string, unknown>)["type"] === "string";

/**
 * Type guard: 객체가 props 프로퍼티를 가지고 있는지 확인
 */
export const hasProps = (x: unknown): x is WithProps => {
  if (typeof x !== "object" || x === null || !("props" in x)) return false;
  const p = (x as { props?: unknown }).props;
  return typeof p === "object" && p !== null;
};

/**
 * unknown 값을 타입 안전하게 배열로 변환
 */
export const childrenAs = <C,>(v: unknown): C[] =>
  Array.isArray(v) ? (v as C[]) : [];
