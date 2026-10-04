import { catalogCreationEditFields } from "../../../builder/catalogRuntime/creationContract";
/** ADR-202 — the AI read host 와 기존 tool/command를 연결하는 Builder 전용 경계. */
import { type ResolvedField } from "@composition/shared";
import { getAiReadHost } from "../aiReadHost";
import { withPanelStyleFields } from "./styleManifest";
import { getAiComponentCatalog } from "../catalog/componentCatalog";
import { resolveCompositeMode } from "../tools/compositeMode";
import { getReusableOriginId as getCatalogReusableOriginId } from "@composition/shared";
import { listAgentCommands } from "../../agent/executeAgentCommand";
import type {
  CommandContext,
  CommandManifest,
  ManifestField,
} from "./manifest";

const manifestField = (f: ResolvedField): ManifestField => ({
  name: f.key,
  origin: f.origin,
  kind: f.kind,
  ...(f.options?.length ? { values: f.options.map((o) => o.value) } : {}),
  ...(f.min !== undefined ? { min: f.min } : {}),
  ...(f.max !== undefined ? { max: f.max } : {}),
});

export function readCompilerState(): {
  manifest: CommandManifest;
  context: CommandContext;
  identity: string;
} {
  const components = getAiComponentCatalog().map((entry) => ({
    ...entry,
    creationMode: resolveCompositeMode(entry.type),
    reusableId: getCatalogReusableOriginId(entry.type) ?? undefined,
    props: withPanelStyleFields(
      catalogCreationEditFields(entry.type).map(manifestField),
    ),
  }));
  const manifest: CommandManifest = {
    components,
    commands: listAgentCommands().map((c) => ({
      ...c,
      args: c.args ? { ...c.args } : undefined,
    })),
  };
  // ADR-248 4e-5: the open Builder's elements (their edit contracts), creation parent and selection
  // — 4e-7: only the read host (none = an empty context).
  const host = getAiReadHost();
  if (!host)
    return {
      manifest,
      context: { parentId: null, selectedId: null, nodes: [] },
      identity: JSON.stringify([null, null, []]),
    };
  const pageId = host.currentPageId();
  const selected = host.selectedIds();
  return {
    manifest,
    context: {
      parentId: host.creationParentId(),
      selectedId: selected[0] ?? null,
      nodes: host
        .elements()
        .filter((n) => n.page_id === pageId)
        .map((n) => {
          // A component instance (`ref` = its origin) suggests as its component's type.
          const ref = (n as { ref?: string }).ref;
          const componentType = ref
            ? components.find((component) => component.reusableId === ref)?.type
            : undefined;
          return {
            id: n.id,
            type: n.type,
            ...(componentType ? { componentType } : {}),
            props: withPanelStyleFields(host.fields(n.id).map(manifestField)),
          };
        }),
    },
    identity: JSON.stringify([host.projectId(), pageId, selected]),
  };
}
