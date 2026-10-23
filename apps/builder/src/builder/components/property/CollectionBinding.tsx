import { useParams } from "react-router";
/**
 * CollectionBinding Component
 *
 * Property Editor에서 요소 속성을 Data Source에 바인딩할 수 있는 UI
 *
 * Features:
 * - 컬렉션 선택
 * - 항목 ID · 아이콘 · Tree 구조 필드 매핑
 * - 단일 항목 key 설정
 *
 * @example
 * <CollectionBinding
 *   label="데이터 소스"
 *   value={currentProps.dataBinding}
 *   onChange={(binding) => updateProp('dataBinding', binding)}
 * />
 */

import { useI18n } from "@/i18n";
import type { DataBindingValue } from "@composition/shared";
import { resolveBoundCollection, resolveField } from "@composition/shared";
import { ChevronDown, DatabasePlus, Link2, ListTree, X } from "lucide-react";
import React, { memo, useCallback } from "react";
import { Button } from "react-aria-components/Button";
import { ListBox, ListBoxItem } from "react-aria-components/ListBox";
import { Popover } from "react-aria-components/Popover";
import {
  Select as AriaSelect,
  SelectValue,
} from "react-aria-components/Select";
import type { DataField } from "../../../types/builder/data.types";
import { iconProps } from "../../../utils/ui/uiConstants";
import { useDataTableEditorStore } from "../../panels/datatable/stores/dataTableEditorStore";
import { useQuickConnectHost } from "../../panels/datatable/usage/quickConnectHost";
import { useCollections } from "../../stores/data";
import { useOptionalCatalogWorkspace } from "../../catalogRuntime/react.runtime";
import {
  ActionIconButton,
  ActionTooltipTrigger,
  SwatchIconButton,
} from "../ui";
import "./CollectionBinding.css";
import { PropertyFieldset } from "./PropertyFieldset";
import { PropertyInput } from "./PropertyInput";
import { useControlPopoverMetrics } from "./useControlPopoverMetrics";
import { useSelectTriggerFocusRestore } from "./useSelectTriggerFocusRestore";

// ============================================
// Types
// ============================================

// `RefreshMode` / `DataBindingValue` 의 정본은 `@composition/shared` 의
// `collection.types.ts` 다 — 같은 wire 형상을 collection 컴포넌트 13종의
// `dataBinding` prop 이 소비하므로 패키지 하위 계층이 소유해야 한다.
// ADR-159 P4b/P4c(G4 게이트)의 read-호환 근거 주석도 그쪽에 있다.
// 종전에는 같은 shape 를 여기에도 선언해 두 벌이었고, 근거 주석은 이쪽에만
// 있어 shared 사본을 보는 쪽에서는 계약을 알 수 없었다.
export type { DataBindingValue, RefreshMode } from "@composition/shared";

interface CollectionBindingProps {
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
  /** The bound record — a Tree's binding offers the children role (`useTreeData.getChildren`). */
  elementId?: string;
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

/**
 * 바인딩이 고르는 열 역할 — 항목 key (`value`) 와 Tree 의 하위 관계. 글자 · 그림 칸은 항목 필드
 * 절이 행 template 의 `{field}` 로 연결한다 (icon 역할은 2026-10-24 삭제).
 */
type FieldMapRole = "value" | "children" | "parentId";
const FIELD_MAP_ROLES: readonly FieldMapRole[] = ["value"];
/** A Tree's binding also names its items' children (`useTreeData.getChildren`). */
const TREE_FIELD_MAP_ROLES: readonly FieldMapRole[] = [
  "value",
  "parentId",
  "children",
];
/** "자동" 옵션 키 — 선택 시 fieldMap 에서 그 역할을 지운다 (기존 휴리스틱). */
const FIELD_MAP_AUTO_KEY = "__auto__";
const FIELD_MAP_ROLE_LABEL: Record<
  FieldMapRole,
  "fieldMapValue" | "fieldMapChildren" | "fieldMapParentId"
> = {
  value: "fieldMapValue",
  children: "fieldMapChildren",
  parentId: "fieldMapParentId",
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
  const { triggerRef, restoreFocusOnClose } = useSelectTriggerFocusRestore();
  const { controlRef, popoverStyle } = useControlPopoverMetrics();
  const RoleIcon = role === "value" ? null : ListTree;
  const label = t(`propertiesPanel.${FIELD_MAP_ROLE_LABEL[role]}`);
  return (
    <div className="binding-row binding-fieldmap-row">
      <AriaSelect
        className="react-aria-Select binding-fieldmap-select"
        data-role={role}
        ref={controlRef}
        selectedKey={selectedFieldId ?? FIELD_MAP_AUTO_KEY}
        onSelectionChange={(key) => onChange(role, key)}
        onOpenChange={restoreFocusOnClose}
        aria-label={label}
        isDisabled={disabled}
      >
        <Button className="react-aria-Button" ref={triggerRef}>
          {RoleIcon && (
            <span aria-hidden="true" className="binding-fieldmap-role">
              <RoleIcon size={iconProps.size} />
            </span>
          )}
          <SelectValue>
            {({ selectedText }) => `${label}: ${selectedText ?? ""}`}
          </SelectValue>
          <span aria-hidden="true" className="select-chevron">
            <ChevronDown size={iconProps.size} />
          </span>
        </Button>
        <Popover
          className="react-aria-Popover property-select-popover"
          style={popoverStyle}
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

export const CollectionBinding = memo(function CollectionBinding({
  label,
  icon: Icon,
  value,
  onChange,
  className,
  disabled,
  elementId,
}: CollectionBindingProps) {
  const { t } = useI18n();
  const workspace = useOptionalCatalogWorkspace();
  const ruleId =
    workspace && elementId
      ? workspace.root.domInputs.get(elementId)?.ruleId
      : undefined;
  const isTree = ruleId === "Tree";
  // `useListData.getItem(key)` — Form 이 한 항목을 읽어 필드를 채운다. 컬렉션 컴포넌트에 두면 목록이
  // 그 한 항목만 보여 입력을 두지 않는다 (2026-10-24 사용자 「Item key 를 Form 에만」).
  const readsOneItem = ruleId === "Form";
  const fieldMapRoles = isTree ? TREE_FIELD_MAP_ROLES : FIELD_MAP_ROLES;
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

  // ADR-152 Phase 2 — fieldMap (value · Tree 하위 관계 한정; 글자 · 그림 칸은 ADR-159 `{field}`
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
      else {
        next[role] = String(key);
        if (role === "parentId") delete next.children;
        if (role === "children") delete next.parentId;
      }
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

  // 바인딩 표현식 프리뷰
  const bindingExpression = value
    ? `{{${value.source}.${value.name}${value.path ? "." + value.path : ""}}}`
    : "";

  // popover 닫힘 전환 gap 의 focus ring 깜빡임 방지 (Select 하나당 1개) —
  // 상세 주석은 useSelectTriggerFocusRestore.ts 참조
  const { triggerRef: nameTriggerRef, restoreFocusOnClose: restoreNameFocus } =
    useSelectTriggerFocusRestore();

  // 컬렉션 피커는 이 fieldset 의 field-level control 이므로, 팝오버를 패널 규약대로
  // control 외곽 박스(`.react-aria-Group`) 폭·좌측에 맞춘다 (PropertySelect /
  // PropertyUnitInput 과 동일 규약). anchor 는 PropertyFieldset 이 렌더하므로
  // controlRef 의 closest 자동 해석에 맡긴다.
  const { controlRef: nameControlRef, popoverStyle: namePopoverStyle } =
    useControlPopoverMetrics();

  return (
    <PropertyFieldset legend={label} icon={Icon ?? Link2} className={className}>
      <div className="property-data-binding">
        {/* collection(테이블명) 선택 — 소스 선택 단계 제거, dataTable 단일 (ADR-159 P4b).
            선택된 값은 Select 자신이 표시한다 — 별도 바인딩
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
              ref={nameControlRef}
              selectedKey={selectedCollectionId}
              onSelectionChange={handleNameChange}
              onOpenChange={restoreNameFocus}
              aria-label={t("propertiesPanel.bindingDataSource")}
              isDisabled={disabled}
            >
              <Button className="react-aria-Button" ref={nameTriggerRef}>
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
                style={namePopoverStyle}
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
        </div>

        {fieldOptions.length > 0 &&
          fieldMapRoles.map((role) => (
            <FieldMapSelect
              key={role}
              role={role}
              fields={
                role === "children"
                  ? fieldOptions.filter((field) => field.type === "array")
                  : role === "parentId"
                    ? fieldOptions.filter(
                        (field) =>
                          field.type === "string" || field.type === "number",
                      )
                    : fieldOptions
              }
              selectedFieldId={
                resolveField(fieldOptions, value?.fieldMap?.[role])?.id ?? null
              }
              onChange={handleFieldMapChange}
              disabled={disabled}
            />
          ))}

        {/* `useListData.getItem(key)` — 한 항목: 리터럴 key 또는 {{ params.id }} · {{ 변수 }} */}
        {selectedCollectionId && readsOneItem && (
          <PropertyInput
            label={t("propertiesPanel.bindingItemKey")}
            value={value?.key ?? ""}
            placeholder="{{ params.id }}"
            onChange={(text) => {
              if (!value) return;
              const key = text.trim();
              onChange({ ...value, key: key || undefined });
            }}
          />
        )}

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

/** 새 테이블 생성 — Collection 헤더 또는 일반 데이터 바인딩의 행 액션. */
export const CollectionBindingCreateAction = memo(
  function CollectionBindingCreateAction({
    disabled,
    elementId,
    inHeader = false,
  }: {
    disabled?: boolean;
    elementId?: string;
    inHeader?: boolean;
  }) {
    const { t } = useI18n();
    const { projectId } = useParams<{ projectId: string }>();
    const openTableCreator = useDataTableEditorStore((s) => s.openTableCreator);
    const quickConnect = useQuickConnectHost();
    if (!projectId) return null;
    const label = t("propertiesPanel.bindingNewTable");
    const onPress = () => {
      const connect = elementId ? quickConnect.capture(elementId) : null;
      if (connect) openTableCreator(projectId, connect);
      else openTableCreator(projectId);
    };
    const icon = (
      <DatabasePlus
        aria-hidden="true"
        size={iconProps.size}
        strokeWidth={iconProps.strokeWidth}
      />
    );
    return inHeader ? (
      <ActionIconButton
        aria-label={label}
        tooltip={label}
        isDisabled={disabled}
        onPress={onPress}
      >
        {icon}
      </ActionIconButton>
    ) : (
      <ActionTooltipTrigger tooltip={label}>
        <SwatchIconButton
          aria-label={label}
          isDisabled={disabled}
          onPress={onPress}
        >
          {icon}
        </SwatchIconButton>
      </ActionTooltipTrigger>
    );
  },
);

/** 선택된 바인딩의 행 액션. Collection의 생성 액션은 헤더에 둔다. */
export const CollectionBindingActions = memo(function CollectionBindingActions({
  disabled,
  elementId,
  onClear,
  showCreate = true,
}: {
  disabled?: boolean;
  elementId?: string;
  /** 바인딩이 있을 때만 제공. 삭제된 collection 및 legacy 바인딩도 해제할 수 있다. */
  onClear?: () => void;
  showCreate?: boolean;
}) {
  const { t } = useI18n();
  const { projectId } = useParams<{ projectId: string }>();
  if (!onClear && (!showCreate || !projectId)) return null;
  const clearLabel = t("propertiesPanel.removeBinding");
  return (
    <div className="fieldset-actions actions-binding">
      {onClear && (
        <ActionTooltipTrigger tooltip={clearLabel}>
          <SwatchIconButton
            aria-label={clearLabel}
            isDisabled={disabled}
            onPress={onClear}
          >
            <X aria-hidden="true" {...iconProps} />
          </SwatchIconButton>
        </ActionTooltipTrigger>
      )}
      {showCreate && (
        <CollectionBindingCreateAction
          elementId={elementId}
          disabled={disabled}
        />
      )}
    </div>
  );
});

export default CollectionBinding;
