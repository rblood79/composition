import { memo, useCallback, useSyncExternalStore } from "react";
import { Button as RACButton } from "react-aria-components/Button";
import { Minus } from "lucide-react";
import { useI18n } from "@/i18n";
import { definitionTypeName } from "../../../../../../../packages/shared/src/catalog/commands/context";
import type {
  DefinitionId,
  EditTarget,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import { removeTargets } from "../../../../../../../packages/shared/src/catalog/commands";
import {
  catalogCreationProps,
  catalogPaletteDefinitionId,
} from "../../../catalogRuntime/paletteInsert";
import { useCatalogWorkspace } from "../../../catalogRuntime/react";
import {
  catalogSlotCommands,
  catalogSlotDeclaration,
  catalogSlotPosition,
} from "../../../catalogRuntime/slots";
import {
  PropertyInput,
  PropertySection,
  PropertySelect,
  PropertySwitch,
} from "../../../components";
import {
  SLOT_FILL_PRIMITIVE_TYPES,
  slotFillPrimitiveLabel,
} from "../../../components/slotFillNodes";
import { useCatalogCommandRunner } from "../../navigator/catalog/useCatalogCommandRunner";

const DEFAULT_SLOT_NAME = "content";
const PRIMITIVE_PREFIX = "type:";

/**
 * ADR-248 Phase 4e-4: the slot section over the catalog document (the old FrameSlot and
 * ComponentSlotFill sections) — a node inside a project component's (or layout's) template
 * declares a slot (name, required); an instance's slot position lists what fills it (each
 * removable), takes a project component or a free-content primitive, and restores the template's
 * content. Each edit is one step.
 */
export const CatalogSlotSection = memo(function CatalogSlotSection({
  target,
}: {
  target: EditTarget;
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
    const declaration =
      target.kind === "node"
        ? catalogSlotDeclaration(graph, target.id)
        : undefined;
    const position = catalogSlotPosition(graph, target);
    const filled = position?.fillIds?.map((id) => {
      const entry = graph.getEntry(id);
      return {
        id,
        label:
          entry?.kind === "node"
            ? entry.name || definitionTypeName(graph, entry.definitionId)
            : id,
      };
    });
    return JSON.stringify({ declaration, position, filled });
  });
  const { declaration, position, filled } = JSON.parse(viewKey) as {
    declaration?: ReturnType<typeof catalogSlotDeclaration>;
    position?: ReturnType<typeof catalogSlotPosition>;
    filled?: { id: string; label: string }[];
  };

  // Handlers read the committed declaration (field controls keep their first onChange).
  const currentSlot = useCallback(
    () =>
      target.kind === "node"
        ? catalogSlotDeclaration(graph, target.id)?.slot
        : undefined,
    [graph, target],
  );
  const toggleSlot = useCallback(
    (on: boolean) => {
      if (target.kind !== "node" || on === Boolean(currentSlot())) return;
      run(
        catalogSlotCommands.declare(
          target.id,
          on ? { name: DEFAULT_SLOT_NAME, required: false } : undefined,
        ),
      );
    },
    [currentSlot, run, target],
  );
  const renameSlot = useCallback(
    (value: string) => {
      const slot = currentSlot();
      const name = value.trim();
      if (target.kind !== "node" || !slot || !name || name === slot.name)
        return;
      run(catalogSlotCommands.declare(target.id, { ...slot, name }));
    },
    [currentSlot, run, target],
  );
  const setRequired = useCallback(
    (required: boolean) => {
      const slot = currentSlot();
      if (target.kind !== "node" || !slot || slot.required === required) return;
      run(catalogSlotCommands.declare(target.id, { ...slot, required }));
    },
    [currentSlot, run, target],
  );
  const fill = useCallback(
    (value: string) => {
      if (!value || target.kind !== "descendant") return;
      // A free-content primitive starts with the palette's creation props (a Text's text …).
      if (value.startsWith(PRIMITIVE_PREFIX)) {
        const type = value.slice(PRIMITIVE_PREFIX.length);
        const definitionId = catalogPaletteDefinitionId(graph.library, type);
        run(
          catalogSlotCommands.fill(
            target,
            definitionId,
            workspace.newId,
            catalogCreationProps(graph.library, definitionId, type),
          ),
        );
        return;
      }
      run(
        catalogSlotCommands.fill(
          target,
          value as DefinitionId,
          workspace.newId,
        ),
      );
    },
    [graph, run, target, workspace],
  );
  const restore = useCallback(() => {
    if (target.kind === "descendant") run(catalogSlotCommands.restore(target));
  }, [run, target]);
  const removeFill = useCallback(
    (id: string) =>
      run(
        removeTargets({
          targets: [{ kind: "node", id: id as `project:node:${string}` }],
          label: "Remove from slot",
        }),
      ),
    [run],
  );

  if (declaration) {
    const slot = declaration.slot;
    return (
      <PropertySection title={t("propertiesPanel.slotSection")}>
        <div className="fieldset-row" data-wide="true">
          <PropertySwitch
            label={t("propertiesPanel.slotSection")}
            isSelected={Boolean(slot)}
            onChange={toggleSlot}
          />
        </div>
        {slot && (
          <>
            <div className="fieldset-row" data-wide="true">
              <PropertyInput
                label="Slot name"
                value={slot.name}
                onChange={renameSlot}
              />
            </div>
            <div className="fieldset-row" data-wide="true">
              <PropertySwitch
                label="Required"
                isSelected={slot.required}
                onChange={setRequired}
              />
            </div>
          </>
        )}
      </PropertySection>
    );
  }
  if (!position) return null;

  const instanceDefinition =
    target.kind === "descendant"
      ? (
          graph.getEntry(target.ownerId) as
            { definitionId?: string } | undefined
        )?.definitionId
      : undefined;
  const project = graph.getEntry(graph.projectId);
  const components =
    project?.kind === "project"
      ? project.definitionIds.flatMap((id) => {
          const definition = graph.getEntry(id);
          return definition?.kind === "definition" &&
            definition.usage !== "layout" &&
            id !== instanceDefinition
            ? [{ value: id, label: definition.name }]
            : [];
        })
      : [];
  const fillOptions = [
    { value: "", label: "Add content…" },
    ...components,
    ...SLOT_FILL_PRIMITIVE_TYPES.map((type) => ({
      value: `${PRIMITIVE_PREFIX}${type}`,
      label: slotFillPrimitiveLabel(type),
    })),
  ];

  return (
    <PropertySection title={t("propertiesPanel.slotSection")}>
      <fieldset className="properties-aria frame-slot-fill">
        <legend className="fieldset-legend">{position.slot.name}</legend>
        {filled?.map((item) => (
          <div key={item.id} className="list-row">
            <div className="list-row__body">
              <span className="list-row__label">{item.label}</span>
            </div>
            <div className="list-row__actions">
              <button
                type="button"
                className="list-row__action"
                aria-label={`Remove ${item.label}`}
                onClick={() => removeFill(item.id)}
              >
                <Minus size={12} />
              </button>
            </div>
          </div>
        ))}
      </fieldset>
      <div className="fieldset-row" data-wide="true">
        <PropertySelect
          label="Fill slot"
          value=""
          options={fillOptions}
          translateOptions={false}
          onChange={fill}
        />
      </div>
      {filled && (
        <RACButton className="control-button" onPress={restore}>
          Restore template content
        </RACButton>
      )}
    </PropertySection>
  );
});
