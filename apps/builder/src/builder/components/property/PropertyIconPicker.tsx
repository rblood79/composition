/**
 * PropertyIconPicker - 인라인 아이콘 선택 Property 필드
 *
 * Input 폼 스타일 + 클릭 시 IconPickerPopover 팝오버
 * 아이콘 존재 시 우측 삭제 버튼 표시 (PropertySelect chevron 위치)
 *
 * fieldset-legend 구조 (PropertyFieldset 패턴 준수)
 */

import { memo, useCallback } from "react";
import { Button } from "react-aria-components/Button";
import { ChevronDown, X } from "lucide-react";
import { IconPreview } from "../../panels/icons/components/IconPreview";
import { IconPickerPopover } from "../../panels/icons/IconPickerPopover";
import { iconProps } from "../../../utils/ui/uiConstants";
import { useControlPopoverMetrics } from "./useControlPopoverMetrics";
import {
  semanticLabelKeys,
  translateKey,
  useOptionalI18n,
} from "../../../i18n";
import "../../panels/icons/IconPickerPopover.css";

export interface PropertyIconPickerProps {
  label: string;
  value?: string;
  onChange: (iconName: string) => void;
  onClear?: () => void;
  /** `suffix` — legend 없이 라벨을 상자 안 우측 10 mono (「None ICON ▾」, panel-ui 07 — 대조 B13) */
  labelMode?: "legend" | "suffix";
}

export const PropertyIconPicker = memo(function PropertyIconPicker({
  label: rawLabel,
  value,
  onChange,
  onClear,
  labelMode = "legend",
}: PropertyIconPickerProps) {
  const hasIcon = !!value;
  const i18n = useOptionalI18n();
  const localize = (text: string) =>
    i18n ? translateKey(i18n.t, semanticLabelKeys[text] ?? text, text) : text;
  const label = localize(rawLabel);
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
    <fieldset
      className="properties-aria"
      data-label-mode={labelMode}
      aria-label={labelMode === "suffix" ? label : undefined}
    >
      {labelMode === "legend" && (
        <legend className="fieldset-legend">{label}</legend>
      )}
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
              {hasIcon ? value : localize("None")}
            </span>
            {labelMode === "suffix" && (
              <>
                <span className="property-field__suffix" aria-hidden="true">
                  {label}
                </span>
                {!hasIcon && (
                  <span aria-hidden="true" className="select-chevron">
                    <ChevronDown size={iconProps.size} />
                  </span>
                )}
              </>
            )}
          </Button>
        </IconPickerPopover>
        {hasIcon && (
          <Button
            className="icon-picker-clear"
            aria-label={localize("Clear icon")}
            onPress={handleClear}
          >
            <X size={iconProps.size} strokeWidth={iconProps.strokeWidth} />
          </Button>
        )}
      </div>
    </fieldset>
  );
});
