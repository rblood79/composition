import { memo, useCallback, useState } from "react";
import { Button as RACButton } from "react-aria-components/Button";
import { ChevronDown, Minus } from "lucide-react";
import { useI18n } from "@/i18n";
import type {
  DefinitionId,
  EditTarget,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import { catalogItemInsertChoices } from "../../../catalogRuntime/itemInsert";
import { catalogCreationProps } from "../../../catalogRuntime/paletteInsert";
import {
  useCatalogStepReading,
  useCatalogWorkspace,
} from "../../../catalogRuntime/react";
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
import { useControlPopoverMetrics } from "../../../components/property/useControlPopoverMetrics";
import { Section as PropertySection } from "../../../components/panel/Section";
import { PropertySelect } from "../../../components/property/PropertySelect";
import { PropertySwitch } from "../../../components/property/PropertySwitch";
import { ActionTooltipTrigger, SwatchIconButton } from "../../../components/ui";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { useCatalogCommandRunner } from "../../../catalogRuntime/commandRunner";
import type { CatalogSwapCandidate } from "../../../catalogRuntime/swapInstance";
import { iconProps } from "../../../../utils/ui/uiConstants";
import { CatalogItemInsertSection } from "./CatalogItemInsertSection";
import { CatalogComponentPicker } from "./CatalogSwapPicker";
import "./CatalogSlotSection.css";

const DEFAULT_SLOT_NAME = "content";
/** A picker key for an item type the position's 「+」 builds (no Library option of that type). */
const ITEM_KEY = "item:";

/**
 * The insert list as a panel field (the Font · Icon pickers' field): the legend names it, the box is
 * an empty value with the Select chevron, and the searchable list opens under the box at its width.
 */
function SlotInsertField({
  label,
  legend = label,
  candidates,
  onPick,
  open,
  onOpenChange,
}: {
  /** The trigger's and the list's accessible name. */
  label: string;
  /** The field's legend (the slot's name), else the label. */
  legend?: string;
  candidates: () => CatalogSwapCandidate[];
  onPick: (definitionId: DefinitionId) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const { anchorRef, controlRef, popoverStyle } = useControlPopoverMetrics({
    widthMode: "min-width",
  });
  return (
    <fieldset className="properties-aria slot-insert-field">
      <legend className="fieldset-legend">{legend}</legend>
      <div className="react-aria-control react-aria-Group" ref={anchorRef}>
        <CatalogComponentPicker
          label={label}
          triggerClassName="react-aria-Button slot-fill-trigger"
          triggerRef={controlRef}
          popoverStyle={popoverStyle}
          candidates={candidates}
          onPick={onPick}
          open={open}
          onOpenChange={onOpenChange}
        >
          <span className="slot-fill-value">{t("common.select")}…</span>
          <span aria-hidden="true" className="select-chevron">
            <ChevronDown size={iconProps.size} />
          </span>
        </CatalogComponentPicker>
      </div>
    </fieldset>
  );
}

/**
 * ADR-248 Phase 4e-4: the slot section over the catalog document (the old FrameSlot and
 * ComponentSlotFill sections) — a node inside a project component's (or layout's) template
 * declares a slot (name, required); an instance's slot position takes a project component or a
 * free-content primitive (an item type built as the item 「+」 builds it) and restores the
 * template's content. Each edit is one step. What fills the slot — the list, its order, removing
 * one — is the Layers tree's (2026-10-22 user 「Layers 트리와 중복」). A position that is no slot
 * shows the item 「+」 section alone (one Slot section either way).
 */
export const CatalogSlotSection = memo(function CatalogSlotSection({
  target,
  type,
  identity,
}: {
  target: EditTarget;
  /** The selected part's type (the panel's contract) — no graph read per selection. */
  type?: string;
  /** The selected record (the item 「+」 reads its position). */
  identity?: string;
}) {
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const run = useCatalogCommandRunner();
  const graph = workspace.runtime.graph;
  const { declaration, position, filled, options, suggestions, choices } =
    useCatalogStepReading(
      workspace,
      (): {
        suggestions?: { id: string; label: string }[];
        choices: ReturnType<typeof catalogSlotSuggestionChoices>;
        declaration?: ReturnType<typeof catalogSlotDeclaration>;
        position?: ReturnType<typeof catalogSlotPosition>;
        filled: boolean;
        options: ReturnType<typeof catalogSlotInsertOptions>;
      } => {
        const declaration =
          target.kind === "node"
            ? catalogSlotDeclaration(graph, target.id)
            : undefined;
        const position = catalogSlotPosition(graph, target);
        // (The instance holds the slot's content — the restore applies.)
        const filled = position?.fillIds !== undefined;
        // ADR-256 Decision 4: the insert list is the position's children kind, checked like the insert —
        // a slot declaration only names the position, so a part with no slot whose parts the palette
        // doesn't offer (a Calendar's header) has the list too.
        const options =
          position ||
          (type !== undefined && CATALOG_PART_INSERT_HOSTS.has(type))
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
        return {
          declaration,
          position,
          filled,
          options,
          suggestions,
          choices,
        };
      },
    );

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
  // The insert list is the Swap picker's list (ADR-261): searchable, the suggested ones first, then
  // the project's components (Local) apart from the Library's — each group under its header. Its
  // own list scrolls (`.component-swap-list`), whatever the panel Select's popover rules say
  // (2026-10-21: the 75-item flat Select overran the viewport without scrolling).
  const [pickerOpen, setPickerOpen] = useState(false);
  // The item 「+」 of the selected record's position (a ListBox's ListBoxItem · ListBoxSection, a
  // Menu's MenuItem · SubmenuTrigger …): an item type is built as it builds it (「Item 4」, a menu
  // key, a submenu's parts). Read when the list opens or a choice is picked.
  const itemChoices = useCallback(() => {
    const position = identity
      ? workspace.positionOfRecord(identity)
      : undefined;
    return position
      ? catalogItemInsertChoices(
          {
            graph,
            readModel: workspace.readModel,
            newId: workspace.newId,
          },
          position,
        )
      : [];
  }, [graph, identity, workspace]);
  const candidates = useCallback((): CatalogSwapCandidate[] => {
    const listed = options.map((option) => ({
      definitionId: option.definitionId,
      label: option.label,
      group: option.suggested
        ? ("preferred" as const)
        : option.local
          ? ("local" as const)
          : ("library" as const),
    }));
    // An item type the Library list doesn't offer (a ListBoxSection, a SubmenuTrigger).
    const extra = itemChoices()
      .filter(
        (choice) =>
          !options.some(
            (option) =>
              option.type === choice.type &&
              option.definitionId.startsWith("lib:"),
          ),
      )
      .map((choice) => ({
        definitionId: `${ITEM_KEY}${choice.type}` as DefinitionId,
        label: choice.type,
        group: "library" as const,
      }));
    return [...listed, ...extra];
  }, [itemChoices, options]);
  /** A pick of an item type runs the item 「+」; anything else the slot's own insert. */
  const pickWith = useCallback(
    (insert: (value: string) => void) => (value: string) => {
      const type = value.startsWith(ITEM_KEY)
        ? value.slice(ITEM_KEY.length)
        : options.find(
            (option) =>
              option.definitionId === value && value.startsWith("lib:"),
          )?.type;
      const choice = type
        ? itemChoices().find((item) => item.type === type)
        : undefined;
      if (choice) run(choice.build());
      else if (!value.startsWith(ITEM_KEY)) insert(value);
    },
    [itemChoices, options, run],
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
    if (slotTarget)
      run(catalogSlotCommands.restore(slotTarget, workspace.newId));
  }, [graph, run, target, workspace]);
  // (A template node's slot declaration keeps the item 「+」 beside it.)
  const itemSection = identity ? (
    <CatalogItemInsertSection identity={identity} />
  ) : null;

  if (declaration) {
    const slot = declaration.slot;
    return (
      <>
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
                            (slot.suggested ?? []).filter(
                              (id) => id !== item.id,
                            ),
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
        {itemSection}
      </>
    );
  }
  // A position with no slot declared: the insert list only (nothing to restore — its content is
  // the template's with the parts put in). A position with nothing to insert from the slot list
  // (a list frame, a group, a Table's header or body) keeps the item 「+」 section.
  if (!position) {
    if (!options.length) return itemSection;
    return (
      <PropertySection title={t("propertiesPanel.slotSection")}>
        <div className="fieldset-row" data-wide="true">
          <SlotInsertField
            label={t("propertiesPanel.slotAddContent")}
            candidates={candidates}
            onPick={pickWith(add)}
            open={pickerOpen}
            onOpenChange={setPickerOpen}
          />
        </div>
      </PropertySection>
    );
  }

  return (
    <PropertySection title={t("propertiesPanel.slotSection")}>
      {/* The restore is the field row's icon action (an instance swap property's reset) — there
          only once the slot's content is the instance's own. */}
      <div className="fieldset-row slot-fill-row">
        <SlotInsertField
          label={t("propertiesPanel.slotFill")}
          legend={position.slot.name}
          candidates={candidates}
          onPick={pickWith(fill)}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
        />
        {filled && (
          <div className="fieldset-actions actions-slot-restore">
            <ActionTooltipTrigger tooltip={t("propertiesPanel.slotRestore")}>
              <SwatchIconButton
                aria-label={t("propertiesPanel.slotRestore")}
                onPress={restore}
              >
                <ACTION_ICONS.reset aria-hidden="true" size={iconProps.size} />
              </SwatchIconButton>
            </ActionTooltipTrigger>
          </div>
        )}
      </div>
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
    </PropertySection>
  );
});
