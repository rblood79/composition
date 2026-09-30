import { memo, useCallback, useSyncExternalStore } from "react";
import { Fingerprint } from "lucide-react";
import { useI18n } from "@/i18n";
import type {
  EditTarget,
  NodeId,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import { iconProps } from "../../../../utils/ui/uiConstants";
import {
  catalogHtmlIdCommand,
  catalogUniqueHtmlId,
} from "../../../catalogRuntime/attributes";
import { setNodeAttribute } from "../../../../../../../packages/shared/src/catalog/commands";
import {
  useCatalogEditContract,
  useCatalogWorkspace,
} from "../../../catalogRuntime/react";
import { PropertyInput, PropertySection } from "../../../components";
import { ActionTooltipTrigger, SwatchIconButton } from "../../../components/ui";
import { globalToast } from "../../../stores/toast";
import { useCatalogCommandRunner } from "../../navigator/catalog/useCatalogCommandRunner";
import { needsAuthoredAriaLabel } from "../ariaLabelNeed";

/**
 * ADR-248 Phase 4e-4: the common DOM axis of an element (ID · Class Name · Aria Label) over the
 * catalog document — the node's `metadata`: the ID is `htmlId` (unique: the graph's index refuses a
 * taken one, the check button assigns or dedupes `base_N`), class and aria label are `className` ·
 * `ariaLabel` (every element, whatever its definition accepts). A template position (inside an
 * instance) has no DOM attributes of its own.
 */
export const CatalogAttributesSection = memo(function CatalogAttributesSection({
  target,
  identity,
}: {
  target: EditTarget;
  identity: string;
}) {
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const run = useCatalogCommandRunner();
  const graph = workspace.runtime.graph;
  const contract = useCatalogEditContract(target);
  const nodeId = target.kind === "node" ? target.id : undefined;
  const subscribeSteps = useCallback(
    (notify: () => void) => workspace.runtime.subscribeSteps(() => notify()),
    [workspace],
  );
  const metadataOf = (field: "htmlId" | "className" | "ariaLabel") => () => {
    const entry = nodeId ? graph.getEntry(nodeId) : undefined;
    return entry?.kind === "node" ? (entry.metadata?.[field] ?? "") : "";
  };
  const htmlId = useSyncExternalStore(subscribeSteps, metadataOf("htmlId"));
  const className = useSyncExternalStore(
    subscribeSteps,
    metadataOf("className"),
  );
  const ariaLabel = useSyncExternalStore(
    subscribeSteps,
    metadataOf("ariaLabel"),
  );

  const writeAttribute = useCallback(
    (field: "className" | "ariaLabel", value: string, current: string) => {
      if (!nodeId || value.trim() === current) return;
      run(setNodeAttribute({ id: nodeId as NodeId, field, value }));
    },
    [nodeId, run],
  );
  const handleHtmlId = useCallback(
    (value: string) => {
      if (!nodeId || value.trim() === htmlId) return;
      const edit = catalogHtmlIdCommand(graph, nodeId, value);
      if ("refused" in edit) {
        globalToast.error(t("propertiesPanel.idTaken", { id: value.trim() }));
        return;
      }
      run(edit.command);
    },
    [graph, htmlId, nodeId, run, t],
  );
  const handleCheckId = useCallback(() => {
    if (!nodeId) return;
    const undo = () => workspace.undo();
    const base = htmlId || contract.type.toLowerCase();
    if (htmlId && !catalogHtmlIdCommandTaken(graph, nodeId, htmlId)) {
      globalToast.info(t("propertiesPanel.idUnique", { id: htmlId }), {
        bypassCooldown: true,
      });
      return;
    }
    const next = catalogUniqueHtmlId(graph, base, nodeId as NodeId);
    const edit = catalogHtmlIdCommand(graph, nodeId, next);
    if ("refused" in edit || !run(edit.command)) return;
    globalToast.info(
      t(htmlId ? "propertiesPanel.idDeduped" : "propertiesPanel.idAssigned", {
        id: next,
      }),
      {
        bypassCooldown: true,
        action: { label: t("errors.undo"), onClick: undo },
      },
    );
  }, [contract.type, graph, htmlId, nodeId, run, t, workspace]);

  const record = workspace.root.domInputs.get(identity);
  const showAriaLabel = needsAuthoredAriaLabel({
    type: contract.type,
    props: record?.props as Record<string, unknown> | undefined,
    hasLabelField: contract.fields.some((field) => field.key === "label"),
    children: (record?.children ?? []).map((child) => {
      const definitionId = workspace.root.domInputs.get(child)?.definitionId;
      return {
        type:
          definitionId === "lib:definition:text"
            ? "Text"
            : (definitionId ?? ""),
      };
    }),
  });
  return (
    <PropertySection title={t("propertiesPanel.attributes")}>
      {nodeId && (
        <div className="fieldset-row" data-wide="true">
          <PropertyInput
            label="ID"
            value={htmlId}
            onChange={handleHtmlId}
            placeholder={`${contract.type.toLowerCase()}_1`}
          />
          <div className="fieldset-actions">
            <ActionTooltipTrigger tooltip={t("propertiesPanel.idCheckUnique")}>
              <SwatchIconButton
                aria-label={t("propertiesPanel.idCheckUnique")}
                onPress={handleCheckId}
              >
                <Fingerprint
                  aria-hidden="true"
                  size={iconProps.size}
                  strokeWidth={iconProps.strokeWidth}
                />
              </SwatchIconButton>
            </ActionTooltipTrigger>
          </div>
        </div>
      )}
      {nodeId && (
        <div className="fieldset-row" data-wide="true">
          <PropertyInput
            label="Class Name"
            value={className}
            onChange={(value) => writeAttribute("className", value, className)}
            placeholder={t("propertiesPanel.classNamePlaceholder")}
          />
        </div>
      )}
      {nodeId && showAriaLabel && (
        <div className="fieldset-row" data-wide="true">
          <PropertyInput
            label="Aria Label"
            value={ariaLabel}
            onChange={(value) => writeAttribute("ariaLabel", value, ariaLabel)}
            placeholder={t("propertiesPanel.ariaLabelPlaceholder")}
          />
        </div>
      )}
    </PropertySection>
  );
});

function catalogHtmlIdCommandTaken(
  graph: Parameters<typeof catalogHtmlIdCommand>[0],
  node: NodeId,
  htmlId: string,
): boolean {
  return "refused" in catalogHtmlIdCommand(graph, node, htmlId);
}
