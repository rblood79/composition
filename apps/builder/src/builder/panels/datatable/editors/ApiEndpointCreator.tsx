/**
 * ApiEndpointCreator — 새 API 생성 패널 (편집 패널의 `api-create` 모드).
 *
 * Why (2026-09-11, 리서치 U2): 종전에는 목록의 "Add API" 가 `window.prompt` 한 줄이었고
 * 이 모드는 TODO EmptyState 였다. 생성은 목록 옆에 스냅되는 이 패널에서 하고, 만들면
 * 같은 자리가 API 편집기 (Run 탭) 로 바뀐다 — 응답 스키마를 바로 본다.
 */
import { useCallback, useState } from "react";
import { Button } from "react-aria-components/Button";
import { useDataStore } from "../../../stores/data";
import { useDataTableEditorStore } from "../stores/dataTableEditorStore";
import { PropertyFieldset, PropertySelect, Section } from "../../../components";
import type { HttpMethod } from "../../../../types/builder/data.types";
import { splitApiUrl, suggestApiName } from "../../../../utils/data/apiUrl";
import { globalToast } from "../../../stores/toast";
import { translateKey, useOptionalI18n } from "../../../../i18n";
import "./DataTableCreator.css";

const METHODS: { value: HttpMethod; label: string }[] = [
  { value: "GET", label: "GET" },
  { value: "POST", label: "POST" },
  { value: "PUT", label: "PUT" },
  { value: "PATCH", label: "PATCH" },
  { value: "DELETE", label: "DELETE" },
];

interface ApiEndpointCreatorProps {
  projectId: string;
  onClose: () => void;
}

export function ApiEndpointCreator({
  projectId,
  onClose,
}: ApiEndpointCreatorProps) {
  const i18n = useOptionalI18n();
  const localize = useCallback(
    (key: string, fallback: string) =>
      i18n ? translateKey(i18n.t, `datatable.${key}`, fallback) : fallback,
    [i18n],
  );
  const applyDataChange = useDataStore((state) => state.applyDataChange);
  const openApiEditor = useDataTableEditorStore((state) => state.openApiEditor);

  const [url, setUrl] = useState("");
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const effectiveName = nameTouched ? name : suggestApiName(url);
  const canCreate = url.trim().length > 0 && !isCreating;

  const handleCreate = useCallback(async () => {
    if (!canCreate) return;
    const { baseUrl, path } = splitApiUrl(url);
    setIsCreating(true);
    try {
      // HC1 — 생성도 applyDataChange (define_endpoint). 적용기가 id 를 발급해 endpointIds 에 싣는다.
      const result = await applyDataChange(
        {
          ops: [
            {
              op: "define_endpoint",
              endpoint: {
                name: effectiveName || url.trim(),
                method,
                baseUrl,
                path,
              },
            },
          ],
          origin: "user",
        },
        { projectId },
      );
      const createdId = result.endpointIds[0];
      if (createdId) openApiEditor(createdId, "response");
    } catch (error) {
      console.error("API Endpoint 생성 실패:", error);
      globalToast.error(
        localize("apiCreateFailed", "Could not create the API endpoint"),
      );
    } finally {
      setIsCreating(false);
    }
  }, [
    canCreate,
    url,
    applyDataChange,
    effectiveName,
    projectId,
    method,
    openApiEditor,
    localize,
  ]);

  return (
    <div className="datatable-creator">
      <div className="datatable-creator-body">
        <Section
          id="api-creator"
          title={localize("apiRequest", "Request")}
          collapsible={false}
        >
          <PropertyFieldset legend={localize("apiUrl", "URL")}>
            <input
              className="react-aria-Input"
              type="url"
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreate();
              }}
              placeholder="https://jsonplaceholder.typicode.com/users"
              aria-label={localize("apiUrl", "URL")}
            />
          </PropertyFieldset>
          <PropertySelect
            label={localize("apiMethod", "Method")}
            value={method}
            onChange={(value) => setMethod(value as HttpMethod)}
            options={METHODS}
            translateOptions={false}
          />
          <PropertyFieldset legend={localize("apiName", "Name")}>
            <input
              className="react-aria-Input"
              type="text"
              value={effectiveName}
              onChange={(e) => {
                setNameTouched(true);
                setName(e.target.value);
              }}
              placeholder={localize("apiNameAuto", "Suggested from the URL")}
              aria-label={localize("apiName", "Name")}
            />
          </PropertyFieldset>
          <p className="creator-form-hint">
            {localize(
              "apiCreateHint",
              "After creating, the endpoint runs once so you can review the response schema.",
            )}
          </p>
        </Section>
      </div>
      <div className="creator-footer">
        <Button className="control-button" onPress={onClose}>
          {i18n ? i18n.t("common.cancel") : "Cancel"}
        </Button>
        <Button
          className="control-button"
          data-variant="primary"
          onPress={() => void handleCreate()}
          isDisabled={!canCreate}
        >
          {localize("createApi", "Create API")}
        </Button>
      </div>
    </div>
  );
}

export default ApiEndpointCreator;
