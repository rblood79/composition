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
 * @see presets/dataTablePresets.ts (카탈로그) · @composition/sample-data (생성기, ADR-220) — DATATABLE_PRESET_SYSTEM.md 는 없다 (stale 참조 정리 2026-09-16)
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
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
  Contact,
  Newspaper,
  CreditCard,
  Image,
  BookUser,
  BadgeCheck,
  ShoppingBasket,
  Star,
  MessageSquare,
  ListChecks,
  ChefHat,
  Quote,
  ArrowLeftRight,
  Receipt,
  Table2,
  LayoutTemplate,
  FileUp,
  Globe,
  Sparkles,
  X,
} from "lucide-react";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { useDataStore } from "../../../stores/data";
import {
  PropertyCheckbox,
  PropertyFieldset,
  Section,
} from "../../../components";
import type { DataTablePreset } from "../presets/types";
import { PRESET_CATEGORIES } from "../presets/types";
import { getPresetsByCategory } from "../presets/dataTablePresets";
import { resolvePresetSchema, type PresetTranslate } from "../presets/types";
import { resolvePresetTranslate } from "../presets/presetStrings";
import { parsePastedRows } from "../utils/pasteRows";
import { columnsToSchema, detectColumns } from "../utils/columnDetector";
import { useDataTableEditorStore } from "../stores/dataTableEditorStore";
import type { QuickConnectTarget } from "../types/editorTypes";
import {
  executeQuickConnect,
  planTableColumns,
  precheckQuickConnectTarget,
  readBackQuickConnect,
  unmatchedColumnKeys,
  type QuickConnectPrecheck,
} from "../utils/quickConnect";
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
  Contact,
  Newspaper,
  CreditCard,
  Image,
  BookUser,
  BadgeCheck,
  ShoppingBasket,
  Star,
  MessageSquare,
  ListChecks,
  ChefHat,
  Quote,
  ArrowLeftRight,
  Receipt,
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
    icon: ACTION_ICONS.paste,
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
  /**
   * ADR-013 — Properties Data 행에서 열렸을 때의 연결 대상. 있으면 empty/preset/paste/file 은
   * 생성 + 대상 연결을 `createAndBindDataTable` 1회 (History 1) 로 끝낸다. API/AI 인계는
   * 연결 모드 미지원 — 사유를 표시하고 사용자가 「연결 없이 계속」 을 눌러야 일반 생성으로
   * 넘어간다 (문맥을 조용히 버리지 않는다). 일반 Data 패널에서 열면 undefined.
   */
  connect?: QuickConnectTarget;
}

/** 실행 직전 검증 실패 → 사용자 문구 키 (무변경 중단) */
const PRECHECK_MESSAGE_KEY: Record<
  Exclude<QuickConnectPrecheck, { ok: true }>["reason"],
  string
> = {
  missing: "connectTargetMissing",
  context: "connectTargetContext",
  "binding-changed": "connectBindingChanged",
};

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
  connect,
}: DataTableCreatorProps) {
  const i18n = useOptionalI18n();
  const localize = (key: string, fallback: string) =>
    i18n ? translateKey(i18n.t, `datatable.${key}`, fallback) : fallback;
  const t = (
    key: string,
    params?: Record<string, string | number | boolean>,
  ) => (i18n ? i18n.t(`datatable.${key}`, params) : key);
  /** preset 문구 해소기 — preset 카탈로그 (lazy 표), locale 은 provider 의 것 (밖이면 en) */
  const locale = i18n?.locale;
  const tr = useMemo<PresetTranslate>(
    () => resolvePresetTranslate(locale),
    [locale],
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
  // 생성 조건 (randomuser `?seed=` · mockaroo Blank %) — preset 에만
  const [seed, setSeed] = useState("");
  const [blankPercent, setBlankPercent] = useState(0);
  // paste · file
  const [pasteText, setPasteText] = useState("");
  const [fileRows, setFileRows] = useState<
    (ImportedRows & { fileName: string }) | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // ai
  const [aiDescription, setAiDescription] = useState("");
  // 처리 중 중복 실행 차단 (연속 클릭) — 저장 await 동안 버튼을 잠근다
  const [isSubmitting, setIsSubmitting] = useState(false);
  // ADR-013 §4 — Table 재연결: 기존 컬럼은 보존이 기본, 전면 교체는 명시적 선택
  const [replaceColumns, setReplaceColumns] = useState(false);
  const columnPlan = useMemo(
    () => (connect ? planTableColumns(connect) : null),
    [connect],
  );
  // 요청 수명 — 닫기/모드 교체로 언마운트된 뒤 도착한 완료 응답이 패널 상태를 덮지 않게
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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

  const [fileDragOver, setFileDragOver] = useState(false);

  const readImportFile = useCallback(
    (file: File) => {
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
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tableName],
  );

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) readImportFile(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [readImportFile],
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
    if (isSubmitting) return;
    try {
      if (method === "api") {
        // 연결 모드에서는 「연결 없이 계속」 — 일반 생성으로 명시적 전환 (자동 연결 없음)
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
      // 생성 입력 — 방법별 draft 하나로 정규화 (일반 생성과 연결 모드가 같은 값을 쓴다)
      let draft:
        | {
            name: string;
            schema: ReturnType<typeof resolvePresetSchema>;
            mockData: Record<string, unknown>[];
          }
        | undefined;
      if (method === "empty") {
        draft = {
          name: tableName.trim() || localize("newTable", "New Table"),
          // Main 아트보드 — id 필드 하나로 시작, 나머지는 격자에서
          schema: [{ key: "id", type: "string", required: true }],
          mockData: [],
        };
      } else if (method === "preset" && selectedPreset) {
        // 여기서 해소한 문구가 사용자 테이블에 굳는다 — 이후에는 사용자
        // 데이터라 다시 번역하지 않는다 (presets/types.ts `PresetTranslate`).
        const sampleData = selectedPreset.generateSampleData(sampleCount, tr, {
          seed: seed.trim() || undefined,
          blankRate: blankPercent / 100,
        });
        draft = {
          name: tableName.trim() || selectedPreset.name,
          schema: resolvePresetSchema(selectedPreset.schema, tr),
          mockData: sampleData,
        };
      } else if ((method === "paste" || method === "file") && imported) {
        draft = {
          name:
            tableName.trim() ||
            (method === "file" && fileRows
              ? fileRows.fileName.replace(/\.[^.]+$/, "")
              : localize("newTable", "New Table")),
          schema: imported.schema,
          mockData: imported.rows,
        };
      }
      if (!draft) {
        onClose();
        return;
      }
      const input = { ...draft, project_id: projectId, useMockData: true };

      let created: { id: string; name: string };
      if (connect) {
        // 실행 직전 — 대상 존재 · 페이지/프로젝트 문맥 · 바인딩 무변경. 하나라도 어긋나면
        // 아무것도 만들지 않는다. 저장 뒤 commit 경계의 같은 검사는 적용기 (`expectBindings`).
        const precheck = precheckQuickConnectTarget(connect, projectId);
        if (!precheck.ok) {
          globalToast.error(
            localize(PRECHECK_MESSAGE_KEY[precheck.reason], ""),
          );
          return;
        }
        setIsSubmitting(true);
        created = await executeQuickConnect({
          input,
          target: connect,
          projectId,
          replaceColumns,
        });
        if (!mountedRef.current) return;
        if (!readBackQuickConnect(connect.elementId, created.id)) {
          // 적용기는 성공했는데 대상이 새 collection 을 가리키지 않는다 — 성공으로 알리지 않는다
          globalToast.error(localize("connectReadBackFailed", ""));
          return;
        }
        announceDataPanelStatus(
          t("tableCreatedAndConnected", {
            name: created.name,
            target: connect.elementLabel,
          }),
          { tone: "success" },
        );
      } else {
        setIsSubmitting(true);
        created = await createDataTable(input);
        if (!mountedRef.current) return;
        announceDataPanelStatus(t("tableCreated", { name: created.name }), {
          tone: "success",
        });
      }
      // 만들면 이 자리가 편집기로 바뀐다 (Main 아트보드)
      openTableEditor(created.id);
    } catch (error) {
      console.error("DataTable 생성 실패:", error);
      if (!mountedRef.current) return;
      globalToast.error(
        t("createFailed", { message: (error as Error).message }),
      );
    } finally {
      if (mountedRef.current) setIsSubmitting(false);
    }
  }, [
    isSubmitting,
    method,
    tableName,
    selectedPreset,
    sampleCount,
    seed,
    blankPercent,
    imported,
    fileRows,
    aiDescription,
    projectId,
    connect,
    replaceColumns,
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
  // 현재 입력이 만들 schema (컬럼 대조 표시용) — preset 은 라벨 해소 전 key 만 필요
  const draftSchemaForPlan: readonly { key: string }[] | null =
    method === "preset" && selectedPreset
      ? selectedPreset.schema
      : method === "paste" || method === "file"
        ? (imported?.schema ?? null)
        : method === "empty"
          ? [{ key: "id" }]
          : null;

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
          {connect && (
            <p
              className="creator-form-hint creator-connect-target"
              role="note"
              data-connect-target={connect.elementId}
            >
              {t("connectTarget", { name: connect.elementLabel })}
            </p>
          )}
          {/* Table 재연결 — 기존 컬럼 보존 (기본) · 새 schema 와 어긋나는 key 표시 · 교체는 명시적 */}
          {connect && columnPlan && columnPlan.existing.length > 0 && (
            <>
              <p className="creator-form-hint" role="note" data-column-plan>
                {t("connectColumnsKept", {
                  count: columnPlan.existing.length,
                })}
                {draftSchemaForPlan &&
                  unmatchedColumnKeys(columnPlan, draftSchemaForPlan).length >
                    0 &&
                  ` ${t("connectColumnsUnmatched", {
                    keys: unmatchedColumnKeys(
                      columnPlan,
                      draftSchemaForPlan,
                    ).join(", "),
                  })}`}
              </p>
              <PropertyCheckbox
                label={localize(
                  "connectReplaceColumns",
                  "Replace columns with the new schema",
                )}
                isSelected={replaceColumns}
                onChange={setReplaceColumns}
              />
            </>
          )}
          {/* legend 「Start from」 + 방법 격자 (panel-ui 19 — 대조 B12); 이름은 legend 가 준다 */}
          <fieldset className="properties-aria creator-start-from">
            <legend className="fieldset-legend">
              {localize("startMethod", "How to start")}
            </legend>
            <RadioGroup
              className="creator-methods"
              aria-label={localize("startMethod", "How to start")}
              value={method}
              onChange={(value) => setMethod(value as CreatorMethod)}
              orientation="horizontal"
            >
              {METHODS.map((entry) => {
                const label = localize(entry.labelKey, entry.label);
                return (
                  <Radio
                    key={entry.id}
                    value={entry.id}
                    className="creator-method"
                    data-method={entry.id}
                  >
                    <entry.icon size={16} />
                    <span title={label}>{label}</span>
                  </Radio>
                );
              })}
            </RadioGroup>
          </fieldset>
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

        {method === "preset" && (
          // 카테고리는 절 헤더 32 가 아니라 절 하나 안의 그룹 (legend 18 + 카운트) — 종전
          //   카테고리마다 절 32 + 카드 144 가 15 preset 에 1,000px (panel-ui 19, 2026-09-14)
          <Section
            id="creator-presets"
            title={localize("methodPreset", "Preset")}
            className="creator-preset-section"
            collapsible={false}
          >
            {PRESET_CATEGORIES.map((cat) => {
              const presets = getPresetsByCategory(cat.id);
              if (presets.length === 0) return null;
              return (
                <div key={cat.id} className="list-subgroup">
                  <div className="list-subgroup-header">
                    <span className="list-subgroup-title">{cat.name}</span>
                    <span className="list-subgroup-count">
                      {presets.length}
                    </span>
                  </div>
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
                        <div className="list-item-meta">
                          {preset.schema.length} fields
                        </div>
                        <div className="list-item-name">{preset.name}</div>
                        <div className="list-item-desc">
                          {tr(preset.descriptionKey)}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </Section>
        )}

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
            {/* 네이티브 file input 은 숨기고 드롭 존 120 (Image fill · Font Manager 와 같은
                어법) 이 연다 — 빌더의 유일한 브라우저 기본 컨트롤이었다 (panel-ui 19) */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json,text/csv,application/json"
              onChange={handleFileSelect}
              aria-label={localize("chooseFile", "Choose a CSV or JSON file")}
              className="creator-file-input"
              tabIndex={-1}
            />
            <div
              className="creator-dropzone"
              onDragOver={(event: React.DragEvent<HTMLDivElement>) => {
                event.preventDefault();
                setFileDragOver(true);
              }}
              onDragLeave={() => setFileDragOver(false)}
              onDrop={(event: React.DragEvent<HTMLDivElement>) => {
                event.preventDefault();
                setFileDragOver(false);
                const file = event.dataTransfer.files?.[0];
                if (file) readImportFile(file);
              }}
              data-drag-over={fileDragOver || undefined}
            >
              <Button
                className="creator-dropzone__button"
                onPress={() => fileInputRef.current?.click()}
              >
                <FileUp size={20} />
                <span>
                  {localize(
                    "dropFileHint",
                    "Drop a CSV or JSON file, or click",
                  )}
                </span>
              </Button>
            </div>
            {fileRows ? (
              <div className="creator-file-row">
                <span className="creator-file-row__name">
                  {fileRows.fileName}
                </span>
                <span className="creator-file-row__meta">
                  {fileRows.rows.length} ×{" "}
                  {Object.keys(fileRows.rows[0] ?? {}).length}
                </span>
                <Button
                  className="creator-file-row__clear"
                  aria-label={localize("clearFile", "Remove file")}
                  onPress={() => setFileRows(null)}
                >
                  <X size={14} />
                </Button>
              </div>
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
            {connect && (
              <p className="creator-form-hint" role="note">
                {t("connectHandoffUnsupported", { name: connect.elementLabel })}
              </p>
            )}
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
            {connect && (
              <p className="creator-form-hint" role="note">
                {t("connectHandoffUnsupported", { name: connect.elementLabel })}
              </p>
            )}
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
          {/* 생성 조건 — seed (재현) · 빈 값 비율 (required 아닌 컬럼) */}
          <div className="fieldset-row creator-generate-options">
            <PropertyFieldset legend={localize("seed", "Seed")}>
              <input
                className="react-aria-Input"
                type="text"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder={localize("seedPlaceholder", "Empty for random…")}
                aria-label={localize("seed", "Seed")}
                spellCheck={false}
                autoComplete="off"
              />
            </PropertyFieldset>
            <PropertyFieldset legend={localize("blankRate", "Blank %")}>
              <input
                className="react-aria-Input"
                type="number"
                inputMode="numeric"
                min="0"
                max="90"
                value={blankPercent}
                onChange={(e) =>
                  setBlankPercent(
                    Math.max(0, Math.min(90, parseInt(e.target.value) || 0)),
                  )
                }
                aria-label={localize("blankRate", "Blank %")}
              />
            </PropertyFieldset>
          </div>
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
          isDisabled={!canCreate || isSubmitting}
          isPending={isSubmitting}
        >
          {method === "api" || method === "ai"
            ? connect
              ? localize(
                  "continueWithoutConnect",
                  "Continue without connecting",
                )
              : method === "api"
                ? localize("continueToApi", "Continue")
                : localize("sendToAi", "Ask AI")
            : connect
              ? localize("createAndConnect", "Create & connect")
              : localize("create", "Create")}
        </Button>
      </div>
    </div>
  );
}

export default DataTableCreator;
