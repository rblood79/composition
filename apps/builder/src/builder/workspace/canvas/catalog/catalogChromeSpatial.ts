import type { BoundingBox } from "../selection/types";

/** Inclusive edges: editor strokes and zero-height slot bands may touch the viewport. */
export function chromeIntersects(a: BoundingBox, b: BoundingBox): boolean {
  return (
    a.x <= b.x + b.width &&
    a.x + a.width >= b.x &&
    a.y <= b.y + b.height &&
    a.y + a.height >= b.y
  );
}

export function expandChromeBox(box: BoundingBox, margin: number): BoundingBox {
  return {
    x: box.x - margin,
    y: box.y - margin,
    width: box.width + margin * 2,
    height: box.height + margin * 2,
  };
}

interface Entry<T> {
  value: T;
  box: BoundingBox;
  order: number;
}
interface Branch<T> {
  box: BoundingBox;
  entries?: Entry<T>[];
  children?: Branch<T>[];
}

/** Immutable scene-revision index. Camera queries visit intersecting branches, not every page. */
export function createChromeSpatialIndex<T>(
  items: readonly T[],
  boxOf: (item: T) => BoundingBox,
) {
  const build = (entries: Entry<T>[]): Branch<T> | undefined => {
    if (!entries.length) return undefined;
    let x = Infinity,
      y = Infinity,
      right = -Infinity,
      bottom = -Infinity;
    for (const { box } of entries) {
      x = Math.min(x, box.x);
      y = Math.min(y, box.y);
      right = Math.max(right, box.x + box.width);
      bottom = Math.max(bottom, box.y + box.height);
    }
    const box = { x, y, width: right - x, height: bottom - y };
    if (entries.length <= 8) return { box, entries };
    const axis = box.width >= box.height ? "x" : "y";
    entries.sort((a, b) => a.box[axis] - b.box[axis]);
    const mid = entries.length >>> 1;
    return {
      box,
      children: [build(entries.slice(0, mid))!, build(entries.slice(mid))!],
    };
  };
  const tree = build(
    items.map((value, order) => ({ value, order, box: boxOf(value) })),
  );
  return (area: BoundingBox): T[] => {
    const found: Entry<T>[] = [];
    const visit = (branch: Branch<T> | undefined) => {
      if (!branch || !chromeIntersects(branch.box, area)) return;
      if (branch.entries) {
        for (const entry of branch.entries)
          if (chromeIntersects(entry.box, area)) found.push(entry);
      } else branch.children?.forEach(visit);
    };
    visit(tree);
    // Preserve paint/hit order, independent of the spatial tree's partition.
    return found.sort((a, b) => a.order - b.order).map((entry) => entry.value);
  };
}

/** Page paint rank and shared ancestry are resolved once per scene revision. */
export function createCatalogPageChrome(
  roots: readonly string[],
  parentOf: (id: string) => string | undefined,
  boundsOf: (id: string) => BoundingBox | undefined,
) {
  const ranks = new Map(roots.map((id, rank) => [id, rank]));
  const ownerRanks = new Map<string, number>();
  const pages = roots.flatMap((id) => {
    const box = boundsOf(id);
    return box ? [{ id, box, rank: ranks.get(id)! }] : [];
  });
  const query = createChromeSpatialIndex(pages, (page) => page.box);
  const rankOf = (id: string): number => {
    const path: string[] = [];
    let cursor: string | undefined = id;
    let rank = -1;
    while (cursor) {
      const known = ranks.get(cursor) ?? ownerRanks.get(cursor);
      if (known !== undefined) {
        rank = known;
        break;
      }
      path.push(cursor);
      cursor = parentOf(cursor);
    }
    for (const part of path) ownerRanks.set(part, rank);
    return rank;
  };
  return {
    rootsWithin: (area: BoundingBox) => query(area).map((page) => page.id),
    occludersOf(identity: string, area: BoundingBox): BoundingBox[] {
      const rank = rankOf(identity);
      return rank < 0 || rank === roots.length - 1
        ? []
        : query(area)
            .filter((page) => page.rank > rank)
            .map((page) => page.box);
    },
  };
}
