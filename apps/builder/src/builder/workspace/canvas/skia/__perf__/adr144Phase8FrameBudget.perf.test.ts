// ADR-144 Phase 8 — Perf baseline + ADR-910 handoff (G7 blocking gate)
//
// Methodology: docs/adr/design/144-composite-rac-resolved-tree-parity-phase8-methodology.md
//
// Pass/fail (G7):
//   G7-A Tabs +25% — p95(resolved-tree) ≤ p95(props-only) × 1.25
//   G7-B 60fps    — p95 ≤ 16.67ms across all measured paths
//   G7-C 1000+ stress — same 60fps threshold at family stress scale
//   G7-D nodeCount + heap delta — informational, ADR-910 baseline feed
//
// 4 family (Select/ComboBox/ListBox/Menu) Skia path is props-only (Wave B not
// landed). G7-A comparison for those families is therefore deferred and only
// G7-B/C/D apply at this phase.

import { describe, expect, it } from "vitest";
import type {
  CanonicalNode,
  CompositionDocument,
  RefNode,
} from "@composition/shared";

import { resolveCanonicalDocument } from "../../../../../resolvers/canonical";
import {
  measureGenericResolvedSkiaFrameBudget,
  type GenericResolvedSkiaBuildInput,
  type GenericResolvedSkiaFrameBudget,
  type GenericResolvedSkiaLayout,
} from "../buildSpecNodeData";

// ---------------------------------------------------------------------------
// Aggregation helpers
// ---------------------------------------------------------------------------

const FRAME_BUDGET_MS = 16.67; // 60fps target
const TABS_RESOLVED_OVER_PROPS_RATIO = 1.25; // G7-A blocking budget

interface PercentileSummary {
  readonly p50: number;
  readonly p95: number;
  readonly max: number;
  readonly mean: number;
}

function percentileSummary(samples: readonly number[]): PercentileSummary {
  const sorted = [...samples].sort((a, b) => a - b);
  const len = sorted.length;
  const pick = (p: number): number => {
    if (len === 0) return 0;
    const rank = Math.min(len - 1, Math.max(0, Math.ceil((p / 100) * len) - 1));
    return sorted[rank];
  };
  const mean = sorted.reduce((a, b) => a + b, 0) / Math.max(1, len);
  return { p50: pick(50), p95: pick(95), max: sorted[len - 1] ?? 0, mean };
}

interface MeasurementResult {
  readonly label: string;
  readonly nodeCount: number;
  readonly summary: PercentileSummary;
  readonly heapDeltaBytes: number;
}

function runMeasurement(
  label: string,
  input: GenericResolvedSkiaBuildInput,
  warmup = 20,
  iterations = 100,
): MeasurementResult {
  // Warm up JIT / inline caches; results discarded.
  for (let i = 0; i < warmup; i += 1) {
    measureGenericResolvedSkiaFrameBudget(input);
  }
  if (typeof globalThis.gc === "function") {
    globalThis.gc();
  }
  const memBefore = process.memoryUsage().heapUsed;
  const samples: number[] = [];
  let lastResult: GenericResolvedSkiaFrameBudget | null = null;
  for (let i = 0; i < iterations; i += 1) {
    const measurement = measureGenericResolvedSkiaFrameBudget(input);
    samples.push(measurement.durationMs);
    lastResult = measurement;
  }
  const memAfter = process.memoryUsage().heapUsed;
  const summary = percentileSummary(samples);
  // eslint-disable-next-line no-console
  console.log(
    `[ADR-144 Phase 8] ${label}: ` +
      `nodes=${lastResult?.nodeCount ?? 0} ` +
      `p50=${summary.p50.toFixed(3)}ms ` +
      `p95=${summary.p95.toFixed(3)}ms ` +
      `max=${summary.max.toFixed(3)}ms ` +
      `mean=${summary.mean.toFixed(3)}ms ` +
      `heapDelta=${(memAfter - memBefore).toLocaleString()}B`,
  );
  return {
    label,
    nodeCount: lastResult?.nodeCount ?? 0,
    summary,
    heapDeltaBytes: memAfter - memBefore,
  };
}

// ---------------------------------------------------------------------------
// Tabs payload builders — props-only vs resolved-tree
// ---------------------------------------------------------------------------

const PAGE_ID = "page-1";
const TABS_ID = "tabs-instance";
const PAGE_W = 1280;
const PAGE_H = 800;
const TABS_W = 960;
const TABS_H = 480;

function makeTabsPropsOnlyDocument(itemCount: number): CompositionDocument {
  const items = Array.from({ length: itemCount }, (_, index) => ({
    id: `tab-${index}`,
    label: `Tab ${index}`,
    content: `Panel ${index} content`,
  }));
  const tabsNode: CanonicalNode = {
    id: TABS_ID,
    type: "Tabs",
    props: {
      "aria-label": "Sections",
      defaultSelectedKey: "tab-0",
      orientation: "horizontal",
      showIndicator: true,
      size: "M",
      items,
      style: { width: TABS_W, height: TABS_H },
    },
  };
  return {
    version: "composition-1.0",
    children: [
      {
        id: PAGE_ID,
        type: "frame",
        metadata: { type: "page", pageId: PAGE_ID },
        props: { style: { width: PAGE_W, height: PAGE_H } },
        children: [tabsNode],
      },
    ],
  };
}

function makeTabsResolvedDocument(itemCount: number): CompositionDocument {
  const tabOrigin: CanonicalNode = {
    id: "tab-origin",
    type: "Tab",
    reusable: true,
    name: "Tab",
    children: [
      { id: "tab-label", type: "Text", props: { text: "Tab" } },
      { id: "tab-indicator", type: "frame", props: { enabled: false } },
    ],
  };
  const tabRefs: CanonicalNode[] = Array.from(
    { length: itemCount },
    (_, index): CanonicalNode =>
      ({
        id: `tab-ref-${index}`,
        type: "ref",
        ref: "tab-origin",
        descendants: {
          "tab-label": { text: `Tab ${index}` },
          "tab-indicator": { enabled: index === 0 },
        },
      }) as RefNode,
  );
  const tabListOrigin: CanonicalNode = {
    id: "tablist-origin",
    type: "TabList",
    reusable: true,
    children: tabRefs,
  };
  const panels: CanonicalNode[] = Array.from(
    { length: itemCount },
    (_, index): CanonicalNode => ({
      id: `panel-${index}`,
      type: "TabPanel",
      props: { id: `tab-ref-${index}` },
      children: [
        {
          id: `panel-${index}-body`,
          type: "Text",
          props: { children: `Panel ${index} content` },
        },
      ],
    }),
  );
  const tabsOrigin: CanonicalNode = {
    id: "tabs-origin",
    type: "Tabs",
    reusable: true,
    props: {
      "aria-label": "Sections",
      defaultSelectedKey: "tab-ref-0",
      orientation: "horizontal",
      showIndicator: true,
      size: "M",
      style: { width: TABS_W, height: TABS_H },
    },
    children: [
      {
        id: "tabs-tablist-ref",
        type: "ref",
        ref: "tablist-origin",
      } as RefNode,
      ...panels,
    ],
  };
  return {
    version: "composition-1.0",
    children: [
      tabOrigin,
      tabListOrigin,
      tabsOrigin,
      {
        id: PAGE_ID,
        type: "frame",
        metadata: { type: "page", pageId: PAGE_ID },
        props: { style: { width: PAGE_W, height: PAGE_H } },
        children: [{ id: TABS_ID, type: "ref", ref: "tabs-origin" } as RefNode],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Collection family payload builders (props-only path — Wave B deferred)
// ---------------------------------------------------------------------------

interface CollectionPayloadOptions {
  containerType: "ListBox" | "Menu" | "Select" | "ComboBox";
  itemCount: number;
}

function makeCollectionPropsOnlyDocument({
  containerType,
  itemCount,
}: CollectionPayloadOptions): CompositionDocument {
  const items = Array.from({ length: itemCount }, (_, index) => ({
    id: `item-${index}`,
    label: `Item ${index}`,
  }));
  const containerProps: Record<string, unknown> = {
    "aria-label": containerType,
    items,
    style: { width: TABS_W, height: TABS_H },
  };
  if (containerType === "Menu") {
    containerProps.children = "Menu";
    containerProps.selectionMode = "none";
  } else if (containerType === "ListBox") {
    containerProps.selectionMode = "single";
  } else if (containerType === "Select" || containerType === "ComboBox") {
    containerProps.label = containerType;
    containerProps.placeholder = "Pick one";
  }
  const container: CanonicalNode = {
    id: `${containerType.toLowerCase()}-instance`,
    type: containerType,
    props: containerProps,
  };
  return {
    version: "composition-1.0",
    children: [
      {
        id: PAGE_ID,
        type: "frame",
        metadata: { type: "page", pageId: PAGE_ID },
        props: { style: { width: PAGE_W, height: PAGE_H } },
        children: [container],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Layout map helpers — uniform layouts for all canonical ids in the tree.
// ---------------------------------------------------------------------------

function collectAllIds(node: CanonicalNode | undefined): string[] {
  if (!node) return [];
  const here = typeof node.id === "string" ? [node.id] : [];
  return [
    ...here,
    ...((node.children ?? []) as CanonicalNode[]).flatMap((child) =>
      collectAllIds(child),
    ),
  ];
}

function buildLayoutMap(
  pageNode: CanonicalNode,
): Map<string, GenericResolvedSkiaLayout> {
  const layoutById = new Map<string, GenericResolvedSkiaLayout>();
  layoutById.set(PAGE_ID, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
  layoutById.set(TABS_ID, { x: 0, y: 0, width: TABS_W, height: TABS_H });
  const everyId = collectAllIds(pageNode);
  for (const id of everyId) {
    if (!layoutById.has(id)) {
      layoutById.set(id, { x: 0, y: 0, width: TABS_W, height: TABS_H });
    }
  }
  return layoutById;
}

function resolvePageInput(
  doc: CompositionDocument,
): GenericResolvedSkiaBuildInput {
  const resolved = resolveCanonicalDocument(doc);
  const page = resolved.find((node) => node.id === PAGE_ID);
  if (!page) {
    throw new Error("page node missing in resolved document");
  }
  return {
    node: page,
    theme: "light",
    layoutById: buildLayoutMap(page as CanonicalNode),
  };
}

// ---------------------------------------------------------------------------
// G7-A / G7-B — Tabs dual-path comparison
// ---------------------------------------------------------------------------

describe("ADR-144 Phase 8 — G7 Tabs frame budget (resolved vs props-only)", () => {
  it("Tabs N=10: resolved-tree p95 ≤ props-only p95 × 1.25 AND ≤ 16.67ms", () => {
    const propsInput = resolvePageInput(makeTabsPropsOnlyDocument(10));
    const resolvedInput = resolvePageInput(makeTabsResolvedDocument(10));

    const propsResult = runMeasurement("Tabs N=10 props-only", propsInput);
    const resolvedResult = runMeasurement(
      "Tabs N=10 resolved-tree",
      resolvedInput,
    );

    // G7-B 60fps blocking budget
    expect(resolvedResult.summary.p95).toBeLessThanOrEqual(FRAME_BUDGET_MS);
    expect(propsResult.summary.p95).toBeLessThanOrEqual(FRAME_BUDGET_MS);

    // G7-A +25% blocking budget — guarded against tiny denominator
    const ratioCeiling = Math.max(
      propsResult.summary.p95 * TABS_RESOLVED_OVER_PROPS_RATIO,
      0.5, // 0.5ms floor — sub-millisecond noise should not gate
    );
    expect(resolvedResult.summary.p95).toBeLessThanOrEqual(ratioCeiling);
  });

  it("Tabs N=100: 60fps budget holds for both paths", () => {
    const propsInput = resolvePageInput(makeTabsPropsOnlyDocument(100));
    const resolvedInput = resolvePageInput(makeTabsResolvedDocument(100));

    const propsResult = runMeasurement("Tabs N=100 props-only", propsInput);
    const resolvedResult = runMeasurement(
      "Tabs N=100 resolved-tree",
      resolvedInput,
    );

    expect(resolvedResult.summary.p95).toBeLessThanOrEqual(FRAME_BUDGET_MS);
    expect(propsResult.summary.p95).toBeLessThanOrEqual(FRAME_BUDGET_MS);

    const ratioCeiling = Math.max(
      propsResult.summary.p95 * TABS_RESOLVED_OVER_PROPS_RATIO,
      0.5,
    );
    expect(resolvedResult.summary.p95).toBeLessThanOrEqual(ratioCeiling);
  });
});

// ---------------------------------------------------------------------------
// G7-C — family stress at 1000+ scale (props-only path; Wave B deferred)
// ---------------------------------------------------------------------------

describe("ADR-144 Phase 8 — G7-C family stress (60fps blocking)", () => {
  it("Tabs resolved-tree N=1000 holds 60fps budget", () => {
    const input = resolvePageInput(makeTabsResolvedDocument(1000));
    const result = runMeasurement("Tabs N=1000 resolved-tree stress", input);
    expect(result.summary.p95).toBeLessThanOrEqual(FRAME_BUDGET_MS);
  });

  it("ListBox props-only N=1000 holds 60fps budget", () => {
    const input = resolvePageInput(
      makeCollectionPropsOnlyDocument({
        containerType: "ListBox",
        itemCount: 1000,
      }),
    );
    const result = runMeasurement("ListBox N=1000 props-only stress", input);
    expect(result.summary.p95).toBeLessThanOrEqual(FRAME_BUDGET_MS);
  });

  it("Menu props-only N=1000 holds 60fps budget", () => {
    const input = resolvePageInput(
      makeCollectionPropsOnlyDocument({
        containerType: "Menu",
        itemCount: 1000,
      }),
    );
    const result = runMeasurement("Menu N=1000 props-only stress", input);
    expect(result.summary.p95).toBeLessThanOrEqual(FRAME_BUDGET_MS);
  });

  it("Select props-only N=200 holds 60fps budget (RAC popover scale)", () => {
    const input = resolvePageInput(
      makeCollectionPropsOnlyDocument({
        containerType: "Select",
        itemCount: 200,
      }),
    );
    const result = runMeasurement("Select N=200 props-only stress", input);
    expect(result.summary.p95).toBeLessThanOrEqual(FRAME_BUDGET_MS);
  });

  it("ComboBox props-only N=200 holds 60fps budget (RAC popover scale)", () => {
    const input = resolvePageInput(
      makeCollectionPropsOnlyDocument({
        containerType: "ComboBox",
        itemCount: 200,
      }),
    );
    const result = runMeasurement("ComboBox N=200 props-only stress", input);
    expect(result.summary.p95).toBeLessThanOrEqual(FRAME_BUDGET_MS);
  });
});
