/**
 * VariableCreator — 새 변수 생성 패널 (편집 패널의 `variable-create` 모드).
 *
 * Why (2026-09-11, 리서치 U2): 종전에는 목록의 "Add Variable" 이 `window.prompt` 한 줄이었고
 * 이 모드는 TODO EmptyState 였다. 만들면 같은 자리가 변수 편집기로 바뀐다.
 * scope 는 지금 타입의 global · page 만 — 소유자 모델 (UX-10) 은 ADR-214.
 * page 는 **현재 페이지를 `page_id` 로** 넘긴다 (2026-09-11 사용자 판정 — 구 UI 가 한 번도
 * 안 채워 실 데이터의 page 변수가 전부 소유 페이지 없이 저장됐다). 현재 페이지가 없으면
 * page 변수는 만들 수 없다.
 */
import { useCallback, useState } from "react";
import { Button } from "react-aria-components/Button";
import { useDataStore, useVariables } from "../../../stores/data";
import { useStore } from "../../../stores";
import { useDataTableEditorStore } from "../stores/dataTableEditorStore";
import { PropertyFieldset, PropertySelect, Section } from "../../../components";
import type {
  VariableScope,
  VariableType,
} from "../../../../types/builder/data.types";
import { globalToast } from "../../../stores/toast";
import { translateKey, useOptionalI18n } from "../../../../i18n";
import "./DataTableCreator.css";

const TYPES: { value: VariableType; label: string }[] = [
  { value: "string", label: "String" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "object", label: "Object" },
  { value: "array", label: "Array" },
];

const SCOPES: { value: VariableScope; label: string }[] = [
  { value: "global", label: "Global" },
  { value: "page", label: "Page" },
];

const DEFAULTS: Record<VariableType, unknown> = {
  string: "",
  number: 0,
  boolean: false,
  object: {},
  array: [],
};

interface VariableCreatorProps {
  projectId: string;
  onClose: () => void;
}

export function VariableCreator({ projectId, onClose }: VariableCreatorProps) {
  const i18n = useOptionalI18n();
  const localize = useCallback(
    (key: string, fallback: string) =>
      i18n ? translateKey(i18n.t, `datatable.${key}`, fallback) : fallback,
    [i18n],
  );
  const createVariable = useDataStore((state) => state.createVariable);
  const variables = useVariables();
  const openVariableEditor = useDataTableEditorStore(
    (state) => state.openVariableEditor,
  );

  const currentPageId = useStore((state) => state.currentPageId);
  const currentPageTitle = useStore(
    (state) =>
      state.pages.find((page) => page.id === state.currentPageId)?.title,
  );

  const [name, setName] = useState("");
  const [type, setType] = useState<VariableType>("string");
  const [scope, setScope] = useState<VariableScope>("global");
  const [isCreating, setIsCreating] = useState(false);

  const trimmed = name.trim();
  const duplicate =
    trimmed.length > 0 && variables.some((v) => v.name === trimmed);
  const pageOwnerMissing = scope === "page" && !currentPageId;
  const canCreate =
    trimmed.length > 0 && !duplicate && !isCreating && !pageOwnerMissing;

  const handleCreate = useCallback(async () => {
    if (!canCreate) return;
    setIsCreating(true);
    try {
      const created = await createVariable({
        name: trimmed,
        project_id: projectId,
        type,
        defaultValue: DEFAULTS[type],
        persist: false,
        scope,
        ...(scope === "page" && currentPageId
          ? { page_id: currentPageId }
          : {}),
      });
      openVariableEditor(created.id);
    } catch (error) {
      console.error("Variable 생성 실패:", error);
      globalToast.error(
        localize("variableCreateFailed", "Could not create the variable"),
      );
    } finally {
      setIsCreating(false);
    }
  }, [
    canCreate,
    createVariable,
    trimmed,
    projectId,
    type,
    scope,
    currentPageId,
    openVariableEditor,
    localize,
  ]);

  return (
    <div className="datatable-creator">
      <div className="datatable-creator-body">
        <Section
          id="variable-creator"
          title={localize("variable", "Variable")}
          collapsible={false}
        >
          <PropertyFieldset legend={localize("variableName", "Name")}>
            <input
              className="react-aria-Input"
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreate();
              }}
              placeholder="currentUser"
              aria-label={localize("variableName", "Name")}
              aria-invalid={duplicate || undefined}
            />
          </PropertyFieldset>
          {duplicate ? (
            <p className="creator-form-hint" role="alert">
              {localize(
                "variableNameExists",
                "A variable with this name already exists.",
              )}
            </p>
          ) : null}
          <PropertySelect
            label={localize("variableType", "Type")}
            value={type}
            onChange={(value) => setType(value as VariableType)}
            options={TYPES}
            translateOptions={false}
          />
          <PropertySelect
            label={localize("variableScope", "Scope")}
            value={scope}
            onChange={(value) => setScope(value as VariableScope)}
            options={SCOPES}
            translateOptions={false}
          />
          {scope === "page" ? (
            pageOwnerMissing ? (
              <p className="creator-form-hint" role="alert">
                {localize(
                  "variablePageMissing",
                  "No current page — page variables need an owner page.",
                )}
              </p>
            ) : (
              <p className="creator-form-hint">
                {localize("variablePageOwner", "Owner page")}:{" "}
                {currentPageTitle ?? currentPageId}
              </p>
            )
          ) : null}
          <p className="creator-form-hint">
            {localize(
              "variableCreateHint",
              "Default value, persistence and validation are set in the editor after creating.",
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
          {localize("createVariable", "Create Variable")}
        </Button>
      </div>
    </div>
  );
}

export default VariableCreator;
