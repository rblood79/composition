// @vitest-environment jsdom
/**
 * S2 1.8.0 Slider `trackStyle` · `thumbStyle` · `fillOffset` (2026-10-10 — 조사 §6.1 ③ 개별):
 * - trackStyle thick: 트랙 바가 16px · S2 sm 모서리 (S2 trackStyling thin 4 → ours per-size ·
 *   thick 16, radius sm). 양 consumer — Canvas 는 styleOf 높이 + rule containerVariants 의
 *   radius, DOM 은 트랙 요소 inline.
 * - thumbStyle precise: 좁은 막대 썸 (S2 width 6 · height size+2).
 * - fillOffset: 채움이 그 값에서 시작한다 (RAC SliderFill `offset` — DOM 은 RAC 계산, Canvas 는
 *   `catalogSliderFillLayout` 같은 식).
 */
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "../canvasBinding";
import { renderCatalogDom } from "../domBinding";
import { catalogSemanticContracts } from "../editContract";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const OWNER = "project:node:slider" as NodeId;

async function open(props: Record<string, unknown>) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:slider-s2" as const,
        name: "Slider S2",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `slider-s2-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const definitionId = catalogPaletteDefinitionId(library, "Slider");
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        {
          kind: "node",
          id: OWNER,
          definitionId,
          children: [],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [
              key,
              { kind: "set", value },
            ]),
          ),
          visual: {},
          sizing: { width: { kind: "set", value: 400 } },
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [OWNER],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const record = [...root.domInputs.values()].find(
    (item) => item.sourceId === OWNER,
  )!;
  const part = (rule: string) =>
    [...root.domInputs.values()].find(
      (item) =>
        (item.ruleId ?? "") === rule && item.id.startsWith(`${record.id}`),
    ) ?? [...root.domInputs.values()].find((item) => item.ruleId === rule);
  const html = renderToStaticMarkup(renderCatalogDom(root, record.id));
  return { root, record, part, html, definitionId };
}

const geometry = (
  root: { getGeometry: (ids: readonly string[]) => ReadonlyMap<string, unknown> },
  id: string,
) =>
  root.getGeometry([id]).get(id) as {
    x: number;
    width: number;
    height: number;
  };

describe("S2 Slider trackStyle · thumbStyle · fillOffset", () => {
  it("the Design panel offers Track Style · Thumb Style · Fill Offset", async () => {
    const { definitionId } = await open({});
    const contracts = catalogSemanticContracts(definitionId, "Slider");
    expect(contracts.trackStyle).toMatchObject({
      kind: "enum",
      default: "thin",
    });
    expect(contracts.thumbStyle).toMatchObject({
      kind: "enum",
      default: "default",
    });
    expect(contracts.fillOffset).toMatchObject({ kind: "number" });
  });

  it("trackStyle thick: a 16px bar with the S2 sm corner in both consumers", async () => {
    const { root, part, html } = await open({ trackStyle: "thick" });
    const track = part("SliderTrack")!;
    expect(track.derivedProps?.trackStyle).toBe("thick");
    expect(geometry(root, track.id).height).toBe(16);
    // (The style attribute precedes the class in the markup.)
    expect(html).toMatch(
      /<div [^>]*height:16px;border-radius:4px[^>]*data-track-style="thick"/,
    );
    const canvas = bindCatalogCanvas(root, root.pageRootRecords());
    const painted = getSkiaNode(track.id) as unknown as {
      box?: { borderRadius?: number | number[] };
    };
    canvas.dispose();
    const radius = painted.box?.borderRadius;
    expect(Array.isArray(radius) ? radius[0] : radius).toBe(4);
  });

  it("default: the track keeps its per-size bar (M 8px, full corner)", async () => {
    const { root, part } = await open({});
    const track = part("SliderTrack")!;
    expect(track.derivedProps?.trackStyle).toBeUndefined();
    expect(geometry(root, track.id).height).toBe(8);
  });

  it("thumbStyle precise: a 6-wide, size+2-tall bar in both consumers", async () => {
    const { root, part, html } = await open({ thumbStyle: "precise" });
    const thumb = part("SliderThumb") ?? part("")!;
    const thumbRecord = [...root.domInputs.values()].find(
      (item) => item.bindingId === "sliderthumb",
    )!;
    void thumb;
    const box = geometry(root, thumbRecord.id);
    expect(box.width).toBe(6);
    expect(box.height).toBe(20);
    expect(html).toMatch(/width:6px/);
  });

  it("fillOffset 50 (value 30, 0–100): the fill runs 30% → 50% of the track", async () => {
    const { root } = await open({ value: 30, fillOffset: 50 });
    const fill = [...root.domInputs.values()].find(
      (item) => item.bindingId === "sliderfill",
    )!;
    const track = [...root.domInputs.values()].find(
      (item) => (item.ruleId ?? "") === "SliderTrack",
    )!;
    const fillBox = geometry(root, fill.id);
    const trackBox = geometry(root, track.id);
    expect(fillBox.width / trackBox.width).toBeCloseTo(0.2, 2);
    expect((fillBox.x - trackBox.x) / trackBox.width).toBeCloseTo(0.3, 2);
  });

  it("no fillOffset: the fill runs from the start to the value", async () => {
    const { root } = await open({ value: 30 });
    const fill = [...root.domInputs.values()].find(
      (item) => item.bindingId === "sliderfill",
    )!;
    const track = [...root.domInputs.values()].find(
      (item) => (item.ruleId ?? "") === "SliderTrack",
    )!;
    const fillBox = geometry(root, fill.id);
    const trackBox = geometry(root, track.id);
    expect(fillBox.width / trackBox.width).toBeCloseTo(0.3, 2);
    expect(fillBox.x - trackBox.x).toBeCloseTo(0, 1);
  });
});
