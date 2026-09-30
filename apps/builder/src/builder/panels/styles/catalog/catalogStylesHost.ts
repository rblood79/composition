import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { BreakpointName } from "@composition/shared";
import { setFields } from "../../../../../../../packages/shared/src/catalog/commands";
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
  type CatalogStyleFields,
} from "../../../catalogRuntime/styleFields";
import type { CatalogWorkspace } from "../../../catalogRuntime/workspace";
import { catalogBoxModel } from "../../../catalogRuntime/boxModel";
import {
  catalogFillAt,
  catalogRatioCommand,
  catalogSizingCommand,
} from "../../../catalogRuntime/sizing";
import type { OwnFields } from "../../../../../../../packages/shared/src/catalog/resolution/fieldSource";
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

/** The drawn parent record of a record (`null` at a page body or the page grid). */
function parentRecordOf(workspace: CatalogWorkspace, id: string | null) {
  const parentId = id ? workspace.root.domInputs.get(id)?.parentId : undefined;
  return parentId ? workspace.root.domInputs.get(parentId) : undefined;
}

/** The authored fields at a breakpoint: the base layer with that layer's writes over it. */
export function catalogFieldsAt(
  own: OwnFields,
  breakpoint: BreakpointName,
): CatalogStyleFields {
  const layer =
    breakpoint === "desktop" ? undefined : own.responsive?.[breakpoint];
  return {
    visual: {
      ...catalogAuthoredValues(own.visual),
      ...catalogAuthoredValues(layer?.visual),
    },
    layout: {
      ...catalogAuthoredValues(own.layout),
      ...catalogAuthoredValues(layer?.layout),
    },
    sizing: {
      ...catalogAuthoredValues(own.sizing),
      ...catalogAuthoredValues(layer?.sizing),
    },
  };
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
      const breakpoint = workspace.session.getSnapshot().breakpoint;
      return setFields({
        targets: items.map((item) => item.target),
        ...(breakpoint === "desktop" ? {} : { breakpoint }),
        ...catalogStyleWritesOf(styles, {
          fontSize: fontSizeOf(workspace, items[0].identity),
        }),
        label: "Edit style",
      } as Parameters<typeof setFields>[0]);
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

  return {
    useSelectedId: () =>
      useCatalogSession((state) => state.selection[0]?.identity ?? null),
    useActiveBreakpoint: () => useCatalogSession((state) => state.breakpoint),
    useElementStyleContext(id: string | null): ElementStyleContext {
      const target = useMemo(
        () => (id ? workspace.itemOfRecord(id)?.target : undefined),
        [id],
      );
      const breakpoint = useCatalogSession((state) => state.breakpoint);
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
      const contract = useCatalogEditContract(target);
      return useMemo(() => {
        const props = Object.fromEntries(
          contract.fields.map((field) => [field.key, field.currentValue]),
        ) as Record<string, unknown>;
        return {
          style: own
            ? catalogStyleView(catalogFieldsAt(own, breakpoint), {
                fontSize: fontSizeOf(workspace, id ?? undefined),
              })
            : undefined,
          type: contract.type || undefined,
          size: typeof props.size === "string" ? props.size : undefined,
          sizing: own ? catalogFillAt(own, breakpoint) : undefined,
          fills: undefined,
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
        style: catalogStyleView(
          catalogFieldsAt(own, workspace.session.getSnapshot().breakpoint),
          { fontSize: fontSizeOf(workspace, first.identity) },
        ),
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
    presentation: false,
  };
}
