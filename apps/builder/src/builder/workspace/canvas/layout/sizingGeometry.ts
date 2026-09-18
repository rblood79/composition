import type { BreakpointName } from "@composition/shared";
import type { ComputedLayout } from "./engines/LayoutEngine";

/** 화면 AABB가 아닌 엔진의 border-box. tier별 최신 발행만 보관한다. */
interface SizingPublication {
  projectId: string | null;
  documentVersion: number;
  layoutVersion: number;
  breakpoint: BreakpointName;
  rootKey: string;
  viewport: { width: number; height: number };
  layout: ReadonlyMap<string, ComputedLayout>;
}
const publications = new Map<string, SizingPublication>();

export function publishSizingGeometry(input: SizingPublication): void {
  for (const [key, value] of publications) {
    if (
      value.projectId !== input.projectId ||
      value.documentVersion !== input.documentVersion
    )
      publications.delete(key);
  }
  publications.set(`${input.breakpoint}:${input.rootKey}`, input);
}

export function readSizingGeometry(
  id: string,
  tier: BreakpointName,
  expected: {
    projectId: string | null;
    documentVersion: number;
    activeBreakpoint: BreakpointName;
    layoutVersion: number;
    viewport: { width: number; height: number };
  },
): ComputedLayout | null {
  for (const publication of publications.values()) {
    if (
      publication.breakpoint !== tier ||
      publication.projectId !== expected.projectId ||
      publication.documentVersion !== expected.documentVersion
    )
      continue;
    if (
      tier === expected.activeBreakpoint &&
      (publication.layoutVersion !== expected.layoutVersion ||
        publication.viewport.width !== expected.viewport.width ||
        publication.viewport.height !== expected.viewport.height)
    )
      return null;
    const layout = publication.layout.get(id);
    if (
      layout &&
      Number.isFinite(layout.width) &&
      Number.isFinite(layout.height)
    )
      return layout;
  }
  return null;
}
