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
import { catalogCreationProps } from "../../../catalogRuntime/paletteInsert";
import { useCatalogWorkspace } from "../../../catalogRuntime/react";
import {
  catalogSlotCommands,
  catalogSlotDeclaration,
  catalogSlotInsertOptions,
  catalogSlotPosition,
  catalogSlotTarget,
} from "../../../catalogRuntime/slots";
import { PropertyInput } from "../../../components/property/PropertyInput";
import { Section as PropertySection } from "../../../components/panel/Section";
import { PropertySelect } from "../../../components/property/PropertySelect";
import { PropertySwitch } from "../../../components/property/PropertySwitch";
import { useCatalogCommandRunner } from "../../navigator/catalog/useCatalogCommandRunner";

const DEFAULT_SLOT_NAME = "content";

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
    // ADR-256 Decision 4: the insert list is the position's children kind, checked like the insert.
    const options = position ? catalogSlotInsertOptions(graph, target) : [];
    return JSON.stringify({ declaration, position, filled, options });
  });
  const { declaration, position, filled, options } = JSON.parse(viewKey) as {
    declaration?: ReturnType<typeof catalogSlotDeclaration>;
    position?: ReturnType<typeof catalogSlotPosition>;
    filled?: { id: string; label: string }[];
    options: ReturnType<typeof catalogSlotInsertOptions>;
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
      // A root slot (ADR-256 F4) fills at the instance's root position.
      const slotTarget = catalogSlotTarget(graph, target);
      if (!value || !slotTarget) return;
      const option = catalogSlotInsertOptions(graph, slotTarget).find(
        (item) => item.definitionId === value,
      );
      if (!option) return;
      // A library choice starts with the palette's creation props (a Text's text …).
      const definitionId = option.definitionId as DefinitionId;
      run(
        catalogSlotCommands.fill(
          slotTarget,
          definitionId,
          workspace.newId,
          option.type && definitionId.startsWith("lib:")
            ? catalogCreationProps(
                graph.library,
                definitionId as Parameters<typeof catalogCreationProps>[1],
                option.type,
              )
            : {},
        ),
      );
    },
    [graph, run, target, workspace],
  );
  const restore = useCallback(() => {
    const slotTarget = catalogSlotTarget(graph, target);
    if (slotTarget) run(catalogSlotCommands.restore(slotTarget));
  }, [graph, run, target]);
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

  const fillOptions = [
    { value: "", label: "Add content…" },
    ...options.map((option) => ({
      value: option.definitionId,
      label: option.label,
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
