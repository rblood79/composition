import { memo, useCallback, useState, useSyncExternalStore } from "react";
import { Fingerprint } from "lucide-react";
import { useI18n } from "@/i18n";
import type {
  EditTarget,
  NodeId,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import { iconProps } from "../../../../utils/ui/uiConstants";
import {
  catalogHtmlIdBase,
  catalogHtmlIdCommand,
  catalogHtmlIdWellFormed,
  catalogAutomaticHtmlId,
  catalogUniqueHtmlId,
} from "../../../catalogRuntime/attributes";
import { setNodeAttribute } from "../../../../../../../packages/shared/src/catalog/commands";
import {
  useCatalogEditContract,
  useCatalogWorkspace,
} from "../../../catalogRuntime/react";
import { PropertyInput } from "../../../components/property/PropertyInput";
import { Section as PropertySection } from "../../../components/panel/Section";
import { ActionTooltipTrigger, SwatchIconButton } from "../../../components/ui";
import { globalToast } from "../../../stores/toast";
import { useCatalogCommandRunner } from "../../navigator/catalog/useCatalogCommandRunner";
import { needsAuthoredAriaLabel } from "../ariaLabelNeed";

/**
 * ADR-248 Phase 4e-4: an element's ID and Aria Label over the catalog document — the node's
 * `metadata`: the ID is `htmlId` (unique: the graph's index refuses a taken one, the check button
 * assigns or dedupes `base_N`), the aria label `ariaLabel` (every element, whatever its definition
 * accepts). A template position (inside an instance) has no DOM attributes of its own.
 *
 * 2026-10-24 (사용자 — RAC API 표의 묶음): `id` · `aria-label` 은 레퍼런스의 Accessibility 묶음이라
 * 절 이름도 Accessibility 다. `className` 은 Styling 묶음이라 Style 탭 Class 절
 * (`panels/styles/catalog/CatalogClassNameSection.tsx`) 로 옮겼다.
 */
export const CatalogAccessibilitySection = memo(function CatalogAccessibilitySection({
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
  const metadataOf = (field: "htmlId" | "ariaLabel") => () => {
    const entry = nodeId ? graph.getEntry(nodeId) : undefined;
    return entry?.kind === "node" ? (entry.metadata?.[field] ?? "") : "";
  };
  const htmlId = useSyncExternalStore(subscribeSteps, metadataOf("htmlId"));
  // The id an empty field stands for: the first free `type_N` (what the check would assign).
  const automaticHtmlId = useSyncExternalStore(subscribeSteps, () => {
    const entry = nodeId ? graph.getEntry(nodeId) : undefined;
    return entry?.kind === "node"
      ? catalogAutomaticHtmlId(
          graph,
          catalogHtmlIdBase(graph, entry),
          nodeId as NodeId,
          entry.metadata?.htmlId,
        )
      : "";
  });
  const ariaLabel = useSyncExternalStore(
    subscribeSteps,
    metadataOf("ariaLabel"),
  );

  const writeAriaLabel = useCallback(
    (value: string) => {
      if (!nodeId || value.trim() === ariaLabel) return;
      run(setNodeAttribute({ id: nodeId as NodeId, field: "ariaLabel", value }));
    },
    [ariaLabel, nodeId, run],
  );
  // A refused id shows under the field and the field shows the stored id again (the old ID
  // field); the message belongs to the element it was typed for.
  const [idError, setIdError] = useState<{ node: string; message: string }>();
  const [idField, setIdField] = useState(0);
  const handleHtmlId = useCallback(
    (value: string) => {
      if (!nodeId) return;
      const next = value.trim();
      const refuse = (message: string) => {
        setIdError({ node: nodeId, message });
        setIdField((n) => n + 1);
      };
      if (next && !catalogHtmlIdWellFormed(next))
        return refuse(t("propertiesPanel.idInvalid"));
      if (next === htmlId) return setIdError(undefined);
      const edit = catalogHtmlIdCommand(graph, nodeId, next);
      if ("refused" in edit)
        return refuse(t("propertiesPanel.idTaken", { id: next }));
      setIdError(undefined);
      run(edit.command);
    },
    [graph, htmlId, nodeId, run, t],
  );
  const idMessage = idError?.node === nodeId ? idError?.message : undefined;
  const handleCheckId = useCallback(() => {
    if (!nodeId) return;
    const undo = () => workspace.undo();
    const base = htmlId || automaticHtmlId;
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
  }, [automaticHtmlId, graph, htmlId, nodeId, run, t, workspace]);

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
    <PropertySection title={t("propertiesPanel.accessibility")}>
      {nodeId && (
        <div className="fieldset-row" data-wide="true">
          <PropertyInput
            key={idField}
            label="ID"
            value={htmlId}
            onChange={handleHtmlId}
            placeholder={automaticHtmlId}
            afterControl={
              idMessage ? (
                <span slot="description" role="alert">
                  {idMessage}
                </span>
              ) : undefined
            }
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
      {nodeId && showAriaLabel && (
        <div className="fieldset-row" data-wide="true">
          <PropertyInput
            label="Aria Label"
            value={ariaLabel}
            onChange={writeAriaLabel}
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
