import "fake-indexeddb/auto";
import { act, render } from "@testing-library/react";
import { CatalogGraph } from "../../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  AuthoredValue,
  CatalogLibrary,
  InteractionEntry,
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
} from "../../../../../../../packages/shared/src/catalog/commands";
import { CatalogPreviewChannel } from "../../../../builder/catalogRuntime/previewChannel";
import { NullLayoutEngine } from "../../../../builder/catalogRuntime/nullLayoutEngine";
import { newCatalogProjectDocument } from "../../../../builder/catalogRuntime/project";
import { CatalogStorage } from "../../../../builder/catalogRuntime/storage";
import { catalogThemeState } from "../../../../builder/catalogRuntime/theme";
import { CatalogWorkspace } from "../../../../builder/catalogRuntime/workspace";
import { nodeLayoutEngine } from "../../../../builder/catalogRuntime/__tests__/support/nodeLayoutEngine";
import { catalogPaletteDefinitionId } from "../../../../builder/catalogRuntime/paletteInsert";
import {
  catalogInteractionsCommand,
  catalogNewInteraction,
} from "../../../../builder/catalogRuntime/interactions";
import {
  catalogPreviewRuntime,
  CatalogPreviewView,
} from "../../catalogPreviewApp";
import { CatalogPreviewSession } from "../../catalogPreviewSession";

/**
 * ADR-280 — the whole Preview path in one place: a Builder workspace, its Preview session over the
 * channel and the rendered Preview. A rule goes in as a document interaction (the Interactions
 * panel's command) and runs through the shared dispatcher, exactly as in the Preview iframe.
 */
const BODY = "project:node:home-body" as NodeId;
const HOME = "project:page:home" as EntryId<"page">;

let library: CatalogLibrary | undefined;

// (jsdom has no ResizeObserver — the TagGroup's row measure uses one.)
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
// (jsdom has no IntersectionObserver — RAC's `*LoadMoreItem` sentinel watches with one; a test that
// needs it seen stubs its own.)
globalThis.IntersectionObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
} as unknown as typeof IntersectionObserver;
// (jsdom has no Web Animations — RAC's Tabs indicator asks for them.)
Element.prototype.getAnimations ??= () => [];

export async function openAdr280Preview(
  types: readonly string[],
  /** ADR-281 — the session's theme hooks (`applyTheme` sees the color mode a rule sets). */
  sessionOptions: {
    applyTheme?: (state: ReturnType<typeof catalogThemeState>) => void;
  } = {},
) {
  library ??= await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr280" as EntryId<"project">,
        name: "ADR-280",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr280-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
      theme: catalogThemeState,
    },
  );
  const ids = types.map(
    (type, index) => `project:node:${type.toLowerCase()}-${index}` as NodeId,
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: types.map(
        (type, index) =>
          ({
            kind: "node",
            id: ids[index]!,
            definitionId: catalogPaletteDefinitionId(library!, type),
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
          }) as NodeEntry,
      ),
      rootIds: ids,
      newId: workspace.newId,
    }),
  );
  const flushes: (() => void)[] = [];
  const session: CatalogPreviewSession = new CatalogPreviewSession(library, {
    requestSnapshot: (request) =>
      channel.onPreviewMessage(structuredClone(request)),
    engine: () => new NullLayoutEngine(),
    viewport: { width: 1000, height: 800 },
    stateStorage: null,
    ...(sessionOptions.applyTheme
      ? { theme: catalogThemeState, applyTheme: sessionOptions.applyTheme }
      : {}),
  });
  const channel = new CatalogPreviewChannel(workspace.runtime, {
    post: (message) => session.receive(structuredClone(message)),
    schedule: (flush) => flushes.push(flush),
  });
  const flush = () => act(() => flushes.splice(0).forEach((run) => run()));
  channel.setView(HOME);
  channel.onReady();
  const toasts: string[] = [];
  const runtime = catalogPreviewRuntime(session, {
    show: (message) => toasts.push(message),
  });
  const view = render(
    <CatalogPreviewView session={session} runtime={runtime} />,
  );

  /** Declare props on a node (the Properties panel's edit), then deliver it to the Preview. */
  const declare = (id: NodeId, props: Record<string, AuthoredValue>) => {
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id }],
        props: Object.fromEntries(
          Object.entries(props).map(([key, value]) => [
            key,
            { kind: "set" as const, value },
          ]),
        ),
        label: "Edit properties",
      }),
    );
    flush();
  };
  /** One rule on `ownerId`'s `trigger` (the Interactions panel's command). */
  const rule = (
    ownerId: NodeId,
    trigger: string,
    action: InteractionEntry["action"],
  ) => {
    const owner = { ownerId };
    workspace.execute(
      catalogInteractionsCommand(
        owner,
        [catalogNewInteraction(owner, trigger, action, workspace.newId)],
        "Rules",
      ),
    );
    flush();
  };
  /** The Preview element drawing a node (its root record). */
  const element = (id: NodeId) =>
    view.container.querySelector(
      `[data-catalog-id$="::${id}"]`,
    ) as HTMLElement | null;

  return {
    workspace,
    session,
    runtime,
    view,
    flush,
    ids,
    toasts,
    declare,
    rule,
    element,
  };
}
