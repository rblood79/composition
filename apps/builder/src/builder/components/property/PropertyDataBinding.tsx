/**
 * PropertyDataBinding Component
 *
 * Property Editor에서 요소 속성을 Data Source에 바인딩할 수 있는 UI
 *
 * Features:
 * - DataTable, ApiEndpoint, Variable 선택
 * - 데이터 경로 (path) 설정
 * - 바인딩 표현식 프리뷰
 *
 * @example
 * <PropertyDataBinding
 *   label="데이터 소스"
 *   value={currentProps.dataBinding}
 *   onChange={(binding) => updateProp('dataBinding', binding)}
 * />
 */

import React, { useCallback, memo } from "react";
import {
  Select as AriaSelect,
  Button,
  SelectValue,
  Popover,
  ListBox,
  ListBoxItem,
} from "react-aria-components";
import { ChevronDown, Link2, X } from "lucide-react";
import { iconProps, iconEditProps } from "../../../utils/ui/uiConstants";
import { PropertyFieldset } from "./PropertyFieldset";
import { useSelectTriggerFocusRestore } from "./useSelectTriggerFocusRestore";
import { useControlPopoverMetrics } from "./useControlPopoverMetrics";
import { useCollections } from "../../stores/data";
import "./PropertyDataBinding.css";

// ============================================
// Types
// ============================================

// `RefreshMode` / `DataBindingValue` 의 정본은 `@composition/shared` 의
// `collection.types.ts` 다 — 같은 wire 형상을 collection 컴포넌트 13종의
// `dataBinding` prop 이 소비하므로 패키지 하위 계층이 소유해야 한다.
// ADR-159 P4b/P4c(G4 게이트)의 read-호환 근거 주석도 그쪽에 있다.
// 종전에는 같은 shape 를 여기에도 선언해 두 벌이었고, 근거 주석은 이쪽에만
// 있어 shared 사본을 보는 쪽에서는 계약을 알 수 없었다.
export type { RefreshMode, DataBindingValue } from "@composition/shared";
import type { DataBindingValue } from "@composition/shared";
import { useI18n } from "@/i18n";

interface PropertyDataBindingProps {
  /** 라벨 */
  label?: string;
  /** 현재 바인딩 값 */
  value?: DataBindingValue | null;
  /** 바인딩 변경 시 콜백 */
  onChange: (value: DataBindingValue | null) => void;
  /** 추가 클래스 */
  className?: string;
  /** 비활성화 */
  disabled?: boolean;
  icon?: React.ComponentType<{
    color?: string;
    size?: number;
    strokeWidth?: number;
  }>;
}

// ============================================
// Component
// ============================================
// ADR-159 P4b: SOURCE_OPTIONS 4종(dataTable/api/variable/route) 소스 선택 UI 제거 —
//   데이터 소스는 dataTable(collection) 단일. 피커는 collection(테이블명) 선택만 노출.

export const PropertyDataBinding = memo(function PropertyDataBinding({
  label,
  icon: Icon,
  value,
  onChange,
  className,
  disabled,
}: PropertyDataBindingProps) {
  const { t } = useI18n();
  // Data Store에서 collection 목록 가져오기 (dataTable 단일 소스 — ADR-159 P4b)
  const collections = useCollections();

  // 직접 prop 값 사용 (fully controlled)
  const source = value?.source || "";
  const name = value?.name || "";
  const path = value?.path || "";
  // 기존 저장 문서의 api/variable/route 바인딩 — read 표시만 (신규 기록은 dataTable 고정).
  const isLegacyNonTableBinding = Boolean(source) && source !== "dataTable";

  const nameOptions = collections.map((dt) => ({
    value: dt.name,
    label: dt.name,
    description: dt.description,
  }));

  // collection(테이블명) 선택 — 신규 기록은 source:"dataTable" 고정 (ADR-159 P4b)
  const handleNameChange = useCallback(
    (key: React.Key | null) => {
      const newName = key as string;
      if (!newName) return;
      onChange({
        source: "dataTable",
        name: newName,
        // legacy 비-dataTable 바인딩에서 전환 시 path/갱신 설정은 초기화 (의미 소멸).
        path: isLegacyNonTableBinding ? undefined : path || undefined,
        refreshMode: isLegacyNonTableBinding ? undefined : value?.refreshMode,
        refreshInterval: isLegacyNonTableBinding
          ? undefined
          : value?.refreshInterval,
      });
    },
    [
      isLegacyNonTableBinding,
      path,
      value?.refreshMode,
      value?.refreshInterval,
      onChange,
    ],
  );

  // 데이터 경로 / 갱신 모드 / 갱신 간격 오소링 핸들러는 제거됨 (2026-07-24) —
  // 근거는 DataBindingValue.path / RefreshMode 주석 참조. 기존 저장값 보존은
  // handleNameChange 의 재기록이 담당한다 (컬렉션을 바꿔도 값이 유실되지 않음).

  // 바인딩 제거
  const handleClear = useCallback(() => {
    onChange(null);
  }, [onChange]);

  // 바인딩 표현식 프리뷰
  const bindingExpression = value
    ? `{{${value.source}.${value.name}${value.path ? "." + value.path : ""}}}`
    : "";

  // popover 닫힘 전환 gap 의 focus ring 깜빡임 방지 (Select 하나당 1개) —
  // 상세 주석은 useSelectTriggerFocusRestore.ts 참조
  const nameSelectFocus = useSelectTriggerFocusRestore();

  // 컬렉션 피커는 이 fieldset 의 field-level control 이므로, 팝오버를 패널 규약대로
  // control 외곽 박스(`.react-aria-Group`) 폭·좌측에 맞춘다 (PropertySelect /
  // PropertyUnitInput 과 동일 규약). anchor 는 PropertyFieldset 이 렌더하므로
  // controlRef 의 closest 자동 해석에 맡긴다.
  const nameSelectPopover = useControlPopoverMetrics();

  return (
    <PropertyFieldset legend={label} icon={Icon ?? Link2} className={className}>
      <div className="property-data-binding">
        {/* collection(테이블명) 선택 — 소스 선택 단계 제거, dataTable 단일 (ADR-159 P4b).
            선택된 값은 Select 자신이 표시하고 해제 버튼만 옆에 둔다 — 별도 바인딩
            표현식 preview 행은 제거했다.
            **Why**: SelectValue 가 `"컬렉션 선택..."` 문자열 하드코딩이라 선택값을
            표시하지 못했고, 그 공백을 메우려고 preview 행이 선택 상태를 중복 표기하던
            구조였다. SelectValue 를 render prop 으로 되돌리면 표준 Select 동작
            (선택값 표시 / 미선택 시 placeholder) 만으로 한 행에 담긴다.
            전체 표현식(`{{dataTable.Users}}`)은 행 title 로 보존. */}
        <div
          className="binding-row binding-name-row"
          title={bindingExpression || undefined}
        >
          {nameOptions.length > 0 ? (
            <AriaSelect
              className="react-aria-Select binding-name-select"
              ref={nameSelectPopover.controlRef}
              selectedKey={source === "dataTable" ? name || null : null}
              onSelectionChange={handleNameChange}
              onOpenChange={nameSelectFocus.restoreFocusOnClose}
              aria-label={t("propertiesPanel.collection")}
              isDisabled={disabled}
            >
              <Button
                className="react-aria-Button"
                ref={nameSelectFocus.triggerRef}
              >
                <SelectValue>
                  {({ isPlaceholder, selectedText }) =>
                    isPlaceholder
                      ? t("propertiesPanel.collectionPlaceholder")
                      : selectedText
                  }
                </SelectValue>
                <span aria-hidden="true" className="select-chevron">
                  <ChevronDown size={iconProps.size} />
                </span>
              </Button>
              <Popover
                className="react-aria-Popover property-select-popover"
                style={nameSelectPopover.popoverStyle}
              >
                <ListBox className="react-aria-ListBox">
                  {nameOptions.map((option) => (
                    <ListBoxItem
                      key={option.value}
                      id={option.value}
                      className="react-aria-ListBoxItem"
                      textValue={option.label}
                    >
                      <div className="binding-option">
                        <span className="binding-option-label">
                          {option.label}
                        </span>
                        {option.description && (
                          <span className="binding-option-desc">
                            {option.description}
                          </span>
                        )}
                      </div>
                    </ListBoxItem>
                  ))}
                </ListBox>
              </Popover>
            </AriaSelect>
          ) : (
            <div className="binding-empty">
              {t("propertiesPanel.collectionEmpty")}
            </div>
          )}

          {/* 해제 버튼은 Select 렌더 여부와 무관하게 노출 — collection 이 0개인
              상태에서도 기존(legacy 포함) 바인딩을 제거할 수 있어야 한다. */}
          {value && (
            <button
              className="binding-clear"
              onClick={handleClear}
              type="button"
              aria-label={t("propertiesPanel.removeBinding")}
              disabled={disabled}
            >
              <X size={iconEditProps.size} />
            </button>
          )}
        </div>

        {/* 기존 문서의 비-dataTable 바인딩 안내 (read 호환 — 신규 기록은 dataTable 고정) */}
        {isLegacyNonTableBinding && (
          <div className="binding-empty">
            {t("propertiesPanel.legacyBinding", { source })}
          </div>
        )}
      </div>
    </PropertyFieldset>
  );
});

export default PropertyDataBinding;
