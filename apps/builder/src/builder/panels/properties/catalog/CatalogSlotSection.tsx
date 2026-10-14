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
  CATALOG_PART_INSERT_HOSTS,
  catalogSlotCommands,
  catalogSlotDeclaration,
  catalogSlotInsertOptions,
  catalogSlotPosition,
  catalogSlotSuggestionChoices,
  catalogSlotTarget,
} from "../../../catalogRuntime/slots";
import { PropertyInput } from "../../../components/property/PropertyInput";
import { Section as PropertySection } from "../../../components/panel/Section";
import { PropertySelect } from "../../../components/property/PropertySelect";
import { PropertySwitch } from "../../../components/property/PropertySwitch";
import { useCatalogCommandRunner } from "../../navigator/catalog/useCatalogCommandRunner";
import "./CatalogSlotSection.css";

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
  type,
}: {
  target: EditTarget;
  /** The selected part's type (the panel's contract) — no graph read per selection. */
  type?: string;
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
    // ADR-256 Decision 4: the insert list is the position's children kind, checked like the insert —
    // a slot declaration only names the position, so a part with no slot whose parts the palette
    // doesn't offer (a Calendar's header) has the list too.
    const options =
      position || (type !== undefined && CATALOG_PART_INSERT_HOSTS.has(type))
        ? catalogSlotInsertOptions(graph, target)
        : [];
    // ADR-261 Decision 3: a declared slot's suggestions (and what it can suggest).
    const nameOf = (id: string) => {
      const definition = graph.getDefinition(id as DefinitionId);
      return definition?.name ?? id;
    };
    const suggestions = declaration?.slot?.suggested?.map((id) => ({
      id,
      label: nameOf(id),
    }));
    const choices =
      declaration?.slot && target.kind === "node"
        ? catalogSlotSuggestionChoices(graph, target.id).filter(
            (choice) =>
              !declaration.slot?.suggested?.includes(choice.definitionId),
          )
        : [];
    return JSON.stringify({
      declaration,
      position,
      filled,
      options,
      suggestions,
      choices,
    });
  });
  const { declaration, position, filled, options, suggestions, choices } =
    JSON.parse(viewKey) as {
      suggestions?: { id: string; label: string }[];
      choices: ReturnType<typeof catalogSlotSuggestionChoices>;
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
  // A position with no slot declared: the new node goes at its end.
  const add = useCallback(
    (value: string) => {
      if (!value || (target.kind !== "descendant" && target.kind !== "node"))
        return;
      const option = catalogSlotInsertOptions(graph, target).find(
        (item) => item.definitionId === value,
      );
      if (!option) return;
      const definitionId = option.definitionId as DefinitionId;
      run(
        catalogSlotCommands.insert(
          target,
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
  const setSuggested = useCallback(
    (next: readonly string[]) => {
      const slot = currentSlot();
      if (target.kind !== "node" || !slot) return;
      const { suggested: _old, ...rest } = slot;
      run(
        catalogSlotCommands.declare(
          target.id,
          next.length ? { ...rest, suggested: next as DefinitionId[] } : rest,
        ),
      );
    },
    [currentSlot, run, target],
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
            {/* ADR-261 Decision 3 — pen.dev 「suggested slot components」: offered first in an
                instance's slot, never a restriction. */}
            <fieldset className="properties-aria slot-suggestions">
              <legend className="fieldset-legend">
                {t("propertiesPanel.slotSuggested")}
              </legend>
              {suggestions?.map((item) => (
                <div key={item.id} className="list-row">
                  <div className="list-row__body">
                    <span className="list-row__label">{item.label}</span>
                  </div>
                  <div className="list-row__actions">
                    <button
                      type="button"
                      className="list-row__action"
                      aria-label={`Remove ${item.label}`}
                      onClick={() =>
                        setSuggested(
                          (slot.suggested ?? []).filter((id) => id !== item.id),
                        )
                      }
                    >
                      <Minus size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </fieldset>
            <div className="fieldset-row" data-wide="true">
              <PropertySelect
                label={t("propertiesPanel.slotSuggestAdd")}
                value=""
                options={[
                  {
                    value: "",
                    label: `${t("propertiesPanel.slotSuggestAdd")}…`,
                  },
                  ...choices.map((choice) => ({
                    value: choice.definitionId,
                    label: choice.label,
                  })),
                ]}
                translateOptions={false}
                onChange={(value) =>
                  value && setSuggested([...(slot.suggested ?? []), value])
                }
              />
            </div>
          </>
        )}
      </PropertySection>
    );
  }
  const fillOptions = [
    { value: "", label: "Add content…" },
    ...options.map((option) => ({
      value: option.definitionId,
      label: option.label,
    })),
  ];

  // A position with no slot declared: the insert list only (nothing to restore — its content is
  // the template's with the parts put in).
  if (!position) {
    if (!options.length) return null;
    return (
      <PropertySection title={t("propertiesPanel.slotSection")}>
        <div className="fieldset-row" data-wide="true">
          <PropertySelect
            label="Add content"
            value=""
            options={fillOptions}
            translateOptions={false}
            onChange={add}
          />
        </div>
      </PropertySection>
    );
  }

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
      {/* ADR-261 Decision 3: the origin's suggestions, one press to fill (pen.dev). */}
      {options.some((option) => option.suggested) && (
        <div className="slot-suggestion-strip">
          {options
            .filter((option) => option.suggested)
            .map((option) => (
              <RACButton
                key={option.definitionId}
                className="control-button"
                onPress={() => fill(option.definitionId)}
              >
                {option.label}
              </RACButton>
            ))}
        </div>
      )}
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
