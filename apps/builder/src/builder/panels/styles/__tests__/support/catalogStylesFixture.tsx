import "fake-indexeddb/auto";
import type { ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import type { BreakpointName } from "@composition/shared";
import { CatalogGraph } from "../../../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../../../packages/shared/src/catalog/commands";
import { definitionTypeName } from "../../../../../../../../packages/shared/src/catalog/commands/context";
import type { FillItem } from "../../../../../types/builder/fill.types";
import { catalogComponentCommands } from "../../../../catalogRuntime/componentActions";
import { catalogPaletteDefinitionId } from "../../../../catalogRuntime/paletteInsert";
import { newCatalogProjectDocument } from "../../../../catalogRuntime/project";
import { CatalogWorkspaceProvider } from "../../../../catalogRuntime/react";
import { CatalogStorage } from "../../../../catalogRuntime/storage";
import { CatalogWorkspace } from "../../../../catalogRuntime/workspace";
import { nodeLayoutEngine } from "../../../../catalogRuntime/__tests__/support/nodeLayoutEngine";
import { useToastStore } from "../../../../stores/toast";
import { createCatalogStylesHost } from "../../catalog/catalogStylesHost";
import { StylesHostContext, type StylesHost } from "../../stylesHostContext";

/**
 * ADR-248 4e-9 C: the Styles hook and section tests over the catalog workspace — the host the
 * catalog Styles panel provides (the old store host went with the old store). A node is seeded
 * through the host's own writes (the style CSS → typed fields path the panel uses), so a test
 * reads back what the panel reads.
 */
const BODY = "project:node:home-body" as NodeId;

export interface StylesFixtureNode {
  /** Short id; the node is `project:node:<id>`. */
  id: string;
  /** Palette type (Button, TextField …), "Frame" (default) or "Text". */
  type?: string;
  /** Parent fixture id (default: the page body). */
  parent?: string;
  style?: Record<string, string>;
  /** Breakpoint layers (written with the session at that breakpoint). */
  responsive?: Partial<Record<"tablet" | "mobile", Record<string, string>>>;
  fills?: FillItem[];
  /** Own prop values (written through the host, as the Properties panel would). */
  props?: Record<string, unknown>;
}

export interface StylesFixture {
  workspace: CatalogWorkspace;
  host: StylesHost;
  graph: CatalogWorkspace["runtime"]["graph"];
  wrapper: (props: { children: ReactNode }) => ReactNode;
  /** Select fixture nodes (by short id). */
  select(...ids: string[]): void;
  /** The record identity of a fixture node (what `useSelectedId` returns). */
  recordOf(id: string): string;
  /** The first record of `type` drawn under a fixture node (a template position of an origin). */
  descendantRecord(id: string, type: string): string;
  nodeOf(id: string): NodeEntry;
  /** The node's authored style as the panel reads it (selects it first). */
  styleOf(id: string): Record<string, unknown>;
  setBreakpoint(breakpoint: BreakpointName): void;
  /**
   * Make a fixture node a project component: its fields become the component's, and it is
   * replaced by an instance in place. Returns the instance's record identity.
   */
  componentize(id: string, name: string): string;
}

export const nodeIdOf = (id: string) => `project:node:${id}` as NodeId;

function definitionOf(
  library: Awaited<ReturnType<typeof buildCodeCatalogLibrary>>,
  type: string | undefined,
) {
  if (!type || type === "Frame" || type === "Box" || type === "Div")
    return "lib:definition:type-frame";
  if (type === "Text") return "lib:definition:text";
  return catalogPaletteDefinitionId(library, type);
}

export async function openStylesFixture(
  nodes: StylesFixtureNode[],
  options: { select?: string } = {},
): Promise<StylesFixture> {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:styles-fixture" as EntryId<"project">,
        name: "Styles fixture",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr248-styles-fixture-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const entries: NodeEntry[] = nodes.map((node) => ({
    kind: "node",
    id: nodeIdOf(node.id),
    definitionId: definitionOf(library, node.type) as NodeEntry["definitionId"],
    children: nodes
      .filter((child) => child.parent === node.id)
      .map((child) => nodeIdOf(child.id)),
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
  }));
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries,
      rootIds: nodes.filter((node) => !node.parent).map((n) => nodeIdOf(n.id)),
      newId: workspace.newId,
    }),
  );
  const host = createCatalogStylesHost(workspace);
  const recordOf = (id: string) => {
    const record = workspace.root.recordsOfSource(nodeIdOf(id))[0];
    if (!record) throw new Error(`no record for ${id}`);
    return record;
  };
  const typeOf = (record: string) => {
    const input = workspace.root.domInputs.get(record);
    if (!input) return undefined;
    try {
      return definitionTypeName(
        workspace.runtime.graph,
        input.definitionId as Parameters<typeof definitionTypeName>[1],
      );
    } catch {
      return undefined;
    }
  };
  const descendantRecord = (id: string, type: string) => {
    const queue = [...(workspace.root.domInputs.get(recordOf(id))?.children ?? [])];
    while (queue.length) {
      const record = queue.shift()!;
      if (typeOf(record) === type) return record;
      queue.push(...(workspace.root.domInputs.get(record)?.children ?? []));
    }
    throw new Error(`no ${type} record under ${id}`);
  };
  const select = (...ids: string[]) =>
    workspace.selectRecords(ids.map(recordOf));
  for (const node of nodes) {
    if (!node.style && !node.fills && !node.props && !node.responsive)
      continue;
    select(node.id);
    // A refused write (an error toast) would leave the test reading defaults silently.
    const toasts = () =>
      (useToastStore.getState() as { toasts: { message: string }[] }).toasts;
    const before = toasts().length;
    if (node.props) host.updateProperties(node.props);
    if (node.style) host.updateStyles(node.style);
    if (node.fills) host.updateFills(node.fills);
    for (const [breakpoint, style] of Object.entries(node.responsive ?? {})) {
      workspace.setBreakpoint(breakpoint as BreakpointName);
      host.updateStyles(style);
      workspace.setBreakpoint("desktop");
    }
    const refused = toasts().slice(before);
    if (refused.length)
      throw new Error(
        `seed of ${node.id} was refused: ${refused.map((t) => t.message).join("; ")}`,
      );
    if (node.fills && host.readFills().length !== node.fills.length)
      throw new Error(`fills of ${node.id} were refused`);
  }
  if (options.select) select(options.select);
  else workspace.selectRecords([]);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <CatalogWorkspaceProvider workspace={workspace}>
      <StylesHostContext.Provider value={host}>
        {children}
      </StylesHostContext.Provider>
    </CatalogWorkspaceProvider>
  );
  return {
    workspace,
    host,
    graph: workspace.runtime.graph,
    wrapper,
    select,
    recordOf,
    descendantRecord,
    nodeOf: (id) => workspace.runtime.graph.getEntry(nodeIdOf(id)) as NodeEntry,
    styleOf(id) {
      select(id);
      return host.readSelectedTarget().style;
    },
    setBreakpoint: (breakpoint) => workspace.setBreakpoint(breakpoint),
    componentize(id, name) {
      const graph = workspace.runtime.graph;
      const parentOf = (nodeId: NodeId) =>
        [...nodes.map((node) => nodeIdOf(node.id)), BODY].find((candidate) =>
          (graph.getEntry(candidate) as NodeEntry | undefined)?.children.includes(
            nodeId,
          ),
        )!;
      const parent = parentOf(nodeIdOf(id));
      const index = (graph.getEntry(parent) as NodeEntry).children.indexOf(
        nodeIdOf(id),
      );
      workspace.execute(
        catalogComponentCommands.create(nodeIdOf(id), name, workspace.newId),
      );
      const instance = (graph.getEntry(parent) as NodeEntry).children[index]!;
      return workspace.root.recordsOfSource(instance)[0]!;
    },
  };
}

/** A CSS value as the panel writes it (numbers of length keys are px). */
const UNITLESS = new Set([
  "opacity",
  "zIndex",
  "flexGrow",
  "flexShrink",
  "fontWeight",
  "lineHeight",
  "order",
]);
export function cssOf(style: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(style)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [
        key,
        typeof value === "number" && !UNITLESS.has(key)
          ? `${value}px`
          : String(value),
      ]),
  );
}

/**
 * An old store element (`{id, type, parent_id, props: {style, …}, fills, responsive}`) as a
 * fixture node: the same authored values, written through the catalog host.
 */
interface LegacyElementShape {
  id: string;
  type?: string;
  parent_id?: string | null;
  props?: Record<string, unknown>;
  fills?: unknown;
  responsive?: { styles?: Record<string, Partial<Record<string, unknown>>> };
}

export function fromElements(
  elements: readonly { id: string }[],
): StylesFixtureNode[] {
  return (elements as readonly LegacyElementShape[]).map((element) => {
    const { style, ...props } = (element.props ?? {}) as {
      style?: Record<string, unknown>;
    } & Record<string, unknown>;
    const responsive: StylesFixtureNode["responsive"] = {};
    for (const [key, byBreakpoint] of Object.entries(
      element.responsive?.styles ?? {},
    ))
      for (const [breakpoint, value] of Object.entries(byBreakpoint ?? {})) {
        if (breakpoint !== "tablet" && breakpoint !== "mobile") continue;
        (responsive[breakpoint] ??= {})[key] = cssOf({ [key]: value })[key]!;
      }
    return {
      id: element.id,
      type: element.type,
      ...(element.parent_id ? { parent: element.parent_id } : {}),
      ...(Object.keys(props).length ? { props } : {}),
      ...(style && Object.keys(style).length ? { style: cssOf(style) } : {}),
      ...(Object.keys(responsive).length ? { responsive } : {}),
      ...(Array.isArray(element.fills)
        ? { fills: element.fills as FillItem[] }
        : {}),
    };
  });
}

/** Render a hook that takes a record id, for a fixture node (by short id). */
export function hookOf<T>(
  fixture: StylesFixture,
  hook: (id: string | null) => T,
  id: string | null,
) {
  let record = id;
  try {
    if (id !== null) record = fixture.recordOf(id);
  } catch {
    // Not a fixture node: the hook gets the id as it is (an unknown record).
  }
  return renderHook(() => hook(record), { wrapper: fixture.wrapper });
}
