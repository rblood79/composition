import {
  CatalogControlFilterSection,
  CatalogListFilterSection,
} from "./CatalogFilterSection";
import { catalogFilterKindOfType } from "../../../catalogRuntime/viewAuthoring";
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

import { catalogRacSlotConsumer } from "../../../../../../../packages/shared/src/catalog/runtime/racSlot";

import { useI18n } from "../../../../i18n";

import {
  catalogPropertiesPatchCommand,
  catalogTargetDefinitionId,
} from "../../../catalogRuntime/editContract";

import { ORIGIN_VIEW_NODE } from "../../../catalogRuntime/originView";

import { catalogSettingsPage } from "../../../catalogRuntime/pageSettings";

import {
  catalogRadioGroupValueOptions,
  catalogSingleSelectionCommand,
  catalogTabsSelectedTab,
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

import { CatalogRacSlotSection } from "./CatalogRacSlotSection";

import {
  CatalogCardFieldsSection,
  CatalogItemOriginNotice,
} from "./CatalogRowTemplateSections";

import { CatalogShowWhenSection } from "./CatalogShowWhenSection";

import { CatalogSlotSection } from "./CatalogSlotSection";

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
  if (subpartOwner)
    return (
      <EmptyState
        icon={<Settings2 size={32} />}
        message={t("propertiesPanel.delegatedSubpartMessage")}
        description={t("propertiesPanel.delegatedSubpartDescription", {
          type: contract.type,
          parent: subpartOwner,
        })}
      />
    );
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
        <CatalogComponentSection
          key={`component:${targetKey(first.target)}`}
          target={first.target}
        />
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
        {/* The Components page: only a sample's root props and styles are its origin's project
            defaults (user decision: root only) — no node attributes, state or slot. */}
        {!originSample && (
          <CatalogAccessibilitySection
            key={`accessibility:${targetKey(first.target)}`}
            target={first.target}
            identity={first.identity}
          />
        )}
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
        {first.target.kind === "node" && !originSample && (
          <CatalogStateSection
            key={`state:${first.target.id}`}
            nodeId={first.target.id}
            type={contract.type}
          />
        )}
        {first.target.kind === "node" && !originSample && (
          <CatalogPropFollowSection
            key={`follow:${first.target.id}`}
            nodeId={first.target.id}
            workspace={workspace}
          />
        )}
        {/* One Slot section: the slot's picker (its item types built as the item 「+」 builds them),
            or the item 「+」 where the position is no slot (and on an origin sample). */}
        {originSample ? (
          <CatalogItemInsertSection
            key={`items:${first.identity}`}
            identity={first.identity}
          />
        ) : (
          <CatalogSlotSection
            key={`slot:${targetKey(first.target)}`}
            target={first.target}
            type={contract.type}
            identity={first.identity}
          />
        )}
        <CatalogItemRolesSection
          key={`roles:${first.identity}`}
          identity={first.identity}
        />
        {/* Only a part that reads a RAC slot context mounts it (no hook cost per selection). */}
        {catalogRacSlotConsumer(contract.type) && (
          <CatalogRacSlotSection
            key={`rac-slot:${first.identity}`}
            identity={first.identity}
            workspace={workspace}
            root={root!}
          />
        )}
        {/* ADR-256 Decision 7: only a node under a part that gives state keys (or with a
            condition) mounts it (no hook cost per selection). */}
        {first.target.kind === "node" &&
          !originSample &&
          root &&
          catalogShowWhenApplies(root, first.identity) && (
            <CatalogShowWhenSection
              key={`show-when:${first.identity}`}
              identity={first.identity}
              workspace={workspace}
              root={root}
            />
          )}
        <CatalogItemOriginNotice
          key={`origin:${targetKey(first.target)}`}
          target={first.target}
        />
        <CatalogCardFieldsSection
          key={`cards:${first.identity}`}
          identity={first.identity}
        />
        <CatalogFields
          key={targetKey(first.target)}
          elementId={first.identity}
          targets={targets}
          root={root}
        />
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
  /** The panel's root (no getter of its own per step — ADR-246 count, like the RAC slot section). */
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
  // A RadioGroup's Value is one of its Radios' values (any depth — the record tree).
  const radioOptionsKey = useSyncExternalStore(subscribeSteps, () =>
    contract.type === "RadioGroup"
      ? JSON.stringify(catalogRadioGroupValueOptions(workspace.root, elementId))
      : "",
  );
  // A Tabs' Selected Tab: its Tabs, showing the selected one.
  const selectedTabKey = useSyncExternalStore(subscribeSteps, () =>
    contract.type === "Tabs"
      ? JSON.stringify(
          catalogTabsSelectedTab(workspace.root, elementId) ?? null,
        )
      : "",
  );
  const semanticFields = useMemo(() => {
    const radioOptions = radioOptionsKey
      ? (JSON.parse(radioOptionsKey) as { value: string; label: string }[])
      : undefined;
    const selectedTab = selectedTabKey
      ? (JSON.parse(selectedTabKey) as ReturnType<
          typeof catalogTabsSelectedTab
        >)
      : undefined;
    const fields = contract.fields
      .filter(
        (field) =>
          field.origin === "semantic" && !ownerDecided?.keys.has(field.key),
      )
      .map((field) =>
        radioOptions && field.key === "value"
          ? { ...field, options: radioOptions }
          : selectedTab && field.key === "defaultSelectedKey"
            ? {
                ...field,
                options: selectedTab.options,
                // (Shown when the Tabs keep no key — the renderer reads own ?? base.)
                baseValue: selectedTab.value,
                currentValue: selectedTab.value,
                isOverridden: false,
              }
            : field,
      );
    // (ADR-276: a Button · ToggleButton origin's words · glyph are its `label` · `icon` props —
    // its reusable schema, no child fields of its own.)
    return fields;
  }, [contract, ownerDecided, radioOptionsKey, selectedTabKey]);
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
      // (A Tabs' Selected Tab writes its Tab's Selected, not a key on the Tabs — below.)
      const { defaultSelectedKey: _tab, ...own } = patch;
      const written = contract.type === "Tabs" ? own : patch;
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
      // One value stays one (a Selected item takes it from the others; a RadioGroup's Value and
      // its Radios' Selected follow each other) — in the same step.
      const keep =
        targets.length === 1
          ? catalogSingleSelectionCommand(workspace, elementId, patch)
          : [];
      const all = [...(command ? [command] : []), ...keep];
      if (!all.length) return;
      run(
        all.length > 1
          ? () =>
              composeCommands(workspace.runtime.graph, "Edit properties", all)
          : all[0]!,
      );
    },
    [bindingKeys, contract.type, elementId, run, targets, workspace],
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
  if (!extras.fields.length) return null;
  return (
    <GenericFieldRenderer
      fields={extras.fields}
      literalOptionFields={extras.literalOptionFields}
      onSemanticUpdate={handleSemanticUpdate}
      onStyleUpdate={handleStyleUpdate}
      elementId={elementId}
      contentExtras={extras.contentExtras}
      sectionExtras={withFilterSections(
        extras.sectionExtras,
        filterNode,
        contract.type,
        isBound,
      )}
    />
  );
});

/**
 * ADR-284 Phase 3: the filter entries — a bound list's 「검색 · 필터」 at the end of its Collection
 * section, a filter control's own 「Filter」 section (both one node selected).
 */
function withFilterSections(
  sectionExtras: Partial<Record<string, ReactNode>> | undefined,
  nodeId: NodeId | undefined,
  type: string | undefined,
  isBound: boolean,
): Partial<Record<string, ReactNode>> | undefined {
  if (!nodeId) return sectionExtras;
  const out = { ...sectionExtras };
  if (isBound)
    out.collection = (
      <>
        {sectionExtras?.collection}
        <CatalogListFilterSection listId={nodeId} />
      </>
    );
  if (type && catalogFilterKindOfType(type))
    out.filter = <CatalogControlFilterSection controlId={nodeId} />;
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
