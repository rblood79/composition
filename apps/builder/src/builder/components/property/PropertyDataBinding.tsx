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
import { ChevronDown, Link2, X, RefreshCw } from "lucide-react";
import { iconProps, iconEditProps } from "../../../utils/ui/uiConstants";
import { PropertyFieldset } from "./PropertyFieldset";
import { useSelectTriggerFocusRestore } from "./useSelectTriggerFocusRestore";
import { useControlPopoverMetrics } from "./useControlPopoverMetrics";
import { useCollections } from "../../stores/data";
import "./PropertyDataBinding.css";

// ============================================
// Constants
// ============================================

const REFRESH_MODE_OPTIONS = [
  {
    value: "manual",
    label: "수동 갱신",
    description: "직접 갱신 호출 시에만 새로고침",
  },
  {
    value: "onMount",
    label: "마운트 시",
    description: "컴포넌트 마운트 시 1회 갱신",
  },
  {
    value: "interval",
    label: "주기적",
    description: "설정된 간격으로 자동 갱신",
  },
] as const;

// ============================================
// Types
// ============================================

/** 데이터 갱신 모드 */
export type RefreshMode = "manual" | "onMount" | "interval";

export interface DataBindingValue {
  /**
   * 바인딩 소스 타입.
   *
   * **ADR-159 P4b (2026-07-24)**: 오소링(신규 기록)은 `"dataTable"` 단일 — composition 의
   * 데이터 방향은 모든 동적·정적 데이터를 collection 방식(ADR-132 계보)으로 처리한다.
   * `"api" | "variable" | "route"` 는 기존 저장 문서 read 호환용 잔존 타입 (runtime
   * dispatch 는 P4c 에서 소비처 0 확증 후 정리 — G4 게이트).
   */
  source: "dataTable" | "api" | "variable" | "route";
  /** 소스 이름 */
  name: string;
  /** 데이터 경로 (예: "items[0].name", "user.email") */
  path?: string;
  /** 기본값 */
  defaultValue?: unknown;
  /** 갱신 모드 (기본: manual) */
  refreshMode?: RefreshMode;
  /** 갱신 간격 (ms, interval 모드에서 사용) */
  refreshInterval?: number;
}

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
}

// ============================================
// Component
// ============================================
// ADR-159 P4b: SOURCE_OPTIONS 4종(dataTable/api/variable/route) 소스 선택 UI 제거 —
//   데이터 소스는 dataTable(collection) 단일. 피커는 collection(테이블명) 선택만 노출.

export const PropertyDataBinding = memo(function PropertyDataBinding({
  label = "데이터 바인딩",
  value,
  onChange,
  className,
  disabled,
}: PropertyDataBindingProps) {
  // Data Store에서 collection 목록 가져오기 (dataTable 단일 소스 — ADR-159 P4b)
  const collections = useCollections();

  // 직접 prop 값 사용 (fully controlled)
  const source = value?.source || "";
  const name = value?.name || "";
  const path = value?.path || "";
  const refreshMode = value?.refreshMode || "manual";
  const refreshInterval = value?.refreshInterval || 5000;
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

  // 경로 변경 (blur 시 저장) — dataTable 바인딩에서만 노출
  const handlePathBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const newPath = e.target.value;
      if (name) {
        onChange({
          source: "dataTable",
          name,
          path: newPath || undefined,
          refreshMode: value?.refreshMode,
          refreshInterval: value?.refreshInterval,
        });
      }
    },
    [name, value?.refreshMode, value?.refreshInterval, onChange],
  );

  // 갱신 모드 변경
  const handleRefreshModeChange = useCallback(
    (key: React.Key | null) => {
      const newMode = key as RefreshMode;
      if (name) {
        onChange({
          source: "dataTable",
          name,
          path: value?.path,
          refreshMode: newMode,
          refreshInterval:
            newMode === "interval" ? value?.refreshInterval || 5000 : undefined,
        });
      }
    },
    [name, value?.path, value?.refreshInterval, onChange],
  );

  // 갱신 간격 변경
  const handleRefreshIntervalBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const newInterval = parseInt(e.target.value, 10);
      if (name && !isNaN(newInterval) && newInterval > 0) {
        onChange({
          source: "dataTable",
          name,
          path: value?.path,
          refreshMode: "interval",
          refreshInterval: newInterval,
        });
      }
    },
    [name, value?.path, onChange],
  );

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
  const refreshSelectFocus = useSelectTriggerFocusRestore();

  // 컬렉션 피커는 이 fieldset 의 field-level control 이므로, 팝오버를 패널 규약대로
  // control 외곽 박스(`.react-aria-Group`) 폭·좌측에 맞춘다 (PropertySelect /
  // PropertyUnitInput 과 동일 규약). anchor 는 PropertyFieldset 이 렌더하므로
  // controlRef 의 closest 자동 해석에 맡긴다.
  //   갱신 모드 Select 는 라벨과 한 행을 나눠 쓰는 하위 control 이라 group 정렬 시
  //   trigger 보다 100px 이상 왼쪽으로 벗어난다 — RAC 기본(trigger 기준) 유지.
  const nameSelectPopover = useControlPopoverMetrics();

  return (
    <PropertyFieldset legend={label} icon={Link2} className={className}>
      <div className="property-data-binding">
        {/* 바인딩 표현식 프리뷰 */}
        {bindingExpression && (
          <div className="binding-preview">
            <code className="binding-expression">{bindingExpression}</code>
            <button
              className="binding-clear"
              onClick={handleClear}
              type="button"
              aria-label="바인딩 제거"
            >
              <X size={iconEditProps.size} />
            </button>
          </div>
        )}

        {/* collection(테이블명) 선택 — 소스 선택 단계 제거, dataTable 단일 (ADR-159 P4b) */}
        <div className="binding-row">
          {nameOptions.length > 0 ? (
            <AriaSelect
              className="react-aria-Select binding-name-select"
              ref={nameSelectPopover.controlRef}
              selectedKey={source === "dataTable" ? name || null : null}
              onSelectionChange={handleNameChange}
              onOpenChange={nameSelectFocus.restoreFocusOnClose}
              aria-label="컬렉션"
              isDisabled={disabled}
            >
              <Button
                className="react-aria-Button"
                ref={nameSelectFocus.triggerRef}
              >
                <SelectValue>{"컬렉션 선택..."}</SelectValue>
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
            <div className="binding-empty">등록된 Collection 이 없습니다.</div>
          )}
        </div>

        {/* 기존 문서의 비-dataTable 바인딩 안내 (read 호환 — 신규 기록은 dataTable 고정) */}
        {isLegacyNonTableBinding && (
          <div className="binding-empty">
            legacy {source} 바인딩 — 컬렉션 선택 시 dataTable 로 전환됩니다.
          </div>
        )}

        {/* 데이터 경로 입력 (dataTable 바인딩에서만) */}
        {source === "dataTable" && name && (
          <div className="binding-row">
            <input
              className="react-aria-Input binding-path-input"
              type="text"
              key={`path-${value?.source || ""}-${value?.name || ""}`}
              defaultValue={path}
              onBlur={handlePathBlur}
              placeholder="데이터 경로 (예: items[0].name)"
              disabled={disabled}
            />
          </div>
        )}

        {/* 갱신 설정 (dataTable) */}
        {source === "dataTable" && name && (
          <>
            <div className="binding-row binding-refresh-row">
              <label className="binding-row-label">
                <RefreshCw size={iconEditProps.size} />
                <span>갱신 모드</span>
              </label>
              <AriaSelect
                className="react-aria-Select binding-refresh-select"
                selectedKey={refreshMode}
                onSelectionChange={handleRefreshModeChange}
                onOpenChange={refreshSelectFocus.restoreFocusOnClose}
                aria-label="갱신 모드"
                isDisabled={disabled}
              >
                <Button
                  className="react-aria-Button"
                  ref={refreshSelectFocus.triggerRef}
                >
                  <SelectValue />
                  <span aria-hidden="true" className="select-chevron">
                    <ChevronDown size={iconProps.size} />
                  </span>
                </Button>
                <Popover className="react-aria-Popover">
                  <ListBox className="react-aria-ListBox">
                    {REFRESH_MODE_OPTIONS.map((option) => (
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
                          <span className="binding-option-desc">
                            {option.description}
                          </span>
                        </div>
                      </ListBoxItem>
                    ))}
                  </ListBox>
                </Popover>
              </AriaSelect>
            </div>

            {/* 갱신 간격 (interval 모드에서만) */}
            {refreshMode === "interval" && (
              <div className="binding-row binding-interval-row">
                <label className="binding-row-label">
                  <span>갱신 간격</span>
                </label>
                <div className="binding-interval-input">
                  <input
                    className="react-aria-Input"
                    type="number"
                    min="1000"
                    step="1000"
                    key={`interval-${value?.source || ""}-${value?.name || ""}`}
                    defaultValue={refreshInterval}
                    onBlur={handleRefreshIntervalBlur}
                    placeholder="5000"
                    disabled={disabled}
                  />
                  <span className="binding-interval-unit">ms</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PropertyFieldset>
  );
});

export default PropertyDataBinding;
