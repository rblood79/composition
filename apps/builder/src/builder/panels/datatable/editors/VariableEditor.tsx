/**
 * VariableEditor - Variable 상세 편집 컴포넌트
 *
 * 기능:
 * - 기본 설정 (이름, 타입, scope)
 * - 기본값 설정 · persist
 *
 * Validation / Transform 절은 ADR-214 후속 (2026-09-14, 사용자 승인) 으로 삭제 — 소비처 0 실측
 * (`variable.validation` · `variable.transform` 을 읽는 코드가 편집기 자신뿐). 저장 형상의 두 필드는
 * legacy 데이터 호환으로 타입에만 남아 있다 (`data.types.ts`).
 */

import { useCallback } from "react";
import { Button } from "react-aria-components/Button";
import { useDataStore } from "../../../stores/data";
import { useStore } from "../../../stores";
import type {
  Variable as VariableType,
  VariableType as VarType,
  VariableScope,
} from "../../../../types/builder/data.types";
import {
  PropertyInput,
  PropertySelect,
  PropertySwitch,
} from "../../../components";
import "./VariableEditor.css";
import {
  semanticLabelKeys,
  translateKey,
  useOptionalI18n,
} from "../../../../i18n";

interface VariableEditorProps {
  variable: VariableType;
  onClose: () => void;
}

const VARIABLE_TYPES: { value: VarType; label: string }[] = [
  { value: "string", label: "String" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "object", label: "Object" },
  { value: "array", label: "Array" },
];

/**
 * `component` 는 소유 요소 id 가 없어 만들 수 없다 (ADR-214 — owner-unresolved 만 늘린다).
 * 이미 component 인 변수에만 현재 값으로 보여 준다.
 */
const VARIABLE_SCOPES: { value: VariableScope; label: string }[] = [
  { value: "global", label: "Global" },
  { value: "page", label: "Page" },
];
const LEGACY_COMPONENT_SCOPE: { value: VariableScope; label: string } = {
  value: "component",
  label: "Component",
};

export function VariableEditor({ variable, onClose }: VariableEditorProps) {
  const updateVariable = useDataStore((state) => state.updateVariable);

  // 업데이트
  const handleUpdate = useCallback(
    async (updates: Partial<VariableType>) => {
      try {
        await updateVariable(variable.id, updates);
      } catch (error) {
        console.error("Variable 업데이트 실패:", error);
      }
    },
    [variable.id, updateVariable],
  );

  // Note: onClose is handled by parent DataTableEditorPanel
  void onClose;

  return <BasicEditor variable={variable} onUpdate={handleUpdate} />;
}

// ============================================
// Basic Editor
// ============================================

interface BasicEditorProps {
  variable: VariableType;
  onUpdate: (updates: Partial<VariableType>) => void;
}

function BasicEditor({ variable, onUpdate }: BasicEditorProps) {
  const i18n = useOptionalI18n();
  const localize = (key: string, fallback: string) =>
    i18n ? translateKey(i18n.t, `datatable.${key}`, fallback) : fallback;
  const currentPageId = useStore((state) => state.currentPageId);
  const ownerPageTitle = useStore((state) =>
    variable.scope === "page"
      ? state.pages.find((page) => page.id === variable.page_id)?.title
      : undefined,
  );
  const scopeOptions =
    variable.scope === "component"
      ? [...VARIABLE_SCOPES, LEGACY_COMPONENT_SCOPE]
      : VARIABLE_SCOPES;
  // page 로 바꾸면 현재 페이지가 소유자 (page_id 필수) · global 로 바꾸면 소유 페이지 해제
  const handleScopeChange = (value: string) => {
    const scope = value as VariableScope;
    if (scope === "page") {
      if (!currentPageId) return;
      onUpdate({ scope, page_id: currentPageId });
      return;
    }
    onUpdate({ scope, page_id: undefined });
  };
  const defaultValueStr = formatDefaultValue(
    variable.defaultValue,
    variable.type,
  );

  const handleDefaultValueChange = (value: string) => {
    const parsed = parseDefaultValue(value, variable.type);
    onUpdate({ defaultValue: parsed });
  };

  return (
    <div className="basic-editor">
      <PropertySelect
        label="Type"
        value={variable.type}
        onChange={(value) => onUpdate({ type: value as VarType })}
        options={VARIABLE_TYPES}
      />

      {/* ADR-214 Phase 5 — 프로젝트 변수는 소유자가 고정 (scope 선택 없음). 구 page/component
          변수만 select 가 남아 Global 로 되돌릴 수 있다 (페이지 state 로의 이관은 Data 탭 인덱스). */}
      {variable.scope !== "global" && (
        <PropertySelect
          label="Scope"
          value={variable.scope}
          onChange={handleScopeChange}
          options={scopeOptions}
        />
      )}
      <p className="field-description">
        {variable.scope === "global" &&
          localize("globalHint", "Available on all pages.")}
        {variable.scope === "page" &&
          (variable.page_id
            ? `${localize("variablePageOwner", "Owner page")}: ${ownerPageTitle ?? variable.page_id}`
            : localize(
                "variablePageUnresolved",
                "Owner page unknown — assign the current page or switch to Global.",
              ))}
        {variable.scope === "component" &&
          localize(
            "componentHint",
            "Available only within a specific component.",
          )}
      </p>
      {variable.scope === "page" && !variable.page_id && currentPageId ? (
        <Button
          className="control-button"
          onPress={() => onUpdate({ page_id: currentPageId })}
        >
          {localize("variableAssignCurrentPage", "Assign to current page")}
        </Button>
      ) : null}

      <div className="section-divider" />

      <h4 className="section-title">
        {i18n
          ? translateKey(
              i18n.t,
              semanticLabelKeys["Default Value"] ?? "Default Value",
              "Default Value",
            )
          : "Default Value"}
      </h4>

      {variable.type === "boolean" ? (
        <PropertySwitch
          label="Default Value"
          isSelected={Boolean(variable.defaultValue)}
          onChange={(checked) => onUpdate({ defaultValue: checked })}
        />
      ) : variable.type === "object" || variable.type === "array" ? (
        <div className="json-editor-wrapper">
          <textarea
            className="json-textarea"
            value={defaultValueStr}
            onChange={(e) => handleDefaultValueChange(e.target.value)}
            placeholder={variable.type === "array" ? "[]" : "{}"}
            rows={6}
          />
        </div>
      ) : (
        <PropertyInput
          label="Default Value"
          value={defaultValueStr}
          onChange={handleDefaultValueChange}
          placeholder={variable.type === "number" ? "0" : ""}
        />
      )}

      <div className="section-divider" />

      <PropertySwitch
        label="Persist to localStorage"
        isSelected={variable.persist || false}
        onChange={(checked) => onUpdate({ persist: checked })}
      />
      <p className="field-description">
        {localize(
          "persistHint",
          "The value persists after refreshing the page.",
        )}
      </p>
    </div>
  );
}

// ============================================
// Helpers
// ============================================

function formatDefaultValue(value: unknown, type: VarType): string {
  if (value === undefined || value === null) return "";

  switch (type) {
    case "object":
    case "array":
      return JSON.stringify(value, null, 2);
    default:
      return String(value);
  }
}

function parseDefaultValue(value: string, type: VarType): unknown {
  if (!value) return undefined;

  switch (type) {
    case "number":
      return Number(value) || 0;
    case "boolean":
      return value === "true";
    case "object":
    case "array":
      try {
        return JSON.parse(value);
      } catch {
        return type === "array" ? [] : {};
      }
    default:
      return value;
  }
}
