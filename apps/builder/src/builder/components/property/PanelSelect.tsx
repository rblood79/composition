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
 */
import { ChevronDown } from "lucide-react";
import type { CSSProperties, ReactNode, Ref } from "react";
import type { Key } from "react-aria-components/Collection";
import { useCallback } from "react";
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
  const handleOpenChange = useCallback(
    (open: boolean) => {
      onOpenChange?.(open);
      restoreFocusOnClose(open);
    },
    [onOpenChange, restoreFocusOnClose],
  );
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
          {children}
        </ListBox>
      </Popover>
    </AriaSelect>
  );
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
