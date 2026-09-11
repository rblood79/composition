/**
 * DataTableCreator - DataTable 생성 패널 컴포넌트
 *
 * ADR-212 Phase 1 (Main 아트보드) — 이름 + "시작 방법" 6 진입: 빈 테이블 · 프리셋 · 붙여넣기 ·
 * CSV / JSON · API 에서 · AI 로 설명. 붙여넣기 · 파일은 규칙 파서 (`parsePastedRows` ·
 * Papa.parse · JSON) 가 행을 읽고 `detectColumns` 가 스키마를 잡아 미리보기 뒤 만든다.
 * "API 에서" 는 API 생성 패널로, "AI 로 설명" 은 AI 패널 입력창에 초안을 넣고 넘긴다
 * (ADR-213 `create_table_from_description` — 전송은 사용자).
 *
 * 쓰기는 전부 `createDataTable` (152 적용기 wrapper, HC1). 생성 결과는 `role=status`.
 *
 * Preset 카테고리는 탭이 아니라 **카테고리당 Section** 이다. 패널 폭(387px)에 5개 라벨이
 * 들어가지 않아 탭 줄이 가로 스크롤되면서 2개가 상시 숨는 문제가 있었고, 같은 일을 하는
 * ComponentList(카테고리별 컴포넌트 팔레트)가 이미 Section 계열이다.
 *
 * @see docs/features/DATATABLE_PRESET_SYSTEM.md
 */

import { useState, useCallback, useMemo, useRef } from "react";
import { Button } from "react-aria-components/Button";
import { Radio, RadioGroup } from "react-aria-components/RadioGroup";
import Papa from "papaparse";
import {
  User,
  Key,
  Lock,
  Mail,
  Building2,
  Layers,
  Folder,
  Package,
  Tag,
  ShoppingCart,
  Cpu,
  Wrench,
  FileText,
  Users,
  Database,
  Settings,
  Factory,
  Table2,
  LayoutTemplate,
  ClipboardPaste,
  FileUp,
  Globe,
  Sparkles,
} from "lucide-react";
import { useDataStore } from "../../../stores/data";
import { PropertyFieldset, Section } from "../../../components";
import type { DataTablePreset } from "../presets/types";
import { PRESET_CATEGORIES } from "../presets/types";
import { getPresetsByCategory } from "../presets/dataTablePresets";
import { resolvePresetSchema, type PresetTranslate } from "../presets/types";
import { parsePastedRows } from "../utils/pasteRows";
import { columnsToSchema, detectColumns } from "../utils/columnDetector";
import { useDataTableEditorStore } from "../stores/dataTableEditorStore";
import { announceDataPanelStatus } from "../stores/dataPanelStatusStore";
import { setAiComposerDraft } from "../../ai/aiComposerDraft";
import { setPanelWorkspacePanelVisibility } from "../../../layout/panelWorkspaceVisibility";
import { globalToast } from "../../../stores/toast";
import "./DataTableCreator.css";
import { translateKey, useOptionalI18n } from "../../../../i18n";

// ============================================
// Icon Mapping
// ============================================

const iconMap: Record<string, React.ComponentType<{ size?: number }>> = {
  User,
  Key,
  Lock,
  Mail,
  Building2,
  Layers,
  Folder,
  Package,
  Tag,
  ShoppingCart,
  Cpu,
  Wrench,
  FileText,
  Users,
  Database,
  Settings,
  Factory,
};

// ============================================
// Types
// ============================================

export type CreatorMethod =
  "empty" | "preset" | "paste" | "file" | "api" | "ai";

const METHODS: {
  id: CreatorMethod;
  labelKey: string;
  label: string;
  icon: typeof Table2;
}[] = [
  { id: "empty", labelKey: "methodEmpty", label: "Empty table", icon: Table2 },
  {
    id: "preset",
    labelKey: "methodPreset",
    label: "Preset",
    icon: LayoutTemplate,
  },
  {
    id: "paste",
    labelKey: "methodPaste",
    label: "Paste",
    icon: ClipboardPaste,
  },
  { id: "file", labelKey: "methodFile", label: "CSV / JSON", icon: FileUp },
  { id: "api", labelKey: "methodApi", label: "From API", icon: Globe },
  { id: "ai", labelKey: "methodAi", label: "Describe to AI", icon: Sparkles },
];

interface DataTableCreatorProps {
  projectId: string;
  onClose: () => void;
  /** 열릴 때의 시작 방법 (기본 프리셋 — 종전 탭 기본값 유지) */
  initialMethod?: CreatorMethod;
}

/** 붙여넣기 · 파일에서 읽은 행 + 감지 스키마 (미리보기 · 생성 입력) */
interface ImportedRows {
  rows: Record<string, unknown>[];
  format: string;
}

function rowsFromFileText(name: string, text: string): ImportedRows | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  if (/\.json$/i.test(name) || /^[[{]/.test(trimmed)) {
    const parsed = parsePastedRows(trimmed);
    return parsed.ok ? { rows: parsed.rows, format: "json" } : null;
  }
  const result = Papa.parse<Record<string, unknown>>(trimmed, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });
  if (!result.data.length) return null;
  return { rows: result.data, format: "csv" };
}

// ============================================
// Component
// ============================================

export function DataTableCreator({
  projectId,
  onClose,
  initialMethod = "preset",
}: DataTableCreatorProps) {
  const i18n = useOptionalI18n();
  const localize = (key: string, fallback: string) =>
    i18n ? translateKey(i18n.t, `datatable.${key}`, fallback) : fallback;
  const t = (
    key: string,
    params?: Record<string, string | number | boolean>,
  ) => (i18n ? i18n.t(`datatable.${key}`, params) : key);
  /** preset 문구 해소기 — provider 밖(격리 렌더)이면 키를 그대로 돌려준다. */
  const tr = useCallback<PresetTranslate>(
    (key, params) => (i18n ? i18n.t(key, params) : key),
    [i18n],
  );
  const createDataTable = useDataStore((state) => state.createDataTable);
  const openApiCreator = useDataTableEditorStore(
    (state) => state.openApiCreator,
  );
  const openTableEditor = useDataTableEditorStore(
    (state) => state.openTableEditor,
  );

  const [method, setMethod] = useState<CreatorMethod>(initialMethod);
  const [tableName, setTableName] = useState("");
  // preset
  const [selectedPreset, setSelectedPreset] = useState<DataTablePreset | null>(
    null,
  );
  const [sampleCount, setSampleCount] = useState(10);
  // paste · file
  const [pasteText, setPasteText] = useState("");
  const [fileRows, setFileRows] = useState<
    (ImportedRows & { fileName: string }) | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // ai
  const [aiDescription, setAiDescription] = useState("");

  const handlePresetSelect = useCallback((preset: DataTablePreset) => {
    setSelectedPreset(preset);
    setSampleCount(preset.defaultSampleCount);
  }, []);

  /** 붙여넣기 · 파일의 현재 입력 → 행 + 스키마 (미리보기와 생성이 같은 값을 본다) */
  const imported = useMemo(() => {
    let source: ImportedRows | null = null;
    if (method === "paste") {
      const parsed = parsePastedRows(pasteText);
      source = parsed.ok ? { rows: parsed.rows, format: parsed.format } : null;
    } else if (method === "file") {
      source = fileRows;
    }
    if (!source) return null;
    const schema = columnsToSchema(detectColumns(source.rows));
    return { ...source, schema };
  }, [method, pasteText, fileRows]);

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      file
        .text()
        .then((text) => {
          const rows = rowsFromFileText(file.name, text);
          setFileRows(rows ? { ...rows, fileName: file.name } : null);
          if (!rows) {
            globalToast.error(
              localize("fileUnreadable", "Could not read rows."),
            );
          }
          if (!tableName.trim()) {
            setTableName(file.name.replace(/\.[^.]+$/, ""));
          }
        })
        .catch((error) => {
          console.error("파일 읽기 실패:", error);
        });
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tableName],
  );

  const canCreate = (() => {
    switch (method) {
      case "empty":
        return true;
      case "preset":
        return selectedPreset !== null;
      case "paste":
      case "file":
        return imported !== null && imported.rows.length > 0;
      case "api":
        return true;
      case "ai":
        return aiDescription.trim().length > 0;
    }
  })();

  // 생성 핸들러
  const handleCreate = useCallback(async () => {
    try {
      if (method === "api") {
        openApiCreator(projectId);
        return;
      }
      if (method === "ai") {
        const name = tableName.trim();
        setAiComposerDraft(
          t("aiDraft", { name: name || "", description: aiDescription.trim() }),
        );
        setPanelWorkspacePanelVisibility("ai", true);
        onClose();
        return;
      }
      let created: { id: string; name: string } | undefined;
      if (method === "empty") {
        const name = tableName.trim() || localize("newTable", "New Table");
        created = await createDataTable({
          name,
          project_id: projectId,
          // Main 아트보드 — id 필드 하나로 시작, 나머지는 격자에서
          schema: [{ key: "id", type: "string", required: true }],
          mockData: [],
          useMockData: true,
        });
      } else if (method === "preset" && selectedPreset) {
        // 여기서 해소한 문구가 사용자 테이블에 굳는다 — 이후에는 사용자
        // 데이터라 다시 번역하지 않는다 (presets/types.ts `PresetTranslate`).
        const sampleData = selectedPreset.generateSampleData(sampleCount, tr);
        created = await createDataTable({
          name: tableName.trim() || selectedPreset.name,
          project_id: projectId,
          schema: resolvePresetSchema(selectedPreset.schema, tr),
          mockData: sampleData,
          useMockData: true,
        });
      } else if ((method === "paste" || method === "file") && imported) {
        const name =
          tableName.trim() ||
          (method === "file" && fileRows
            ? fileRows.fileName.replace(/\.[^.]+$/, "")
            : localize("newTable", "New Table"));
        created = await createDataTable({
          name,
          project_id: projectId,
          schema: imported.schema,
          mockData: imported.rows,
          useMockData: true,
        });
      }
      if (created) {
        announceDataPanelStatus(t("tableCreated", { name: created.name }), {
          tone: "success",
        });
        // 만들면 이 자리가 편집기로 바뀐다 (Main 아트보드)
        openTableEditor(created.id);
      } else {
        onClose();
      }
    } catch (error) {
      console.error("DataTable 생성 실패:", error);
      globalToast.error(
        t("createFailed", { message: (error as Error).message }),
      );
    }
  }, [
    method,
    tableName,
    selectedPreset,
    sampleCount,
    imported,
    fileRows,
    aiDescription,
    projectId,
    createDataTable,
    openApiCreator,
    openTableEditor,
    onClose,
    tr,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    i18n,
  ]);

  // 아이콘 렌더링 헬퍼
  const renderIcon = (iconName: string, size = 20) => {
    const IconComponent = iconMap[iconName];
    return IconComponent ? (
      <IconComponent size={size} />
    ) : (
      <Database size={size} />
    );
  };

  const previewFields = imported?.schema ?? [];

  return (
    <div className="datatable-creator" data-method={method}>
      <div className="datatable-creator-body">
        <Section
          id="table-creator"
          title={localize("table", "Table")}
          collapsible={false}
        >
          <PropertyFieldset legend={localize("tableName", "Table Name")}>
            <input
              className="react-aria-Input"
              type="text"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder={localize("newTable", "New Table")}
              aria-label={localize("tableName", "Table Name")}
            />
          </PropertyFieldset>
          <p className="creator-form-hint">
            {localize(
              "tableNameHint",
              "Display name. Bindings reference the id, so you can rename it later.",
            )}
          </p>
          <RadioGroup
            className="creator-methods"
            aria-label={localize("startMethod", "How to start")}
            value={method}
            onChange={(value) => setMethod(value as CreatorMethod)}
            orientation="horizontal"
          >
            {METHODS.map((entry) => (
              <Radio
                key={entry.id}
                value={entry.id}
                className="creator-method"
                data-method={entry.id}
              >
                <entry.icon size={16} />
                <span>{localize(entry.labelKey, entry.label)}</span>
              </Radio>
            ))}
          </RadioGroup>
        </Section>

        {method === "empty" && (
          <Section
            id="creator-empty"
            title={localize("methodEmpty", "Empty table")}
            collapsible={false}
          >
            <p className="creator-form-hint">
              {localize(
                "emptyTableHint",
                "Starts with a single id field. The editor opens right away so you can add fields in the grid.",
              )}
            </p>
          </Section>
        )}

        {method === "preset" &&
          PRESET_CATEGORIES.map((cat) => {
            const presets = getPresetsByCategory(cat.id);
            if (presets.length === 0) return null;
            return (
              <Section
                key={cat.id}
                id={`preset-${cat.id}`}
                title={cat.name}
                className="creator-preset-section"
              >
                <div className="list-group" role="list">
                  {presets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      role="listitem"
                      className={`list-item preset-card ${
                        selectedPreset?.id === preset.id ? "selected" : ""
                      }`}
                      aria-pressed={selectedPreset?.id === preset.id}
                      onClick={() => handlePresetSelect(preset)}
                    >
                      <div className="list-item-icon">
                        {renderIcon(preset.icon, 16)}
                      </div>
                      <div className="list-item-name">{preset.name}</div>
                      <div className="list-item-desc">
                        {tr(preset.descriptionKey)}
                      </div>
                      <div className="list-item-meta">
                        {preset.schema.length} fields
                      </div>
                    </button>
                  ))}
                </div>
              </Section>
            );
          })}

        {method === "paste" && (
          <Section
            id="creator-paste"
            title={localize("methodPaste", "Paste")}
            collapsible={false}
          >
            <textarea
              className="react-aria-TextArea creator-paste-input"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={6}
              aria-label={localize("pasteRows", "Paste rows")}
              placeholder={localize(
                "pastePlaceholder",
                "JSON array, or tab/comma separated rows with a header line",
              )}
            />
            {pasteText.trim() && !imported ? (
              <p className="creator-form-hint" role="note">
                {localize(
                  "pasteNotTabular",
                  "Could not read rows. Paste a JSON array or a header line plus rows.",
                )}
              </p>
            ) : null}
          </Section>
        )}

        {method === "file" && (
          <Section
            id="creator-file"
            title={localize("methodFile", "CSV / JSON")}
            collapsible={false}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json,text/csv,application/json"
              onChange={handleFileSelect}
              aria-label={localize("chooseFile", "Choose a CSV or JSON file")}
            />
            {fileRows ? (
              <p className="creator-form-hint">{fileRows.fileName}</p>
            ) : null}
          </Section>
        )}

        {method === "api" && (
          <Section
            id="creator-api"
            title={localize("methodApi", "From API")}
            collapsible={false}
          >
            <p className="creator-form-hint">
              {localize(
                "apiMethodHint",
                "Opens the new API panel. After the first run, save the response as a table from the Schema tab.",
              )}
            </p>
          </Section>
        )}

        {method === "ai" && (
          <Section
            id="creator-ai"
            title={localize("methodAi", "Describe to AI")}
            collapsible={false}
          >
            <textarea
              className="react-aria-TextArea creator-paste-input"
              value={aiDescription}
              onChange={(e) => setAiDescription(e.target.value)}
              rows={4}
              aria-label={localize("aiDescription", "Describe the table")}
              placeholder={localize(
                "aiPlaceholder",
                "e.g. blog posts with title, author, tags and a published date",
              )}
            />
            <p className="creator-form-hint">
              {localize(
                "aiMethodHint",
                "The AI proposes a schema and sample rows; you review the diff before anything is created.",
              )}
            </p>
          </Section>
        )}
      </div>

      {/* Schema Preview — 선택 결과 확인이라 스크롤 밖에 고정 */}
      {method === "preset" && selectedPreset && (
        <Section
          id="schema-preview"
          title={`${selectedPreset.name} ${localize("schema", "Schema")}`}
          actions={
            <div className="creator-sample-count">
              <label htmlFor="sample-count">
                {localize("rowCount", "row count")}
              </label>
              <input
                id="sample-count"
                aria-label={localize("rowCount", "row count")}
                aria-required="true"
                aria-invalid="false"
                type="number"
                min="0"
                max="100"
                value={sampleCount}
                onChange={(e) =>
                  setSampleCount(
                    Math.max(0, Math.min(100, parseInt(e.target.value) || 0)),
                  )
                }
              />
            </div>
          }
          collapsible={false}
        >
          {selectedPreset.schema.map((field) => (
            <div key={field.key} className="creator-schema-field">
              <span className="schema-field-name">
                {field.key}
                {field.required && (
                  <span className="schema-field-required">*</span>
                )}
              </span>
              <span className="schema-field-type">{field.type}</span>
              <span className="schema-field-label">{tr(field.labelKey)}</span>
            </div>
          ))}
        </Section>
      )}

      {(method === "paste" || method === "file") && imported && (
        <Section
          id="schema-preview"
          title={t("importPreview", {
            fields: previewFields.length,
            rows: imported.rows.length,
          })}
          collapsible={false}
        >
          {previewFields.map((field) => (
            <div key={field.key} className="creator-schema-field">
              <span className="schema-field-name">{field.key}</span>
              <span className="schema-field-type">{field.type}</span>
            </div>
          ))}
        </Section>
      )}

      {/* Footer */}
      <div className="creator-footer">
        <Button className="control-button" onPress={onClose}>
          {i18n ? i18n.t("common.cancel") : "Cancel"}
        </Button>
        <Button
          className="control-button"
          data-variant="primary"
          onPress={handleCreate}
          isDisabled={!canCreate}
        >
          {method === "api"
            ? localize("continueToApi", "Continue")
            : method === "ai"
              ? localize("sendToAi", "Ask AI")
              : localize("create", "Create")}
        </Button>
      </div>
    </div>
  );
}

export default DataTableCreator;
