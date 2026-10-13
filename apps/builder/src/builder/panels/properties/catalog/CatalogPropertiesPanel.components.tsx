import { Settings2 } from "lucide-react";

import {
  memo,
  type ReactNode,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from "react";

import type { EditTarget } from "../../../../../../../packages/shared/src/catalog/document/types";

import { catalogCalendarPicker } from "../../../../../../../packages/shared/src/catalog/runtime/delegatedDom";

import { catalogOwnerDecidedProps } from "../../../../../../../packages/shared/src/catalog/runtime/ownerDecidedProps";

import { catalogRacSlotConsumer } from "../../../../../../../packages/shared/src/catalog/runtime/racSlot";

import { useI18n } from "../../../../i18n";

import {
  catalogButtonChildren,
  type CatalogButtonChildren,
} from "../../../catalogRuntime/buttonChildren";

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

import { useCatalogCommandRunner } from "../../navigator/catalog/useCatalogCommandRunner";

import { FieldValueSourceContext } from "../generic/fieldValueSource";

import { GenericFieldRenderer } from "../generic/GenericFieldRenderer";

import { ItemsSourceContext } from "../generic/itemsSource";

import { useChartPropertyExtras } from "../useChartPropertyExtras";

import { CatalogAttributesSection } from "./CatalogAttributesSection";

import { CatalogButtonChildFields } from "./CatalogButtonChildFields";

import { CatalogCalendarHeaderField } from "./CatalogCalendarHeaderField";
import { CatalogFieldPrefixField } from "./CatalogFieldPrefixField";
import { CatalogContextualHelpField } from "./CatalogContextualHelpField";
import { CATALOG_CONTEXTUAL_HELP_FIELDS } from "../../../../../../../packages/shared/src/domain/componentTraits";
import { CATALOG_PREFIX_FIELDS } from "../../../../../../../packages/shared/src/catalog/runtime/fieldPrefix";

import { CatalogComponentSection } from "./CatalogComponentSection";

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
        {first.target.kind === "node" && (
          <CatalogComponentSection
            key={`component:${first.target.id}`}
            nodeId={first.target.id}
          />
        )}
        {/* The Components page: only a sample's root props and styles are its origin's project
            defaults (user decision: root only) — no node attributes, state or slot. */}
        {!originSample && (
          <CatalogAttributesSection
            key={`attributes:${targetKey(first.target)}`}
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
          />
        )}
        {!originSample && (
          <CatalogSlotSection
            key={`slot:${targetKey(first.target)}`}
            target={first.target}
            type={contract.type}
          />
        )}
        <CatalogItemInsertSection
          key={`items:${first.identity}`}
          identity={first.identity}
        />
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
        />
      </ItemsSourceContext.Provider>
    </FieldValueSourceContext.Provider>
  );
}

const CatalogFields = memo(function CatalogFields({
  elementId,
  targets,
}: {
  elementId: string;
  targets: readonly EditTarget[];
}) {
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const run = useCatalogCommandRunner();
  const contract = useCatalogEditContract(targets[0]);
  // A Button / ToggleButton's Icon · Text children (the old ButtonChildFields axis).
  const buttonNode = targets[0]?.kind === "node" ? targets[0].id : undefined;
  const subscribeSteps = useCallback(
    (notify: () => void) => workspace.runtime.subscribeSteps(() => notify()),
    [workspace],
  );
  const buttonKey = useSyncExternalStore(subscribeSteps, () => {
    const state = buttonNode
      ? catalogButtonChildren(workspace.runtime.graph, buttonNode)
      : undefined;
    return state ? JSON.stringify(state) : "";
  });
  const buttonChildren = useMemo(
    () =>
      buttonKey ? (JSON.parse(buttonKey) as CatalogButtonChildren) : undefined,
    [buttonKey],
  );
  // ADR-256 Phase 9: a Calendar · RangeCalendar in a DatePicker · DateRangePicker takes the
  // picker's state, bounds, paging and first day (RAC's calendar context) — edited on the picker.
  // (Read only for a calendar selection — the root is not touched for the other types.)
  const isCalendar = CALENDAR_TYPES.has(contract.type ?? "");
  const calendarPicker = useSyncExternalStore(subscribeSteps, () => {
    if (!isCalendar) return "";
    const root = workspace.root;
    const record = root.domInputs.get(elementId);
    if (!record) return "";
    const picker = catalogCalendarPicker(root, record);
    return picker ? root.typeOf(picker) : "";
  });
  // 2026-10-14: the props this node's owner decides where it sits (a grouped toggle's size and
  // emphasis, a field's button's size, a picker's list selection …) — not offered here.
  const ownerDecidedKey = useSyncExternalStore(subscribeSteps, () => {
    const root = workspace.root;
    const record = root.domInputs.get(elementId);
    const decided = record ? catalogOwnerDecidedProps(root, record) : undefined;
    return decided ? `${decided.owner}:${[...decided.keys].join(",")}` : "";
  });
  const ownerDecided = useMemo(() => {
    if (!ownerDecidedKey) return undefined;
    const [owner, keys] = ownerDecidedKey.split(":");
    return { owner: owner!, keys: new Set(keys!.split(",")) };
  }, [ownerDecidedKey]);
  // A Button's Icon · label fields — not when its origin edits the icon itself (IconButton's
  // `icon` prop: the two would be one glyph twice).
  const buttonChildFields =
    !!buttonNode &&
    !!buttonChildren &&
    !contract.fields.some(
      (field) => field.key === "icon" && field.kind === "icon",
    );
  const childrenField = contract.fields.find(
    (field) => field.key === "children" && field.origin === "semantic",
  );
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
          field.origin === "semantic" &&
          !ownerDecided?.keys.has(field.key),
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
    // A Button's label · icon fields draw together (`CatalogButtonChildFields` — label, then icon),
    // so its own `children` field is not drawn twice.
    return buttonChildFields
      ? fields.filter((field) => field.key !== "children")
      : fields;
  }, [
    buttonChildFields,
    contract,
    ownerDecided,
    radioOptionsKey,
    selectedTabKey,
  ]);
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
  const extras = useChartPropertyExtras({
    elementId,
    elementType: contract.type,
    contractFields: contract.fields,
    semanticFields,
    contentExtras: withOwnerNotice(
      ownerNotice,
      buttonChildFields && buttonNode && buttonChildren ? (
        <CatalogButtonChildFields
          nodeId={buttonNode}
          state={buttonChildren}
          label={childrenField?.label ?? "Label"}
          ownText={
            typeof childrenField?.currentValue === "string"
              ? childrenField.currentValue
              : undefined
          }
          onOwnTextChange={
            childrenField
              ? (value) => handleSemanticUpdate("children", value)
              : undefined
          }
        />
      ) : isCalendar ? (
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
      sectionExtras={extras.sectionExtras}
    />
  );
});

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
