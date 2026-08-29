/**
 * PropertyIconPicker - 인라인 아이콘 선택 Property 필드
 *
 * Input 폼 스타일 + 클릭 시 IconPickerPopover 팝오버
 * 아이콘 존재 시 우측 삭제 버튼 표시 (PropertySelect chevron 위치)
 *
 * fieldset-legend 구조 (PropertyFieldset 패턴 준수)
 */

import { memo, useCallback } from "react";
import { Button } from "react-aria-components";
import { X } from "lucide-react";
import { IconPreview } from "../../panels/icons/components/IconPreview";
import { IconPickerPopover } from "../../panels/icons/IconPickerPopover";
import { iconProps } from "../../../utils/ui/uiConstants";
import { useControlPopoverMetrics } from "./useControlPopoverMetrics";
import "../../panels/icons/IconPickerPopover.css";

export interface PropertyIconPickerProps {
  label: string;
  value?: string;
  onChange: (iconName: string) => void;
  onClear?: () => void;
}

export const PropertyIconPicker = memo(function PropertyIconPicker({
  label,
  value,
  onChange,
  onClear,
}: PropertyIconPickerProps) {
  const hasIcon = !!value;
  // 팝오버는 아이콘 선택 여부와 무관하게 **입력 폼 박스**와 같은 좌측·폭으로 떠야 한다.
  // 트리거 버튼은 미리보기/clear 유무로 폭이 바뀌므로 group 기준으로 실측한다.
  const { anchorRef, controlRef, popoverStyle } = useControlPopoverMetrics({
    widthMode: "width",
  });

  const handleClear = useCallback(() => {
    if (onClear) {
      onClear();
    } else {
      onChange("");
    }
  }, [onClear, onChange]);

  return (
    <fieldset className="properties-aria">
      <legend className="fieldset-legend">{label}</legend>
      <div className="react-aria-control react-aria-Group" ref={anchorRef}>
        <IconPickerPopover
          value={value || "circle"}
          onSelect={onChange}
          popoverStyle={popoverStyle}
        >
          <Button
            className="react-aria-Button icon-picker-input-trigger"
            ref={controlRef}
          >
            {hasIcon && (
              <label className="control-label">
                <IconPreview name={value} size={iconProps.size} />
              </label>
            )}
            <span className="icon-picker-value">
              {hasIcon ? value : "None"}
            </span>
          </Button>
        </IconPickerPopover>
        {hasIcon && (
          <Button
            className="icon-picker-clear"
            aria-label="Clear icon"
            onPress={handleClear}
          >
            <X size={iconProps.size} strokeWidth={iconProps.strokeWidth} />
          </Button>
        )}
      </div>
    </fieldset>
  );
});
