import React from "react";
import { Text as AriaText } from "react-aria-components";

import { Icon } from "./Icon";
import { isSlotEnabled, type SlotComposition } from "../catalog/slotRoles";

/**
 * ListBoxItem 행의 DOM slot 콘텐츠 — icon / label / description / 선택 체크마크.
 *
 * **단일 소스인 이유 (2026-08-21)**: 같은 `.react-aria-ListBoxItem` 행을 세 곳이 렌더한다 —
 * `renderListBox`(ListBox 컴포넌트), `Select` 팝오버, `ComboBox` 팝오버. ListBox 만 이
 * 구조를 emit 하고 Select/ComboBox 는 `{label}` 문자열만 렌더해서, 두 컴포넌트의
 * `itemSchema` 가 선언한 **icon/description 이 편집은 되는데 화면에 나오지 않는**
 * 상태였다(§1-1 표면 단절 유형). ListBox.css 의 `[slot="icon"]`/`[slot="description"]`
 * 규칙은 클래스 스코프라 팝오버 행에도 이미 적용되므로, 빠진 것은 마크업뿐이었다.
 *
 * Skia 대칭: `listbox_item` skiaPrimitive 의 icon/label/description/check 와 같은 구성.
 * 단 Select/ComboBox 팝오버는 캔버스에 projection 이 없다(트리거만 그린다) — 팝오버 행은
 * DOM 전용 표면이라 이 배선이 새 비대칭을 만들지 않는다.
 *
 * `slotComposition` 은 ADR-148 origin slot 조합(존재 gating + style overlay + 순서)이며
 * null 이면 전 slot 활성(기본 동작).
 */
export function renderListBoxItemSlotContent(opts: {
  label: React.ReactNode;
  description: string | null;
  iconName: string | null;
  isSelected: boolean;
  slotComposition?: SlotComposition | null;
  /**
   * 선택 체크마크를 **행 우측에** 그릴지 (기본 true — ListBox 행).
   *
   * Select/ComboBox 팝오버는 ListBox.css 의 popover 컨텍스트 블록이
   * `[data-selected]::before` 로 **좌측 gutter 에 ✓** 를 이미 그린다 → 우측 체크까지
   * 렌더하면 한 행에 체크가 둘이 된다. 그래서 팝오버 경로는 false 로 끈다.
   */
  showSelectionCheck?: boolean;
}): React.ReactNode {
  const {
    label,
    description,
    iconName,
    isSelected,
    slotComposition,
    showSelectionCheck = true,
  } = opts;
  const slotStyleOf = (
    role: Parameters<typeof isSlotEnabled>[1],
  ): React.CSSProperties | undefined =>
    slotComposition?.slots[role]?.style as React.CSSProperties | undefined;

  const iconStyle = slotStyleOf("icon");
  const iconNode =
    isSlotEnabled(slotComposition, "icon") && iconName ? (
      // 컨테이너 박스·텍스트 여백은 ListBox.css `--lb-icon-size` 가 스케일 (행 스코프 주입).
      <span slot="icon" aria-hidden="true">
        <Icon iconName={iconName} style={{ fontSize: 16, ...iconStyle }} />
      </span>
    ) : null;

  const labelNode = isSlotEnabled(slotComposition, "label") ? (
    <AriaText slot="label" style={slotStyleOf("label")}>
      {label}
    </AriaText>
  ) : null;
  const descriptionNode =
    isSlotEnabled(slotComposition, "description") && description ? (
      <AriaText slot="description" style={slotStyleOf("description")}>
        {description}
      </AriaText>
    ) : null;

  // label/description emit 순서 — slot 자식 등장 순서 (기본: label → description).
  const descriptionFirst =
    slotComposition != null &&
    slotComposition.order.indexOf("description") !== -1 &&
    slotComposition.order.indexOf("description") <
      slotComposition.order.indexOf("label");

  return (
    <>
      {iconNode}
      {descriptionFirst ? descriptionNode : labelNode}
      {descriptionFirst ? labelNode : descriptionNode}
      {isSelected && showSelectionCheck ? (
        <Icon
          iconName="check"
          aria-hidden="true"
          className="listbox-item-check"
          style={{ fontSize: 16 }}
        />
      ) : null}
    </>
  );
}
