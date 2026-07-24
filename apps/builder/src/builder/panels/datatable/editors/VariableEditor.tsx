/**
 * VariableEditor - Variable 상세 편집 컴포넌트
 *
 * 기능:
 * - 기본 설정 (이름, 타입, scope)
 * - 기본값 설정
 * - 유효성 검사 규칙
 * - 변환 함수
 *
 * Note: 탭 상태는 DataTableEditorPanel에서 관리됨
 */

import { useState, useCallback } from "react";
import {
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useDataStore } from "../../../stores/data";
import type {
  Variable as VariableType,
  VariableType as VarType,
  VariableScope,
} from "../../../../types/builder/data.types";
import type { VariableEditorTab } from "../types/editorTypes";
import {
  PropertyInput,
  PropertySelect,
  PropertySwitch,
} from "../../../components";
import "./VariableEditor.css";
import { iconEditProps } from "../../../../utils/ui/uiConstants";

interface VariableEditorProps {
  variable: VariableType;
  onClose: () => void;
  activeTab: VariableEditorTab;
}

const VARIABLE_TYPES: { value: VarType; label: string }[] = [
  { value: "string", label: "String" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "object", label: "Object" },
  { value: "array", label: "Array" },
];

const VARIABLE_SCOPES: { value: VariableScope; label: string }[] = [
  { value: "global", label: "Global" },
  { value: "page", label: "Page" },
  { value: "component", label: "Component" },
];

export function VariableEditor({ variable, onClose, activeTab }: VariableEditorProps) {
  const updateVariable = useDataStore((state) => state.updateVariable);

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["validation"])
  );

  // 업데이트
  const handleUpdate = useCallback(
    async (updates: Partial<VariableType>) => {
      try {
        await updateVariable(variable.id, updates);
      } catch (error) {
        console.error("Variable 업데이트 실패:", error);
      }
    },
    [variable.id, updateVariable]
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // Note: onClose is handled by parent DataTableEditorPanel
  void onClose;

  // 탭은 DataTableEditorPanel에서 렌더링됨
  return (
    <>
      {activeTab === "basic" && (
        <BasicEditor
          variable={variable}
          onUpdate={handleUpdate}
        />
      )}

      {activeTab === "validation" && (
        <ValidationEditor
          variable={variable}
          onUpdate={handleUpdate}
          expandedSections={expandedSections}
          onToggleSection={toggleSection}
        />
      )}

      {activeTab === "transform" && (
        <TransformEditor
          variable={variable}
          onUpdate={handleUpdate}
        />
      )}
    </>
  );
}

// ============================================
// Basic Editor
// ============================================

interface BasicEditorProps {
  variable: VariableType;
  onUpdate: (updates: Partial<VariableType>) => void;
}

function BasicEditor({ variable, onUpdate }: BasicEditorProps) {
  const defaultValueStr = formatDefaultValue(variable.defaultValue, variable.type);

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

      <PropertySelect
        label="Scope"
        value={variable.scope}
        onChange={(value) => onUpdate({ scope: value as VariableScope })}
        options={VARIABLE_SCOPES}
      />
      <p className="field-description">
        {variable.scope === "global" && "모든 페이지에서 접근 가능합니다."}
        {variable.scope === "page" && "현재 페이지에서만 접근 가능합니다."}
        {variable.scope === "component" && "특정 컴포넌트 내에서만 접근 가능합니다."}
      </p>

      <div className="section-divider" />

      <h4 className="section-title">Default Value</h4>

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
        활성화하면 페이지를 새로고침해도 값이 유지됩니다.
      </p>
    </div>
  );
}

// ============================================
// Validation Editor
// ============================================

interface ValidationEditorProps {
  variable: VariableType;
  onUpdate: (updates: Partial<VariableType>) => void;
  expandedSections: Set<string>;
  onToggleSection: (key: string) => void;
}

function ValidationEditor({
  variable,
  onUpdate,
  expandedSections,
  onToggleSection,
}: ValidationEditorProps) {
  const validation = variable.validation || {};
  const isExpanded = expandedSections.has("validation");

  const updateValidation = (updates: Partial<VariableType["validation"]>) => {
    onUpdate({
      validation: { ...validation, ...updates },
    });
  };

  return (
    <div className="validation-editor">
      <div
        className="variable-editor-section-toggle"
        onClick={() => onToggleSection("validation")}
      >
        {isExpanded ? <ChevronDown {...iconEditProps} /> : <ChevronRight {...iconEditProps} />}
        <span className="variable-editor-section-title">Validation Rules</span>
      </div>

      {isExpanded && (
        <div className="validation-content">
          <PropertySwitch
            label="Required"
            isSelected={validation.required || false}
            onChange={(checked) => updateValidation({ required: checked })}
          />

          {variable.type === "string" && (
            <>
              <PropertyInput
                label="Min Length"
                value={String(validation.minLength ?? "")}
                onChange={(value) =>
                  updateValidation({
                    minLength: value ? Number(value) : undefined,
                  })
                }
                placeholder="0"
              />

              <PropertyInput
                label="Max Length"
                value={String(validation.maxLength ?? "")}
                onChange={(value) =>
                  updateValidation({
                    maxLength: value ? Number(value) : undefined,
                  })
                }
                placeholder="255"
              />

              <PropertyInput
                label="Pattern (Regex)"
                value={validation.pattern || ""}
                onChange={(value) =>
                  updateValidation({ pattern: value || undefined })
                }
                placeholder="^[a-zA-Z]+$"
              />
            </>
          )}

          {variable.type === "number" && (
            <>
              <PropertyInput
                label="Min Value"
                value={String(validation.min ?? "")}
                onChange={(value) =>
                  updateValidation({
                    min: value ? Number(value) : undefined,
                  })
                }
                placeholder="0"
              />

              <PropertyInput
                label="Max Value"
                value={String(validation.max ?? "")}
                onChange={(value) =>
                  updateValidation({
                    max: value ? Number(value) : undefined,
                  })
                }
                placeholder="100"
              />
            </>
          )}

          {(variable.type === "array" || variable.type === "object") && (
            <PropertyInput
              label="JSON Schema"
              value={validation.schema || ""}
              onChange={(value) =>
                updateValidation({ schema: value || undefined })
              }
              placeholder="JSON Schema URL or inline schema"
            />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Transform Editor
// ============================================

interface TransformEditorProps {
  variable: VariableType;
  onUpdate: (updates: Partial<VariableType>) => void;
}

function TransformEditor({ variable, onUpdate }: TransformEditorProps) {
  return (
    <div className="transform-editor">
      <p className="editor-description">
        값이 설정될 때 실행되는 변환 함수입니다.
        <br />
        {"함수는 (value, context) => transformedValue 형식입니다."}
      </p>

      <div className="transform-input-wrapper">
        <span className="transform-prefix">{"(value, context) => {"}</span>
        <textarea
          className="transform-textarea"
          value={variable.transform || ""}
          onChange={(e) => onUpdate({ transform: e.target.value || undefined })}
          placeholder="return value.trim().toUpperCase();"
          rows={8}
        />
        <span className="transform-suffix">{"}"}</span>
      </div>

      <div className="transform-examples">
        <h5 className="examples-title">Examples</h5>
        <div className="example-list">
          <div className="example-item">
            <code className="example-code">return value.trim();</code>
            <span className="example-desc">문자열 앞뒤 공백 제거</span>
          </div>
          <div className="example-item">
            <code className="example-code">return Math.max(0, Math.min(100, value));</code>
            <span className="example-desc">0-100 사이로 제한</span>
          </div>
          <div className="example-item">
            <code className="example-code">return value.filter(x ={">"} x !== null);</code>
            <span className="example-desc">배열에서 null 제거</span>
          </div>
        </div>
      </div>
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
