import { catalogReadPositionConstraint } from "../../../catalogRuntime/positionConstraint";
import { catalogIsOutOfFlow } from "../../../../../../../packages/shared/src/catalog/runtime/positioning";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  removeTargets,
  setFields,
  setWholeField,
} from "../../../../../../../packages/shared/src/catalog/commands";
import {
  stageOver,
  type CatalogCommand,
} from "../../../../../../../packages/shared/src/catalog/commands/compose";
import type {
  DefinitionId,
  EditTarget,
  EntryId,
  LayoutField,
  NodeId,
  WriteValue,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import { catalogColumnSizeFits } from "../../../../../../../packages/shared/src/catalog/document/valueType";
import {
  catalogColorWheelDiameter,
  catalogColorWheelSizeOfBox,
} from "../../../../../../../packages/shared/src/catalog/resolvers/resolveCatalogRuleCanvasBox";
import type { FillItem } from "../../../../types/builder/fill.types";
import {
  catalogFillItems,
  catalogFillLayers,
} from "../../../catalogRuntime/authoredStyle";
import { catalogBoxModel } from "../../../catalogRuntime/boxModel";
import { catalogPageDropCommand } from "../../../catalogRuntime/canvasPage";
import type { CatalogRecordPreview } from "../../../catalogRuntime/compositionRoot";
import { catalogDocumentColorSources } from "../../../catalogRuntime/documentColors";
import {
  catalogEditContract,
  catalogSemanticPatchCommand,
} from "../../../catalogRuntime/editContract";
import { catalogEffectiveStyle } from "../../../catalogRuntime/effectiveStyle";
import {
  gridItemsInRemovedTracks,
  gridLinesAfterTrackMove,
  gridLinesAfterTrackRemoval,
} from "../../../catalogRuntime/gridTrackEdit";
import {
  gridTrackList,
  gridTrackListTemplate,
  gridTrackWithLimit,
} from "../utils/gridTracks";
import {
  gridLayout,
  gridPlacement,
  lengthPx,
} from "../../../catalogRuntime/canvasGridCells";
import {
  catalogAbsoluteCommand,
  catalogPositionChangeCommand,
} from "../../../catalogRuntime/position";
import {
  useCatalogEditContract,
  useCatalogSession,
} from "../../../catalogRuntime/react";
import {
  catalogFieldsAt,
  catalogOverrideSeed,
  catalogResponsiveSummary,
} from "../../../catalogRuntime/responsiveFields";
import { targetKey } from "../../../catalogRuntime/session";
import {
  catalogFillAt,
  catalogRatioCommand,
  catalogSizingCommand,
} from "../../../catalogRuntime/sizing";
import {
  catalogDirtyStyleProps,
  catalogResetStyleWrites,
} from "../../../catalogRuntime/styleDirty";
import {
  catalogAuthoredValues,
  catalogStylePreviewPatch,
  CatalogStyleValueError,
  catalogStyleView,
  catalogStyleWritesOf,
} from "../../../catalogRuntime/styleFields";
import { catalogSubpartOwnerType } from "../../../catalogRuntime/subpart";
import type { CatalogWorkspace } from "../../../catalogRuntime/workspace";
import type { SelectedElement } from "../../../inspector/types";
import { notifyEditRefusal } from "../../../catalogRuntime/operationNotice";
import { useToastStore } from "../../../stores/toast";
import {
  resolveEligibleSeedDefault,
  SHORTHAND_TO_LONGHAND,
} from "../../../stores/utils/responsiveWriteRouting";
import type { ElementStyleContext } from "../hooks/useElementStyleContext";
import {
  useCatalogLayoutValue,
  useCatalogLayoutVersion,
} from "../hooks/useLayoutValue";
import type {
  StylesGridTrackEdit,
  StylesHost,
  StylesTargetSnapshot,
} from "../stylesHostContext";
import { FILL_DERIVED_STYLE_PROPS } from "../utils/fillDerivedStyleProps";
import { resolveElementFills } from "../utils/fillMigration";
import { isOwnerOrientationTag } from "../utils/orientationDrivenTags";
import { replayFillEdit } from "./fillEdit";

const noSubscription = () => () => {};

/** A record's own authored fields, following edits (the record's document target). */
function useOwnFieldsOf(workspace: CatalogWorkspace, id: string | null) {
  const target = useMemo(
    () => (id ? workspace.itemOfRecord(id)?.target : undefined),
    [workspace, id],
  );
  const subscribe = useCallback(
    (notify: () => void) =>
      target
        ? workspace.readModel.subscribeOwnFields(target, notify)
        : noSubscription(),
    [workspace, target],
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
    [workspace, target],
  );
  const subscribe = useCallback(
    (notify: () => void) =>
      master
        ? workspace.readModel.subscribeOwnFields(master, notify)
        : noSubscription(),
    [workspace, master],
  );
  return useSyncExternalStore(subscribe, () =>
    master ? workspace.readModel.ownFields(master) : undefined,
  );
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

/** ADR-257: a Column's Styles keys that are its S2 width props. */
const COLUMN_STYLE_PROPS: ReadonlySet<string> = new Set([
  "width",
  "minWidth",
  "maxWidth",
]);

/**
 * A Styles length as a Column width: "" · "auto" → none (undefined), "120" · "120px" → 120,
 * "25%" · "2fr" (not for min / max — `staticOnly`) as they are; anything else → null (refused).
 */
export function catalogColumnStyleValue(
  text: string,
  staticOnly: boolean,
): number | string | undefined | null {
  const trimmed = text.trim();
  if (trimmed === "" || trimmed === "auto") return undefined;
  const px = /^(\d+(?:\.\d+)?)(?:px)?$/.exec(trimmed);
  const value = px ? Number(px[1]) : trimmed;
  return catalogColumnSizeFits(value, staticOnly) ? value : null;
}

/**
 * ADR-258 후속: a ColorWheel's box is its S2 `size` (S2 sets the wheel's width/height from it over
 * any style) — its Styles width / height edit that prop. "" · "auto" → none (the default
 * diameter), "240" · "240px" → 240; anything else (%, fit-content …) → null (refused).
 */
export function catalogColorWheelStyleValue(
  text: string,
): number | undefined | null {
  const trimmed = text.trim();
  if (trimmed === "" || trimmed === "auto") return undefined;
  const px = /^(\d+(?:\.\d+)?)(?:px)?$/.exec(trimmed);
  return px
    ? (catalogColorWheelSizeOfBox(Number(px[1]), undefined) ?? null)
    : null;
}

/** ADR-258 후속: a ColorWheel's Styles keys that are its `size`. */
const COLOR_WHEEL_STYLE_PROPS: ReadonlySet<string> = new Set([
  "width",
  "height",
]);

/** A ColorWheel shows its diameter as its width and height (the box both consumers draw). */
const colorWheelStyle = (props: Record<string, unknown>) => {
  const diameter = `${catalogColorWheelDiameter(props.size)}px`;
  return { width: diameter, height: diameter };
};

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
   * What a drag previews per record (keys of successive previews add up while the preview is on
   * the record — a step that planned it, or a gesture let go without a commit, starts afresh); an
   * edit or another selection puts the records' own values back.
   */
  const previewed = new Map<string, CatalogRecordPreview>();
  const heldPreview = (id: string): CatalogRecordPreview | undefined =>
    workspace.root.previewing(id) ? previewed.get(id) : undefined;
  /** Counts the ends of drags (a commit, a cancel): a preview waiting for its frame is stale. */
  let previewEpoch = 0;
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
      if (notifyEditRefusal(error)) return;
      useToastStore
        .getState()
        .showToast(
          "error",
          error instanceof CatalogStyleValueError || error instanceof Error
            ? error.message
            : String(error),
        );
    } finally {
      previewEpoch += 1;
      endPreviews();
    }
  };
  /** The selection's (or `subset`'s) style edit as one command (undefined = nothing to write). */
  /**
   * A track with no item that becomes Hug keeps its drawn size as its minimum (CSS `auto` of an
   * empty track is 0 — it would collapse and the label read 「0 Hug」).
   */
  const emptyHugKeepsSize = (
    gridId: string,
    edits: readonly StylesGridTrackEdit[],
  ): readonly StylesGridTrackEdit[] => {
    if (!edits.some((edit) => edit.hugged?.length)) return edits;
    const records = workspace.root.domInputs;
    const grid = records.get(gridId);
    const rect = grid && workspace.root.getGeometry([gridId]).get(gridId);
    if (!grid || !rect) return edits;
    const flow = grid.children.filter((child) => {
      const record = records.get(child);
      return !!record && !catalogIsOutOfFlow(record);
    });
    const boxes = workspace.root.getGeometry(flow);
    const model = catalogBoxModel(grid);
    const n = (value: unknown) => (typeof value === "number" ? value : 0);
    const border = n(model.borderWidth);
    const left = border + n(model.padding?.left);
    const top = border + n(model.padding?.top);
    const gap = lengthPx(model.gap) ?? 0;
    const layout = gridLayout({
      content: {
        x: rect.x + left,
        y: rect.y + top,
        width: Math.max(
          0,
          rect.width - left - border - n(model.padding?.right),
        ),
        height: Math.max(
          0,
          rect.height - top - border - n(model.padding?.bottom),
        ),
      },
      columns: grid.layout.gridTemplateColumns as string | undefined,
      rows: grid.layout.gridTemplateRows as string | undefined,
      columnGap: lengthPx(grid.layout.columnGap) ?? gap,
      rowGap: lengthPx(grid.layout.rowGap) ?? gap,
      items: flow.map(
        (child) => boxes.get(child) ?? { x: 0, y: 0, width: 0, height: 0 },
      ),
      lines: flow.map((child) => {
        const itemLayout = records.get(child)!.layout;
        return {
          column: itemLayout.gridColumnStart,
          row: itemLayout.gridRowStart,
          columnEnd: itemLayout.gridColumnEnd,
          rowEnd: itemLayout.gridRowEnd,
        };
      }),
      fallbackHeight: 0,
      appendRow: false,
    });
    return edits.map((edit) => {
      if (!edit.hugged?.length) return edit;
      const tracks = gridTrackList(edit.template);
      const sizes =
        edit.axis === "column" ? layout.tracks.columns : layout.tracks.rows;
      if (!tracks) return edit;
      let changed = false;
      for (const index of edit.hugged) {
        const track = tracks[index];
        const size = sizes[index]?.size;
        const taken = layout.areas.some((area) =>
          edit.axis === "column"
            ? index >= area.column && index < area.column + area.columnSpan
            : index >= area.row && index < area.row + area.rowSpan,
        );
        if (!track || taken || !size || track.kind !== "hug") continue;
        tracks[index] = gridTrackWithLimit(track, "min", Math.round(size));
        changed = true;
      }
      return changed
        ? { ...edit, template: gridTrackListTemplate(tracks) }
        : edit;
    });
  };

  const styleCommandOf = (
    styles: Record<string, string>,
    subset?: ReturnType<typeof selection>,
  ): CatalogCommand | undefined => {
    {
      const items = subset ?? selection();
      if (!items.length || !Object.keys(styles).length) return undefined;
      const targets = items.map((item) => item.target);
      // Left · Top · Right · Bottom are layout insets for every box (ADR-275 — an authored absolute
      // box's position too).
      let fields = styles;
      const commands: CatalogCommand[] = [];
      // ADR-275 사용자 결정 2 — an absolute box's Center axis owns its margins: a margin value on
      // that axis is refused here too (the Canvas spacing handles and style paste use this path).
      for (const item of items) {
        const record = workspace.root.domInputs.get(item.identity);
        if (record?.layout.position !== "absolute") continue;
        const constraint = catalogReadPositionConstraint(record.layout);
        for (const [key, value] of Object.entries(styles)) {
          if (String(value).trim() === "") continue;
          const axis =
            key === "marginLeft" || key === "marginRight"
              ? "x"
              : key === "marginTop" || key === "marginBottom"
                ? "y"
                : key === "margin"
                  ? constraint.x === "center"
                    ? "x"
                    : "y"
                  : undefined;
          if (axis && constraint[axis] === "center")
            throw new CatalogStyleValueError(key, value);
        }
      }
      // ADR-257 사용자 결정 2: a Column's Styles width · min · max is its S2 column width (the
      // column's track in every row of its Table), not its own box.
      if (
        items.every((item) => propsOf(workspace, item.target).type === "Column")
      ) {
        const patch: Record<string, unknown> = {};
        const others: Record<string, string> = {};
        for (const [key, text] of Object.entries(fields)) {
          if (!COLUMN_STYLE_PROPS.has(key)) {
            others[key] = text;
            continue;
          }
          const value = catalogColumnStyleValue(text, key !== "width");
          if (value === null) throw new CatalogStyleValueError(key, text);
          patch[key] = value;
        }
        if (Object.keys(patch).length) {
          const command = catalogSemanticPatchCommand(
            targets,
            patch,
            (key) => workspace.readModel.propSource(targets[0]!, key).value,
          );
          if (command) commands.push(command);
        }
        fields = others;
      }
      // ADR-258 후속: a ColorWheel's Styles width · height is its S2 `size` (the diameter).
      if (
        items.every(
          (item) => propsOf(workspace, item.target).type === "ColorWheel",
        )
      ) {
        const others: Record<string, string> = {};
        const box: { width?: number; height?: number } = {};
        let edited = false;
        for (const [key, text] of Object.entries(fields)) {
          if (!COLOR_WHEEL_STYLE_PROPS.has(key)) {
            others[key] = text;
            continue;
          }
          const value = catalogColorWheelStyleValue(text);
          if (value === null) throw new CatalogStyleValueError(key, text);
          box[key as "width" | "height"] = value;
          edited = true;
        }
        if (edited) {
          const command = catalogSemanticPatchCommand(
            targets,
            { size: catalogColorWheelSizeOfBox(box.width, box.height) },
            (key) => workspace.readModel.propSource(targets[0]!, key).value,
          );
          if (command) commands.push(command);
        }
        fields = others;
      }
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

  /** One selection item as the style actions read it (authored at the breakpoint, effective record). */
  const snapshotOf = (
    first: ReturnType<typeof selection>[number],
  ): StylesTargetSnapshot => {
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
        // ADR-257: a Column's width fields show its S2 width props (what its Styles edit writes).
        ...(owned.type === "Column"
          ? Object.fromEntries(
              [...COLUMN_STYLE_PROPS].flatMap((key) => {
                const value = owned.props[key];
                return typeof value === "number"
                  ? [[key, `${value}px`]]
                  : typeof value === "string"
                    ? [[key, value]]
                    : [];
              }),
            )
          : {}),
        ...(owned.type === "ColorWheel" ? colorWheelStyle(owned.props) : {}),
      },
      effective: effectiveOf(workspace, first.identity),
    };
  };

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
        [id],
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
                  ...(contract.type === "ColorWheel"
                    ? colorWheelStyle(props)
                    : {}),
                }
              : undefined,
          effective,
          type: contract.type || undefined,
          size: typeof props.size === "string" ? props.size : undefined,
          sizing: Object.keys(fill).length ? fill : undefined,
          fills:
            catalogFillItems(own?.fills) ?? catalogFillItems(master?.fills),
          props,
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
      return snapshotOf(first);
    },
    updateFlexStyles(styles) {
      const items = selection();
      if (!items.length) return;
      // Each target keeps its own `inline-flex` (authored, else the drawn record's): `flex` would turn
      // its outer box block and drop it to its own line. Any other display becomes `flex`.
      const keeps = items.map((item) => {
        const { style, effective } = snapshotOf(item);
        const display =
          typeof style.display === "string" && style.display
            ? style.display
            : effective?.display;
        return display === "inline-flex";
      });
      if (keeps.every((keep) => keep === keeps[0])) {
        host.updateStyles(keeps[0] ? styles : { display: "flex", ...styles });
        return;
      }
      run(() => {
        const commands = [
          styleCommandOf(
            styles,
            items.filter((_, index) => keeps[index]),
          ),
          styleCommandOf(
            { display: "flex", ...styles },
            items.filter((_, index) => !keeps[index]),
          ),
        ].filter((command): command is CatalogCommand => !!command);
        if (!commands.length) return undefined;
        return ((reader) => ({
          label: "Edit style",
          ops: commands.flatMap((command) => command(reader).ops),
        })) satisfies CatalogCommand;
      });
    },
    updateStyle: (property, value) => writeStyles({ [property]: value }),
    updateStyles: writeStyles,
    previewStyle(property, value) {
      const items = selection();
      endPreviews(new Set(items.map((item) => item.identity)));
      for (const item of items) {
        const record = workspace.root.domInputs.get(item.identity);
        if (!record) continue;
        let writes;
        try {
          // (The record's own values, as the commit reads them: a border companion fills only an
          // axis the node does not have — a width drag kept the default grey color and a color
          // pick the default 1px width otherwise, 2026-10-15.)
          writes = catalogStyleWritesOf(
            { [property]: value },
            {
              fontSize: fontSizeOf(workspace, item.identity),
              visual: record.visual,
            },
          );
        } catch {
          continue; // a value the typed field cannot hold mid-drag: the commit reports it
        }
        const patch = catalogStylePreviewPatch(writes);
        if (!Object.keys(patch).length) continue;
        const held = heldPreview(item.identity) ?? {};
        const next: CatalogRecordPreview = {
          ...held,
          visual: { ...held.visual, ...patch.visual },
          sizing: { ...held.sizing, ...patch.sizing },
          layout: { ...held.layout, ...patch.layout },
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
        // (A `display: contents` parent — a RAC trigger · Autocomplete — has no box: its children
        // are its own parent's items, as in CSS.)
        let parent = parentRecordOf(workspace, id);
        let box = parent && catalogBoxModel(parent);
        while (parent && box?.display === "contents") {
          parent = parentRecordOf(workspace, parent.id);
          box = parent && catalogBoxModel(parent);
        }
        if (!parent || !box) return { display: "block", flexDirection: "row" };
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
        // ADR-258 후속: a ColorWheel's width · height is its `size` — a length or a reset writes
        // it; Fill has no meaning for the diameter square (refused, as S2 sizes it from `size`).
        if (
          items.every(
            (item) => propsOf(workspace, item.target).type === "ColorWheel",
          )
        ) {
          const value =
            edit.mode === "reset"
              ? undefined
              : edit.mode === "css"
                ? catalogColorWheelStyleValue(edit.value ?? "")
                : null;
          if (value === null)
            throw new CatalogStyleValueError(
              edit.axis,
              edit.value ?? edit.mode,
            );
          const targets = items.map((item) => item.target);
          return (
            catalogSemanticPatchCommand(
              targets,
              { size: value },
              (key) => workspace.readModel.propSource(targets[0]!, key).value,
            ) ?? undefined
          );
        }
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
    applyAbsolute(selectedId, on, position) {
      const items = selection();
      if (!items.length || items[0].identity !== selectedId)
        return "selection-changed";
      const command = catalogAbsoluteCommand({
        items,
        on,
        ...(position ? { position } : {}),
        breakpoint: workspace.session.getSnapshot().breakpoint,
        root: workspace.root,
        graph: workspace.runtime.graph,
        own: (target) => workspace.readModel.ownFields(target),
        newId: workspace.newId,
      });
      if (typeof command === "string") return command;
      run(() => command);
      return null;
    },
    applyPosition(selectedId, change) {
      const items = selection();
      if (!items.length || items[0].identity !== selectedId)
        return "selection-changed";
      const command = catalogPositionChangeCommand({
        items,
        change,
        breakpoint: workspace.session.getSnapshot().breakpoint,
        root: workspace.root,
      });
      if (typeof command === "string") return command;
      if (command) run(() => command);
      return null;
    },
    applyGridTracks(selectedId, requested) {
      run(() => {
        const items = selection();
        if (items.length !== 1 || items[0].identity !== selectedId)
          return undefined;
        const edits = emptyHugKeepsSize(items[0].identity, requested);
        const template_ = styleCommandOf(
          Object.fromEntries(
            edits.map((edit) => [
              edit.axis === "column"
                ? "gridTemplateColumns"
                : "gridTemplateRows",
              edit.template,
            ]),
          ),
          items,
        );
        if (!template_) return undefined;
        const commands: CatalogCommand[] = [template_];
        const records = workspace.root.domInputs;
        const breakpoint = workspace.session.getSnapshot().breakpoint;
        const clear: WriteValue<string> =
          breakpoint === "desktop"
            ? { kind: "remove" }
            : { kind: "set", value: "auto" };
        const children = edits.some(
          (edit) => edit.removed.length || edit.order || edit.hugged?.length,
        )
          ? (records.get(items[0].identity)?.children ?? [])
          : [];
        // A track delete removes the items only in it (Figma), placed as CSS places them.
        const flow = children.filter((child) => {
          const record = records.get(child);
          return !!record && !catalogIsOutOfFlow(record);
        });
        const deleted = new Set<string>();
        const deletes = edits.filter((edit) => edit.deleteContents);
        if (deletes.length) {
          const gridLayout = records.get(items[0].identity)?.layout;
          const columns =
            gridTrackList(String(gridLayout?.gridTemplateColumns ?? ""))
              ?.length ?? 1;
          const removedOf = (axis: "column" | "row") =>
            deletes.find((edit) => edit.axis === axis)?.removed;
          for (const index of gridItemsInRemovedTracks(
            flow.map((child) => {
              const layout = records.get(child)!.layout;
              return {
                column: layout.gridColumnStart,
                row: layout.gridRowStart,
                columnEnd: layout.gridColumnEnd,
                rowEnd: layout.gridRowEnd,
              };
            }),
            columns,
            { column: removedOf("column"), row: removedOf("row") },
          ))
            deleted.add(flow[index]!);
        }
        for (const child of children) {
          if (deleted.has(child)) continue;
          const record = records.get(child);
          const item = workspace.itemOfRecord(child);
          if (!record || !item || catalogIsOutOfFlow(record)) continue;
          const layout: Partial<Record<LayoutField, WriteValue<string>>> = {};
          for (const { axis, removed, order } of edits) {
            const startKey =
              axis === "column" ? "gridColumnStart" : "gridRowStart";
            const endKey = axis === "column" ? "gridColumnEnd" : "gridRowEnd";
            const lines = {
              start: record.layout[startKey],
              end: record.layout[endKey],
            };
            const edit = order
              ? gridLinesAfterTrackMove(lines, order)
              : gridLinesAfterTrackRemoval(lines, removed);
            if (!edit) continue;
            if (edit.start !== undefined)
              layout[startKey] =
                edit.start === null
                  ? clear
                  : { kind: "set", value: String(edit.start) };
            if (edit.span !== undefined)
              layout[endKey] =
                edit.span === null
                  ? clear
                  : { kind: "set", value: `span ${edit.span}` };
          }
          if (Object.keys(layout).length)
            commands.push(
              setFields({ targets: [item.target], breakpoint, layout }),
            );
        }
        // A track that becomes Hug (Figma): its items that filled it keep their drawn size.
        const hugs = edits.filter((edit) => edit.hugged?.length);
        if (hugs.length) {
          const gridLayout = records.get(items[0].identity)?.layout;
          const columns =
            gridTrackList(String(gridLayout?.gridTemplateColumns ?? ""))
              ?.length ?? 1;
          const { cells } = gridPlacement(
            flow.map((child) => {
              const layout = records.get(child)!.layout;
              return {
                column: layout.gridColumnStart,
                row: layout.gridRowStart,
                columnEnd: layout.gridColumnEnd,
                rowEnd: layout.gridRowEnd,
              };
            }),
            columns,
          );
          const geometry = workspace.root.getGeometry(flow);
          flow.forEach((child, index) => {
            const area = cells[index];
            const record = records.get(child);
            const item = workspace.itemOfRecord(child);
            const rect = geometry.get(child);
            if (!area || !record || !item || !rect) return;
            const styles: Record<string, string> = {};
            for (const { axis, hugged } of hugs) {
              const [start, span, key, size] =
                axis === "column"
                  ? [area.column, area.columnSpan, "width", rect.width]
                  : [area.row, area.rowSpan, "height", rect.height];
              if (span !== 1 || !hugged!.includes(start)) continue;
              if (typeof record.sizing?.[key] === "number") continue;
              styles[key] = `${Math.round(size)}px`;
            }
            const command = Object.keys(styles).length
              ? styleCommandOf(styles, [item])
              : undefined;
            if (command) commands.push(command);
          });
        }
        const removedTargets = [...deleted].flatMap((child) => {
          const item = workspace.itemOfRecord(child);
          return item ? [item.target] : [];
        });
        if (removedTargets.length)
          commands.push(
            removeTargets({ targets: removedTargets, newId: workspace.newId }),
          );
        return ((reader) => {
          // Each write plans on the ones before it (a breakpoint layer is a whole-field put).
          const stage = stageOver(reader);
          const ops = commands.flatMap((command) => {
            const plan = command(stage);
            stage.apply(plan.ops);
            return plan.ops;
          });
          return { label: "Edit grid", ops };
        }) satisfies CatalogCommand;
      });
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
          ...heldPreview(item.identity),
          fills: next.length ? catalogFillLayers(next) : [],
          omitVisual: FILL_DERIVED_STYLE_PROPS,
        };
        previewed.set(item.identity, preview);
        workspace.root.previewRecord(item.identity, preview);
      });
    },
    cancelPreview() {
      previewEpoch += 1;
      endPreviews();
    },
    previewEpoch: () => previewEpoch,
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
