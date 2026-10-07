import { memo, useCallback, useMemo, useSyncExternalStore } from "react";
import { Settings2 } from "lucide-react";
import { useI18n } from "../../../../i18n";
import { iconProps } from "../../../../utils/ui/uiConstants";
import {
  catalogPropertiesPatchCommand,
  catalogTargetDefinitionId,
} from "../../../catalogRuntime/editContract";
import { ORIGIN_VIEW_NODE } from "../../../catalogRuntime/originView";
import {
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
import { EmptyState } from "../../../components/feedback/EmptyState";
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
import { CatalogRacSlotSection } from "./CatalogRacSlotSection";
import { CatalogShowWhenSection } from "./CatalogShowWhenSection";
import { catalogShowWhenApplies } from "./showWhenAncestors";
import { catalogRacSlotConsumer } from "../../../../../../../packages/shared/src/catalog/runtime/racSlot";
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
 *
 * ADR-252: the Design panel's Property tab — the panel (header · tabs) is `DesignPanel`; this file
 * gives the selection read (`useCatalogPropertiesSelection`), the tab body and the header actions.
 */
export function useCatalogPropertiesSelection() {
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
  // A delegated sub-part (a field's Label · Input · FieldError …): its parent composes it, so its
  // own fields reach nothing — the owner notice instead (ADR-923, the old panel's).
  // (One root read for the panel's parts — the RAC slot section takes it, ADR-246 count.)
  const root = first && contract.type ? workspace.root : undefined;
  const subpartOwner = root
    ? catalogSubpartOwnerType(graph, root.domInputs, first.identity, "all")
    : undefined;
  return {
    first,
    contract,
    targets,
    title,
    subpartOwner,
    graph,
    workspace,
    root,
  };
}

export type CatalogPropertiesSelection = ReturnType<
  typeof useCatalogPropertiesSelection
>;

/** The Property tab's header actions — copy / paste (⌘⌥C / ⌘⌥V registered while mounted). */
export function CatalogPropertiesHeaderActions({
  selection: { first, contract, targets, subpartOwner },
}: {
  selection: CatalogPropertiesSelection;
}) {
  if (!first || !contract.type || subpartOwner) return null;
  return (
    <CatalogPropertyClipboardActions contract={contract} targets={targets} />
  );
}

/** The Property tab's body (inside the tab's `.panel-contents`). */
export function CatalogPropertiesBody({
  selection: { first, contract, targets, subpartOwner, graph, workspace, root },
}: {
  selection: CatalogPropertiesSelection;
}) {
  const { t } = useI18n();
  if (!first || !contract.type)
    return (
      <EmptyState
        icon={<Settings2 size={32} />}
        message={t("propertiesPanel.selectElement")}
      />
    );
  if (subpartOwner)
    return (
      <EmptyState
        icon={<Settings2 size={32} />}
        message={t("propertiesPanel.delegatedSubpartMessage")}
        description={t("propertiesPanel.delegatedSubpartDescription", {
          type: contract.type,
          parent: subpartOwner,
        })}
      />
    );
  const settingsPage =
    first.target.kind === "node"
      ? catalogSettingsPage(graph, first.target.id)
      : undefined;
  // A node of the Components page (a built-in origin's sample, a state variant, a frame).
  const originSample =
    first.target.kind === "node" &&
    first.target.id.startsWith(ORIGIN_VIEW_NODE);
  return (
    <FieldValueSourceContext.Provider value={CATALOG_FIELD_VALUE_SOURCE}>
      <ItemsSourceContext.Provider value={CATALOG_ITEMS_SOURCE}>
        {first.target.kind === "node" && (
          <CatalogComponentSection
            key={`component:${first.target.id}`}
            nodeId={first.target.id}
          />
        )}
        {/* The Components page: only a sample's root props and styles are its origin's project
            defaults (user decision: root only) — no node attributes, state or slot. */}
        {!originSample && (
          <CatalogAttributesSection
            key={`attributes:${targetKey(first.target)}`}
            target={first.target}
            identity={first.identity}
          />
        )}
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
        {first.target.kind === "node" && !originSample && (
          <CatalogStateSection
            key={`state:${first.target.id}`}
            nodeId={first.target.id}
          />
        )}
        {!originSample && (
          <CatalogSlotSection
            key={`slot:${targetKey(first.target)}`}
            target={first.target}
          />
        )}
        <CatalogItemInsertSection
          key={`items:${first.identity}`}
          identity={first.identity}
        />
        <CatalogItemRolesSection
          key={`roles:${first.identity}`}
          identity={first.identity}
        />
        {/* Only a part that reads a RAC slot context mounts it (no hook cost per selection). */}
        {catalogRacSlotConsumer(contract.type) && (
          <CatalogRacSlotSection
            key={`rac-slot:${first.identity}`}
            identity={first.identity}
            workspace={workspace}
            root={root!}
          />
        )}
        {/* ADR-256 Decision 7: only a node under a part that gives state keys (or with a
            condition) mounts it (no hook cost per selection). */}
        {first.target.kind === "node" &&
          !originSample &&
          root &&
          catalogShowWhenApplies(root, first.identity) && (
            <CatalogShowWhenSection
              key={`show-when:${first.identity}`}
              identity={first.identity}
              workspace={workspace}
              root={root}
            />
          )}
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
