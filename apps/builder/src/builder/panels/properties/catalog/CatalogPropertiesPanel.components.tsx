import { CatalogListFilterSection } from "./CatalogFilterSection";
import { Settings2 } from "lucide-react";

import {
  memo,
  type ReactNode,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from "react";

import type {
  EditTarget,
  NodeId,
} from "../../../../../../../packages/shared/src/catalog/document/types";

import { catalogCalendarPicker } from "../../../../../../../packages/shared/src/catalog/runtime/delegatedDom";

import {
  CATALOG_OWNER_DECIDED_TYPES,
  catalogOwnerDecidedProps,
} from "../../../../../../../packages/shared/src/catalog/runtime/ownerDecidedProps";

import { useI18n } from "../../../../i18n";

import {
  catalogPropertiesPatchCommand,
  catalogTargetDefinitionId,
} from "../../../catalogRuntime/editContract";

import { ORIGIN_VIEW_NODE } from "../../../catalogRuntime/originView";

import { catalogSettingsPage } from "../../../catalogRuntime/pageSettings";

import {
  catalogGroupKeysFields,
  catalogGroupKeysWriteCommand,
  catalogItemKeyRenameCommands,
  catalogPickerSelectionCommands,
} from "../../../catalogRuntime/singleSelection";

import { composeCommands } from "../../../../../../../packages/shared/src/catalog/commands";

import {
  useCatalogEditContract,
  useCatalogWorkspace,
} from "../../../catalogRuntime/react";

import { targetKey } from "../../../catalogRuntime/session";

import { EmptyState } from "../../../components/feedback/EmptyState";

import { useCatalogCommandRunner } from "../../../catalogRuntime/commandRunner";

import { FieldValueSourceContext } from "../generic/fieldValueSource";

import { GenericFieldRenderer } from "../generic/GenericFieldRenderer";
import {
  GlyphSizeContext,
  type GlyphSizeSource,
} from "../generic/glyphSizeAction";
import {
  CATALOG_GLYPH_TYPES,
  catalogGlyphSizeCommand,
  catalogGlyphSizeIsCustom,
  catalogGlyphStepClearCommand,
  catalogIsGlyphRecord,
} from "../../../catalogRuntime/glyphSize";
import { catalogGlyphSize } from "../../../catalogRuntime/boxModel";

import { ItemsSourceContext } from "../generic/itemsSource";

import { useChartPropertyExtras } from "../useChartPropertyExtras";

import { CatalogAccessibilitySection } from "./CatalogAccessibilitySection";

import { CatalogCalendarHeaderField } from "./CatalogCalendarHeaderField";
import { CatalogFieldPrefixField } from "./CatalogFieldPrefixField";
import { CatalogContextualHelpField } from "./CatalogContextualHelpField";
import { CATALOG_CONTEXTUAL_HELP_FIELDS } from "../../../../../../../packages/shared/src/domain/componentTraits";
import { CATALOG_PREFIX_FIELDS } from "../../../../../../../packages/shared/src/catalog/runtime/fieldPrefix";

import { CatalogComponentSection } from "./CatalogComponentSection";
import { CatalogComponentPropertiesSection } from "./CatalogComponentPropertiesSection";
import { catalogHasProjectComponents } from "../../../catalogRuntime/componentProperties";

import { CATALOG_FIELD_VALUE_SOURCE } from "./catalogFieldValueSource";

import { CatalogItemInsertSection } from "./CatalogItemInsertSection";

import { CatalogItemRolesSection } from "./CatalogItemRolesSection";

import { CATALOG_ITEMS_SOURCE } from "./catalogItemsSource";

import { CatalogLayoutBodySection } from "./CatalogLayoutBodySection";

import { CatalogPageSection } from "./CatalogPageSection";

import { CatalogPropertyClipboardActions } from "./CatalogPropertyClipboardActions";

import { catalogSubpartOwnerType } from "../../../catalogRuntime/subpart";

import {
  CatalogCardFieldsSection,
  CatalogItemOriginNotice,
} from "./CatalogRowTemplateSections";

import { CatalogShowWhenSection } from "./CatalogShowWhenSection";

import {
  CatalogSlotItemInsert,
  CatalogSlotSection,
} from "./CatalogSlotSection";

import { CatalogStateSection } from "./CatalogStateSection";
import { CatalogPropFollowSection } from "./CatalogPropFollowSection";

import {
  CALENDAR_TYPES,
  CatalogPropertiesSelection,
} from "./CatalogPropertiesPanel.runtime";
import { catalogShowWhenApplies } from "./showWhenAncestors";

/** The Property tab's header actions — copy / paste (⌘⌥C / ⌘⌥V registered while mounted). */
export function CatalogPropertiesHeaderActions({
  selection: { first, contract, targets, subpartOwner },
}: {
  selection: CatalogPropertiesSelection;
}) {
  if (!first || !contract.type || subpartOwner) return null;
  return (
    <CatalogPropertyClipboardActions contract={contract} targets={targets} />
  );
}

/** The Property tab's body (inside the tab's `.panel-contents`). */
export function CatalogPropertiesBody({
  selection: { first, contract, targets, subpartOwner, graph, workspace, root },
}: {
  selection: CatalogPropertiesSelection;
}) {
  const { t } = useI18n();
  if (!first || !contract.type)
    return (
      <EmptyState
        icon={<Settings2 size={32} />}
        message={t("propertiesPanel.selectElement")}
      />
    );
  if (subpartOwner) {
    const styleOwner = root
      ? catalogSubpartOwnerType(graph, root.domInputs, first.identity, "style")
      : subpartOwner;
    return (
      <EmptyState
        icon={<Settings2 size={32} />}
        message={t("propertiesPanel.delegatedSubpartMessage")}
        description={t(
          styleOwner
            ? "propertiesPanel.delegatedSubpartDescription"
            : "propertiesPanel.boundTextPartDescription",
          {
            type: contract.type,
            parent: subpartOwner,
          },
        )}
      />
    );
  }
  const settingsPage =
    first.target.kind === "node"
      ? catalogSettingsPage(graph, first.target.id)
      : undefined;
  // A node of the Components page (a built-in origin's sample, a state variant, a frame).
  const originSample =
    first.target.kind === "node" &&
    first.target.id.startsWith(ORIGIN_VIEW_NODE);
  return (
    <FieldValueSourceContext.Provider value={CATALOG_FIELD_VALUE_SOURCE}>
      <ItemsSourceContext.Provider value={CATALOG_ITEMS_SOURCE}>
        {/* 사용자 결정 2026-11-12 「Property 탭 섹션 병합」: Component → (page · body layout) →
            Content → Value → Collection → Series → Behavior → Locale (`CatalogFields`) → State. The
            old fixed sections stand inside those as groups. */}
        <CatalogComponentSection
          key={`component:${targetKey(first.target)}`}
          target={first.target}
        >
          {/* ADR-261 Decision 4: a user component's properties, on a node of its origin (only a
              project that has components mounts it — no graph walk per selection otherwise). */}
          {first.target.kind === "node" &&
            !originSample &&
            catalogHasProjectComponents(graph) && (
              <CatalogComponentPropertiesSection
                key={`properties:${first.target.id}`}
                nodeId={first.target.id}
                identity={first.identity}
              />
            )}
        </CatalogComponentSection>
        {settingsPage && (
          <CatalogPageSection
            key={`page:${settingsPage}`}
            pageId={settingsPage}
          />
        )}
        {first.target.kind === "node" && (
          <CatalogLayoutBodySection
            key={`layout-body:${first.target.id}`}
            nodeId={first.target.id}
          />
        )}
        {/* Keyed by the type, not the element: selecting another element of the same type keeps
            the fields mounted and gives them the new element's values (the fields follow the
            selection — PropertyInput resets on a new selection and commits a blur only on the
            selection it was focused on). Keyed by the element, every selection mounted the whole
            body again (CANVAS_PERF_SCALING_2026-11 C1: ~420 of 645 fibers per Button → Button). */}
        <CatalogFields
          key={`fields:${first.target.kind}:${contract.type}`}
          elementId={first.identity}
          targets={targets}
          root={root}
        />
        {first.target.kind === "node" && !originSample && (
          <CatalogStateSection
            key={`state:${first.target.id}`}
            nodeId={first.target.id}
            type={contract.type}
          >
            <CatalogPropFollowSection
              key={`follow:${first.target.id}`}
              nodeId={first.target.id}
              workspace={workspace}
            />
          </CatalogStateSection>
        )}
      </ItemsSourceContext.Provider>
    </FieldValueSourceContext.Provider>
  );
}

const CatalogFields = memo(function CatalogFields({
  elementId,
  targets,
  root,
}: {
  elementId: string;
  targets: readonly EditTarget[];
  /** The panel's shared root (no getter of its own per step — ADR-246 count). */
  root: ReturnType<typeof useCatalogWorkspace>["root"] | undefined;
}) {
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const run = useCatalogCommandRunner();
  const contract = useCatalogEditContract(targets[0]);
  const subscribeSteps = useCallback(
    (notify: () => void) => workspace.runtime.subscribeSteps(() => notify()),
    [workspace],
  );
  // ADR-256 Phase 9: a Calendar · RangeCalendar in a DatePicker · DateRangePicker takes the
  // picker's state, bounds, paging and first day (RAC's calendar context) — edited on the picker.
  // (Read only for a calendar selection — the root is not touched for the other types.)
  const isCalendar = CALENDAR_TYPES.has(contract.type ?? "");
  const calendarPicker = useSyncExternalStore(subscribeSteps, () => {
    if (!isCalendar || !root) return "";
    const record = root.domInputs.get(elementId);
    if (!record) return "";
    const picker = catalogCalendarPicker(root, record);
    return picker ? root.typeOf(picker) : "";
  });
  // 2026-10-14: the props this node's owner decides where it sits (a grouped toggle's size and
  // emphasis, a field's button's size, a picker's list selection …) — not offered here.
  // (Read only for a type an owner can decide — the root is not touched for the others.)
  const mayBeOwnerDecided = CATALOG_OWNER_DECIDED_TYPES.has(
    contract.type ?? "",
  );
  const ownerDecidedKey = useSyncExternalStore(subscribeSteps, () => {
    if (!mayBeOwnerDecided || !root) return "";
    const record = root.domInputs.get(elementId);
    const decided = record ? catalogOwnerDecidedProps(root, record) : undefined;
    return decided ? `${decided.owner}:${[...decided.keys].join(",")}` : "";
  });
  const ownerDecided = useMemo(() => {
    if (!ownerDecidedKey) return undefined;
    const [owner, keys] = ownerDecidedKey.split(":");
    return { owner: owner!, keys: new Set(keys!.split(",")) };
  }, [ownerDecidedKey]);
  // ADR-308 Decision 5 — a group's selection · expansion field: its items (key · text) as the
  // choices (a bound list's sample rows — 사용자 결정 4), a dropdown for one key and a check list for
  // several (사용자 결정 3), showing the keys it holds (its RAC default while it stores none).
  const groupFieldsKey = useSyncExternalStore(subscribeSteps, () =>
    targets.length === 1
      ? JSON.stringify(catalogGroupKeysFields(workspace.root, elementId))
      : "[]",
  );
  const groupFields = useMemo(
    () =>
      JSON.parse(groupFieldsKey) as ReturnType<typeof catalogGroupKeysFields>,
    [groupFieldsKey],
  );
  const semanticFields = useMemo(() => {
    const fields = contract.fields
      .filter(
        (field) =>
          field.origin === "semantic" && !ownerDecided?.keys.has(field.key),
      )
      .map((field) => {
        const group = groupFields.find((item) => item.key === field.key);
        if (!group) return field;
        return {
          ...field,
          // (One key or several — the group's mode decides the label too.)
          ...(field.label === "Selected items" ||
          field.label === "Selected item"
            ? { label: group.many ? "Selected items" : "Selected item" }
            : {}),
          kind: group.many ? ("selection-keys" as const) : ("enum" as const),
          options: [...group.options],
          // (Shown while the group stores none — the renderer reads own ?? base.)
          baseValue: group.value,
          ...(field.currentValue === undefined
            ? { currentValue: group.value }
            : {}),
        };
      });
    // (ADR-276: a Button · ToggleButton origin's words · glyph are its `label` · `icon` props —
    // its reusable schema, no child fields of its own.)
    return fields;
  }, [contract, ownerDecided, groupFields]);
  // (A picker's calendar keeps its own notice — it names what the picker edits.)
  const decidedLabels = ownerDecided
    ? contract.fields
        .filter(
          (field) =>
            field.origin === "semantic" && ownerDecided.keys.has(field.key),
        )
        .map((field) => field.label)
    : [];
  const ownerNotice =
    ownerDecided && !calendarPicker && decidedLabels.length ? (
      <p
        className="item-origin-notice"
        data-owner-decided-notice={ownerDecided.owner}
      >
        {t("propertiesPanel.ownerDecidedNotice", {
          owner: ownerDecided.owner,
          fields: decidedLabels.join(" · "),
        })}
      </p>
    ) : null;
  const bindingKeys = useMemo(
    () =>
      new Set(
        contract.fields
          .filter((field) => field.kind === "binding")
          .map((field) => field.key),
      ),
    [contract],
  );
  const handlePatch = useCallback(
    (patch: Record<string, unknown>) => {
      const first = targets[0];
      if (!first) return;
      if (
        targets.length === 1 &&
        Object.keys(patch).length === 1 &&
        "isSelected" in patch
      ) {
        const selection = catalogPickerSelectionCommands(
          workspace,
          elementId,
          patch.isSelected,
        );
        if (selection.length) {
          run(() =>
            composeCommands(
              workspace.runtime.graph,
              "Edit option selection",
              selection,
            ),
          );
          return;
        }
      }
      // ADR-308 — a group field writes the group's prop (its controlled twin dropped).
      const groupKey =
        targets.length === 1 && Object.keys(patch).length === 1
          ? groupFields.find((field) => field.key in patch)?.key
          : undefined;
      if (groupKey) {
        const command = catalogGroupKeysWriteCommand(
          workspace,
          elementId,
          groupKey,
          patch[groupKey],
        );
        if (command) run(command);
        return;
      }
      const written = patch;
      const command = Object.keys(written).length
        ? catalogPropertiesPatchCommand(
            workspace.runtime.graph,
            targets,
            written,
            (changed) => workspace.readModel.propSource(first, changed).value,
            bindingKeys,
            workspace.newId,
            (target, changed) =>
              workspace.readModel.propSource(target, changed).value,
          )
        : undefined;
      // ADR-308 Decision 7 — an item's key edit moves the keys that name it (its group's selection ·
      // expansion, a Tab's TabPanel) in the same step. (ADR-310 Phase 1: a group Radio's ·
      // Checkbox's key is its `value`.)
      const keyProp =
        contract.type === "Radio" || contract.type === "Checkbox"
          ? "value"
          : "id";
      const keep =
        targets.length === 1 && keyProp in patch
          ? catalogItemKeyRenameCommands(workspace, elementId, patch[keyProp])
          : [];
      // A glyph's Size step is drawn only without an authored font size or box (`glyphSize.ts`).
      const glyphStep =
        "size" in written && CATALOG_GLYPH_TYPES.has(contract.type ?? "")
          ? [
              catalogGlyphStepClearCommand({
                targets,
                breakpoint: workspace.session.getSnapshot().breakpoint,
              }),
            ]
          : [];
      const all = [...(command ? [command] : []), ...keep, ...glyphStep];
      if (!all.length) return;
      run(
        all.length > 1
          ? () =>
              composeCommands(workspace.runtime.graph, "Edit properties", all)
          : all[0]!,
      );
    },
    [
      bindingKeys,
      contract.type,
      elementId,
      groupFields,
      run,
      targets,
      workspace,
    ],
  );
  const handleSemanticUpdate = useCallback(
    (key: string, value: unknown) => handlePatch({ [key]: value }),
    [handlePatch],
  );
  // Style fields are the Styles panel's (4e-4d); the Properties view shows semantic ones only.
  const handleStyleUpdate = useCallback(() => {}, []);
  const isRefInstance = useMemo(() => {
    const first = targets[0];
    if (!first) return false;
    try {
      return catalogTargetDefinitionId(
        workspace.runtime.graph,
        first,
      ).startsWith("lib:definition:origin-");
    } catch {
      return false;
    }
  }, [targets, workspace]);
  // ADR-284 Phase 3: a bound list's 「검색 · 필터」 · a filter control's 「목록 거르기」 (one node).
  const filterNode =
    targets.length === 1 && targets[0]!.kind === "node"
      ? targets[0]!.id
      : undefined;
  // A glyph's one size (`glyphSize.ts`) — re-read per step and root (the breakpoint's layer).
  const isGlyph = CATALOG_GLYPH_TYPES.has(contract.type ?? "");
  const subscribeLayout = useCallback(
    (notify: () => void) => {
      const offSteps = workspace.runtime.subscribeSteps(() => notify());
      const offRoot = workspace.subscribeRoot(notify);
      return () => {
        offSteps();
        offRoot();
      };
    },
    [workspace],
  );
  const glyphKey = useSyncExternalStore(subscribeLayout, () => {
    if (!isGlyph) return "";
    const record = workspace.root.domInputs.get(elementId);
    if (!record || !catalogIsGlyphRecord(record)) return "";
    return `${catalogGlyphSize(record) ?? ""}|${catalogGlyphSizeIsCustom(record)}`;
  });
  const glyphSize = useMemo<GlyphSizeSource | null>(() => {
    if (!glyphKey) return null;
    const [px, custom] = glyphKey.split("|");
    return {
      value: px ? Number(px) : undefined,
      custom: custom === "true",
      commit: (next) =>
        run(
          catalogGlyphSizeCommand({
            targets,
            breakpoint: workspace.session.getSnapshot().breakpoint,
            px: next,
          }),
        ),
    };
  }, [glyphKey, run, targets, workspace]);
  const isBound = useSyncExternalStore(subscribeSteps, () => {
    const node = filterNode
      ? workspace.runtime.graph.getEntry(filterNode)
      : undefined;
    return node?.kind === "node" && !!node.binding;
  });
  const extras = useChartPropertyExtras({
    elementId,
    elementType: contract.type,
    contractFields: contract.fields,
    semanticFields,
    contentExtras: withOwnerNotice(
      ownerNotice,
      isCalendar ? (
        <>
          {calendarPicker ? (
            <p
              className="item-origin-notice"
              data-calendar-picker-notice={calendarPicker}
            >
              {t("propertiesPanel.calendarPickerNotice", {
                picker: calendarPicker,
              })}
            </p>
          ) : null}
          <CatalogCalendarHeaderField elementId={elementId} />
        </>
      ) : CATALOG_CONTEXTUAL_HELP_FIELDS.has(contract.type ?? "") ? (
        <>
          <CatalogContextualHelpField elementId={elementId} />
          {CATALOG_PREFIX_FIELDS.has(contract.type ?? "") ? (
            <CatalogFieldPrefixField elementId={elementId} />
          ) : null}
        </>
      ) : undefined,
    ),
    onPatch: handlePatch,
    isRefInstance,
  });
  const target = targets[0];
  // The Components page: only a sample's root props and styles are its origin's project defaults
  // (user decision: root only) — no node attributes, state or slot.
  const originSample =
    target?.kind === "node" && target.id.startsWith(ORIGIN_VIEW_NODE);
  // 사용자 결정 2026-11-12: the old fixed sections' controls, by the section they stand in.
  const fixedSections: Partial<Record<string, ReactNode>> = target
    ? {
        // Content's end — the slot's picker (its item types built as the item 「+」 builds them).
        appearance: originSample ? null : (
          <CatalogSlotSection
            key={`slot:${targetKey(target)}`}
            target={target}
            type={contract.type}
            identity={elementId}
          />
        ),
        // Collection — after Data source and its mapping, before Search · filter.
        collection: (
          <>
            <CatalogItemOriginNotice
              key={`origin:${targetKey(target)}`}
              target={target}
            />
            <CatalogCardFieldsSection
              key={`cards:${elementId}`}
              identity={elementId}
            />
            <CatalogItemRolesSection
              key={`roles:${elementId}`}
              identity={elementId}
            />
            {originSample ? (
              <CatalogItemInsertSection
                key={`items:${elementId}`}
                identity={elementId}
              />
            ) : (
              <CatalogSlotItemInsert
                key={`items:${targetKey(target)}`}
                target={target}
                type={contract.type}
                identity={elementId}
              />
            )}
          </>
        ),
        // Behavior's end (the accessibility group's place).
        accessibility: originSample ? null : (
          <>
            {/* ADR-256 Decision 7: only a node under a part that gives state keys (or with a
                condition) mounts it (no hook cost per selection). */}
            {target.kind === "node" &&
              root &&
              catalogShowWhenApplies(root, elementId) && (
                <CatalogShowWhenSection
                  key={`show-when:${elementId}`}
                  identity={elementId}
                  workspace={workspace}
                  root={root}
                />
              )}
            <CatalogAccessibilitySection
              key={`accessibility:${targetKey(target)}`}
              target={target}
              identity={elementId}
            />
          </>
        ),
      }
    : {};
  const renderer = (
    <GenericFieldRenderer
      fields={extras.fields}
      onSemanticUpdate={handleSemanticUpdate}
      onStyleUpdate={handleStyleUpdate}
      elementId={elementId}
      contentExtras={extras.contentExtras}
      sectionLeads={extras.sectionLeads}
      sectionExtras={withFilterSections(
        withFixedSections(extras.sectionExtras, fixedSections),
        filterNode,
        isBound,
      )}
    />
  );
  return glyphSize ? (
    <GlyphSizeContext.Provider value={glyphSize}>
      {renderer}
    </GlyphSizeContext.Provider>
  ) : (
    renderer
  );
});

/**
 * ADR-284 Phase 3: a bound list's 「검색 · 필터」 at the end of its Collection section (one node
 * selected). 사용자 결정 2026-11-12: the list's is the filter's only entry — a filter control has
 * no 「Filter a list」 section (it is picked from the list's 「Add search」 as 「Existing」).
 */
function withFilterSections(
  sectionExtras: Partial<Record<string, ReactNode>> | undefined,
  nodeId: NodeId | undefined,
  isBound: boolean,
): Partial<Record<string, ReactNode>> | undefined {
  if (!nodeId || !isBound) return sectionExtras;
  return {
    ...sectionExtras,
    collection: (
      <>
        {sectionExtras?.collection}
        {/* Its add · share forms belong to the list they were opened on. */}
        <CatalogListFilterSection key={nodeId} listId={nodeId} />
      </>
    ),
  };
}

/** A section's own extra controls, then the fixed section's controls that stand in it. */
function withFixedSections(
  sectionExtras: Partial<Record<string, ReactNode>> | undefined,
  fixed: Partial<Record<string, ReactNode>>,
): Partial<Record<string, ReactNode>> {
  const out = { ...sectionExtras };
  for (const [section, node] of Object.entries(fixed)) {
    if (node == null) continue;
    const own = out[section];
    out[section] =
      own == null ? (
        node
      ) : (
        <>
          {own}
          {node}
        </>
      );
  }
  return out;
}

/** The owner's notice above a section's own extra fields. */
function withOwnerNotice(
  notice: ReactNode,
  extras: ReactNode,
): ReactNode | undefined {
  if (!notice) return extras ?? undefined;
  return (
    <>
      {notice}
      {extras}
    </>
  );
}
