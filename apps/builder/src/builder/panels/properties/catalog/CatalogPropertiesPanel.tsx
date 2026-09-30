import { memo, useCallback, useMemo } from "react";
import { Settings2 } from "lucide-react";
import { useI18n } from "../../../../i18n";
import { iconProps } from "../../../../utils/ui/uiConstants";
import {
  catalogSemanticPatchCommand,
  catalogTargetDefinitionId,
} from "../../../catalogRuntime/editContract";
import {
  CatalogWorkspaceGate,
  useCatalogEditContract,
  useCatalogSession,
  useCatalogWorkspace,
} from "../../../catalogRuntime/react";
import { targetKey } from "../../../catalogRuntime/session";
import { EmptyState, PanelContents, PanelHeader } from "../../../components";
import type { EditTarget } from "../../../../../../../packages/shared/src/catalog/document/types";
import { useCatalogCommandRunner } from "../../navigator/catalog/useCatalogCommandRunner";
import { FieldValueSourceContext } from "../generic/fieldValueSource";
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
  return (
    <div className="panel">
      <PanelHeader
        icon={<Settings2 size={iconProps.size} />}
        title={title ?? contract.type}
        panelId="properties"
      />
      <PanelContents>
        <FieldValueSourceContext.Provider value={CATALOG_FIELD_VALUE_SOURCE}>
          <CatalogFields
            key={targetKey(first.target)}
            elementId={first.identity}
            targets={targets}
          />
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
  const semanticFields = useMemo(
    () => contract.fields.filter((field) => field.origin === "semantic"),
    [contract],
  );
  const handleSemanticUpdate = useCallback(
    (key: string, value: unknown) => {
      const first = targets[0];
      if (!first) return;
      const command = catalogSemanticPatchCommand(
        targets,
        { [key]: value },
        (changed) => workspace.readModel.propSource(first, changed).value,
      );
      if (command) run(command);
    },
    [run, targets, workspace],
  );
  // Style fields are the Styles panel's (4e-4d); the Properties view shows semantic ones only.
  const handleStyleUpdate = useCallback(() => {}, []);
  if (!semanticFields.length) return null;
  return (
    <GenericFieldRenderer
      fields={semanticFields}
      onSemanticUpdate={handleSemanticUpdate}
      onStyleUpdate={handleStyleUpdate}
      elementId={elementId}
    />
  );
});
