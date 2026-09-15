/** ADR-202 — canonical read model과 기존 tool/command를 연결하는 Builder 전용 경계. */
import { resolveEditContract, type CanonicalNode } from "@composition/shared";
import { withPanelStyleFields } from "./styleManifest";
import { getAiComponentCatalog } from "../catalog/componentCatalog";
import { getAiToolReadModel } from "../tools/canonicalToolReadModel";
import { resolveCompositeMode } from "../tools/compositeCreation";
import { getReusableCompositeOriginId } from "../../../builder/components/reusableCompositeOrigins";
import { useCanonicalDocumentStore } from "../../../builder/stores/canonical/canonicalDocumentStore";
import { resolveCreationParentId } from "../../../builder/hooks/useElementCreator";
import { getNodeMap } from "../../../builder/stores/canonical/canonicalTraversalHelpers";
import { listAgentCommands } from "../../agent/executeAgentCommand";
import type {
  CommandContext,
  CommandManifest,
  ManifestField,
} from "./manifest";

export function readCompilerState(): {
  manifest: CommandManifest;
  context: CommandContext;
  identity: string;
} {
  const canonical = useCanonicalDocumentStore.getState();
  const doc = canonical.currentProjectId
    ? canonical.documents.get(canonical.currentProjectId)
    : null;
  const model = getAiToolReadModel();
  const fields = (node: CanonicalNode): ManifestField[] =>
    withPanelStyleFields(
      resolveEditContract(node, doc).fields.map((f) => ({
        name: f.key,
        origin: f.origin,
        kind: f.kind,
        ...(f.options?.length ? { values: f.options.map((o) => o.value) } : {}),
        ...(f.min !== undefined ? { min: f.min } : {}),
        ...(f.max !== undefined ? { max: f.max } : {}),
      })),
    );
  const components = getAiComponentCatalog().map((entry) => {
    const mode = resolveCompositeMode(entry.type);
    const node =
      mode === "reusable"
        ? {
            id: "__compiler_contract__",
            type: "ref",
            ref: getReusableCompositeOriginId(entry.type),
            props: {},
          }
        : { id: "__compiler_contract__", type: entry.type, props: {} };
    return {
      ...entry,
      creationMode: mode,
      reusableId: getReusableCompositeOriginId(entry.type) ?? undefined,
      props: fields(node as CanonicalNode),
    };
  });
  const currentPageId = model.state.currentPageId;
  const nodes = model.elements
    .filter((n) => n.page_id === currentPageId)
    .map((n) => ({
      id: n.id,
      type: n.type,
      componentType: components.find(
        (component) =>
          component.reusableId &&
          component.reusableId ===
            (getNodeMap().get(n.id) as { ref?: string } | undefined)?.ref,
      )?.type,
      props: fields(
        getNodeMap().get(n.id) ??
          ({
            id: n.id,
            type: n.type,
            componentType: components.find(
              (component) =>
                component.reusableId &&
                component.reusableId ===
                  (getNodeMap().get(n.id) as { ref?: string } | undefined)?.ref,
            )?.type,
            props: n.props,
          } as CanonicalNode),
      ),
    }));
  const parentId = doc
    ? resolveCreationParentId({
        selectedElementId: model.state.selectedElementId,
        elements: model.elements,
        currentPageId,
        layoutId: null,
        doc,
      })
    : null;
  return {
    manifest: {
      components,
      commands: listAgentCommands().map((c) => ({
        ...c,
        args: c.args ? { ...c.args } : undefined,
      })),
    },
    context: { parentId, selectedId: model.state.selectedElementId, nodes },
    identity: JSON.stringify([
      canonical.currentProjectId,
      currentPageId,
      model.state.selectedElementId,
      model.state.selectedElementIds,
    ]),
  };
}
