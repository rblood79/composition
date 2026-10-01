import { memo, useCallback, useMemo, useSyncExternalStore } from "react";
import { Settings2 } from "lucide-react";
import { useI18n } from "../../../../i18n";
import { iconProps } from "../../../../utils/ui/uiConstants";
import {
  catalogPropertiesPatchCommand,
  catalogTargetDefinitionId,
} from "../../../catalogRuntime/editContract";
import {
  CatalogWorkspaceGate,
  useCatalogEditContract,
  useCatalogSession,
  useCatalogWorkspace,
} from "../../../catalogRuntime/react";
import {
  catalogButtonChildren,
  type CatalogButtonChildren,
} from "../../../catalogRuntime/buttonChildren";
import { catalogSettingsPage } from "../../../catalogRuntime/pageSettings";
import { targetKey } from "../../../catalogRuntime/session";
import { EmptyState, PanelContents, PanelHeader } from "../../../components";
import type { EditTarget } from "../../../../../../../packages/shared/src/catalog/document/types";
import { useCatalogCommandRunner } from "../../navigator/catalog/useCatalogCommandRunner";
import { FieldValueSourceContext } from "../generic/fieldValueSource";
import { ItemsSourceContext } from "../generic/itemsSource";
import { CatalogAttributesSection } from "./CatalogAttributesSection";
import { CatalogButtonChildFields } from "./CatalogButtonChildFields";
import { CatalogComponentSection } from "./CatalogComponentSection";
import { CatalogItemInsertSection } from "./CatalogItemInsertSection";
import { CatalogItemRolesSection } from "./CatalogItemRolesSection";
import {
  CatalogCardFieldsSection,
  CatalogItemOriginNotice,
} from "./CatalogRowTemplateSections";
import { CatalogPageSection } from "./CatalogPageSection";
import { CatalogPropertyClipboardActions } from "./CatalogPropertyClipboardActions";
import { CatalogSlotSection } from "./CatalogSlotSection";
import { CatalogLayoutBodySection } from "./CatalogLayoutBodySection";
import { CatalogStateSection } from "./CatalogStateSection";
import { catalogSubpartOwnerType } from "../../../catalogRuntime/subpart";
import { CATALOG_ITEMS_SOURCE } from "./catalogItemsSource";
import { useChartPropertyExtras } from "../useChartPropertyExtras";
import { GenericFieldRenderer } from "../generic/GenericFieldRenderer";
import { CATALOG_FIELD_VALUE_SOURCE } from "./catalogFieldValueSource";

/**
 * ADR-248 Phase 4e-4: Properties of the open catalog project — the selection's edit contract
 * (catalog accepts / reusable contract, value sources from the read model) in the shared generic
 * field renderer. An edit is one `setFields` over every selected target of the same definition
 * (one history step); a value back to the inherited one removes the own write.
 */
export function CatalogPropertiesPanel() {
  return (
    <CatalogWorkspaceGate>
      <CatalogPropertiesContent />
    </CatalogWorkspaceGate>
  );
}

function CatalogPropertiesContent() {
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const selection = useCatalogSession((state) => state.selection);
  const first = selection[0];
  const contract = useCatalogEditContract(first?.target);
  const graph = workspace.runtime.graph;
  // Every selected target showing the same definition takes the edit (a mixed selection edits the
  // first target only).
  const targets = useMemo(() => {
    if (!first) return [];
    try {
      const definition = catalogTargetDefinitionId(graph, first.target);
      return selection
        .filter((item) => {
          try {
            return catalogTargetDefinitionId(graph, item.target) === definition;
          } catch {
            return false;
          }
        })
        .map((item) => item.target);
    } catch {
      return [];
    }
  }, [first, graph, selection]);
  const title = useMemo(() => {
    if (!first) return undefined;
    const entry =
      first.target.kind === "node"
        ? graph.getEntry(first.target.id)
        : undefined;
    return (entry?.kind === "node" && entry.name) || contract.type;
  }, [contract.type, first, graph]);
  const settingsPage =
    first?.target.kind === "node"
      ? catalogSettingsPage(graph, first.target.id)
      : undefined;

  if (!first || !contract.type) {
    return (
      <div className="panel">
        <PanelHeader
          icon={<Settings2 size={iconProps.size} />}
          title={t("panels.properties")}
          panelId="properties"
        />
        <PanelContents>
          <EmptyState
            icon={<Settings2 size={32} />}
            message={t("propertiesPanel.selectElement")}
          />
        </PanelContents>
      </div>
    );
  }
  // A delegated sub-part (a field's Label · Input · FieldError …): its parent composes it, so its
  // own fields reach nothing — the owner notice instead (ADR-923, the old panel's).
  const subpartOwner = catalogSubpartOwnerType(
    graph,
    workspace.root.domInputs,
    first.identity,
    "all",
  );
  if (subpartOwner)
    return (
      <div className="panel">
        <PanelHeader
          icon={<Settings2 size={iconProps.size} />}
          title={title ?? contract.type}
          panelId="properties"
        />
        <PanelContents>
          <EmptyState
            icon={<Settings2 size={32} />}
            message={t("propertiesPanel.delegatedSubpartMessage")}
            description={t("propertiesPanel.delegatedSubpartDescription", {
              type: contract.type,
              parent: subpartOwner,
            })}
          />
        </PanelContents>
      </div>
    );
  return (
    <div className="panel">
      <PanelHeader
        icon={<Settings2 size={iconProps.size} />}
        title={title ?? contract.type}
        panelId="properties"
        actions={
          <CatalogPropertyClipboardActions
            contract={contract}
            targets={targets}
          />
        }
      />
      <PanelContents>
        <FieldValueSourceContext.Provider value={CATALOG_FIELD_VALUE_SOURCE}>
          <ItemsSourceContext.Provider value={CATALOG_ITEMS_SOURCE}>
            {first.target.kind === "node" && (
              <CatalogComponentSection
                key={`component:${first.target.id}`}
                nodeId={first.target.id}
              />
            )}
            <CatalogAttributesSection
              key={`attributes:${targetKey(first.target)}`}
              target={first.target}
              identity={first.identity}
            />
            {settingsPage && (
              <CatalogPageSection
                key={`page:${settingsPage}`}
                pageId={settingsPage}
              />
            )}
            {first.target.kind === "node" && (
              <CatalogLayoutBodySection
                key={`layout-body:${first.target.id}`}
                nodeId={first.target.id}
              />
            )}
            {first.target.kind === "node" && (
              <CatalogStateSection
                key={`state:${first.target.id}`}
                nodeId={first.target.id}
              />
            )}
            <CatalogSlotSection
              key={`slot:${targetKey(first.target)}`}
              target={first.target}
            />
            <CatalogItemInsertSection
              key={`items:${first.identity}`}
              identity={first.identity}
            />
            <CatalogItemRolesSection
              key={`roles:${first.identity}`}
              identity={first.identity}
            />
            <CatalogItemOriginNotice
              key={`origin:${targetKey(first.target)}`}
              target={first.target}
            />
            <CatalogCardFieldsSection
              key={`cards:${first.identity}`}
              identity={first.identity}
            />
            <CatalogFields
              key={targetKey(first.target)}
              elementId={first.identity}
              targets={targets}
            />
          </ItemsSourceContext.Provider>
        </FieldValueSourceContext.Provider>
      </PanelContents>
    </div>
  );
}

const CatalogFields = memo(function CatalogFields({
  elementId,
  targets,
}: {
  elementId: string;
  targets: readonly EditTarget[];
}) {
  const workspace = useCatalogWorkspace();
  const run = useCatalogCommandRunner();
  const contract = useCatalogEditContract(targets[0]);
  // A Button / ToggleButton's Icon · Text children (the old ButtonChildFields axis).
  const buttonNode = targets[0]?.kind === "node" ? targets[0].id : undefined;
  const subscribeSteps = useCallback(
    (notify: () => void) => workspace.runtime.subscribeSteps(() => notify()),
    [workspace],
  );
  const buttonKey = useSyncExternalStore(subscribeSteps, () => {
    const state = buttonNode
      ? catalogButtonChildren(workspace.runtime.graph, buttonNode)
      : undefined;
    return state ? JSON.stringify(state) : "";
  });
  const buttonChildren = useMemo(
    () =>
      buttonKey ? (JSON.parse(buttonKey) as CatalogButtonChildren) : undefined,
    [buttonKey],
  );
  const semanticFields = useMemo(() => {
    const fields = contract.fields.filter(
      (field) => field.origin === "semantic",
    );
    // An icon Button's label lives in its Text child (edited by the Text field instead).
    return buttonChildren?.iconId
      ? fields.filter((field) => field.key !== "children")
      : fields;
  }, [buttonChildren, contract]);
  const bindingKeys = useMemo(
    () =>
      new Set(
        contract.fields
          .filter((field) => field.kind === "binding")
          .map((field) => field.key),
      ),
    [contract],
  );
  const handlePatch = useCallback(
    (patch: Record<string, unknown>) => {
      const first = targets[0];
      if (!first) return;
      const command = catalogPropertiesPatchCommand(
        workspace.runtime.graph,
        targets,
        patch,
        (changed) => workspace.readModel.propSource(first, changed).value,
        bindingKeys,
      );
      if (command) run(command);
    },
    [bindingKeys, run, targets, workspace],
  );
  const handleSemanticUpdate = useCallback(
    (key: string, value: unknown) => handlePatch({ [key]: value }),
    [handlePatch],
  );
  // Style fields are the Styles panel's (4e-4d); the Properties view shows semantic ones only.
  const handleStyleUpdate = useCallback(() => {}, []);
  const isRefInstance = useMemo(() => {
    const first = targets[0];
    if (!first) return false;
    try {
      return catalogTargetDefinitionId(
        workspace.runtime.graph,
        first,
      ).startsWith("lib:definition:origin-");
    } catch {
      return false;
    }
  }, [targets, workspace]);
  const extras = useChartPropertyExtras({
    elementId,
    elementType: contract.type,
    contractFields: contract.fields,
    semanticFields,
    contentExtras:
      buttonNode && buttonChildren ? (
        <CatalogButtonChildFields nodeId={buttonNode} state={buttonChildren} />
      ) : undefined,
    onPatch: handlePatch,
    isRefInstance,
  });
  if (!extras.fields.length) return null;
  return (
    <GenericFieldRenderer
      fields={extras.fields}
      literalOptionFields={extras.literalOptionFields}
      onSemanticUpdate={handleSemanticUpdate}
      onStyleUpdate={handleStyleUpdate}
      elementId={elementId}
      contentExtras={extras.contentExtras}
      sectionExtras={extras.sectionExtras}
    />
  );
});
