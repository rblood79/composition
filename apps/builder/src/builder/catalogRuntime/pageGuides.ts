import type { BreakpointName } from "@composition/shared";
import type { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
import type {
  EntryId,
  PageGuideDeclaration,
} from "../../../../../packages/shared/src/catalog/document/types";
import { updatePage } from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import type { GuideDragState } from "../workspace/canvas/interaction/guidePresentation";
import type { PageGuideRenderTarget } from "../workspace/canvas/skia/overlayTypes";

/**
 * ADR-248 Phase 4e: manual guides (ADR-181) over the catalog document — each page keeps its guides
 * per breakpoint in `PageEntry.guideEntries` (page-local px); a guide edit is one `updatePage`
 * step. The drag state, hit test, emphasis and painters are the old Canvas's (store-free).
 */
type Rect = { x: number; y: number; width: number; height: number };

const EMPTY: ReadonlyMap<string, readonly PageGuideDeclaration[]> = new Map();

function projectPageIds(graph: CatalogGraph): readonly EntryId<"page">[] {
  const project = graph.getEntry(graph.projectId);
  return project?.kind === "project" ? project.pageIds : [];
}

/** One page's guides at a breakpoint (none = an empty list). */
export function catalogPageGuides(
  graph: CatalogGraph,
  pageId: string,
  breakpoint: BreakpointName,
): readonly PageGuideDeclaration[] {
  const page = graph.getEntry(pageId);
  return (page?.kind === "page" && page.guideEntries?.[breakpoint]) || [];
}

/** Every page's guides at a breakpoint; pages without guides are left out (the usual case). */
export function catalogGuidesByPage(
  graph: CatalogGraph,
  breakpoint: BreakpointName,
): ReadonlyMap<string, readonly PageGuideDeclaration[]> {
  let out: Map<string, readonly PageGuideDeclaration[]> | undefined;
  for (const pageId of projectPageIds(graph)) {
    const guides = catalogPageGuides(graph, pageId, breakpoint);
    if (guides.length) (out ??= new Map()).set(pageId, guides);
  }
  return out ?? EMPTY;
}

const sameGuides = (
  a: readonly PageGuideDeclaration[],
  b: readonly PageGuideDeclaration[],
) =>
  a.length === b.length &&
  a.every(
    (guide, i) =>
      guide.id === b[i].id &&
      guide.axis === b[i].axis &&
      guide.position === b[i].position,
  );

/** Replace one page's guides at a breakpoint; `undefined` when nothing changes (no empty step). */
export function catalogGuidesCommand(
  graph: CatalogGraph,
  pageId: string,
  breakpoint: BreakpointName,
  after: readonly PageGuideDeclaration[],
  label: string,
): CatalogCommand | undefined {
  const page = graph.getEntry(pageId);
  if (page?.kind !== "page") return undefined;
  const before = page.guideEntries?.[breakpoint] ?? [];
  if (sameGuides(before, after)) return undefined;
  const entries = { ...page.guideEntries };
  if (after.length) entries[breakpoint] = after.map((guide) => ({ ...guide }));
  else delete entries[breakpoint];
  return updatePage({
    id: page.id,
    fields: {
      guideEntries: Object.keys(entries).length ? entries : undefined,
    },
    label,
  });
}

/**
 * A finished guide drag as a step (create, move and delete end the same way: the owner page's new
 * list). A create dropped off every page makes nothing.
 */
export function catalogGuideDragCommand(
  graph: CatalogGraph,
  drag: Pick<
    GuideDragState,
    "kind" | "guideId" | "axis" | "pageId" | "position" | "removing"
  > & { originPageId: string | null },
  breakpoint: BreakpointName,
): CatalogCommand | undefined {
  const owner = drag.removing ? drag.originPageId : drag.pageId;
  if (!owner) return undefined;
  const without = catalogPageGuides(graph, owner, breakpoint).filter(
    (guide) => guide.id !== drag.guideId,
  );
  const after = drag.removing
    ? without
    : [
        ...without,
        { id: drag.guideId, axis: drag.axis, position: drag.position },
      ];
  return catalogGuidesCommand(
    graph,
    owner,
    breakpoint,
    after,
    drag.removing
      ? "Delete guide"
      : drag.kind === "create"
        ? "Add guide"
        : "Move guide",
  );
}

/** Delete one guide (the Delete key on a selected guide). */
export function catalogDeleteGuideCommand(
  graph: CatalogGraph,
  pageId: string,
  guideId: string,
  breakpoint: BreakpointName,
): CatalogCommand | undefined {
  return catalogGuidesCommand(
    graph,
    pageId,
    breakpoint,
    catalogPageGuides(graph, pageId, breakpoint).filter(
      (guide) => guide.id !== guideId,
    ),
    "Delete guide",
  );
}

/** The top page frame under a scene point (later pages draw above earlier ones). */
export function catalogPageAt(
  frames: ReadonlyMap<string, Rect>,
  point: { x: number; y: number },
): string | undefined {
  let found: string | undefined;
  for (const [pageId, rect] of frames)
    if (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    )
      found = pageId;
  return found;
}

/**
 * The drag state at a scene point. Over a ruler a move becomes a delete (Figma's idiom) and a
 * create belongs to no page; a move keeps its page (guides are page-local) and past the page edge
 * it becomes a delete; a create belongs to the page under the pointer.
 */
export function catalogGuideDragAt(
  drag: Pick<GuideDragState, "kind" | "axis" | "originPageId">,
  scene: { x: number; y: number },
  overRuler: boolean,
  frames: ReadonlyMap<string, Rect>,
): Pick<GuideDragState, "pageId" | "position" | "removing" | "scenePosition"> {
  const scenePosition = drag.axis === "x" ? scene.x : scene.y;
  if (overRuler)
    return drag.kind === "move"
      ? {
          pageId: drag.originPageId,
          position: 0,
          removing: true,
          scenePosition,
        }
      : { pageId: null, position: 0, removing: false, scenePosition };
  const pageId =
    drag.kind === "move" ? drag.originPageId : catalogPageAt(frames, scene);
  const frame = pageId ? frames.get(pageId) : undefined;
  if (!pageId || !frame)
    return { pageId: null, position: 0, removing: false, scenePosition };
  const position = Math.round(
    drag.axis === "x" ? scene.x - frame.x : scene.y - frame.y,
  );
  const extent = drag.axis === "x" ? frame.width : frame.height;
  return {
    pageId,
    position,
    removing: drag.kind === "move" && (position < 0 || position > extent),
    scenePosition,
  };
}

/** Paint targets: each page's guides in scene coordinates, clipped to its frame. */
export function catalogGuideTargets(
  guidesByPage: ReadonlyMap<string, readonly PageGuideDeclaration[]>,
  frames: ReadonlyMap<string, Rect>,
): PageGuideRenderTarget[] {
  const out: PageGuideRenderTarget[] = [];
  for (const [pageId, guides] of guidesByPage) {
    const frame = frames.get(pageId);
    if (!frame || !guides.length) continue;
    out.push({
      pageId,
      pageRect: { ...frame },
      lines: guides.map((guide) => ({
        id: guide.id,
        axis: guide.axis,
        position:
          guide.axis === "x"
            ? frame.x + guide.position
            : frame.y + guide.position,
      })),
    });
  }
  return out;
}

/**
 * Manual guides as snap lines (scene coordinates): each page's guides at its frame, without the
 * pages in `exclude` (a dragged page carries its own guides along).
 */
export function catalogGuideSnapLines(
  guidesByPage: ReadonlyMap<string, readonly PageGuideDeclaration[]>,
  frames: ReadonlyMap<string, Rect>,
  exclude?: ReadonlySet<string>,
): { x: number[]; y: number[] } {
  const lines = { x: [] as number[], y: [] as number[] };
  for (const [pageId, guides] of guidesByPage) {
    const frame = frames.get(pageId);
    if (!frame || exclude?.has(pageId)) continue;
    for (const guide of guides)
      lines[guide.axis].push(
        (guide.axis === "x" ? frame.x : frame.y) + guide.position,
      );
  }
  return lines;
}
