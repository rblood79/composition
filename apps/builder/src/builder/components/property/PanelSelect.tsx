/**
 * PanelSelect — 빌더 패널 Select 의 틀 하나 (2026-11-09).
 *
 * RAC `Select` + 트리거 `Button` (+ ▾ 자리 `.select-chevron`) + `Popover.property-select-popover` +
 * `ListBox`. 트리거 안 내용 (값 · 라벨 · 아이콘) 만 호출부가 정한다. 목록 Popover 에는 빌더 팝업
 * 목록 정본 class (`BUILDER_POPUP_LIST_CLASS`) 가 붙고, 팝오버가 닫힐 때 트리거 focus 복원
 * (`useSelectTriggerFocusRestore`) 이 같이 걸린다.
 *
 * 항목은 `PanelSelectItem` — 이름만 · 이름 + 아래 설명 (`description`) · 이름 + 오른쪽 짧은 정보
 * (`detail`) · 앞 색 점 (`swatch`).
 *
 * Why: `PropertySelect` 의 마크업을 CollectionBinding (2) · VariableTable · CompactSelect 가 따로
 * 복사해 써서, PropertySelect 를 고쳐도 넷은 따라오지 않았다 (팝업 목록 class · focus 복원이
 * 곳마다 달랐다). `builderPopupList.static.test.ts` (c) 가 RAC `Select` 를 이 파일에서만 쓰게 한다.
 *
 * 닫혀 있는 동안 RAC 에는 선택된 항목 하나만 준다 (`closedItems` — 선택이 없으면 첫 항목) — 목록 전체는 열릴 때. RAC
 * `Select` 는 collection 항목마다 숨은 native `<option>` 을 만드는데 (폼 제출 · 브라우저 자동 완성용,
 * 300 항목 이하에서 끄는 prop 없음) 패널은 둘 다 쓰지 않는다. 닫힌 채 글자 · ←/→ 로 값을 바꾸는
 * 동작은 없다 (열어서 고른다). Why (2026-11-12): Locale 선택칸 (36 항목) 이 선택마다 `<option>`
 * 37 개를 만들어 select 부류 DOM 자식 변경이 280 → 922.
 */
import { ChevronDown } from "lucide-react";
import type { CSSProperties, ReactNode, Ref } from "react";
import type { Key } from "react-aria-components/Collection";
import { Children, isValidElement, useCallback, useState } from "react";
import { Button } from "react-aria-components/Button";
import { ListBox, ListBoxItem } from "react-aria-components/ListBox";
import { Popover } from "react-aria-components/Popover";
import { Select as AriaSelect } from "react-aria-components/Select";
import { Text } from "react-aria-components/Text";

import { iconProps } from "../../../utils/ui/uiConstants";
import { BUILDER_POPUP_LIST_CLASS } from "../../styles/modules/builderPopupList";
import { useSelectTriggerFocusRestore } from "./useSelectTriggerFocusRestore";

import "./PropertySelectGrid.css";
import "./PropertySwatch.css";

export interface PanelSelectProps {
  "aria-label": string;
  selectedKey: Key | null;
  onSelectionChange: (key: Key | null) => void;
  /** 트리거 안 ▾ 앞 내용 — 보통 `<SelectValue>` */
  trigger: ReactNode;
  /** ▾ 자리 내용 (기본 ChevronDown) — 유형 아이콘처럼 그 자리를 다른 그림으로 쓸 때 */
  chevron?: ReactNode;
  /** `react-aria-Select` 뒤에 붙는 class */
  className?: string;
  selectRef?: Ref<HTMLDivElement>;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  isDisabled?: boolean;
  disabledKeys?: Iterable<Key>;
  /** `property-select-popover` 뒤에 붙는 class */
  popoverClassName?: string;
  popoverStyle?: CSSProperties;
  /** 목록 대신 견본 격자 (`PropertySelect` grid) — 팝업 목록 정본 대상이 아니다 */
  grid?: boolean;
  "data-role"?: string;
  /** ListBox 의 항목 · 구획 */
  children: ReactNode;
}

export function PanelSelect({
  "aria-label": ariaLabel,
  selectedKey,
  onSelectionChange,
  trigger,
  chevron,
  className,
  selectRef,
  isOpen,
  onOpenChange,
  isDisabled,
  disabledKeys,
  popoverClassName,
  popoverStyle,
  grid = false,
  "data-role": dataRole,
  children,
}: PanelSelectProps) {
  const { triggerRef, restoreFocusOnClose } = useSelectTriggerFocusRestore();
  const [opened, setOpened] = useState(false);
  const handleOpenChange = useCallback(
    (open: boolean) => {
      setOpened(open);
      onOpenChange?.(open);
      restoreFocusOnClose(open);
    },
    [onOpenChange, restoreFocusOnClose],
  );
  const open = isOpen ?? opened;
  return (
    <AriaSelect
      className={
        className ? `react-aria-Select ${className}` : "react-aria-Select"
      }
      ref={selectRef}
      data-role={dataRole}
      aria-label={ariaLabel}
      selectedKey={selectedKey}
      onSelectionChange={onSelectionChange}
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      isDisabled={isDisabled}
      disabledKeys={disabledKeys}
    >
      <Button className="react-aria-Button" ref={triggerRef}>
        {trigger}
        <SelectChevron>{chevron}</SelectChevron>
      </Button>
      <Popover
        className={`react-aria-Popover property-select-popover ${
          grid ? "property-select-popover--grid" : BUILDER_POPUP_LIST_CLASS
        }${popoverClassName ? ` ${popoverClassName}` : ""}`}
        style={popoverStyle}
      >
        <ListBox
          className={
            grid
              ? "react-aria-ListBox property-select-grid"
              : "react-aria-ListBox"
          }
          layout={grid ? "grid" : undefined}
        >
          {open ? children : closedItems(children, selectedKey)}
        </ListBox>
      </Popover>
    </AriaSelect>
  );
}

/**
 * What a closed select gives RAC: the selected item alone (found by its `id` — directly or inside a
 * section). With nothing selected it is the first item — RAC does not open a select whose
 * collection is empty. Items it cannot read (a wrapping component without `id`) are given in full.
 */
function closedItems(children: ReactNode, selectedKey: Key | null): ReactNode {
  let readable = true;
  let first: ReactNode = null;
  const find = (nodes: ReactNode): ReactNode => {
    for (const node of Children.toArray(nodes)) {
      if (!isValidElement<{ id?: Key; children?: ReactNode }>(node)) continue;
      const { id, children: inner } = node.props;
      if (id !== undefined) {
        if (id === selectedKey) return node;
        first ??= node;
      } else if (inner === undefined || typeof inner === "function") {
        readable = false;
      } else {
        const found = find(inner);
        if (found) return found;
      }
    }
    return null;
  };
  const selected = find(children);
  return selected ?? (readable ? first : children);
}

/** ▾ 자리 — Select 와 팝오버 trigger 가 같은 상자 (`.select-chevron`, form-controls.css). 기본 그림 ChevronDown */
export function SelectChevron({ children }: { children?: ReactNode }) {
  return (
    <span aria-hidden="true" className="select-chevron">
      {children ?? <ChevronDown size={iconProps.size} />}
    </span>
  );
}

export interface PanelSelectItemProps {
  id: string;
  label: string;
  /** 이름 아래 둘째 줄 (필드 유형의 한 줄 설명) */
  description?: string;
  /** 이름 오른쪽 짧은 정보 (필드 유형 · 행 수) — 한 줄 28 행 */
  detail?: string;
  /** 이름 앞 색 점 (CSS 색) */
  swatch?: string;
}

export function PanelSelectItem({
  id,
  label,
  description,
  detail,
  swatch,
}: PanelSelectItemProps) {
  return (
    <ListBoxItem id={id} textValue={label} className="react-aria-ListBoxItem">
      {swatch != null && (
        <span
          aria-hidden="true"
          className="property-swatch property-select__swatch"
          // 모양은 클래스 (PropertySelectGrid.css) · 변하는 색만 인라인
          style={{ background: swatch }}
        />
      )}
      {description ? (
        <span className="property-select__option-text">
          <Text slot="label">{label}</Text>
          <Text
            slot="description"
            className="property-select__option-description"
          >
            {description}
          </Text>
        </span>
      ) : detail ? (
        <span className="property-select__option-row">
          <span className="property-select__option-label">{label}</span>
          <span className="property-select__option-detail">{detail}</span>
        </span>
      ) : (
        label
      )}
    </ListBoxItem>
  );
}
