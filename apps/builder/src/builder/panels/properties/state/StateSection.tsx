/**
 * ADR-214 Phase 5 — Properties "상태" 절 (ElementState 아트보드).
 *
 * 소유자 두 종류를 한 절이 맡는다:
 * - 일반 요소 → 요소 변수 (`CanonicalNode.state`) — 암묵 상태 (RAC prop, `IMPLICIT_STATE_SOURCES`)
 *   는 이름만 붙이면 정의가 되고 (`source.prop`), 명시 상태는 `+ 추가`
 * - body → **페이지** 변수 (canonical page 노드 `state`) — Navigator 페이지 설정 (gear) 이 body 를
 *   선택해 여기로 온다 (새 rail 패널 0 — G4)
 *
 * 쓰기는 `updateElement(id, { state })` (요소 · History `update` full-node) / `setPageState`
 * (페이지 · History `page-state`) — Properties 가 canonical 을 직접 만지지 않는다.
 * 이름은 가시성 사슬 안 고유 (`findVariableNameConflict`, HC5) — 충돌은 문구로 거부하고 쓰지 않는다.
 * 삭제는 사용처 (`collectVariableUsages` — 템플릿 · setState 규칙) 수를 확인 문구에 싣는다.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  collectVariableUsages,
  findCanonicalNodeById,
  findVariableNameConflict,
  isVariableDefList,
  normalizeImplicitStateValue,
  resolveImplicitStateSources,
  resolveVisibleVariables,
  VARIABLE_DEF_TYPES,
  type VariableDef,
  type VariableDefType,
  type VariableOwner,
  type VisibleVariable,
} from "@composition/shared";

import { useI18n } from "@/i18n";
import { PropertyInput, PropertySection, PropertySelect } from "../../../components";
import { ConfirmDialog } from "../../../components/overlay";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { useStore } from "../../../stores";
import { useActiveCanonicalDocument } from "../../../stores/canonical/canonicalElementsBridge";
import { useCanonicalPropertyElement } from "../hooks/useCanonicalPropertyRead";
import { useProjectVariableDefs } from "../hooks/useVisibleVariables";
import {
  formatDefaultInput,
  nextAutoStateName,
  parseDefaultInput,
  withType,
} from "./stateDefsEditing";
import { useStateSectionFocus } from "./stateSectionFocus";
import "./StateSection.css";

const DeleteIcon = ACTION_ICONS.delete;
const AddIcon = ACTION_ICONS.add;

const NAME_PATTERN = /^[A-Za-z_$][\w$]*$/;

export const STATE_SECTION_ID = "properties-state";

function generateDefId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const StateSection = memo(function StateSection({
  elementId,
}: {
  elementId: string;
}) {
  const { t } = useI18n();
  const doc = useActiveCanonicalDocument();
  const element = useCanonicalPropertyElement(elementId);
  const currentPageId = useStore((s) => s.currentPageId);
  const pages = useStore((s) => s.pages);
  const projectDefs = useProjectVariableDefs();

  const isBody = element?.type === "body";
  const ownerNodeId = isBody ? currentPageId : elementId;
  type OwnerTarget =
    | { kind: "page"; pageId: string }
    | { kind: "element"; elementId: string };
  const owner = useMemo<OwnerTarget | null>(() => {
    if (!ownerNodeId) return null;
    return isBody
      ? { kind: "page", pageId: ownerNodeId }
      : { kind: "element", elementId: ownerNodeId };
  }, [isBody, ownerNodeId]);

  const ownerNode = useMemo(
    () => (doc && ownerNodeId ? findCanonicalNodeById(doc, ownerNodeId) : undefined),
    [doc, ownerNodeId],
  );
  const defs = useMemo<VariableDef[]>(
    () => (isVariableDefList(ownerNode?.state) ? ownerNode.state : []),
    [ownerNode],
  );

  const visible = useMemo<VisibleVariable[]>(() => {
    if (!owner) return [];
    return resolveVisibleVariables(doc, owner, projectDefs);
  }, [doc, owner, projectDefs]);
  const ancestorVisible = useMemo(
    () =>
      visible.filter((entry) => {
        if (!owner) return true;
        const target = entry.owner;
        if (target.kind === "page")
          return owner.kind !== "page" || target.pageId !== owner.pageId;
        if (target.kind === "element")
          return owner.kind !== "element" || target.elementId !== owner.elementId;
        return true;
      }),
    [visible, owner],
  );

  const implicitSources = useMemo(
    () => (isBody || !element ? [] : resolveImplicitStateSources(element.type)),
    [isBody, element],
  );

  const commit = useCallback(
    (next: VariableDef[]) => {
      if (!ownerNodeId) return;
      if (isBody) {
        useStore.getState().setPageState(ownerNodeId, next);
      } else {
        void useStore.getState().updateElement(ownerNodeId, { state: next });
      }
    },
    [isBody, ownerNodeId],
  );

  const ownerLabel = useCallback(
    (target: VariableOwner): string => {
      if (target.kind === "project") return t("propertiesPanel.stateOwnerProject");
      if (target.kind === "page") {
        const title = pages.find((page) => page.id === target.pageId)?.title;
        return `${t("propertiesPanel.stateOwnerPage")}${title ? ` ${title}` : ""}`;
      }
      const node = doc ? findCanonicalNodeById(doc, target.elementId) : undefined;
      return node?.name ?? node?.type ?? target.elementId;
    },
    [doc, pages, t],
  );

  /** 이름 검증 — 문법 + 사슬 고유. 통과면 null, 아니면 거부 문구 */
  const validateName = useCallback(
    (name: string, excludeId: string): string | null => {
      const trimmed = name.trim();
      if (!NAME_PATTERN.test(trimmed)) return t("propertiesPanel.stateNameInvalid");
      if (!owner) return null;
      const conflict = findVariableNameConflict(doc, owner, trimmed, projectDefs, excludeId);
      if (conflict)
        return t("propertiesPanel.stateNameConflict", {
          name: trimmed,
          owner: ownerLabel(conflict.owner),
        });
      return null;
    },
    [doc, owner, ownerLabel, projectDefs, t],
  );

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<VariableDef | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const setError = useCallback((id: string, message: string | null) => {
    setErrors((prev) => {
      if (message === null) {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: message };
    });
  }, []);

  const usageCount = useCallback(
    (variableId: string) =>
      collectVariableUsages(doc, doc?.events, variableId, projectDefs).length,
    [doc, projectDefs],
  );

  // Data 탭 인덱스 → 점프 (절 스크롤 + 정의 펼침)
  const focusRequest = useStateSectionFocus((s) => s.request);
  const sectionRef = useRef<HTMLDivElement>(null);
  const handledSeq = useRef(0);
  useEffect(() => {
    if (!focusRequest || focusRequest.seq === handledSeq.current) return;
    if (focusRequest.ownerNodeId !== ownerNodeId) return;
    handledSeq.current = focusRequest.seq;
    if (focusRequest.variableId) setExpandedId(focusRequest.variableId);
    sectionRef.current?.scrollIntoView({ block: "nearest" });
  }, [focusRequest, ownerNodeId]);

  const addExplicit = useCallback(() => {
    const taken = new Set(visible.map((entry) => entry.def.name));
    const def: VariableDef = {
      id: generateDefId(),
      name: nextAutoStateName(taken),
      type: "string",
      defaultValue: "",
    };
    commit([...defs, def]);
    setExpandedId(def.id);
  }, [commit, defs, visible]);

  const nameImplicit = useCallback(
    (prop: string, type: VariableDefType, rawName: string) => {
      const name = rawName.trim();
      if (!name) return;
      const probeId = `implicit:${prop}`;
      const message = validateName(name, probeId);
      if (message) {
        setError(probeId, message);
        return;
      }
      setError(probeId, null);
      const authored = (element?.props ?? {})[prop];
      const def: VariableDef = {
        id: generateDefId(),
        name,
        type,
        defaultValue: normalizeImplicitStateValue(type, authored),
        source: { prop },
      };
      commit([...defs, def]);
    },
    [commit, defs, element?.props, setError, validateName],
  );

  const patchDef = useCallback(
    (id: string, next: VariableDef) => {
      commit(defs.map((def) => (def.id === id ? next : def)));
    },
    [commit, defs],
  );

  const renameDef = useCallback(
    (def: VariableDef, rawName: string) => {
      const name = rawName.trim();
      if (name === def.name) {
        setError(def.id, null);
        return;
      }
      const message = validateName(name, def.id);
      if (message) {
        setError(def.id, message);
        return;
      }
      setError(def.id, null);
      patchDef(def.id, { ...def, name });
    },
    [patchDef, setError, validateName],
  );

  const changeDefault = useCallback(
    (def: VariableDef, raw: string) => {
      const parsed = parseDefaultInput(def.type, raw);
      if (!parsed.ok) {
        setError(def.id, t("propertiesPanel.stateDefaultInvalid", { type: def.type }));
        return;
      }
      setError(def.id, null);
      if (parsed.value === def.defaultValue) return;
      patchDef(def.id, { ...def, defaultValue: parsed.value });
    },
    [patchDef, setError, t],
  );

  const confirmDelete = useCallback(() => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;
    commit(defs.filter((def) => def.id !== target.id));
    setError(target.id, null);
  }, [commit, defs, pendingDelete, setError]);

  if (!element || !owner) return null;

  const namedByProp = new Map(
    defs.filter((def) => def.source?.prop).map((def) => [def.source!.prop, def]),
  );
  const explicitDefs = defs.filter((def) => !def.source?.prop);
  const typeOptions = VARIABLE_DEF_TYPES.map((type) => ({ value: type, label: type }));

  const renderDefRow = (def: VariableDef, implicitProp: string | null) => {
    const expanded = expandedId === def.id;
    const usages = usageCount(def.id);
    const error = errors[def.id];
    return (
      <div
        key={def.id}
        className="state-def"
        data-expanded={expanded || undefined}
        data-variable-id={def.id}
        data-implicit={implicitProp ?? undefined}
      >
        <div className="state-def-summary">
          <button
            type="button"
            className="state-def-toggle"
            onClick={() => setExpandedId(expanded ? null : def.id)}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span className="state-def-name">{def.name}</span>
            <span className="state-def-meta">
              {def.type}
              {implicitProp ? ` · ${implicitProp}` : ""}
            </span>
          </button>
          <span className="state-def-usage">
            {t("propertiesPanel.stateUsageCount", { count: usages })}
          </span>
          <button
            type="button"
            className="state-def-remove"
            onClick={() => setPendingDelete(def)}
            aria-label={t("common.delete")}
          >
            <DeleteIcon size={14} />
          </button>
        </div>
        {expanded && (
          <fieldset className="properties-aria state-def-editor">
            <legend className="fieldset-legend">{def.name}</legend>
            <PropertyInput
              label={t("propertiesPanel.stateName")}
              value={def.name}
              onChange={(value) => renameDef(def, value)}
            />
            {!implicitProp && (
              <PropertySelect
                label={t("propertiesPanel.stateType")}
                value={def.type}
                options={typeOptions}
                translateOptions={false}
                onChange={(value) => patchDef(def.id, withType(def, value as VariableDefType))}
              />
            )}
            {def.type === "boolean" ? (
              <PropertySelect
                label={t("propertiesPanel.stateDefault")}
                value={String(def.defaultValue === true)}
                options={[
                  { value: "false", label: "false" },
                  { value: "true", label: "true" },
                ]}
                translateOptions={false}
                onChange={(value) => changeDefault(def, value)}
              />
            ) : (
              <PropertyInput
                label={t("propertiesPanel.stateDefault")}
                value={formatDefaultInput(def)}
                onChange={(value) => changeDefault(def, value)}
              />
            )}
            {owner.kind === "element" && (
              <p className="state-def-hint">{t("propertiesPanel.stateInstanceHint")}</p>
            )}
            {error && (
              <p className="state-def-error" role="alert">
                {error}
              </p>
            )}
          </fieldset>
        )}
        {!expanded && error && (
          <p className="state-def-error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  };

  return (
    <div ref={sectionRef} id={STATE_SECTION_ID} data-state-owner={ownerNodeId}>
      <PropertySection
        title={t("propertiesPanel.stateSection")}
        badge={<span className="state-section-count">{defs.length}</span>}
      >
        <p className="state-section-hint">
          {t(isBody ? "propertiesPanel.stateVisiblePage" : "propertiesPanel.stateVisibleElement")}
        </p>

        {implicitSources.length > 0 && (
          <div className="state-group" data-group="implicit">
            <div className="state-group-header">
              <span className="state-group-title">{t("propertiesPanel.stateImplicitTitle")}</span>
              <span className="state-group-meta">{t("propertiesPanel.stateImplicitRac")}</span>
            </div>
            <p className="state-section-hint">{t("propertiesPanel.stateImplicitHint")}</p>
            {implicitSources.map((source) => {
              const named = namedByProp.get(source.prop);
              if (named) return renderDefRow(named, source.prop);
              const probeId = `implicit:${source.prop}`;
              return (
                <div key={source.prop} className="state-def state-def--unnamed" data-implicit={source.prop}>
                  <div className="state-def-summary">
                    <span className="state-def-name state-def-name--prop">{source.prop}</span>
                    <span className="state-def-meta">{source.type}</span>
                    <input
                      type="text"
                      className="state-def-name-input"
                      placeholder={t("propertiesPanel.stateNamePlaceholder")}
                      aria-label={`${t("propertiesPanel.stateNamePlaceholder")} ${source.prop}`}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          nameImplicit(source.prop, source.type, event.currentTarget.value);
                        }
                      }}
                      onBlur={(event) => {
                        if (event.currentTarget.value.trim())
                          nameImplicit(source.prop, source.type, event.currentTarget.value);
                      }}
                    />
                  </div>
                  {errors[probeId] && (
                    <p className="state-def-error" role="alert">
                      {errors[probeId]}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="state-group" data-group="explicit">
          <div className="state-group-header">
            <span className="state-group-title">
              {t(isBody ? "propertiesPanel.statePageTitle" : "propertiesPanel.stateExplicitTitle")}
            </span>
            <button
              type="button"
              className="control-button"
              data-variant="add"
              onClick={addExplicit}
            >
              <AddIcon size={14} />
              <span>{t("propertiesPanel.stateAdd")}</span>
            </button>
          </div>
          {explicitDefs.map((def) => renderDefRow(def, null))}
        </div>

        {ancestorVisible.length > 0 && (
          <div className="state-group" data-group="ancestors">
            <div className="state-group-header">
              <span className="state-group-title">{t("propertiesPanel.stateAncestorTitle")}</span>
            </div>
            {ancestorVisible.map((entry) => (
              <div key={entry.def.id} className="state-ancestor-row">
                <span className="state-def-name">{entry.def.name}</span>
                <span className="state-def-meta">
                  {entry.def.type} · {ownerLabel(entry.owner)}
                </span>
              </div>
            ))}
          </div>
        )}
      </PropertySection>
      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title={t("propertiesPanel.stateDeleteTitle")}
        message={t("propertiesPanel.stateDeleteMessage", {
          name: pendingDelete?.name ?? "",
          count: pendingDelete ? usageCount(pendingDelete.id) : 0,
        })}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
});
