import type { Element } from "../../types/core/store.types";
import type { ElementWithLegacyMirror } from "./legacyElementFields";

// (ADR-128) `SupabaseElement` interface + `sanitizeElementForSupabase` 함수는
// Supabase `elements` row schema (snake_case) 변환 전용으로, cloud data layer
// dead 정책에 따라 제거됨. canonical document persistence 는 IndexedDB
// `documents` row 만 사용하므로 별도 직렬화 helper 불필요.

type ElementWithCanonicalFields = ElementWithLegacyMirror & {
  children?: unknown;
  descendants?: unknown;
  metadata?: Record<string, unknown>;
  ref?: string;
  reusable?: boolean;
  slot?: false | string[];
};

function cloneSerializable<T>(value: T): T {
  if (value === undefined) return value;
  try {
    if (typeof structuredClone !== "undefined") {
      return structuredClone(value);
    }
  } catch {
    // JSON fallback below drops non-serializable values intentionally.
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function withSerializableElementFields(element: Element): Element {
  const canonical = element as ElementWithCanonicalFields;
  return {
    ...element,
    props: cloneSerializable(element.props || {}),
    dataBinding: cloneSerializable(element.dataBinding),
    events: cloneSerializable(element.events),
    overrides: cloneSerializable(canonical.overrides),
    descendants: cloneSerializable(canonical.descendants),
    metadata: cloneSerializable(canonical.metadata),
    slot: cloneSerializable(canonical.slot),
    fills: cloneSerializable(element.fills),
    border: cloneSerializable(element.border),
    children: cloneSerializable(canonical.children),
  } as Element;
}

/**
 * Element 직렬화 유틸리티 함수
 *
 * Element 객체를 안전하게 직렬화하여 postMessage나 데이터베이스 저장에 사용할 수 있도록 변환합니다.
 * - Immer proxy 객체를 일반 객체로 변환
 * - props의 깊은 복사 수행
 * - 순환 참조 제거
 *
 * **ADR-903 P3-B 안전망 #2**: page_id/layout_id 미설정 element 감지용 dev-only 경고
 * P3-D에서 canonical parent 기반으로 전환 후 이 경고가 빈번하면 adapter 누락을 의미.
 *
 * @param element - 직렬화할 Element 객체
 * @returns 직렬화된 Element 객체
 */
export const sanitizeElement = (element: Element): Element => {
  // ADR-903 P3-B 안전망 #2: page_id/layout_id 미설정 element dev-only 경고
  // P3-D canonical parent 전환 후 이 경고 발생 시 adapter 누락 점검 필요
  if (import.meta.env.DEV && !element.page_id && !element.layout_id) {
    console.warn(
      "[ADR-903] sanitizeElement: page_id/layout_id 없음 — canonical parent 의존 element?",
      element.id,
      element.type,
    );
  }

  try {
    return withSerializableElementFields(element);
  } catch (error) {
    console.error("Element sanitization error:", error);
    // 기본 값으로 대체
    return {
      id: element.id || "",
      customId: element.customId,
      type: element.type || "",
      props: {},
      parent_id: element.parent_id,
      page_id: element.page_id || "",
      layout_id: element.layout_id || null, // ⭐ Layout/Slot System: layout_id 포함
      slot_name: element.slot_name || null,
      dataBinding: element.dataBinding,
      events: element.events,
      componentRole: (element as ElementWithCanonicalFields).componentRole,
      masterId: (element as ElementWithCanonicalFields).masterId,
      overrides: (element as ElementWithCanonicalFields).overrides,
      descendants: (element as ElementWithCanonicalFields).descendants,
      componentName: (element as ElementWithCanonicalFields).componentName,
      reusable: (element as ElementWithCanonicalFields).reusable,
      ref: (element as ElementWithCanonicalFields).ref,
      metadata: (element as ElementWithCanonicalFields).metadata,
      slot: (element as ElementWithCanonicalFields).slot,
      variableBindings: element.variableBindings,
      fills: element.fills,
      border: element.border,
    } as Element;
  }
};
