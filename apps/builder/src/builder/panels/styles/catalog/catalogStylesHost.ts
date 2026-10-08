import { useCallback, useMemo, useSyncExternalStore } from "react";
import { replayFillEdit } from "./fillEdit";
import {
  setFields,
  setWholeField,
} from "../../../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../../../packages/shared/src/catalog/commands/compose";
import type {
  DefinitionId,
  EditTarget,
  EntryId,
  NodeId,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import {
  catalogEditContract,
  catalogSemanticPatchCommand,
} from "../../../catalogRuntime/editContract";
import {
  useCatalogEditContract,
  useCatalogSession,
} from "../../../catalogRuntime/react";
import { targetKey } from "../../../catalogRuntime/session";
import {
  catalogAuthoredValues,
  cssPx,
  catalogStylePreviewPatch,
  CatalogStyleValueError,
  catalogStyleView,
  catalogStyleWritesOf,
} from "../../../catalogRuntime/styleFields";
import type { CatalogWorkspace } from "../../../catalogRuntime/workspace";
import type { CatalogRecordPreview } from "../../../catalogRuntime/compositionRoot";
import { catalogBoxModel } from "../../../catalogRuntime/boxModel";
import { catalogEffectiveStyle } from "../../../catalogRuntime/effectiveStyle";
import { catalogPageDropCommand } from "../../../catalogRuntime/canvasPage";
import { catalogSubpartOwnerType } from "../../../catalogRuntime/subpart";
import { catalogDocumentColorSources } from "../../../catalogRuntime/documentColors";
import {
  catalogFieldsAt,
  catalogOverrideSeed,
  catalogResponsiveSummary,
} from "../../../catalogRuntime/responsiveFields";
import {
  resolveEligibleSeedDefault,
  SHORTHAND_TO_LONGHAND,
} from "../../../stores/utils/responsiveWriteRouting";
import {
  catalogDirtyStyleProps,
  catalogResetStyleWrites,
} from "../../../catalogRuntime/styleDirty";
import {
  catalogFillItems,
  catalogFillLayers,
} from "../../../catalogRuntime/authoredStyle";
import type { FillItem } from "../../../../types/builder/fill.types";
import type { SelectedElement } from "../../../inspector/types";
import { resolveElementFills } from "../utils/fillMigration";
import { FILL_DERIVED_STYLE_PROPS } from "../utils/fillDerivedStyleProps";
import {
  catalogAbsoluteCommand,
  catalogPlacementEditCommand,
  catalogPlacementStyle,
} from "../../../catalogRuntime/position";
import {
  catalogFillAt,
  catalogRatioCommand,
  catalogSizingCommand,
} from "../../../catalogRuntime/sizing";
import { useToastStore } from "../../../stores/toast";
import {
  TINT_PRESETS,
  type TintPreset,
} from "../../../../utils/theme/tintToSkiaColors";
import type { ElementStyleContext } from "../hooks/useElementStyleContext";
import type { StylesHost, StylesTargetSnapshot } from "../stylesHostContext";
import {
  useCatalogLayoutValue,
  useCatalogLayoutVersion,
} from "../hooks/useLayoutValue";
import { isOwnerOrientationTag } from "../utils/orientationDrivenTags";

const noSubscription = () => () => {};

/** A record's own authored fields, following edits (the record's document target). */
function useOwnFieldsOf(workspace: CatalogWorkspace, id: string | null) {
  const target = useMemo(
    () => (id ? workspace.itemOfRecord(id)?.target : undefined),
    [workspace, id],
  );
  const key = target ? targetKey(target) : "";
  const subscribe = useCallback(
    (notify: () => void) =>
      target
        ? workspace.readModel.subscribeOwnFields(target, notify)
        : noSubscription(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the target's key
    [key],
  );
  const own = useSyncExternalStore(subscribe, () =>
    target ? workspace.readModel.ownFields(target) : undefined,
  );
  return { target, own };
}

/**
 * The node a target's values come from before its own (the old Styles host's `origin`): a project
 * component instance's template root, an instance position's project template node. A built-in
 * library origin has none here (its values are the catalog's).
 */
function masterTargetOf(
  workspace: CatalogWorkspace,
  target: EditTarget | undefined,
): EditTarget | undefined {
  if (!target) return undefined;
  const graph = workspace.runtime.graph;
  if (target.kind === "descendant") {
    const last = target.address.templatePath.at(-1);
    return last?.startsWith("project:node:")
      ? { kind: "node", id: last as NodeId }
      : undefined;
  }
  const node = graph.getEntry(target.id);
  if (node?.kind !== "node" || !node.definitionId.startsWith("project:"))
    return undefined;
  const definition = graph.getEntry(node.definitionId);
  return definition?.kind === "definition"
    ? { kind: "node", id: definition.templateRootId as NodeId }
    : undefined;
}

function useMasterFieldsOf(
  workspace: CatalogWorkspace,
  target: EditTarget | undefined,
) {
  const master = useMemo(
    () => masterTargetOf(workspace, target),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the target's key
    [workspace, target ? targetKey(target) : ""],
  );
  const key = master ? targetKey(master) : "";
  const subscribe = useCallback(
    (notify: () => void) =>
      master
        ? workspace.readModel.subscribeOwnFields(master, notify)
        : noSubscription(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the master's key
    [key],
  );
  return useSyncExternalStore(subscribe, () =>
    master ? workspace.readModel.ownFields(master) : undefined,
  );
}

/** A drawn record's accent: its own, else the nearest ancestor record's (the old walk). */
function accentOf(
  workspace: CatalogWorkspace,
  id: string | null,
): TintPreset | undefined {
  const records = workspace.root.domInputs;
  for (
    let record = id ? records.get(id) : undefined;
    record;
    record = records.get(record.parentId)
  ) {
    const accent = record.props.accentColor;
    if (typeof accent === "string" && accent in TINT_PRESETS)
      return accent as TintPreset;
  }
  return undefined;
}

/** The drawn parent record of a record (`null` at a page body or the page grid). */
function parentRecordOf(workspace: CatalogWorkspace, id: string | null) {
  const parentId = id ? workspace.root.domInputs.get(id)?.parentId : undefined;
  return parentId ? workspace.root.domInputs.get(parentId) : undefined;
}

/**
 * ADR-251 — an items wrapper's (RadioItems · CheckboxItems) Direction is its owner group's
 * `orientation`: the owner's target, else undefined (not a wrapper).
 */
function orientationOwnerTargetOf(
  workspace: CatalogWorkspace,
  id: string | null,
): EditTarget | undefined {
  const record = id ? workspace.root.domInputs.get(id) : undefined;
  if (!record) return undefined;
  const type =
    record.ruleId ??
    workspace.runtime.graph.getDefinition(record.definitionId as DefinitionId)
      ?.name;
  if (!isOwnerOrientationTag(type)) return undefined;
  const parent = parentRecordOf(workspace, id);
  return parent ? workspace.positionOfRecord(parent.id)?.target : undefined;
}

function propsOf(workspace: CatalogWorkspace, target: EditTarget) {
  try {
    const contract = catalogEditContract(
      workspace.runtime.graph,
      workspace.readModel,
      target,
    );
    return {
      type: contract.type || undefined,
      props: Object.fromEntries(
        contract.fields.map((field) => [field.key, field.currentValue]),
      ) as Record<string, unknown>,
    };
  } catch {
    return { type: undefined, props: {} };
  }
}

/** The effective CSS view of a drawn record (undefined without a record). */
function effectiveOf(workspace: CatalogWorkspace, id: string | null) {
  const record = id ? workspace.root.domInputs.get(id) : undefined;
  return record ? catalogEffectiveStyle(record) : undefined;
}

/** The drawn font size of a record (a px line height is a ratio to it). */
function fontSizeOf(workspace: CatalogWorkspace, identity: string | undefined) {
  const size = identity
    ? workspace.root.domInputs.get(identity)?.visual.fontSize
    : undefined;
  return typeof size === "number" ? size : undefined;
}

/**
 * ADR-248 Phase 4e-4d: the Styles panel host over the catalog workspace — the selection and
 * breakpoint are the session's, a section reads the selected target's authored typed fields as
 * CSS (`catalogStyleView`, the breakpoint layer over the base), and every edit is one `setFields`
 * step on the selected targets at the session breakpoint (`catalogStyleWritesOf`). A value the
 * typed field cannot hold is refused with a toast. A drag (scrub, slider, picker) previews its
 * value on the Canvas through `previewRecord` — layout included, no history — and the release
 * commits it; the old Canvas presentation channel is not used.
 */
export function createCatalogStylesHost(
  workspace: CatalogWorkspace,
): StylesHost {
  const selection = () => workspace.session.getSnapshot().selection;
  /**
   * The layers the panel shows for a target (`useElementStyleContext`): an instance's own, else
   * its component's — an edit builds on them, so adding a layer keeps the component's.
   */
  const fillsOf = (target: EditTarget): FillItem[] => {
    const own = workspace.readModel.ownFields(target);
    const background = catalogAuthoredValues(own.visual).backgroundColor;
    const master = masterTargetOf(workspace, target);
    return resolveElementFills({
      fills: (catalogFillItems(own.fills) ??
        (master
          ? catalogFillItems(workspace.readModel.ownFields(master).fills)
          : undefined)) as FillItem[] | undefined,
      props: {
        style: {
          backgroundColor:
            typeof background === "string" ? background : undefined,
        },
      },
    });
  };
  /**
   * What a drag previews per record (keys of successive previews add up); an edit or another
   * selection puts the records' own values back.
   */
  const previewed = new Map<string, CatalogRecordPreview>();
  const endPreviews = (keep?: ReadonlySet<string>) => {
    for (const id of [...previewed.keys()]) {
      if (keep?.has(id)) continue;
      previewed.delete(id);
      // A commit that replaced the record already won; this restores one it did not touch.
      workspace.root.previewRecord(id);
    }
  };
  const run = (
    build: () => Parameters<typeof workspace.execute>[0] | undefined,
  ) => {
    try {
      const command = build();
      if (command) workspace.execute(command);
    } catch (error) {
      useToastStore
        .getState()
        .showToast(
          "error",
          error instanceof CatalogStyleValueError || error instanceof Error
            ? error.message
            : String(error),
        );
    } finally {
      endPreviews();
    }
  };
  /** The selection's style edit as one command (undefined = nothing to write). */
  const styleCommandOf = (
    styles: Record<string, string>,
  ): CatalogCommand | undefined => {
    {
      const items = selection();
      if (!items.length || !Object.keys(styles).length) return undefined;
      const targets = items.map((item) => item.target);
      const own = (target: EditTarget) => workspace.readModel.ownFields(target);
      // Left / Top of an absolutely placed node are its placement offsets.
      const { left, top, ...rest } = styles;
      const placed =
        (left !== undefined || top !== undefined) &&
        targets.some((target) => own(target).placement);
      const fields = placed ? rest : styles;
      const commands: CatalogCommand[] = [];
      if (placed)
        commands.push(catalogPlacementEditCommand({ targets, own, left, top }));
      if (Object.keys(fields).length) {
        const breakpoint = workspace.session.getSnapshot().breakpoint;
        commands.push(
          setFields({
            targets,
            ...(breakpoint === "desktop" ? {} : { breakpoint }),
            ...catalogStyleWritesOf(fields, {
              fontSize: fontSizeOf(workspace, items[0].identity),
              visual: workspace.root.domInputs.get(items[0].identity)?.visual,
            }),
            label: "Edit style",
          } as Parameters<typeof setFields>[0]),
        );
      }
      return ((reader) => ({
        label: "Edit style",
        ops: commands.flatMap((command) => command(reader).ops),
      })) satisfies CatalogCommand;
    }
  };
  const writeStyles = (styles: Record<string, string>) =>
    run(() => styleCommandOf(styles));
  const measured = (identity: string) =>
    workspace.root.getGeometry([identity]).get(identity);
  /** The selection's prop patch as one command (undefined = nothing to write). */
  const propsCommandOf = (
    patch: Record<string, unknown>,
  ): CatalogCommand | undefined => {
    const items = selection();
    if (!items[0]) return undefined;
    // ADR-251: an items wrapper's prop write (its Direction = `orientation`) goes to its group.
    const targets = new Map<string, EditTarget>();
    for (const item of items) {
      const target =
        orientationOwnerTargetOf(workspace, item.identity) ?? item.target;
      targets.set(JSON.stringify(target), target);
    }
    const first = [...targets.values()][0];
    return (
      catalogSemanticPatchCommand(
        [...targets.values()],
        patch,
        (key) => workspace.readModel.propSource(first, key).value,
      ) ?? undefined
    );
  };
  const writeProps = (patch: Record<string, unknown>) =>
    run(() => propsCommandOf(patch));

  const host: StylesHost = {
    useSelectedId: () =>
      useCatalogSession((state) => state.selection[0]?.identity ?? null),
    readSelectedId: () => selection()[0]?.identity ?? null,
    useActiveBreakpoint: () => useCatalogSession((state) => state.breakpoint),
    useElementStyleContext(id: string | null): ElementStyleContext {
      const { target, own } = useOwnFieldsOf(workspace, id);
      const master = useMasterFieldsOf(workspace, target);
      const breakpoint = useCatalogSession((state) => state.breakpoint);
      const contract = useCatalogEditContract(target);
      // ADR-251: an items wrapper shows its group's `orientation` as its Direction.
      const ownerTarget = useMemo(
        () => orientationOwnerTargetOf(workspace, id),
        [id, contract],
      );
      const ownerContract = useCatalogEditContract(ownerTarget);
      // The drawn record follows every step and root replacement (breakpoint · project).
      const version = useCatalogLayoutVersion(workspace);
      const effective = useMemo(
        () => effectiveOf(workspace, id),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read per layout version
        [id, version],
      );
      return useMemo(() => {
        const props = Object.fromEntries(
          contract.fields.map((field) => [field.key, field.currentValue]),
        ) as Record<string, unknown>;
        if (ownerTarget)
          props.orientation = ownerContract.fields.find(
            (field) => field.key === "orientation",
          )?.currentValue;
        const fontSize = fontSizeOf(workspace, id ?? undefined);
        // An instance shows its component's values under its own (the render merges them so).
        const view = (fields: typeof own) =>
          fields
            ? catalogStyleView(catalogFieldsAt(fields, breakpoint), {
                fontSize,
              })
            : {};
        const fill = {
          ...(master ? catalogFillAt(master, breakpoint) : undefined),
          ...(own ? catalogFillAt(own, breakpoint) : undefined),
        };
        return {
          style:
            own || master
              ? {
                  ...view(master),
                  ...view(own),
                  ...(own ? catalogPlacementStyle(own.placement) : {}),
                }
              : undefined,
          effective,
          type: contract.type || undefined,
          size: typeof props.size === "string" ? props.size : undefined,
          sizing: Object.keys(fill).length ? fill : undefined,
          fills:
            catalogFillItems(own?.fills) ?? catalogFillItems(master?.fills),
          props,
          // The accent the token swatches resolve with: the node's, else an ancestor's.
          accentColor: accentOf(workspace, id),
        };
      }, [
        breakpoint,
        contract,
        id,
        own,
        master,
        ownerTarget,
        ownerContract,
        effective,
      ]);
    },
    readSelectedTarget(): StylesTargetSnapshot {
      const first = selection()[0];
      if (!first) return { id: null, type: undefined, style: {}, props: {} };
      const own = workspace.readModel.ownFields(first.target);
      const breakpoint = workspace.session.getSnapshot().breakpoint;
      const fontSize = fontSizeOf(workspace, first.identity);
      // An instance: its component's values under its own (as `useElementStyleContext` reads).
      const master = masterTargetOf(workspace, first.target);
      const view = (fields: typeof own) =>
        catalogStyleView(catalogFieldsAt(fields, breakpoint), { fontSize });
      const owned = propsOf(workspace, first.target);
      const ownerTarget = orientationOwnerTargetOf(workspace, first.identity);
      return {
        id: first.identity,
        type: owned.type,
        props: ownerTarget
          ? {
              ...owned.props,
              orientation: propsOf(workspace, ownerTarget).props.orientation,
            }
          : owned.props,
        style: {
          ...(master ? view(workspace.readModel.ownFields(master)) : {}),
          ...view(own),
          ...catalogPlacementStyle(own.placement),
        },
        effective: effectiveOf(workspace, first.identity),
      };
    },
    updateStyle: (property, value) => writeStyles({ [property]: value }),
    updateStyles: writeStyles,
    previewStyle(property, value) {
      const items = selection();
      endPreviews(new Set(items.map((item) => item.identity)));
      let writes;
      try {
        writes = catalogStyleWritesOf(
          { [property]: value },
          { fontSize: fontSizeOf(workspace, items[0]?.identity) },
        );
      } catch {
        return; // a value the typed field cannot hold mid-drag: the commit reports it
      }
      const patch = catalogStylePreviewPatch(writes);
      for (const item of items) {
        const record = workspace.root.domInputs.get(item.identity);
        if (!record) continue;
        // Left / Top of an absolutely placed node are its placement offsets.
        const offset =
          (property === "left" || property === "top") &&
          record.placement?.kind === "absolute"
            ? cssPx(value)
            : undefined;
        const placement =
          offset !== undefined && record.placement
            ? {
                ...record.placement,
                [property === "left" ? "x" : "y"]: offset,
              }
            : undefined;
        if (!placement && !Object.keys(patch).length) continue;
        const held = previewed.get(item.identity) ?? {};
        const next: CatalogRecordPreview = {
          ...held,
          visual: { ...held.visual, ...patch.visual },
          sizing: { ...held.sizing, ...patch.sizing },
          layout: { ...held.layout, ...patch.layout },
          ...((placement ?? held.placement)
            ? { placement: placement ?? held.placement }
            : {}),
        };
        previewed.set(item.identity, next);
        workspace.root.previewRecord(item.identity, next);
      }
    },
    updateProperty: (key, value) => writeProps({ [key]: value }),
    updateProperties: writeProps,
    updatePropertiesWithStyles: (patch, styles) =>
      run(() => {
        const commands = [propsCommandOf(patch), styleCommandOf(styles)].filter(
          (command): command is CatalogCommand => command !== undefined,
        );
        if (!commands.length) return undefined;
        return ((reader) => ({
          label: "Edit property",
          ops: commands.flatMap((command) => command(reader).ops),
        })) satisfies CatalogCommand;
      }),
    useParentId(id) {
      const version = useCatalogLayoutVersion(workspace);
      return useMemo(
        () => parentRecordOf(workspace, id)?.id ?? null,
        // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read per layout version
        [id, version],
      );
    },
    useParentLayout(id) {
      const version = useCatalogLayoutVersion(workspace);
      return useMemo(() => {
        const parent = parentRecordOf(workspace, id);
        if (!parent) return { display: "block", flexDirection: "row" };
        const box = catalogBoxModel(parent);
        return {
          display: box.display,
          flexDirection: box.flexDirection ?? "row",
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read per layout version
      }, [id, version]);
    },
    useLayoutValue(id, key) {
      return useCatalogLayoutValue(workspace, id, key);
    },
    applySizing(selectedId, edit) {
      run(() => {
        const items = selection();
        if (!items.length || items[0].identity !== selectedId) return undefined;
        return catalogSizingCommand({
          targets: items.map((item) => item.target),
          own: (target) => workspace.readModel.ownFields(target),
          breakpoint: workspace.session.getSnapshot().breakpoint,
          edit,
        });
      });
    },
    applyRatio(selectedId, value) {
      const items = selection();
      if (!items.length || items[0].identity !== selectedId)
        return "selection-changed";
      const identities = new Map(
        items.map((item) => [targetKey(item.target), item.identity]),
      );
      const command = catalogRatioCommand({
        graph: workspace.runtime.graph,
        targets: items.map((item) => item.target),
        own: (target) => workspace.readModel.ownFields(target),
        breakpoint: workspace.session.getSnapshot().breakpoint,
        value,
        measured: (target) => {
          const identity = identities.get(targetKey(target));
          return identity ? measured(identity) : undefined;
        },
      });
      if (typeof command === "string") return command;
      run(() => command);
      return null;
    },
    applyAbsolute(selectedId, on) {
      const items = selection();
      if (!items.length || items[0].identity !== selectedId)
        return "selection-changed";
      const command = catalogAbsoluteCommand({
        items,
        on,
        root: workspace.root,
        graph: workspace.runtime.graph,
        own: (target) => workspace.readModel.ownFields(target),
        newId: workspace.newId,
      });
      if (typeof command === "string") return command;
      run(() => command);
      return null;
    },
    readFills() {
      const first = selection()[0];
      return first ? fillsOf(first.target) : [];
    },
    updateFills(fills) {
      run(() => {
        const items = selection();
        if (!items.length) return undefined;
        // The panel built `fills` on the first element's layers: the others replay the change.
        const before = fillsOf(items[0].target);
        const commands = items.map((item, index) => {
          const next =
            index === 0
              ? fills
              : replayFillEdit(before, fills, fillsOf(item.target));
          return setWholeField({
            targets: [item.target],
            field: "fills",
            value: next.length ? catalogFillLayers(next) : [],
            label: "Fill",
          });
        });
        const derived = setFields({
          targets: items.map((item) => item.target),
          visual: Object.fromEntries(
            FILL_DERIVED_STYLE_PROPS.map((key) => [key, { kind: "remove" }]),
          ),
        });
        return (reader) => ({
          label: "Fill",
          ops: [
            ...commands.flatMap((command) => command(reader).ops),
            ...derived(reader).ops,
          ],
        });
      });
    },
    previewFills(fills) {
      const items = selection();
      endPreviews(new Set(items.map((item) => item.identity)));
      const before = items[0] ? fillsOf(items[0].target) : [];
      items.forEach((item, index) => {
        if (!workspace.root.domInputs.has(item.identity)) return;
        const next =
          index === 0
            ? fills
            : replayFillEdit(before, fills, fillsOf(item.target));
        const preview: CatalogRecordPreview = {
          ...previewed.get(item.identity),
          fills: next.length ? catalogFillLayers(next) : [],
          omitVisual: FILL_DERIVED_STYLE_PROPS,
        };
        previewed.set(item.identity, preview);
        workspace.root.previewRecord(item.identity, preview);
      });
    },
    cancelPreview: () => endPreviews(),
    resetFills() {
      run(() => {
        const targets = selection()
          .map((item) => item.target)
          .filter((target) => workspace.readModel.ownFields(target).fills);
        return targets.length
          ? setWholeField({
              targets,
              field: "fills",
              value: undefined,
              label: "Reset fill",
            })
          : undefined;
      });
    },
    useDirtyStyleProps(properties) {
      const id = useCatalogSession((state) => state.selection[0]?.identity);
      const breakpoint = useCatalogSession((state) => state.breakpoint);
      const { own } = useOwnFieldsOf(workspace, id ?? null);
      return useMemo(
        () => (own ? catalogDirtyStyleProps(own, breakpoint, properties) : []),
        [own, breakpoint, properties],
      );
    },
    resetStyles(properties) {
      run(() => {
        const items = selection();
        if (!items.length) return undefined;
        const breakpoint = workspace.session.getSnapshot().breakpoint;
        const commands: CatalogCommand[] = [];
        for (const { target } of items) {
          const reset = catalogResetStyleWrites(
            workspace.readModel.ownFields(target),
            breakpoint,
            properties,
          );
          if (!reset) continue;
          if (Object.keys(reset.writes).length)
            commands.push(
              setFields({
                targets: [target],
                ...(breakpoint === "desktop" ? {} : { breakpoint }),
                ...reset.writes,
              } as Parameters<typeof setFields>[0]),
            );
          if (reset.placement)
            commands.push(
              setWholeField({
                targets: [target],
                field: "placement",
                value: undefined,
              }),
            );
        }
        if (!commands.length) return undefined;
        return ((reader) => ({
          label: "Reset style",
          ops: commands.flatMap((command) => command(reader).ops),
        })) satisfies CatalogCommand;
      });
    },
    useResponsiveOverrides() {
      const id = useCatalogSession((state) => state.selection[0]?.identity);
      const breakpoint = useCatalogSession((state) => state.breakpoint);
      const { own } = useOwnFieldsOf(workspace, id ?? null);
      return useMemo(() => {
        const summary = own
          ? catalogResponsiveSummary(own, breakpoint, {
              fontSize: fontSizeOf(workspace, id),
            })
          : {
              activeOverrideValues: {},
              totalOverrideCount: 0,
              visibility: {},
              baseHidden: false,
            };
        const activeOverriddenProps = Object.keys(
          summary.activeOverrideValues,
        ).sort();
        return {
          activeBreakpoint: breakpoint,
          isBase: breakpoint === "desktop",
          activeOverriddenProps,
          activeOverrideCount: activeOverriddenProps.length,
          ...summary,
        };
      }, [own, breakpoint, id]);
    },
    setResponsiveOverride(property, enabled, seedDefaults) {
      run(() => {
        const breakpoint = workspace.session.getSnapshot().breakpoint;
        const items = selection();
        if (breakpoint === "desktop" || !items.length) return undefined;
        const longhands = SHORTHAND_TO_LONGHAND[property] ?? [property];
        const commands = items.map(({ target, identity }) => {
          const context = { fontSize: fontSizeOf(workspace, identity) };
          const css = enabled
            ? catalogOverrideSeed(
                workspace.readModel.ownFields(target),
                breakpoint,
                longhands,
                (key) =>
                  seedDefaults?.[key] ??
                  (key !== property ? seedDefaults?.[property] : undefined) ??
                  resolveEligibleSeedDefault(key),
                context,
              )
            : Object.fromEntries(longhands.map((key) => [key, ""]));
          return setFields({
            targets: [target],
            breakpoint,
            ...catalogStyleWritesOf(css, context),
          } as Parameters<typeof setFields>[0]);
        });
        return ((reader) => ({
          label: enabled ? "Add override" : "Remove override",
          ops: commands.flatMap((command) => command(reader).ops),
        })) satisfies CatalogCommand;
      });
    },
    setResponsiveVisibility(breakpoint, visible) {
      run(() => {
        const items = selection();
        if (breakpoint === "desktop" || !items.length) return undefined;
        const commands = items.map(({ target }) => {
          const next = {
            ...workspace.readModel.ownFields(target).visibility,
          };
          if (visible) delete next[breakpoint];
          else next[breakpoint] = false;
          return setWholeField({
            targets: [target],
            field: "visibility",
            value: Object.keys(next).length ? next : undefined,
          });
        });
        return ((reader) => ({
          label: visible ? "Show" : "Hide",
          ops: commands.flatMap((command) => command(reader).ops),
        })) satisfies CatalogCommand;
      });
    },
    useSelectedElement() {
      const id = useCatalogSession((state) => state.selection[0]?.identity);
      const context = host.useElementStyleContext(id ?? null);
      return useMemo(
        () =>
          id
            ? {
                id,
                type: context.type ?? "",
                properties: { ...context.props },
                style: context.style as SelectedElement["style"],
              }
            : null,
        [id, context],
      );
    },
    subpartStyleOwnerOf: (id) =>
      catalogSubpartOwnerType(
        workspace.runtime.graph,
        workspace.root.domInputs,
        id,
        "style",
      ),
    pagePosition: {
      usePosition: (selectedId) => {
        const key = useSyncExternalStore(
          (notify) => {
            const offSteps = workspace.runtime.subscribeSteps(() => notify());
            const offSession = workspace.session.subscribe(notify);
            return () => {
              offSteps();
              offSession();
            };
          },
          () => catalogPagePositionKey(workspace, selectedId),
        );
        return useMemo(
          () => (key ? (JSON.parse(key) as CatalogPagePosition) : null),
          [key],
        );
      },
      commit: (pageId, point) => {
        const command = catalogPageDropCommand(
          workspace.root,
          pageId as EntryId<"page">,
          point,
        );
        if (command) workspace.execute(command);
      },
    },
    documentColors: {
      subscribe: (listener) =>
        workspace.runtime.subscribeSteps(() => listener()),
      revision: () => workspace.runtime.graph.revision,
      read: () => catalogDocumentColorSources(workspace.runtime.graph),
    },
  };
  return host;
}

interface CatalogPagePosition {
  pageId: string;
  x: number;
  y: number;
  editable: boolean;
}

/**
 * The selected page body's frame position on the page canvas (rounded; `""` = not a page body).
 * Home is the flow origin and does not move (the old row's rule).
 */
function catalogPagePositionKey(
  workspace: CatalogWorkspace,
  selectedId: string | null,
): string {
  if (!selectedId) return "";
  if (workspace.root.domInputs.get(selectedId)?.parentId !== "catalog:root")
    return "";
  const pageId = workspace.pageOfRecord(selectedId);
  const rect = pageId && workspace.root.pageFrameRects().get(pageId);
  if (!pageId || !rect) return "";
  const graph = workspace.runtime.graph;
  const project = graph.getEntry(graph.projectId);
  const position: CatalogPagePosition = {
    pageId,
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    editable: project?.kind === "project" && project.pageIds[0] !== pageId,
  };
  return JSON.stringify(position);
}
