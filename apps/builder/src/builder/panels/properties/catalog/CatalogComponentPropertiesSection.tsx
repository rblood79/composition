import { memo } from "react";
import { Button as RACButton } from "react-aria-components/Button";
import { Minus, Unlink } from "lucide-react";
import { useI18n } from "@/i18n";
import type {
  ComponentPropertyKind,
  NodeId,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import { definitionTypeName } from "../../../../../../../packages/shared/src/catalog/commands/context";
import { iconProps } from "../../../../utils/ui/uiConstants";
import { catalogTextKey } from "../../../catalogRuntime/canvasText";
import {
  catalogPropertyCommands,
  catalogPropertyView,
  type CatalogPropertyView,
} from "../../../catalogRuntime/componentProperties";
import {
  useCatalogStepReading,
  useCatalogWorkspace,
} from "../../../catalogRuntime/react";
import { catalogSlotSuggestionChoices } from "../../../catalogRuntime/slots";
import { catalogComponentLabel } from "../../../catalogRuntime/componentProperties";
import { Section as PropertySection } from "../../../components/panel/Section";
import { PropertyInput } from "../../../components/property/PropertyInput";
import { PropertyRowMenu } from "../../../components/property/PropertyRowMenu";
import { PropertySelect } from "../../../components/property/PropertySelect";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { useCatalogCommandRunner } from "../../../catalogRuntime/commandRunner";
import "./CatalogComponentPropertiesSection.css";

/**
 * ADR-261 Decision 4 — a user component's properties, on its origin (Figma: the main component's
 * properties and a layer's 「Apply property」): the origin root lists every property; a layer lists
 * the ones that drive it. A layer with its own text makes or takes a text property, any layer but
 * the root a visibility (boolean) property. Each row renames; its menu takes the layer off or
 * deletes the property (every instance's value goes with it). Each edit is one step.
 */
export const CatalogComponentPropertiesSection = memo(
  function CatalogComponentPropertiesSection({
    nodeId,
    identity,
  }: {
    nodeId: NodeId;
    /** The selected record (its own text prop — the inline editor's `catalogTextKey`). */
    identity: string;
  }) {
    const { t } = useI18n();
    const workspace = useCatalogWorkspace();
    const run = useCatalogCommandRunner();
    const graph = workspace.runtime.graph;
    const view = useCatalogStepReading(
      workspace,
      (): CatalogPropertyView | null => {
        const textProp = catalogTextKey(workspace.root.domInputs.get(identity));
        return catalogPropertyView(graph, nodeId, textProp) ?? null;
      },
    );
    if (!view) return null;
    const { origin, rows, textProp, canBoolean, canInstance } = view;
    const kindLabel = (kind: ComponentPropertyKind) =>
      kind === "text"
        ? t("propertiesPanel.componentPropertyKindText")
        : kind === "instance"
          ? t("propertiesPanel.componentPropertyKindInstance")
          : t("propertiesPanel.componentPropertyKindBoolean");
    // (An unnamed layer names its property after what it is — Text, Icon …)
    const layerName = () => {
      const node = graph.getEntry(nodeId);
      if (node?.kind !== "node") return kindLabel("text");
      return node.name || definitionTypeName(graph, node.definitionId);
    };
    const create = (kind: ComponentPropertyKind) =>
      run(
        catalogPropertyCommands.create(
          origin,
          kind,
          kind === "boolean"
            ? `${t("propertiesPanel.componentPropertyShow")} ${layerName()}`
            : layerName(),
          kind === "text" ? { id: nodeId, prop: textProp } : { id: nodeId },
        ),
      );
    const applyOptions = (["text", "boolean", "instance"] as const).flatMap(
      (kind) =>
        view.applicable[kind].map((item) => ({
          value: `${kind}:${item.key}`,
          label: `${item.name} (${kindLabel(kind)})`,
        })),
    );
    const apply = (value: string) => {
      const [kind, key] = value.split(":");
      if (!key) return;
      run(
        catalogPropertyCommands.apply(
          origin,
          key,
          kind === "text" ? { id: nodeId, prop: textProp } : { id: nodeId },
        ),
      );
    };

    return (
      <PropertySection title={t("propertiesPanel.componentProperties")}>
        {rows.map((row) => (
          <div key={row.key} className="fieldset-row component-property-row">
            <PropertyInput
              label={
                view.isRoot
                  ? `${kindLabel(row.kind)} · ${t("propertiesPanel.componentPropertyLayers", { count: row.count })}`
                  : kindLabel(row.kind)
              }
              className="component-property-name"
              value={row.name}
              onChange={(value) => {
                const name = value.trim();
                if (name && name !== row.name)
                  run(catalogPropertyCommands.rename(origin, row.key, name));
              }}
            />
            <div className="fieldset-actions actions-component-property">
              <PropertyRowMenu
                label={t("propertiesPanel.componentPropertyActions", {
                  name: row.name,
                })}
                items={[
                  ...(row.target
                    ? [
                        {
                          id: "detach",
                          label: t("propertiesPanel.componentPropertyDetach"),
                          icon: Unlink,
                        },
                      ]
                    : []),
                  {
                    id: "delete",
                    label: t("propertiesPanel.componentPropertyDelete"),
                    icon: ACTION_ICONS.delete,
                  },
                ]}
                onAction={(id) => {
                  if (id === "detach" && row.target)
                    run(
                      catalogPropertyCommands.detach(
                        origin,
                        row.key,
                        row.target,
                      ),
                    );
                  else if (id === "delete")
                    run(catalogPropertyCommands.remove(origin, row.key));
                }}
              />
            </div>
          </div>
        ))}
        {/* ADR-261 Phase 5 — an instance property's preferred components (Figma preferred
            values): offered first when an instance picks; a suggestion, not a limit. */}
        {rows
          .filter((row) => row.kind === "instance")
          .map((row) => (
            <CatalogPreferredComponents
              key={`preferred:${row.key}`}
              nodeId={nodeId}
              name={row.name}
              preferred={row.preferred ?? []}
              onChange={(preferred) =>
                run(
                  catalogPropertyCommands.preferred(origin, row.key, preferred),
                )
              }
            />
          ))}
        {(textProp || canBoolean || canInstance) && (
          <div className="fieldset-row">
            <div className="component-semantics-strip">
              {textProp && (
                <RACButton
                  className="control-button"
                  onPress={() => create("text")}
                >
                  <ACTION_ICONS.add aria-hidden="true" size={iconProps.size} />
                  {t("propertiesPanel.componentPropertyText")}
                </RACButton>
              )}
              {canBoolean && (
                <RACButton
                  className="control-button"
                  onPress={() => create("boolean")}
                >
                  <ACTION_ICONS.add aria-hidden="true" size={iconProps.size} />
                  {t("propertiesPanel.componentPropertyBoolean")}
                </RACButton>
              )}
              {canInstance && (
                <RACButton
                  className="control-button"
                  onPress={() => create("instance")}
                >
                  <ACTION_ICONS.add aria-hidden="true" size={iconProps.size} />
                  {t("propertiesPanel.componentPropertyInstance")}
                </RACButton>
              )}
            </div>
          </div>
        )}
        {applyOptions.length > 0 && (
          <div className="fieldset-row" data-wide="true">
            <PropertySelect
              label={t("propertiesPanel.componentPropertyApply")}
              value=""
              options={[
                {
                  value: "",
                  label: `${t("propertiesPanel.componentPropertyApply")}…`,
                },
                ...applyOptions,
              ]}
              translateOptions={false}
              onChange={apply}
            />
          </div>
        )}
      </PropertySection>
    );
  },
);

/**
 * One instance property's preferred components (the slot suggestions' list — Decision 3's
 * markup): each removable, and an add list (the project's components and the built-in origins).
 */
function CatalogPreferredComponents({
  nodeId,
  name,
  preferred,
  onChange,
}: {
  nodeId: NodeId;
  name: string;
  preferred: readonly string[];
  onChange: (preferred: string[]) => void;
}) {
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const graph = workspace.runtime.graph;
  const choices = catalogSlotSuggestionChoices(graph, nodeId).filter(
    (choice) => !preferred.includes(choice.definitionId),
  );
  return (
    <>
      <fieldset className="properties-aria slot-suggestions">
        <legend className="fieldset-legend">
          {t("propertiesPanel.componentPropertyPreferred", { name })}
        </legend>
        {preferred.map((id) => {
          const label = catalogComponentLabel(graph, id);
          return (
            <div key={id} className="list-row">
              <div className="list-row__body">
                <span className="list-row__label">{label}</span>
              </div>
              <div className="list-row__actions">
                <button
                  type="button"
                  className="list-row__action"
                  aria-label={t(
                    "propertiesPanel.componentPropertyPreferredRemove",
                    { name: label },
                  )}
                  onClick={() =>
                    onChange(preferred.filter((item) => item !== id))
                  }
                >
                  <Minus size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </fieldset>
      {choices.length > 0 && (
        <div className="fieldset-row" data-wide="true">
          <PropertySelect
            label={t("propertiesPanel.componentPropertyPreferredAdd")}
            value=""
            options={[
              {
                value: "",
                label: `${t("propertiesPanel.componentPropertyPreferredAdd")}…`,
              },
              ...choices.map((choice) => ({
                value: choice.definitionId,
                label: choice.label,
              })),
            ]}
            translateOptions={false}
            onChange={(value) => value && onChange([...preferred, value])}
          />
        </div>
      )}
    </>
  );
}
