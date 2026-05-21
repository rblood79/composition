/**
 * ADR-144 Phase 5 task 7 — Inspector Properties UI 의 3 input mode 감지.
 *
 * 한 instance 가 동시에 두 mode 를 노출하지 않도록 caller (family-specific
 * PropertyEditor) 들이 본 helper 의 반환값을 보고 Editor UI 를 상호 배타로 분기한다.
 *
 * 감지 순서 (breakdown C3-b 와 1:1):
 *   1. `external-databinding` — element.dataBinding 명시 / Data Panel / API endpoint 입력
 *   2. `resolved-tree`        — ADR-144 신규: ref instance + descendants 합성 또는
 *                                reusable origin (slot 컨테이너) 의 composite payload
 *   3. `legacy-items`         — fallback: `props.items[]` ItemsManager 호환 path
 *
 * mode 1/2 가 모두 미충족이면 mode 3 으로 fallback. mode 2 와 mode 3 이 동시에 후보일
 * 때는 mode 2 가 우선 (resolved-tree 가 새 authoring SSOT).
 */

import type { Element } from "@/types/builder/unified.types";

export type InspectorInputMode =
  | "external-databinding"
  | "resolved-tree"
  | "legacy-items";

export interface InspectorInputModeContext {
  /**
   * Skia hit-test 가 노출한 canonical owner path. `selection.primaryOwnerPath` 와 동일 값.
   * ref instance 의 descendants origin child 를 선택했는지 판정에 사용한다.
   */
  ownerPath: string | null | undefined;
  /**
   * `elementsMap.get` 와 동등한 lookup. instance/master/origin child 의
   * `componentRole`, `reusable`, `descendants` 필드를 읽기 위한 read-only access.
   */
  lookupElement: (id: string) => Element | undefined;
}

/**
 * element 가 resolved-tree composite payload 의 일부인지 판정.
 *
 * 다음 중 하나라도 충족하면 true:
 *   - element 가 ref instance (`componentRole === "instance"`)
 *   - element 가 reusable origin (master) 의 자식이며 ownerPath 가 ref instance ancestor 를 포함
 *   - element 자체가 reusable origin (slot 컨테이너 — `reusable === true`, slot 명시)
 */
function isResolvedTreeComposite(
  element: Element,
  context: InspectorInputModeContext,
): boolean {
  if (element.componentRole === "instance") {
    return true;
  }

  if (element.reusable === true && Array.isArray(element.slot)) {
    return true;
  }

  const { ownerPath, lookupElement } = context;
  if (!ownerPath) return false;

  const segments = ownerPath.split("/");
  // ownerPath 의 ancestor (마지막 segment 제외) 중 ref instance 가 있으면 composite 의 일부
  for (let i = segments.length - 2; i >= 0; i -= 1) {
    const ancestor = lookupElement(segments[i]);
    if (ancestor?.componentRole === "instance") {
      return true;
    }
  }
  return false;
}

function hasLegacyItemsArray(element: Element): boolean {
  const props = element.props as Record<string, unknown> | undefined;
  if (!props) return false;
  const items = props.items;
  return Array.isArray(items);
}

export function detectInspectorInputMode(
  element: Element,
  context: InspectorInputModeContext,
): InspectorInputMode {
  // Mode 1: external data binding (Data Panel collection / API endpoint 입력)
  if (element.dataBinding) {
    return "external-databinding";
  }

  // Mode 2: ADR-144 resolved-tree composite (ref instance + descendants / reusable slot 컨테이너)
  if (isResolvedTreeComposite(element, context)) {
    return "resolved-tree";
  }

  // Mode 3: legacy `props.items[]` ItemsManager 호환 path
  if (hasLegacyItemsArray(element)) {
    return "legacy-items";
  }

  // 어느 mode 도 명확하지 않은 경우 legacy fallback (ItemsManager 가 빈 상태로 표시).
  return "legacy-items";
}
