/**
 * VariableCreator — 새 변수 생성 패널 (편집 패널의 `variable-create` 모드).
 *
 * Why (2026-09-11, 리서치 U2): 종전에는 목록의 "Add Variable" 이 `window.prompt` 한 줄이었고
 * 이 모드는 TODO EmptyState 였다. 만들면 같은 자리가 변수 편집기로 바뀐다.
 * ADR-214 Phase 5: 여기서 만드는 것은 **프로젝트 변수뿐** — 페이지 변수는 Navigator 페이지 설정
 * (body 선택 → Properties 상태 절), 요소 변수는 Properties 상태 절이 소유자 모델로 만든다. 구
 * `scope:"page"` 생성 (page_id 필수) 은 그 표면으로 대체됐다. 이름은 프로젝트 변수끼리뿐 아니라
 * 문서 안 페이지·요소 state 이름과도 겹칠 수 없다 (적용기 `define_variable` 가 거부 — HC5).
 */
import { useCallback, useState } from "react";
import { Button } from "react-aria-components/Button";
import { useDataStore, useVariables } from "../../../stores/data";
import { useDataTableEditorStore } from "../stores/dataTableEditorStore";
import { PropertyFieldset, PropertySelect, Section } from "../../../components";
import type { VariableType } from "../../../../types/builder/data.types";
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

  const [name, setName] = useState("");
  const [type, setType] = useState<VariableType>("string");
  const [isCreating, setIsCreating] = useState(false);

  const trimmed = name.trim();
  const duplicate =
    trimmed.length > 0 && variables.some((v) => v.name === trimmed);
  const canCreate = trimmed.length > 0 && !duplicate && !isCreating;

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
        scope: "global",
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
          <p className="creator-form-hint">
            {localize(
              "variableCreateHint",
              "Default value and persistence are set in the editor after creating.",
            )}
          </p>
          <p className="creator-form-hint">
            {localize(
              "variableCreateOwnerHint",
              "Page and component variables are added at their owner — page settings in Navigator, or the State section in Properties.",
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
