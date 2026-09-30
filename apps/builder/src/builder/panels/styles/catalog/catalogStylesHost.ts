import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  setFields,
  setWholeField,
} from "../../../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../../../packages/shared/src/catalog/commands/compose";
import type { EditTarget } from "../../../../../../../packages/shared/src/catalog/document/types";
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
  CatalogStyleValueError,
  catalogStyleView,
  catalogStyleWritesOf,
} from "../../../catalogRuntime/styleFields";
import type { CatalogWorkspace } from "../../../catalogRuntime/workspace";
import { catalogBoxModel } from "../../../catalogRuntime/boxModel";
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
import type { ElementStyleContext } from "../hooks/useElementStyleContext";
import type { StylesHost, StylesTargetSnapshot } from "../stylesHostContext";

const noSubscription = () => () => {};

/** Re-read after every published step and breakpoint switch (layout and records follow them). */
function useLayoutVersion(workspace: CatalogWorkspace): string {
  const subscribe = useCallback(
    (notify: () => void) => {
      const offSteps = workspace.runtime.subscribeSteps(notify);
      const offRoot = workspace.subscribeRoot(notify);
      return () => {
        offSteps();
        offRoot();
      };
    },
    [workspace],
  );
  return useSyncExternalStore(
    subscribe,
    () => `${workspace.runtime.graph.revision}:${workspace.root.breakpoint}`,
  );
}

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

/** The drawn parent record of a record (`null` at a page body or the page grid). */
function parentRecordOf(workspace: CatalogWorkspace, id: string | null) {
  const parentId = id ? workspace.root.domInputs.get(id)?.parentId : undefined;
  return parentId ? workspace.root.domInputs.get(parentId) : undefined;
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
 * typed field cannot hold is refused with a toast. Live drag previews and the old Canvas
 * presentation channel are not used (the edit lands on release).
 */
export function createCatalogStylesHost(
  workspace: CatalogWorkspace,
): StylesHost {
  const selection = () => workspace.session.getSnapshot().selection;
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
    }
  };
  const writeStyles = (styles: Record<string, string>) =>
    run(() => {
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
            }),
            label: "Edit style",
          } as Parameters<typeof setFields>[0]),
        );
      }
      return ((reader) => ({
        label: "Edit style",
        ops: commands.flatMap((command) => command(reader).ops),
      })) satisfies CatalogCommand;
    });
  const measured = (identity: string) =>
    workspace.root.getGeometry([identity]).get(identity);
  const writeProps = (patch: Record<string, unknown>) =>
    run(() => {
      const items = selection();
      const first = items[0];
      if (!first) return undefined;
      return (
        catalogSemanticPatchCommand(
          items.map((item) => item.target),
          patch,
          (key) => workspace.readModel.propSource(first.target, key).value,
        ) ?? undefined
      );
    });

  const host: StylesHost = {
    useSelectedId: () =>
      useCatalogSession((state) => state.selection[0]?.identity ?? null),
    useActiveBreakpoint: () => useCatalogSession((state) => state.breakpoint),
    useElementStyleContext(id: string | null): ElementStyleContext {
      const { target, own } = useOwnFieldsOf(workspace, id);
      const breakpoint = useCatalogSession((state) => state.breakpoint);
      const contract = useCatalogEditContract(target);
      return useMemo(() => {
        const props = Object.fromEntries(
          contract.fields.map((field) => [field.key, field.currentValue]),
        ) as Record<string, unknown>;
        return {
          style: own
            ? {
                ...catalogStyleView(catalogFieldsAt(own, breakpoint), {
                  fontSize: fontSizeOf(workspace, id ?? undefined),
                }),
                ...catalogPlacementStyle(own.placement),
              }
            : undefined,
          type: contract.type || undefined,
          size: typeof props.size === "string" ? props.size : undefined,
          sizing: own ? catalogFillAt(own, breakpoint) : undefined,
          fills: catalogFillItems(own?.fills),
          props,
          accentColor: undefined,
        };
      }, [breakpoint, contract, id, own]);
    },
    readSelectedTarget(): StylesTargetSnapshot {
      const first = selection()[0];
      if (!first) return { id: null, type: undefined, style: {}, props: {} };
      const own = workspace.readModel.ownFields(first.target);
      return {
        id: first.identity,
        ...propsOf(workspace, first.target),
        style: {
          ...catalogStyleView(
            catalogFieldsAt(own, workspace.session.getSnapshot().breakpoint),
            { fontSize: fontSizeOf(workspace, first.identity) },
          ),
          ...catalogPlacementStyle(own.placement),
        },
      };
    },
    updateStyle: (property, value) => writeStyles({ [property]: value }),
    updateStyles: writeStyles,
    previewStyle: () => {},
    updateProperty: (key, value) => writeProps({ [key]: value }),
    updateProperties: writeProps,
    useParentId(id) {
      const version = useLayoutVersion(workspace);
      return useMemo(
        () => parentRecordOf(workspace, id)?.id ?? null,
        // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read per layout version
        [id, version],
      );
    },
    useParentLayout(id) {
      const version = useLayoutVersion(workspace);
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
      const version = useLayoutVersion(workspace);
      return useMemo(
        () => (id ? measured(id)?.[key] : undefined),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read per layout version
        [id, key, version],
      );
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
      if (!first) return [];
      const own = workspace.readModel.ownFields(first.target);
      const background = catalogAuthoredValues(own.visual).backgroundColor;
      return resolveElementFills({
        fills: catalogFillItems(own.fills) as FillItem[] | undefined,
        props: {
          style: {
            backgroundColor:
              typeof background === "string" ? background : undefined,
          },
        },
      });
    },
    updateFills(fills) {
      run(() => {
        const targets = selection().map((item) => item.target);
        if (!targets.length) return undefined;
        const paint = setWholeField({
          targets,
          field: "fills",
          value: fills.length ? catalogFillLayers(fills) : [],
          label: "Fill",
        });
        const derived = setFields({
          targets,
          visual: Object.fromEntries(
            FILL_DERIVED_STYLE_PROPS.map((key) => [key, { kind: "remove" }]),
          ),
        });
        return (reader) => ({
          label: "Fill",
          ops: [...paint(reader).ops, ...derived(reader).ops],
        });
      });
    },
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
    presentation: false,
  };
  return host;
}
