import type { RuntimeMenuItem } from "@composition/rendering";

import {
  MenuItemProps,
  MenuProps,
  MenuTriggerProps,
} from "react-aria-components/Menu";

import type {
  ColumnMapping,
  ComponentSize,
  DataBinding,
  DataBindingValue,
} from "../types";

// ADR-148 Phase 4 — MenuItem slot 구성 소비 (origin slot 자식의 존재 gating / 스타일 overlay).
import {
  isSlotEnabled,
  type SlotComposition,
  type SlotRole,
} from "../catalog/slotRoles";

/**
 * Phase 4: data-* 패턴 전환
 * - tailwind-variants 제거
 * - data-variant, data-size 속성 사용
 *
 * Phase 5 (ADR-068): items SSOT 경로 추가
 * - MenuItem interface 제거 → RuntimeMenuItem (specs) 사용
 * - MenuButtonProps.items: RuntimeMenuItem[] 추가
 * - dataBinding 없음 → items prop 소비
 */

export interface MenuButtonProps<T>
  extends
    Omit<
      MenuProps<T>,
      "items" | "selectionMode" | "selectedKeys" | "onSelectionChange"
    >,
    Omit<MenuTriggerProps, "children"> {
  label?: string;
  dataBinding?: DataBinding | DataBindingValue;
  columnMapping?: ColumnMapping;
  /** items SSOT 경로 (ADR-068 Phase 5): CollectionRenderers가 StoredMenuItem[] → RuntimeMenuItem[] 변환 후 전달 */
  items?: RuntimeMenuItem[];
  // M3 props
  variant?: string;
  size?: ComponentSize;
  /** ADR-073 Task 7: selection wiring — RAC Menu selectionMode */
  selectionMode?: "none" | "single" | "multiple";
  /** ADR-073 Task 7: controlled selected keys (string[]) — passed as Set to RAC Menu */
  selectedKeys?: string[];
  /** ADR-073 Task 7: selection change callback */
  onSelectionChange?: (keys: string[]) => void;
  /**
   * ADR-148 Phase 4 — MenuItem slot 구성 (origin `component-menu-item-default` 자식에서
   * 파생, provider 가 renderMenu 경유로 주입). null/미주입 = legacy 문서 → 기존 동작.
   */
  slotComposition?: SlotComposition | null;
}

/**
 * ADR-148 Phase 4: MenuItem slot 콘텐츠 — icon/label/shortcut(content 행) + description
 * (2번째 행) 을 slot 구성으로 **존재 gating**(구성에 없는 slot 은 데이터가 있어도 미 emit —
 * origin 에서 slot 자식을 지우면 사라진다) + **스타일 overlay**(slot 자식 props.style) 소비.
 * 행 배치(icon|label|shortcut 한 행 / description 아래 행)는 Menu markup 구조 고정 —
 * 순서 축은 content 행 구조상 소비하지 않는다 (ListBox 의 icon 고정 배치와 동형 판정).
 * null 이면 기존 동작(BC).
 */
export function renderMenuItemSlotParts(
  item: Pick<RuntimeMenuItem, "icon" | "label" | "shortcut" | "description">,
  slotComposition?: SlotComposition | null,
): React.ReactNode {
  const styleOf = (role: SlotRole): React.CSSProperties | undefined =>
    slotComposition?.slots[role]?.style as React.CSSProperties | undefined;
  return (
    <>
      <span className="menu-item-content">
        {isSlotEnabled(slotComposition, "icon") && item.icon && (
          <span className="menu-item-icon" style={styleOf("icon")}>
            {item.icon}
          </span>
        )}
        {isSlotEnabled(slotComposition, "label") && (
          <span className="menu-item-label" style={styleOf("label")}>
            {item.label}
          </span>
        )}
        {isSlotEnabled(slotComposition, "shortcut") && item.shortcut && (
          <kbd className="menu-item-shortcut" style={styleOf("shortcut")}>
            {item.shortcut}
          </kbd>
        )}
      </span>
      {isSlotEnabled(slotComposition, "description") && item.description && (
        <span className="menu-item-description" style={styleOf("description")}>
          {item.description}
        </span>
      )}
    </>
  );
}

export interface ExtendedMenuItemProps extends Omit<MenuItemProps, "children"> {
  children?: React.ReactNode;
  /** 직접 지정하는 단축키 문자열 */
  shortcut?: string;
}
