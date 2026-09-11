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
  SelectValue,
} from "react-aria-components/Select";
import { Button } from "react-aria-components/Button";
import { Popover } from "react-aria-components/Popover";
import { ListBox, ListBoxItem } from "react-aria-components/ListBox";
import { ChevronDown, Image, KeyRound, Link2, X } from "lucide-react";
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
import { resolveBoundCollection, resolveField } from "@composition/shared";
import type { DataField } from "../../../types/builder/data.types";
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

type FieldMapRole = "value" | "icon";
const FIELD_MAP_ROLES: readonly FieldMapRole[] = ["value", "icon"];
/** "자동" 옵션 키 — 선택 시 fieldMap 에서 그 역할을 지운다 (기존 휴리스틱). */
const FIELD_MAP_AUTO_KEY = "__auto__";
const FIELD_MAP_ROLE_ICON: Record<FieldMapRole, typeof KeyRound> = {
  value: KeyRound,
  icon: Image,
};
const FIELD_MAP_ROLE_LABEL: Record<FieldMapRole, "fieldMapValue" | "fieldMapIcon"> = {
  value: "fieldMapValue",
  icon: "fieldMapIcon",
};

/** 역할 1개 = Select 1행 — 옵션은 "자동" + schema 필드 (키 = fieldId, 표시 = key). */
function FieldMapSelect({
  role,
  fields,
  selectedFieldId,
  onChange,
  disabled,
}: {
  role: FieldMapRole;
  fields: readonly DataField[];
  selectedFieldId: string | null;
  onChange: (role: FieldMapRole, key: React.Key | null) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const focus = useSelectTriggerFocusRestore();
  const popover = useControlPopoverMetrics();
  const RoleIcon = FIELD_MAP_ROLE_ICON[role];
  const label = t(`propertiesPanel.${FIELD_MAP_ROLE_LABEL[role]}`);
  return (
    <div className="binding-row binding-fieldmap-row">
      <AriaSelect
        className="react-aria-Select binding-fieldmap-select"
        data-role={role}
        ref={popover.controlRef}
        selectedKey={selectedFieldId ?? FIELD_MAP_AUTO_KEY}
        onSelectionChange={(key) => onChange(role, key)}
        onOpenChange={focus.restoreFocusOnClose}
        aria-label={label}
        isDisabled={disabled}
      >
        <Button className="react-aria-Button" ref={focus.triggerRef}>
          <span aria-hidden="true" className="binding-fieldmap-role">
            <RoleIcon size={iconProps.size} />
          </span>
          <SelectValue>
            {({ selectedText }) => `${label}: ${selectedText ?? ""}`}
          </SelectValue>
          <span aria-hidden="true" className="select-chevron">
            <ChevronDown size={iconProps.size} />
          </span>
        </Button>
        <Popover
          className="react-aria-Popover property-select-popover"
          style={popover.popoverStyle}
        >
          <ListBox className="react-aria-ListBox">
            <ListBoxItem
              id={FIELD_MAP_AUTO_KEY}
              className="react-aria-ListBoxItem"
              textValue={t("propertiesPanel.fieldMapAuto")}
            >
              {t("propertiesPanel.fieldMapAuto")}
            </ListBoxItem>
            {fields.map((field) => (
              <ListBoxItem
                key={field.id}
                id={field.id as string}
                className="react-aria-ListBoxItem"
                textValue={field.key}
              >
                <div className="binding-option">
                  <span className="binding-option-label">{field.key}</span>
                  <span className="binding-option-desc">{field.type}</span>
                </div>
              </ListBoxItem>
            ))}
          </ListBox>
        </Popover>
      </AriaSelect>
    </div>
  );
}

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
  const path = value?.path || "";
  // 기존 저장 문서의 api/variable/route 바인딩 — read 표시만 (신규 기록은 dataTable 고정).
  const isLegacyNonTableBinding = Boolean(source) && source !== "dataTable";

  // ADR-152 v2: 옵션 키는 collection **id** — 선택 표시는 id 우선 · name fallback
  // (v1 바인딩도 같은 옵션을 가리킨다). 저장은 `collectionId` + `name` 둘 다.
  const nameOptions = collections.map((dt) => ({
    value: dt.id,
    label: dt.name,
    description: dt.description,
  }));
  const selectedCollectionId =
    source === "dataTable"
      ? (resolveBoundCollection(value, collections)?.id ?? null)
      : null;

  // collection 선택 — 신규 기록은 source:"dataTable" 고정 (ADR-159 P4b) + collectionId (ADR-152)
  const handleNameChange = useCallback(
    (key: React.Key | null) => {
      const target = collections.find((dt) => dt.id === key);
      if (!target) return;
      onChange({
        source: "dataTable",
        collectionId: target.id,
        name: target.name,
        // fieldMap 은 같은 collection 안에서만 의미 — collection 이 바뀌면 비운다.
        fieldMap:
          value?.collectionId === target.id ? value?.fieldMap : undefined,
        // legacy 비-dataTable 바인딩에서 전환 시 path/갱신 설정은 초기화 (의미 소멸).
        path: isLegacyNonTableBinding ? undefined : path || undefined,
        refreshMode: isLegacyNonTableBinding ? undefined : value?.refreshMode,
        refreshInterval: isLegacyNonTableBinding
          ? undefined
          : value?.refreshInterval,
      });
    },
    [
      collections,
      isLegacyNonTableBinding,
      path,
      value?.collectionId,
      value?.fieldMap,
      value?.refreshMode,
      value?.refreshInterval,
      onChange,
    ],
  );

  // ADR-152 Phase 2 — fieldMap (value / icon 한정; label/description 은 ADR-159 `{field}`
  // 템플릿이 정본). 값은 **fieldId** (v2.1) — v1 key 저장값은 resolveField 가 id 로 올린다.
  // 노출 조건: 선택 collection 에 id 있는 필드가 있을 때만 (없으면 표면은 컬렉션 1행).
  const selectedCollection =
    selectedCollectionId !== null
      ? (collections.find((dt) => dt.id === selectedCollectionId) ?? null)
      : null;
  const fieldOptions: readonly DataField[] = (
    selectedCollection?.schema ?? []
  ).filter((field) => typeof field.id === "string" && field.id.length > 0);
  const handleFieldMapChange = useCallback(
    (role: FieldMapRole, key: React.Key | null) => {
      if (!value) return;
      const next = { ...(value.fieldMap ?? {}) };
      if (key === null || key === FIELD_MAP_AUTO_KEY) delete next[role];
      else next[role] = String(key);
      onChange({
        ...value,
        fieldMap: Object.keys(next).length > 0 ? next : undefined,
      });
    },
    [value, onChange],
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
              selectedKey={selectedCollectionId}
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

        {fieldOptions.length > 0 &&
          FIELD_MAP_ROLES.map((role) => (
            <FieldMapSelect
              key={role}
              role={role}
              fields={fieldOptions}
              selectedFieldId={
                resolveField(fieldOptions, value?.fieldMap?.[role])?.id ??
                null
              }
              onChange={handleFieldMapChange}
              disabled={disabled}
            />
          ))}

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
