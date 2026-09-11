/**
 * ApiEndpointEditor — 요청 도구형 API 편집기 (ADR-212 Phase 4, 게이트 G3).
 *
 * 상단 고정 요청 바 `[Method ▾][URL][Send]` (UI-4) + 자체 탭 (Params / Headers / Body / Auth /
 * Response). 모든 쓰기는 `applyDataChange({ op:"define_endpoint" })` (HC1) — 직접 store write 0.
 * Auth 값은 vault 참조 `{{secret.NAME}}` 만 문서에 남고 원문은 `secretVault` (별도 IndexedDB,
 * HC6). 응답 뷰어는 status·time·size (`role=status`) + Pretty/Raw/Schema, Schema 는 배열 후보
 * 추천 (`recommendArrayPaths`) → 컬럼 감지 → "테이블로 저장" (ADR-213 cross-store DataChange).
 * cURL 붙여넣기 → 요청 바·탭 채움. production 은 CORS 경고 (UX-8).
 */
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
} from "react";
import { Play, Plus, Trash2 } from "lucide-react";
import type { DataOp } from "@composition/shared";
import { Button } from "react-aria-components/Button";
import { Tab, TabList, TabPanel, Tabs } from "react-aria-components/Tabs";
import { useI18n } from "../../../../i18n";
import type {
  ApiEndpoint,
  ApiHeader,
  ApiParam,
  BodyType,
  HttpMethod,
} from "../../../../types/builder/data.types";
import { iconSmall } from "../../../../utils/ui/uiConstants";
import { panelContents } from "../../../components/panel/panelContentsUtils";
import { PropertySelect } from "../../../components";
import { useDataStore } from "../../../stores/data";
import type { ApiRunRecord } from "../../../../types/builder/data.types";
import { globalToast } from "../../../stores/toast";
import { splitApiUrl } from "../../../../utils/data/apiUrl";
import {
  looksLikeCurl,
  parseCurlCommand,
  curlToEndpointDraft,
} from "../../../../utils/data/curlCommand";
import { detectColumns, type DetectedColumn } from "../utils/columnDetector";
import {
  readPath,
  resolveResponseData,
} from "../../../../utils/data/responseData";
import { toEndpointDraft } from "../../../stores/utils/dataChange";
import { announceDataPanelStatus } from "../stores/dataPanelStatusStore";
import { authToEntries, detectAuthPreset, type AuthPreset } from "./authPreset";
import { buildSaveApiAsTableOps } from "./saveApiAsTable";
import { recommendArrayPaths } from "../utils/responseSchema";
import { listSecretNames, setSecret } from "../utils/secretVault";
import "./ApiEndpointEditor.css";

interface ApiEndpointEditorProps {
  endpoint: ApiEndpoint;
  onClose: () => void;
  initialTab?: string;
}

type ApiTab = "params" | "headers" | "body" | "auth" | "response";

const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "DELETE", "PATCH"];
const BODY_TYPES: BodyType[] = [
  "none",
  "json",
  "form-data",
  "x-www-form-urlencoded",
];

/** endpoint + patch → define_endpoint draft. */
function draftWith(endpoint: ApiEndpoint, patch: Partial<ApiEndpoint>): DataOp {
  const merged = { ...endpoint, ...patch } as ApiEndpoint;
  return { op: "define_endpoint", endpoint: toEndpointDraft(merged) };
}

export function ApiEndpointEditor({
  endpoint,
  onClose,
  initialTab,
}: ApiEndpointEditorProps) {
  const { t } = useI18n();
  const dt = useCallback(
    (key: string, params?: Record<string, string | number | boolean>) =>
      t(`datatable.${key}`, params),
    [t],
  );
  const applyDataChange = useDataStore((state) => state.applyDataChange);
  const executeApiEndpoint = useDataStore((state) => state.executeApiEndpoint);
  const isLoading = useDataStore((state) => state.loadingApis.has(endpoint.id));
  const run = useDataStore((state) => state.apiRuns.get(endpoint.id) ?? null);
  const [tab, setTab] = useState<ApiTab>(
    (initialTab as ApiTab | undefined) ?? "params",
  );
  const [urlDraft, setUrlDraft] = useState(
    `${endpoint.baseUrl}${endpoint.path}`,
  );
  const autoRan = useRef(false);
  void onClose;

  const save = useCallback(
    async (patch: Partial<ApiEndpoint>) => {
      try {
        await applyDataChange({
          ops: [draftWith(endpoint, patch)],
          origin: "user",
        });
      } catch (error) {
        globalToast.error(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    [applyDataChange, endpoint],
  );

  const send = useCallback(async () => {
    try {
      await executeApiEndpoint(endpoint.id);
      setTab("response");
    } catch {
      setTab("response");
    }
  }, [executeApiEndpoint, endpoint.id]);

  // initialTab === "response" 로 열리면 (생성 직후) 1회 자동 실행
  useEffect(() => {
    if (initialTab === "response" && !autoRan.current) {
      autoRan.current = true;
      void send();
    }
  }, [initialTab, send]);

  const commitUrl = useCallback(
    (raw: string) => {
      if (looksLikeCurl(raw)) {
        const parsed = parseCurlCommand(raw);
        if (parsed) {
          const draft = curlToEndpointDraft(parsed);
          setUrlDraft(`${draft.baseUrl}${draft.path}`);
          void save({
            method: draft.method,
            baseUrl: draft.baseUrl,
            path: draft.path,
            headers: draft.headers,
            queryParams: draft.queryParams,
            bodyType: draft.bodyType,
            bodyTemplate: draft.bodyTemplate,
          });
          announceDataPanelStatus(dt("apiCurlPasted"));
          return;
        }
      }
      const { baseUrl, path } = splitApiUrl(raw);
      if (baseUrl !== endpoint.baseUrl || path !== endpoint.path) {
        void save({ baseUrl, path });
      }
    },
    [endpoint.baseUrl, endpoint.path, save, dt],
  );

  const handleUrlPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text/plain");
    if (looksLikeCurl(text)) {
      e.preventDefault();
      commitUrl(text);
    }
  };

  const isProd = !import.meta.env.DEV;

  return (
    <div className="datatable-api-editor">
      <div className="datatable-api-bar">
        <PropertySelect
          value={endpoint.method}
          onChange={(v) => void save({ method: v as HttpMethod })}
          options={HTTP_METHODS.map((m) => ({ value: m, label: m }))}
          aria-label={dt("apiTabParams")}
        />
        <input
          type="text"
          className="datatable-api-url"
          value={urlDraft}
          spellCheck={false}
          placeholder={dt("apiUrlPlaceholder")}
          aria-label="URL"
          onChange={(e) => setUrlDraft(e.target.value)}
          onPaste={handleUrlPaste}
          onBlur={() => commitUrl(urlDraft)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitUrl(urlDraft);
              void send();
            }
          }}
        />
        <Button
          className="control-button"
          data-variant="primary"
          onPress={() => {
            commitUrl(urlDraft);
            void send();
          }}
          isDisabled={isLoading}
        >
          <Play size={iconSmall.size} />
          {isLoading ? dt("apiSending") : dt("apiSend")}
        </Button>
      </div>

      {isProd && (
        <div className="datatable-api-cors" role="note">
          {dt("apiCorsWarning")}
        </div>
      )}

      <Tabs
        className="panel-tabs datatable-api-tabs"
        selectedKey={tab}
        onSelectionChange={(key) => setTab(key as ApiTab)}
      >
        <div className="panel-header panel-tabrow">
          <TabList className="panel-tablist" aria-label={dt("apiTabParams")}>
            <Tab id="params" className="panel-tab">
              <span className="panel-tab-label">{dt("apiTabParams")}</span>
            </Tab>
            <Tab id="headers" className="panel-tab">
              <span className="panel-tab-label">{dt("headers")}</span>
            </Tab>
            <Tab id="body" className="panel-tab">
              <span className="panel-tab-label">{dt("body")}</span>
            </Tab>
            <Tab id="auth" className="panel-tab">
              <span className="panel-tab-label">{dt("apiTabAuth")}</span>
            </Tab>
            <Tab id="response" className="panel-tab">
              <span className="panel-tab-label">{dt("response")}</span>
            </Tab>
          </TabList>
        </div>

        <TabPanel id="params" className={panelContents()}>
          <ParamsTab endpoint={endpoint} save={save} dt={dt} />
        </TabPanel>
        <TabPanel id="headers" className={panelContents()}>
          <HeadersTab endpoint={endpoint} save={save} dt={dt} />
        </TabPanel>
        <TabPanel id="body" className={panelContents()}>
          <BodyTab endpoint={endpoint} save={save} dt={dt} />
        </TabPanel>
        <TabPanel id="auth" className={panelContents()}>
          <AuthTab endpoint={endpoint} save={save} dt={dt} />
        </TabPanel>
        <TabPanel id="response" className={panelContents()}>
          <ResponseTab endpoint={endpoint} run={run} dt={dt} save={save} />
        </TabPanel>
      </Tabs>
    </div>
  );
}

type SaveFn = (patch: Partial<ApiEndpoint>) => Promise<void>;
type DtFn = (
  key: string,
  params?: Record<string, string | number | boolean>,
) => string;

// ============================================
// key-value 편집기 (a11y — Y6: 행별 Remove 고유 이름, Add 후 새 key 포커스)
// ============================================

interface KeyValueRow {
  key: string;
  value: string;
}

function KeyValueEditor({
  rows,
  onChange,
  addLabel,
  removeLabel,
  keyPlaceholder,
  valuePlaceholder,
}: {
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
  addLabel: string;
  removeLabel: (key: string, index: number) => string;
  keyPlaceholder: string;
  valuePlaceholder: string;
}) {
  const groupId = useId();
  // 로컬 draft — 빈 행을 즉시 store 에 쓰지 않는다 (define_endpoint 는 실제 값 편집에만).
  // 외부 (endpoint) 가 바뀌면 (다른 편집·undo) 다시 seed 한다.
  const [draft, setDraft] = useState<KeyValueRow[]>(rows);
  const seedRef = useRef(JSON.stringify(rows));
  useEffect(() => {
    const next = JSON.stringify(rows);
    if (next !== seedRef.current) {
      seedRef.current = next;
      setDraft(rows);
    }
  }, [rows]);
  const focusNext = useRef(false);
  const lastKeyRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusNext.current) {
      focusNext.current = false;
      lastKeyRef.current?.focus();
    }
  });

  // 비어 있지 않은 (key 가 있는) 행만 상위로 — 빈 행은 draft 에만 남긴다.
  const commit = (next: KeyValueRow[]) => {
    setDraft(next);
    const filled = next.filter((r) => r.key.trim() !== "");
    const filledJson = JSON.stringify(filled);
    if (filledJson !== JSON.stringify(rows.filter((r) => r.key.trim() !== ""))) {
      seedRef.current = JSON.stringify(next);
      onChange(filled);
    }
  };
  const update = (index: number, patch: Partial<KeyValueRow>) => {
    commit(draft.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };
  const remove = (index: number) => commit(draft.filter((_, i) => i !== index));
  const add = () => {
    focusNext.current = true;
    setDraft([...draft, { key: "", value: "" }]);
  };

  return (
    <div className="datatable-kv" role="group" aria-labelledby={`${groupId}-h`}>
      <span id={`${groupId}-h`} className="datatable-kv-heading" hidden>
        {addLabel}
      </span>
      {draft.map((row, index) => (
        <div className="datatable-kv-row" key={index}>
          <input
            ref={index === draft.length - 1 ? lastKeyRef : undefined}
            type="text"
            className="datatable-api-input"
            aria-label={`${keyPlaceholder} ${index + 1}`}
            placeholder={keyPlaceholder}
            spellCheck={false}
            value={row.key}
            onChange={(e) => update(index, { key: e.target.value })}
          />
          <input
            type="text"
            className="datatable-api-input"
            aria-label={`${valuePlaceholder} ${index + 1}`}
            placeholder={valuePlaceholder}
            spellCheck={false}
            value={row.value}
            onChange={(e) => update(index, { value: e.target.value })}
          />
          <Button
            className="datatable-kv-remove"
            aria-label={removeLabel(row.key, index)}
            onPress={() => remove(index)}
          >
            <Trash2 size={iconSmall.size} />
          </Button>
        </div>
      ))}
      <Button className="control-button" data-variant="add" onPress={add}>
        <Plus size={iconSmall.size} />
        {addLabel}
      </Button>
    </div>
  );
}

function ParamsTab({
  endpoint,
  save,
  dt,
}: {
  endpoint: ApiEndpoint;
  save: SaveFn;
  dt: DtFn;
}) {
  const rows = endpoint.queryParams.map((q) => ({
    key: q.key,
    value: q.value,
  }));
  return (
    <div className="datatable-api-section">
      <p className="datatable-api-hint">{dt("apiParamsHint")}</p>
      <KeyValueEditor
        rows={rows}
        addLabel={dt("apiAddParam")}
        keyPlaceholder={dt("apiKeyPlaceholder")}
        valuePlaceholder={dt("apiValuePlaceholder")}
        removeLabel={(key, i) =>
          `${dt("apiRemoveRow")}: ${key || dt("apiKeyPlaceholder")} ${i + 1}`
        }
        onChange={(next) =>
          void save({
            queryParams: next.map<ApiParam>((r) => ({
              key: r.key,
              value: r.value,
              type: "string",
              required: false,
            })),
          })
        }
      />
    </div>
  );
}

function HeadersTab({
  endpoint,
  save,
  dt,
}: {
  endpoint: ApiEndpoint;
  save: SaveFn;
  dt: DtFn;
}) {
  const rows = (endpoint.headers ?? []).map((h) => ({
    key: h.key,
    value: h.value,
  }));
  return (
    <div className="datatable-api-section">
      <KeyValueEditor
        rows={rows}
        addLabel={dt("apiAddHeader")}
        keyPlaceholder={dt("apiKeyPlaceholder")}
        valuePlaceholder={dt("apiValuePlaceholder")}
        removeLabel={(key, i) =>
          `${dt("apiRemoveRow")}: ${key || dt("apiKeyPlaceholder")} ${i + 1}`
        }
        onChange={(next) =>
          void save({
            headers: next.map<ApiHeader>((r) => ({
              key: r.key,
              value: r.value,
              enabled: true,
            })),
          })
        }
      />
    </div>
  );
}

function BodyTab({
  endpoint,
  save,
  dt,
}: {
  endpoint: ApiEndpoint;
  save: SaveFn;
  dt: DtFn;
}) {
  const bodyId = useId();
  return (
    <div className="datatable-api-section">
      <fieldset className="properties-aria">
        <legend className="fieldset-legend">{dt("apiBodyType")}</legend>
        <PropertySelect
          value={endpoint.bodyType}
          onChange={(v) => void save({ bodyType: v as BodyType })}
          options={BODY_TYPES.map((b) => ({ value: b, label: b }))}
          aria-label={dt("apiBodyType")}
        />
      </fieldset>
      {endpoint.bodyType !== "none" && (
        <textarea
          className="datatable-api-body"
          aria-label={dt("body")}
          aria-multiline="true"
          spellCheck={false}
          id={bodyId}
          defaultValue={endpoint.bodyTemplate ?? ""}
          key={`${endpoint.id}-body`}
          placeholder={dt("apiBodyPlaceholder")}
          rows={10}
          onBlur={(e) => {
            if (e.target.value !== (endpoint.bodyTemplate ?? ""))
              void save({ bodyTemplate: e.target.value });
          }}
        />
      )}
    </div>
  );
}

// ============================================
// Auth 탭 — 프리셋 + vault (원문은 이 기기에만, HC6)
// ============================================

function AuthTab({
  endpoint,
  save,
  dt,
}: {
  endpoint: ApiEndpoint;
  save: SaveFn;
  dt: DtFn;
}) {
  const detected = useMemo(
    () => detectAuthPreset(endpoint.headers ?? [], endpoint.queryParams ?? []),
    [endpoint.headers, endpoint.queryParams],
  );
  const [preset, setPreset] = useState<AuthPreset["type"]>(detected.type);
  const [name, setName] = useState(
    "name" in detected ? detected.name : "X-API-Key",
  );
  const [where, setWhere] = useState<"header" | "query">(
    detected.type === "apiKey" ? detected.in : "header",
  );
  const [secretName, setSecretName] = useState(
    `${endpoint.name.replace(/[^A-Za-z0-9]+/g, "_").toUpperCase()}_KEY`,
  );
  const [secretValue, setSecretValue] = useState("");
  const [savedNames, setSavedNames] = useState<string[]>([]);

  useEffect(() => {
    void listSecretNames(endpoint.project_id).then(setSavedNames);
  }, [endpoint.project_id]);

  // 프리셋을 헤더/쿼리 항목으로 반영 (auth 계열만 교체, 나머지 헤더는 보존)
  const applyPreset = (auth: AuthPreset) => {
    const entries = authToEntries(auth);
    const nonAuthHeaders = (endpoint.headers ?? []).filter(
      (h) => !/^authorization$/i.test(h.key) && !isApiKeyHeader(h.key),
    );
    const nonAuthQuery = (endpoint.queryParams ?? []).filter(
      (q) => !isApiKeyQuery(q.key),
    );
    void save({
      headers: [...nonAuthHeaders, ...entries.headers],
      queryParams: [...nonAuthQuery, ...entries.queryParams],
    });
  };

  const buildAuth = (type: AuthPreset["type"]): AuthPreset => {
    switch (type) {
      case "none":
        return { type: "none" };
      case "bearer":
        return { type: "bearer", secretName };
      case "basic":
        return { type: "basic", secretName };
      case "apiKey":
        return { type: "apiKey", in: where, name, secretName };
    }
  };

  const saveSecret = async () => {
    if (!secretName || secretValue === "") return;
    await setSecret(endpoint.project_id, secretName, secretValue);
    setSecretValue("");
    setSavedNames(await listSecretNames(endpoint.project_id));
    announceDataPanelStatus(dt("apiAuthSaved"), { tone: "success" });
  };

  return (
    <div className="datatable-api-section">
      <fieldset className="properties-aria">
        <legend className="fieldset-legend">{dt("apiAuthType")}</legend>
        <PropertySelect
          value={preset}
          onChange={(v) => {
            const type = v as AuthPreset["type"];
            setPreset(type);
            applyPreset(buildAuth(type));
          }}
          options={[
            { value: "none", label: dt("apiAuthNone") },
            { value: "bearer", label: dt("apiAuthBearer") },
            { value: "apiKey", label: dt("apiAuthApiKey") },
            { value: "basic", label: dt("basic") },
          ]}
          aria-label={dt("apiAuthType")}
        />
      </fieldset>

      {preset === "apiKey" && (
        <>
          <fieldset className="properties-aria">
            <legend className="fieldset-legend">{dt("apiAuthIn")}</legend>
            <PropertySelect
              value={where}
              onChange={(v) => {
                const w = v as "header" | "query";
                setWhere(w);
                applyPreset({ type: "apiKey", in: w, name, secretName });
              }}
              options={[
                { value: "header", label: dt("apiAuthInHeader") },
                { value: "query", label: dt("apiAuthInQuery") },
              ]}
              aria-label={dt("apiAuthIn")}
            />
          </fieldset>
          <fieldset className="properties-aria">
            <legend className="fieldset-legend">{dt("apiAuthKeyName")}</legend>
            <input
              type="text"
              className="datatable-api-input"
              value={name}
              spellCheck={false}
              onChange={(e) => setName(e.target.value)}
              onBlur={() =>
                applyPreset({ type: "apiKey", in: where, name, secretName })
              }
            />
          </fieldset>
        </>
      )}

      {preset !== "none" && (
        <>
          <fieldset className="properties-aria">
            <legend className="fieldset-legend">
              {dt("apiAuthSecretName")}
            </legend>
            <input
              type="text"
              className="datatable-api-input"
              value={secretName}
              spellCheck={false}
              onChange={(e) => setSecretName(e.target.value)}
              onBlur={() => applyPreset(buildAuth(preset))}
            />
          </fieldset>
          <fieldset className="properties-aria">
            <legend className="fieldset-legend">{dt("apiAuthValue")}</legend>
            <div className="datatable-api-secret-row">
              <input
                type="password"
                className="datatable-api-input"
                value={secretValue}
                autoComplete="off"
                spellCheck={false}
                placeholder={
                  savedNames.includes(secretName)
                    ? dt("apiAuthSaved")
                    : dt("apiAuthUnset")
                }
                onChange={(e) => setSecretValue(e.target.value)}
              />
              <Button
                className="control-button"
                onPress={() => void saveSecret()}
                isDisabled={secretValue === "" || secretName === ""}
              >
                {dt("apiAuthSave")}
              </Button>
            </div>
            <p className="datatable-api-hint">{dt("apiAuthValueHint")}</p>
          </fieldset>
        </>
      )}
    </div>
  );
}

const API_KEY_HEADERS = new Set([
  "x-api-key",
  "api-key",
  "apikey",
  "x-auth-token",
]);
const API_KEY_QUERIES = new Set([
  "api_key",
  "apikey",
  "api-key",
  "key",
  "token",
  "access_token",
]);
const isApiKeyHeader = (key: string) =>
  API_KEY_HEADERS.has(key.trim().toLowerCase());
const isApiKeyQuery = (key: string) =>
  API_KEY_QUERIES.has(key.trim().toLowerCase());

// ============================================
// Response 탭 — status/time/size + Pretty/Raw/Schema + 테이블로 저장
// ============================================

function ResponseTab({
  endpoint,
  run,
  dt,
  save,
}: {
  endpoint: ApiEndpoint;
  run: ApiRunRecord | null;
  dt: DtFn;
  save: SaveFn;
}) {
  const [view, setView] = useState<"pretty" | "raw" | "schema">("pretty");
  if (!run || !run.response) {
    return (
      <div className="datatable-api-section">
        <div className="datatable-api-empty">
          {run && !run.response
            ? (run.error ?? dt("apiResponseEmpty"))
            : dt("apiResponseEmpty")}
        </div>
      </div>
    );
  }
  const { response } = run;
  const bytes = new Blob([response.bodyPreview]).size;
  const sizeText =
    bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(response.bodyPreview);
  } catch {
    // 비-JSON 응답 — Raw 로만 본다
  }

  return (
    <div className="datatable-api-section datatable-api-response">
      <div
        className="datatable-api-status"
        role="status"
        aria-live="polite"
        data-ok={run.ok || undefined}
      >
        <span data-field="status">
          {dt("apiResponseStatus")} {response.status} {response.statusText}
        </span>
        <span data-field="time">
          {dt("apiResponseTime")} {run.durationMs} ms
        </span>
        <span data-field="size">
          {dt("apiResponseSize")} {sizeText}
          {response.bodyTruncated ? "+" : ""}
        </span>
      </div>

      <div
        className="datatable-api-response-tabs"
        role="tablist"
        aria-label="view"
      >
        {(["pretty", "raw", "schema"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            className="datatable-api-response-tab"
            data-selected={view === v || undefined}
            onClick={() => setView(v)}
          >
            {dt(
              v === "pretty"
                ? "apiResponsePretty"
                : v === "raw"
                  ? "apiResponseRaw"
                  : "apiResponseSchema",
            )}
          </button>
        ))}
      </div>

      {view === "raw" && (
        <pre className="datatable-api-body-view">{response.bodyPreview}</pre>
      )}
      {view === "pretty" && (
        <pre className="datatable-api-body-view">
          {parsed !== null
            ? JSON.stringify(parsed, null, 2)
            : response.bodyPreview}
        </pre>
      )}
      {view === "schema" && (
        <SchemaView endpoint={endpoint} parsed={parsed} dt={dt} save={save} />
      )}
    </div>
  );
}

function SchemaView({
  endpoint,
  parsed,
  dt,
  save,
}: {
  endpoint: ApiEndpoint;
  parsed: unknown;
  dt: DtFn;
  save: SaveFn;
}) {
  const applyDataChange = useDataStore((state) => state.applyDataChange);
  const candidates = useMemo(() => recommendArrayPaths(parsed), [parsed]);
  const [path, setPath] = useState(
    () => endpoint.responseMapping?.dataPath ?? candidates[0]?.path ?? "",
  );
  const [tableName, setTableName] = useState(endpoint.name || "table");
  const [attach, setAttach] = useState(false);
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => {
    const resolved = resolveResponseData(readPath(parsed, path), "");
    return Array.isArray(resolved.data) ? resolved.data : [];
  }, [parsed, path]);
  const columns: DetectedColumn[] = useMemo(() => detectColumns(rows), [rows]);

  if (candidates.length === 0) {
    return <div className="datatable-api-empty">{dt("apiSchemaNoArray")}</div>;
  }

  const doSave = async () => {
    setSaving(true);
    try {
      const collectionId = crypto.randomUUID();
      const schema = columns
        .filter((c) => c.selected !== false)
        .map((c) => ({ key: c.key, type: c.type }));
      const selectedKeys = new Set(schema.map((s) => s.key));
      const projectedRows = (rows as Record<string, unknown>[]).map((r) => {
        const out: Record<string, unknown> = {};
        for (const key of selectedKeys) out[key] = r[key];
        return out;
      });
      const ops: DataOp[] = buildSaveApiAsTableOps({
        projectId: endpoint.project_id,
        collectionId,
        tableName,
        schema,
        rows: projectedRows,
        endpoint,
        dataPath: path,
        mode: attach ? "attach" : "create",
      });
      await applyDataChange({ ops, origin: "user" });
      announceDataPanelStatus(dt("apiSaved", { name: tableName }), {
        tone: "success",
      });
    } catch (error) {
      globalToast.error(
        dt("apiSaveFailed", {
          message: error instanceof Error ? error.message : String(error),
        }),
      );
      // set_source·define_endpoint 은 213 coordinator 가 이미 rollback 했다.
      void save;
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="datatable-api-schema">
      <fieldset className="properties-aria">
        <legend className="fieldset-legend">{dt("apiSchemaPath")}</legend>
        <PropertySelect
          value={path}
          onChange={setPath}
          options={candidates.map((c) => ({
            value: c.path,
            label: dt("apiSchemaCandidate", {
              path: c.path === "" ? "/" : c.path,
              count: c.count,
            }),
          }))}
          aria-label={dt("apiSchemaPath")}
        />
      </fieldset>
      <ul className="datatable-api-schema-cols">
        {columns.map((c) => (
          <li key={c.key}>
            <code>{c.key}</code>
            <span className="datatable-api-schema-type">{c.type}</span>
          </li>
        ))}
      </ul>
      <label className="datatable-api-attach">
        <input
          type="checkbox"
          checked={attach}
          onChange={(e) => setAttach(e.target.checked)}
        />
        {dt("apiAttachExisting")}
      </label>
      <fieldset className="properties-aria">
        <legend className="fieldset-legend">{dt("apiSaveTableName")}</legend>
        <input
          type="text"
          className="datatable-api-input"
          value={tableName}
          spellCheck={false}
          onChange={(e) => setTableName(e.target.value)}
        />
      </fieldset>
      <Button
        className="control-button"
        data-variant="primary"
        onPress={() => void doSave()}
        isDisabled={saving || columns.length === 0 || tableName.trim() === ""}
      >
        {dt("apiSaveAsTable")}
      </Button>
    </div>
  );
}

export default ApiEndpointEditor;
