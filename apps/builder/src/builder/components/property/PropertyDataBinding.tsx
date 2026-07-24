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

/**
 * 데이터 갱신 모드 — **read 호환 전용 (오소링 UI 제거됨, 2026-07-24)**.
 *
 * **Why 제거**: (1) RAC/RSP 어느 collection 레퍼런스에도 "갱신 주기" 개념이 없다
 * (RAC 비동기 표면은 `useAsyncList` 의 load/loadMore/reload/sort + loadingState/
 * onLoadMore 뿐) → D2 기준 RSP 미규정 prop. (2) 유일한 소비처인 `useCollectionData`
 * auto-refresh effect 가 `if (!isApiBinding) return` 로 시작하는데, ADR-159 P4b 로
 * 오소링이 `source:"dataTable"` 고정이라 신규 바인딩은 항상 발화 0. (3) `"onMount"`
 * 는 api 바인딩에서조차 소비처 0건 (effect 가 `"interval"` 만 분기).
 *
 * 기존 저장 문서의 값은 편집 시에도 보존한다 (`handleNameChange`/`handlePathBlur` 가
 * `value?.refreshMode` 를 그대로 재기록). 타입·필드·소비 effect 물리 제거는 api
 * 바인딩 잔존 문서 실측이 필요하므로 ADR-159 P4c 의 G4 게이트와 함께 처리.
 */
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

  // 갱신 모드/간격 오소링 핸들러는 제거됨 (2026-07-24) — 근거는 RefreshMode 주석 참조.
  // 기존 저장값 보존은 handleNameChange / handlePathBlur 의 재기록이 담당한다.

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
    <PropertyFieldset legend={label} icon={Link2} className={className}>
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
              aria-label="컬렉션"
              isDisabled={disabled}
            >
              <Button
                className="react-aria-Button"
                ref={nameSelectFocus.triggerRef}
              >
                <SelectValue>
                  {({ isPlaceholder, selectedText }) =>
                    isPlaceholder ? "컬렉션 선택..." : selectedText
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
            <div className="binding-empty">등록된 Collection 이 없습니다.</div>
          )}

          {/* 해제 버튼은 Select 렌더 여부와 무관하게 노출 — collection 이 0개인
              상태에서도 기존(legacy 포함) 바인딩을 제거할 수 있어야 한다. */}
          {value && (
            <button
              className="binding-clear"
              onClick={handleClear}
              type="button"
              aria-label="바인딩 제거"
              disabled={disabled}
            >
              <X size={iconEditProps.size} />
            </button>
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
      </div>
    </PropertyFieldset>
  );
});

export default PropertyDataBinding;
