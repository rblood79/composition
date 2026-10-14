import { memo, useCallback, useSyncExternalStore } from "react";
import { Button as RACButton } from "react-aria-components/Button";
import { Unlink } from "lucide-react";
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
import { useCatalogWorkspace } from "../../../catalogRuntime/react";
import { Section as PropertySection } from "../../../components/panel/Section";
import { PropertyInput } from "../../../components/property/PropertyInput";
import { PropertyRowMenu } from "../../../components/property/PropertyRowMenu";
import { PropertySelect } from "../../../components/property/PropertySelect";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { useCatalogCommandRunner } from "../../navigator/catalog/useCatalogCommandRunner";
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
    const subscribe = useCallback(
      (notify: () => void) => workspace.runtime.subscribeSteps(() => notify()),
      [workspace],
    );
    const viewKey = useSyncExternalStore(subscribe, () => {
      const textProp = catalogTextKey(workspace.root.domInputs.get(identity));
      const view = catalogPropertyView(graph, nodeId, textProp);
      return view ? JSON.stringify(view) : "";
    });
    if (!viewKey) return null;
    const view = JSON.parse(viewKey) as CatalogPropertyView;
    const { origin, rows, textProp, canBoolean } = view;
    const kindLabel = (kind: ComponentPropertyKind) =>
      kind === "text"
        ? t("propertiesPanel.componentPropertyKindText")
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
          kind === "text"
            ? layerName()
            : `${t("propertiesPanel.componentPropertyShow")} ${layerName()}`,
          kind === "text" ? { id: nodeId, prop: textProp } : { id: nodeId },
        ),
      );
    const applyOptions = (["text", "boolean"] as const).flatMap((kind) =>
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
        {(textProp || canBoolean) && (
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
